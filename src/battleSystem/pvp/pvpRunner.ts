// src/battleSystem/pvp/pvpRunner.ts
import { CombatManager } from "../core/CombatManager";
import type { WeaponData } from "../core/Weapon";
import { normalizeWeaponData, ensureWeaponOrDefault } from "../core/Weapon";
import { mulberry32 } from "../core/RngFightSeed";

/* ───────── Tipos del runner ───────── */
export type TimelineEvent = "hit" | "crit" | "block" | "miss" | "passive_proc" | "ultimate_cast" | "dot_tick"; // ← nuevo: ticks de DoT (sangre/veneno/quemadura)

export interface TimelineEntry {
  turn: number;
  actor: "attacker" | "defender";
  damage: number;
  attackerHP: number;
  defenderHP: number;
  event: TimelineEvent;
  ability?: {
    kind: "passive" | "ultimate";
    name?: string;
    id?: string;
    durationTurns?: number;
  };
  tags?: string[];
}

export interface PvpFightResult {
  outcome: "win" | "lose" | "draw";
  turns: number; // solo impactos (hit/crit/block/miss)
  timeline: TimelineEntry[];
  log: string[];
  snapshots: Array<{
    round: number;
    actor: "player" | "enemy";
    damage: number;
    playerHP: number;
    enemyHP: number;
    events: string[];
    status?: Record<string, any>;
  }>;
}

const DEBUG_PVP = false;

/* ───────── utils ───────── */
const toNum = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pctToFrac = (v: any) => {
  const n = toNum(v, 0);
  return n > 1 ? n / 100 : n < 0 ? 0 : n;
};
const i = (n: any, def = 0) => (Number.isFinite(Number(n)) ? Number(n) : def);
const clampInt = (n: any, min: number, max: number) => {
  const v = Math.round(i(n, min));
  return Math.max(min, Math.min(max, v));
};

function flagsToEvent(flags: { miss?: boolean; crit?: boolean; blocked?: boolean }): Exclude<TimelineEvent, "passive_proc" | "ultimate_cast" | "dot_tick"> {
  if (flags?.miss) return "miss";
  if (flags?.blocked) return "block";
  if (flags?.crit) return "crit";
  return "hit";
}
function isImpactEvent(ev: TimelineEvent) {
  return ev === "hit" || ev === "crit" || ev === "block" || ev === "miss";
}

/* ───────── armas y shape ───────── */
function extractWeapons(raw: any): { main: WeaponData; off?: WeaponData | null } {
  const mainRaw = raw?.weapon ?? raw?.equipment?.weapon ?? raw?.equipment?.mainHand ?? raw?.equipment?.mainWeapon ?? null;
  const offRaw = raw?.offHand ?? raw?.offhand ?? raw?.equipment?.offHand ?? raw?.equipment?.offhand ?? raw?.equipment?.shield ?? null;

  // Fallback a puños si no hay arma (lo maneja ensureWeaponOrDefault)
  const main = ensureWeaponOrDefault(mainRaw);
  const off = offRaw ? normalizeWeaponData(offRaw) : null;
  return { main, off };
}

/* ───────── normalización a CombatManager.CombatSide ───────── */
function toCMEntity(raw: any, rng: () => number) {
  const csRaw = raw?.combat ?? raw?.combatStats ?? {};

  const combatNorm = {
    attackPower: toNum(csRaw.attackPower, 5),
    magicPower: toNum(csRaw.magicPower, 0),
    evasion: clamp01(pctToFrac(csRaw.evasion)),
    blockChance: clamp01(pctToFrac(csRaw.blockChance)),
    damageReduction: clamp01(pctToFrac(csRaw.damageReduction)),
    criticalChance: clamp01(pctToFrac(csRaw.criticalChance)),
    criticalDamageBonus: Math.max(0, pctToFrac(csRaw.criticalDamageBonus ?? 0.5)),
    attackSpeed: Math.max(1, Math.round(toNum(csRaw.attackSpeed, 6))), // enteros (AS táctico)
    maxHP: toNum(csRaw.maxHP ?? raw?.maxHP, 100),
  };

  const maxHP = clampInt(raw?.maxHP ?? combatNorm.maxHP, 1, 10_000_000);
  const currentHP = clampInt(raw?.currentHP ?? maxHP, 0, maxHP);

  const { main, off } = extractWeapons(raw);

  // bonus defensivo si el offhand es escudo
  if (off?.category === "shield") {
    combatNorm.blockChance = clamp01(combatNorm.blockChance + 0.05);
    combatNorm.damageReduction = clamp01(combatNorm.damageReduction + 0.03);
  }

  // skills/clase → necesarios para que el CombatManager procee pasivas/ultimate
  const cls = raw?.class ?? {};
  const passiveDefaultSkill = cls?.passiveDefaultSkill ?? undefined;
  const ultimateSkill = cls?.ultimateSkill ?? undefined;
  const primaryWeapons: string[] | undefined = Array.isArray(cls?.primaryWeapons) ? cls.primaryWeapons : undefined;

  return {
    name: raw?.name ?? raw?.username ?? "—",
    className: raw?.className ?? raw?.class?.name ?? undefined,
    baseStats: raw?.baseStats ?? raw?.stats ?? {}, // Fate aquí
    stats: raw?.stats ?? {},
    resistances: raw?.resistances ?? {},
    equipment: raw?.equipment ?? {},
    maxHP,
    currentHP,
    combat: combatNorm,
    combatStats: combatNorm,
    weaponMain: main,
    weaponOff: off ?? null,
    classMeta: { primaryWeapons: primaryWeapons ?? raw?.class?.primaryWeapons ?? undefined },
    passiveDefaultSkill,
    ultimateSkill,
  };
}

/* ───────── Runner PvP fino: delega todo al CombatManager ───────── */
export function runPvp({ attackerSnapshot, defenderSnapshot, seed, maxRounds = 30 }: { attackerSnapshot: any; defenderSnapshot: any; seed: number; maxRounds?: number }): PvpFightResult {
  const rng = mulberry32(seed || 1);

  const attacker = toCMEntity(attackerSnapshot, rng);
  const defender = toCMEntity(defenderSnapshot, rng);

  if (DEBUG_PVP) {
    console.log("[PVP] A.combat =", attacker.combat, "A.weaponMain =", attacker.weaponMain, "A.weaponOff =", attacker.weaponOff);
    console.log("[PVP] D.combat =", defender.combat, "D.weaponMain =", defender.weaponMain, "D.weaponOff =", defender.weaponOff);
  }

  const cm = new CombatManager(attacker, defender, { rng });

  const timeline: TimelineEntry[] = [];
  const log: string[] = [];
  const snapshots: PvpFightResult["snapshots"] = [];

  for (let turn = 1; turn <= maxRounds; turn++) {
    cm.startRound(turn, () => {});
    const isAtkTurn = turn % 2 === 1;

    // Ejecuta el turno con burst (el manager ya emite eventos y aplica estados)
    const out = isAtkTurn ? cm.playerAttack() : cm.enemyAttack();

    // Construimos entries a partir de los eventos del manager + el agregado del golpe
    const actorSide: "player" | "enemy" = isAtkTurn ? "player" : "enemy";
    const actorRole: "attacker" | "defender" = isAtkTurn ? "attacker" : "defender";
    const atkEntity = isAtkTurn ? attacker : defender;

    // tags comunes de arma
    const baseTags: string[] = [];
    if (atkEntity?.weaponMain?.slug) baseTags.push(`${actorSide}:weapon:${atkEntity.weaponMain.slug}`);
    // si el offhand contribuye a daño (weapon/focus), lo taggeamos (sin depender de offhandUsed)
    if (atkEntity?.weaponOff?.slug && (atkEntity.weaponOff.category === "weapon" || atkEntity.weaponOff.category === "focus")) {
      baseTags.push(`${actorSide}:weapon_off:${atkEntity.weaponOff.slug}`);
    }

    // 1) eventos estructurados que trae el manager (dot_tick, ultimate_cast, passive_proc, hits…)
    for (const ev of out.events ?? []) {
      // map actor del manager ("player"/"enemy") al rol local en este turno ("attacker"/"defender")
      const evActorIsPlayer = ev.actor === "player";
      const evActorRole: "attacker" | "defender" = (isAtkTurn && evActorIsPlayer) || (!isAtkTurn && !evActorIsPlayer) ? "attacker" : "defender";

      if (ev.type === "dot_tick") {
        const entryTags = [...baseTags, `${evActorRole}:dot:${ev.key}`];
        timeline.push({
          turn,
          actor: evActorRole,
          damage: ev.damage,
          attackerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
          event: "dot_tick",
          tags: entryTags,
        });
        log.push(`• DoT (${ev.key}) hace ${ev.damage} de daño.`);
        continue;
      }

      if (ev.type === "ultimate_cast") {
        timeline.push({
          turn,
          actor: evActorRole,
          damage: 0,
          attackerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
          event: "ultimate_cast",
          ability: { kind: "ultimate", name: ev.name },
          tags: [...baseTags, `${evActorRole}:ultimate:${ev.name}`],
        });
        log.push(`▶️ ${evActorRole === "attacker" ? "Atacante" : "Defensor"} lanza Ultimate: ${ev.name}`);
        continue;
      }

      if (ev.type === "passive_proc") {
        timeline.push({
          turn,
          actor: evActorRole,
          damage: 0,
          attackerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
          event: "passive_proc",
          ability: { kind: "passive", name: ev.name, durationTurns: ev.duration },
          tags: [...baseTags, `${evActorRole}:passive:${ev.name}`, `${evActorRole}:passive:${ev.result}`],
        });
        log.push(`✨ ${evActorRole === "attacker" ? "Atacante" : "Defensor"} pasiva ${ev.name} (${ev.result})`);
        continue;
      }

      // CRIT/BLOCK/MISS/HIT activos
      if (ev.type === "crit" || ev.type === "block" || ev.type === "miss") {
        // Estos eventos ya fueron reflejados en el propio "hit" posterior; los usamos como tags auxiliares
        const tag = ev.type === "crit" ? `${evActorRole}:crit` : ev.type === "block" ? `${evActorRole}:blocked` : `${evActorRole}:miss`;
        baseTags.push(tag);
        continue;
      }

      if (ev.type === "hit") {
        const entryTags = [...baseTags, `${evActorRole}:attack`, `${evActorRole}:vfx:${ev.vfx}`];
        const entry = {
          turn,
          actor: evActorRole,
          damage: ev.damage.final,
          attackerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
          event: flagsToEvent({
            // derivamos el tipo a partir del breakdown que ya registró el manager (tags previos)
            // no tenemos miss/block/crit en este objeto, pero ya empujamos tags antes; el "hit" queda como tal
          }),
          tags: entryTags,
        } as TimelineEntry;

        // Si tenés interés, podés inyectar breakdown en tags debug:
        // entry.tags?.push(`d:df=${ev.damage.breakdown.defenseFactor}`, `d:elm=${ev.damage.breakdown.elementFactor}`);

        // En la UI solemos distinguir por tags; el event base lo dejamos "hit".
        entry.event = "hit";
        timeline.push(entry);

        const who = evActorRole === "attacker" ? attackerSnapshot?.name ?? "Atacante" : defenderSnapshot?.name ?? "Defensor";
        const tgt = evActorRole === "attacker" ? defenderSnapshot?.name ?? "Defensor" : attackerSnapshot?.name ?? "Atacante";
        log.push(`${who} golpea a ${tgt} por ${ev.damage.final}.`);
        continue;
      }
    }

    // Snapshot por fin de turno (agregamos daño total del burst)
    snapshots.push({
      round: turn,
      actor: actorSide,
      damage: Math.max(0, toNum(out.damage, 0)),
      playerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
      enemyHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
      events: (out.events ?? []).map((e) => e.type),
      status: {},
    });

    if (cm.isCombatOver()) break;
  }

  // Resolver ganador
  let w = cm.getWinner();
  if (!w) {
    const aHP = clampInt((cm as any).player?.currentHP, 0, attacker.maxHP);
    const dHP = clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP);
    const diff = aHP - dHP;
    const thr = Math.max(1, Math.round(0.01 * (aHP + dHP + 1)));
    if (Math.abs(diff) <= thr) w = null;
    else w = diff > 0 ? "player" : "enemy";
  }
  const outcome: "win" | "lose" | "draw" = !w ? "draw" : w === "player" ? "win" : "lose";

  // ✅ turns = cantidad de IMPACTOS (hit/crit/block/miss), no cuenta dot_tick ni passive/ultimate_cast
  const turns = timeline.reduce((acc, e) => acc + (isImpactEvent(e.event) ? 1 : 0), 0);

  return { outcome, turns, timeline, log, snapshots };
}

/* ───────── Adaptador a contrato de Match ───────── */
export type MatchTimelineEvent = TimelineEvent;

export interface MatchTimelineEntry {
  turn: number;
  source: "attacker" | "defender";
  event: MatchTimelineEvent;
  damage: number;
  attackerHP: number;
  defenderHP: number;
  ability?: {
    kind: "passive" | "ultimate";
    name?: string;
    id?: string;
    durationTurns?: number;
  };
  tags?: string[];
}

export type RunPvpForMatchResult = {
  outcome: "attacker" | "defender" | "draw";
  timeline: MatchTimelineEntry[];
};

export function runPvpForMatch(attackerSnapshot: any, defenderSnapshot: any, seed: number, maxRounds: number = 30): RunPvpForMatchResult {
  const { outcome, timeline } = runPvp({ attackerSnapshot, defenderSnapshot, seed, maxRounds });
  const mappedOutcome: RunPvpForMatchResult["outcome"] = outcome === "win" ? "attacker" : outcome === "lose" ? "defender" : "draw";

  const mappedTimeline: MatchTimelineEntry[] = timeline.map((e) => ({
    turn: e.turn,
    source: e.actor,
    event: e.event,
    damage: e.damage,
    attackerHP: e.attackerHP,
    defenderHP: e.defenderHP,
    ability: e.ability ? { ...e.ability } : undefined,
    tags: e.tags && e.tags.length ? e.tags.slice(0, 12) : undefined,
  }));

  return { outcome: mappedOutcome, timeline: mappedTimeline };
}

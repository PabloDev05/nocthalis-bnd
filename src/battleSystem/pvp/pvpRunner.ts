// src/battleSystem/pvp/pvpRunner.ts
// Runner para simulaciones PvP entre dos entidades (jugador vs jugador o NPC).
// Usa internamente CombatManager para resolver la pelea.
// El output es un objeto con el resultado, línea de tiempo de eventos y log de texto.

import { CombatManager } from "../core/CombatManager";
import type { WeaponData } from "../core/Weapon";
import { normalizeWeaponData, ensureWeaponOrDefault } from "../core/Weapon";
import { mulberry32 } from "../core/RngFightSeed";

/* ───────── Tipos del runner ───────── */
export type TimelineEvent =
  | "hit"
  | "crit"
  | "block"
  | "miss"
  | "passive_proc"
  | "ultimate_cast"
  | "dot_tick";

export interface TimelineEntry {
  turn: number;
  /** Compat con frontend (lee source o actor). */
  source?: "attacker" | "defender";
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
  turns: number;
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
  if (typeof v === "string") {
    const s = v.replace?.("%", "").replace?.(",", ".") ?? v;
    const n = Number(s);
    if (!Number.isFinite(n)) return 0;
    return n > 1 ? n / 100 : n < 0 ? 0 : n;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n < 0 ? 0 : n;
};
const i = (n: any, def = 0) => (Number.isFinite(Number(n)) ? Number(n) : def);
const clampInt = (n: any, min: number, max: number) => {
  const v = Math.round(i(n, min));
  return Math.max(min, Math.min(max, v));
};
function isImpactEvent(ev: TimelineEvent) {
  return ev === "hit" || ev === "crit" || ev === "block" || ev === "miss";
}

/* ───────── armas y shape ───────── */
function extractWeapons(raw: any): { main: WeaponData; off?: WeaponData | null } {
  const mainRaw =
    raw?.weapon ??
    raw?.equipment?.weapon ??
    raw?.equipment?.mainHand ??
    raw?.equipment?.mainWeapon ??
    null;

  const offRaw =
    raw?.offHand ??
    raw?.offhand ??
    raw?.equipment?.offHand ??
    raw?.equipment?.offhand ??
    raw?.equipment?.offWeapon ?? // ← compat
    raw?.equipment?.shield ??
    null;

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
    // Si viene como puntos % (ej: 50) se vuelve 0.5; si ya es 0.5 se respeta.
    criticalDamageBonus: Math.max(0, pctToFrac(csRaw.criticalDamageBonus ?? 0.5)),
    attackSpeed: Math.max(1, Math.round(toNum(csRaw.attackSpeed, 6))),
    maxHP: toNum(csRaw.maxHP ?? raw?.maxHP, 100),
  };

  const maxHP = clampInt(raw?.maxHP ?? combatNorm.maxHP, 1, 10_000_000);
  const currentHP = clampInt(raw?.currentHP ?? maxHP, 0, maxHP);

  const { main, off } = extractWeapons(raw);

  // bonus liviano de escudo
  if (off?.category === "shield") {
    combatNorm.blockChance = clamp01(combatNorm.blockChance + 0.05);
    combatNorm.damageReduction = clamp01(combatNorm.damageReduction + 0.03);
  }

  const cls = raw?.class ?? {};
  const passiveDefaultSkill =
    cls?.passiveDefaultSkill ?? raw?.passiveDefaultSkill ?? undefined;
  const ultimateSkill = cls?.ultimateSkill ?? raw?.ultimateSkill ?? undefined;
  const primaryWeapons: string[] | undefined = Array.isArray(cls?.primaryWeapons)
    ? cls.primaryWeapons
    : Array.isArray(raw?.class?.primaryWeapons)
    ? raw.class.primaryWeapons
    : undefined;

  return {
    name: raw?.name ?? raw?.username ?? "—",
    className: raw?.className ?? raw?.class?.name ?? undefined,
    baseStats: raw?.baseStats ?? raw?.stats ?? {}, // fate vive acá
    stats: raw?.stats ?? {}, // physicalDefense / magicalDefense
    resistances: raw?.resistances ?? {},
    equipment: raw?.equipment ?? {},
    maxHP,
    currentHP,
    combat: combatNorm,
    combatStats: combatNorm, // compat
    weaponMain: main,
    weaponOff: off ?? null,
    classMeta: { primaryWeapons },
    passiveDefaultSkill,
    ultimateSkill,
  };
}

/* ───────── Runner PvP ───────── */
export function runPvp({
  attackerSnapshot,
  defenderSnapshot,
  seed,
  maxRounds = 30,
  // Ajustes opcionales (no rompen compat si no los enviás)
  damageJitter,         // ej. 0.22 para mayor variación
  critMultiplierBase,   // ej. 0.65 para críticos más potentes
  blockReduction,       // ej. 0.45 para que el block reduzca un poco menos
}: {
  attackerSnapshot: any;
  defenderSnapshot: any;
  seed: number;
  maxRounds?: number;
  damageJitter?: number;
  critMultiplierBase?: number;
  blockReduction?: number;
}): PvpFightResult {
  const rng = mulberry32(seed || 1);

  const attacker = toCMEntity(attackerSnapshot, rng);
  const defender = toCMEntity(defenderSnapshot, rng);

  // Pasamos los “tunes” al manager (si vienen). Si no, usa sus defaults.
  const cm = new CombatManager(attacker, defender, {
    rng,
    damageJitter,
    critMultiplierBase,
    blockReduction,
    // El CombatManager lleva su propio maxRounds interno por seguridad,
    // pero el bucle de abajo ya limita por `maxRounds` (turnos).
  });

  const timeline: TimelineEntry[] = [];
  const log: string[] = [];
  const snapshots: PvpFightResult["snapshots"] = [];

  for (let turn = 1; turn <= maxRounds; turn++) {
    cm.startRound(turn, () => {});
    const isAtkTurn = turn % 2 === 1;

    const out = isAtkTurn ? cm.playerAttack() : cm.enemyAttack();

    const actorSide: "player" | "enemy" = isAtkTurn ? "player" : "enemy";
    // el que actúa en este turno SIEMPRE es el attacker
    const actorRole: "attacker" | "defender" = "attacker";
    const atkEntity = isAtkTurn ? attacker : defender;

    const baseTags: string[] = [];
    if (atkEntity?.weaponMain?.slug)
      baseTags.push(`${actorSide}:weapon:${atkEntity.weaponMain.slug}`);
    if (
      atkEntity?.weaponOff?.slug &&
      (atkEntity.weaponOff.category === "weapon" ||
        atkEntity.weaponOff.category === "focus")
    ) {
      baseTags.push(`${actorSide}:weapon_off:${atkEntity.weaponOff.slug}`);
    }

    // Acumuladores para etiquetar el próximo "hit"
    const impact = { crit: false, block: false };

    // Helper: mapear actor "player/enemy" del evento -> "attacker/defender" en este turno
    const toRole = (evActor: "player" | "enemy"): "attacker" | "defender" => {
      // si es turno del atacante (player), player=attacker; si no, enemy=attacker
      return (isAtkTurn && evActor === "player") || (!isAtkTurn && evActor === "enemy")
        ? "attacker"
        : "defender";
    };

    for (const ev of out.events ?? []) {
      // ── DoT tick: respetamos el "owner" real del DoT ──
      if (ev.type === "dot_tick") {
        const evRole = toRole(ev.actor);
        timeline.push({
          turn,
          actor: evRole,
          source: evRole,
          damage: ev.damage,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: "dot_tick",
          tags: [...baseTags, `${evRole}:dot:${ev.key}`],
        });
        log.push(`• DoT (${ev.key}) hace ${ev.damage} de daño.`);
        continue;
      }

      // ── Ultimate cast (la pegada llega como hit normal luego) ──
      if (ev.type === "ultimate_cast") {
        const evRole = actorRole; // el que actúa en el turno
        timeline.push({
          turn,
          actor: evRole,
          source: evRole,
          damage: 0,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: "ultimate_cast",
          ability: { kind: "ultimate", name: ev.name },
          tags: [...baseTags, `${evRole}:ultimate:${ev.name}`],
        });
        log.push(
          `▶️ ${evRole === "attacker" ? "Atacante" : "Defensor"} lanza Ultimate: ${ev.name}`
        );
        continue;
      }

      // ── Pasivas: puede ser del atacante o del defensor (onHitOrBeingHit) ──
      if (ev.type === "passive_proc") {
        const evRole = toRole(ev.actor);
        timeline.push({
          turn,
          actor: evRole,
          source: evRole,
          damage: 0,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: "passive_proc",
          ability: {
            kind: "passive",
            name: ev.name,
            durationTurns: (ev as any).duration,
          },
          tags: [
            ...baseTags,
            `${evRole}:passive:${ev.name}`,
            `${evRole}:passive:${(ev as any).result}`,
          ],
        });
        log.push(
          `✨ ${evRole === "attacker" ? "Atacante" : "Defensor"} activa pasiva ${ev.name}`
        );
        continue;
      }

      // ── Flags previos al golpe ──
      if (ev.type === "crit") {
        impact.crit = true;
        continue;
      }
      if (ev.type === "block") {
        impact.block = true;
        continue;
      }

      // ── Miss "sueltos" (evasión/confusión/parálisis). Atribuimos al atacante del turno ──
      if (ev.type === "miss") {
        timeline.push({
          turn,
          actor: actorRole,
          source: actorRole,
          damage: 0,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: "miss",
          tags: [...baseTags, "miss"],
        });
        const who = isAtkTurn
          ? attackerSnapshot?.name ?? "Atacante"
          : defenderSnapshot?.name ?? "Defensor";
        log.push(`${who} falla el ataque.`);
        // limpiamos flags por si acaso
        impact.crit = false;
        impact.block = false;
        continue;
      }

      // ── Golpe real con daño: convertimos a hit/crit/block según flags acumulados ──
      if (ev.type === "hit") {
        const dmg = (ev as any).damage?.final ?? 0;
        const kind: TimelineEvent = impact.block
          ? "block"
          : impact.crit
          ? "crit"
          : "hit";

        const entry: TimelineEntry = {
          turn,
          actor: actorRole,
          source: actorRole,
          damage: dmg,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: kind,
          tags: [...baseTags, kind],
        };
        timeline.push(entry);

        const who = isAtkTurn
          ? attackerSnapshot?.name ?? "Atacante"
          : defenderSnapshot?.name ?? "Defensor";
        const tgt = isAtkTurn
          ? defenderSnapshot?.name ?? "Defensor"
          : attackerSnapshot?.name ?? "Atacante";

        if (kind === "block") log.push(`${tgt} bloquea (recibe ${dmg}).`);
        else if (kind === "crit") log.push(`${who} ¡CRÍTICO! a ${tgt} por ${dmg}.`);
        else log.push(`${who} golpea a ${tgt} por ${dmg}.`);

        // reset para el siguiente strike
        impact.crit = false;
        impact.block = false;
        continue;
      }

      // otros tipos se ignoran de forma segura
    }

    snapshots.push({
      round: turn,
      actor: actorSide,
      damage: Math.max(0, toNum(out.damage, 0)),
      playerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
      enemyHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
      events: (out.events ?? []).map((e) => e.type),
      status: {},
    });

    if (cm.isCombatOver()) break;
  }

  let w = cm.getWinner();
  if (!w) {
    const aHP = clampInt(cm.player.currentHP, 0, attacker.maxHP);
    const dHP = clampInt(cm.enemy.currentHP, 0, defender.maxHP);
    const diff = aHP - dHP;
    const thr = Math.max(1, Math.round(0.01 * (aHP + dHP + 1)));
    if (Math.abs(diff) <= thr) w = null;
    else w = diff > 0 ? "player" : "enemy";
  }
  const outcome: "win" | "lose" | "draw" = !w ? "draw" : w === "player" ? "win" : "lose";

  const turns = timeline.reduce(
    (acc, e) => acc + (isImpactEvent(e.event) ? 1 : 0),
    0
  );

  return { outcome, turns, timeline, log, snapshots };
}

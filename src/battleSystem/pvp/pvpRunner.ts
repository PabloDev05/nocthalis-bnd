// src/battleSystem/pvp/pvpRunner.ts
import { CombatManager } from "../core/CombatManager";
import type { WeaponData } from "../core/Weapon";

// ------------------- Tipos del runner -------------------
export type TimelineEvent = "hit" | "crit" | "block" | "miss";

export interface TimelineEntry {
  turn: number;
  actor: "attacker" | "defender";
  damage: number;
  attackerHP: number;
  defenderHP: number;
  event: TimelineEvent;
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

// ------------------- utils -------------------
function seededXorShift(seed0: number) {
  let x = seed0 | 0 || 123456789;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}
const toNum = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const pctToFrac = (v: any) => {
  const n = toNum(v, 0);
  return n > 1 ? n / 100 : n < 0 ? 0 : n;
};
function i(n: any, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}
function clampInt(n: any, min: number, max: number) {
  const v = Math.round(i(n, min));
  return Math.max(min, Math.min(max, v));
}
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ---------------- arma por clase / snapshot ----------------
function inferWeaponByClass(className?: string): WeaponData {
  const c = (className || "").toLowerCase();
  if (c.includes("guerrero")) return { slug: "basic_sword", minDamage: 18, maxDamage: 26, type: "physical", category: "weapon" };
  if (c.includes("mago")) return { slug: "basic_staff", minDamage: 6, maxDamage: 10, type: "physical", category: "weapon" };
  if (c.includes("asesino")) return { slug: "basic_dagger", minDamage: 12, maxDamage: 18, type: "physical", category: "weapon" };
  if (c.includes("arquero")) return { slug: "basic_bow", minDamage: 14, maxDamage: 22, type: "physical", category: "weapon" };
  return { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon" };
}

function normalizeWeaponShape(wLike: any): WeaponData | null {
  if (!wLike) return null;

  // Detectar escudo/foco por campos “category/type/kind”
  const rawCat = String(wLike.category ?? wLike.kind ?? "").toLowerCase();
  const maybeShield = rawCat.includes("shield") || String(wLike.type ?? "").toLowerCase() === "shield";

  if (maybeShield) {
    const slug = String(wLike.slug ?? wLike.code ?? "shield")
      .toLowerCase()
      .replace(/\s+/g, "_");
    return { slug, minDamage: 0, maxDamage: 0, type: "physical", category: "shield" };
  }

  const min = Math.floor(toNum(wLike.minDamage, NaN));
  const max = Math.floor(toNum(wLike.maxDamage, NaN));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  return {
    slug: String(wLike.slug ?? wLike.code ?? "unknown")
      .toLowerCase()
      .replace(/\s+/g, "_"),
    minDamage: Math.max(0, min),
    maxDamage: Math.max(min, max),
    type: String(wLike.damageType ?? wLike.type ?? "physical").toLowerCase() === "magic" ? "magic" : "physical",
    category: rawCat === "focus" ? "focus" : "weapon",
    hands: wLike.hands === 2 ? 2 : 1,
  };
}

function extractWeapons(raw: any): { main: WeaponData; off?: WeaponData | null; slugs: { main: string; off?: string } } {
  // candidatos a main
  const mainCand = raw?.weapon ?? raw?.equipment?.mainHand ?? raw?.equipment?.weapon ?? null;
  let main = normalizeWeaponShape(mainCand);
  if (!main) main = inferWeaponByClass(raw?.className ?? raw?.class?.name);

  // candidatos a offhand (varios nombres posibles)
  const offCand = raw?.offhand ?? raw?.offHand ?? raw?.equipment?.offHand ?? raw?.equipment?.offhand ?? raw?.equipment?.shield ?? null;
  const off = normalizeWeaponShape(offCand);

  return {
    main,
    off,
    slugs: { main: main.slug, off: off?.slug },
  };
}

// ---------------- pasivas y eventos ----------------
function getPassiveName(raw: any): string | null {
  return raw?.class?.passiveDefault?.name ?? raw?.passiveDefault?.name ?? null;
}
function flagsToEvent(flags: { miss?: boolean; crit?: boolean; blocked?: boolean }): TimelineEvent {
  if (flags?.miss) return "miss";
  if (flags?.blocked) return "block";
  if (flags?.crit) return "crit";
  return "hit";
}
function shouldTagPassiveOnAttack(className?: string, flags?: { crit?: boolean }): boolean {
  const c = (className || "").toLowerCase();
  if (c.includes("asesino")) return !!flags?.crit;
  if (c.includes("mago")) return true;
  if (c.includes("arquero")) return true;
  return false;
}
function shouldTagPassiveOnDefense(className?: string, flags?: { blocked?: boolean }): boolean {
  const c = (className || "").toLowerCase();
  if (c.includes("guerrero")) return !!flags?.blocked;
  return false;
}

// ---------------- normalización a Manager ----------------
function toCMEntity(raw: any) {
  const csRaw = raw?.combat ?? raw?.combatStats ?? {};

  const combatNorm = {
    attackPower: toNum(csRaw.attackPower, 5),
    magicPower: toNum(csRaw.magicPower, 0),
    evasion: clamp01(pctToFrac(csRaw.evasion)),
    blockChance: clamp01(pctToFrac(csRaw.blockChance)),
    damageReduction: clamp01(pctToFrac(csRaw.damageReduction)),
    criticalChance: clamp01(pctToFrac(csRaw.criticalChance)),
    criticalDamageBonus: Math.max(0, pctToFrac(csRaw.criticalDamageBonus ?? 0.5)),
    attackSpeed: Math.max(0.1, toNum(csRaw.attackSpeed, 1)),
    maxHP: toNum(csRaw.maxHP ?? raw?.maxHP, 100),
  };

  const maxHP = clampInt(raw?.maxHP ?? combatNorm.maxHP, 1, 10_000_000);
  const currentHP = clampInt(raw?.currentHP ?? maxHP, 0, maxHP);

  // Armas
  const { main, off, slugs } = extractWeapons(raw);

  // Si el offhand es escudo, damos un pequeño bonus defensivo aquí (para el Manager)
  if (off?.category === "shield") {
    combatNorm.blockChance = clamp01(combatNorm.blockChance + 0.05); // +5% block
    combatNorm.damageReduction = clamp01(combatNorm.damageReduction + 0.03); // +3% DR
  }

  return {
    name: raw?.name ?? raw?.username ?? "—",
    className: raw?.className ?? raw?.class?.name ?? undefined,
    stats: raw?.stats ?? {},
    resistances: raw?.resistances ?? {},
    equipment: raw?.equipment ?? {},
    maxHP,
    currentHP,
    combat: combatNorm,
    combatStats: combatNorm,
    weaponMain: main,
    weaponOff: off ?? null,
    __weapon: slugs.main,
    __weaponOff: slugs.off,
    __passiveName: getPassiveName(raw),
  };
}

// ---------------- Runner PvP canónico ----------------
export function runPvp({ attackerSnapshot, defenderSnapshot, seed, maxRounds = 30 }: { attackerSnapshot: any; defenderSnapshot: any; seed: number; maxRounds?: number }): PvpFightResult {
  const rng = seededXorShift(seed);
  const attacker = toCMEntity(attackerSnapshot);
  const defender = toCMEntity(defenderSnapshot);

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
    const out = isAtkTurn ? cm.playerAttack() : cm.enemyAttack();

    const entry: TimelineEntry = {
      turn,
      actor: isAtkTurn ? "attacker" : "defender",
      damage: i(out.damage, 0),
      attackerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
      defenderHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
      event: flagsToEvent(out.flags),
    };
    timeline.push(entry);

    // Log humano
    if (isAtkTurn) {
      const tgt = defenderSnapshot?.name ?? "Defensor";
      const hp = entry.defenderHP,
        mhp = defender.maxHP;
      log.push(
        out.flags?.miss
          ? `El atacante falla contra ${tgt}. (${hp}/${mhp} HP)`
          : out.flags?.blocked
          ? `Bloqueo de ${tgt}. Daño ${entry.damage}. (${hp}/${mhp} HP)`
          : out.flags?.crit
          ? `¡Crítico! El atacante golpea a ${tgt} por ${entry.damage}. (${hp}/${mhp} HP)`
          : `El atacante golpea a ${tgt} por ${entry.damage}. (${hp}/${mhp} HP)`
      );
    } else {
      const tgt = attackerSnapshot?.name ?? "Atacante";
      const hp = entry.attackerHP,
        mhp = attacker.maxHP;
      log.push(
        out.flags?.miss
          ? `El defensor falla contra ${tgt}. (${hp}/${mhp} HP)`
          : out.flags?.blocked
          ? `Bloqueo de ${tgt}. Daño ${entry.damage}. (${hp}/${mhp} HP)`
          : out.flags?.crit
          ? `¡Crítico! El defensor golpea a ${tgt} por ${entry.damage}. (${hp}/${mhp} HP)`
          : `El defensor golpea a ${tgt} por ${entry.damage}. (${hp}/${mhp} HP)`
      );
    }

    // Snapshot por golpe (UI/animaciones)
    const actorSide = isAtkTurn ? "player" : "enemy";
    const atkEntity = isAtkTurn ? attacker : defender;
    const defEntity = isAtkTurn ? defender : attacker;

    const events: string[] = [];
    if (out.flags?.crit) events.push(`${actorSide}:crit`);
    events.push(`${actorSide}:attack`);
    events.push(`${actorSide}:weapon:${atkEntity.__weapon || "fists"}`);
    if (out.extra?.offhandUsed && atkEntity.__weaponOff) {
      events.push(`${actorSide}:weapon_off:${atkEntity.__weaponOff}`);
    }
    if (out.flags?.miss) {
      events.push(`${actorSide}:miss`);
    } else {
      if (out.flags?.blocked) events.push(`${actorSide}:blocked`);
      events.push(`${actorSide}:hit`);
      events.push(`${actorSide}:hit:physical`);
    }

    if (shouldTagPassiveOnAttack(atkEntity.className, out.flags) && atkEntity.__passiveName) {
      events.push(`${actorSide}:passive:${atkEntity.__passiveName}`);
    }
    if (shouldTagPassiveOnDefense(defEntity.className, out.flags) && defEntity.__passiveName) {
      const defSide = actorSide === "player" ? "enemy" : "player";
      events.push(`${defSide}:passive:${defEntity.__passiveName}`);
    }

    snapshots.push({
      round: turn,
      actor: actorSide,
      damage: entry.damage,
      playerHP: entry.attackerHP,
      enemyHP: entry.defenderHP,
      events,
      status: {},
    });

    if (cm.isCombatOver()) break;
  }

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

  return { outcome, turns: timeline.length, timeline, log, snapshots };
}

// ---------------- Adaptador a contrato de Match ----------------
export type MatchTimelineEvent = TimelineEvent;
export interface MatchTimelineEntry {
  turn: number;
  source: "attacker" | "defender";
  event: MatchTimelineEvent;
  damage: number;
  attackerHP: number;
  defenderHP: number;
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
  }));
  return { outcome: mappedOutcome, timeline: mappedTimeline };
}

/* eslint-disable no-console */
// src/battleSystem/pvp/pvpRunner.ts
import { CombatManager } from "../core/CombatManager";
import type { WeaponData } from "../core/Weapon";
import { normalizeWeaponData, ensureWeaponOrDefault } from "../core/Weapon";
import { mulberry32 } from "../core/RngFightSeed";
import { FORCE_ALL_PROCS } from "../../config/pvp";

console.log("[BS] Loaded: pvp/pvpRunner.ts");

/* ───────── Tipos del runner ───────── */
export type TimelineEvent = "hit" | "crit" | "block" | "miss" | "passive_proc" | "ultimate_cast" | "dot_tick";

export interface TimelineEntry {
  turn: number;
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
  tags?: any;
  rawDamage?: number;
  breakdown?: { blockedAmount?: number };
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
  /** ⬅️ NUEVO: estado final de HP (para UI/consistencia) */
  finalHP: {
    attacker: number;
    defender: number;
    attackerMax: number;
    defenderMax: number;
  };
}

/* ───────── Debug helpers ───────── */
const PVP_DEBUG = process.env.PVP_DEBUG === "1" || String(process.env.PVP_DEBUG || "").toLowerCase() === "true";
const dbg = (...a: any[]) => {
  if (PVP_DEBUG) console.log(...a);
};

/* ───────── helpers num/forma (enteros) ───────── */
const i = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
const clampInt = (n: any, min: number, max: number) => Math.max(min, Math.min(max, i(n, min)));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const toFrac = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n > 1) return Math.min(1, n / 100);
  return n;
};
function isImpactEvent(ev: TimelineEvent) {
  return ev === "hit" || ev === "crit" || ev === "block" || ev === "miss";
}

/* ───────── armas y shape ───────── */
function extractWeapons(raw: any): { main: WeaponData; off?: WeaponData | null } {
  const mainRaw = raw?.weapon ?? raw?.equipment?.weapon ?? raw?.equipment?.mainHand ?? raw?.equipment?.mainWeapon ?? null;
  const offRaw = raw?.offHand ?? raw?.offhand ?? raw?.equipment?.offHand ?? raw?.equipment?.offhand ?? raw?.equipment?.offWeapon ?? raw?.equipment?.shield ?? null;

  const main = ensureWeaponOrDefault(mainRaw);
  const off = offRaw ? normalizeWeaponData(offRaw) : null;
  return { main, off };
}

/* ───────── normalización a CombatManager.CombatSide ───────── */
function toCMEntity(raw: any) {
  const csRaw = raw?.combat ?? raw?.combatStats ?? {};

  const combatNorm = {
    attackPower: i(csRaw.attackPower ?? 5, 5),
    magicPower: i(csRaw.magicPower ?? 0, 0),
    evasion: clamp01(toFrac(csRaw.evasion ?? 0)),
    blockChance: clamp01(toFrac(csRaw.blockChance ?? 0)),
    damageReduction: clamp01(toFrac(csRaw.damageReduction ?? 0)),
    criticalChance: clamp01(toFrac(csRaw.criticalChance ?? 0)),
    criticalDamageBonus: toFrac(csRaw.criticalDamageBonus ?? 0.5),
    maxHP: i(csRaw.maxHP ?? raw?.maxHP ?? 100, 100),
  };

  const maxHP = clampInt(raw?.maxHP ?? combatNorm.maxHP, 1, 10_000_000);
  const currentHP = clampInt(raw?.currentHP ?? maxHP, 0, maxHP);

  const { main, off } = extractWeapons(raw);

  // Bonus por escudo (match con CombatManager)
  if ((off as any)?.category === "shield") {
    combatNorm.blockChance = clamp01(combatNorm.blockChance + 0.05);
    combatNorm.damageReduction = clamp01(combatNorm.damageReduction + 0.03);
  }

  // Fate garantizado entero
  const srcBase = raw?.baseStats ?? raw?.stats ?? {};
  const fateInt = i(srcBase.fate ?? 0, 0);

  const cls = raw?.class ?? {};
  const passiveDefaultSkill = cls?.passiveDefaultSkill ?? raw?.passiveDefaultSkill ?? undefined;
  const ultimateSkill = cls?.ultimateSkill ?? raw?.ultimateSkill ?? undefined;
  const primaryWeapons: string[] | undefined = Array.isArray(cls?.primaryWeapons) ? cls.primaryWeapons : Array.isArray(raw?.class?.primaryWeapons) ? raw.class.primaryWeapons : undefined;

  const shaped = {
    name: raw?.name ?? raw?.username ?? "—",
    className: raw?.className ?? raw?.class?.name ?? undefined,
    baseStats: { ...(raw?.baseStats ?? {}), fate: fateInt },
    stats: raw?.stats ?? {},
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

  dbg("[BS][toCMEntity] shaped:", {
    name: shaped.name,
    className: shaped.className,
    maxHP: shaped.maxHP,
    combat: shaped.combat,
    passive: shaped.passiveDefaultSkill?.name,
    ultimate: shaped.ultimateSkill?.name,
    mainSlug: shaped.weaponMain?.slug,
    offSlug: shaped.weaponOff?.slug,
  });

  return shaped;
}

/* ───────── PVP Runner ───────── */
/**
 * Corre el combate hasta que alguien llegue a 0 HP (KO).
 * No hay tolerancias ni maxRounds. Solo existe un límite de seguridad muy alto.
 */
export function runPvp({ attackerSnapshot, defenderSnapshot, seed }: { attackerSnapshot: any; defenderSnapshot: any; seed: number }): PvpFightResult {
  const t0 = Date.now();
  console.log(`[BS][runPvp] seed=${seed} FORCE_ALL_PROCS=${FORCE_ALL_PROCS ? "ON" : "OFF"} DEBUG=${PVP_DEBUG ? "ON" : "OFF"}`);

  const rng = mulberry32(seed || 1);

  const attacker = toCMEntity(attackerSnapshot);
  const defender = toCMEntity(defenderSnapshot);

  // ⬅️ Arrancamos SIEMPRE a FULL HP (ignora el currentHP del snapshot)
  (attacker as any).currentHP = attacker.maxHP;
  (defender as any).currentHP = defender.maxHP;

  const cm = new CombatManager(attacker, defender, { rng });

  const timeline: TimelineEntry[] = [];
  const log: string[] = [];
  const snapshots: PvpFightResult["snapshots"] = [];

  const SAFETY_MAX_ACTIONS = 100_000; // enorme, solo por si hay bug de loop infinito
  let turn = 0;
  let endReason: "ko" | "safety" = "ko";

  while (!cm.isCombatOver()) {
    turn++;
    if (turn > SAFETY_MAX_ACTIONS) {
      endReason = "safety";
      console.warn("[BS][runPvp] ⚠️ Cortado por SAFETY_MAX_ACTIONS, nadie llegó a 0 HP.");
      break;
    }

    cm.startRound(turn);

    const isAtkTurn = turn % 2 === 1;
    const out = isAtkTurn ? cm.playerAttack() : cm.enemyAttack();

    const actorSide: "player" | "enemy" = isAtkTurn ? "player" : "enemy";
    const actorRole: "attacker" | "defender" = isAtkTurn ? "attacker" : "defender";
    const atkEntity = isAtkTurn ? attacker : defender;

    // Marcas visuales para UI si FORCED (no altera daño)
    if (FORCE_ALL_PROCS) {
      (out as any).events ??= [];
      const hasPassive = (out as any).events.some((e: any) => e?.type === "passive_proc");
      const hasUlt = (out as any).events.some((e: any) => e?.type === "ultimate_cast");
      if (!hasPassive) {
        (out as any).events.push({
          type: "passive_proc",
          actor: actorSide,
          name: String(atkEntity?.passiveDefaultSkill?.name ?? "Passive"),
          chancePercent: 100,
          roll: 1,
          result: "activated",
          forcedByPity: true,
          duration: 2,
        });
      }
      if (!hasUlt) {
        (out as any).events.push({
          type: "ultimate_cast",
          actor: actorSide,
          name: String(atkEntity?.ultimateSkill?.name ?? "Ultimate"),
          chance: 100,
          roll: 1,
          forcedByPity: true,
        });
      }
    }

    const baseTags: string[] = [];
    if (atkEntity?.weaponMain?.slug) baseTags.push(`${actorRole}:weapon:${atkEntity.weaponMain.slug}`);
    if (atkEntity?.weaponOff?.slug && (atkEntity.weaponOff.category === "weapon" || atkEntity.weaponOff.category === "focus")) {
      baseTags.push(`${actorRole}:weapon_off:${atkEntity.weaponOff.slug}`);
    }

    const impact = { crit: false, block: false };
    const toRole = (evActor: "player" | "enemy"): "attacker" | "defender" => ((isAtkTurn && evActor === "player") || (!isAtkTurn && evActor === "enemy") ? "attacker" : "defender");

    const evs = out.events ?? [];

    for (const ev of evs) {
      if (ev.type === "dot_tick") {
        const evRole = toRole(ev.actor);
        const dmg = i((ev as any).damage, 0);
        timeline.push({
          turn,
          actor: evRole,
          source: evRole,
          damage: dmg,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: "dot_tick",
          tags: [...baseTags, `${evRole}:dot:${(ev as any).key}`],
        });
        log.push(`• DoT ${(ev as any).key} ${dmg}`);
        continue;
      }

      if (ev.type === "ultimate_cast") {
        const evRole = actorRole;
        const name = String((ev as any).name ?? "Ultimate");
        const ch = i((ev as any).chance ?? 0, 0);
        const rl = i((ev as any).roll ?? 0, 0);
        const pity = Boolean((ev as any).forcedByPity);
        timeline.push({
          turn,
          actor: evRole,
          source: evRole,
          damage: 0,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: "ultimate_cast",
          ability: { kind: "ultimate", name },
          tags: [...baseTags, `${evRole}:ultimate:${name}`, `${evRole}:chance:${ch}`, `${evRole}:roll:${rl}`, ...(pity ? [`${evRole}:pity`] : [])],
        });
        log.push(`ULTIMATE — ${name}${pity ? " (PITY)" : ""} (CHANCE ${ch} | ROLL ${rl})`);
        continue;
      }

      if (ev.type === "passive_proc") {
        const evRole = toRole(ev.actor);
        const name = String((ev as any).name ?? "Passive");
        const chance = clampInt((ev as any).chancePercent ?? 0, 0, 100);
        const roll = clampInt((ev as any).roll ?? 0, 0, 100);
        const result = String((ev as any).result ?? "failed") as "activated" | "refreshed" | "failed";
        const pity = Boolean((ev as any).forcedByPity);

        timeline.push({
          turn,
          actor: evRole,
          source: evRole,
          damage: 0,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: "passive_proc",
          ability: { kind: "passive", name, durationTurns: i((ev as any).duration ?? 0, 0) },
          tags: [...baseTags, `${evRole}:passive:${name}`, `${evRole}:passive:${result}`, `${evRole}:passive:chance:${chance}`, `${evRole}:passive:roll:${roll}`, ...(pity ? [`${evRole}:pity`] : [])],
        });

        if (result === "activated") log.push(`PASSIVE — ${name}${pity ? " (PITY)" : ""} (CHANCE ${chance} | ROLL ${roll})`);
        else if (result === "refreshed") log.push(`PASSIVE — ${name} REFRESHED${pity ? " (PITY)" : ""} (CHANCE ${chance} | ROLL ${roll})`);
        else log.push(`PASSIVE — ${name} FAILED (CHANCE ${chance} | ROLL ${roll})`);
        continue;
      }

      if (ev.type === "crit") {
        impact.crit = true;
        continue;
      }
      if (ev.type === "block") {
        impact.block = true;
        continue;
      }

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
        impact.crit = false;
        impact.block = false;
        continue;
      }

      if (ev.type === "hit") {
        const dmgNode = (ev as any).damage || {};
        const bd = (dmgNode as any).breakdown || {};
        const final = Math.max(0, i(dmgNode.final, 0));
        const preBlock = Number.isFinite(Number(bd.preBlock)) ? i(bd.preBlock, 0) : undefined;
        const blockedAmount = Number.isFinite(Number(bd.blockedAmount)) ? Math.max(0, i(bd.blockedAmount, 0)) : undefined;

        const kind: TimelineEvent = impact.block ? "block" : impact.crit ? "crit" : "hit";
        const entry: TimelineEntry = {
          turn,
          actor: actorRole,
          source: actorRole,
          damage: final,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: kind,
          tags: [...baseTags, kind],
        };
        if (preBlock != null) entry.rawDamage = preBlock;
        if (blockedAmount != null) entry.breakdown = { blockedAmount };

        timeline.push(entry);

        if (kind === "block") log.push(`BLOCKED — ${blockedAmount ?? 0}`);
        else if (kind === "crit") log.push(`CRITICAL! ${final}`);
        else log.push(`HIT ${final}`);

        impact.crit = false;
        impact.block = false;
        continue;
      }
    }

    // Snapshot
    snapshots.push({
      round: turn,
      actor: isAtkTurn ? "player" : "enemy",
      damage: Math.max(0, i(out.damage, 0)),
      playerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
      enemyHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
      events: (out.events ?? []).map((e) => e.type),
      status: {},
    });
  }

  // Resultado: SOLO por KO (o safety)
  const w = cm.getWinner(); // null si safety
  const outcome: "win" | "lose" | "draw" = !w ? "draw" : w === "player" ? "win" : "lose";

  const turns = timeline.reduce((acc, e) => acc + (isImpactEvent(e.event) ? 1 : 0), 0);

  const finalHP = {
    attacker: clampInt(cm.player.currentHP, 0, attacker.maxHP),
    defender: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
    attackerMax: attacker.maxHP,
    defenderMax: defender.maxHP,
  };

  const dt = Date.now() - t0;
  console.log(`[BS][runPvp] result outcome=${outcome} end=${endReason} turns=${turns} timelineLen=${timeline.length} duration=${dt}ms (pHP=${cm.player.currentHP} eHP=${cm.enemy.currentHP})`);

  const counts = timeline.reduce<Record<string, number>>((m, e) => {
    m[e.event] = (m[e.event] || 0) + 1;
    return m;
  }, {});
  console.log(
    `[BS][runPvp] events hit=${counts.hit || 0} crit=${counts.crit || 0} block=${counts.block || 0} miss=${counts.miss || 0} passive=${counts.passive_proc || 0} ultimate=${
      counts.ultimate_cast || 0
    } dot=${counts.dot_tick || 0}`
  );

  if (!counts.passive_proc) console.log("[BS][runPvp] ⚠️ No hubo passive_proc.");
  if (!counts.ultimate_cast) console.log("[BS][runPvp] ⚠️ No hubo ultimate_cast.");

  return { outcome, turns, timeline, log, snapshots, finalHP };
}

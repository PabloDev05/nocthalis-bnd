// Runner para simulaciones PvP

import { CombatManager } from "../core/CombatManager";
import type { WeaponData } from "../core/Weapon";
import { normalizeWeaponData, ensureWeaponOrDefault } from "../core/Weapon";
import { mulberry32 } from "../core/RngFightSeed";

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
  /** puede ser array o un objeto: mantenemos compat */
  tags?: any;
  /** valores útiles para el front */
  rawDamage?: number; // daño antes de aplicar bloqueo
  breakdown?: { blockedAmount?: number }; // cantidad bloqueada
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
  const mainRaw = raw?.weapon ?? raw?.equipment?.weapon ?? raw?.equipment?.mainHand ?? raw?.equipment?.mainWeapon ?? null;

  const offRaw =
    raw?.offHand ??
    raw?.offhand ??
    raw?.equipment?.offHand ??
    raw?.equipment?.offhand ??
    raw?.equipment?.offWeapon ?? // compat
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
    attackPower: Number(csRaw.attackPower ?? 5),
    magicPower: Number(csRaw.magicPower ?? 0),
    evasion: Math.max(0, Math.min(1, Number(csRaw.evasion ?? 0) > 1 ? Number(csRaw.evasion) / 100 : Number(csRaw.evasion))),
    blockChance: Math.max(0, Math.min(1, Number(csRaw.blockChance ?? 0) > 1 ? Number(csRaw.blockChance) / 100 : Number(csRaw.blockChance))),
    damageReduction: Math.max(0, Math.min(1, Number(csRaw.damageReduction ?? 0) > 1 ? Number(csRaw.damageReduction) / 100 : Number(csRaw.damageReduction))),
    criticalChance: Math.max(0, Math.min(1, Number(csRaw.criticalChance ?? 0) > 1 ? Number(csRaw.criticalChance) / 100 : Number(csRaw.criticalChance))),
    criticalDamageBonus: Math.max(0, Number(csRaw.criticalDamageBonus ?? 0.5) > 1 ? Number(csRaw.criticalDamageBonus) / 100 : Number(csRaw.criticalDamageBonus)),
    maxHP: Number(csRaw.maxHP ?? raw?.maxHP ?? 100),
  };

  const maxHP = clampInt(raw?.maxHP ?? combatNorm.maxHP, 1, 10_000_000);
  const currentHP = clampInt(raw?.currentHP ?? maxHP, 0, maxHP);

  const { main, off } = extractWeapons(raw);

  if ((off as any)?.category === "shield") {
    combatNorm.blockChance = clamp01(combatNorm.blockChance + 0.05);
    combatNorm.damageReduction = clamp01(combatNorm.damageReduction + 0.03);
  }

  const cls = raw?.class ?? {};
  const passiveDefaultSkill = cls?.passiveDefaultSkill ?? raw?.passiveDefaultSkill ?? undefined;
  const ultimateSkill = cls?.ultimateSkill ?? raw?.ultimateSkill ?? undefined;
  const primaryWeapons: string[] | undefined = Array.isArray(cls?.primaryWeapons) ? cls.primaryWeapons : Array.isArray(raw?.class?.primaryWeapons) ? raw.class.primaryWeapons : undefined;

  return {
    name: raw?.name ?? raw?.username ?? "—",
    className: raw?.className ?? raw?.class?.name ?? undefined,
    baseStats: raw?.baseStats ?? raw?.stats ?? {},
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
}

/* ───────── Runner PvP ───────── */
export function runPvp({
  attackerSnapshot,
  defenderSnapshot,
  seed,
  maxRounds = 30,
  damageJitter,
  critMultiplierBase,
  blockReduction,
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

  const cm = new CombatManager(attacker, defender, {
    rng,
    damageJitter, // si pasan overrides, se respetan
    critMultiplierBase, // idem
    blockReduction, // idem
    // los demás quedan con los defaults ajustados en CombatManager
  });

  const timeline: TimelineEntry[] = [];
  const log: string[] = [];
  const snapshots: PvpFightResult["snapshots"] = [];

  for (let turn = 1; turn <= maxRounds; turn++) {
    cm.startRound(turn, () => {});
    const isAtkTurn = turn % 2 === 1;

    const out = isAtkTurn ? cm.playerAttack() : cm.enemyAttack();

    const actorSide: "player" | "enemy" = isAtkTurn ? "player" : "enemy";
    const actorRole: "attacker" | "defender" = isAtkTurn ? "attacker" : "defender";
    const atkEntity = isAtkTurn ? attacker : defender;

    const baseTags: any[] = [];
    if (atkEntity?.weaponMain?.slug) baseTags.push(`${actorSide}:weapon:${atkEntity.weaponMain.slug}`);
    if (atkEntity?.weaponOff?.slug && (atkEntity.weaponOff.category === "weapon" || atkEntity.weaponOff.category === "focus")) {
      baseTags.push(`${actorSide}:weapon_off:${atkEntity.weaponOff.slug}`);
    }

    const impact = { crit: false, block: false };

    const toRole = (evActor: "player" | "enemy"): "attacker" | "defender" => {
      return (isAtkTurn && evActor === "player") || (!isAtkTurn && evActor === "enemy") ? "attacker" : "defender";
    };

    for (const ev of out.events ?? []) {
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
          tags: [...baseTags, `${evRole}:dot:${(ev as any).key}`],
        });
        log.push(`• DoT ${(ev as any).key} ${ev.damage}`);
        continue;
      }

      if (ev.type === "ultimate_cast") {
        const evRole = actorRole;
        timeline.push({
          turn,
          actor: evRole,
          source: evRole,
          damage: 0,
          attackerHP: clampInt(cm.player.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt(cm.enemy.currentHP, 0, defender.maxHP),
          event: "ultimate_cast",
          ability: { kind: "ultimate", name: (ev as any).name },
          tags: [...baseTags, `${evRole}:ultimate:${(ev as any).name}`],
        });
        log.push(`ULTIMATE — ${(ev as any).name}`);
        continue;
      }

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
            name: (ev as any).name,
            durationTurns: (ev as any).duration,
          },
          tags: [...baseTags, `${evRole}:passive:${(ev as any).name}`, `${evRole}:passive:${(ev as any).result}`],
        });
        log.push(`PASSIVE — ${(ev as any).name}`);
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
        log.push(`MISS`);
        impact.crit = false;
        impact.block = false;
        continue;
      }

      if (ev.type === "hit") {
        // ⬇️ Tomamos directamente lo que emite CombatManager
        const dmgNode = (ev as any).damage || {};
        const bd = (dmgNode as any).breakdown || {};
        const final = Math.max(0, Math.round(Number(dmgNode.final || 0)));
        const preBlock = Number.isFinite(Number(bd.preBlock)) ? Math.round(Number(bd.preBlock)) : undefined;
        const blockedAmount = Number.isFinite(Number(bd.blockedAmount)) ? Math.max(0, Math.round(Number(bd.blockedAmount))) : undefined;

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

        if (kind === "block") {
          // 🛡️ LOG corto y preciso: SOLO el valor bloqueado
          const val = blockedAmount ?? 0;
          log.push(`BLOCKED — ${val}`);
        } else if (kind === "crit") {
          log.push(`CRITICAL! ${final}`);
        } else {
          log.push(`HIT ${final}`);
        }

        impact.crit = false;
        impact.block = false;
        continue;
      }
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

  const turns = timeline.reduce((acc, e) => acc + (isImpactEvent(e.event) ? 1 : 0), 0);

  if (DEBUG_PVP) {
    // eslint-disable-next-line no-console
    console.log("PvP outcome:", outcome, "turns:", turns);
  }

  return { outcome, turns, timeline, log, snapshots };
}

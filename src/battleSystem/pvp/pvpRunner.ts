// src/battleSystem/pvp/pvpRunner.ts
import { CombatManager } from "../core/CombatManager";
import type { WeaponData } from "../core/Weapon";
import { normalizeWeaponData, ensureWeaponOrDefault } from "../core/Weapon";
import { mulberry32 } from "../core/RngFightSeed";
import { buildClassPassivePack } from "../passives/ClassPacks";

/* ───────── Tipos del runner ───────── */
export type TimelineEvent = "hit" | "crit" | "block" | "miss" | "passive_proc" | "ultimate_cast";

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
  turns: number; // ← ahora son sólo impactos
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
const i0 = (n: any) => Math.max(0, Math.floor(i(n, 0)));
const clampInt = (n: any, min: number, max: number) => {
  const v = Math.round(i(n, min));
  return Math.max(min, Math.min(max, v));
};

function flagsToEvent(flags: { miss?: boolean; crit?: boolean; blocked?: boolean }): TimelineEvent {
  if (flags?.miss) return "miss";
  if (flags?.blocked) return "block";
  if (flags?.crit) return "crit";
  return "hit";
}
function isImpactEvent(ev: TimelineEvent) {
  return ev === "hit" || ev === "crit" || ev === "block" || ev === "miss";
}

/* ───────── lectura de skills Fate-driven ───────── */
type TriggerCheck = "onBasicHit" | "onRangedHit" | "onSpellCast" | "onHitOrBeingHit" | "onTurnStart";
type ProcTriggerCfg = {
  check: TriggerCheck;
  scaleBy?: "fate";
  baseChancePercent?: number;
  fateScalePerPoint?: number;
  maxChancePercent?: number;
};

type PassiveDefaultSkillCfg = {
  enabled?: boolean;
  name: string;
  damageType?: "physical" | "magical";
  shortDescEn?: string;
  longDescEn?: string;
  trigger: ProcTriggerCfg;
  durationTurns?: number;
  bonusDamage?: number;
  extraEffects?: Record<string, number>;
};

type UltimateSkillCfg = {
  enabled?: boolean;
  name: string;
  description?: string;
  cooldownTurns: number;
  effects?: {
    bonusDamagePercent?: number;
    applyDebuff?: string;
    debuffValue?: number;
    bleedDamagePerTurn?: number;
    debuffDurationTurns?: number;
  };
  proc?: {
    enabled?: boolean;
    respectCooldown?: boolean;
    trigger?: ProcTriggerCfg;
  };
};

function readClassSkills(raw: any): {
  passive?: PassiveDefaultSkillCfg;
  ultimate?: UltimateSkillCfg;
  primaryWeapons?: string[];
} {
  const cls = raw?.class ?? {};
  const passive = cls?.passiveDefaultSkill as PassiveDefaultSkillCfg | undefined;
  const ultimate = cls?.ultimateSkill as UltimateSkillCfg | undefined;
  const primaryWeapons = Array.isArray(cls?.primaryWeapons) ? cls.primaryWeapons : undefined;
  return { passive, ultimate, primaryWeapons };
}

function procChanceFromFate(trigger: ProcTriggerCfg | undefined, fate: number, fallback: { base: number; scale: number; cap: number }) {
  if (!trigger) return clamp01((fallback.base + fate * fallback.scale) / 100);
  const base = i(trigger.baseChancePercent, fallback.base);
  const scale = i(trigger.fateScalePerPoint, fallback.scale);
  const cap = i(trigger.maxChancePercent, fallback.cap);
  const pct = Math.min(cap, base + fate * scale);
  return clamp01(pct / 100);
}

/* ───────── armas y shape ───────── */
function extractWeapons(raw: any): { main: WeaponData; off?: WeaponData | null } {
  const mainRaw = raw?.weapon ?? raw?.equipment?.weapon ?? raw?.equipment?.mainHand ?? raw?.equipment?.mainWeapon ?? null;
  const offRaw = raw?.offHand ?? raw?.offhand ?? raw?.equipment?.offHand ?? raw?.equipment?.offhand ?? raw?.equipment?.shield ?? null;

  // ⚠️ Cambio clave: NO usamos fallback de defaultWeapon/clase.
  // Si no hay arma equipada → fists (se resuelve dentro de ensureWeaponOrDefault).
  const main = ensureWeaponOrDefault(mainRaw /*, raw?.class?.defaultWeapon ?? raw?.className */);

  const off = offRaw ? normalizeWeaponData(offRaw) : null;
  return { main, off };
}

/* ───────── normalización a Manager ───────── */
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
    attackSpeed: Math.max(0.1, toNum(csRaw.attackSpeed, 1)),
    maxHP: toNum(csRaw.maxHP ?? raw?.maxHP, 100),
  };

  const maxHP = clampInt(raw?.maxHP ?? combatNorm.maxHP, 1, 10_000_000);
  const currentHP = clampInt(raw?.currentHP ?? maxHP, 0, maxHP);

  const { main, off } = extractWeapons(raw);

  // bonus defensivo si el offhand es escudo (pequeño, no rompe)
  if (off?.category === "shield") {
    combatNorm.blockChance = clamp01(combatNorm.blockChance + 0.05);
    combatNorm.damageReduction = clamp01(combatNorm.damageReduction + 0.03);
  }

  const { primaryWeapons } = readClassSkills(raw);

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
    classMeta: { primaryWeapons: primaryWeapons ?? raw?.class?.primaryWeapons ?? undefined },
  };
}

/* ───────── estado runtime para procs ───────── */
type RuntimeState = {
  passiveBuff?: {
    name?: string;
    remainingTurns: number;
    bonusDamage: number;
    extraEffects?: Record<string, number>;
  } | null;
  ultimate?: {
    name?: string;
    cdLeft: number;
  } | null;
  status?: {
    pending?: Array<{ key: string; duration: number; value?: number }>;
  };
};

function initRuntimeState(raw: any) {
  const state: RuntimeState = {
    passiveBuff: null,
    ultimate: null,
    status: { pending: [] },
  };
  const { ultimate } = readClassSkills(raw);
  if (ultimate?.enabled) {
    state.ultimate = { name: ultimate.name, cdLeft: 0 };
  }
  return state;
}

/* ───────── Runner PvP ───────── */
export function runPvp({ attackerSnapshot, defenderSnapshot, seed, maxRounds = 30 }: { attackerSnapshot: any; defenderSnapshot: any; seed: number; maxRounds?: number }): PvpFightResult {
  const rng = mulberry32(seed || 1);

  const attacker = toCMEntity(attackerSnapshot, rng);
  const defender = toCMEntity(defenderSnapshot, rng);

  const Astate = initRuntimeState(attackerSnapshot);
  const Dstate = initRuntimeState(defenderSnapshot);

  const { passive: Apassive, ultimate: Ault } = readClassSkills(attackerSnapshot);
  const { passive: Dpassive, ultimate: Dult } = readClassSkills(defenderSnapshot);

  // Class packs (solo tags para VFX/logs)
  const AclassPack = buildClassPassivePack(attacker.className);
  const DclassPack = buildClassPassivePack(defender.className);
  const AclassState: any = {};
  const DclassState: any = {};

  if (DEBUG_PVP) {
    console.log("[PVP] A.combat =", attacker.combat, "A.weaponMain =", attacker.weaponMain, "A.weaponOff =", attacker.weaponOff);
    console.log("[PVP] D.combat =", defender.combat, "D.weaponMain =", defender.weaponMain, "D.weaponOff =", defender.weaponOff);
  }

  const cm = new CombatManager(attacker, defender, { rng });

  const timeline: TimelineEntry[] = [];
  const log: string[] = [];
  const snapshots: PvpFightResult["snapshots"] = [];

  for (let turn = 1; turn <= maxRounds; turn++) {
    const roundTags: string[] = [];
    const pushRoundTag = (ev: string) => roundTags.push(ev);

    cm.startRound(turn, () => {});
    const isAtkTurn = turn % 2 === 1;
    const actorSide: "player" | "enemy" = isAtkTurn ? "player" : "enemy";
    const actorSnap = isAtkTurn ? attackerSnapshot : defenderSnapshot;
    const actorState = isAtkTurn ? Astate : Dstate;
    const actorUltimateCfg = isAtkTurn ? Ault : Dult;

    // Class pack onRoundStart (tags solo)
    if (isAtkTurn) {
      AclassPack.hooks?.onRoundStart?.({ state: AclassState, side: "player", pushEvent: pushRoundTag } as any);
    } else {
      DclassPack.hooks?.onRoundStart?.({ state: DclassState, side: "enemy", pushEvent: pushRoundTag } as any);
    }

    // ── 1) Ultimate al inicio del turno
    let ultMult = 1;
    let ultCast = false;
    let ultTags: string[] = [];
    if (actorUltimateCfg?.enabled && actorUltimateCfg.proc?.enabled) {
      const ready = !actorState.ultimate || actorState.ultimate.cdLeft <= 0 ? true : actorState.ultimate.cdLeft <= 0;
      const respects = actorUltimateCfg.proc.respectCooldown !== false;
      const canTry = respects ? ready : true;

      if (canTry && actorUltimateCfg.proc.trigger?.check === "onTurnStart") {
        const fate = toNum(actorSnap?.stats?.fate, 0);
        const chance = procChanceFromFate(actorUltimateCfg.proc.trigger, fate, { base: 1, scale: 1, cap: 8 });
        if (rng() < chance) {
          ultCast = true;
          const bonusPct = toNum(actorUltimateCfg.effects?.bonusDamagePercent, 0);
          ultMult = Math.max(1, 1 + bonusPct / 100);

          const cd = Math.max(0, Math.floor(toNum(actorUltimateCfg.cooldownTurns, 6)));
          if (actorState.ultimate) actorState.ultimate.cdLeft = cd;

          if (actorUltimateCfg.effects?.applyDebuff) {
            const dur = Math.max(1, Math.floor(toNum(actorUltimateCfg.effects.debuffDurationTurns, 1)));
            (isAtkTurn ? Dstate : Astate).status?.pending?.push({
              key: String(actorUltimateCfg.effects.applyDebuff),
              duration: dur,
              value: toNum(actorUltimateCfg.effects.debuffValue ?? actorUltimateCfg.effects.bleedDamagePerTurn, 0),
            });
            ultTags.push(`${actorSide}:apply:${actorUltimateCfg.effects.applyDebuff}`);
          }

          timeline.push({
            turn,
            actor: isAtkTurn ? "attacker" : "defender",
            damage: 0,
            attackerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
            defenderHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
            event: "ultimate_cast",
            ability: { kind: "ultimate", name: actorUltimateCfg.name, durationTurns: undefined },
            tags: ultTags.slice(),
          });

          log.push(`▶️ ${isAtkTurn ? "Atacante" : "Defensor"} **lanza Ultimate**: ${actorUltimateCfg.name}`);
        }
      }
    }

    // tick cooldowns
    if (Astate.ultimate?.cdLeft && isAtkTurn === false) Astate.ultimate.cdLeft = Math.max(0, Astate.ultimate.cdLeft - 1);
    if (Dstate.ultimate?.cdLeft && isAtkTurn === true) Dstate.ultimate.cdLeft = Math.max(0, Dstate.ultimate.cdLeft - 1);

    // ── 2) Ataque base
    const out = isAtkTurn ? cm.playerAttack() : cm.enemyAttack();

    // ── 3) Pasiva (on hit)
    let passiveProc = false;
    let passiveThisHitBonus = 0;
    let passiveName: string | undefined;

    const passiveCfg = (isAtkTurn ? Apassive : Dpassive) as PassiveDefaultSkillCfg | undefined;
    const actorPassiveState = isAtkTurn ? Astate : Dstate;

    if (passiveCfg?.enabled && !out.flags.miss) {
      const fate = toNum(actorSnap?.stats?.fate, 0);
      const chance = procChanceFromFate(passiveCfg.trigger, fate, { base: 6, scale: 1, cap: 35 });
      if (rng() < chance) {
        passiveProc = true;
        passiveName = passiveCfg.name;

        const dur = Math.max(1, Math.floor(toNum(passiveCfg.durationTurns, 2)));
        const flat = i0(passiveCfg.bonusDamage);
        passiveThisHitBonus += flat;

        actorPassiveState.passiveBuff = {
          name: passiveCfg.name,
          remainingTurns: dur,
          bonusDamage: flat,
          extraEffects: { ...(passiveCfg.extraEffects || {}) },
        };

        timeline.push({
          turn,
          actor: isAtkTurn ? "attacker" : "defender",
          damage: 0,
          attackerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
          defenderHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
          event: "passive_proc",
          ability: { kind: "passive", name: passiveCfg.name, durationTurns: dur },
          tags: [`${actorSide}:passive:${passiveCfg.name}`],
        });

        log.push(`✨ ${isAtkTurn ? "Atacante" : "Defensor"} **activa Pasiva**: ${passiveCfg.name} (+${flat} daño por ${dur} turnos)`);
      }
    }

    // ── 4) Bonus pasivo persistente + multiplicador de Ultimate
    const persistentFlat = i0((isAtkTurn ? Astate : Dstate).passiveBuff?.bonusDamage);
    const baseDamage = i0(out.damage);
    let finalDamage = baseDamage + passiveThisHitBonus + persistentFlat;
    finalDamage = Math.floor(finalDamage * ultMult);

    // Ajustar HP manualmente por el extra
    const extraDelta = Math.max(0, finalDamage - baseDamage);
    if (extraDelta > 0) {
      if (isAtkTurn) (cm as any).enemy.currentHP = Math.max(0, (cm as any).enemy.currentHP - extraDelta);
      else (cm as any).player.currentHP = Math.max(0, (cm as any).player.currentHP - extraDelta);
    }

    // ── 4.1) Class pack tags (no tocan números)
    const hookTags: string[] = [];
    const pushHookTag = (ev: string) => hookTags.push(ev);
    if (isAtkTurn) {
      AclassPack.hooks?.onModifyOutgoing?.({
        dmg: finalDamage,
        side: "player",
        state: AclassState,
        pushEvent: pushHookTag,
        self: { className: attacker.className },
        flags: out.flags,
      } as any);
      DclassPack.hooks?.onModifyIncoming?.({
        dmg: finalDamage,
        side: "enemy",
        state: DclassState,
        pushEvent: pushHookTag,
        self: { className: defender.className },
        flags: out.flags,
      } as any);
    } else {
      DclassPack.hooks?.onModifyOutgoing?.({
        dmg: finalDamage,
        side: "enemy",
        state: DclassState,
        pushEvent: pushHookTag,
        self: { className: defender.className },
        flags: out.flags,
      } as any);
      AclassPack.hooks?.onModifyIncoming?.({
        dmg: finalDamage,
        side: "player",
        state: AclassState,
        pushEvent: pushHookTag,
        self: { className: attacker.className },
        flags: out.flags,
      } as any);
    }

    // ── 5) Timeline entry del golpe
    const entryTags: string[] = [];
    const atkEntity = isAtkTurn ? attacker : defender;
    if (atkEntity?.weaponMain?.slug) entryTags.push(`${actorSide}:weapon:${atkEntity.weaponMain.slug}`);
    if (out.extra?.offhandUsed && atkEntity?.weaponOff?.slug) entryTags.push(`${actorSide}:weapon_off:${atkEntity.weaponOff.slug}`);
    if (out.flags?.crit) entryTags.push(`${actorSide}:crit`);
    if (out.flags?.miss) entryTags.push(`${actorSide}:miss`);
    if (out.flags?.blocked) entryTags.push(`${actorSide}:blocked`);
    entryTags.push(`${actorSide}:attack`);
    entryTags.push(`${actorSide}:hit:${out.flags?.miss ? "miss" : out.flags?.blocked ? "blocked" : "physical"}`);
    if (ultCast) entryTags.push(`${actorSide}:ultimate`);
    if (passiveProc && passiveName) entryTags.push(`${actorSide}:passive:${passiveName}`);
    if (hookTags.length) entryTags.push(...hookTags);
    if (roundTags.length) entryTags.push(...roundTags);
    if (ultTags.length) entryTags.push(...ultTags);

    const entry: TimelineEntry = {
      turn,
      actor: isAtkTurn ? "attacker" : "defender",
      damage: finalDamage,
      attackerHP: clampInt((cm as any).player?.currentHP, 0, attacker.maxHP),
      defenderHP: clampInt((cm as any).enemy?.currentHP, 0, defender.maxHP),
      event: flagsToEvent(out.flags),
      tags: entryTags.length ? entryTags : undefined,
    };
    timeline.push(entry);

    // ── 6) Log humano
    const atkName = isAtkTurn ? attackerSnapshot?.name ?? "Atacante" : defenderSnapshot?.name ?? "Defensor";
    const tgtName = isAtkTurn ? defenderSnapshot?.name ?? "Defensor" : attackerSnapshot?.name ?? "Atacante";

    const hpA = entry.attackerHP,
      mhpA = attacker.maxHP;
    const hpD = entry.defenderHP,
      mhpD = defender.maxHP;

    const baseLine = out.flags?.miss
      ? `${atkName} falla contra ${tgtName}.`
      : out.flags?.blocked
      ? `${tgtName} bloquea. Daño ${finalDamage}.`
      : out.flags?.crit
      ? `¡Crítico! ${atkName} golpea a ${tgtName} por ${finalDamage}.`
      : `${atkName} golpea a ${tgtName} por ${finalDamage}.`;

    const extras: string[] = [];
    if (ultCast && (Ault?.name || Dult?.name)) extras.push(`Ultimate: ${isAtkTurn ? Ault?.name : Dult?.name}`);
    if (passiveProc && passiveName) extras.push(`Pasiva: ${passiveName}`);
    const tail = extras.length ? ` [${extras.join(" | ")}]` : "";

    log.push(isAtkTurn ? `${baseLine} (${hpD}/${mhpD} HP)${tail}` : `${baseLine} (${hpA}/${mhpA} HP)${tail}`);

    // ── 7) Snapshot por golpe
    snapshots.push({
      round: turn,
      actor: actorSide,
      damage: finalDamage,
      playerHP: entry.attackerHP,
      enemyHP: entry.defenderHP,
      events: entryTags.slice(),
      status: { pending: (isAtkTurn ? Dstate : Astate).status?.pending ?? [] },
    });

    // ── 8) Tick pasiva
    for (const st of [Astate, Dstate]) {
      if (st.passiveBuff && st.passiveBuff.remainingTurns > 0) {
        st.passiveBuff.remainingTurns -= 1;
        if (st.passiveBuff.remainingTurns <= 0) st.passiveBuff = null;
      }
    }

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

  // ✅ turns = cantidad de IMPACTOS
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
    tags: e.tags && e.tags.length ? e.tags.slice(0, 8) : undefined,
  }));

  return { outcome: mappedOutcome, timeline: mappedTimeline };
}

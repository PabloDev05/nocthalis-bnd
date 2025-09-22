// src/battleSystem/core/CombatManager.ts
// PvP táctico con resistencias completas + eventos diferenciados:
// - `dot_tick` para ticks de DoT (separado de `hit` normal).
// - DoT tiquea al INICIO del turno del afectado.
// - Estados: chance y magnitud afectadas por resistencia del objetivo.
// - Daño elemental para mágicos con elemento (Exorcist→holy, Necromancer→dark).
// - Crit chance y crit bonus mitigados por resistencias del defensor.
// - Eventos: "hit" | "crit" | "block" | "miss" | "passive_proc" | "ultimate_cast" | "dot_tick".

// Si luego querés subir/bajar el impacto sin tocar el código, al instanciar el manager podés pasar:
// new CombatManager(att, def, {
//   globalDamageMult: 1.12,  // +12% global
//   damageJitter: 0.25,      // más variación normal
//   critMultiplierBase: 0.75, // +75% base
//   critBonusAdd: 0.10,      // +10% extra
//   critBonusMult: 1.10,     // +10% multiplicativo
//   critJitter: 0.15,        // más variación en críticos
// });

import type { WeaponData } from "./Weapon";
import { isPrimaryWeapon, PRIMARY_WEAPON_BONUS_MULT } from "./Weapon";
import { StatusEngine, type Side } from "./StatusEngine";
import { STATUS_CATALOG } from "../constants/status";

export interface ManagerOpts {
  rng?: () => number;
  seed?: number;

  maxRounds?: number;

  /** Porción de daño bloqueado (0.5 = reduce 50%) */
  blockReduction?: number;

  /** Bonus de crítico base si el atacante no trae `criticalDamageBonus` (0.6 = +60%). */
  critMultiplierBase?: number;

  /** Variación del daño base (±j sobre 1.0). 0.22 ⇒ factor uniformemente en [0.78..1.22] */
  damageJitter?: number;

  /** 🔧 Aumenta levemente TODO el daño antes de DEF (p.ej. 1.08 = +8%). */
  globalDamageMult?: number;

  /** 🔧 “Perillas” para potenciar críticos de forma controlada (antes de mitigación): */
  critBonusAdd?: number;   // suma directa al bonus (0.05 = +5% extra)
  critBonusMult?: number;  // factor multiplicativo del bonus (1.05 = +5%)

  /** Variación extra SOLO para golpes críticos. 0.08 ⇒ [0.92..1.08] */
  critJitter?: number;
}

const DEBUG_MAN = false;

// ───────── Balance ─────────
const OFFHAND_WEAPON_CONTRIB = 0.35;
const OFFHAND_FOCUS_CONTRIB = 0.15;
const SHIELD_BLOCK_BONUS = 0.05;
const SHIELD_DR_BONUS = 0.03;

const ATTACK_SPEED_BASE = 6; // 1 acción garantizada
const ATTACK_SPEED_STEP = 3; // +3 AS ⇒ +1 acción
const ATTACK_SPEED_CAP = 12;

const PHYS_DEF_SOFTCAP = 40;
const MAG_DEF_SOFTCAP = 40;

const PASSIVE_MAX_CHANCE = 50;
const PASSIVE_FATE_SLOW = 0.6;

const ULTIMATE_MAX_CHANCE = 25;
const ULTIMATE_FATE_SLOW = 0.5;

// ───────── Tipos pasiva/ulti ─────────
export type PassiveTriggerCheck = "onBasicHit" | "onRangedHit" | "onSpellCast" | "onHitOrBeingHit";
export type DamageFlavor = "physical" | "magical";

export interface PassiveTrigger {
  check: PassiveTriggerCheck;
  scaleBy: "fate";
  baseChancePercent: number;
  fateScalePerPoint: number;
  maxChancePercent: number; // ignorado por cap global
}
export interface PassiveExtraEffects {
  evasionFlat?: number;
  attackSpeedFlat?: number;
  magicPowerFlat?: number;
  blockChancePercent?: number;
  criticalChancePercent?: number;
}
export interface PassiveConfig {
  enabled: boolean;
  name: string;
  damageType: DamageFlavor;
  shortDescEn?: string;
  longDescEn?: string;
  trigger: PassiveTrigger;
  durationTurns: number;
  bonusDamage: number;
  extraEffects?: PassiveExtraEffects;
}
interface PassiveRuntime {
  active: boolean;
  remainingTurns: number;
  bonusDamage: number;
  effects: Required<PassiveExtraEffects>;
}

type UltimateTriggerCheck = "onTurnStart";
export interface UltimateTrigger {
  check: UltimateTriggerCheck;
  scaleBy: "fate";
  baseChancePercent: number;
  fateScalePerPoint: number;
  maxChancePercent: number; // ignorado por cap global
}
export type UltimateDebuff = "weaken" | "fear" | "silence" | "curse" | "bleed";
export interface UltimateEffects {
  bonusDamagePercent?: number;
  applyDebuff?: UltimateDebuff;
  debuffValue?: number;
  debuffDurationTurns?: number;
  bleedDamagePerTurn?: number;
}
export interface UltimateConfig {
  enabled: boolean;
  name: string;
  description?: string;
  cooldownTurns: number;
  effects: UltimateEffects;
  proc: {
    enabled: boolean;
    trigger: UltimateTrigger; // onTurnStart
    respectCooldown: boolean;
  };
}
interface UltimateRuntime {
  cooldown: number;
}

// ───────── Utils ─────────
const asInt = (n: number) => Math.round(Number(n) || 0);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, asInt(v)));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const toFrac = (pp?: number) => clamp01(asInt(pp ?? 0) / 100);

function makeSeededRng(seed: number): () => number {
  let t = seed >>> 0 || 1;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function roll100(rng: () => number) {
  return Math.floor(rng() * 100) + 1;
}

function normalizeEffects(e?: PassiveExtraEffects): Required<PassiveExtraEffects> {
  return {
    evasionFlat: asInt(e?.evasionFlat ?? 0),
    attackSpeedFlat: asInt(e?.attackSpeedFlat ?? 0),
    magicPowerFlat: asInt(e?.magicPowerFlat ?? 0),
    blockChancePercent: asInt(e?.blockChancePercent ?? 0),
    criticalChancePercent: asInt(e?.criticalChancePercent ?? 0),
  };
}
function computePassiveChance(cfg: PassiveConfig, fate: number): number {
  const t = cfg.trigger;
  const growth = Math.floor(asInt(fate) * t.fateScalePerPoint * PASSIVE_FATE_SLOW);
  return clamp(t.baseChancePercent + growth, 0, PASSIVE_MAX_CHANCE);
}
function computeUltimateChance(cfg: UltimateConfig, fate: number): number {
  const t = cfg.proc.trigger;
  const growth = Math.floor(asInt(fate) * t.fateScalePerPoint * ULTIMATE_FATE_SLOW);
  return clamp(t.baseChancePercent + growth, 0, ULTIMATE_MAX_CHANCE);
}
function applyOrRefreshPassiveRuntime(current: PassiveRuntime | null | undefined, cfg: PassiveConfig) {
  const fresh: PassiveRuntime = {
    active: true,
    remainingTurns: Math.max(1, asInt(cfg.durationTurns)),
    bonusDamage: Math.max(0, asInt(cfg.bonusDamage ?? 0)),
    effects: normalizeEffects(cfg.extraEffects),
  };
  if (current?.active && current.remainingTurns > 0) {
    return { runtime: { ...fresh, remainingTurns: Math.max(current.remainingTurns, fresh.remainingTurns) }, refreshed: true };
  }
  return { runtime: fresh, refreshed: false };
}

// ───────── Interfaces side ─────────
export type SideKey = "player" | "enemy";

export interface CombatSide {
  name: string;
  className?: string;

  maxHP: number;
  currentHP: number;

  baseStats?: { [k: string]: number }; // Fate

  stats?: Record<string, number>; // physicalDefense / magicalDefense
  resistances?: Record<string, number>; // criticalChanceReduction / criticalDamageReduction / holy/dark/etc.
  equipment?: Record<string, unknown>;

  combat: {
    attackPower: number;
    magicPower: number;
    evasion: number; // 0..1
    blockChance: number; // 0..1
    damageReduction: number; // 0..1
    criticalChance: number; // 0..1
    criticalDamageBonus: number; // 0.5 => +50%
    attackSpeed: number; // ticks
    maxHP?: number;
  };

  weaponMain?: WeaponData;
  weaponOff?: WeaponData | null;

  classMeta?: { primaryWeapons?: string[] };

  passiveDefaultSkill?: PassiveConfig;
  ultimateSkill?: UltimateConfig;

  _passiveRuntime__?: PassiveRuntime | null;
  _ultimateRuntime__?: UltimateRuntime | null;
}

// ───────── Eventos ─────────
export type CombatEvent =
  | { type: "miss"; actor: "player" | "enemy" }
  | { type: "block"; actor: "player" | "enemy" }
  | { type: "crit"; actor: "player" | "enemy" }
  | { type: "ultimate_cast"; actor: "player" | "enemy"; name: string }
  | {
      type: "passive_proc";
      actor: "player" | "enemy";
      name: string;
      trigger: PassiveTriggerCheck;
      chancePercent: number;
      roll: number;
      result: "activated" | "refreshed" | "failed";
      remainingTurns?: number;
      duration?: number;
    }
  | {
      /** Golpe activo (básico / pasiva / ultimate), NO DoT. */
      type: "hit";
      actor: "player" | "enemy";
      flavor: DamageFlavor;
      vfx: string;
      damage: {
        final: number;
        breakdown: {
          mainRoll: number;
          offRoll: number;
          baseStat: number;
          passiveBonus: number;
          defenseFactor: number;
          elementFactor?: number;
          jitterFactor: number;
          critMult: number;
          blockFactor: number;
          drFactor: number;
          ultimatePreMult?: number;
          /** NUEVO: multiplicador global aplicado antes de DEF */
          globalMult?: number;
          /** NUEVO: jitter adicional de críticos (si hubo) */
          critJitterFactor?: number;
        };
      };
    }
  | {
      /** Nuevo: tick de DoT (sangrado/veneno/quemadura) */
      type: "dot_tick";
      actor: "player" | "enemy";
      victim: "player" | "enemy";
      key: "bleed" | "poison" | "burn";
      damage: number;
      vfx: "bleed-tick" | "poison-tick" | "burn-tick";
    };

// ───────── Manager ─────────
export interface AttackFlags {
  miss?: boolean;
  blocked?: boolean;
  crit?: boolean;
}
export interface AttackOutput {
  damage: number;
  flags: AttackFlags;
  events?: CombatEvent[];
  extra?: {
    actions?: number;
    strikes?: Array<{ damage: number; flags: AttackFlags }>;
    passiveState?: {
      player?: { active: boolean; remainingTurns: number } | null;
      enemy?: { active: boolean; remainingTurns: number } | null;
    };
  };
}

export class CombatManager {
  public player: CombatSide;
  public enemy: CombatSide;

  private rng: () => number;
  private opts: Required<
    Pick<ManagerOpts, "maxRounds" | "blockReduction" | "critMultiplierBase" | "damageJitter" | "globalDamageMult" | "critBonusAdd" | "critBonusMult" | "critJitter">
  > & ManagerOpts;

  private rounds = 0;
  private dbgCount = 0;

  private SE: StatusEngine;
  private pendingStartEvents: CombatEvent[] = [];

  constructor(attackerLike: any, defenderLike: any, optsOrSeed?: number | ManagerOpts) {
    this.player = attackerLike as CombatSide;
    this.enemy = defenderLike as CombatSide;

    // Defaults afinados: más variación, críticos más “picantes”, y +8% daño global
    const defaults = {
      maxRounds: 50,
      blockReduction: 0.5,
      critMultiplierBase: 0.6, // antes 0.5 → +60% base si el atacante no trae bonus
      damageJitter: 0.22,      // antes 0.15 → más dispersión en daño normal
      globalDamageMult: 1.08,  // +8% de daño leve, antes de DEF
      critBonusAdd: 0.05,      // +5% al bonus de crítico (antes de mitigación)
      critBonusMult: 1.05,     // +5% multiplicativo al bonus
      critJitter: 0.10,        // ±10% de variación extra solo en críticos
    } as const;

    const provided: ManagerOpts = typeof optsOrSeed === "number" ? { seed: optsOrSeed } : optsOrSeed ?? {};
    this.rng = provided.rng ?? (typeof provided.seed === "number" ? makeSeededRng(provided.seed) : Math.random);
    this.opts = { ...defaults, ...provided };

    // Fallback a puños
    this.player.weaponMain = this.player.weaponMain || { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon", hands: 1 };
    this.enemy.weaponMain = this.enemy.weaponMain || { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon", hands: 1 };

    // Clamp HP
    this.player.currentHP = clamp(this.player.currentHP, 0, this.player.maxHP);
    this.enemy.currentHP = clamp(this.enemy.currentHP, 0, this.enemy.maxHP);

    // StatusEngine con resistencias del OBJETIVO
    this.SE = new StatusEngine(
      this.rng,
      (side, key) => {
        const ref = side === "player" ? this.player : this.enemy;
        return clamp(num(ref.resistances?.[key], 0), 0, 100);
      },
      (key) => STATUS_CATALOG[key]?.maxStacks
    );
  }

  // ───────── Rondas (DoT en turnStart) ─────────
  startRound(turn: number, onStart?: (s: { turn: number; playerHP: number; enemyHP: number }) => void) {
    if (turn % 2 === 1) this.rounds++;

    // 1) Tick DoT al INICIO del turno del afectado
    const collect = (e: { actor: Side; victim: Side; key: "bleed" | "poison" | "burn"; dmg: number }) => {
      const victim = e.victim;
      if (victim === "player") this.player.currentHP = Math.max(0, this.player.currentHP - e.dmg);
      else this.enemy.currentHP = Math.max(0, this.enemy.currentHP - e.dmg);

      // Si hay daño, despertar del sleep del VÍCTIMA
      this.SE.wakeIfDamaged(victim);

      // Guardar evento separado (para VFX distinto)
      this.pendingStartEvents.push({
        type: "dot_tick",
        actor: e.actor,
        victim,
        key: e.key,
        damage: e.dmg,
        vfx: e.key === "bleed" ? "bleed-tick" : e.key === "poison" ? "poison-tick" : "burn-tick",
      });
    };
    this.SE.tickDots("player", "turnStart", collect);
    this.SE.tickDots("enemy", "turnStart", collect);

    // 2) Decremento/expiración
    this.SE.onRoundStart(turn, () => {});

    // 3) Aviso a UI
    onStart?.({ turn, playerHP: this.player.currentHP, enemyHP: this.enemy.currentHP });
  }

  private endOfRoundTick() {
    this.player._passiveRuntime__ = this.tickPassive(this.player._passiveRuntime__);
    this.enemy._passiveRuntime__ = this.tickPassive(this.enemy._passiveRuntime__);
    if (this.player._ultimateRuntime__?.cooldown! > 0) this.player._ultimateRuntime__!.cooldown--;
    if (this.enemy._ultimateRuntime__?.cooldown! > 0) this.enemy._ultimateRuntime__!.cooldown--;
  }
  private tickPassive(run?: PassiveRuntime | null): PassiveRuntime | null {
    if (!run?.active) return run ?? null;
    const left = (run.remainingTurns ?? 0) - 1;
    return left <= 0 ? null : { ...run, remainingTurns: left };
  }

  // ───────── API ─────────
  playerAttack(): AttackOutput {
    return this.performBurst("player", "enemy");
  }
  enemyAttack(): AttackOutput {
    const out = this.performBurst("enemy", "player");
    this.endOfRoundTick();
    return out;
  }
  isCombatOver(): boolean {
    if (this.player.currentHP <= 0 || this.enemy.currentHP <= 0) return true;
    if (this.rounds >= this.opts.maxRounds) return true;
    return false;
  }
  getWinner(): "player" | "enemy" | null {
    if (this.player.currentHP <= 0 && this.enemy.currentHP <= 0) return null;
    if (this.player.currentHP <= 0) return "enemy";
    if (this.enemy.currentHP <= 0) return "player";
    return null;
  }

  // ───────── Helpers arma/flavor/elemento ─────────
  private rollWeapon(w?: WeaponData | null): number {
    if (!w) return 0;
    const lo = Math.max(0, Math.floor((w as any).minDamage || 0));
    const hi = Math.max(lo, Math.floor((w as any).maxDamage || 0));
    if (hi <= lo) return lo;
    return Math.floor(lo + this.rng() * (hi - lo + 1));
  }
  private weaponCategory(w?: WeaponData | null) {
    return (w?.category ?? "").toString().toLowerCase();
  }
  private weaponIsRanged(w?: WeaponData | null) {
    const s = (w?.slug || "").toString().toLowerCase();
    const c = this.weaponCategory(w);
    return /bow|crossbow|rifle|gun|pistol|arquebus|flintlock|handcannon/.test(s) || c === "ranged";
  }
  private attackFlavorOf(side: CombatSide): DamageFlavor {
    const n = (side.className || "").toLowerCase();
    return n === "necromancer" || n === "exorcist" ? "magical" : "physical";
  }
  private isRanged(side: CombatSide): boolean {
    const clsRanged = (side.className || "").toLowerCase() === "revenant";
    return clsRanged || this.weaponIsRanged(side.weaponMain);
  }
  private elementKeyForAttack(side: CombatSide, flavor: DamageFlavor): "holy" | "dark" | null {
    if (flavor !== "magical") return null;
    const cls = (side.className || "").toLowerCase();
    if (cls === "exorcist") return "holy";
    if (cls === "necromancer") return "dark";
    return null;
  }
  private vfxForStrike(side: CombatSide, flavor: DamageFlavor, isCrit: boolean): string {
    const cls = (side.className || "").toLowerCase();
    if (flavor === "magical") {
      if (cls === "exorcist") return isCrit ? "holy-smite-crit" : "holy-smite";
      if (cls === "necromancer") return isCrit ? "shadow-curse-crit" : "shadow-curse";
      return isCrit ? "spell-burst-crit" : "spell-burst";
    }
    if (this.isRanged(side)) return isCrit ? "projectile-crit" : "projectile";
    const main = side.weaponMain?.slug?.toLowerCase() || "";
    if (/dagger|knife|kris|fang/.test(main)) return isCrit ? "stab-crit" : "stab";
    if (/mace|hammer|flail/.test(main)) return isCrit ? "smash-crit" : "smash";
    return isCrit ? "slash-crit" : "slash";
  }

  // ───────── Derivados con estados ─────────
  private withPassiveBuffs(side: CombatSide, owner: Side) {
    const base = {
      attackSpeed: clamp(side.combat.attackSpeed, 1, ATTACK_SPEED_CAP),
      evasion: clamp01(num(side.combat.evasion, 0)),
      magicPower: Math.max(0, asInt(num(side.combat.magicPower, 0))),
      blockChance: clamp01(num(side.combat.blockChance, 0)),
      criticalChance: clamp01(num(side.combat.criticalChance, 0)),
    };
    const run = side._passiveRuntime__;
    let out =
      run?.active && run.remainingTurns > 0
        ? {
            attackSpeed: Math.max(1, asInt(base.attackSpeed + (run.effects.attackSpeedFlat || 0))),
            evasion: clamp01(base.evasion + toFrac(run.effects.evasionFlat)),
            magicPower: Math.max(0, asInt(base.magicPower + (run.effects.magicPowerFlat || 0))),
            blockChance: clamp01(base.blockChance + toFrac(run.effects.blockChancePercent)),
            criticalChance: clamp01(base.criticalChance + toFrac(run.effects.criticalChancePercent)),
          }
        : base;

    // Haste/shock del StatusEngine
    out.attackSpeed = clamp(out.attackSpeed + this.SE.attackSpeedFlat(owner), 1, ATTACK_SPEED_CAP);
    return out;
  }
  private physDefEff(side: CombatSide, owner: Side): number {
    const base = Math.max(0, num(side.stats?.["physicalDefense"], 0));
    return base * this.SE.physDefMul(owner);
  }
  private magDefEff(side: CombatSide): number {
    return Math.max(0, num(side.stats?.["magicalDefense"], 0));
  }
  private critChanceReductionEff(owner: Side, side: CombatSide): number {
    const res = toFrac(side.resistances?.["criticalChanceReduction"]); // del defensor
    const extra = this.SE.critChanceReductionFrac(owner); // fear activo
    return clamp01(res + extra);
  }
  private atkPowerEff(owner: Side, side: CombatSide): number {
    const mul = this.SE.attackPowerMul(owner);
    const base = Math.max(0, asInt(num(side.combat.attackPower, 0)));
    return Math.max(0, asInt(base * mul));
  }
  private drBonusEff(owner: Side): number {
    return this.SE.extraDamageReduction(owner);
  }
  private isSilenced(owner: Side): boolean {
    return this.SE.silenced(owner);
  }

  // ───────── AttackSpeed → nº de acciones ─────────
  private targetGuaranteedActions(attackSpeedEff: number) {
    const as = clamp(attackSpeedEff, 1, ATTACK_SPEED_CAP);
    if (as <= ATTACK_SPEED_BASE) return 1;
    const delta = as - ATTACK_SPEED_BASE;
    return 1 + Math.floor(delta / ATTACK_SPEED_STEP);
  }
  private targetFractionChance(attackSpeedEff: number) {
    const as = clamp(attackSpeedEff, 1, ATTACK_SPEED_CAP);
    if (as <= ATTACK_SPEED_BASE) return 0;
    const delta = as - ATTACK_SPEED_BASE;
    return clamp01((delta % ATTACK_SPEED_STEP) / ATTACK_SPEED_STEP);
  }

  // ───────── Burst con ulti + eventos de DoT previos ─────────
  private performBurst(attackerKey: SideKey, defenderKey: SideKey): AttackOutput {
    const A = attackerKey === "player" ? this.player : this.enemy;
    const ASide: Side = attackerKey;

    // 1) Emitir primero los ticks de DoT encolados (turnStart)
    const events: CombatEvent[] = this.pendingStartEvents.splice(0);
    if (this.isCombatOver()) return { damage: 0, flags: { miss: false }, events, extra: { actions: 0, strikes: [] } };

    // 2) Si está CC duro, no actúa
    const strikes: Array<{ damage: number; flags: AttackFlags }> = [];
    let totalDamage = 0;
    let actions = 0;
    let fractionalRolled = false;

    if (this.SE.cannotAct(ASide)) {
      events.push({ type: "miss", actor: attackerKey });
      return { damage: 0, flags: { miss: true }, events, extra: { actions: 0, strikes } };
    }

    // 3) Intento de Ultimate (si procede)
    const maybeUlt = this.tryUltimateCast(attackerKey, defenderKey, events);
    if (maybeUlt) {
      actions++;
      strikes.push({ damage: maybeUlt.damage, flags: maybeUlt.flags });
      totalDamage += maybeUlt.damage;
      if (this.isCombatOver()) return { damage: totalDamage, flags: { miss: false }, events, extra: { actions, strikes } };
    }

    // 4) Golpes por AttackSpeed
    while (!this.isCombatOver()) {
      const eff = this.withPassiveBuffs(A, ASide);
      const guaranteedTarget = this.targetGuaranteedActions(eff.attackSpeed);

      if (this.SE.paralysisSkip(ASide)) {
        events.push({ type: "miss", actor: attackerKey });
        actions++;
        continue;
      }

      if (actions < guaranteedTarget) {
        const out = this.performSingleStrike(attackerKey, defenderKey, events, undefined);
        actions++;
        strikes.push({ damage: out.damage, flags: out.flags });
        totalDamage += out.damage;
        continue;
      }

      if (!fractionalRolled) {
        const chance = this.targetFractionChance(eff.attackSpeed);
        if (this.rng() < chance) {
          const out = this.performSingleStrike(attackerKey, defenderKey, events, undefined);
          actions++;
          strikes.push({ damage: out.damage, flags: out.flags });
          totalDamage += out.damage;
        }
        fractionalRolled = true;
      }
      break;
    }

    const anyCrit = strikes.some((s) => s.flags.crit);
    const anyBlocked = strikes.some((s) => s.flags.blocked);
    const allMiss = strikes.length > 0 && strikes.every((s) => s.flags.miss);

    return {
      damage: totalDamage,
      flags: { miss: allMiss, crit: anyCrit, blocked: anyBlocked },
      events,
      extra: {
        actions,
        strikes,
        passiveState: {
          player: this.player._passiveRuntime__ ? { active: true, remainingTurns: this.player._passiveRuntime__!.remainingTurns } : { active: false, remainingTurns: 0 },
          enemy: this.enemy._passiveRuntime__ ? { active: true, remainingTurns: this.enemy._passiveRuntime__!.remainingTurns } : { active: false, remainingTurns: 0 },
        },
      },
    };
  }

  // Ulti con respeto de silence/CD + debuffs
  private tryUltimateCast(attackerKey: SideKey, defenderKey: SideKey, events: CombatEvent[]): AttackOutput | null {
    const A = attackerKey === "player" ? this.player : this.enemy;
    const ASide: Side = attackerKey;
    const cfg = A.ultimateSkill;
    if (!cfg?.enabled || !cfg.proc?.enabled) return null;

    if (cfg.proc.respectCooldown) {
      if (!A._ultimateRuntime__) A._ultimateRuntime__ = { cooldown: 0 };
      if (A._ultimateRuntime__.cooldown > 0) return null;
    }
    if (this.isSilenced(ASide)) return null;

    const fate = asInt(num(A.baseStats?.["fate"], 0));
    const chance = computeUltimateChance(cfg, fate);
    const roll = roll100(this.rng);
    if (roll > chance) return null;

    if (!A._ultimateRuntime__) A._ultimateRuntime__ = { cooldown: 0 };
    A._ultimateRuntime__.cooldown = Math.max(1, asInt(cfg.cooldownTurns));
    events.push({ type: "ultimate_cast", actor: attackerKey, name: cfg.name });

    const mult = 1 + Math.max(0, num(cfg.effects?.bonusDamagePercent, 0)) / 100;
    return this.performSingleStrike(attackerKey, defenderKey, events, { ultimatePreMult: mult, ultimateEffects: cfg.effects });
  }

  // Golpe atómico
  private performSingleStrike(
    attackerKey: SideKey,
    defenderKey: SideKey,
    events: CombatEvent[],
    opts?: {
      ultimatePreMult?: number;
      ultimateEffects?: { applyDebuff?: "weaken" | "fear" | "silence" | "curse" | "bleed"; debuffValue?: number; debuffDurationTurns?: number; bleedDamagePerTurn?: number };
    }
  ): AttackOutput {
    const A = attackerKey === "player" ? this.player : this.enemy;
    const D = defenderKey === "player" ? this.player : this.enemy;
    const ASide: Side = attackerKey;
    const DSide: Side = defenderKey;

    const flavor: DamageFlavor = this.attackFlavorOf(A);
    const fateA = asInt(num(A.baseStats?.["fate"], 0));
    const fateD = asInt(num(D.baseStats?.["fate"], 0));

    const Aeff = this.withPassiveBuffs(A, ASide);
    const Deff = this.withPassiveBuffs(D, DSide);

    // Confusión: auto-fallo
    if (this.SE.confusionMiss(ASide)) {
      events.push({ type: "miss", actor: attackerKey });
      return { damage: 0, flags: { miss: true } };
    }

    // 1) Evasión
    const ev = clamp01(Deff.evasion);
    if (this.rng() < ev) {
      events.push({ type: "miss", actor: defenderKey });
      return { damage: 0, flags: { miss: true } };
    }

    // 2) Block
    const defHasShield = (D.weaponOff?.category ?? "weapon").toLowerCase() === "shield";
    const blockChance = clamp01(Deff.blockChance + (defHasShield ? SHIELD_BLOCK_BONUS : 0));
    const blocked = this.rng() < blockChance;
    if (blocked) events.push({ type: "block", actor: defenderKey });

    // 3) Crítico (mitigado por fear + resistencia del DEFENSOR)
    const critChanceBase = clamp01(Aeff.criticalChance || num(A.combat.criticalChance, 0.05));
    const critChanceRed = this.critChanceReductionEff(DSide, D);
    const critChanceEff = clamp01(critChanceBase - critChanceRed);
    const isCrit = this.rng() < critChanceEff;
    if (isCrit) events.push({ type: "crit", actor: attackerKey });

    // 4) Arma principal (+bonus si primaria)
    let mainRoll = this.rollWeapon(A.weaponMain);
    if (isPrimaryWeapon(A.weaponMain, A.classMeta?.primaryWeapons)) mainRoll = Math.floor(mainRoll * PRIMARY_WEAPON_BONUS_MULT);

    // 5) Offhand
    let offRollPart = 0;
    if (A.weaponOff) {
      const cat = (A.weaponOff.category ?? "weapon").toLowerCase();
      const r = this.rollWeapon(A.weaponOff);
      if (cat === "weapon") offRollPart = Math.floor(r * OFFHAND_WEAPON_CONTRIB);
      else if (cat === "focus") offRollPart = Math.floor(r * OFFHAND_FOCUS_CONTRIB);
    }

    // 6) Stat base por flavor (curse/rage afectan ATK)
    const baseStat = flavor === "magical" ? Math.max(0, asInt(Aeff.magicPower)) : this.atkPowerEff(ASide, A);

    // 7) Bonus de pasiva (si coincide flavor)
    let passiveBonus = 0;
    if (A._passiveRuntime__?.active && A._passiveRuntime__?.remainingTurns > 0) {
      if (A.passiveDefaultSkill?.damageType === flavor) passiveBonus = Math.max(0, asInt(A._passiveRuntime__?.bonusDamage || 0));
    }

    // 8) Base
    let baseSum = mainRoll + offRollPart + baseStat + passiveBonus;

    // 8.1) Ulti pre-mult
    const ultimatePreMult = Math.max(1, num(opts?.ultimatePreMult, 1));
    baseSum = Math.floor(baseSum * ultimatePreMult);

    // 8.2) 🔧 Multiplicador global antes de DEF (aplica a todo: arma+stat+pasiva)
    const globalMult = Math.max(0.5, num(this.opts.globalDamageMult, 1));
    baseSum = Math.floor(baseSum * globalMult);

    // 9) Mitigación por DEF (softcap)
    const physDef = this.physDefEff(D, DSide);
    const magDef = this.magDefEff(D);
    const defDR = flavor === "magical" ? (magDef > 0 ? magDef / (magDef + MAG_DEF_SOFTCAP) : 0) : physDef > 0 ? physDef / (physDef + PHYS_DEF_SOFTCAP) : 0;
    const defenseFactor = clamp01(1 - defDR);
    let after = Math.floor(baseSum * defenseFactor);

    // 9.5) Mitigación elemental del DEFENSOR (holy/dark)
    let elementFactor = 1;
    const elemKey = this.elementKeyForAttack(A, flavor);
    if (elemKey) {
      const resElem = clamp(num(D.resistances?.[elemKey], 0), 0, 100);
      elementFactor = Math.max(0, 1 - resElem / 100);
      after = Math.floor(after * elementFactor);
    }

    // 10) Jitter general
    const j = clamp01(num(this.opts.damageJitter, 0.22));
    const jitterFactor = 1 - j + this.rng() * (2 * j);
    after = Math.floor(after * jitterFactor);

    // 11) Crítico (bonus + knobs + mitigación), con jitter extra en críticos
    let critMult = 1;
    let critJitterFactor: number | undefined = undefined;
    if (isCrit) {
      // Bonus base del atacante (puede venir en fracción o puntos %)
      const raw = num(A.combat.criticalDamageBonus, this.opts.critMultiplierBase);
      const baseBonus = raw > 1 ? toFrac(raw) : raw; // 35 → 0.35 ; 0.35 → 0.35

      // Tuning global ANTES de mitigar
      const tunedBonus = Math.max(0, baseBonus * num(this.opts.critBonusMult, 1) + num(this.opts.critBonusAdd, 0));

      // Mitigación del defensor
      const critDmgRed = toFrac(D.resistances?.["criticalDamageReduction"]);
      const effBonus = Math.max(0, tunedBonus - critDmgRed);

      critMult = 1 + effBonus;
      after = Math.floor(after * critMult);

      // Jitter extra SOLO para críticos
      const cj = clamp01(num(this.opts.critJitter, 0.1));
      critJitterFactor = 1 - cj + this.rng() * (2 * cj);
      after = Math.floor(after * critJitterFactor);
    }

    // 12) Block
    let blockFactor = 1;
    if (blocked) {
      blockFactor = 1 - this.opts.blockReduction;
      after = Math.floor(after * blockFactor);
    }

    // 13) DR plana + escudo + estados (fortify/shield)
    const drBase = clamp01(num(D.combat.damageReduction, 0));
    const drFromShield = defHasShield ? SHIELD_DR_BONUS : 0;
    const drFromStatuses = clamp01(this.drBonusEff(DSide));
    const dr = clamp01(drBase + drFromShield + drFromStatuses);
    const drFactor = 1 - dr;
    after = Math.floor(after * drFactor);

    // 14) Aplicar daño
    const finalDmg = Math.max(0, asInt(after));
    D.currentHP = Math.max(0, D.currentHP - finalDmg);

    if (finalDmg > 0) this.SE.wakeIfDamaged(DSide);

    // 15) Evento de hit (ACTIVO)
    events.push({
      type: "hit",
      actor: attackerKey,
      flavor,
      vfx: this.vfxForStrike(A, flavor, isCrit),
      damage: {
        final: finalDmg,
        breakdown: {
          mainRoll,
          offRoll: offRollPart,
          baseStat,
          passiveBonus,
          defenseFactor: Number(defenseFactor.toFixed(3)),
          elementFactor: Number(elementFactor.toFixed(3)),
          jitterFactor: Number(jitterFactor.toFixed(3)),
          critMult: Number(critMult.toFixed(2)),
          blockFactor: Number(blockFactor.toFixed(2)),
          drFactor: Number(drFactor.toFixed(2)),
          ultimatePreMult: Number(ultimatePreMult.toFixed(2)),
          globalMult: Number(globalMult.toFixed(2)),
          ...(critJitterFactor != null ? { critJitterFactor: Number(critJitterFactor.toFixed(3)) } : {}),
        },
      },
    });

    // 16) Pasivas post-hit
    const pushPassiveEvent = (who: SideKey, side: CombatSide, fate: number, event: PassiveTriggerCheck) => {
      const cfg = side.passiveDefaultSkill!;
      const chance = computePassiveChance(cfg, fate);
      const roll = roll100(this.rng);
      let result: "activated" | "refreshed" | "failed" = "failed";
      let remaining: number | undefined;
      if (roll <= chance) {
        const { runtime, refreshed } = applyOrRefreshPassiveRuntime(side._passiveRuntime__, cfg);
        side._passiveRuntime__ = runtime;
        result = refreshed ? "refreshed" : "activated";
        remaining = runtime.remainingTurns;
      }
      events.push({ type: "passive_proc", actor: who, name: cfg.name, trigger: cfg.trigger.check, chancePercent: chance, roll, result, remainingTurns: remaining, duration: cfg.durationTurns });
    };
    if (A.passiveDefaultSkill?.enabled) {
      const trig = A.passiveDefaultSkill.trigger.check;
      if (flavor === "magical" && trig === "onSpellCast") pushPassiveEvent(attackerKey, A, fateA, "onSpellCast");
      if (flavor === "physical" && trig === "onBasicHit") pushPassiveEvent(attackerKey, A, fateA, "onBasicHit");
      if (this.isRanged(A) && trig === "onRangedHit") pushPassiveEvent(attackerKey, A, fateA, "onRangedHit");
      if (trig === "onHitOrBeingHit") pushPassiveEvent(attackerKey, A, fateA, "onHitOrBeingHit");
    }
    if (D.passiveDefaultSkill?.enabled && D.passiveDefaultSkill.trigger.check === "onHitOrBeingHit") {
      pushPassiveEvent(defenderKey, D, fateD, "onHitOrBeingHit");
    }

    // 17) Debuffs de la Ultimate (tras el daño)
    if (opts?.ultimateEffects?.applyDebuff) {
      const eff = opts.ultimateEffects;
      const dur = Math.max(1, asInt(eff.debuffDurationTurns ?? STATUS_CATALOG[eff.applyDebuff!]?.baseDuration ?? 1));
      const val = Math.max(0, asInt(eff.debuffValue ?? 0));
      const apply = (key: UltimateDebuff, more?: { dot?: number }) => {
        this.SE.tryApply({
          to: DSide,
          key,
          duration: dur,
          stacks: 1,
          value: key === "bleed" ? undefined : val,
          dotDamage: key === "bleed" ? Math.max(0, asInt(more?.dot ?? eff.bleedDamagePerTurn ?? 0)) : undefined,
          baseChance: 100,
          source: attackerKey,
          pushEvent: () => {},
        });
      };
      switch (eff.applyDebuff) {
        case "weaken":
          apply("weaken");
          break;
        case "fear":
          apply("fear");
          break;
        case "silence":
          apply("silence");
          break;
        case "curse":
          apply("curse");
          break;
        case "bleed":
          apply("bleed", { dot: eff.bleedDamagePerTurn });
          break;
      }
    }

    if (DEBUG_MAN && this.dbgCount++ < 2) {
      /* console.log("[MAN] dmg=", finalDmg); */
    }
    return { damage: finalDmg, flags: { miss: false, blocked, crit: isCrit } };
  }
}

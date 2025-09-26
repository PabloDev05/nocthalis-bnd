// PvP táctico, cálculos ENTEROS y simples, Fate visible y con "pity system".

import type { WeaponData } from "./Weapon";
import { isPrimaryWeapon, PRIMARY_WEAPON_BONUS_MULT } from "./Weapon";
import { StatusEngine, type Side } from "./StatusEngine";
import { STATUS_CATALOG } from "../constants/status";

/* ────────────────────────────────────────────────────────────────────── */
/*                             PARÁMETROS                                */
/* ────────────────────────────────────────────────────────────────────── */

const DEBUG_PROC = false;

/** Bloqueo reduce este porcentaje del daño (entero 0..100) */
const BLOCK_REDUCTION_PERCENT = 50;

/** Softcaps de defensa (valores ENTEROS) */
const PHYS_DEF_SOFTCAP = 40;
const MAG_DEF_SOFTCAP = 40;

/** Bonos de escudo (enteros %) */
const SHIELD_BLOCK_BONUS_PERCENT = 5;
const SHIELD_DR_BONUS_PERCENT = 3;

/** Crítico base si falta dato (enteros %) y bonus daño crit (enteros %) */
const CRIT_DEFAULT_CHANCE_PERCENT = 5;
const CRIT_DEFAULT_BONUS_PERCENT = 40;

/** Caps de procs y escalado por Fate (enteros) */
const PASSIVE_BASE_CHANCE = 5; // %
const PASSIVE_PER_FATE = 2; // % por punto de Fate
const PASSIVE_MAX_CHANCE = 50; // %
const PASSIVE_PITY_AFTER_FAILS = 6; // garantía tras N fallos seguidos

const ULT_BASE_CHANCE = 2; // %
const ULT_PER_FATE = 1; // % por punto de Fate
const ULT_MAX_CHANCE = 25; // %
const ULT_COOLDOWN_TURNS = 4; // CD fijo (entero ≥ 1)
const ULT_PITY_AFTER_FAILS = 8; // garantía tras N turnos sin lanzar

/** Daño base de Ultimate (enteros) */
const ULT_DAMAGE_MAIN_MULT = 3; // multiplica el stat base
const ULT_DAMAGE_WEAPON_PART = 1; // agrega min+max/2 aproximado arma
const ULT_EXTRA_FLAT = 0; // flat extra (puedes ajustar)

/** Contribuciones de offhand (enteros %) */
const OFFHAND_WEAPON_CONTRIB_PERCENT = 35;
const OFFHAND_FOCUS_CONTRIB_PERCENT = 15;

/* ────────────────────────────────────────────────────────────────────── */
/*                                TIPOS                                  */
/* ────────────────────────────────────────────────────────────────────── */

export type PassiveTriggerCheck = "onBasicHit" | "onRangedHit" | "onSpellCast" | "onHitOrBeingHit";
export type DamageFlavor = "physical" | "magical";

export interface PassiveTrigger {
  check: PassiveTriggerCheck;
  scaleBy: "fate";
  baseChancePercent: number;
  fateScalePerPoint: number;
  maxChancePercent: number;
}
export interface PassiveExtraEffects {
  evasionFlat?: number; // % entero
  magicPowerFlat?: number; // entero
  blockChancePercent?: number; // % entero
  criticalChancePercent?: number; // % entero
}
export interface PassiveConfig {
  enabled: boolean;
  name: string;
  damageType: DamageFlavor;
  shortDescEn?: string;
  longDescEn?: string;
  trigger: PassiveTrigger;
  durationTurns: number; // entero
  bonusDamage: number; // entero
  extraEffects?: PassiveExtraEffects;
}
interface PassiveRuntime {
  active: boolean;
  remainingTurns: number; // entero
  bonusDamage: number; // entero
  effects: Required<PassiveExtraEffects>;
}

type UltimateTriggerCheck = "onTurnStart";
export interface UltimateTrigger {
  check: UltimateTriggerCheck;
  scaleBy: "fate";
  baseChancePercent: number;
  fateScalePerPoint: number;
  maxChancePercent: number;
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
    trigger: UltimateTrigger;
    respectCooldown: boolean;
  };
}
interface UltimateRuntime {
  cooldown: number; // entero ≥ 0
  failStreak: number;
}

export type SideKey = "player" | "enemy";

export interface CombatSide {
  name: string;
  className?: string;

  maxHP: number;
  currentHP: number;

  baseStats?: { [k: string]: number };
  stats?: Record<string, number>;
  resistances?: Record<string, number>;
  equipment?: Record<string, unknown>;

  combat: {
    attackPower: number;
    magicPower: number;
    evasion: number; // 0..1 o %
    blockChance: number; // 0..1 o %
    damageReduction: number; // 0..1 o %
    criticalChance: number; // 0..1 o %
    criticalDamageBonus: number; // % o fracción
    maxHP?: number;
  };

  weaponMain?: WeaponData;
  weaponOff?: WeaponData | null;

  classMeta?: { primaryWeapons?: string[] };

  passiveDefaultSkill?: PassiveConfig;
  ultimateSkill?: UltimateConfig;

  _passiveRuntime__?: PassiveRuntime | null;
  _passiveFailStreak__?: number;

  _ultimateRuntime__?: UltimateRuntime | null;
}

/* ────────────────────────────────────────────────────────────────────── */
/*                           EVENTOS Y SALIDA                             */
/* ────────────────────────────────────────────────────────────────────── */

export type CombatEvent =
  | { type: "miss"; actor: "player" | "enemy" }
  | { type: "block"; actor: "player" | "enemy" }
  | { type: "crit"; actor: "player" | "enemy" }
  | { type: "ultimate_cast"; actor: "player" | "enemy"; name: string; chance: number; roll: number; forcedByPity?: boolean }
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
      forcedByPity?: boolean;
    }
  | {
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
          defenseFactor: number; // 0..100 %
          elementFactor?: number; // 0..100 %
          critBonusPercent: number; // %
          blockReducedPercent: number; // %
          drReducedPercent: number; // %
          preBlock?: number;
          blockedAmount?: number;
          ultimateDamage?: number;
        };
      };
    }
  | {
      type: "dot_tick";
      actor: "player" | "enemy";
      victim: "player" | "enemy";
      key: "bleed" | "poison" | "burn";
      damage: number;
      vfx: "bleed-tick" | "poison-tick" | "burn-tick";
    };

/* ────────────────────────────────────────────────────────────────────── */
/*                           HELPERS ENTEROS                              */
/* ────────────────────────────────────────────────────────────────────── */

const asInt = (n: number) => Math.trunc(Number(n) || 0);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, asInt(v)));
const pct = (x: number) => clamp(x, 0, 100);
const toPct = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  if (n <= 1 && n >= 0) return clamp(n * 100, 0, 100);
  return pct(n);
};
const roll100 = (rng: () => number) => Math.floor(rng() * 100) + 1;

/* ────────────────────────────────────────────────────────────────────── */
/*                         CLASE PRINCIPAL                                */
/* ────────────────────────────────────────────────────────────────────── */

export interface AttackFlags {
  miss?: boolean;
  blocked?: boolean;
  crit?: boolean;
}
export interface AttackOutput {
  damage: number;
  flags: AttackFlags;
  events?: CombatEvent[];
}

export class CombatManager {
  public player: CombatSide;
  public enemy: CombatSide;

  private rng: () => number;
  private rounds = 0;

  private SE: StatusEngine;
  private pendingStartEvents: CombatEvent[] = [];

  constructor(attackerLike: any, defenderLike: any, opts?: { rng?: () => number }) {
    this.player = attackerLike as CombatSide;
    this.enemy = defenderLike as CombatSide;

    this.rng = opts?.rng ?? Math.random;

    // Fallback armas
    this.player.weaponMain = this.player.weaponMain || { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon", hands: 1 };
    this.enemy.weaponMain = this.enemy.weaponMain || { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon", hands: 1 };

    // HP clamp
    this.player.currentHP = clamp(this.player.currentHP, 0, this.player.maxHP);
    this.enemy.currentHP = clamp(this.enemy.currentHP, 0, this.enemy.maxHP);

    // Inicializar pity
    this.player._passiveFailStreak__ = 0;
    this.enemy._passiveFailStreak__ = 0;
    this.player._ultimateRuntime__ = { cooldown: 0, failStreak: 0 };
    this.enemy._ultimateRuntime__ = { cooldown: 0, failStreak: 0 };

    // StatusEngine con resistencias del objetivo
    this.SE = new StatusEngine(
      this.rng,
      (side, key) => {
        const ref = side === "player" ? this.player : this.enemy;
        return clamp(ref.resistances?.[key] ?? 0, 0, 100);
      },
      (key) => STATUS_CATALOG[key]?.maxStacks
    );
  }

  /* ───────── Rondas (DoT al inicio) ───────── */

  startRound(turn: number) {
    if (turn % 2 === 1) this.rounds++;

    const collect = (e: { actor: Side; victim: Side; key: "bleed" | "poison" | "burn"; dmg: number }) => {
      const victim = e.victim;
      if (victim === "player") this.player.currentHP = Math.max(0, this.player.currentHP - e.dmg);
      else this.enemy.currentHP = Math.max(0, this.enemy.currentHP - e.dmg);
      this.SE.wakeIfDamaged(victim);
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

    this.SE.onRoundStart(turn, () => {});

    // Reducir cooldown de ultimates al final de la ronda completa:
    if (turn % 2 === 0) {
      if (this.player._ultimateRuntime__!.cooldown > 0) this.player._ultimateRuntime__!.cooldown--;
      if (this.enemy._ultimateRuntime__!.cooldown > 0) this.enemy._ultimateRuntime__!.cooldown--;
    }
  }

  // ❌ NO más límite de rondas ni tolerancias: sólo acaba por HP=0
  isCombatOver(): boolean {
    return this.player.currentHP <= 0 || this.enemy.currentHP <= 0;
  }

  getWinner(): "player" | "enemy" | null {
    if (this.player.currentHP <= 0 && this.enemy.currentHP <= 0) return null;
    if (this.player.currentHP <= 0) return "enemy";
    if (this.enemy.currentHP <= 0) return "player";
    return null;
  }

  // (opcional) helper para que quien llama pueda leer HP actuales
  public getHPs() {
    return { playerHP: Math.max(0, this.player.currentHP), enemyHP: Math.max(0, this.enemy.currentHP) };
  }

  /* ───────── API por turno ───────── */

  playerAttack(): AttackOutput {
    return this.performTurn("player", "enemy");
  }
  enemyAttack(): AttackOutput {
    return this.performTurn("enemy", "player");
  }

  /* ───────── Núcleo de turno ───────── */

  private performTurn(attackerKey: SideKey, defenderKey: SideKey): AttackOutput {
    const events: CombatEvent[] = this.pendingStartEvents.splice(0);

    if (this.isCombatOver()) return { damage: 0, flags: { miss: false }, events };

    const A = attackerKey === "player" ? this.player : this.enemy;

    // 1) Intentar Ultimate al inicio del turno del atacante
    const ult = this.tryUltimate(attackerKey, defenderKey, events);
    if (ult) {
      if (DEBUG_PROC) console.debug("[ULT HIT]", A.name, "dmg=", ult.damage);
      if (this.isCombatOver()) return { damage: ult.damage, flags: { miss: false }, events };
    }

    // 2) 1 golpe básico
    const basic = this.performBasicStrike(attackerKey, defenderKey, events);
    return { damage: basic.damage, flags: basic.flags, events };
  }

  /* ───────── Lecturas simples de stats ───────── */

  private evasionPct(side: CombatSide, withPassive = true): number {
    const base = toPct(side.combat.evasion);
    const add = withPassive && side._passiveRuntime__?.active ? toPct(side._passiveRuntime__!.effects.evasionFlat) : 0;
    return pct(base + add);
  }
  private blockPct(side: CombatSide, withShield: boolean, withPassive = true): number {
    const base = toPct(side.combat.blockChance);
    const addPsv = withPassive && side._passiveRuntime__?.active ? toPct(side._passiveRuntime__!.effects.blockChancePercent) : 0;
    const addSh = withShield ? SHIELD_BLOCK_BONUS_PERCENT : 0;
    return pct(base + addPsv + addSh);
  }
  private critPct(side: CombatSide, withPassive = true): number {
    const base = toPct(side.combat.criticalChance || CRIT_DEFAULT_CHANCE_PERCENT);
    const add = withPassive && side._passiveRuntime__?.active ? toPct(side._passiveRuntime__!.effects.criticalChancePercent) : 0;
    return pct(base + add);
  }
  private critBonusPct(side: CombatSide): number {
    const raw = side.combat.criticalDamageBonus;
    const asPercent = toPct(raw || CRIT_DEFAULT_BONUS_PERCENT);
    return pct(asPercent);
  }
  private magicPower(side: CombatSide, withPassive = true): number {
    const base = asInt(side.combat.magicPower || 0);
    const add = withPassive && side._passiveRuntime__?.active ? asInt(side._passiveRuntime__!.effects.magicPowerFlat || 0) : 0;
    return Math.max(0, base + add);
  }
  private attackPower(side: CombatSide): number {
    return Math.max(0, asInt(side.combat.attackPower || 0));
  }
  private drPct(side: CombatSide, withShield: boolean): number {
    const base = toPct(side.combat.damageReduction || 0);
    const sh = withShield ? SHIELD_DR_BONUS_PERCENT : 0;
    const st = toPct(this.SE.extraDamageReduction(side === this.player ? "player" : "enemy") * 100);
    return pct(base + sh + st);
  }
  private physDefEff(side: CombatSide, owner: Side): number {
    const base = Math.max(0, asInt(side.stats?.physicalDefense || 0));
    const mul = this.SE.physDefMul(owner);
    const bonusPct = toPct((mul - 1) * 100);
    return Math.max(0, base + Math.floor((base * bonusPct) / 100));
  }
  private magDefEff(side: CombatSide): number {
    return Math.max(0, asInt(side.stats?.magicalDefense || 0));
  }

  /* ───────── Flavor/arma ───────── */

  private weaponCategory(w?: WeaponData | null) {
    return (w?.category ?? "weapon").toString().toLowerCase();
  }
  private isRanged(side: CombatSide): boolean {
    const clsRanged = (side.className || "").toLowerCase() === "revenant";
    const slug = (side.weaponMain?.slug || "").toLowerCase();
    const cat = this.weaponCategory(side.weaponMain);
    const rangedSlug = /bow|crossbow|rifle|gun|pistol|arquebus|flintlock|handcannon/.test(slug);
    return clsRanged || rangedSlug || cat === "ranged";
  }
  private attackFlavor(side: CombatSide): DamageFlavor {
    const c = (side.className || "").toLowerCase();
    return c === "necromancer" || c === "exorcist" ? "magical" : "physical";
  }
  private elementKey(side: CombatSide, flavor: DamageFlavor): "holy" | "dark" | null {
    if (flavor !== "magical") return null;
    const cls = (side.className || "").toLowerCase();
    if (cls === "exorcist") return "holy";
    if (cls === "necromancer") return "dark";
    return null;
  }

  /* ───────── Procs (Fate + Pity) ───────── */

  private passiveChance(fate: number): number {
    return clamp(PASSIVE_BASE_CHANCE + asInt(fate) * PASSIVE_PER_FATE, 0, PASSIVE_MAX_CHANCE);
  }
  private ultimateChance(fate: number): number {
    return clamp(ULT_BASE_CHANCE + asInt(fate) * ULT_PER_FATE, 0, ULT_MAX_CHANCE);
  }

  private tryUltimate(attackerKey: SideKey, defenderKey: SideKey, events: CombatEvent[]): AttackOutput | null {
    const A = attackerKey === "player" ? this.player : this.enemy;
    const runtime = A._ultimateRuntime__!;
    const cfg = A.ultimateSkill;

    if (!cfg?.enabled || !cfg.proc?.enabled) return null;
    if (cfg.proc.respectCooldown && runtime.cooldown > 0) {
      runtime.failStreak++;
      return null;
    }
    if (this.SE.silenced(attackerKey)) {
      runtime.failStreak++;
      return null;
    }

    const fate = asInt(A.baseStats?.fate || 0);
    const chance = this.ultimateChance(fate);
    const roll = roll100(this.rng);
    let forced = false;

    if (roll > chance) {
      runtime.failStreak++;
      if (runtime.failStreak >= ULT_PITY_AFTER_FAILS) {
        forced = true;
      } else {
        return null;
      }
    }

    runtime.cooldown = Math.max(1, ULT_COOLDOWN_TURNS);
    runtime.failStreak = 0;

    events.push({ type: "ultimate_cast", actor: attackerKey, name: cfg.name, chance, roll, forcedByPity: forced });
    return this.performUltimateStrike(attackerKey, defenderKey, events, cfg.effects);
  }

  private pushPassiveEvent(who: SideKey, side: CombatSide, fate: number, event: PassiveTriggerCheck, evts: CombatEvent[]) {
    const cfg = side.passiveDefaultSkill!;
    const chance = this.passiveChance(fate);
    const roll = roll100(this.rng);
    let result: "activated" | "refreshed" | "failed" = "failed";
    let remaining: number | undefined;
    let forced = false;

    if (roll <= chance) {
      const { runtime, refreshed } = this.applyOrRefreshPassiveRuntime(side._passiveRuntime__, cfg);
      side._passiveRuntime__ = runtime;
      side._passiveFailStreak__ = 0;
      result = refreshed ? "refreshed" : "activated";
      remaining = runtime.remainingTurns;
    } else {
      side._passiveFailStreak__ = (side._passiveFailStreak__ || 0) + 1;
      if (side._passiveFailStreak__ >= PASSIVE_PITY_AFTER_FAILS) {
        const { runtime, refreshed } = this.applyOrRefreshPassiveRuntime(side._passiveRuntime__, cfg);
        side._passiveRuntime__ = runtime;
        side._passiveFailStreak__ = 0;
        result = refreshed ? "refreshed" : "activated";
        remaining = runtime.remainingTurns;
        forced = true;
      }
    }

    evts.push({
      type: "passive_proc",
      actor: who,
      name: cfg.name,
      trigger: cfg.trigger.check,
      chancePercent: chance,
      roll,
      result,
      remainingTurns: remaining,
      duration: cfg.durationTurns,
      forcedByPity: forced,
    });

    if (DEBUG_PROC) console.debug("[PASSIVE]", side.name, cfg.name, "fate=", fate, "chance=", chance, "roll=", roll, "=>", result, forced ? "(PITY)" : "");
  }

  private applyOrRefreshPassiveRuntime(current: PassiveRuntime | null | undefined, cfg: PassiveConfig) {
    const fresh: PassiveRuntime = {
      active: true,
      remainingTurns: Math.max(1, asInt(cfg.durationTurns)),
      bonusDamage: Math.max(0, asInt(cfg.bonusDamage || 0)),
      effects: {
        evasionFlat: asInt(cfg.extraEffects?.evasionFlat || 0),
        magicPowerFlat: asInt(cfg.extraEffects?.magicPowerFlat || 0),
        blockChancePercent: asInt(cfg.extraEffects?.blockChancePercent || 0),
        criticalChancePercent: asInt(cfg.extraEffects?.criticalChancePercent || 0),
      },
    };
    if (current?.active && current.remainingTurns > 0) {
      return { runtime: { ...fresh, remainingTurns: Math.max(current.remainingTurns, fresh.remainingTurns) }, refreshed: true };
    }
    return { runtime: fresh, refreshed: false };
  }

  /* ───────── Golpes ───────── */

  private performUltimateStrike(attackerKey: SideKey, defenderKey: SideKey, events: CombatEvent[], eff?: UltimateEffects): AttackOutput {
    const A = attackerKey === "player" ? this.player : this.enemy;
    const D = defenderKey === "player" ? this.player : this.enemy;

    // Evasión
    const ev = this.evasionPct(D);
    if (roll100(this.rng) <= ev) {
      events.push({ type: "miss", actor: attackerKey });
      return { damage: 0, flags: { miss: true } };
    }

    // Block
    const defHasShield = this.weaponCategory(D.weaponOff) === "shield";
    const blockChance = this.blockPct(D, defHasShield);
    const blocked = roll100(this.rng) <= blockChance;
    const blockReducedPercent = blocked ? BLOCK_REDUCTION_PERCENT : 0;

    // Sin crítico (ulti ya es masiva)
    const flavor = this.attackFlavor(A);

    // Stat base fuerte
    const baseStat = flavor === "magical" ? this.magicPower(A, true) : this.attackPower(A);
    const w = A.weaponMain;
    const weaponAvg = w ? Math.floor((asInt((w as any).minDamage || 0) + asInt((w as any).maxDamage || 0)) / 2) : 1;

    // Daño crudo de ulti
    let raw = baseStat * ULT_DAMAGE_MAIN_MULT + weaponAvg * ULT_DAMAGE_WEAPON_PART + ULT_EXTRA_FLAT;

    // Defensa
    const physDef = this.physDefEff(D, defenderKey);
    const magDef = this.magDefEff(D);
    const def = flavor === "magical" ? magDef : physDef;
    const defDRPercent = def > 0 ? Math.floor((def * 100) / (def + (flavor === "magical" ? MAG_DEF_SOFTCAP : PHYS_DEF_SOFTCAP))) : 0;
    raw = Math.floor((raw * (100 - defDRPercent)) / 100);

    // Resistencia elemental
    const elemKey = this.elementKey(A, flavor);
    const elemRes = elemKey ? pct(D.resistances?.[elemKey] || 0) : 0;
    if (elemRes > 0) raw = Math.floor((raw * (100 - elemRes)) / 100);

    // Block
    const preBlock = raw;
    if (blockReducedPercent > 0) raw = Math.floor((raw * (100 - blockReducedPercent)) / 100);
    const blockedAmount = Math.max(0, preBlock - raw);

    // DR plana + escudo + estados
    const dr = this.drPct(D, defHasShield);
    raw = Math.floor((raw * (100 - dr)) / 100);

    const final = Math.max(0, asInt(raw));

    D.currentHP = Math.max(0, D.currentHP - final);
    if (final > 0) this.SE.wakeIfDamaged(defenderKey);

    events.push({
      type: "hit",
      actor: attackerKey,
      flavor,
      vfx: "ultimate-hit",
      damage: {
        final,
        breakdown: {
          mainRoll: 0,
          offRoll: 0,
          baseStat,
          passiveBonus: 0,
          defenseFactor: 100 - defDRPercent,
          elementFactor: elemKey ? 100 - elemRes : undefined,
          critBonusPercent: 0,
          blockReducedPercent,
          drReducedPercent: dr,
          preBlock,
          blockedAmount,
          ultimateDamage: baseStat * ULT_DAMAGE_MAIN_MULT,
        },
      },
    });

    // Debuffs de ulti
    if (eff?.applyDebuff) {
      const dur = Math.max(1, asInt(eff.debuffDurationTurns ?? STATUS_CATALOG[eff.applyDebuff]?.baseDuration ?? 1));
      const val = Math.max(0, asInt(eff.debuffValue ?? 0));
      const dot = eff.applyDebuff === "bleed" ? Math.max(0, asInt(eff.bleedDamagePerTurn ?? 0)) : undefined;

      this.SE.tryApply({
        to: defenderKey,
        key: eff.applyDebuff,
        duration: dur,
        stacks: 1,
        value: eff.applyDebuff === "bleed" ? undefined : val,
        dotDamage: dot,
        baseChance: 100,
        source: attackerKey,
        pushEvent: () => {},
      });
    }

    return { damage: final, flags: { miss: false, blocked, crit: false } };
  }

  private performBasicStrike(attackerKey: SideKey, defenderKey: SideKey, events: CombatEvent[]): AttackOutput {
    const A = attackerKey === "player" ? this.player : this.enemy;
    const D = defenderKey === "player" ? this.player : this.enemy;

    const flavor = this.attackFlavor(A);

    if (this.SE.confusionMiss(attackerKey)) {
      events.push({ type: "miss", actor: attackerKey });
      return { damage: 0, flags: { miss: true } };
    }

    // Evasión
    const ev = this.evasionPct(D);
    if (roll100(this.rng) <= ev) {
      events.push({ type: "miss", actor: defenderKey });
      return { damage: 0, flags: { miss: true } };
    }

    // Block
    const defHasShield = this.weaponCategory(D.weaponOff) === "shield";
    const blockChance = this.blockPct(D, defHasShield);
    const blocked = roll100(this.rng) <= blockChance;
    const blockReducedPercent = blocked ? BLOCK_REDUCTION_PERCENT : 0;
    if (blocked) events.push({ type: "block", actor: defenderKey });

    // Crítico
    const critChance = this.critPct(A);
    const isCrit = roll100(this.rng) <= critChance;
    if (isCrit) events.push({ type: "crit", actor: attackerKey });

    // Rolls de arma
    const mainRoll = this.rollWeapon(A.weaponMain, isPrimaryWeapon(A.weaponMain, A.classMeta?.primaryWeapons));
    const offRollPart = this.rollOffhand(A.weaponOff);

    // Stat base
    const baseStat = flavor === "magical" ? this.magicPower(A, true) : this.attackPower(A);

    // Bonus pasiva (si activa y coincide flavor)
    let passiveBonus = 0;
    if (A._passiveRuntime__?.active && A._passiveRuntime__?.remainingTurns > 0) {
      if (A.passiveDefaultSkill?.damageType === flavor) passiveBonus = Math.max(0, asInt(A._passiveRuntime__?.bonusDamage || 0));
    }

    // Suma base
    let dmg = mainRoll + offRollPart + baseStat + passiveBonus;

    // Defensa
    const physDef = this.physDefEff(D, defenderKey);
    const magDef = this.magDefEff(D);
    const def = flavor === "magical" ? magDef : physDef;
    const defDRPercent = def > 0 ? Math.floor((def * 100) / (def + (flavor === "magical" ? MAG_DEF_SOFTCAP : PHYS_DEF_SOFTCAP))) : 0;
    dmg = Math.floor((dmg * (100 - defDRPercent)) / 100);

    // Resistencia elemental
    const elemKey = this.elementKey(A, flavor);
    const elemRes = elemKey ? pct(D.resistances?.[elemKey] || 0) : 0;
    if (elemRes > 0) dmg = Math.floor((dmg * (100 - elemRes)) / 100);

    // Crítico
    let critBonusPercent = 0;
    if (isCrit) {
      critBonusPercent = this.critBonusPct(A);
      dmg = Math.floor((dmg * (100 + critBonusPercent)) / 100);
    }

    // Block
    const preBlock = dmg;
    if (blockReducedPercent > 0) dmg = Math.floor((dmg * (100 - blockReducedPercent)) / 100);
    const blockedAmount = Math.max(0, preBlock - dmg);

    // DR plana + escudo + estados
    const dr = this.drPct(D, defHasShield);
    dmg = Math.floor((dmg * (100 - dr)) / 100);

    const final = Math.max(0, asInt(dmg));
    D.currentHP = Math.max(0, D.currentHP - final);
    if (final > 0) this.SE.wakeIfDamaged(defenderKey);

    events.push({
      type: "hit",
      actor: attackerKey,
      flavor,
      vfx: isCrit ? "basic-crit" : "basic-hit",
      damage: {
        final: final,
        breakdown: {
          mainRoll,
          offRoll: offRollPart,
          baseStat,
          passiveBonus,
          defenseFactor: 100 - defDRPercent,
          elementFactor: elemKey ? 100 - elemRes : undefined,
          critBonusPercent,
          blockReducedPercent,
          drReducedPercent: dr,
          preBlock,
          blockedAmount,
        },
      },
    });

    // Intentos de pasiva
    const fateA = asInt(A.baseStats?.fate || 0);
    const fateD = asInt(D.baseStats?.fate || 0);

    if (A.passiveDefaultSkill?.enabled) {
      const t = A.passiveDefaultSkill.trigger.check;
      if ((flavor === "magical" && t === "onSpellCast") || (flavor === "physical" && t === "onBasicHit") || (this.isRanged(A) && t === "onRangedHit") || t === "onHitOrBeingHit") {
        this.pushPassiveEvent(attackerKey, A, fateA, t, events);
      }
    }
    if (D.passiveDefaultSkill?.enabled && D.passiveDefaultSkill.trigger.check === "onHitOrBeingHit") {
      this.pushPassiveEvent(defenderKey, D, fateD, "onHitOrBeingHit", events);
    }

    // Tick pasivas al final de la ronda par
    if (attackerKey === "enemy") {
      this.player._passiveRuntime__ = this.tickPassive(this.player._passiveRuntime__);
      this.enemy._passiveRuntime__ = this.tickPassive(this.enemy._passiveRuntime__);
    }

    return { damage: final, flags: { miss: false, blocked, crit: isCrit } };
  }

  private tickPassive(run?: PassiveRuntime | null): PassiveRuntime | null {
    if (!run?.active) return run ?? null;
    const left = (run.remainingTurns ?? 0) - 1;
    return left <= 0 ? null : { ...run, remainingTurns: left };
  }

  /* ───────── Rolls de arma ───────── */

  private rollWeapon(w?: WeaponData | null, primary: boolean = false): number {
    if (!w) return 0;
    const lo = Math.max(0, asInt((w as any).minDamage || 0));
    const hi = Math.max(lo, asInt((w as any).maxDamage || 0));
    const base = hi <= lo ? lo : lo + asInt(this.rng() * (hi - lo + 1));
    const mult = primary ? PRIMARY_WEAPON_BONUS_MULT : 1;
    return Math.floor(base * mult);
  }
  private rollOffhand(off?: WeaponData | null): number {
    if (!off) return 0;
    const cat = this.weaponCategory(off);
    const lo = Math.max(0, asInt((off as any).minDamage || 0));
    const hi = Math.max(lo, asInt((off as any).maxDamage || 0));
    const base = hi <= lo ? lo : lo + asInt(this.rng() * (hi - lo + 1));
    if (cat === "weapon") return Math.floor((base * OFFHAND_WEAPON_CONTRIB_PERCENT) / 100);
    if (cat === "focus") return Math.floor((base * OFFHAND_FOCUS_CONTRIB_PERCENT) / 100);
    return 0;
  }
}

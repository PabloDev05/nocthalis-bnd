import type { WeaponData } from "./Weapon";

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

export interface PassiveRuntime {
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

export interface UltimateRuntime {
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

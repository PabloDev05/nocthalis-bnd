// src/interfaces/character/CharacterClass.interface.ts
// Canonical types for characters, classes and combat blocks.
// Clean version aligned to the new design (Fate-driven procs, class weapon
// families, passiveDefaultSkill & ultimateSkill). No deprecated fields.

import type { StatusKey } from "../../battleSystem/constants/status";

/* ──────────────────────────────────────────────────────────────────────────
 * Core numeric blocks
 * ────────────────────────────────────────────────────────────────────────── */

export type BaseStats = {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number; // crit-related
  endurance: number;
  fate: number; // NEW: proc driver for passives/ultimates
};

export type CombatStats = {
  maxHP: number;
  attackPower: number;
  magicPower: number;

  // Percent-like values can be 0..100 or 0..1. Engine normalizes as needed.
  criticalChance: number;
  criticalDamageBonus: number;
  attackSpeed: number;
  evasion: number;
  blockChance: number;
  blockValue: number;
  lifeSteal: number;
  damageReduction: number;
  movementSpeed: number;
};

export type Resistances = Record<
  | "fire"
  | "ice"
  | "lightning"
  | "poison"
  | "sleep"
  | "paralysis"
  | "confusion"
  | "fear"
  | "dark"
  | "holy"
  | "stun"
  | "bleed"
  | "curse"
  | "knockback"
  | "criticalChanceReduction"
  | "criticalDamageReduction",
  number
>;

/* ──────────────────────────────────────────────────────────────────────────
 * Fate-driven proc triggers
 * ────────────────────────────────────────────────────────────────────────── */

export type ProcTriggerCheck = "onBasicHit" | "onRangedHit" | "onSpellCast" | "onHitOrBeingHit" | "onTurnStart";

export interface ProcTrigger {
  check: ProcTriggerCheck;
  scaleBy: "fate";
  baseChancePercent: number; // e.g. 7 => 7%
  fateScalePerPoint: number; // e.g. 1 => +1% per Fate
  maxChancePercent: number; // hard cap
}

/* ──────────────────────────────────────────────────────────────────────────
 * Passive default skill (class innate, Fate-gated)
 * ────────────────────────────────────────────────────────────────────────── */

export interface PassiveDefaultSkill {
  enabled: boolean;
  name: string;
  damageType: "physical" | "magical";
  shortDescEn?: string;
  longDescEn?: string;

  trigger: ProcTrigger; // when & how it tries to proc
  durationTurns: number; // refresh on re-apply

  // Optional additive effects while active
  bonusDamage?: number;
  extraEffects?: Record<string, number>; // e.g. { evasionFlat: 2, magicPowerFlat: 3 }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Ultimate skill (cooldowned, can auto-proc via Fate)
 * ────────────────────────────────────────────────────────────────────────── */

export interface UltimateSkill {
  enabled: boolean;
  name: string;
  description?: string;
  cooldownTurns: number;
  effects: {
    bonusDamagePercent?: number;
    applyDebuff?: StatusKey;
    debuffValue?: number;
    bleedDamagePerTurn?: number;
    debuffDurationTurns?: number;
  };
  proc?: {
    enabled: boolean;
    procInfoEn?: string;
    respectCooldown?: boolean;
    trigger: ProcTrigger; // typically onTurnStart, Fate-gated
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Subclasses and passive list (UI metadata)
 * ────────────────────────────────────────────────────────────────────────── */

export type Passive = {
  name: string;
  description: string;
  detail?: string;
};

export type Subclass = {
  _id?: any;
  id?: any;
  name: string;
  slug: string;
  iconName: string;
  imageSubclassUrl?: string;
  passives: Passive[];
};

/* ──────────────────────────────────────────────────────────────────────────
 * CharacterClass (seed-driven, weapon families included)
 * ────────────────────────────────────────────────────────────────────────── */

export interface CharacterClass {
  _id?: any;

  name: string;
  description: string;
  iconName: string;
  imageMainClassUrl: string;

  // Weapon families (primary => +10% damage bonus if used)
  primaryWeapons: string[];
  secondaryWeapons: string[];
  defaultWeapon: string;
  allowedWeapons: string[];

  baseStats: BaseStats; // includes new 'fate'
  resistances: Resistances;
  combatStats: CombatStats;

  passiveDefaultSkill?: PassiveDefaultSkill | null;
  ultimateSkill?: UltimateSkill | null;

  subclasses: Subclass[];
  affinities?: string[];
  talents?: string[];
}

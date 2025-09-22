// src/interfaces/character/CharacterClass.interface.ts
// Canonical types for characters, classes and combat blocks.
// Clean version aligned to the new design:
// - Integers only (0..100 where applicable).
// - Fate-driven procs (class passive & optional ultimate auto-proc).
// - constitution instead of vitality.
// - Subclass passives = UI metadata only (sin trigger/efectos en este nivel).

import type { StatusKey } from "../../battleSystem/constants/status";

/* ──────────────────────────────────────────────────────────────────────────
 * Core numeric blocks (ENTEROS)
 * ────────────────────────────────────────────────────────────────────────── */

export type BaseStats = {
  strength: number;         // int
  dexterity: number;        // int
  intelligence: number;     // int
  constitution: number;     // int  → contribuye a maxHP vía allocateCoeffs
  physicalDefense: number;  // int (plano)
  magicalDefense: number;   // int (plano)
  luck: number;             // int (crit-related si lo deseas)
  endurance: number;        // int (DR, block, etc. vía allocateCoeffs)
  fate: number;             // int (driver para procs; no modifica combate directo)
};

export type CombatStats = {
  maxHP: number;            // int
  attackPower: number;      // int
  magicPower: number;       // int

  // Valores “tipo porcentaje”: SIEMPRE enteros 0..100. El motor los clamp/capea.
  criticalChance: number;       // 0..100
  criticalDamageBonus: number;  // 0..100 (ej. 35 = +35%)
  attackSpeed: number;          // 0..100 (uso interno como “celeridad”)
  evasion: number;              // 0..100
  blockChance: number;          // 0..100
  blockValue: number;           // int (valor plano de bloqueo)
  lifeSteal: number;            // 0..100
  damageReduction: number;      // 0..100
  movementSpeed: number;        // 0..100
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
  number // enteros 0..100 (cap en lógica de negocio)
>;

/* ──────────────────────────────────────────────────────────────────────────
 * Fate-driven proc triggers (SOLO para passiveDefaultSkill y ultimate.proc)
 * ────────────────────────────────────────────────────────────────────────── */

export type ProcTriggerCheck =
  | "onBasicHit"
  | "onRangedHit"
  | "onSpellCast"
  | "onHitOrBeingHit"
  | "onTurnStart";

export interface ProcTrigger {
  check: ProcTriggerCheck;
  scaleBy: "fate";           // estandarizamos: Fate impulsa las chances
  baseChancePercent: number; // int, ej. 7 => 7%
  fateScalePerPoint: number; // int, ej. 1 => +1% por punto de Fate
  maxChancePercent: number;  // int, límite duro 0..100
}

/* ──────────────────────────────────────────────────────────────────────────
 * Passive default skill (class innate, Fate-gated)
 * ────────────────────────────────────────────────────────────────────────── */

export interface PassiveDefaultSkill {
  enabled: boolean;
  name: string;
  damageType: "physical" | "magical"; // tipo de daño asociado a su bonus
  shortDescEn?: string;
  longDescEn?: string;

  trigger: ProcTrigger;   // cuándo y cómo intenta procar (Fate-gated)
  durationTurns: number;  // int, refresca si reaplica

  // Efectos aditivos mientras está activa (enteros)
  bonusDamage?: number;                     // int plano al daño base del golpe/hechizo
  extraEffects?: Record<string, number>;    // ej: { evasionFlat: 2, magicPowerFlat: 3 }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Ultimate skill (con cooldown; puede auto-procar por Fate)
 * ────────────────────────────────────────────────────────────────────────── */

export interface UltimateSkill {
  enabled: boolean;
  name: string;
  description?: string;
  cooldownTurns: number; // int ≥ 1
  effects: {
    bonusDamagePercent?: number;      // int 0..100 (se aplica al daño base)
    applyDebuff?: StatusKey;          // key del estado
    debuffValue?: number;             // int (signo a criterio del estado)
    bleedDamagePerTurn?: number;      // int plano por turno (si aplica)
    debuffDurationTurns?: number;     // int ≥ 1
  };
  proc?: {
    enabled: boolean;
    procInfoEn?: string;              // texto de ayuda para UI
    respectCooldown?: boolean;        // default true
    trigger: ProcTrigger;             // típicamente onTurnStart (Fate-gated)
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Subclasses y pasivas (SOLO metadatos para UI)
 * ────────────────────────────────────────────────────────────────────────── */

export type Passive = {
  name: string;
  description: string;
  detail?: string;
  // ⛔ Sin trigger ni efectos aquí: el motor no los usa en este nivel.
};

export type Subclass = {
  _id?: any;
  id?: any;
  name: string;
  slug: string;
  iconName: string;
  imageSubclassUrl?: string;
  passives: Passive[]; // UI flavor / futuras reglas si decides luego
};

/* ──────────────────────────────────────────────────────────────────────────
 * CharacterClass (seed-driven, incluye familias de armas)
 * ────────────────────────────────────────────────────────────────────────── */

export interface CharacterClass {
  _id?: any;

  name: string;
  description: string;
  iconName: string;
  imageMainClassUrl: string;

  // Familias de armas (primary → bonus de clase en cálculo de arma)
  primaryWeapons: string[];
  secondaryWeapons: string[];
  defaultWeapon: string;
  allowedWeapons: string[];

  baseStats: BaseStats;        // incluye 'constitution' y 'fate'
  resistances: Resistances;    // enteros 0..100
  combatStats: CombatStats;    // enteros

  passiveDefaultSkill?: PassiveDefaultSkill | null;
  ultimateSkill?: UltimateSkill | null;

  subclasses: Subclass[];
  affinities?: string[];
  talents?: string[];
}

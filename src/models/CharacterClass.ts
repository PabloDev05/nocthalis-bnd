// src/models/CharacterClass.ts
import mongoose, { Schema, model, type Document, type Model, Types } from "mongoose";

/* ========================================================================== *
 * Helpers enteros
 * ========================================================================== */
const I0 = (v: any) => Math.max(0, Math.trunc(Number(v) || 0));

/* ========================================================================== *
 * Trigger checks centralizados (mantener en sync con tu seed)
 * ========================================================================== */
export const TRIGGER_CHECKS = [
  "onBasicHit",
  "onRangedHit",
  "onSpellCast",
  "onHitOrBeingHit",
  "onTurnStart",
  "onUltimateCast",
  "onBlock",
  "onDodge",
  "onKill",
  // usados por subclases/seed:
  "onHit",
  "onCrit",
  "onBattleStart",
  "alwaysOn",
  "onFirstHit",
] as const;
export type TriggerCheck = (typeof TRIGGER_CHECKS)[number];

/* ========================================================================== *
 * Tipos locales
 * ========================================================================== */
export type BaseStats = {
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number;
  endurance: number;
  fate: number;
};

export type CombatStats = {
  maxHP: number;
  attackPower: number;
  magicPower: number;

  criticalChance: number;
  criticalDamageBonus: number;
  evasion: number;
  blockChance: number;
  blockValue: number;
  lifeSteal: number;
  damageReduction: number;
  movementSpeed: number;
};

export type Resistances = {
  fire: number;
  ice: number;
  lightning: number;
  poison: number;
  sleep: number;
  paralysis: number;
  confusion: number;
  fear: number;
  dark: number;
  holy: number;
  stun: number;
  bleed: number;
  curse: number;
  knockback: number;
  criticalChanceReduction: number;
  criticalDamageReduction: number;
};

export type ProcTrigger = {
  check: TriggerCheck;
  scaleBy: "fate";
  baseChancePercent: number;
  fateScalePerPoint: number;
  maxChancePercent: number;
};

export type PassiveDefaultSkill = {
  enabled?: boolean;
  name: string;
  damageType: "physical" | "magical";
  shortDescEn?: string;
  longDescEn?: string;
  trigger: ProcTrigger;
  durationTurns: number;
  bonusDamage?: number;
  extraEffects?: Record<string, number>;
};

export type UltimateSkill = {
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
    procInfoEn?: string;
    trigger?: ProcTrigger;
  };
};

export type SubclassPassive = {
  name: string;
  description: string;
  detail?: string;
  trigger?: ProcTrigger;
  effects?: Record<string, number | string>;
  durationTurns?: number;
  cooldownTurns?: number;
};

export type Subclass = {
  name: string;
  slug: string;
  iconName: string;
  imageSubclassUrl?: string;
  passives: SubclassPassive[];
};

export interface CharacterClassDoc extends Document<Types.ObjectId> {
  name: string;
  description: string;
  iconName: string;
  imageMainClassUrl: string;

  primaryWeapons: string[];
  secondaryWeapons: string[];
  defaultWeapon: string;
  allowedWeapons: string[];

  baseStats: BaseStats;
  resistances: Resistances;
  combatStats: CombatStats;

  passiveDefaultSkill?: PassiveDefaultSkill | null;
  ultimateSkill?: UltimateSkill | null;

  subclasses: Subclass[];
  affinities: string[];
  talents: string[];

  createdAt: Date;
  updatedAt: Date;
  id: string;
}
export interface CharacterClassModel extends Model<CharacterClassDoc> {}

/* ========================================================================== *
 * Sub-schemas Mongoose
 * ========================================================================== */
const BaseStatsSchema = new Schema<BaseStats>(
  {
    strength: { type: Number, required: true, default: 0, set: I0 },
    dexterity: { type: Number, required: true, default: 0, set: I0 },
    intelligence: { type: Number, required: true, default: 0, set: I0 },
    constitution: { type: Number, required: true, default: 0, set: I0 },
    physicalDefense: { type: Number, required: true, default: 0, set: I0 },
    magicalDefense: { type: Number, required: true, default: 0, set: I0 },
    luck: { type: Number, required: true, default: 0, set: I0 },
    endurance: { type: Number, required: true, default: 0, set: I0 },
    fate: { type: Number, required: true, default: 0, set: I0 },
  },
  { _id: false }
);

const CombatStatsSchema = new Schema<CombatStats>(
  {
    maxHP: { type: Number, required: true, default: 1, set: I0 },
    attackPower: { type: Number, required: true, default: 0, set: I0 },
    magicPower: { type: Number, required: true, default: 0, set: I0 },

    criticalChance: { type: Number, required: true, default: 0, set: I0 },
    criticalDamageBonus: { type: Number, required: true, default: 0, set: I0 },
    evasion: { type: Number, required: true, default: 0, set: I0 },
    blockChance: { type: Number, required: true, default: 0, set: I0 },
    blockValue: { type: Number, required: true, default: 0, set: I0 },
    lifeSteal: { type: Number, required: true, default: 0, set: I0 },
    damageReduction: { type: Number, required: true, default: 0, set: I0 },
    movementSpeed: { type: Number, required: true, default: 0, set: I0 },
  },
  { _id: false }
);

const ResistancesSchema = new Schema<Resistances>(
  {
    fire: { type: Number, required: true, default: 0, set: I0 },
    ice: { type: Number, required: true, default: 0, set: I0 },
    lightning: { type: Number, required: true, default: 0, set: I0 },
    poison: { type: Number, required: true, default: 0, set: I0 },
    sleep: { type: Number, required: true, default: 0, set: I0 },
    paralysis: { type: Number, required: true, default: 0, set: I0 },
    confusion: { type: Number, required: true, default: 0, set: I0 },
    fear: { type: Number, required: true, default: 0, set: I0 },
    dark: { type: Number, required: true, default: 0, set: I0 },
    holy: { type: Number, required: true, default: 0, set: I0 },
    stun: { type: Number, required: true, default: 0, set: I0 },
    bleed: { type: Number, required: true, default: 0, set: I0 },
    curse: { type: Number, required: true, default: 0, set: I0 },
    knockback: { type: Number, required: true, default: 0, set: I0 },
    criticalChanceReduction: { type: Number, required: true, default: 0, set: I0 },
    criticalDamageReduction: { type: Number, required: true, default: 0, set: I0 },
  },
  { _id: false }
);

const ProcTriggerSchema = new Schema<ProcTrigger>(
  {
    check: { type: String, required: true, enum: TRIGGER_CHECKS },
    scaleBy: { type: String, required: true, enum: ["fate"], default: "fate" },
    baseChancePercent: { type: Number, required: true, default: 0, set: I0 },
    fateScalePerPoint: { type: Number, required: true, default: 0, set: I0 },
    maxChancePercent: { type: Number, required: true, default: 100, set: I0 },
  },
  { _id: false }
);

const PassiveDefaultSkillSchema = new Schema<PassiveDefaultSkill>(
  {
    enabled: { type: Boolean, default: true },
    name: { type: String, required: true },
    damageType: { type: String, required: true, enum: ["physical", "magical"] },
    shortDescEn: { type: String },
    longDescEn: { type: String },
    trigger: { type: ProcTriggerSchema, required: true },
    durationTurns: { type: Number, required: true, default: 2, set: I0 },
    bonusDamage: { type: Number, default: 0, set: I0 },
    extraEffects: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const UltimateSkillSchema = new Schema<UltimateSkill>(
  {
    enabled: { type: Boolean, default: true },
    name: { type: String, required: true },
    description: { type: String },
    cooldownTurns: { type: Number, required: true, default: 6, set: I0 },
    effects: {
      bonusDamagePercent: { type: Number, default: 0, set: I0 },
      applyDebuff: { type: String },
      debuffValue: { type: Number, set: I0 },
      bleedDamagePerTurn: { type: Number, set: I0 },
      debuffDurationTurns: { type: Number, set: I0 },
    },
    proc: {
      enabled: { type: Boolean, default: false },
      procInfoEn: { type: String },
      respectCooldown: { type: Boolean, default: true },
      trigger: { type: ProcTriggerSchema },
    },
  },
  { _id: false }
);

const SubclassPassiveSchema = new Schema<SubclassPassive>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    detail: { type: String },
    trigger: { type: ProcTriggerSchema, required: false },
    effects: { type: Schema.Types.Mixed, default: {} },
    durationTurns: { type: Number, set: I0 },
    cooldownTurns: { type: Number, set: I0 },
  },
  { _id: false }
);

const SubclassSchema = new Schema<Subclass>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    iconName: { type: String, required: true },
    imageSubclassUrl: { type: String },
    passives: { type: [SubclassPassiveSchema], default: [] },
  },
  { _id: true }
);

/* ========================================================================== *
 * Esquema principal CharacterClass
 * ========================================================================== */
const CharacterClassSchema = new Schema<CharacterClassDoc>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    iconName: { type: String, required: true },
    imageMainClassUrl: { type: String, required: true },

    primaryWeapons: { type: [String], required: true, default: [] },
    secondaryWeapons: { type: [String], required: true, default: [] },
    defaultWeapon: { type: String, required: true },
    allowedWeapons: { type: [String], required: true, default: [] },

    baseStats: { type: BaseStatsSchema, required: true },
    resistances: { type: ResistancesSchema, required: true },
    combatStats: { type: CombatStatsSchema, required: true },

    passiveDefaultSkill: { type: PassiveDefaultSkillSchema, default: null },
    ultimateSkill: { type: UltimateSkillSchema, default: null },

    subclasses: { type: [SubclassSchema], default: [] },
    affinities: { type: [String], default: [] },
    talents: { type: [String], default: [] },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        (ret as any).id = String(ret._id);
        delete (ret as any)._id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/* Índices */
CharacterClassSchema.index({ name: 1 }, { unique: true });
CharacterClassSchema.index({ "subclasses.slug": 1 });

export const CharacterClass = (mongoose.models.CharacterClass as CharacterClassModel) || model<CharacterClassDoc, CharacterClassModel>("CharacterClass", CharacterClassSchema);

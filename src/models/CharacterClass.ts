// src/models/CharacterClass.ts
// Mongoose model aligned with the new Fate-driven design.
// Clean, minimal, and ready to ingest your seedCharacterClasses verbatim.

import mongoose, { Schema, model, type Document, type Model, Types } from "mongoose";
import type { CharacterClass as CharacterClassDTO, BaseStats, CombatStats, Resistances, PassiveDefaultSkill, UltimateSkill, Subclass } from "../interfaces/character/CharacterClass.interface";

/* ──────────────────────────────────────────────────────────────────────────
 * Sub-schemas (pure POJOs, numeric only where applicable)
 * ────────────────────────────────────────────────────────────────────────── */

const BaseStatsSchema = new Schema<BaseStats>(
  {
    strength: { type: Number, required: true, default: 0 },
    dexterity: { type: Number, required: true, default: 0 },
    intelligence: { type: Number, required: true, default: 0 },
    vitality: { type: Number, required: true, default: 0 },
    physicalDefense: { type: Number, required: true, default: 0 },
    magicalDefense: { type: Number, required: true, default: 0 },
    luck: { type: Number, required: true, default: 0 },
    endurance: { type: Number, required: true, default: 0 },
    fate: { type: Number, required: true, default: 0 }, // NEW
  },
  { _id: false }
);

const CombatStatsSchema = new Schema<CombatStats>(
  {
    maxHP: { type: Number, required: true, default: 1 },
    attackPower: { type: Number, required: true, default: 0 },
    magicPower: { type: Number, required: true, default: 0 },

    criticalChance: { type: Number, required: true, default: 0 },
    criticalDamageBonus: { type: Number, required: true, default: 0 },
    attackSpeed: { type: Number, required: true, default: 0 },
    evasion: { type: Number, required: true, default: 0 },
    blockChance: { type: Number, required: true, default: 0 },
    blockValue: { type: Number, required: true, default: 0 },
    lifeSteal: { type: Number, required: true, default: 0 },
    damageReduction: { type: Number, required: true, default: 0 },
    movementSpeed: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const ResistancesSchema = new Schema<Resistances>(
  {
    fire: { type: Number, required: true, default: 0 },
    ice: { type: Number, required: true, default: 0 },
    lightning: { type: Number, required: true, default: 0 },
    poison: { type: Number, required: true, default: 0 },
    sleep: { type: Number, required: true, default: 0 },
    paralysis: { type: Number, required: true, default: 0 },
    confusion: { type: Number, required: true, default: 0 },
    fear: { type: Number, required: true, default: 0 },
    dark: { type: Number, required: true, default: 0 },
    holy: { type: Number, required: true, default: 0 },
    stun: { type: Number, required: true, default: 0 },
    bleed: { type: Number, required: true, default: 0 },
    curse: { type: Number, required: true, default: 0 },
    knockback: { type: Number, required: true, default: 0 },
    criticalChanceReduction: { type: Number, required: true, default: 0 },
    criticalDamageReduction: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const ProcTriggerSchema = new Schema<PassiveDefaultSkill["trigger"]>(
  {
    check: { type: String, required: true, enum: ["onBasicHit", "onRangedHit", "onSpellCast", "onHitOrBeingHit", "onTurnStart"] },
    scaleBy: { type: String, required: true, enum: ["fate"], default: "fate" },
    baseChancePercent: { type: Number, required: true, default: 0 },
    fateScalePerPoint: { type: Number, required: true, default: 0 },
    maxChancePercent: { type: Number, required: true, default: 100 },
  },
  { _id: false }
);

const PassiveDefaultSkillSchema = new Schema<PassiveDefaultSkill>(
  {
    enabled: { type: Boolean, required: true, default: true },
    name: { type: String, required: true },
    damageType: { type: String, required: true, enum: ["physical", "magical"] },
    shortDescEn: { type: String },
    longDescEn: { type: String },
    trigger: { type: ProcTriggerSchema, required: true },
    durationTurns: { type: Number, required: true, default: 2 },
    bonusDamage: { type: Number, default: 0 },
    extraEffects: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const UltimateSkillSchema = new Schema<UltimateSkill>(
  {
    enabled: { type: Boolean, required: true, default: true },
    name: { type: String, required: true },
    description: { type: String },
    cooldownTurns: { type: Number, required: true, default: 6 },
    effects: {
      bonusDamagePercent: { type: Number, default: 0 },
      applyDebuff: { type: String },
      debuffValue: { type: Number },
      bleedDamagePerTurn: { type: Number },
      debuffDurationTurns: { type: Number },
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

const PassiveSchema = new Schema<Subclass["passives"][number]>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    detail: { type: String },
  },
  { _id: false }
);

const SubclassSchema = new Schema<Subclass>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    iconName: { type: String, required: true },
    imageSubclassUrl: { type: String },
    passives: { type: [PassiveSchema], default: [] },
  },
  { _id: true }
);

/* ──────────────────────────────────────────────────────────────────────────
 * CharacterClass schema
 * ────────────────────────────────────────────────────────────────────────── */

export interface CharacterClassDoc extends Omit<CharacterClassDTO, "_id">, Document<Types.ObjectId> {}
export interface CharacterClassModel extends Model<CharacterClassDoc> {}

const CharacterClassSchema = new Schema<CharacterClassDoc>(
  {
    // ✅ SIN index aquí (para evitar duplicados); los definimos más abajo
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
        ret.id = String(ret._id);
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

/* Índices — SOLO acá para no duplicar */
CharacterClassSchema.index({ name: 1 }, { unique: true });
CharacterClassSchema.index({ "subclasses.slug": 1 });

export const CharacterClass = (mongoose.models.CharacterClass as CharacterClassModel) || model<CharacterClassDoc, CharacterClassModel>("CharacterClass", CharacterClassSchema);

import { Schema, model, Types, Document } from "mongoose";

/* ───────── Stats (enteros) ───────── */
const StatsSchema = new Schema(
  {
    strength:        { type: Number, default: 0 },
    dexterity:       { type: Number, default: 0 },
    intelligence:    { type: Number, default: 0 },
    constitution:    { type: Number, default: 0 },
    endurance:       { type: Number, default: 0 },
    luck:            { type: Number, default: 0 },
    fate:            { type: Number, default: 0 },
    physicalDefense: { type: Number, default: 0 },
    magicalDefense:  { type: Number, default: 0 },
  },
  { _id: false }
);

/* ───────── Resistencias (enteros 0..100) ───────── */
const ResistSchema = new Schema(
  {
    fire:  { type: Number, default: 0 },
    ice:   { type: Number, default: 0 },
    lightning: { type: Number, default: 0 },
    poison: { type: Number, default: 0 },
    sleep: { type: Number, default: 0 },
    paralysis: { type: Number, default: 0 },
    confusion: { type: Number, default: 0 },
    fear: { type: Number, default: 0 },
    dark: { type: Number, default: 0 },
    holy: { type: Number, default: 0 },
    stun: { type: Number, default: 0 },
    bleed: { type: Number, default: 0 },
    curse: { type: Number, default: 0 },
    knockback: { type: Number, default: 0 },
    criticalChanceReduction: { type: Number, default: 0 },
    criticalDamageReduction: { type: Number, default: 0 },
  },
  { _id: false }
);

/* ───────── Combat (flexible) ───────── */
const CombatSchema = new Schema({}, { _id: false, strict: false });

export interface CharacterDoc extends Document {
  userId: Types.ObjectId | string;
  classId: Types.ObjectId | string;
  subclassId?: Types.ObjectId | string | null;

  level: number;
  experience: number;

  stats: any;
  resistances: any;
  combatStats: any;

  maxHP?: number;
  currentHP?: number;

  stamina?: number;
  staminaMax?: number;
  staminaUpdatedAt?: Date | null;
  staminaRegenPerHour?: number;

  equipment: Record<string, string | null>;
  inventory: string[];

  createdAt: Date;
  updatedAt: Date;
}

const CharacterSchema = new Schema<CharacterDoc>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    classId:   { type: Schema.Types.ObjectId, ref: "CharacterClass", required: true },
    subclassId:{ type: Schema.Types.ObjectId, ref: "CharacterClass", default: null },

    level:      { type: Number, default: 1, min: 1 },
    experience: { type: Number, default: 0, min: 0 },

    stats:        { type: StatsSchema, default: () => ({}) },
    resistances:  { type: ResistSchema, default: () => ({}) },
    combatStats:  { type: CombatSchema, default: () => ({}) },

    maxHP:     { type: Number, default: 0, min: 0 },
    currentHP: { type: Number, default: 0, min: 0 },

    stamina:            { type: Number, default: 100, min: 0 },
    staminaMax:         { type: Number, default: 100, min: 1 },
    staminaUpdatedAt:   { type: Date,   default: () => new Date() },
    staminaRegenPerHour:{ type: Number, default: 0 },

    equipment: { type: Schema.Types.Mixed, default: () => ({}) },
    inventory: { type: [String], default: () => [] },
  },
  { timestamps: true }
);

export const Character = model<CharacterDoc>("Character", CharacterSchema);

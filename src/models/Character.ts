import { Schema, model, Types, Document } from "mongoose";

/* ───────── Helpers enteros ───────── */
const I0 = (v: any) => Math.max(0, Math.trunc(Number(v) || 0));

/* ───────── Stats (enteros) ───────── */
const StatsSchema = new Schema(
  {
    strength: { type: Number, default: 0, set: I0 },
    dexterity: { type: Number, default: 0, set: I0 },
    intelligence: { type: Number, default: 0, set: I0 },
    constitution: { type: Number, default: 0, set: I0 },
    endurance: { type: Number, default: 0, set: I0 },
    luck: { type: Number, default: 0, set: I0 },
    fate: { type: Number, default: 0, set: I0 },
    physicalDefense: { type: Number, default: 0, set: I0 },
    magicalDefense: { type: Number, default: 0, set: I0 },
  },
  { _id: false }
);

/* ───────── Resistencias (enteros 0..100) ───────── */
const ResistSchema = new Schema(
  {
    fire: { type: Number, default: 0, set: I0 },
    ice: { type: Number, default: 0, set: I0 },
    lightning: { type: Number, default: 0, set: I0 },
    poison: { type: Number, default: 0, set: I0 },
    sleep: { type: Number, default: 0, set: I0 },
    paralysis: { type: Number, default: 0, set: I0 },
    confusion: { type: Number, default: 0, set: I0 },
    fear: { type: Number, default: 0, set: I0 },
    dark: { type: Number, default: 0, set: I0 },
    holy: { type: Number, default: 0, set: I0 },
    stun: { type: Number, default: 0, set: I0 },
    bleed: { type: Number, default: 0, set: I0 },
    curse: { type: Number, default: 0, set: I0 },
    knockback: { type: Number, default: 0, set: I0 },
    criticalChanceReduction: { type: Number, default: 0, set: I0 },
    criticalDamageReduction: { type: Number, default: 0, set: I0 },
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
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    classId: { type: Schema.Types.ObjectId, ref: "CharacterClass", required: true },
    subclassId: { type: Schema.Types.ObjectId, ref: "CharacterClass", default: null },

    level: { type: Number, default: 1, min: 1, set: I0 },
    experience: { type: Number, default: 0, min: 0, set: I0 },

    stats: { type: StatsSchema, default: () => ({}) },
    resistances: { type: ResistSchema, default: () => ({}) },
    combatStats: { type: CombatSchema, default: () => ({}) },

    maxHP: { type: Number, default: 1, min: 1, set: I0 },
    currentHP: { type: Number, default: 1, min: 0, set: I0 },

    stamina: { type: Number, default: 100, min: 0, set: I0 },
    staminaMax: { type: Number, default: 100, min: 1, set: I0 },
    staminaUpdatedAt: { type: Date, default: () => new Date() },
    staminaRegenPerHour: { type: Number, default: 0, set: I0 },

    equipment: { type: Schema.Types.Mixed, default: () => ({}) },
    inventory: { type: [String], default: () => [] },
  },
  { timestamps: true, optimisticConcurrency: true } // ← clave
);

/* ───────── Sincronización fuerte de HP ───────── */
function syncHP(doc: CharacterDoc) {
  const cs: any = doc.combatStats || {};
  const csMax = I0(cs.maxHP);
  const flat = I0(doc.maxHP);

  if (csMax > 0) {
    (doc as any).maxHP = csMax;
  } else if (flat > 0) {
    (doc as any).combatStats = { ...cs, maxHP: flat };
  } else {
    (doc as any).combatStats = { ...cs, maxHP: 1 };
    (doc as any).maxHP = 1;
  }

  const top = I0((doc as any).maxHP);
  let cur = I0((doc as any).currentHP);
  if (cur <= 0) cur = top;
  if (cur > top) cur = top;
  if (cur < 1) cur = 1;
  (doc as any).currentHP = cur;
}

CharacterSchema.pre("validate", function (next) {
  try {
    syncHP(this as unknown as CharacterDoc);
    next();
  } catch (e) {
    next(e as any);
  }
});
CharacterSchema.pre("save", function (next) {
  try {
    syncHP(this as unknown as CharacterDoc);
    next();
  } catch (e) {
    next(e as any);
  }
});

export const Character = model<CharacterDoc>("Character", CharacterSchema);

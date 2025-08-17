// src/models/CharacterClass.ts
import mongoose, { Document, Schema, Types } from "mongoose";
import { CharacterClass as CharacterClassInterface } from "../interfaces/character/CharacterClass.interface";

/** Documento Mongo: igual a tu interfaz de dominio pero SIN _id/id (las aporta Mongoose) */
export interface CharacterClassDocument extends Omit<CharacterClassInterface, "_id" | "id">, Document<Types.ObjectId> {
  _id: Types.ObjectId;
  id: string;
}

const PassiveSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    detail: { type: String },
    // Si quisieras guardar modifiers en BD:
    // modifiers: { type: Schema.Types.Mixed, default: undefined },
  },
  { _id: true }
);

const SubclassSchema = new Schema(
  {
    name: { type: String, required: true },
    iconName: { type: String, required: true },
    imageSubclassUrl: { type: String, default: "" },
    passiveDefault: { type: PassiveSchema, required: false },
    passives: { type: [PassiveSchema], default: [] },
    slug: { type: String, default: null, index: true },
  },
  { _id: true }
);

const BaseStatsSchema = new Schema(
  {
    strength: { type: Number, default: 0 },
    dexterity: { type: Number, default: 0 },
    intelligence: { type: Number, default: 0 },
    vitality: { type: Number, default: 0 },
    physicalDefense: { type: Number, default: 0 },
    magicalDefense: { type: Number, default: 0 },
    luck: { type: Number, default: 0 },
    agility: { type: Number, default: 0 },
    endurance: { type: Number, default: 0 },
    wisdom: { type: Number, default: 0 },
  },
  { _id: false }
);

const ResistancesSchema = new Schema(
  {
    fire: { type: Number, default: 0 },
    ice: { type: Number, default: 0 },
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

const CombatStatsSchema = new Schema(
  {
    maxHP: { type: Number, default: 0 },
    maxMP: { type: Number, default: 0 },
    attackPower: { type: Number, default: 0 },
    magicPower: { type: Number, default: 0 },
    criticalChance: { type: Number, default: 0 },
    criticalDamageBonus: { type: Number, default: 0 },
    attackSpeed: { type: Number, default: 0 },
    evasion: { type: Number, default: 0 },
    blockChance: { type: Number, default: 0 },
    blockValue: { type: Number, default: 0 },
    lifeSteal: { type: Number, default: 0 },
    manaSteal: { type: Number, default: 0 },
    damageReduction: { type: Number, default: 0 },
    movementSpeed: { type: Number, default: 0 },
  },
  { _id: false }
);

const CharacterClassSchema = new Schema<CharacterClassDocument>(
  {
    name: { type: String, required: true, index: true },
    description: { type: String, default: "" },
    iconName: { type: String, required: true },
    imageMainClassUrl: { type: String, required: true },

    passiveDefault: { type: PassiveSchema, required: true },
    subclasses: { type: [SubclassSchema], default: [] },

    baseStats: { type: BaseStatsSchema, default: () => ({}) },
    resistances: { type: ResistancesSchema, default: () => ({}) },
    combatStats: { type: CombatStatsSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        Reflect.deleteProperty(ret as any, "_id");
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        Reflect.deleteProperty(ret as any, "_id");
        return ret;
      },
    },
  }
);

// virtual id
CharacterClassSchema.virtual("id").get(function (this: { _id: Types.ObjectId }) {
  return this._id.toString();
});

export const CharacterClass = (mongoose.models.CharacterClass as mongoose.Model<CharacterClassDocument>) || mongoose.model<CharacterClassDocument>("CharacterClass", CharacterClassSchema);

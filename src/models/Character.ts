import mongoose, { Document, Schema, Types } from "mongoose";
import { Character as CharacterInterface } from "../interfaces/character/Character.interface";

export interface CharacterDocument extends Omit<CharacterInterface, "userId" | "classId">, Document {
  userId: Types.ObjectId;
  classId: Types.ObjectId;
}

const CharacterSchema = new Schema<CharacterDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true }, // ← 1 personaje por usuario
    classId: { type: Schema.Types.ObjectId, ref: "CharacterClass", required: true },

    level: { type: Number, default: 1, min: 1 },
    experience: { type: Number, default: 0, min: 0 },

    stats: {
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

    resistances: {
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

    combatStats: {
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

    passivesUnlocked: [{ type: String, default: [] }],
    inventory: [{ type: String, default: [] }],

    equipment: {
      head: { type: String, default: null },
      chest: { type: String, default: null },
      legs: { type: String, default: null },
      boots: { type: String, default: null },
      gloves: { type: String, default: null },
      weapon: { type: String, default: null },
      offHand: { type: String, default: null },
      ring1: { type: String, default: null },
      ring2: { type: String, default: null },
      amulet: { type: String, default: null },
    },
  },
  {
    timestamps: true, // ← createdAt/updatedAt automáticos
    versionKey: false,
    minimize: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

CharacterSchema.pre("save", function (this: CharacterDocument, next) {
  if (!this.combatStats) {
    this.combatStats = {
      maxHP: 0,
      maxMP: 0,
      attackPower: 0,
      magicPower: 0,
      criticalChance: 0,
      criticalDamageBonus: 0,
      attackSpeed: 0,
      evasion: 0,
      blockChance: 0,
      blockValue: 0,
      lifeSteal: 0,
      manaSteal: 0,
      damageReduction: 0,
      movementSpeed: 0,
    };
  }
  next();
});

export const Character = mongoose.model<CharacterDocument>("Character", CharacterSchema);
export type { CharacterDocument as TCharacterDoc };

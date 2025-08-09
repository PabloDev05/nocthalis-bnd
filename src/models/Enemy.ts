// src/models/Enemy.ts
import mongoose, { Document, Schema } from "mongoose";
import { BaseStats, Resistances, CombatStats } from "../interfaces/character/CharacterClass.interface";

export type EnemyTier = "common" | "elite" | "rare";

export interface EnemyDoc extends Document {
  name: string;
  level: number;
  tier: EnemyTier; // ← nuevo
  stats: BaseStats;
  resistances: Resistances;
  combatStats: CombatStats;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EnemySchema = new Schema<EnemyDoc>(
  {
    name: { type: String, required: true, index: true },
    level: { type: Number, required: true, min: 1, index: true },
    tier: {
      // ← nuevo
      type: String,
      enum: ["common", "elite", "rare"],
      default: "common",
      index: true,
    },

    // BaseStats con defaults (evita undefined)
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

    // Resistances con defaults
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

    // CombatStats con defaults
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

    imageUrl: { type: String, default: "" },
  },
  {
    timestamps: true,
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

// Índice compuesto único para evitar colisiones entre seeds generados
EnemySchema.index({ name: 1, level: 1, tier: 1 }, { unique: true });

export const Enemy = mongoose.models.Enemy || mongoose.model<EnemyDoc>("Enemy", EnemySchema);
export type { EnemyDoc as TEnemyDoc };

// src/models/Enemy.ts
import mongoose, { Document, Schema } from "mongoose";
import { BaseStats, Resistances, CombatStats } from "../interfaces/character/CharacterClass.interface";
import type { SlotKey } from "../interfaces/Item/Item.interface";

// ---- Tipos auxiliares ----
export type EnemyTier = "common" | "elite" | "rare";
export type BossType = "miniboss" | "boss" | "world";
export type RarityKey = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface DropProfile {
  /** Cantidad de tiradas de drop que se realizarán para este enemigo */
  rolls: number;
  /** Probabilidades por rareza (valores que suman ~100) */
  rarityChances: Record<RarityKey, number>;
  /** Pesos por slot. Se combinan con preferencias de clase del jugador en el roller */
  slotWeights: Partial<Record<SlotKey, number>>;
  /** Para (mini)bosses: garantiza al menos esta rareza en UNA de las tiradas */
  guaranteedMinRarity?: "uncommon" | "rare" | "epic";
}

export interface EnemyDoc extends Document {
  name: string;
  level: number;
  tier: EnemyTier;

  stats: BaseStats;
  resistances: Resistances;
  combatStats: CombatStats;

  imageUrl?: string;

  // Recompensas y loot
  xpReward: number;
  goldReward: number;
  dropProfile: DropProfile;

  // Boss flags (opcional)
  isBoss?: boolean;
  bossType?: BossType | null;

  // Info extra (opcional)
  mechanics?: string[];
  immunities?: string[];

  // Ajustes de balance (opcional)
  lootTierMultiplier?: number; // multiplica el resultado de rarezas (p. ej. 1.1 = +10% hacia arriba)
  xpMultiplier?: number; // multiplica xpReward final

  createdAt: Date;
  updatedAt: Date;

  // helper opcional
  powerScore?: number;
}

// ---- utilidades internas ----
const SLOT_KEYS: SlotKey[] = ["helmet", "chest", "gloves", "boots", "mainWeapon", "offWeapon", "ring", "belt", "amulet"];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeRarity(chances: Record<RarityKey, number>) {
  const safe = { ...chances, common: chances?.common ?? 0, uncommon: chances?.uncommon ?? 0, rare: chances?.rare ?? 0, epic: chances?.epic ?? 0, legendary: chances?.legendary ?? 0 };
  const sum = Object.values(safe).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) || 1;
  const out: Record<RarityKey, number> = {
    common: Math.round((safe.common / sum) * 100),
    uncommon: Math.round((safe.uncommon / sum) * 100),
    rare: Math.round((safe.rare / sum) * 100),
    epic: Math.round((safe.epic / sum) * 100),
    legendary: Math.round((safe.legendary / sum) * 100),
  };
  // ajustar redondeo final para sumar 100
  const diff = 100 - Object.values(out).reduce((a, b) => a + b, 0);
  if (diff !== 0) out.common = clamp(out.common + diff, 0, 100);
  return out;
}

function fillSlotWeights(weights: Partial<Record<SlotKey, number>>) {
  const base: Record<SlotKey, number> = {
    helmet: 1,
    chest: 1,
    gloves: 1,
    boots: 1,
    mainWeapon: 1,
    offWeapon: 1,
    ring: 1,
    belt: 1,
    amulet: 1,
  };
  const merged = { ...base, ...(weights || {}) };
  // evitar todos ceros
  const sum = SLOT_KEYS.reduce((a, k) => a + (Number(merged[k]) || 0), 0);
  if (sum <= 0) return base;
  return merged;
}

// ---- Subesquemas ----
const DropProfileSchema = new Schema<DropProfile>(
  {
    rolls: { type: Number, default: 1, min: 0, max: 10 },
    rarityChances: {
      type: Object,
      default: { common: 70, uncommon: 25, rare: 5, epic: 0, legendary: 0 },
    },
    slotWeights: {
      type: Object,
      default: {
        helmet: 1,
        chest: 1,
        gloves: 1,
        boots: 1,
        mainWeapon: 1,
        offWeapon: 1,
        ring: 1,
        belt: 1,
        amulet: 1,
      },
    },
    guaranteedMinRarity: { type: String, enum: ["uncommon", "rare", "epic"], default: undefined },
  },
  { _id: false }
);

// ---- Esquema principal ----
const EnemySchema = new Schema<EnemyDoc>(
  {
    name: { type: String, required: true, index: true },
    level: { type: Number, required: true, min: 1, index: true },
    tier: { type: String, enum: ["common", "elite", "rare"], default: "common", index: true },

    // BaseStats con defaults
    stats: {
      strength: { type: Number, default: 0 },
      dexterity: { type: Number, default: 0 },
      intelligence: { type: Number, default: 0 },
      vitality: { type: Number, default: 0 },
      physicalDefense: { type: Number, default: 0 },
      magicalDefense: { type: Number, default: 0 },
      luck: { type: Number, default: 0 },
      endurance: { type: Number, default: 0 },
    },

    // Resistencias con defaults
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
      attackPower: { type: Number, default: 0 },
      magicPower: { type: Number, default: 0 },
      criticalChance: { type: Number, default: 0 },
      criticalDamageBonus: { type: Number, default: 0 },
      attackSpeed: { type: Number, default: 0 },
      evasion: { type: Number, default: 0 },
      blockChance: { type: Number, default: 0 },
      blockValue: { type: Number, default: 0 },
      lifeSteal: { type: Number, default: 0 },
      damageReduction: { type: Number, default: 0 },
      movementSpeed: { type: Number, default: 0 },
    },

    imageUrl: { type: String, default: "" },

    // Recompensas y drop
    xpReward: { type: Number, default: 0, min: 0, max: 1_000_000, index: true },
    goldReward: { type: Number, default: 0, min: 0, max: 1_000_000 },
    dropProfile: { type: DropProfileSchema, default: () => ({}) },

    // Boss flags
    isBoss: { type: Boolean, default: false, index: true },
    bossType: { type: String, enum: ["miniboss", "boss", "world"], default: null, index: true },

    // Extras
    mechanics: { type: [String], default: [] },
    immunities: { type: [String], default: [] },
    lootTierMultiplier: { type: Number, default: 1.0, min: 0, max: 10 },
    xpMultiplier: { type: Number, default: 1.0, min: 0, max: 10 },
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
  }
);

// Índice compuesto único para evitar colisiones entre seeds generados
EnemySchema.index({ name: 1, level: 1, tier: 1, bossType: 1 }, { unique: true });

// --- Hooks opcionales de robustez ---
EnemySchema.pre("save", function (next) {
  // bossType coherente con isBoss
  if (!this.isBoss) this.bossType = null;

  // normalizar chances y slotWeights
  if (this.dropProfile) {
    this.dropProfile.rarityChances = normalizeRarity(this.dropProfile.rarityChances || ({} as any));
    this.dropProfile.slotWeights = fillSlotWeights(this.dropProfile.slotWeights || {});
    this.dropProfile.rolls = clamp(this.dropProfile.rolls ?? 1, 0, 10);
  }

  // clamp rewards y multiplicadores
  this.xpReward = clamp(this.xpReward ?? 0, 0, 1_000_000);
  this.goldReward = clamp(this.goldReward ?? 0, 0, 1_000_000);
  this.lootTierMultiplier = clamp(this.lootTierMultiplier ?? 1, 0, 10);
  this.xpMultiplier = clamp(this.xpMultiplier ?? 1, 0, 10);

  next();
});

// Virtual opcional: “poder” del enemigo (para orden/filtrado)
EnemySchema.virtual("powerScore").get(function (this: EnemyDoc) {
  const s = this.stats || ({} as any);
  const c = this.combatStats || ({} as any);
  // fórmula muy simple; ajustá a gusto
  return (s.strength + s.dexterity + s.intelligence + s.vitality + s.physicalDefense + s.magicalDefense) * 1 + (c.attackPower + c.magicPower) * 1.5 + c.maxHP * 0.2;
});

export const Enemy = (mongoose.models.Enemy as mongoose.Model<EnemyDoc>) || mongoose.model<EnemyDoc>("Enemy", EnemySchema);
export type { EnemyDoc as TEnemyDoc };

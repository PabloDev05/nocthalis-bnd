// src/models/Character.ts
// Personaje del jugador listo para el sistema Fate + skills con proc y stamina.
//
// - Incluye fate en stats.
// - classId/subclassId referenciando CharacterClass.
// - Estado runtime de skills (cooldown/duración).
// - Campos de stamina con regeneración por hora y ETA precalculada.
// - currentHP separado de combatStats.maxHP para claridad.

import mongoose, { Schema, model, type Document, type Model, Types } from "mongoose";

export type ObjectId = Types.ObjectId;

/* ──────────────────────────────────────────────────────────────────────────
 * Sub-bloques
 * ────────────────────────────────────────────────────────────────────────── */

export interface BaseStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number;
  endurance: number;
  fate: number; // NEW
}

export interface CombatStats {
  maxHP: number;
  attackPower: number;
  magicPower: number;

  criticalChance: number; // %
  criticalDamageBonus: number; // %
  attackSpeed: number;
  evasion: number; // %
  blockChance: number; // %
  blockValue: number; // plano
  lifeSteal: number; // %
  damageReduction: number; // %
  movementSpeed: number;
}

export interface Resistances {
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
}

export type EquipmentSlot = "helmet" | "chest" | "gloves" | "boots" | "mainWeapon" | "offWeapon" | "ring" | "belt" | "amulet";

export type Equipment = Record<EquipmentSlot, string | null>;

/**
 * Estado de combate persistido mínimo para skills:
 * - passiveBuff: estado temporal de la passiveDefaultSkill (si se activó por Fate).
 * - ultimate: enfriamiento y bloqueos puntuales (p.ej. silence).
 */
export interface SkillRuntimeState {
  passiveBuff?: {
    name?: string;
    remainingTurns: number;
    bonusDamage?: number;
    extraEffects?: Record<string, number>;
    lastTurnTick?: number | null;
  } | null;

  ultimate?: {
    name?: string;
    cooldownLeft: number;
    silencedUntilTurn?: number | null;
  } | null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Schemas de sub-bloques
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
    fate: { type: Number, required: true, default: 0 },
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

const SkillRuntimeStateSchema = new Schema<SkillRuntimeState>(
  {
    passiveBuff: {
      type: new Schema(
        {
          name: { type: String },
          remainingTurns: { type: Number, required: true, default: 0 },
          bonusDamage: { type: Number, default: 0 },
          extraEffects: { type: Schema.Types.Mixed, default: {} },
          lastTurnTick: { type: Number, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    ultimate: {
      type: new Schema(
        {
          name: { type: String },
          cooldownLeft: { type: Number, required: true, default: 0 },
          silencedUntilTurn: { type: Number, default: null },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { _id: false }
);

/* ──────────────────────────────────────────────────────────────────────────
 * Character
 * ────────────────────────────────────────────────────────────────────────── */

export interface CharacterDoc extends Document {
  userId: ObjectId;

  // Clase/subclase actual
  classId: ObjectId;
  subclassId?: ObjectId | null;

  // UX básicos
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;

  // Progresión
  level: number;
  experience: number;

  // Bloques principales
  stats: BaseStats;
  combatStats: CombatStats;
  resistances: Resistances;

  // Vida actual (se inicializa a combatStats.maxHP en creación/seed)
  maxHP?: number;
  currentHP: number;

  // Equipo/Inventario
  equipment: Equipment;
  inventory: string[];

  // Estado de skills (cooldown/duración)
  skillState: SkillRuntimeState;

  // Economía
  gold?: number;
  honor?: number;

  // Stamina
  stamina: number; // actual
  staminaMax: number; // tope
  staminaRegenPerHour: number; // si 0, política “24h para full”
  staminaUpdatedAt: Date; // timetag de último recalculo/consumo
  nextStaminaFullAt: Date | null; // ETA precalculada

  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterModel extends Model<CharacterDoc> {}

const EquipmentDefaults: Equipment = {
  helmet: null,
  chest: null,
  gloves: null,
  boots: null,
  mainWeapon: null,
  offWeapon: null,
  ring: null,
  belt: null,
  amulet: null,
};

const CharacterSchema = new Schema<CharacterDoc>(
  {
    // ⚠️ Quité `index: true` para evitar índice duplicado; dejamos el schema.index abajo
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    classId: { type: Schema.Types.ObjectId, ref: "CharacterClass", required: true, index: true },
    subclassId: { type: Schema.Types.ObjectId, default: null },

    name: { type: String },
    username: { type: String },
    avatarUrl: { type: String },

    level: { type: Number, required: true, default: 1 },
    experience: { type: Number, required: true, default: 0 },

    stats: { type: BaseStatsSchema, required: true },
    combatStats: { type: CombatStatsSchema, required: true },
    resistances: { type: ResistancesSchema, required: true },

    // currentHP separado de max del bloque para claridad
    maxHP: { type: Number },
    currentHP: { type: Number, required: true, default: 0 },

    equipment: {
      type: new Schema<Record<EquipmentSlot, string | null>>(
        {
          helmet: { type: String, default: null },
          chest: { type: String, default: null },
          gloves: { type: String, default: null },
          boots: { type: String, default: null },
          mainWeapon: { type: String, default: null },
          offWeapon: { type: String, default: null },
          ring: { type: String, default: null },
          belt: { type: String, default: null },
          amulet: { type: String, default: null },
        },
        { _id: false }
      ),
      default: EquipmentDefaults,
    },

    inventory: { type: [String], default: [] },

    skillState: { type: SkillRuntimeStateSchema, default: {} },

    gold: { type: Number, default: 0 },
    honor: { type: Number, default: 0 },

    // ─── Stamina ──────────────────────────────────────────────────────
    stamina: { type: Number, required: true, default: 100 },
    staminaMax: { type: Number, required: true, default: 100 },
    staminaRegenPerHour: { type: Number, required: true, default: 10 }, // si 0 => fallback 24h
    staminaUpdatedAt: { type: Date, required: true, default: () => new Date() },
    nextStaminaFullAt: { type: Date, default: null },
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

// Asegurar currentHP y normalizaciones mínimas
CharacterSchema.pre("save", function (next) {
  if (!this.currentHP || this.currentHP <= 0) {
    const cap = Math.max(1, Number(this.combatStats?.maxHP ?? 1));
    this.currentHP = cap;
  }
  if (this.stats && this.stats.fate < 0) this.stats.fate = 0;

  // saneo stamina básica
  const sMax = Math.max(1, Number(this.staminaMax || 100));
  this.stamina = Math.max(0, Math.min(sMax, Math.floor(Number(this.stamina || 0))));
  if (!this.staminaUpdatedAt) this.staminaUpdatedAt = new Date();

  next();
});

// Útil para lookups (dejar SOLO estos; no uses también index:true en el campo userId)
CharacterSchema.index({ userId: 1 }, { unique: true }); // 1 personaje por user (ajusta si permitís múltiples)
CharacterSchema.index({ "stats.fate": -1 });
CharacterSchema.index({ level: -1 });

export const Character = (mongoose.models.Character as CharacterModel) || model<CharacterDoc, CharacterModel>("Character", CharacterSchema);

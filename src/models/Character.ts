import mongoose, { Document } from "mongoose";
import { Character as CharacterInterface } from "./interfaces/Character.interface";

interface CharacterDocument extends CharacterInterface, Document {}

const CharacterSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "CharacterClass", required: true },
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },

  stats: {
    strength: Number,
    dexterity: Number,
    intelligence: Number,
    vitality: Number,
    physicalDefense: Number,
    magicalDefense: Number,
    luck: Number,
    agility: Number,
    endurance: Number,
    wisdom: Number,
  },

  resistances: {
    fire: Number,
    ice: Number,
    lightning: Number,
    poison: Number,
    sleep: Number,
    paralysis: Number,
    confusion: Number,
    fear: Number,
    dark: Number,
    holy: Number,
    stun: Number,
    bleed: Number,
    curse: Number,
    knockback: Number,
    criticalChanceReduction: Number,
    criticalDamageReduction: Number,
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
    criticalHit: { type: Number, default: 0 },
    blockChance: { type: Number, default: 0 },
    blockValue: { type: Number, default: 0 },
    lifeSteal: { type: Number, default: 0 },
    manaSteal: { type: Number, default: 0 },
    damageReduction: { type: Number, default: 0 },
    movementSpeed: { type: Number, default: 0 },
  },

  passivesUnlocked: [{ type: String }],
  inventory: [{ type: String }],

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

  createdAt: { type: Date, default: Date.now },
});

export const Character = mongoose.model<CharacterDocument>("Character", CharacterSchema);

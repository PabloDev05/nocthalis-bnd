// src/types/lean.ts
import { Types } from "mongoose";
import type { PlayerClassName } from "../utils/loot";

// --- Bloques de stats usados por el motor ---
export type Stats = {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number;
  agility: number;
  endurance: number;
  wisdom: number;
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

export type CombatStats = {
  maxHP: number;
  maxMP: number;
  attackPower: number;
  magicPower: number;
  criticalChance: number;
  criticalDamageBonus: number;
  attackSpeed: number;
  evasion: number;
  blockChance: number;
  blockValue: number;
  lifeSteal: number;
  manaSteal: number;
  damageReduction: number;
  movementSpeed: number;
};

// --- Clases / Personajes base ---
export type ClassLean = {
  _id: Types.ObjectId;
  name: PlayerClassName;
};

export type CharacterLean = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  classId: Types.ObjectId | ClassLean;
  level: number;
  experience: number;
  inventory: string[];
};

// Para el builder: lo que realmente necesita
export type CharacterForBattleLean = CharacterLean & {
  stats: Partial<Stats>;
  resistances: Partial<Resistances>;
  combatStats: Partial<CombatStats>;
  // por si guardaste nombre/username en el doc
  name?: string;
  username?: string;
};

// --- Enemigos ---
export type EnemyLean = {
  _id: Types.ObjectId;
  name: string;
  level: number;
  tier: "common" | "elite" | "rare";
  bossType?: "miniboss" | "boss" | "world" | null;
  xpReward: number;
  goldReward: number;
  dropProfile: unknown;
};

export type EnemyForBattleLean = EnemyLean & {
  stats: Partial<Stats>;
  resistances: Partial<Resistances>;
  combatStats: Partial<CombatStats>;
  // util para JSON
  id?: string;
};

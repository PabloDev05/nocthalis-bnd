// src/types/lean.ts
import { Types } from "mongoose";

/* ────────────────────────────────────────────────────────────
 * Bloques de stats usados por el motor (enteros)
 * ──────────────────────────────────────────────────────────── */

export type Stats = {
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number;
  endurance: number;
  /** NEW: probabilidad de procs (separado de luck) */
  fate: number;
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
  attackPower: number;
  magicPower: number;
  criticalChance: number;
  criticalDamageBonus: number;
  attackSpeed: number;
  evasion: number;
  blockChance: number;
  blockValue: number;
  lifeSteal: number;
  damageReduction: number;
  movementSpeed: number;
};

/* ────────────────────────────────────────────────────────────
 * Clases / Personajes base (lean)
 * ──────────────────────────────────────────────────────────── */

/** Clase mínima populada (evita acoplar a un union de nombres) */
export type ClassLean = {
  _id: Types.ObjectId;
  name: string; // p.ej. "Vampire", "Werewolf", etc.
};

export type CharacterLean = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Puede venir como ObjectId o como objeto poblado */
  classId: Types.ObjectId | ClassLean;

  /** Progresión */
  level: number;
  experience: number;

  /** Colección ligera (ids de ítems) */
  inventory: string[];

  /** Opcionalmente podrías tener: */
  // subclassId?: Types.ObjectId | null;
  // name?: string;
  // username?: string;
};

/** Para el builder de combate: versión enriquecida */
export type CharacterForBattleLean = CharacterLean & {
  stats: Partial<Stats>;
  resistances: Partial<Resistances>;
  combatStats: Partial<CombatStats>;
  name?: string;
  username?: string;
};

/* ────────────────────────────────────────────────────────────
 * Enemigos
 * ──────────────────────────────────────────────────────────── */

export type EnemyLean = {
  _id: Types.ObjectId;
  name: string;
  level: number;
  tier: "common" | "elite" | "rare";
  bossType?: "miniboss" | "boss" | "world" | null;

  xpReward: number;
  goldReward: number;
  dropProfile: unknown;

  /** Campos que solemos proyectar en servicios (pueden ser parciales) */
  stats?: Partial<Stats>;
  resistances?: Partial<Resistances>;
  combatStats?: Partial<CombatStats>;
};

/** Lo mismo pero marcado explícitamente para el motor */
export type EnemyForBattleLean = EnemyLean & {
  stats: Partial<Stats>;
  resistances: Partial<Resistances>;
  combatStats: Partial<CombatStats>;
  id?: string; // útil para JSON serializado
};

// src/interfaces/character/Character.interface.ts
import { BaseStats, Resistances, CombatStats } from "./CharacterClass.interface";

/** Estructura de equipo: ids (string) o null para cada slot */
export interface Equipment {
  helmet: string | null;
  chest: string | null;
  gloves: string | null;
  boots: string | null;
  mainWeapon: string | null;
  offWeapon: string | null;
  ring: string | null;
  belt: string | null;
  amulet: string | null;
}

export interface Character {
  /** IDs como strings para DTOs / API */
  id?: string;
  userId: string;
  classId: string;
  /** puede no existir aún */
  subclassId?: string | null;

  /** Progresión */
  level: number;
  experience: number;

  /** Fuente de verdad del personaje */
  stats: BaseStats;
  resistances: Resistances;

  /** Si en DB siempre existe, podés quitar el '?' */
  combatStats?: CombatStats;

  /** Vida actual para UI fuera de combate (opcional) */
  currentHP?: number;

  /** Progresión/colección */
  passivesUnlocked: string[];
  inventory: string[];
  equipment: Equipment;

  /** timestamps del doc (opcionales en DTOs/lean) */
  createdAt?: Date;
  updatedAt?: Date;
}

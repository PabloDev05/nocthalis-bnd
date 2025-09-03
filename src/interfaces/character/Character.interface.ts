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

/**
 * DTO canónico de Character para API/servicios.
 * Nota: reflejamos el modelo Mongoose actual (Fate + stamina),
 * pero algunas props quedan opcionales para no romper UIs antiguas.
 */
export interface Character {
  /** IDs como strings para DTOs / API */
  id?: string;
  userId: string;
  classId: string;
  /** puede no existir aún */
  subclassId?: string | null;

  /** UX opcional */
  name?: string | null;
  username?: string | null;

  /** Progresión */
  level: number;
  experience: number;

  /** Fuente de verdad del personaje */
  stats: BaseStats; // incluye 'fate'
  resistances: Resistances;
  combatStats: CombatStats; // requerido en el modelo → mantenemos requerido aquí

  /** Vida actual (persistida fuera de combate para UI) */
  currentHP?: number;

  /** Progresión/colección */
  /** @deprecated Ya no se persiste; mantener opcional por compatibilidad de front antiguo */
  passivesUnlocked?: string[];
  inventory: string[];
  equipment: Equipment;

  /** Stamina (top-level, alineado al modelo). Opcionales en DTO para compat. */
  stamina?: number; // 0..staminaMax
  staminaMax?: number; // tope (ej: 100)
  staminaRegenPerHour?: number; // si 0/undefined, servicio usa “llenado en 24h”
  staminaUpdatedAt?: Date | string; // ISO/Date de última actualización

  /** timestamps del doc (opcionales en DTOs/lean) */
  createdAt?: Date;
  updatedAt?: Date;
}

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
 * - Todos los números son ENTEROS.
 * - `stats` usa el shape nuevo con `constitution` (no `vitality`) y `fate`.
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
  stats: BaseStats;          // incluye constitution y fate (enteros)
  resistances: Resistances;  // enteros 0..100 con cap en lógica de negocio
  combatStats: CombatStats;  // enteros (maxHP, attackPower, etc.)

  /** Vida actual (persistida fuera de combate para UI) */
  currentHP?: number;

  /** Progresión/colección */
  /** @deprecated Mantener opcional por compatibilidad de front antiguo */
  passivesUnlocked?: string[];
  inventory: string[];
  equipment: Equipment;

  /** Stamina (top-level, alineado al modelo). Opcionales en DTO para compat. */
  stamina?: number;              // 0..staminaMax
  staminaMax?: number;           // tope (ej: 100)
  staminaRegenPerHour?: number;  // si 0/undefined, política por defecto
  staminaUpdatedAt?: Date | string; // ISO/Date de última actualización

  /** timestamps del doc (opcionales en DTOs/lean) */
  createdAt?: Date;
  updatedAt?: Date;
}

/* eslint-disable no-console */
// Servicio minimalista de asignación de puntos.
// - Incluye FATE en las asignaciones.
// - Sin curvas ni reglas por clase: el motor de combate se encarga de efectos.
// - Compatible con cualquier clase de tu seed (Vampire, Werewolf, etc).

import type { BaseStats } from "../interfaces/character/CharacterClass.interface";

/** Stats asignables (alineados a tu UI y al seed). */
export const ASSIGNABLE_KEYS: (keyof BaseStats)[] = [
  "strength",
  "dexterity",
  "intelligence",
  "vitality",
  "physicalDefense",
  "magicalDefense",
  "luck",
  "endurance",
  "fate", // NEW
];

/** Puntos que gana el jugador por nivel (ajústalo si querés). */
export const POINTS_PER_LEVEL = 5;

/** Suma segura de enteros (evita NaN). */
function i(n: any, d = 0) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? v : d;
}

/**
 * available = level * POINTS_PER_LEVEL - Σ max(0, current[k] - base[k])
 * (solo claves asignables)
 *
 * Nota: si preferís “nivel 1 = 0 puntos”, cambia a:
 *   const totalEarned = Math.max(0, level - 1) * POINTS_PER_LEVEL;
 */
export function computeAvailablePoints(level: number, current: BaseStats, base: BaseStats): number {
  const totalEarned = Math.max(0, i(level)) * POINTS_PER_LEVEL;

  let spent = 0;
  for (const k of ASSIGNABLE_KEYS) {
    const cur = i((current as any)[k], 0);
    const bas = i((base as any)[k], 0);
    spent += Math.max(0, cur - bas);
  }
  return Math.max(0, totalEarned - spent);
}

/** Aplica incrementos (enteros ≥ 0) y devuelve una NUEVA copia de stats. */
export function applyIncrements(current: BaseStats, inc: Partial<BaseStats>): BaseStats {
  const out: BaseStats = { ...current } as BaseStats;
  for (const k of ASSIGNABLE_KEYS) {
    const add = Math.max(0, i((inc as any)[k], 0));
    (out as any)[k] = Math.max(0, i((out as any)[k], 0) + add);
  }
  return out;
}

/** Utilidad opcional: suma total de puntos invertidos (solo asignables). */
export function sumAssigned(stats: Partial<BaseStats> | BaseStats): number {
  let s = 0;
  for (const k of ASSIGNABLE_KEYS) s += Math.max(0, i((stats as any)[k], 0));
  return s;
}

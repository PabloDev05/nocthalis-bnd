// src/services/allocation.service.ts

/** Atributos asignables (sin alias, claves exactas). */
export const ASSIGNABLE_KEYS = [
  "strength",
  "dexterity",
  "intelligence",
  "constitution",
  "endurance",
  "luck",
  "fate",
  "physicalDefense",
  "magicalDefense",
] as const;

export type AssignKey = (typeof ASSIGNABLE_KEYS)[number];

/** Puntos por nivel (ajusta libremente). */
export const POINTS_PER_LEVEL = 5;

/** Suma incrementos enteros a los stats (sin alias). */
export function applyIncrements(
  stats: Record<string, number>,
  inc: Partial<Record<AssignKey, number>>
) {
  const out: Record<string, number> = { ...(stats || {}) };

  for (const k of ASSIGNABLE_KEYS) {
    const add = Math.max(0, Math.trunc(Number(inc[k] ?? 0)));
    if (!add) continue;
    const cur = Math.max(0, Math.trunc(Number(out[k] ?? 0)));
    out[k] = cur + add;
  }

  return out;
}

/**
 * available = (level - 1) * PPL - sum( (stats[k] - baseStats[k]) positivos )
 * Todo entero y sin alias.
 */
export function computeAvailablePoints(
  level: number,
  stats: Record<string, number>,
  baseStats: Record<string, number>
) {
  const lvl = Math.max(1, Math.trunc(Number(level ?? 1)));
  const pool = (lvl - 1) * POINTS_PER_LEVEL;

  let spent = 0;
  for (const k of ASSIGNABLE_KEYS) {
    const cur = Math.max(0, Math.trunc(Number(stats?.[k] ?? 0)));
    const base = Math.max(0, Math.trunc(Number(baseStats?.[k] ?? 0)));
    spent += Math.max(0, cur - base);
  }

  return Math.max(0, pool - spent);
}

/* ========================================================================== *
 * Allocation service (fuente única de verdad para puntos)
 * ========================================================================== */

export const ASSIGNABLE_KEYS = ["strength", "dexterity", "intelligence", "constitution", "endurance", "luck", "fate", "physicalDefense", "magicalDefense"] as const;

export type AssignKey = (typeof ASSIGNABLE_KEYS)[number];

export const POINTS_PER_LEVEL = 5;

/* ---------- helpers ---------- */
const I0 = (v: any) => Math.max(0, Math.trunc(Number(v) || 0));

function toPlain<T = any>(x: any): T {
  try {
    if (x && typeof x.toObject === "function") return x.toObject({ depopulate: true });
    return JSON.parse(JSON.stringify(x ?? {}));
  } catch {
    return (x ?? {}) as T;
  }
}

/** Puntos ganados por nivel alcanzado (lvl>=1). */
export function getPointsEarned(level: number): number {
  const lvl = Math.max(1, Math.trunc(Number(level ?? 1)));
  return (lvl - 1) * POINTS_PER_LEVEL;
}

/** Σ(max(0, stats[k] - baseStats[k])) sobre claves asignables.  (stats/base pueden ser subdocs) */
export function computeSpentPoints(statsRaw: Record<string, any>, baseRaw: Record<string, any>): number {
  const stats = toPlain<Record<string, any>>(statsRaw || {});
  const base = toPlain<Record<string, any>>(baseRaw || {});
  let spent = 0;
  for (const k of ASSIGNABLE_KEYS) {
    const cur = I0(stats[k]);
    const bse = I0(base[k]);
    spent += Math.max(0, cur - bse);
  }
  return spent;
}

/** available = getPointsEarned(level) - computeSpentPoints(stats, baseStats). */
export function computeAvailablePoints(level: number, statsRaw: Record<string, any>, baseRaw: Record<string, any>): number {
  const pool = getPointsEarned(level);
  const spent = computeSpentPoints(statsRaw, baseRaw);
  return Math.max(0, pool - spent);
}

/** Suma incrementos enteros a los stats (stats puede ser subdocumento de Mongoose). */
export function applyIncrements(statsRaw: Record<string, any>, inc: Partial<Record<AssignKey, number>>): Record<string, number> {
  const base = toPlain<Record<string, number>>(statsRaw || {});
  const out: Record<string, number> = { ...base };

  for (const k of ASSIGNABLE_KEYS) {
    const add = I0(inc[k] ?? 0);
    if (!add) continue;
    const cur = I0(out[k] ?? base[k] ?? 0);
    out[k] = cur + add;
  }
  return out;
}

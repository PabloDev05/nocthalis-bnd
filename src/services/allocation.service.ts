/* eslint-disable no-console */
// Servicio minimalista de asignación de puntos.
// - Incluye FATE en las asignaciones.
// - Sin curvas ni reglas por clase: el motor de combate se encarga de efectos.
// - Compatible con cualquier clase de tu seed (Vampire, Werewolf, etc).
// services/allocation.service.ts
import type { BaseStats } from "../interfaces/character/CharacterClass.interface";

/** Stats asignables (alineados a tu UI y al seed). */
export const ASSIGNABLE_KEYS = [
  "strength",
  "dexterity",
  "intelligence",
  "vitality",
  "physicalDefense",
  "magicalDefense",
  "luck",
  "endurance",
  "fate", // ✅ incluido
] as const;

export type AssignableKey = (typeof ASSIGNABLE_KEYS)[number];

/** Puntos que gana el jugador por nivel (ajústalo si querés). */
export const POINTS_PER_LEVEL = 5;

/** Suma segura de enteros (evita NaN; trunca). */
function i(n: any, d = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : d;
}

/** Puntos ganados totales según nivel.
 *  Por defecto: nivel 1 = 0 puntos; nivel 2 = 5; etc.
 *  Si quisieras que nivel 1 ya tenga puntos, usa `Math.max(0, level) * POINTS_PER_LEVEL`.
 */
export function getPointsEarned(level: number): number {
  return Math.max(0, i(level) - 1) * POINTS_PER_LEVEL;
}

/**
 * available = pointsEarned(level) - Σ max(0, current[k] - base[k])
 * (solo claves asignables)
 */
export function computeAvailablePoints(level: number, current: BaseStats, base: BaseStats): number {
  const totalEarned = getPointsEarned(level);

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

/** Puntos invertidos respecto a la base (solo asignables). */
export function sumAssigned(current: BaseStats, base: BaseStats): number {
  let s = 0;
  for (const k of ASSIGNABLE_KEYS) {
    const cur = i((current as any)[k], 0);
    const bas = i((base as any)[k], 0);
    s += Math.max(0, cur - bas);
  }
  return s;
}

/* ────────────────────────────────────────────────────────────────────────────
   Sugerencias de uso en el controller (por si te ayudan):
   - Antes de aplicar, valida que sum(inc) <= computeAvailablePoints(level,...).
   - Si querés evitar sobreasignación en una sola request, podés chequear que
     cada incremento sea 0/1, o capear sum(inc) a available.
   - Si más adelante agregás “resets”/“respec”, podés recomputar current=base
     para devolver todos los puntos (o mantener un campo `pointsRefunded`).
   - Los efectos de pasivas/equipo deberían ir a combatStats, no a BaseStats,
     así esta contabilidad se mantiene limpia.
   ──────────────────────────────────────────────────────────────────────────── */

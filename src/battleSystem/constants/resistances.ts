// src/battleSystem/constants/resistances.ts

/**
 * Resistencias del sistema de combate.
 *
 * Unidades: 0–100 (puntos %). 0 = sin resistencia; 100 = inmune.
 *
 * Ejemplos de uso en runner:
 *   chanceEfectiva = chanceBase * (1 - resistencia/100)
 *   bonusCritFinal = bonusCritBase * (1 - criticalDamageReduction/100)
 *
 * Esta tabla sirve como:
 *  (1) documentación viva
 *  (2) baseline para seeds o plantillas
 *  (3) lista centralizada de claves para render/UI.
 */

export const RESISTANCE_KEYS = [
  "fire",
  "ice",
  "lightning",
  "poison",
  "sleep",
  "paralysis",
  "confusion",
  "fear",
  "dark",
  "holy",
  "stun",
  "bleed",
  "curse",
  "knockback",
  "criticalChanceReduction",
  "criticalDamageReduction",
] as const;

export type ResistanceKey = (typeof RESISTANCE_KEYS)[number];
export type ResistancesMap = Record<ResistanceKey, number>;

/** Baseline propuesto (puedes ajustarlo a tu gusto). */
export const DEFAULT_RESISTANCES: ResistancesMap = {
  fire: 6,
  ice: 6,
  lightning: 5,
  poison: 2,
  sleep: 4,
  paralysis: 3,
  confusion: 5,
  fear: 4,
  dark: 6,
  holy: 4,
  stun: 3,
  bleed: 2,
  curse: 7,
  knockback: 3,
  criticalChanceReduction: 2,
  criticalDamageReduction: 2,
};

/** Descripciones rápidas para tooltips/ayuda in-game. */
export const RESISTANCE_DOCS: Record<ResistanceKey, string> = {
  fire: "Reduce probabilidad/daño de quemaduras.",
  ice: "Reduce probabilidad de congelación/ralentización.",
  lightning: "Reduce probabilidad de choque/aturdimiento eléctrico.",
  poison: "Reduce probabilidad y/o DPS de veneno.",
  sleep: "Reduce probabilidad de quedar dormido.",
  paralysis: "Reduce probabilidad de inmovilización.",
  confusion: "Reduce probabilidad de confusión.",
  fear: "Reduce probabilidad de pánico/huida (afecta crítico).",
  dark: "Reduce daño/efectos de magia oscura.",
  holy: "Reduce daño/efectos de magia sagrada.",
  stun: "Reduce probabilidad/duración de aturdimiento.",
  bleed: "Reduce probabilidad y/o DPS por sangrado.",
  curse: "Reduce probabilidad/penalidad de maldición.",
  knockback: "Reduce probabilidad/intensidad de empuje.",
  criticalChanceReduction: "Resta a la CHANCE de crítico del atacante.",
  criticalDamageReduction: "Resta al BONUS de daño crítico del atacante.",
};

/** Utilidad defensiva para mantener en 0–100 (enteros). */
export function clampRes(v: number): number {
  const n = Math.trunc(Number(v) || 0);
  return Math.max(0, Math.min(100, n));
}

/** Normaliza un bloque de resistencias: completa faltantes con 0 y clampa 0–100. */
export function normalizeResistances(src: Partial<ResistancesMap> | null | undefined): ResistancesMap {
  const out = {} as ResistancesMap;
  for (const k of RESISTANCE_KEYS) {
    out[k] = clampRes((src as any)?.[k]);
  }
  return out;
}

/** Suma segura (entera) entre dos mapas y clampa cada entrada a 0–100. */
export function mergeResistances(a: Partial<ResistancesMap>, b: Partial<ResistancesMap>): ResistancesMap {
  const A = normalizeResistances(a);
  const B = normalizeResistances(b);
  const out = {} as ResistancesMap;
  for (const k of RESISTANCE_KEYS) {
    out[k] = clampRes(A[k] + B[k]);
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────
 * Auto-escalado por nivel (pequeño y conservador, sin críticos)
 * ──────────────────────────────────────────────────────────────
 * Regla simple:
 *   - +1 punto cada STEP niveles completos (desde nivel 1 no suma).
 *   - No aplica a criticalChanceReduction / criticalDamageReduction
 *     para no matar los builds de crítico con el puro nivel.
 *   - Todo queda en enteros y clampa a 0..100.
 */

export const RES_LEVEL_STEP = 6;     // cada 6 niveles…
export const RES_PER_STEP = 1;       // …+1 punto

/** Bonus total por nivel (entero). Ej: lvl=13 → floor((13-1)/6)*1 = 2 */
export function computeLevelResBonus(level: number): number {
  const lvl = Math.max(1, Math.trunc(level || 1));
  return Math.max(0, Math.floor((lvl - 1) / RES_LEVEL_STEP) * RES_PER_STEP);
}

/** Claves que sí reciben auto-bonus por nivel. */
export const AUTO_LEVEL_RES_KEYS: ResistanceKey[] = [
  "fire",
  "ice",
  "lightning",
  "poison",
  "sleep",
  "paralysis",
  "confusion",
  "fear",
  "dark",
  "holy",
  "stun",
  "bleed",
  "curse",
  "knockback",
];

/**
 * Aplica el bonus de nivel a un mapa base (sin tocar críticos).
 * Útil al “construir” el snapshot de combate; no hace falta persistirlo.
 */
export function withLevelResistances(base: Partial<ResistancesMap>, level: number): ResistancesMap {
  const out = normalizeResistances(base);
  const bonus = computeLevelResBonus(level);
  if (bonus <= 0) return out;

  for (const k of AUTO_LEVEL_RES_KEYS) {
    out[k] = clampRes(out[k] + bonus);
  }
  // críticos quedan tal cual
  return out;
}

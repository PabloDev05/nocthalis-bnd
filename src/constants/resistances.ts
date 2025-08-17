/**
 * Resistencias del sistema de combate.
 *
 * Escala sugerida: 0–100 (porcentaje). 0 = sin resistencia; 100 = inmune.
 * Fórmula típica (ejemplo para proc de estado): chanceEfectiva = chanceBase * (1 - resistencia/100).
 * Para reducción de daño crítico: valor final = base * (1 - criticalDamageReduction/100).
 *
 * Esta tabla sirve como: (1) documentación viva, (2) baseline para seeds o templates,
 * (3) lista centralizada de claves para render/UI.
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

/** Baseline propuesto (puede usarse para seeds / chooseClass / plantillas de clase). */
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
  fear: "Reduce probabilidad de pánico/huida.",
  dark: "Reduce daño/efectos de magia oscura.",
  holy: "Reduce daño/efectos de magia sagrada.",
  stun: "Reduce probabilidad/duración de aturdimiento.",
  bleed: "Reduce probabilidad y/o DPS por sangrado.",
  curse: "Reduce probabilidad/penalidad de maldición.",
  knockback: "Reduce probabilidad/intensidad de empuje.",
  criticalChanceReduction: "Resta a la CHANCE de crítico del atacante.",
  criticalDamageReduction: "Resta al BONUS de daño crítico del atacante.",
};

/** Utilidad defensiva para mantener en 0–100. */
export function clampRes(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// src/services/progression.service.ts

/** Nivel máximo configurable (por env o 100 por defecto) */
export const MAX_LEVEL: number = Number(process.env.MAX_LEVEL ?? 100);

/** Estructura de métricas de progresión que devolvemos a la UI / controladores */
export type ProgressionMetrics = {
  /** Nivel EFECTIVO calculado a partir de la XP acumulada (no necesariamente igual al de DB) */
  level: number;
  /** Si el nivel efectivo es mayor al que está guardado en DB, cuántos niveles “pendientes” hay */
  pendingLevels: number;
  /** XP acumulada al inicio del nivel actual (curva acumulada) */
  currentLevelAt: number;
  /** XP acumulada necesaria para alcanzar el siguiente nivel (o igual a currentLevelAt si es el máximo) */
  nextLevelAt: number;
  /** XP ganada dentro del nivel actual */
  xpSinceLevel: number;
  /** XP total que abarca el nivel actual */
  xpForThisLevel: number;
  /** XP que falta para el siguiente nivel (0 si es el máximo) */
  xpToNext: number;
  /** Progreso 0..1 dentro del nivel actual (1 si es el máximo) */
  xpPercent: number;
  /** Bandera de si estamos en el nivel tope */
  isMaxLevel: boolean;
};

/**
 * XP ACUMULADA requerida para ALCANZAR el nivel `level`.
 * - level = 1 → 0 (inicio)
 * - level >= 2 → 100 + level^2 * 20  (curva usada en tu juego)
 */
export function xpNeededFor(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 + level * level * 20);
}

/**
 * Calcula la progresión **efectiva** a partir de la XP real.
 * - NO modifica la base de datos.
 * - Ajusta el nivel “efectivo” haciendo los `while` contra la curva.
 * - Devuelve además `pendingLevels` por si quieres mostrar un “+N” discreto.
 */
export function computeProgression(experience: number, levelInDb: number, maxLevel: number = MAX_LEVEL): ProgressionMetrics {
  const exp = Math.max(0, Math.floor(experience ?? 0));
  const lvlDb = Math.max(1, Math.floor(levelInDb ?? 1));

  // Sube el nivel efectivo según la XP (sin tocar DB)
  let level = lvlDb;
  while (level < maxLevel && exp >= xpNeededFor(level + 1)) {
    level += 1;
  }

  const isMaxLevel = level >= maxLevel;
  const currentLevelAt = xpNeededFor(level);
  const nextLevelAt = isMaxLevel ? currentLevelAt : xpNeededFor(level + 1);

  const xpForThisLevel = Math.max(1, nextLevelAt - currentLevelAt);
  const xpSinceLevel = Math.max(0, exp - currentLevelAt);
  const xpToNext = isMaxLevel ? 0 : Math.max(0, nextLevelAt - exp);
  const xpPercent = isMaxLevel ? 1 : Math.min(1, xpSinceLevel / xpForThisLevel);

  return {
    level,
    pendingLevels: Math.max(0, level - lvlDb),
    currentLevelAt,
    nextLevelAt,
    xpSinceLevel,
    xpForThisLevel,
    xpToNext,
    xpPercent,
    isMaxLevel,
  };
}

/**
 * Aplica XP a un documento de Character (mongoose), sube niveles respetando MAX_LEVEL y guarda.
 * Devuelve el nuevo nivel/XP y un array con los niveles alcanzados.
 */
export async function applyExperience(doc: any, gained: number) {
  const add = Math.max(0, Number(gained || 0));
  doc.experience = Math.max(0, Number(doc.experience ?? 0)) + add;

  let lvl = Math.max(1, Number(doc.level ?? 1));
  const levelUps: number[] = [];

  while (lvl < MAX_LEVEL && doc.experience >= xpNeededFor(lvl + 1)) {
    lvl += 1;
    levelUps.push(lvl);
  }

  // Si llegó al tope, capea la XP al umbral del nivel máximo (barra al 100%)
  if (lvl >= MAX_LEVEL) {
    doc.experience = Math.min(doc.experience, xpNeededFor(MAX_LEVEL));
  }

  doc.level = lvl;
  await doc.save();

  return { level: doc.level, experience: doc.experience, levelUps };
}

// src/services/progression.service.ts
/** Nivel máximo (entero). Si no está en env, usa 100. */
export const MAX_LEVEL: number = (() => {
  const raw = process.env.MAX_LEVEL;
  const n = raw ? parseInt(raw, 10) : 100;
  return Number.isFinite(n) && n >= 1 ? n : 100;
})();

/** Métricas de progresión (todo en enteros) */
export type ProgressionMetrics = {
  level: number; // nivel efectivo calculado con la XP
  pendingLevels: number; // cuántos niveles supera al nivel guardado en DB
  currentLevelAt: number; // XP acumulada al inicio del nivel actual
  nextLevelAt: number; // XP acumulada necesaria para el siguiente nivel
  xpSinceLevel: number; // XP ganada dentro del nivel actual
  xpForThisLevel: number; // total de XP que abarca el nivel actual
  xpToNext: number; // XP restante para subir (0 si es el máximo)
  xpPercentInt: number; // progreso 0..100 (entero)
  isMaxLevel: boolean; // true si está en el nivel tope
};

/**
 * XP ACUMULADA requerida para ALCANZAR el nivel `level`.
 * level = 1 → 0;  level >= 2 → 100 + level^2 * 20
 */
export function xpNeededFor(level: number): number {
  if (level <= 1) return 0;
  return 100 + level * level * 20; // entero
}

/**
 * Calcula la progresión efectiva desde XP real (no toca DB).
 * Devuelve solo enteros y porcentaje 0..100.
 */
export function computeProgression(experience: number, levelInDb: number, maxLevel: number = MAX_LEVEL): ProgressionMetrics {
  const expRaw = Math.max(0, Math.trunc(experience ?? 0));
  const lvlDb = Math.max(1, Math.trunc(levelInDb ?? 1));

  // Si ya alcanzó el tope, capea la XP a la barra llena del tope
  const capAt = xpNeededFor(maxLevel);
  const exp = Math.min(expRaw, capAt);

  // Sube nivel efectivo mientras la XP alcance el siguiente umbral
  let level = lvlDb;
  while (level < maxLevel && exp >= xpNeededFor(level + 1)) {
    level += 1;
  }

  const isMaxLevel = level >= maxLevel;
  const currentLevelAt = xpNeededFor(level);
  const nextLevelAt = isMaxLevel ? currentLevelAt : xpNeededFor(level + 1);

  const xpForThisLevel = Math.max(1, nextLevelAt - currentLevelAt); // ancho del nivel
  let xpSinceLevel = Math.max(0, exp - currentLevelAt); // progreso dentro del nivel
  if (isMaxLevel) xpSinceLevel = Math.min(xpSinceLevel, xpForThisLevel);

  const xpToNext = isMaxLevel ? 0 : Math.max(0, nextLevelAt - exp);

  // Porcentaje entero 0..100 (sin floats)
  const xpPercentInt = isMaxLevel ? 100 : Math.min(100, Math.trunc((xpSinceLevel * 100) / xpForThisLevel));

  return {
    level,
    pendingLevels: Math.max(0, level - lvlDb),
    currentLevelAt,
    nextLevelAt,
    xpSinceLevel,
    xpForThisLevel,
    xpToNext,
    xpPercentInt,
    isMaxLevel,
  };
}

/**
 * Aplica XP a un Character (mongoose), sube niveles hasta MAX_LEVEL y guarda.
 * Retorna nuevos valores + niveles alcanzados (enteros).
 */
export async function applyExperience(doc: any, gained: number) {
  const add = Math.max(0, Math.trunc(gained || 0));
  doc.experience = Math.max(0, Math.trunc(doc.experience ?? 0)) + add;

  let lvl = Math.max(1, Math.trunc(doc.level ?? 1));
  const levelUps: number[] = [];

  while (lvl < MAX_LEVEL && doc.experience >= xpNeededFor(lvl + 1)) {
    lvl += 1;
    levelUps.push(lvl);
  }

  // Si llegó al tope, capea la XP al umbral del nivel máximo
  if (lvl >= MAX_LEVEL) {
    doc.experience = Math.min(doc.experience, xpNeededFor(MAX_LEVEL));
  }

  doc.level = lvl;
  await doc.save();

  return { level: doc.level, experience: doc.experience, levelUps };
}

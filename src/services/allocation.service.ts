// src/services/allocation.service.ts
// Lógica de asignación de puntos por nivel: cálculo de disponibles y aplicación de coeficientes.
// NO requiere cambiar el schema: calcula "gastados" como (stats actuales - baseStats de la clase).
// Incluye caps suaves: critChance y evasion.

const DBG = process.env.DEBUG_ALLOCATION === "1";

import type { Document } from "mongoose";
import type { BaseStats, CombatStats } from "../interfaces/character/CharacterClass.interface";
import { CLASS_COEFFS, POINTS_PER_LEVEL, STAT_CAPS, type ClassKey, type BaseKey } from "../constants/allocateCoeffs";

// --- helpers ---------------------------------------------------------------

function safeNum(n: any, d = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : d;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Trata "dexterity" como alias de "agility" para aportes (puede venir cualquiera en el body)
function normalizeKey(k: string): BaseKey | null {
  const map: Record<string, BaseKey> = {
    strength: "strength",
    agility: "agility",
    dexterity: "dexterity", // lo tratamos igual que agility más abajo
    intelligence: "intelligence",
    vitality: "vitality",
    endurance: "endurance",
    luck: "luck",
  };
  return (map[k] ?? null) as BaseKey | null;
}

// Suma enteros por stat a partir de un objeto { stat: puntos }
export function sumAllocations(alloc: Record<string, number>): number {
  return Object.values(alloc || {}).reduce((a, b) => a + (safeNum(b, 0) | 0), 0);
}

/**
 * Calcula cuántos puntos ya gastó el jugador comparando sus "stats" actuales
 * con los "baseStats" de su clase. Ignora resistencias y combatStats.
 */
export function computeSpentPoints(current: BaseStats, classBase: BaseStats): number {
  let spent = 0;
  for (const key of Object.keys(classBase) as (keyof BaseStats)[]) {
    const cur = safeNum((current as any)[key], 0);
    const base = safeNum((classBase as any)[key], 0);
    if (["strength", "dexterity", "intelligence", "vitality", "agility", "endurance", "luck"].includes(key)) {
      spent += Math.max(0, Math.floor(cur - base));
    }
  }
  return spent;
}

/**
 * Puntos disponibles = (level - 1) * POINTS_PER_LEVEL - spent.
 * Nunca negativo.
 */
export function computeAvailablePoints(level: number, current: BaseStats, classBase: BaseStats, perLevel = POINTS_PER_LEVEL): number {
  const spent = computeSpentPoints(current, classBase);
  const total = Math.max(0, (Math.max(1, Math.floor(level)) - 1) * perLevel);
  const avail = Math.max(0, total - spent);
  if (DBG) console.log("[ALLOC] computeAvailablePoints:", { level, perLevel, spent, total, avail });
  return avail;
}

// Aplica coeficientes por clase, devolviendo {deltaStats, deltaCombat}
function buildDeltasFor(className: ClassKey, alloc: Record<BaseKey, number>) {
  const coeff = CLASS_COEFFS[className] || CLASS_COEFFS["Guerrero"];
  const deltaStats: Partial<BaseStats> = {};
  const deltaCombat: Partial<CombatStats> = {};

  // dexterity como alias de agility: si vino dex, sumamos también a 'agility' para aporte
  const effectiveAlloc: Record<BaseKey, number> = { ...alloc };
  if (alloc.dexterity && !alloc.agility) {
    // no toco 'stats.agility' del personaje, solo uso para aporte de combat
    // (el incremento en base stat se hará en el stat exacto que invirtió: dexterity)
  }

  for (const k of Object.keys(alloc) as BaseKey[]) {
    const points = safeNum(alloc[k], 0) | 0;
    if (points <= 0) continue;

    const del = coeff[k] || {};
    // Combat
    if (del.combat) {
      for (const [ck, v] of Object.entries(del.combat)) {
        const inc = safeNum(v, 0) * points;
        (deltaCombat as any)[ck] = safeNum((deltaCombat as any)[ck], 0) + inc;
      }
    }
    // Base (ej: defensas)
    if (del.stats) {
      for (const [sk, v] of Object.entries(del.stats)) {
        const inc = safeNum(v, 0) * points;
        (deltaStats as any)[sk] = safeNum((deltaStats as any)[sk], 0) + inc;
      }
    }

    // Si invirtió en DEX, replicamos los aportes de AGI (sólo a combat) — identidad arquetipo dex/agi
    if (k === "dexterity") {
      const agiDel = coeff["agility"]?.combat || {};
      for (const [ck, v] of Object.entries(agiDel)) {
        const inc = safeNum(v, 0) * points;
        (deltaCombat as any)[ck] = safeNum((deltaCombat as any)[ck], 0) + inc;
      }
    }
  }

  return { deltaStats, deltaCombat };
}

/**
 * Aplica una asignación al documento de Character (stats + combatStats).
 * No guarda: el controller se encarga de doc.save().
 */
export function applyAllocationsToCharacter(doc: Document & { stats: BaseStats; combatStats: CombatStats; classId?: any }, className: ClassKey, alloc: Record<string, number>) {
  // Normalizar claves y filtrar basura
  const clean: Record<BaseKey, number> = {} as any;
  for (const [k, v] of Object.entries(alloc || {})) {
    const nk = normalizeKey(k);
    const iv = safeNum(v, 0) | 0;
    if (!nk || iv <= 0) continue;
    clean[nk] = (clean[nk] || 0) + iv;
  }

  if (Object.keys(clean).length === 0) {
    if (DBG) console.log("[ALLOC] Nada para aplicar.");
    return { applied: {}, deltaStats: {}, deltaCombat: {} };
  }

  const { deltaStats, deltaCombat } = buildDeltasFor(className, clean);

  // 1) Aumentar base stats en lo invertido EXACTO (el usuario subió ese stat)
  for (const [k, v] of Object.entries(clean)) {
    const cur = safeNum((doc.stats as any)[k], 0);
    (doc.stats as any)[k] = cur + (v as number);
  }

  // 2) Aplicar deltas de defensas base (si los hay)
  for (const [k, inc] of Object.entries(deltaStats)) {
    const cur = safeNum((doc.stats as any)[k], 0);
    (doc.stats as any)[k] = cur + safeNum(inc, 0);
  }

  // 3) Aplicar deltas a combatStats
  for (const [k, inc] of Object.entries(deltaCombat)) {
    const cur = safeNum((doc.combatStats as any)[k], 0);
    (doc.combatStats as any)[k] = cur + safeNum(inc, 0);
  }

  // 4) Caps suaves (anti min-max duro)
  if (doc.combatStats) {
    if (typeof doc.combatStats.criticalChance === "number") {
      doc.combatStats.criticalChance = clamp(doc.combatStats.criticalChance, 0, STAT_CAPS.criticalChance);
    }
    if (typeof doc.combatStats.evasion === "number") {
      doc.combatStats.evasion = clamp(doc.combatStats.evasion, 0, STAT_CAPS.evasion);
    }
    if (typeof doc.combatStats.damageReduction === "number") {
      doc.combatStats.damageReduction = clamp(doc.combatStats.damageReduction, 0, STAT_CAPS.damageReduction);
    }
  }

  if (DBG) {
    console.log("[ALLOC] Aplicado:", {
      className,
      clean,
      deltaStats,
      deltaCombat,
      result: { stats: doc.stats, combatStats: doc.combatStats },
    });
  }

  return { applied: clean, deltaStats, deltaCombat };
}

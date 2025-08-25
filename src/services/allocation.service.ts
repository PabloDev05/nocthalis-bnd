// src/services/allocation.service.ts
// Lógica de asignación de puntos (con soft-cap y cap duro)

import type { Document } from "mongoose";
import type { BaseStats, CombatStats } from "../interfaces/character/CharacterClass.interface";
import { CLASS_COEFFS, POINTS_PER_LEVEL, STAT_CAPS, SOFTCAP_K, type ClassKey, type BaseKey, type PerPointDelta } from "../battleSystem/constants/allocateCoeffs"; // <-- ojo al nombre del archivo

const DBG = process.env.DEBUG_ALLOCATION === "1";

/* ---------------- utils numéricos ---------------- */
function safeNum(n: any, d = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : d;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
/** Curva suave hacia el cap: resultado ∈ [0..CAP] */
function softCap(raw: number, CAP: number, K: number) {
  if (raw <= 0) return 0;
  if (K <= 0) return clamp(raw, 0, CAP);
  const curved = CAP * (1 - Math.exp(-raw / K));
  return Math.min(curved, CAP);
}

const ALLOWED_KEYS: BaseKey[] = ["strength", "dexterity", "intelligence", "vitality", "endurance", "luck"];

/* ---------------- puntos disponibles ---------------- */
export function sumAllocations(alloc: Record<string, number>): number {
  return Object.values(alloc || {}).reduce((a, b) => a + (safeNum(b, 0) | 0), 0);
}

export function computeSpentPoints(current: BaseStats, classBase: BaseStats): number {
  let spent = 0;
  for (const key of ALLOWED_KEYS) {
    const cur = safeNum((current as any)[key], 0);
    const base = safeNum((classBase as any)[key], 0);
    spent += Math.max(0, Math.floor(cur - base));
  }
  return spent;
}

export function computeAvailablePoints(level: number, current: BaseStats, classBase: BaseStats, perLevel = POINTS_PER_LEVEL): number {
  const spent = computeSpentPoints(current, classBase);
  const total = Math.max(0, (Math.max(1, Math.floor(level)) - 1) * perLevel);
  const avail = Math.max(0, total - spent);
  if (DBG) console.log("[ALLOC] computeAvailablePoints:", { level, perLevel, spent, total, avail });
  return avail;
}

/* ---------------- deltas por clase ---------------- */
function buildDeltasFor(className: ClassKey, alloc: Record<BaseKey, number>) {
  const coeff = CLASS_COEFFS[className] || CLASS_COEFFS["Guerrero"];
  const deltaStats: Partial<BaseStats> = {};
  const deltaCombat: Partial<CombatStats> = {};

  for (const k of Object.keys(alloc) as BaseKey[]) {
    const points = safeNum(alloc[k], 0) | 0;
    if (points <= 0) continue;

    // ⬅️ FIX: tipamos como PerPointDelta para evitar la unión de literales
    const del = (coeff[k] ?? {}) as PerPointDelta;

    // combat
    const delCombat = (del.combat ?? {}) as Partial<CombatStats>;
    for (const [ck, v] of Object.entries(delCombat)) {
      const inc = safeNum(v, 0) * points;
      (deltaCombat as any)[ck] = safeNum((deltaCombat as any)[ck], 0) + inc;
    }

    // stats (defensas derivadas)
    const delStats = (del.stats ?? {}) as Partial<BaseStats>;
    for (const [sk, v] of Object.entries(delStats)) {
      const inc = safeNum(v, 0) * points;
      (deltaStats as any)[sk] = safeNum((deltaStats as any)[sk], 0) + inc;
    }
  }

  return { deltaStats, deltaCombat };
}

/* ---------------- aplicación ---------------- */
export function applyAllocationsToCharacter(doc: Document & { stats: BaseStats; combatStats: CombatStats; classId?: any }, className: ClassKey, alloc: Record<string, number>) {
  // Garantizamos objetos
  (doc as any).stats = (doc as any).stats || ({} as BaseStats);
  (doc as any).combatStats = (doc as any).combatStats || ({} as CombatStats);

  // Filtramos solo claves permitidas; enteros y > 0
  const clean: Record<BaseKey, number> = {} as any;
  for (const [k, v] of Object.entries(alloc || {})) {
    if (!ALLOWED_KEYS.includes(k as BaseKey)) continue;
    const iv = safeNum(v, 0) | 0;
    if (iv <= 0) continue;
    const key = k as BaseKey;
    clean[key] = (clean[key] || 0) + iv;
  }

  if (Object.keys(clean).length === 0) {
    if (DBG) console.log("[ALLOC] Nada para aplicar.");
    return { applied: {}, deltaStats: {}, deltaCombat: {} };
  }

  const { deltaStats, deltaCombat } = buildDeltasFor(className, clean);

  // 1) Subir puntos en base (enteros)
  for (const [k, v] of Object.entries(clean)) {
    const cur = safeNum((doc.stats as any)[k], 0);
    (doc.stats as any)[k] = Math.floor(cur + (v as number));
  }

  // 2) Incrementos secundarios a base (defensas) — enteros
  for (const [k, inc] of Object.entries(deltaStats)) {
    const cur = safeNum((doc.stats as any)[k], 0);
    (doc.stats as any)[k] = Math.floor(cur + safeNum(inc, 0));
  }

  // 3) Incrementos a combat (pueden ser decimales)
  for (const [k, inc] of Object.entries(deltaCombat)) {
    const cur = safeNum((doc.combatStats as any)[k], 0);
    (doc.combatStats as any)[k] = cur + safeNum(inc, 0);
  }

  // 4) Soft-cap → cap duro
  if (doc.combatStats) {
    if (typeof doc.combatStats.criticalChance === "number") {
      const curved = softCap(doc.combatStats.criticalChance, STAT_CAPS.criticalChance, SOFTCAP_K.criticalChance);
      doc.combatStats.criticalChance = clamp(curved, 0, STAT_CAPS.criticalChance);
    }
    if (typeof doc.combatStats.evasion === "number") {
      const curved = softCap(doc.combatStats.evasion, STAT_CAPS.evasion, SOFTCAP_K.evasion);
      doc.combatStats.evasion = clamp(curved, 0, STAT_CAPS.evasion);
    }
    if (typeof doc.combatStats.damageReduction === "number") {
      const curved = softCap(doc.combatStats.damageReduction, STAT_CAPS.damageReduction, SOFTCAP_K.damageReduction);
      doc.combatStats.damageReduction = clamp(curved, 0, STAT_CAPS.damageReduction);
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

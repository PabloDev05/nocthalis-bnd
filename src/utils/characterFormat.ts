// src/utils/characterFormat.ts
// Formatea combatStats para RESPUESTA (no muta DB) y calcula availablePoints si hay baseStats poblado.

import type { CombatStats, BaseStats } from "../interfaces/character/CharacterClass.interface";
import { computeAvailablePoints } from "../services/allocation.service";

function toFixedN(n: any, places: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const p = Math.pow(10, places);
  return Math.round(v * p) / p;
}

/**
 * Redondeo amable para UI (no persistir este resultado en DB).
 * - Enteros para valores “discretos”.
 * - 1 decimal para potencias (AP/MP/crit dmg bonus).
 * - 2 decimales para porcentajes finos (AS/ev/crit chance/DR/speed).
 */
export function roundCombatStatsForResponse(cs: Partial<CombatStats>): CombatStats {
  const c: any = { ...(cs || {}) };

  // Discretos → enteros
  c.maxHP = Math.round(c.maxHP ?? 0);
  c.blockChance = Math.round(c.blockChance ?? 0);
  c.blockValue = Math.round(c.blockValue ?? 0);
  c.lifeSteal = Math.round(c.lifeSteal ?? 0);

  // Potencias → 1 decimal
  c.attackPower = toFixedN(c.attackPower, 1);
  c.magicPower = toFixedN(c.magicPower, 1);
  c.criticalDamageBonus = toFixedN(c.criticalDamageBonus, 1);

  // Porcentajes finos → 2 decimales
  c.attackSpeed = toFixedN(c.attackSpeed, 2);
  c.evasion = toFixedN(c.evasion, 2);
  c.criticalChance = toFixedN(c.criticalChance, 2);
  c.damageReduction = toFixedN(c.damageReduction, 2);
  c.movementSpeed = toFixedN(c.movementSpeed, 2);

  // Aseguramos presencia de todas las claves de CombatStats
  return {
    maxHP: c.maxHP ?? 0,
    attackPower: c.attackPower ?? 0,
    magicPower: c.magicPower ?? 0,
    criticalChance: c.criticalChance ?? 0,
    criticalDamageBonus: c.criticalDamageBonus ?? 0,
    attackSpeed: c.attackSpeed ?? 0,
    evasion: c.evasion ?? 0,
    blockChance: c.blockChance ?? 0,
    blockValue: c.blockValue ?? 0,
    lifeSteal: c.lifeSteal ?? 0,
    damageReduction: c.damageReduction ?? 0,
    movementSpeed: c.movementSpeed ?? 0,
  };
}

/**
 * Devuelve:
 *  - character: doc serializado con combatStats redondeado (no altera DB)
 *  - availablePoints: si hay baseStats de clase poblado, lo calcula; si no, undefined
 *
 * Nota: requiere que `doc.classId.baseStats` esté poblado para calcular puntos.
 */
export function formatCharacterForResponse(doc: any) {
  const raw = typeof doc?.toObject === "function" ? doc.toObject() : JSON.parse(JSON.stringify(doc));
  const baseStats: BaseStats | undefined = raw?.classId?.baseStats;

  const availablePoints = baseStats ? computeAvailablePoints(Number(raw.level ?? 1), raw.stats as BaseStats, baseStats) : undefined;

  if (raw.combatStats) {
    raw.combatStats = roundCombatStatsForResponse(raw.combatStats);
  }

  return { character: raw, availablePoints };
}

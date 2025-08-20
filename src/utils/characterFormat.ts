// src/utils/characterFormat.ts
// Redondea combatStats para RESPUESTA (no muta DB) y calcula availablePoints si hay baseStats.

import type { CombatStats, BaseStats } from "../interfaces/character/CharacterClass.interface";
import { computeAvailablePoints } from "../services/allocation.service";

function toFixedN(n: any, places: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const p = Math.pow(10, places);
  return Math.round(v * p) / p;
}

export function roundCombatStatsForResponse(cs: CombatStats): CombatStats {
  const c = { ...(cs as any) };

  // Enteros (se ven mejor así)
  c.maxHP = Math.round(c.maxHP ?? 0);
  c.blockChance = Math.round(c.blockChance ?? 0);
  c.lifeSteal = Math.round(c.lifeSteal ?? 0);
  c.manaSteal = Math.round(c.manaSteal ?? 0);

  // 1 decimal: números “grandes” que igual pueden tener paso fino
  c.attackPower = toFixedN(c.attackPower, 1);
  c.magicPower = toFixedN(c.magicPower, 1);
  c.criticalDamageBonus = toFixedN(c.criticalDamageBonus, 1);

  // 2 decimales: porcentajes/sensibles para UI
  c.attackSpeed = toFixedN(c.attackSpeed, 2);
  c.evasion = toFixedN(c.evasion, 2);
  c.criticalChance = toFixedN(c.criticalChance, 2);
  c.blockValue = toFixedN(c.blockValue, 2);
  c.damageReduction = toFixedN(c.damageReduction, 2);
  c.movementSpeed = toFixedN(c.movementSpeed, 2);

  return c as CombatStats;
}

/**
 * Devuelve:
 *  - character: doc serializado con combatStats redondeado (no altera DB)
 *  - availablePoints: si hay baseStats de clase, lo calcula; si no, undefined
 */
export function formatCharacterForResponse(doc: any) {
  // deep copy seguro
  const raw = typeof doc.toObject === "function" ? doc.toObject() : JSON.parse(JSON.stringify(doc));
  const baseStats: BaseStats | undefined = raw?.classId?.baseStats;

  const availablePoints = baseStats ? computeAvailablePoints(Number(raw.level ?? 1), raw.stats, baseStats) : undefined;

  if (raw.combatStats) {
    raw.combatStats = roundCombatStatsForResponse(raw.combatStats);
  }
  return { character: raw, availablePoints };
}

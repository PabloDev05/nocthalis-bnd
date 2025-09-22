// src/battleSystem/types/CombatEntity.ts
import type { BaseStats, Resistances } from "../../interfaces/character/CharacterClass.interface";

/* ──────────────────────────────────────────────────────────────────────────
 * Tipos
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Bloque de combate “raw” tal como suele venir de DB/UI:
 * - Los campos tipo porcentaje están en PUNTOS % (ej: 12 = 12%).
 * - El runner necesita fracciones 0..1, así que usamos el normalizador abajo.
 */
export type RawCombatStats = {
  maxHP: number;            // entero
  attackPower: number;      // entero
  magicPower: number;       // entero
  evasion: number;          // puntos % (0..100)
  blockChance: number;      // puntos % (0..100)
  damageReduction: number;  // puntos % (0..100)
  criticalChance: number;   // puntos % (0..100)
  criticalDamageBonus: number; // puntos % (ej: 35 = +35%)
  attackSpeed: number;      // entero/ticks (tu motor define la unidad)
};

/**
 * Entidad runtime del motor (normalizada para el runner).
 * - Los porcentajes están en 0..1.
 * - criticalDamageBonus es fracción: 0.5 = +50%.
 */
export interface CombatEntity {
  id: string;
  name: string;
  level: number;

  stats: BaseStats;         // incluye constitution (NO hay vitality)
  resistances: Resistances;

  combat: {
    maxHP: number;
    attackPower: number;
    magicPower: number;
    evasion: number;           // 0..1
    blockChance: number;       // 0..1
    damageReduction: number;   // 0..1
    criticalChance: number;    // 0..1
    criticalDamageBonus: number; // 0.5 = +50%
    attackSpeed: number;       // entero/ticks
  };

  currentHP: number; // 0..maxHP
}

/* ──────────────────────────────────────────────────────────────────────────
 * Normalizadores y helpers
 * ────────────────────────────────────────────────────────────────────────── */

/** Convierte puntos % a fracción 0..1. Si ya viene en 0..1, lo respeta. */
export function pctToFrac(n: number): number {
  const x = Number.isFinite(n) ? Number(n) : 0;
  // Si parece ya fracción (≤1), lo clampemos; si no, interpretamos puntos %
  if (x <= 1) return Math.max(0, Math.min(1, x));
  return Math.max(0, Math.min(1, Math.floor(x) / 100));
}

/** De bloque “raw” (puntos %) → bloque listo para el runner (fracciones). */
export function normalizeCombat(raw: RawCombatStats): CombatEntity["combat"] {
  return {
    maxHP: Math.max(1, Math.floor(raw.maxHP || 1)),
    attackPower: Math.max(0, Math.floor(raw.attackPower || 0)),
    magicPower: Math.max(0, Math.floor(raw.magicPower || 0)),

    evasion: pctToFrac(raw.evasion || 0),
    blockChance: pctToFrac(raw.blockChance || 0),
    damageReduction: pctToFrac(raw.damageReduction || 0),
    criticalChance: pctToFrac(raw.criticalChance || 0),
    criticalDamageBonus: pctToFrac(raw.criticalDamageBonus || 0), // 35 → 0.35

    attackSpeed: Math.max(0, Math.floor(raw.attackSpeed || 0)),
  };
}

/** Crea una CombatEntity a partir de bloques crudos y percentiles en puntos %. */
export function makeCombatEntity(input: {
  id: string;
  name: string;
  level: number;
  stats: BaseStats;
  resistances: Resistances;
  combatRaw: RawCombatStats;
  currentHP?: number;
}): CombatEntity {
  const combat = normalizeCombat(input.combatRaw);
  const maxHP = combat.maxHP;
  const cur = Math.max(0, Math.floor(Number(input.currentHP ?? maxHP)));
  return {
    id: String(input.id),
    name: String(input.name),
    level: Math.max(1, Math.floor(Number(input.level || 1))),
    stats: input.stats,
    resistances: input.resistances,
    combat,
    currentHP: Math.min(maxHP, cur),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Utilidades puras e imperativas para daño/curación
 * ────────────────────────────────────────────────────────────────────────── */

/** Funcional/puro: no muta, devuelve una NUEVA entidad con el daño aplicado. */
export function applyDamage(e: CombatEntity, amount: number): CombatEntity {
  const dmg = Math.max(0, Math.floor(Number(amount) || 0));
  const nextHP = Math.max(0, e.currentHP - dmg);
  if (nextHP === e.currentHP) return e; // micro-opt
  return { ...e, currentHP: nextHP };
}

/** Imperativo: muta el objeto recibido. */
export function takeDamage(e: CombatEntity, amount: number): void {
  const dmg = Math.max(0, Math.floor(Number(amount) || 0));
  e.currentHP = Math.max(0, e.currentHP - dmg);
}

export function isAlive(e: CombatEntity): boolean {
  return e.currentHP > 0;
}

/** Curación (puro). */
export function applyHeal(e: CombatEntity, amount: number): CombatEntity {
  const heal = Math.max(0, Math.floor(Number(amount) || 0));
  const nextHP = Math.min(e.combat.maxHP, e.currentHP + heal);
  if (nextHP === e.currentHP) return e;
  return { ...e, currentHP: nextHP };
}

/** Curación (imperativo). */
export function heal(e: CombatEntity, amount: number): void {
  const heal = Math.max(0, Math.floor(Number(amount) || 0));
  e.currentHP = Math.min(e.combat.maxHP, e.currentHP + heal);
}

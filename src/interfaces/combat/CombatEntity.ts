// src/battleSystem/types/CombatEntity.ts
import type { BaseStats, Resistances } from "../../interfaces/character/CharacterClass.interface";

/** Entidad runtime del motor (solo datos, sin métodos). */
export interface CombatEntity {
  id: string;
  name: string;
  level: number;

  stats: BaseStats;
  resistances: Resistances;

  /** Porcentajes normalizados 0..1 para el runner. */
  combat: {
    maxHP: number;
    attackPower: number;
    magicPower: number;
    evasion: number; // 0..1
    blockChance: number; // 0..1
    damageReduction: number; // 0..1
    criticalChance: number; // 0..1
    criticalDamageBonus: number; // 0.5 = +50%
    attackSpeed: number;
  };

  currentHP: number; // 0..maxHP
}

/* ========= Helpers ========= */

/** Funcional/puro: no muta, devuelve una NUEVA entidad con el daño aplicado. */
export function applyDamage(e: CombatEntity, amount: number): CombatEntity {
  const dmg = Math.max(0, Math.floor(Number(amount) || 0));
  const nextHP = Math.max(0, e.currentHP - dmg);
  if (nextHP === e.currentHP) return e; // micro-opt: evita crear copia
  return { ...e, currentHP: nextHP };
}

/** Imperativo/mutable: “takeDamage” suena a método; acá muta el objeto recibido. */
export function takeDamage(e: CombatEntity, amount: number): void {
  const dmg = Math.max(0, Math.floor(Number(amount) || 0));
  e.currentHP = Math.max(0, e.currentHP - dmg);
}

export function isAlive(e: CombatEntity): boolean {
  return e.currentHP > 0;
}

/** Curación (ambas variantes por si te sirven). */
export function applyHeal(e: CombatEntity, amount: number): CombatEntity {
  const heal = Math.max(0, Math.floor(Number(amount) || 0));
  const nextHP = Math.min(e.combat.maxHP, e.currentHP + heal);
  if (nextHP === e.currentHP) return e;
  return { ...e, currentHP: nextHP };
}

export function heal(e: CombatEntity, amount: number): void {
  const heal = Math.max(0, Math.floor(Number(amount) || 0));
  e.currentHP = Math.min(e.combat.maxHP, e.currentHP + heal);
}

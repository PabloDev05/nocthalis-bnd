// src/battleSystem/entities/PlayerCharacter.ts
import type { CombatEntity } from "../../interfaces/combat/CombatEntity"; // ← ajustá si tu ruta difiere
import type { BaseStats, Resistances, CombatStats } from "../../interfaces/character/CharacterClass.interface";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const asInt = (x: any, d = 0) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n) : d;
};
/** Convierte “puntos %” a fracción (12 → 0.12). Si ya viene 0..1, lo respeta. */
const pctToFrac = (v: any) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  return n > 1 ? n / 100 : n;
};

/**
 * Representa a un personaje del jugador en combate.
 * - Mantiene `combatStats` tal cual vienen (puntos %).
 * - Expone `combat` normalizado (fracciones 0..1, enteros clamped) para el engine.
 * - No persiste nada; sólo muta `currentHP` localmente con `takeDamage`.
 */
export class PlayerCharacter implements CombatEntity {
  /** Bloque normalizado para el motor (0..1 en porcentajes). */
  public combat: CombatEntity["combat"];

  constructor(
    public id: string,
    public name: string,
    public level: number,
    public stats: BaseStats, // si tenés fate, viene acá
    public resistances: Resistances,
    /** Bloque “UI/DB” en puntos % (no normalizado) */
    public combatStats: CombatStats,
    /** Si no se pasa, arranca en maxHP de combatStats */
    public currentHP: number = Math.max(1, asInt((combatStats as any).maxHP ?? 1))
  ) {
    // Construimos el bloque que espera el runner (fracciones 0..1)
    const critBonusFrac =
      // si te llega “50” (puntos %) → 0.5; si ya te llega 0.5 → 0.5
      Math.max(0, pctToFrac((combatStats as any).criticalDamageBonus ?? 0.5));

    // Bonus opcional de crit por Fate (si usás fate; cap suave)
    const fate = asInt((stats as any)?.fate ?? 0);
    const fateCritBonus = Math.min(fate * 0.0025, 0.25); // +0.25% por punto, máx +25%

    this.combat = {
      maxHP: Math.max(1, asInt((combatStats as any).maxHP ?? 1)),
      attackPower: Math.max(0, asInt((combatStats as any).attackPower ?? 0)),
      magicPower: Math.max(0, asInt((combatStats as any).magicPower ?? 0)),
      evasion: clamp01(pctToFrac((combatStats as any).evasion)),
      blockChance: clamp01(pctToFrac((combatStats as any).blockChance)),
      damageReduction: clamp01(pctToFrac((combatStats as any).damageReduction)),
      criticalChance: clamp01(pctToFrac((combatStats as any).criticalChance) + fateCritBonus),
      criticalDamageBonus: critBonusFrac, // ej. 0.6 = +60% (el manager ya suma 1+bonus)
    };

    // Clamp HP al rango válido
    this.currentHP = Math.max(0, Math.min(this.currentHP, this.combat.maxHP));
  }

  /* ───────── Getters utilitarios (opcionales para UI) ───────── */

  get maxHP(): number {
    return this.combat.maxHP;
  }
  /** Compat: si desde UI guardaste min/max en combatStats (no estándar), lo exponemos. */
  get minDamage(): number {
    return asInt((this.combatStats as any).minDamage ?? (this.combatStats as any).damageMin ?? 0);
  }
  get maxDamage(): number {
    return asInt((this.combatStats as any).maxDamage ?? (this.combatStats as any).damageMax ?? 0);
  }
  get damageReduction(): number {
    return this.combat.damageReduction; // ya está normalizado 0..1
  }
  get blockChance(): number {
    return this.combat.blockChance; // 0..1
  }
  /** Chance de crit final con fate aplicado. */
  get critChance(): number {
    return this.combat.criticalChance; // 0..1
  }

  /* ───────── Mutadores de estado runtime ───────── */

  /** Daño directo (el manager ya aplicó block/DR/crit). */
  takeDamage(amount: number): void {
    const dmg = Math.max(0, asInt(amount));
    this.currentHP = Math.max(0, this.currentHP - dmg);
  }

  isAlive(): boolean {
    return this.currentHP > 0;
  }
}

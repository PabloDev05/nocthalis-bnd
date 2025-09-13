//entities/PlayerCharacter.ts
import { CombatEntity } from "../../interfaces/combat/CombatEntity";
import { BaseStats, Resistances, CombatStats } from "../../interfaces/character/CharacterClass.interface";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (v?: number) => clamp01((Number(v ?? 0) > 1 ? Number(v) / 100 : Number(v ?? 0)));

function asInt(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Represents a player character in combat. Pure in-memory, no DB.
 */
export class PlayerCharacter implements CombatEntity {
  /** Alias required by CombatEntity (kept for back-compat) */
  public combat: CombatStats;

  constructor(
    public id: string,
    public name: string,
    public level: number,
    public stats: BaseStats,            // should include stats.fate (number) if you have it
    public resistances: Resistances,
    public combatStats: CombatStats,
    public currentHP: number = combatStats.maxHP
  ) {
    this.combat = combatStats;
  }

  /** --- Normalized getters (numbers are always clean & clamped) --- */
  get maxHP(): number {
    return asInt(this.combatStats.maxHP ?? 0);
  }
  get minDamage(): number {
    return asInt((this.combatStats as any).minDamage ?? (this.combatStats as any).damageMin ?? 0);
  }
  get maxDamage(): number {
    return asInt((this.combatStats as any).maxDamage ?? (this.combatStats as any).damageMax ?? 0);
  }
  get damageReduction(): number {
    return pct((this.combatStats as any).damageReduction ?? (this.combatStats as any).dr ?? 0);
  }
  get blockChance(): number {
    return pct((this.combatStats as any).blockChance ?? (this.combatStats as any).block ?? 0);
  }
  get critChanceBase(): number {
    return pct((this.combatStats as any).criticalChance ?? (this.combatStats as any).critChance ?? (this.combatStats as any).crit ?? 0);
  }
  /**
   * Fate bonus (example): +0.25% crit per Fate point, capped at +25%.
   * Tune this to your design or remove if you prefer.
   */
  get fate(): number {
    return asInt((this.stats as any)?.fate ?? 0);
  }
  get critChance(): number {
    const bonus = Math.min(this.fate * 0.0025, 0.25); // 0.25% per Fate, max +25%
    return clamp01(this.critChanceBase + bonus);
  }

  /** Direct damage (no shields/heals here) */
  takeDamage(amount: number): void {
    this.currentHP = Math.max(0, this.currentHP - Math.max(0, asInt(amount)));
  }

  /** Is alive? */
  isAlive(): boolean {
    return this.currentHP > 0;
  }
}

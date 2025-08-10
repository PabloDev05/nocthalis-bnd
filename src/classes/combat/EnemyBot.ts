import { CombatEntity } from "../../interfaces/combat/CombatEntity";
import { BaseStats, Resistances, CombatStats } from "../../interfaces/character/CharacterClass.interface";

/**
 * Representa a un enemigo/bot genérico.
 * Igual que el player, pero te permite luego agregar IA, skills, etc.
 */
export class EnemyBot implements CombatEntity {
  constructor(
    public id: string,
    public name: string,
    public level: number,
    public stats: BaseStats,
    public resistances: Resistances,
    public combatStats: CombatStats,
    public currentHP: number = combatStats.maxHP
  ) {}

  takeDamage(amount: number): void {
    this.currentHP = Math.max(0, this.currentHP - amount);
  }

  isAlive(): boolean {
    return this.currentHP > 0;
  }
}

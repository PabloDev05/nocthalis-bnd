import { CombatEntity } from "../../interfaces/combat/CombatEntity";
import { BaseStats, Resistances, CombatStats } from "../../interfaces/character/CharacterClass.interface";

/**
 * Representa a un personaje jugador en el contexto del combate.
 * No accede a la base; recibe todos los datos listos (hidratado).
 */
export class PlayerCharacter implements CombatEntity {
  public combat: CombatStats; // requerido por CombatEntity (alias de combatStats)

  constructor(
    public id: string,
    public name: string,
    public level: number,
    public stats: BaseStats,
    public resistances: Resistances,
    public combatStats: CombatStats,
    // Por defecto arranca con la vida máxima del snapshot combatStats
    public currentHP: number = combatStats.maxHP
  ) {
    // Alias para cumplir la interfaz sin romper usos existentes de combatStats
    this.combat = combatStats;
  }

  /** Aplica daño directo (sin curas ni escudos aquí) */
  takeDamage(amount: number): void {
    this.currentHP = Math.max(0, this.currentHP - amount);
  }

  /** Devuelve si sigue vivo */
  isAlive(): boolean {
    return this.currentHP > 0;
  }
}

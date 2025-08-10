import { BaseStats, Resistances, CombatStats } from "../character/CharacterClass.interface";

/** Entidad mínima que puede participar en combate */
export interface CombatEntity {
  id: string;
  name: string;
  level: number;
  stats: BaseStats; // Atributos base (fuerza, etc.)
  resistances: Resistances; // Resistencias por tipo
  combatStats: CombatStats; // Stats de combate (HP, crit, etc.)
  currentHP: number; // HP actual durante el combate

  takeDamage(amount: number): void;
  isAlive(): boolean;
}

import { BaseStats, Resistances, CombatStats } from "../../interfaces/character/CharacterClass.interface";

// Stats base para pruebas rápidas
export const baseStatsGuerrero: BaseStats = {
  strength: 12,
  dexterity: 5,
  intelligence: 2,
  vitality: 10,
  physicalDefense: 9,
  magicalDefense: 3,
  luck: 2,
  endurance: 8,
};

export const resistenciasGuerrero: Resistances = {
  fire: 4,
  ice: 4,
  lightning: 2,
  poison: 3,
  sleep: 5,
  paralysis: 6,
  confusion: 4,
  fear: 5,
  dark: 2,
  holy: 4,
  stun: 7,
  bleed: 5,
  curse: 4,
  knockback: 6,
  criticalChanceReduction: 6,
  criticalDamageReduction: 5,
};

// Stats de combate para Guerrero
export const combatStatsGuerrero: CombatStats = {
  maxHP: 150,
  attackPower: 25,
  magicPower: 5,
  criticalChance: 5,
  criticalDamageBonus: 25,
  attackSpeed: 5,
  evasion: 5,
  blockChance: 15,
  blockValue: 20,
  lifeSteal: 2,
  damageReduction: 10,
  movementSpeed: 4,
};

// ===== Enemigo de prueba =====
export const baseStatsEnemigo: BaseStats = {
  strength: 5,
  dexterity: 4,
  intelligence: 1,
  vitality: 6,
  physicalDefense: 3,
  magicalDefense: 2,
  luck: 1,
  endurance: 4,
};

export const resistenciasEnemigo: Resistances = {
  fire: 2,
  ice: 1,
  lightning: 1,
  poison: 1,
  sleep: 1,
  paralysis: 1,
  confusion: 1,
  fear: 1,
  dark: 1,
  holy: 1,
  stun: 1,
  bleed: 1,
  curse: 1,
  knockback: 1,
  criticalChanceReduction: 1,
  criticalDamageReduction: 1,
};

export const combatStatsEnemigo: CombatStats = {
  maxHP: 50,
  attackPower: 8,
  magicPower: 0,
  criticalChance: 2,
  criticalDamageBonus: 10,
  attackSpeed: 3,
  evasion: 2,
  blockChance: 0,
  blockValue: 0,
  lifeSteal: 0,
  damageReduction: 2,
  movementSpeed: 3,
};

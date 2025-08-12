// src/constants/allocateCoeffs.ts
// Coeficientes por punto invertido en base stats -> increments en combatStats / (y algunas defensas base)
// SIN MP. Incluye caps suaves para evitar min-max extremo.

import type { CombatStats, BaseStats } from "../interfaces/character/CharacterClass.interface";

export const POINTS_PER_LEVEL = 5 as const;

// Caps suaves (totales en combatStats, no por fuente)
export const STAT_CAPS = {
  criticalChance: 50, // %
  evasion: 35, // %
  damageReduction: 60, // % (por si lo usas más adelante)
} as const;

export type ClassKey = "Guerrero" | "Asesino" | "Mago" | "Arquero";
export type BaseKey = keyof Pick<BaseStats, "strength" | "dexterity" | "intelligence" | "vitality" | "agility" | "endurance" | "luck">;

// Delta que aplica por CADA punto invertido en un base stat
export type PerPointDelta = {
  // cambios a combatStats
  combat?: Partial<
    Pick<
      CombatStats,
      "maxHP" | "attackPower" | "magicPower" | "criticalChance" | "criticalDamageBonus" | "attackSpeed" | "evasion" | "blockChance" | "blockValue" | "damageReduction" | "movementSpeed"
    >
  >;
  // cambios a base stats (ej: defensas)
  stats?: Partial<Pick<BaseStats, "physicalDefense" | "magicalDefense">>;
};

// Mapea aportes por clase.
// NOTA: "dexterity" se trata igual que "agility" (ver helper en allocation.service).
export const CLASS_COEFFS: Record<ClassKey, Record<BaseKey, PerPointDelta>> = {
  Guerrero: {
    strength: { combat: { attackPower: 1.5 } },
    agility: { combat: { evasion: 0.2, attackSpeed: 0.05, attackPower: 0.4 } },
    dexterity: { combat: { evasion: 0.2, attackSpeed: 0.05, attackPower: 0.4 } }, // alias de agility
    vitality: { combat: { maxHP: 11 } },
    endurance: { combat: { damageReduction: 0.3, blockValue: 0.2 }, stats: { physicalDefense: 0.7, magicalDefense: 0.3 } },
    luck: { combat: { criticalChance: 0.1, criticalDamageBonus: 0.3 } },
    intelligence: { combat: {} }, // sin aporte directo (dejar 0)
  },

  Asesino: {
    strength: { combat: { attackPower: 1.2 } }, // menos que 1.5
    agility: { combat: { evasion: 0.15, attackSpeed: 0.07, attackPower: 0.6 } }, // main
    dexterity: { combat: { evasion: 0.15, attackSpeed: 0.07, attackPower: 0.6, criticalChance: 0.02 } }, // +crit sutil
    vitality: { combat: { maxHP: 9 } },
    endurance: { combat: { damageReduction: 0.2, blockValue: 0.15 }, stats: { physicalDefense: 0.4, magicalDefense: 0.4 } },
    luck: { combat: { criticalChance: 0.35, criticalDamageBonus: 0.7 } }, // identidad de crítico
    intelligence: { combat: {} },
  },

  Mago: {
    strength: { combat: { attackPower: 0.2 } }, // leve base
    agility: { combat: { evasion: 0.15, attackSpeed: 0.03 } },
    dexterity: { combat: { evasion: 0.15, attackSpeed: 0.03, movementSpeed: 0.05 } }, // ligera movilidad
    vitality: { combat: { maxHP: 6 } },
    endurance: { combat: { damageReduction: 0.1 }, stats: { physicalDefense: 0.2, magicalDefense: 0.3 } },
    luck: { combat: { criticalChance: 0.25, criticalDamageBonus: 0.4 } },
    intelligence: { combat: { magicPower: 2.0 } }, // main
  },

  Arquero: {
    strength: { combat: { attackPower: 0.8 } },
    agility: { combat: { evasion: 0.35, attackSpeed: 0.25, movementSpeed: 0.1 } }, // main (ojo con cap de evasion)
    dexterity: { combat: { evasion: 0.35, attackSpeed: 0.25, movementSpeed: 0.1 } }, // alias de agility
    vitality: { combat: { maxHP: 8 } },
    endurance: { combat: { damageReduction: 0.2 }, stats: { physicalDefense: 0.3, magicalDefense: 0.2 } },
    luck: { combat: { criticalChance: 0.25, criticalDamageBonus: 0.5 } },
    intelligence: { combat: {} },
  },
};

// Coeficientes por punto invertido en base stats -> incrementos en combatStats
// Usamos solo "agility"; "dexterity" existe como clave vacía porque se mapea a AGI en el service.

import type { CombatStats, BaseStats } from "../interfaces/character/CharacterClass.interface";

export const POINTS_PER_LEVEL = 5 as const;

export const STAT_CAPS = {
  criticalChance: 50,
  evasion: 35,
  damageReduction: 60,
} as const;

export const SOFTCAP_K = {
  criticalChance: 120,
  evasion: 140,
  damageReduction: 150,
} as const;

export type ClassKey = "Guerrero" | "Asesino" | "Mago" | "Arquero";
export type BaseKey = keyof Pick<BaseStats, "strength" | "dexterity" | "intelligence" | "vitality" | "agility" | "endurance" | "luck">;

export type PerPointDelta = {
  combat?: Partial<
    Pick<
      CombatStats,
      "maxHP" | "attackPower" | "magicPower" | "criticalChance" | "criticalDamageBonus" | "attackSpeed" | "evasion" | "blockChance" | "blockValue" | "damageReduction" | "movementSpeed"
    >
  >;
  stats?: Partial<Pick<BaseStats, "physicalDefense" | "magicalDefense">>;
};

// Nota: dexterity: {} en todas las clases para satisfacer el tipo.
// La contribución real de DEX se maneja como alias de AGI en allocation.service.ts.
export const CLASS_COEFFS: Record<ClassKey, Record<BaseKey, PerPointDelta>> = {
  Guerrero: {
    strength: { combat: { attackPower: 1.5 } },
    agility: { combat: { evasion: 0.2, attackSpeed: 0.05, attackPower: 0.4 } },
    dexterity: {}, // alias a AGI (sin coef propio aquí)
    vitality: { combat: { maxHP: 11 } },
    endurance: {
      combat: { damageReduction: 0.25, blockValue: 0.2, blockChance: 0.05 },
      stats: { physicalDefense: 0.7, magicalDefense: 0.3 },
    },
    luck: { combat: { criticalChance: 0.1, criticalDamageBonus: 0.3 } },
    intelligence: { combat: {} },
  },

  Asesino: {
    strength: { combat: { attackPower: 1.2 } },
    agility: { combat: { evasion: 0.15, attackSpeed: 0.07, attackPower: 0.5 } },
    dexterity: {}, // alias a AGI
    vitality: { combat: { maxHP: 9 } },
    endurance: {
      combat: { damageReduction: 0.2, blockValue: 0.15 },
      stats: { physicalDefense: 0.4, magicalDefense: 0.4 },
    },
    luck: { combat: { criticalChance: 0.25, criticalDamageBonus: 0.6 } },
    intelligence: { combat: {} },
  },

  Mago: {
    strength: { combat: { attackPower: 0.15 } },
    agility: { combat: { evasion: 0.15, attackSpeed: 0.03 } },
    dexterity: {}, // alias a AGI
    vitality: { combat: { maxHP: 6 } },
    endurance: { combat: { damageReduction: 0.1 }, stats: { physicalDefense: 0.2, magicalDefense: 0.3 } },
    luck: { combat: { criticalChance: 0.25, criticalDamageBonus: 0.4 } },
    intelligence: { combat: { magicPower: 2.0 } },
  },

  Arquero: {
    strength: { combat: { attackPower: 0.8 } },
    agility: {
      combat: {
        evasion: 0.2, // +0.20% evasion por punto
        attackSpeed: 0.15, // +0.15 AS por punto
        movementSpeed: 0.06, // +0.06 MS por punto
        attackPower: 0.3, // NUEVO: +0.3 AP por punto (main stat aporta daño)
      },
    },
    dexterity: {}, // alias a AGI (sin coef propio aquí)
    vitality: { combat: { maxHP: 8 } },
    endurance: { combat: { damageReduction: 0.2 }, stats: { physicalDefense: 0.3, magicalDefense: 0.2 } },
    luck: { combat: { criticalChance: 0.25, criticalDamageBonus: 0.5 } },
    intelligence: { combat: {} },
  },
};

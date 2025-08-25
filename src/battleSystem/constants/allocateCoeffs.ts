// constants/allocateCoeff.ts
// Coeficientes por punto invertido en base stats -> incrementos en combatStats
import type { CombatStats, BaseStats } from "../../interfaces/character/CharacterClass.interface";

export const POINTS_PER_LEVEL = 5 as const;

export const STAT_CAPS = {
  criticalChance: 50, // tope duro (%)
  evasion: 35,
  damageReduction: 60,
} as const;

export const SOFTCAP_K = {
  criticalChance: 120, // constante de suavizado (mientras más grande, menos castiga)
  evasion: 140,
  damageReduction: 150,
} as const;

export type ClassKey = "Guerrero" | "Asesino" | "Mago" | "Arquero";

export type BaseKey = keyof Pick<BaseStats, "strength" | "dexterity" | "intelligence" | "vitality" | "endurance" | "luck">;

export type PerPointDelta = {
  combat?: Partial<
    Pick<
      CombatStats,
      "maxHP" | "attackPower" | "magicPower" | "criticalChance" | "criticalDamageBonus" | "attackSpeed" | "evasion" | "blockChance" | "blockValue" | "damageReduction" | "movementSpeed"
    >
  >;
  stats?: Partial<Pick<BaseStats, "physicalDefense" | "magicalDefense">>;
};

/**
 * Coeficientes por clase.
 * - Antes: evasion/AS/MS venían de agility (+ alias de dex).
 * - Ahora: TODO eso viene de dexterity directamente.
 * - Los deltas “porcentuales” (evasion, criticalChance, damageReduction) están en puntos % (0..100).
 */
export const CLASS_COEFFS = {
  Guerrero: {
    strength: { combat: { attackPower: 1.5 } },
    dexterity: { combat: { evasion: 0.2, attackSpeed: 0.05, attackPower: 0.4 } },
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
    dexterity: { combat: { evasion: 0.15, attackSpeed: 0.07, attackPower: 0.5 } },
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
    dexterity: { combat: { evasion: 0.15, attackSpeed: 0.03 } },
    vitality: { combat: { maxHP: 6 } },
    endurance: {
      combat: { damageReduction: 0.1 },
      stats: { physicalDefense: 0.2, magicalDefense: 0.3 },
    },
    luck: { combat: { criticalChance: 0.25, criticalDamageBonus: 0.4 } },
    intelligence: { combat: { magicPower: 2.0 } }, // solo Mago empuja Magic Power fuerte
  },

  Arquero: {
    strength: { combat: { attackPower: 0.8 } },
    dexterity: {
      combat: {
        evasion: 0.2,
        attackSpeed: 0.15,
        movementSpeed: 0.06,
        attackPower: 0.3,
      },
    },
    vitality: { combat: { maxHP: 8 } },
    endurance: {
      combat: { damageReduction: 0.2 },
      stats: { physicalDefense: 0.3, magicalDefense: 0.2 },
    },
    luck: { combat: { criticalChance: 0.25, criticalDamageBonus: 0.5 } },
    intelligence: { combat: {} },
  },
} satisfies Record<ClassKey, Record<BaseKey, PerPointDelta>>;

/** (Opcional) Normalizador de nombres de clase que vengan desde BD/UI */
export function getClassKey(raw?: string): ClassKey {
  const n = (raw ?? "").toLowerCase();
  if (n.includes("mago") || n.includes("mage")) return "Mago";
  if (n.includes("asesino") || n.includes("rogue")) return "Asesino";
  if (n.includes("arquero") || n.includes("ranger")) return "Arquero";
  return "Guerrero";
}

// src/battleSystem/constants/allocateCoeffs.ts

/**
 * Coeficientes de conversión al asignar puntos de atributos.
 *
 * - Globales por defecto; opcionalmente con overrides por clase (de tu seed).
 * - Deltas "porcentuales" (evasion, criticalChance, damageReduction, blockChance, attackSpeed)
 *   están en puntos % (0..100). Ej: 0.2 = +0.2 pts porcentuales por punto de atributo.
 * - "fate" NO modifica combate directo aquí; afecta procs (pasivas/ultimates) en el runner.
 */

export type AllocateDelta = {
  stats?: Partial<{
    physicalDefense: number;
    magicalDefense: number;
  }>;
  combat?: Partial<{
    // valores absolutos (no %)
    maxHP: number;
    attackPower: number;
    magicPower: number;
    blockValue: number;

    // valores en puntos %
    evasion: number; // %
    damageReduction: number; // %
    blockChance: number; // %
    criticalChance: number; // %
    criticalDamageBonus: number; // %

    attackSpeed: number; // %
  }>;
};

export type AllocateCoeffs = Record<"strength" | "dexterity" | "intelligence" | "vitality" | "endurance" | "luck" | "physicalDefense" | "magicalDefense" | "fate", AllocateDelta>;

/** Coeficientes base (aplican a todas las clases). Ajustalos libremente. */
export const GLOBAL_ALLOCATE_COEFFS: AllocateCoeffs = {
  strength: {
    combat: {
      attackPower: 0.8,
      blockValue: 0.1,
    },
  },
  dexterity: {
    combat: {
      evasion: 0.18,
      attackSpeed: 0.06,
      attackPower: 0.25,
      criticalChance: 0.04,
    },
  },
  intelligence: {
    combat: {
      magicPower: 1.0,
      criticalChance: 0.03,
    },
  },
  vitality: {
    combat: {
      maxHP: 10,
    },
    stats: {
      physicalDefense: 0.2,
      magicalDefense: 0.2,
    },
  },
  endurance: {
    combat: {
      damageReduction: 0.15,
      blockChance: 0.04,
    },
  },
  luck: {
    combat: {
      criticalChance: 0.08,
      criticalDamageBonus: 0.25,
    },
  },
  physicalDefense: {
    stats: { physicalDefense: 1 },
  },
  magicalDefense: {
    stats: { magicalDefense: 1 },
  },
  fate: {
    // Fate se usa para probabilidad de procs en el runner (no suma combate directo acá).
  },
};

/** Overrides por clase (nombres exactos de tu seed). */
export const CLASS_ALLOCATE_OVERRIDES: Record<string, Partial<AllocateCoeffs>> = {
  Vampire: {
    dexterity: { combat: { evasion: 0.22 } },
    luck: { combat: { criticalChance: 0.1 } },
  },
  Werewolf: {
    strength: { combat: { attackPower: 0.95 } },
    endurance: { combat: { damageReduction: 0.18, blockChance: 0.05 } },
  },
  Necromancer: {
    intelligence: { combat: { magicPower: 1.15 } },
  },
  Revenant: {
    dexterity: { combat: { criticalChance: 0.09, attackSpeed: 0.07 } },
  },
  Exorcist: {
    endurance: { combat: { blockChance: 0.06 } },
    intelligence: { combat: { magicPower: 1.05 } },
  },
};

export function getAllocateCoeffsForClass(className?: string): AllocateCoeffs {
  const name = String(className ?? "").trim();
  const ov = CLASS_ALLOCATE_OVERRIDES[name] || {};

  const deepMerge = (a: AllocateDelta = {}, b: AllocateDelta = {}): AllocateDelta => ({
    stats: { ...(a.stats || {}), ...(b.stats || {}) },
    combat: { ...(a.combat || {}), ...(b.combat || {}) },
  });

  const keys = ["strength", "dexterity", "intelligence", "vitality", "endurance", "luck", "physicalDefense", "magicalDefense", "fate"] as const;

  const out: Partial<AllocateCoeffs> = {};
  for (const k of keys) {
    out[k] = deepMerge(GLOBAL_ALLOCATE_COEFFS[k], (ov as any)[k]);
  }
  return out as AllocateCoeffs;
}

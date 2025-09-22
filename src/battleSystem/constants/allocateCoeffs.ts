// src/battleSystem/constants/allocateCoeffs.ts

/**
 * Coeficientes (enteros) aplicados al ASIGNAR puntos de atributos.
 *
 * Convención:
 * - Todo es ENTERO.
 * - Campos "porcentuales" son puntos % (0..100). Ej: +1 = +1 punto porcentual.
 * - "fate" NO modifica combate directo; sólo se usa en el runner para procs.
 * - "constitution" reemplaza a "vitality".
 *
 * Importante:
 * - Estos coeficientes sólo afectan combatStats (hp/atk/mag/crit/evasion/etc.).
 * - Los atributos planos (physicalDefense / magicalDefense) ya suben directo
 *   porque el allocation service suma a `stats` esos campos asignables.
 */

export type AllocateDelta = {
  // (stats) queda por compat, pero este módulo realmente aplica "combat".
  stats?: Partial<{
    physicalDefense: number;
    magicalDefense: number;
  }>;
  combat?: Partial<{
    // valores absolutos (no %)
    maxHP: number;         // ej: +10 por punto de constitution
    attackPower: number;   // ej: +1 por punto de strength/dex
    magicPower: number;    // ej: +1 por punto de intelligence
    blockValue: number;    // ej: +1 por punto de strength (si usas escudo u otro)

    // valores en puntos %
    evasion: number;             // %
    damageReduction: number;     // %
    blockChance: number;         // %
    criticalChance: number;      // %
    criticalDamageBonus: number; // %
    attackSpeed: number;         // %
  }>;
};

type PrimaryKey =
  | "strength"
  | "dexterity"
  | "intelligence"
  | "constitution"       // 👈 reemplaza vitality
  | "endurance"
  | "luck"
  | "physicalDefense"
  | "magicalDefense"
  | "fate";

export type AllocateCoeffs = Record<PrimaryKey, AllocateDelta>;

/* ──────────────────────────────────────────────────────────────
 * Globales base (simples y seguros)
 * ──────────────────────────────────────────────────────────────
 * - STR: +1 ATK, +1 blockValue (ligero).
 * - DEX: +1 ATK (base global). El “sabor DEX” (crit/evasion/vel) se da en overrides.
 * - INT: +1 MAG.
 * - CON: +10 HP.
 * - END: +1% Damage Reduction.
 * - LUCK: +1% Crit Chance, +2% Crit Damage.
 * - DEF/MDEF: aquí no sumamos nada (ya se suben en `stats` al asignar a esas claves).
 * - FATE: sin efecto directo.
 */
export const GLOBAL_ALLOCATE_COEFFS: AllocateCoeffs = {
  strength: {
    combat: {
      attackPower: 1,
      blockValue: 1,
    },
  },
  dexterity: {
    combat: {
      attackPower: 1,
    },
  },
  intelligence: {
    combat: {
      magicPower: 1,
    },
  },
  constitution: {
    combat: {
      maxHP: 10,
    },
  },
  endurance: {
    combat: {
      damageReduction: 1, // +1 punto %
    },
  },
  luck: {
    combat: {
      criticalChance: 1,       // +1 punto %
      criticalDamageBonus: 2,  // +2 puntos %
    },
  },
  physicalDefense: {
    stats: { physicalDefense: 0 }, // (no-op aquí; la subida ocurre en stats al asignar)
  },
  magicalDefense: {
    stats: { magicalDefense: 0 }, // (no-op aquí; la subida ocurre en stats al asignar)
  },
  fate: {
    // Fate sólo para procs en el runner.
  },
};

/* ──────────────────────────────────────────────────────────────
 * Overrides por clase (nombres exactos del seed)
 * ──────────────────────────────────────────────────────────────
 * Buscan reforzar la fantasía sin romper el balance:
 * - Vampire: DEX -> +evasion; LUCK -> más critChance total.
 * - Werewolf: STR -> más ATK; END -> algo de blockChance extra.
 * - Necromancer: INT -> más MAG.
 * - Revenant: DEX -> mucho critChance y algo de evasion.
 * - Exorcist: INT -> más MAG; END -> blockChance extra.
 */
export const CLASS_ALLOCATE_OVERRIDES: Record<string, Partial<AllocateCoeffs>> = {
  Vampire: {
    dexterity: { combat: { attackPower: 1, evasion: 1 } }, // añade +1% evasion por punto DEX
    luck: { combat: { criticalChance: 2, criticalDamageBonus: 2 } }, // Luck más “sabrosa” para el vampiro
  },

  Werewolf: {
    strength: { combat: { attackPower: 2, blockValue: 1 } }, // STR más contundente
    endurance: { combat: { damageReduction: 1, blockChance: 1 } }, // +1% DR global +1% block
  },

  Necromancer: {
    intelligence: { combat: { magicPower: 2 } }, // INT más eficiente
  },

  Revenant: {
    // DEX reina: mucho crit y algo de evasión
    dexterity: { combat: { attackPower: 1, criticalChance: 2, evasion: 1 } },
  },

  Exorcist: {
    intelligence: { combat: { magicPower: 2 } },     // pegada sagrada/arcana
    endurance: { combat: { damageReduction: 1, blockChance: 1 } }, // parada más fiable
  },
};

/* ──────────────────────────────────────────────────────────────
 * Resolver coeficientes por clase
 * ────────────────────────────────────────────────────────────── */
export function getAllocateCoeffsForClass(className?: string): AllocateCoeffs {
  const name = String(className ?? "").trim();
  const ov = CLASS_ALLOCATE_OVERRIDES[name] || {};

  const deepMerge = (a: AllocateDelta = {}, b: AllocateDelta = {}): AllocateDelta => ({
    stats: { ...(a.stats || {}), ...(b.stats || {}) },
    combat: { ...(a.combat || {}), ...(b.combat || {}) },
  });

  const keys: PrimaryKey[] = [
    "strength",
    "dexterity",
    "intelligence",
    "constitution",
    "endurance",
    "luck",
    "physicalDefense",
    "magicalDefense",
    "fate",
  ];

  const out: Partial<AllocateCoeffs> = {};
  for (const k of keys) {
    out[k] = deepMerge(GLOBAL_ALLOCATE_COEFFS[k], (ov as any)[k]);
  }
  return out as AllocateCoeffs;
}

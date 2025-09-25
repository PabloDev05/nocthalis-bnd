export type AllocateDelta = {
  stats?: Partial<{
    physicalDefense: number;
    magicalDefense: number;
  }>;
  combat?: Partial<{
    maxHP: number;
    attackPower: number;
    magicPower: number;
    blockValue: number;

    evasion: number;
    damageReduction: number;
    blockChance: number;
    criticalChance: number;
    criticalDamageBonus: number;
  }>;
};

type PrimaryKey = "strength" | "dexterity" | "intelligence" | "constitution" | "endurance" | "luck" | "physicalDefense" | "magicalDefense" | "fate";

export type AllocateCoeffs = Record<PrimaryKey, AllocateDelta>;

export const GLOBAL_ALLOCATE_COEFFS: AllocateCoeffs = {
  strength: { combat: { attackPower: 1 } },
  dexterity: { combat: { evasion: 1 } },
  intelligence: { combat: { magicPower: 1 } },
  constitution: { combat: { maxHP: 10, blockChance: 1 } },
  endurance: { combat: { damageReduction: 1 } },
  luck: { combat: { criticalChance: 1, criticalDamageBonus: 2 } },
  physicalDefense: { stats: { physicalDefense: 0 } },
  magicalDefense: { stats: { magicalDefense: 0 } },
  fate: {},
};

export const CLASS_ALLOCATE_OVERRIDES: Record<string, Partial<AllocateCoeffs>> = {
  Werewolf: { strength: { combat: { attackPower: 2 } } },
  Vampire: { luck: { combat: { criticalChance: 2, criticalDamageBonus: 2 } } },
  Revenant: { dexterity: { combat: { criticalChance: 2, attackPower: 1 } } },
  Necromancer: { intelligence: { combat: { magicPower: 2 } } },
  Exorcist: { intelligence: { combat: { magicPower: 2, damageReduction: 1 } } },
};

export function getAllocateCoeffsForClass(className?: string): AllocateCoeffs {
  const name = String(className ?? "").trim();
  const ov = CLASS_ALLOCATE_OVERRIDES[name] || {};
  const deepMerge = (a: AllocateDelta = {}, b: AllocateDelta = {}): AllocateDelta => ({
    stats: { ...(a.stats || {}), ...(b.stats || {}) },
    combat: { ...(a.combat || {}), ...(b.combat || {}) },
  });
  const keys: PrimaryKey[] = ["strength", "dexterity", "intelligence", "constitution", "endurance", "luck", "physicalDefense", "magicalDefense", "fate"];
  const out: Partial<AllocateCoeffs> = {};
  for (const k of keys) out[k] = deepMerge(GLOBAL_ALLOCATE_COEFFS[k], (ov as any)[k]);
  return out as AllocateCoeffs;
}

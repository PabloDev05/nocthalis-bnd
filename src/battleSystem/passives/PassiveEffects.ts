// src/battleSystem/passives/PassiveEffects.ts

/* Autocontenido: sin dependencias de interfaces externas.
   Si más adelante querés tipar con tus interfaces reales, podés
   cambiar estos tipos locales para matchear tu dominio. */

export type BaseStats = {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number;
  endurance: number;
  fate?: number; // opcional aquí; en tu modelo principal es requerido
};

export type CombatStats = {
  maxHP: number;
  attackPower: number;
  magicPower: number;
  criticalChance: number; // en puntos % si así lo guardás
  criticalDamageBonus: number; // idem (puntos % o fracción, no importa aquí)
  attackSpeed: number;
  evasion: number;
  blockChance: number;
  blockValue: number;
  lifeSteal: number;
  damageReduction: number;
  movementSpeed: number;
};

export type Passive = {
  id?: string;
  _id?: string;
  name: string;
  // Modificadores planos que se suman a los bloques
  modifiers?: Partial<BaseStats & CombatStats>;
};

export type Subclass = {
  _id?: string;
  id?: string;
  name?: string;
  passiveDefault?: Passive;
  passives?: Passive[];
};

export type CharacterClassLike = {
  name?: string;
  passiveDefault?: Passive;
  subclasses?: Subclass[];
};

const DBG = process.env.DEBUG_COMBAT === "1";

/* ───────────────── helpers ──────────────── */

type PartialStats = Partial<BaseStats>;
type PartialCombat = Partial<CombatStats>;

function sumModifiers(passives: Passive[]): { stats: PartialStats; combat: PartialCombat } {
  const stats: PartialStats = {};
  const combat: PartialCombat = {};

  for (const p of passives) {
    const m = p.modifiers ?? {};

    // Stats base
    (["strength", "dexterity", "intelligence", "vitality", "physicalDefense", "magicalDefense", "luck", "endurance", "fate"] as const).forEach((k) => {
      const v = (m as any)[k];
      if (typeof v === "number") (stats as any)[k] = ((stats as any)[k] ?? 0) + v;
    });

    // Stats de combate
    (
      ["maxHP", "attackPower", "magicPower", "criticalChance", "criticalDamageBonus", "attackSpeed", "evasion", "blockChance", "blockValue", "lifeSteal", "damageReduction", "movementSpeed"] as const
    ).forEach((k) => {
      const v = (m as any)[k];
      if (typeof v === "number") (combat as any)[k] = ((combat as any)[k] ?? 0) + v;
    });
  }

  return { stats, combat };
}

function uniqueByKey(passives: Passive[]) {
  const seen = new Set<string>();
  const out: Passive[] = [];
  for (const p of passives) {
    const key = String(p.id ?? p._id ?? p.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/* ───────────────── exports ──────────────── */

/** Colecta pasivas del personaje desde su clase/subclase y “desbloqueadas”. */
export function collectPassivesForCharacter(character: any): Passive[] {
  const out: Passive[] = [];
  const cls: CharacterClassLike | undefined = (character?.class ?? character?.classId) as any;
  if (!cls) return out;

  // pasiva por defecto de la clase
  if (cls.passiveDefault) out.push(cls.passiveDefault);

  // subclase seleccionada (si existe)
  const subId = String(character?.subclassId ?? "");
  if (subId && Array.isArray(cls.subclasses)) {
    const sub = cls.subclasses.find((s) => String((s as any)?._id ?? (s as any)?.id) === subId);
    if (sub?.passiveDefault) out.push(sub.passiveDefault);

    // pasivas desbloqueadas por nombre
    const unlocked: string[] = Array.isArray(character?.passivesUnlocked) ? character.passivesUnlocked : [];
    if (unlocked.length && Array.isArray(sub?.passives)) {
      for (const name of unlocked) {
        const p = sub!.passives!.find((pp) => pp?.name === name);
        if (p) out.push(p);
      }
    }
  }

  const uniques = uniqueByKey(out);
  if (DBG)
    console.log(
      "[PASSIVES] Colectadas:",
      uniques.map((p) => p.name)
    );
  return uniques;
}

/**
 * Suma los modificadores de pasivas a los bloques base.
 * No normaliza porcentajes; sólo agrega valores tal cual vengan.
 */
export function applyPassivesToBlocks(baseStats: BaseStats, baseCombat: CombatStats, passives: Passive[]) {
  const { stats: addS, combat: addC } = sumModifiers(passives);
  if (DBG) console.log("[PASSIVES] Sumatorias:", { addS, addC });

  const stats: BaseStats = {
    ...baseStats,
    strength: (baseStats.strength ?? 0) + (addS.strength ?? 0),
    dexterity: (baseStats.dexterity ?? 0) + (addS.dexterity ?? 0),
    intelligence: (baseStats.intelligence ?? 0) + (addS.intelligence ?? 0),
    vitality: (baseStats.vitality ?? 0) + (addS.vitality ?? 0),
    physicalDefense: (baseStats.physicalDefense ?? 0) + (addS.physicalDefense ?? 0),
    magicalDefense: (baseStats.magicalDefense ?? 0) + (addS.magicalDefense ?? 0),
    luck: (baseStats.luck ?? 0) + (addS.luck ?? 0),
    endurance: (baseStats.endurance ?? 0) + (addS.endurance ?? 0),
    fate: (baseStats.fate ?? 0) + (addS.fate ?? 0),
  };

  const combatStats: CombatStats = {
    ...baseCombat,
    maxHP: (baseCombat.maxHP ?? 0) + (addC.maxHP ?? 0),
    attackPower: (baseCombat.attackPower ?? 0) + (addC.attackPower ?? 0),
    magicPower: (baseCombat.magicPower ?? 0) + (addC.magicPower ?? 0),
    criticalChance: (baseCombat.criticalChance ?? 0) + (addC.criticalChance ?? 0),
    criticalDamageBonus: (baseCombat.criticalDamageBonus ?? 0) + (addC.criticalDamageBonus ?? 0),
    attackSpeed: (baseCombat.attackSpeed ?? 0) + (addC.attackSpeed ?? 0),
    evasion: (baseCombat.evasion ?? 0) + (addC.evasion ?? 0),
    blockChance: (baseCombat.blockChance ?? 0) + (addC.blockChance ?? 0),
    blockValue: (baseCombat.blockValue ?? 0) + (addC.blockValue ?? 0),
    lifeSteal: (baseCombat.lifeSteal ?? 0) + (addC.lifeSteal ?? 0),
    damageReduction: (baseCombat.damageReduction ?? 0) + (addC.damageReduction ?? 0),
    movementSpeed: (baseCombat.movementSpeed ?? 0) + (addC.movementSpeed ?? 0),
  };

  if (DBG) console.log("[PASSIVES] Resultantes:", { stats, combatStats });
  return { stats, combatStats };
}

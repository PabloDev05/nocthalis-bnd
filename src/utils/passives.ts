const DBG = process.env.DEBUG_COMBAT === "1";
import type { Passive, Subclass, CharacterClass, BaseStats, CombatStats } from "../interfaces/character/CharacterClass.interface";

type PartialStats = Partial<BaseStats>;
type PartialCombat = Partial<CombatStats>;

function sumModifiers(passives: Passive[]): { stats: PartialStats; combat: PartialCombat } {
  const stats: PartialStats = {};
  const combat: PartialCombat = {};
  for (const p of passives) {
    const m = p.modifiers ?? {};
    (["strength", "dexterity", "intelligence", "vitality", "physicalDefense", "magicalDefense", "luck", "agility", "endurance", "wisdom"] as const).forEach((k) => {
      if (typeof (m as any)[k] === "number") (stats as any)[k] = ((stats as any)[k] ?? 0) + (m as any)[k];
    });
    (
      [
        "maxHP",
        "maxMP",
        "attackPower",
        "magicPower",
        "criticalChance",
        "criticalDamageBonus",
        "attackSpeed",
        "evasion",
        "blockChance",
        "blockValue",
        "lifeSteal",
        "manaSteal",
        "damageReduction",
        "movementSpeed",
      ] as const
    ).forEach((k) => {
      if (typeof (m as any)[k] === "number") (combat as any)[k] = ((combat as any)[k] ?? 0) + (m as any)[k];
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

export function collectPassivesForCharacter(character: any): Passive[] {
  const out: Passive[] = [];
  const cls: CharacterClass | undefined = character?.classId as any;
  if (!cls) return out;
  if (cls.passiveDefault) out.push(cls.passiveDefault);

  // Subclases: si no tenés nada, esto simplemente no agrega nada.
  const subId = String(character?.subclassId ?? "");
  if (subId && Array.isArray(cls.subclasses)) {
    const sub = cls.subclasses.find((s: Subclass) => String((s as any)?._id ?? s.id) === subId);
    if (sub?.passiveDefault) out.push(sub.passiveDefault);
    const unlocked: string[] = Array.isArray(character?.passivesUnlocked) ? character.passivesUnlocked : [];
    if (unlocked.length && Array.isArray(sub?.passives)) {
      for (const name of unlocked) {
        const p = sub!.passives.find((pp) => pp.name === name);
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

export function applyPassivesToBlocks(baseStats: BaseStats, baseCombat: CombatStats, passives: Passive[]) {
  const { stats: addS, combat: addC } = sumModifiers(passives);
  if (DBG) console.log("[PASSIVES] Sumatorias:", { addS, addC });

  const stats: BaseStats = {
    ...baseStats,
    strength: baseStats.strength + (addS.strength ?? 0),
    dexterity: baseStats.dexterity + (addS.dexterity ?? 0),
    intelligence: baseStats.intelligence + (addS.intelligence ?? 0),
    vitality: baseStats.vitality + (addS.vitality ?? 0),
    physicalDefense: baseStats.physicalDefense + (addS.physicalDefense ?? 0),
    magicalDefense: baseStats.magicalDefense + ((addC as any).magicalDefense ?? 0), // por si lo pusiste como combat accidentalmente
    luck: baseStats.luck + (addS.luck ?? 0),
    agility: baseStats.agility + (addS.agility ?? 0),
    endurance: baseStats.endurance + (addS.endurance ?? 0),
    wisdom: baseStats.wisdom + (addS.wisdom ?? 0),
  };

  const combatStats: CombatStats = {
    ...baseCombat,
    maxHP: baseCombat.maxHP + (addC.maxHP ?? 0),
    maxMP: baseCombat.maxMP + (addC.maxMP ?? 0),
    attackPower: baseCombat.attackPower + (addC.attackPower ?? 0),
    magicPower: baseCombat.magicPower + (addC.magicPower ?? 0),
    criticalChance: baseCombat.criticalChance + (addC.criticalChance ?? 0),
    criticalDamageBonus: baseCombat.criticalDamageBonus + (addC.criticalDamageBonus ?? 0),
    attackSpeed: baseCombat.attackSpeed + (addC.attackSpeed ?? 0),
    evasion: baseCombat.evasion + (addC.evasion ?? 0),
    blockChance: baseCombat.blockChance + (addC.blockChance ?? 0),
    blockValue: baseCombat.blockValue + (addC.blockValue ?? 0),
    lifeSteal: baseCombat.lifeSteal + (addC.lifeSteal ?? 0),
    manaSteal: baseCombat.manaSteal + (addC.manaSteal ?? 0),
    damageReduction: baseCombat.damageReduction + (addC.damageReduction ?? 0),
    movementSpeed: baseCombat.movementSpeed + (addC.movementSpeed ?? 0),
  };

  if (DBG) console.log("[PASSIVES] Resultantes:", { stats, combatStats });
  return { stats, combatStats };
}

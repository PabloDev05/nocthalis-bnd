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
  fate?: number; // opcional aquí; en tu modelo principal puede ser requerido
};

export type CombatStats = {
  // ⚠️ Convención de UNIDADES:
  // - criticalChance, evasion, blockChance, damageReduction, lifeSteal, etc. se almacenan
  //   como "puntos %" (ej. 12 = 12%). Tu pvpRunner luego los normaliza a fracción 0..1
  //   con pctToFrac. Aquí solo SUMAMOS números (puntos %) sin convertir.
  maxHP: number;
  attackPower: number;
  magicPower: number;
  criticalChance: number; // puntos %
  criticalDamageBonus: number; // puntos % sobre base
  attackSpeed: number; // ticks (tu motor los interpreta)
  evasion: number; // puntos %
  blockChance: number; // puntos %
  blockValue: number; // plano
  lifeSteal: number; // puntos %
  damageReduction: number; // puntos %
  movementSpeed: number; // unidades propias
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
  slug?: string;
  name?: string;
  passiveDefault?: Passive;
  passives?: Passive[];
};

export type CharacterClassLike = {
  name?: string;
  passiveDefault?: Passive;
  passives?: Passive[]; // ← NUEVO: también buscamos aquí
  subclasses?: Subclass[];
};

const DBG = process.env.DEBUG_COMBAT === "1";

/* ───────────────── helpers ──────────────── */

type PartialStats = Partial<BaseStats>;
type PartialCombat = Partial<CombatStats>;

const asNum = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clampMin = (n: number, lo = 0) => (n < lo ? lo : n);

/** Suma campo por campo de una lista de pasivas. */
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

    // Stats de combate (recordá: aquí sumamos "puntos %", el runner normaliza)
    (
      ["maxHP", "attackPower", "magicPower", "criticalChance", "criticalDamageBonus", "attackSpeed", "evasion", "blockChance", "blockValue", "lifeSteal", "damageReduction", "movementSpeed"] as const
    ).forEach((k) => {
      const v = (m as any)[k];
      if (typeof v === "number") (combat as any)[k] = ((combat as any)[k] ?? 0) + v;
    });
  }

  return { stats, combat };
}

/** Key estable para deduplicar: prioriza id/_id; fallback a name. */
function passiveKey(p: Passive): string {
  return String(p.id ?? p._id ?? `name:${p.name}`);
}
function uniqueByKey(passives: Passive[]) {
  const seen = new Set<string>();
  const out: Passive[] = [];
  for (const p of passives) {
    const key = passiveKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Busca una subclase en múltiples formatos (id/_id/slug/objeto embebido) */
function resolveSubclass(classLike: CharacterClassLike | undefined, character: any): Subclass | undefined {
  if (!classLike?.subclasses?.length) return undefined;

  // candidatos de referencia
  const wantId = String(character?.subclassId ?? character?.subclass?.id ?? character?.subclass?._id ?? "");
  const wantSlug = String(character?.subclassSlug ?? character?.subclass?.slug ?? "").toLowerCase();

  if (!wantId && !wantSlug) return undefined;

  const match = classLike.subclasses.find((s) => {
    const id = String(s.id ?? s._id ?? "");
    const slug = String(s.slug ?? "").toLowerCase();
    return (wantId && id && id === wantId) || (wantSlug && slug && slug === wantSlug);
  });

  return match;
}

/** Indexa pasivas por (id/_id/name) para búsquedas rápidas de desbloqueadas. */
function indexPassives(list?: Passive[] | null): Record<string, Passive> {
  const idx: Record<string, Passive> = {};
  if (!Array.isArray(list)) return idx;
  for (const p of list) {
    if (!p) continue;
    const keys = new Set<string>();
    if (p.id) keys.add(String(p.id));
    if ((p as any)._id) keys.add(String((p as any)._id));
    if (p.name) keys.add(String(p.name));
    for (const k of keys) idx[k] = p;
  }
  return idx;
}

/* ───────────────── exports ──────────────── */

/**
 * Colecta pasivas del personaje desde su clase/subclase y “desbloqueadas”.
 * - Incluye: passiveDefault de la clase, passiveDefault de la subclase,
 *   y pasivas desbloqueadas por nombre o id (tanto en clase como subclase).
 */
export function collectPassivesForCharacter(character: any): Passive[] {
  const out: Passive[] = [];
  const cls: CharacterClassLike | undefined = (character?.class ?? character?.classId) as any;
  if (!cls) return out;

  // 1) pasiva por defecto de la clase
  if (cls.passiveDefault) out.push(cls.passiveDefault);

  // 2) subclase seleccionada (id/_id/slug)
  const sub = resolveSubclass(cls, character);
  if (sub?.passiveDefault) out.push(sub.passiveDefault);

  // 3) desbloqueadas (por nombre o id) — buscamos en clase y subclase
  const unlocked: Array<string> = Array.isArray(character?.passivesUnlocked) ? character.passivesUnlocked : [];

  if (unlocked.length) {
    const classIdx = indexPassives(cls.passives);
    const subIdx = indexPassives(sub?.passives);

    for (const key of unlocked) {
      const k = String(key);
      const found = subIdx[k] ?? classIdx[k];
      if (found) out.push(found);
    }
  }

  const uniques = uniqueByKey(out);
  if (DBG)
    console.log(
      "[PASSIVES] Colectadas:",
      uniques.map((p) => passiveKey(p)),
      { names: uniques.map((p) => p.name) }
    );
  return uniques;
}

/**
 * Suma los modificadores de pasivas a los bloques base.
 * ❗ No normaliza porcentajes; sólo agrega valores tal cual vengan (puntos %).
 *    Tu pvpRunner/CombatManager se encarga de convertir a fracción (0..1)
 *    cuando corresponda (via pctToFrac/normalize).
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
    physicalDefense: clampMin((baseStats.physicalDefense ?? 0) + (addS.physicalDefense ?? 0), 0),
    magicalDefense: clampMin((baseStats.magicalDefense ?? 0) + (addS.magicalDefense ?? 0), 0),
    luck: (baseStats.luck ?? 0) + (addS.luck ?? 0),
    endurance: (baseStats.endurance ?? 0) + (addS.endurance ?? 0),
    fate: (baseStats.fate ?? 0) + (addS.fate ?? 0),
  };

  const combatStats: CombatStats = {
    ...baseCombat,
    maxHP: clampMin((baseCombat.maxHP ?? 0) + (addC.maxHP ?? 0), 1),
    attackPower: clampMin((baseCombat.attackPower ?? 0) + (addC.attackPower ?? 0), 0),
    magicPower: clampMin((baseCombat.magicPower ?? 0) + (addC.magicPower ?? 0), 0),
    // % en puntos → el runner lo convertirá a fracción si hace falta
    criticalChance: (baseCombat.criticalChance ?? 0) + (addC.criticalChance ?? 0),
    criticalDamageBonus: (baseCombat.criticalDamageBonus ?? 0) + (addC.criticalDamageBonus ?? 0),
    attackSpeed: clampMin((baseCombat.attackSpeed ?? 0) + (addC.attackSpeed ?? 0), 0),
    evasion: (baseCombat.evasion ?? 0) + (addC.evasion ?? 0),
    blockChance: (baseCombat.blockChance ?? 0) + (addC.blockChance ?? 0),
    blockValue: clampMin((baseCombat.blockValue ?? 0) + (addC.blockValue ?? 0), 0),
    lifeSteal: (baseCombat.lifeSteal ?? 0) + (addC.lifeSteal ?? 0),
    damageReduction: (baseCombat.damageReduction ?? 0) + (addC.damageReduction ?? 0),
    movementSpeed: clampMin((baseCombat.movementSpeed ?? 0) + (addC.movementSpeed ?? 0), 0),
  };

  if (DBG) console.log("[PASSIVES] Resultantes:", { stats, combatStats });
  return { stats, combatStats };
}

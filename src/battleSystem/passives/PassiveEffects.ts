/* Autocontenido: sin dependencias de interfaces externas. */

export type BaseStats = {
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number;
  endurance: number;
  fate: number; // requerido aquí (si querés, podés volverlo opcional)
};

export type CombatStats = {
  // ⚠️ Convención de UNIDADES (enteros):
  // - criticalChance, evasion, blockChance, damageReduction, lifeSteal, etc. son puntos % (ej: 12 = 12%).
  // - El runner/CombatManager convierte a fracción 0..1 cuando hace falta.
  maxHP: number;
  attackPower: number;
  magicPower: number;
  criticalChance: number; // puntos %
  criticalDamageBonus: number; // puntos %
  evasion: number; // puntos %
  blockChance: number; // puntos %
  blockValue: number; // plano
  lifeSteal: number; // puntos %
  damageReduction: number; // puntos %
  movementSpeed: number; // puntos %
};

export type Passive = {
  id?: string;
  _id?: string;
  name: string;
  // Modificadores planos que se suman a los bloques (todos enteros)
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

  // Para pasivas planas:
  passiveDefault?: Passive;
  passives?: Passive[];

  // Subclases
  subclasses?: Subclass[];
};

const DBG = process.env.DEBUG_COMBAT === "1";

/* ───────────────── helpers ──────────────── */

type PartialStats = Partial<BaseStats>;
type PartialCombat = Partial<CombatStats>;

const toInt = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
};
const clampMin = (n: number, lo = 0) => (n < lo ? lo : n);

/** Suma (como enteros) campo por campo de una lista de pasivas. */
function sumModifiers(passives: Passive[]): { stats: PartialStats; combat: PartialCombat } {
  const stats: PartialStats = {};
  const combat: PartialCombat = {};

  for (const p of passives) {
    const m = p?.modifiers ?? {};
    // Stats base (enteros)
    (
      [
        "strength",
        "dexterity",
        "intelligence",
        "constitution", // ← actualizado
        "physicalDefense",
        "magicalDefense",
        "luck",
        "endurance",
        "fate",
      ] as const
    ).forEach((k) => {
      const v = toInt((m as any)[k], 0);
      if (v) (stats as any)[k] = toInt(((stats as any)[k] ?? 0) + v, 0);
    });

    // Stats de combate (enteros, % en puntos)
    (["maxHP", "attackPower", "magicPower", "criticalChance", "criticalDamageBonus", "evasion", "blockChance", "blockValue", "lifeSteal", "damageReduction", "movementSpeed"] as const).forEach((k) => {
      const v = toInt((m as any)[k], 0);

      if (v) (combat as any)[k] = toInt(((combat as any)[k] ?? 0) + v, 0);
    });
  }

  return { stats, combat };
}

/** Key estable para deduplicar: prioriza id/_id; fallback a name. */
function passiveKey(p: Passive): string {
  return String(p?.id ?? (p as any)?._id ?? `name:${p?.name ?? "unknown"}`);
}

function uniqueByKey(passives: Passive[]) {
  const seen = new Set<string>();
  const out: Passive[] = [];
  for (const p of passives) {
    if (!p) continue;
    const key = passiveKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Busca una subclase en múltiples formatos (id/_id/slug/objeto embebido). */
function resolveSubclass(classLike: CharacterClassLike | undefined, character: any): Subclass | undefined {
  if (!classLike?.subclasses?.length) return undefined;

  const wantId = String(character?.subclassId ?? character?.subclass?.id ?? character?.subclass?._id ?? "");
  const wantSlug = String(character?.subclassSlug ?? character?.subclass?.slug ?? "").toLowerCase();

  if (!wantId && !wantSlug) return undefined;

  return classLike.subclasses.find((s) => {
    const id = String(s.id ?? s._id ?? "");
    const slug = String(s.slug ?? "").toLowerCase();
    return (wantId && id && id === wantId) || (wantSlug && slug && slug === wantSlug);
  });
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
 * Colecta pasivas planas del personaje desde su clase/subclase y “desbloqueadas”.
 * Incluye:
 *  - passiveDefault de la clase (si existe y es plana),
 *  - passiveDefault de la subclase,
 *  - pasivas desbloqueadas por nombre o id (busca en clase y subclase).
 *
 * ⚠️ No incluye passiveDefaultSkill (la pasiva con trigger/proc); eso lo maneja el runner.
 */
export function collectPassivesForCharacter(character: any): Passive[] {
  const out: Passive[] = [];
  const cls: CharacterClassLike | undefined = (character?.class ?? character?.classId) as any;
  if (!cls || typeof cls !== "object") return out;

  // 1) pasiva por defecto de la clase (plana)
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
  if (DBG) {
    console.log(
      "[PASSIVES] Colectadas:",
      uniques.map((p) => passiveKey(p)),
      {
        names: uniques.map((p) => p.name),
      }
    );
  }
  return uniques;
}

/**
 * Suma los modificadores de pasivas a los bloques base (todo en enteros).
 * ❗ No normaliza porcentajes; sólo agrega puntos % y planos.
 *    El runner/CombatManager convierte a fracción (0..1) cuando haga falta.
 */
export function applyPassivesToBlocks(baseStats: BaseStats, baseCombat: CombatStats, passives: Passive[]) {
  const { stats: addS, combat: addC } = sumModifiers(passives);
  if (DBG) console.log("[PASSIVES] Sumatorias:", { addS, addC });

  const stats: BaseStats = {
    ...baseStats,
    strength: toInt((baseStats.strength ?? 0) + toInt(addS.strength ?? 0)),
    dexterity: toInt((baseStats.dexterity ?? 0) + toInt(addS.dexterity ?? 0)),
    intelligence: toInt((baseStats.intelligence ?? 0) + toInt(addS.intelligence ?? 0)),
    constitution: toInt((baseStats.constitution ?? 0) + toInt(addS.constitution ?? 0)), // ← actualizado
    physicalDefense: clampMin(toInt((baseStats.physicalDefense ?? 0) + toInt(addS.physicalDefense ?? 0)), 0),
    magicalDefense: clampMin(toInt((baseStats.magicalDefense ?? 0) + toInt(addS.magicalDefense ?? 0)), 0),
    luck: toInt((baseStats.luck ?? 0) + toInt(addS.luck ?? 0)),
    endurance: toInt((baseStats.endurance ?? 0) + toInt(addS.endurance ?? 0)),
    fate: toInt((baseStats.fate ?? 0) + toInt(addS.fate ?? 0)),
  };

  const combatStats: CombatStats = {
    ...baseCombat,
    maxHP: clampMin(toInt((baseCombat.maxHP ?? 0) + toInt(addC.maxHP ?? 0)), 1),
    attackPower: clampMin(toInt((baseCombat.attackPower ?? 0) + toInt(addC.attackPower ?? 0)), 0),
    magicPower: clampMin(toInt((baseCombat.magicPower ?? 0) + toInt(addC.magicPower ?? 0)), 0),
    // % en puntos → el runner lo convertirá a fracción si hace falta
    criticalChance: toInt((baseCombat.criticalChance ?? 0) + toInt(addC.criticalChance ?? 0)),
    criticalDamageBonus: toInt((baseCombat.criticalDamageBonus ?? 0) + toInt(addC.criticalDamageBonus ?? 0)),
    evasion: toInt((baseCombat.evasion ?? 0) + toInt(addC.evasion ?? 0)),
    blockChance: toInt((baseCombat.blockChance ?? 0) + toInt(addC.blockChance ?? 0)),
    blockValue: clampMin(toInt((baseCombat.blockValue ?? 0) + toInt(addC.blockValue ?? 0)), 0),
    lifeSteal: toInt((baseCombat.lifeSteal ?? 0) + toInt(addC.lifeSteal ?? 0)),
    damageReduction: toInt((baseCombat.damageReduction ?? 0) + toInt(addC.damageReduction ?? 0)),
    movementSpeed: clampMin(toInt((baseCombat.movementSpeed ?? 0) + toInt(addC.movementSpeed ?? 0)), 0),
  };

  if (DBG) console.log("[PASSIVES] Resultantes:", { stats, combatStats });
  return { stats, combatStats };
}

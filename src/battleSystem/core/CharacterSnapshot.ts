// src/battleSystem/snapshots/characterSnapshot.ts
// Construye un snapshot autocontenido para guardar en Match.
// ❗ Copiamos valores "tal cual" (no convertimos %→fracción aquí).
// El CombatManager/runner hacen las conversiones y aplican jitters/bonos.

export type CharacterSnapshot = {
  // ---- Identidad / vínculo
  userId: any; // ObjectId o string
  characterId: any; // ObjectId o string

  // ---- Para UI
  username: string;
  name: string;
  level: number;
  className: string;

  // ---- Armas (para UI/animación; el Manager usa equipment también)
  weapon: string; // slug principal (fallback seguro)

  // ---- Números base (se copian tal cual)
  stats: Record<string, number>;
  resistances: Record<string, number>;
  equipment: Record<string, unknown>;

  // ---- HP redundante
  maxHP: number;
  currentHP: number;

  // ---- Bloque de combate (tal cual esté en el personaje)
  combat: {
    attackPower: number;
    magicPower: number;
    evasion: number; // puede venir 12.9 si así lo guardás
    blockChance: number; // idem
    damageReduction: number; // idem
    criticalChance: number; // idem
    criticalDamageBonus: number; // 41.4 (=+41.4%) o 0.5 (=+50%)
    attackSpeed: number;
    maxHP?: number; // redundante
  };

  // Por compat con código que mira "combatStats" en vez de "combat"
  combatStats: CharacterSnapshot["combat"];

  // ---- Metadata de clase para runner/UI (necesario para Fate procs y arma por defecto)
  class?: {
    name: string;
    defaultWeapon?: string;
    primaryWeapons?: string[];
    secondaryWeapons?: string[];
    passiveDefaultSkill?: {
      enabled?: boolean;
      name: string;
      damageType?: "physical" | "magical";
      shortDescEn?: string;
      longDescEn?: string;
      trigger: {
        check: "onBasicHit" | "onRangedHit" | "onSpellCast" | "onHitOrBeingHit" | "onTurnStart";
        scaleBy?: "fate";
        baseChancePercent?: number;
        fateScalePerPoint?: number;
        maxChancePercent?: number;
      };
      durationTurns?: number;
      bonusDamage?: number;
      extraEffects?: Record<string, number>;
    } | null;
    ultimateSkill?: {
      enabled?: boolean;
      name: string;
      description?: string;
      cooldownTurns: number;
      effects?: {
        bonusDamagePercent?: number;
        applyDebuff?: string;
        debuffValue?: number;
        bleedDamagePerTurn?: number;
        debuffDurationTurns?: number;
      };
      proc?: {
        enabled?: boolean;
        respectCooldown?: boolean;
        trigger?: {
          check: "onTurnStart";
          scaleBy?: "fate";
          baseChancePercent?: number;
          fateScalePerPoint?: number;
          maxChancePercent?: number;
        };
      };
    } | null;
  };

  // Legacy: por si algo del front mira esto
  passiveDefault?: { name: string; description?: string } | null;
};

/* ───────────────────────────────────────────────────────────────────────────────
 * Helpers mínimos (sin conversiones de %)
 * ───────────────────────────────────────────────────────────────────────────── */
const toNum = (v: any, d = 0) => {
  if (typeof v === "string") {
    const s = v.replace?.("%", "").replace?.(",", ".") ?? v;
    const n = Number(s);
    return Number.isFinite(n) ? n : d;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const clampInt = (v: any, min: number, max: number) => {
  const n = Math.round(toNum(v, min));
  return Math.max(min, Math.min(max, n));
};

const slugify = (s: any) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "";

/** Selecciona el slug de arma desde distintas formas de equipo/snapshot. */
function selectWeaponSlug(character: any, classDefaultWeapon?: string): string {
  // Del equipo / snapshot (string u objeto con slug/name)
  const candidates: any[] = [
    character?.weapon,
    character?.weapon?.slug,
    character?.equipment?.weapon,
    character?.equipment?.weapon?.slug,
    character?.equipment?.mainHand,
    character?.equipment?.mainHand?.slug,
    character?.equipment?.mainWeapon,
    character?.equipment?.mainWeapon?.slug,
    character?.equipment?.weaponName,
  ].filter(Boolean);

  for (const c of candidates) {
    const s = typeof c === "string" ? c : c?.slug ?? c?.name;
    const slug = slugify(s);
    if (slug) return slug;
  }

  // Fallback: defaultWeapon de la clase si existe; si no, "fists"
  const dw = slugify(classDefaultWeapon);
  return dw || "fists";
}

/* ───────────────────────────────────────────────────────────────────────────────
 * Builder (pasa TODO tal cual; asegura arma/HP válidos y adjunta metadatos de clase)
 * ───────────────────────────────────────────────────────────────────────────── */
export function buildCharacterSnapshot(character: any): CharacterSnapshot {
  // Ids / identidad
  const userId = character?.userId ?? character?.user?._id ?? character?.user?.id;
  const characterId = character?._id ?? character?.id;
  const username = character?.username ?? character?.user?.username ?? character?.user?.name ?? "—";
  const name = character?.name ?? username ?? "—";

  // Clase: puede venir como string o como doc poblado (character.classId o character.class)
  const classDoc = character?.classId && typeof character.classId === "object" && character.classId.name ? character.classId : character?.class;

  const className = String(classDoc?.name ?? character?.className ?? "—");
  const defaultWeapon = classDoc?.defaultWeapon ? String(classDoc.defaultWeapon) : undefined;
  const primaryWeapons = Array.isArray(classDoc?.primaryWeapons) ? classDoc.primaryWeapons.slice() : undefined;
  const secondaryWeapons = Array.isArray(classDoc?.secondaryWeapons) ? classDoc.secondaryWeapons.slice() : undefined;
  const passiveDefaultSkill = classDoc?.passiveDefaultSkill ?? null;
  const ultimateSkill = classDoc?.ultimateSkill ?? null;

  const level = toNum(character?.level, 1);

  // Arma (slug): equipo → defaultWeapon de la clase → "fists"
  const weapon = selectWeaponSlug(character, defaultWeapon);

  // Combat de origen (copiamos TAL CUAL esté en el personaje)
  const srcCombat = character?.combatStats ?? character?.combat ?? {};
  const combat = {
    attackPower: toNum(srcCombat.attackPower, 0),
    magicPower: toNum(srcCombat.magicPower, 0),
    evasion: toNum(srcCombat.evasion, 0),
    blockChance: toNum(srcCombat.blockChance, 0),
    damageReduction: toNum(srcCombat.damageReduction, 0),
    criticalChance: toNum(srcCombat.criticalChance, 0),
    criticalDamageBonus: toNum(srcCombat.criticalDamageBonus, 0.5),
    attackSpeed: toNum(srcCombat.attackSpeed, 1),
    maxHP: toNum(srcCombat.maxHP ?? character?.maxHP, 100),
  };

  // HP coherente
  const maxHP = clampInt(character?.maxHP ?? combat.maxHP, 1, 10_000_000);
  const currentHP = clampInt(character?.currentHP ?? maxHP, 0, maxHP);

  // Copias planas de stats/resist/equipment
  const stats = { ...(character?.stats ?? {}) } as Record<string, number>;
  const resistances = { ...(character?.resistances ?? {}) } as Record<string, number>;
  const equipment = { ...(character?.equipment ?? {}) } as Record<string, unknown>;

  const snap: CharacterSnapshot = {
    userId,
    characterId,

    username,
    name,
    level,
    className,

    weapon,

    stats,
    resistances,
    equipment,

    maxHP,
    currentHP,

    combat,
    combatStats: combat,

    class: {
      name: className,
      defaultWeapon,
      primaryWeapons,
      secondaryWeapons,
      passiveDefaultSkill,
      ultimateSkill,
    },

    // Legacy: si tu UI antigua lo usa
    passiveDefault: classDoc?.passiveDefault ? { name: String(classDoc.passiveDefault.name ?? ""), description: String(classDoc.passiveDefault.description ?? "") } : null,
  };

  return snap;
}

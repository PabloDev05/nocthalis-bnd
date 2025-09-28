// src/battleSystem/snapshots/characterSnapshot.ts
// Construye un snapshot autocontenido para guardar en Match.
// ❗ Copiamos valores "tal cual" (no convertimos %→fracción aquí).
// El CombatManager/runner hacen las conversiones y aplican jitters/bonos.

import { normalizeWeaponData, weaponTemplateFor, isPrimaryWeapon, PRIMARY_WEAPON_BONUS_MULT, type WeaponData } from "../core/Weapon";

export type CharacterSnapshot = {
  userId: any;
  characterId: any;

  username: string;
  name: string;
  level: number;
  className: string;

  weapon: string;

  stats: Record<string, number>;
  resistances: Record<string, number>;
  equipment: Record<string, unknown>;

  maxHP: number;
  currentHP: number;

  combat: {
    attackPower: number;
    magicPower: number;
    evasion: number; // puntos %
    blockChance: number; // puntos %
    damageReduction: number; // puntos %
    criticalChance: number; // puntos %
    criticalDamageBonus: number; // puntos %
    maxHP?: number;
  };

  combatStats: CharacterSnapshot["combat"];

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

  uiDamageMin?: number;
  uiDamageMax?: number;
};

/* ───────── helpers ───────── */
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

/** Trigger normalizer → forma canónica que el motor entiende */
function normPassiveCheck(s: any): "onBasicHit" | "onRangedHit" | "onSpellCast" | "onHitOrBeingHit" | "onTurnStart" {
  const x = String(s ?? "")
    .toLowerCase()
    .trim();
  if (/(ranged|bow|crossbow|gun|pistol|arquebus|flint)/.test(x)) return "onRangedHit";
  if (/(spell|cast|magic|magical)/.test(x)) return "onSpellCast";
  if (/(turnstart|start_of_turn|onturnstart)/.test(x)) return "onTurnStart";
  if (/(onhitorbeinghit|either|both|any|all)/.test(x)) return "onHitOrBeingHit";
  if (/(basic|melee|hit|attack|strike)/.test(x)) return "onBasicHit";
  // default razonable
  return "onBasicHit";
}

/** Normaliza objeto passive */
function normalizePassive(obj: any | null | undefined) {
  if (!obj) return null;

  // 👇 forzamos el union literal, no "string"
  const damageType: "physical" | "magical" = String(obj.damageType ?? "").toLowerCase() === "magical" ? "magical" : "physical";

  // opcional: tipamos extraEffects como Record<string, number> | undefined
  const extra: Record<string, number> | undefined = obj.extraEffects ? Object.fromEntries(Object.entries(obj.extraEffects).map(([k, v]) => [k, Number(v) || 0])) : undefined;

  return {
    enabled: obj.enabled !== false,
    name: String(obj.name ?? "Passive"),
    damageType, // ✅ ahora es "physical" | "magical"
    shortDescEn: obj.shortDescEn ? String(obj.shortDescEn) : undefined,
    longDescEn: obj.longDescEn ? String(obj.longDescEn) : undefined,
    trigger: {
      check: normPassiveCheck(obj.trigger?.check),
      scaleBy: "fate" as const,
      baseChancePercent: Number(obj.trigger?.baseChancePercent ?? 5),
      fateScalePerPoint: Number(obj.trigger?.fateScalePerPoint ?? 2),
      maxChancePercent: Number(obj.trigger?.maxChancePercent ?? 50),
    },
    durationTurns: Math.max(1, Math.trunc(Number(obj.durationTurns ?? obj.duration ?? 2))),
    bonusDamage: Math.max(0, Math.trunc(Number(obj.bonusDamage ?? 0))),
    extraEffects: extra, // ✅ mantiene el tipo esperado
  };
}

/** Normaliza objeto ultimate */
function normalizeUltimate(obj: any | null | undefined) {
  if (!obj) return null;
  return {
    enabled: obj.enabled !== false,
    name: String(obj.name ?? "Ultimate"),
    description: obj.description,
    cooldownTurns: clampInt(obj.cooldownTurns ?? 4, 0, 99),
    effects: obj.effects ?? undefined,
    proc: obj.proc
      ? {
          enabled: obj.proc.enabled !== false,
          respectCooldown: !!obj.proc.respectCooldown,
          trigger: {
            check: "onTurnStart" as const,
            scaleBy: "fate" as const,
            baseChancePercent: toNum(obj.proc?.trigger?.baseChancePercent, 2),
            fateScalePerPoint: toNum(obj.proc?.trigger?.fateScalePerPoint, 1),
            maxChancePercent: toNum(obj.proc?.trigger?.maxChancePercent, 25),
          },
        }
      : {
          enabled: true,
          respectCooldown: true,
          trigger: {
            check: "onTurnStart" as const,
            scaleBy: "fate" as const,
            baseChancePercent: 2,
            fateScalePerPoint: 1,
            maxChancePercent: 25,
          },
        },
  };
}

/** Selecciona el slug de arma desde distintas formas de equipo/snapshot. */
function selectWeaponSlug(character: any, classDefaultWeapon?: string): string {
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

  const dw = slugify(classDefaultWeapon);
  return dw || "fists";
}

/** Normaliza stats para usar 'constitution' y remover 'vitality'. */
function normalizeStatsConstitution(stats: Record<string, any>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(stats || {})) {
    if (k === "vitality") continue;
    out[k] = toNum(v, 0);
  }
  const vit = toNum((stats as any)?.vitality, NaN);
  if (Number.isFinite(vit)) {
    out.constitution = Math.max(out.constitution ?? 0, vit);
  }
  out.fate = toNum(out.fate, 0);
  out.constitution = toNum(out.constitution, 0);
  return out;
}

/* ───── Cálculo canónico de rango visible (pre-defensa) ───── */
const OFFHAND_WEAPON_CONTRIB_PERCENT = 35;
const OFFHAND_FOCUS_CONTRIB_PERCENT = 15;

function asInt(n: unknown) {
  return Math.trunc(Number(n) || 0);
}
function cat(w?: WeaponData | null) {
  return (w?.category || "weapon").toString().toLowerCase();
}
function readMainWeapon(character: any, classDefaultWeapon?: string): WeaponData {
  const slug = selectWeaponSlug(character, classDefaultWeapon);
  const raw = character?.equipment?.weapon ?? character?.equipment?.mainHand ?? character?.equipment?.mainWeapon ?? slug;
  return typeof raw === "string" ? weaponTemplateFor(raw) : normalizeWeaponData(raw);
}
function readOffWeapon(character: any): WeaponData | null {
  const offRaw = character?.equipment?.offHand ?? character?.equipment?.offhand ?? character?.equipment?.offWeapon ?? character?.equipment?.shield ?? null;
  if (!offRaw) return null;
  return normalizeWeaponData(offRaw);
}
function isMagicalClass(clsName: string) {
  const c = (clsName || "").toLowerCase();
  return c === "necromancer" || c === "exorcist";
}
function computeUiDamageRange(opts: { className: string; combat: CharacterSnapshot["combat"]; main: WeaponData; off: WeaponData | null; classPrimary?: string[] }): { min: number; max: number } {
  const { className, combat, main, off, classPrimary } = opts;
  const baseStat = isMagicalClass(className) ? asInt(combat.magicPower) : asInt(combat.attackPower);

  const primary = isPrimaryWeapon(main, classPrimary);
  const mult = primary ? PRIMARY_WEAPON_BONUS_MULT : 1;
  const loMain = Math.floor(Math.max(0, asInt((main as any).minDamage || 0)) * mult);
  const hiMain = Math.floor(Math.max(loMain, asInt((main as any).maxDamage || 0)) * mult);

  let loOff = 0,
    hiOff = 0;
  if (off) {
    const loB = Math.max(0, asInt((off as any).minDamage || 0));
    const hiB = Math.max(loB, asInt((off as any).maxDamage || 0));
    if (cat(off) === "weapon") {
      loOff = Math.floor((loB * OFFHAND_WEAPON_CONTRIB_PERCENT) / 100);
      hiOff = Math.floor((hiB * OFFHAND_WEAPON_CONTRIB_PERCENT) / 100);
    } else if (cat(off) === "focus") {
      loOff = Math.floor((loB * OFFHAND_FOCUS_CONTRIB_PERCENT) / 100);
      hiOff = Math.floor((hiB * OFFHAND_FOCUS_CONTRIB_PERCENT) / 100);
    }
  }

  return { min: baseStat + loMain + loOff, max: baseStat + hiMain + hiOff };
}

/* ───────── builder ───────── */
export function buildCharacterSnapshot(character: any): CharacterSnapshot {
  const userId = character?.userId ?? character?.user?._id ?? character?.user?.id;
  const characterId = character?._id ?? character?.id;
  const username = character?.username ?? character?.user?.username ?? character?.user?.name ?? "—";
  const name = character?.name ?? username ?? "—";

  const classDoc = character?.classId && typeof character.classId === "object" && (character.classId as any).name ? character.classId : character?.class;

  const className = String(classDoc?.name ?? character?.className ?? "—");
  const defaultWeapon = classDoc?.defaultWeapon ? String(classDoc.defaultWeapon) : undefined;
  const primaryWeapons = Array.isArray(classDoc?.primaryWeapons) ? classDoc.primaryWeapons.slice() : undefined;
  const secondaryWeapons = Array.isArray(classDoc?.secondaryWeapons) ? classDoc.secondaryWeapons.slice() : undefined;

  // Habilidades (normalizadas)
  const passiveDefaultSkill = normalizePassive(classDoc?.passiveDefaultSkill ?? null);
  const ultimateSkill = normalizeUltimate(classDoc?.ultimateSkill ?? null);

  const level = toNum(character?.level, 1);

  const weapon = selectWeaponSlug(character, defaultWeapon);

  const srcCombat = character?.combatStats ?? character?.combat ?? {};
  const combat = {
    attackPower: toNum(srcCombat.attackPower, 0),
    magicPower: toNum(srcCombat.magicPower, 0),
    evasion: toNum(srcCombat.evasion, 0),
    blockChance: toNum(srcCombat.blockChance, 0),
    damageReduction: toNum(srcCombat.damageReduction, 0),
    criticalChance: toNum(srcCombat.criticalChance, 0),
    criticalDamageBonus: toNum(srcCombat.criticalDamageBonus, 50),
    maxHP: toNum(srcCombat.maxHP ?? character?.maxHP, 100),
  };

  const maxHP = clampInt(character?.maxHP ?? combat.maxHP, 1, 10_000_000);
  const currentHP = clampInt(character?.currentHP ?? maxHP, 0, maxHP);

  const stats = normalizeStatsConstitution({ ...(character?.stats ?? {}) });
  const resistances = { ...(character?.resistances ?? {}) } as Record<string, number>;
  const equipment = { ...(character?.equipment ?? {}) } as Record<string, unknown>;

  const mainWeaponObj = readMainWeapon(character, defaultWeapon);
  const offWeaponObj = readOffWeapon(character);
  const uiRange = computeUiDamageRange({
    className,
    combat,
    main: mainWeaponObj,
    off: offWeaponObj,
    classPrimary: primaryWeapons,
  });

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

    uiDamageMin: Math.max(0, uiRange.min),
    uiDamageMax: Math.max(uiRange.min, uiRange.max),
  };

  return snap;
}

// src/battleSystem/core/Weapon.ts

export type WeaponCategory = "weapon" | "shield" | "focus";
export type WeaponDamageType = "physical" | "magic";

export interface WeaponData {
  slug: string; // ej: "rapier", "cursed_crossbow"
  minDamage: number; // daño mínimo del ítem (entero)
  maxDamage: number; // daño máximo del ítem (entero)
  type: WeaponDamageType; // tipo de daño base
  category?: WeaponCategory; // por defecto "weapon"
  hands?: 1 | 2; // opcional
}

/** Bonus multiplicativo si el arma es primaria de la clase */
export const PRIMARY_WEAPON_BONUS_MULT = 1.1; // +10% (ajustable)

/** Tira un entero uniforme en [minDamage, maxDamage] */
export function rollWeaponDamage(rng: () => number, w: WeaponData): number {
  if (!w) return 0;
  const min = Math.max(0, Math.floor(w.minDamage));
  const max = Math.max(min, Math.floor(w.maxDamage));
  if (max <= min) return min;
  const span = max - min + 1;
  const r = Math.floor(rng() * span);
  return min + r;
}

/* ─────────────────────────────────────────────────────────────────────
 * Helpers de normalización y plantillas por nombre/slug
 * ──────────────────────────────────────────────────────────────────── */

const slugify = (s: any) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const asWeaponType = (v: any): WeaponDamageType => {
  const s = String(v ?? "").toLowerCase();
  return s === "magic" || s === "magical" ? "magic" : "physical";
};

const coerceCategory = (v: any): WeaponCategory => {
  const s = String(v ?? "").toLowerCase();
  if (s === "shield") return "shield";
  if (s === "focus") return "focus";
  return "weapon";
};

/** Mapa de alias → clave base (agrupa nombres “de fantasía” a un arquetipo) */
const ALIAS: Record<string, string> = {
  // Vampire
  rapier: "rapier",
  dagger: "dagger",
  shortsword: "shortsword",
  scimitar: "scimitar",
  kris: "kris",
  shadowfang_blade: "scimitar",
  crimson_scimitar: "scimitar",
  bloodfang_sabre: "scimitar",
  shadow_kris: "kris",
  nightfang_blade: "scimitar",
  curved_fangblade: "scimitar",

  // Werewolf
  iron_claws: "iron_claws",
  dual_daggers: "dual_daggers",
  light_axe: "light_axe",
  feral_fangblade: "iron_claws",
  savage_paw: "iron_claws",
  claw_gauntlets: "iron_claws",
  beast_fangs: "iron_claws",
  dire_talons: "iron_claws",
  bloodclaw: "iron_claws",
  rendfangs: "iron_claws",

  // Necromancer
  bone_staff: "bone_staff",
  scepter: "scepter",
  wand: "wand",
  occult_rod: "occult_rod",
  grimoire: "grimoire",
  soul_orb: "soul_orb",
  corrupted_scepter: "scepter",
  skull_wand: "wand",
  plague_rod: "occult_rod",
  soulbone_cane: "bone_staff",
  ghoul_scepter: "scepter",
  occult_crook: "occult_rod",

  // Revenant
  cursed_crossbow: "cursed_crossbow",
  twin_flintlocks: "twin_flintlocks",
  shortbow: "shortbow",
  arquebus: "arquebus",
  hexed_rifle: "hexed_rifle",
  twin_daggers: "dual_daggers",
  ancient_pistol: "twin_flintlocks",
  bone_carbine: "hexed_rifle",
  spectral_arquebus: "arquebus",
  ghastly_handcannon: "hexed_rifle",

  // Exorcist
  holy_mace: "holy_mace",
  flail: "flail",
  warhammer: "warhammer",
  morningstar: "morningstar",
  censer: "censer",
  cleric_staff: "cleric_staff",
  consecrated_flail: "flail",
  blessed_morningstar: "morningstar",
  iron_censer: "censer",
  divine_hammer: "warhammer",
  sanctified_club: "holy_mace",

  // Genéricos
  shield: "shield",
  focus: "focus",
  fists: "fists",
};

/** Plantillas base por arquetipo (valores ejemplo consistentes con tu runner) */
const TEMPLATES: Record<string, WeaponData> = {
  // básicos / fallback
  fists: { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon", hands: 1 },

  // Vampire
  rapier: { slug: "rapier", minDamage: 18, maxDamage: 26, type: "physical", category: "weapon", hands: 1 },
  dagger: { slug: "dagger", minDamage: 12, maxDamage: 18, type: "physical", category: "weapon", hands: 1 },
  shortsword: { slug: "shortsword", minDamage: 16, maxDamage: 24, type: "physical", category: "weapon", hands: 1 },
  scimitar: { slug: "scimitar", minDamage: 20, maxDamage: 28, type: "physical", category: "weapon", hands: 1 },
  kris: { slug: "kris", minDamage: 14, maxDamage: 20, type: "physical", category: "weapon", hands: 1 },

  // Werewolf
  iron_claws: { slug: "iron_claws", minDamage: 16, maxDamage: 24, type: "physical", category: "weapon", hands: 1 },
  dual_daggers: { slug: "dual_daggers", minDamage: 10, maxDamage: 16, type: "physical", category: "weapon", hands: 1 },
  light_axe: { slug: "light_axe", minDamage: 18, maxDamage: 27, type: "physical", category: "weapon", hands: 1 },

  // Necromancer (mágicos / focus)
  bone_staff: { slug: "bone_staff", minDamage: 6, maxDamage: 10, type: "magic", category: "weapon", hands: 2 },
  scepter: { slug: "scepter", minDamage: 8, maxDamage: 12, type: "magic", category: "weapon", hands: 1 },
  wand: { slug: "wand", minDamage: 5, maxDamage: 9, type: "magic", category: "weapon", hands: 1 },
  occult_rod: { slug: "occult_rod", minDamage: 7, maxDamage: 11, type: "magic", category: "weapon", hands: 1 },
  grimoire: { slug: "grimoire", minDamage: 3, maxDamage: 6, type: "magic", category: "focus", hands: 1 },
  soul_orb: { slug: "soul_orb", minDamage: 2, maxDamage: 5, type: "magic", category: "focus", hands: 1 },

  // Revenant (ranged / 2 manos para algunos)
  cursed_crossbow: { slug: "cursed_crossbow", minDamage: 22, maxDamage: 32, type: "physical", category: "weapon", hands: 2 },
  twin_flintlocks: { slug: "twin_flintlocks", minDamage: 12, maxDamage: 18, type: "physical", category: "weapon", hands: 1 },
  shortbow: { slug: "shortbow", minDamage: 14, maxDamage: 22, type: "physical", category: "weapon", hands: 2 },
  arquebus: { slug: "arquebus", minDamage: 24, maxDamage: 34, type: "physical", category: "weapon", hands: 2 },
  hexed_rifle: { slug: "hexed_rifle", minDamage: 26, maxDamage: 38, type: "physical", category: "weapon", hands: 2 },

  // Exorcist (blunt)
  holy_mace: { slug: "holy_mace", minDamage: 15, maxDamage: 23, type: "physical", category: "weapon", hands: 1 },
  flail: { slug: "flail", minDamage: 16, maxDamage: 26, type: "physical", category: "weapon", hands: 1 },
  warhammer: { slug: "warhammer", minDamage: 22, maxDamage: 32, type: "physical", category: "weapon", hands: 2 },
  morningstar: { slug: "morningstar", minDamage: 18, maxDamage: 28, type: "physical", category: "weapon", hands: 1 },
  censer: { slug: "censer", minDamage: 8, maxDamage: 12, type: "magic", category: "focus", hands: 1 },
  cleric_staff: { slug: "cleric_staff", minDamage: 7, maxDamage: 11, type: "magic", category: "weapon", hands: 2 },

  // Defensa
  shield: { slug: "shield", minDamage: 0, maxDamage: 0, type: "physical", category: "shield", hands: 1 },
  focus: { slug: "focus", minDamage: 0, maxDamage: 0, type: "magic", category: "focus", hands: 1 },
};

/** Devuelve la plantilla para un nombre/slug; si no matchea, devuelve “fists”. */
export function weaponTemplateFor(nameOrSlug: string | undefined | null): WeaponData {
  const s = slugify(nameOrSlug);
  const key = ALIAS[s] ?? s;
  return TEMPLATES[key] ?? TEMPLATES.fists;
}

/**
 * Normaliza cualquier input a WeaponData:
 * - string → plantilla (weaponTemplateFor)
 * - objeto parcial → completa con defaults razonables
 * - null/undefined → “fists”
 */
export function normalizeWeaponData(input: any): WeaponData {
  if (!input) return TEMPLATES.fists;

  // Si es string, usar plantilla
  if (typeof input === "string") return weaponTemplateFor(input);

  const slug = slugify(input.slug ?? input.code ?? input.name ?? "unknown");

  // Si trae min/max, respetar y normalizar
  const min = Number.isFinite(Number(input.minDamage ?? input.min)) ? Math.max(0, Math.floor(Number(input.minDamage ?? input.min))) : undefined;
  const max = Number.isFinite(Number(input.maxDamage ?? input.max)) ? Math.max(0, Math.floor(Number(input.maxDamage ?? input.max))) : undefined;

  // Si no viene min/max, intentar por plantilla del slug
  if (typeof min === "undefined" || typeof max === "undefined") {
    const base = weaponTemplateFor(slug);
    return {
      slug: base.slug,
      minDamage: base.minDamage,
      maxDamage: base.maxDamage,
      type: asWeaponType(input.type ?? input.damageType ?? base.type),
      category: coerceCategory(input.category ?? input.kind ?? base.category ?? "weapon"),
      hands: input.hands === 2 ? 2 : base.hands ?? 1,
    };
  }

  // Si viene min>max, corregimos
  const fixedMin = min!;
  const fixedMax = Math.max(min!, max!);

  // 🛠 Mejora: si no pasan hands, usamos el de la plantilla, no forzamos 1
  const baseTpl = weaponTemplateFor(slug);

  return {
    slug: slug || "unknown",
    minDamage: fixedMin,
    maxDamage: fixedMax,
    type: asWeaponType(input.type ?? input.damageType ?? "physical"),
    category: coerceCategory(input.category ?? input.kind ?? baseTpl.category ?? "weapon"),
    hands: input.hands === 2 ? 2 : typeof input.hands === "number" ? 1 : baseTpl.hands ?? 1,
  };
}

/** Determina si un arma es “primaria” para la clase (para bonus del manager). */
export function isPrimaryWeapon(weapon: WeaponData | null | undefined, primaryNames: string[] | undefined): boolean {
  if (!weapon || !primaryNames?.length) return false;
  const w = slugify(weapon.slug);
  const prim = new Set(primaryNames.map(slugify).map((n) => ALIAS[n] ?? n));
  const base = ALIAS[w] ?? w;
  return prim.has(base);
}

/** Hints de “arma a distancia” por slug (por si querés centralizar en un único lugar) */
export const RANGED_HINTS_RX = /bow|crossbow|rifle|gun|pistol|arquebus|flintlock|handcannon/i;
export function isRangedWeapon(w?: WeaponData | null): boolean {
  if (!w) return false;
  return RANGED_HINTS_RX.test(w.slug);
}

/** Devuelve un arma válida o el default (fists / o el “defaultWeapon” de la clase si lo pasás). */
export function ensureWeaponOrDefault(rawWeapon: any, classDefaultName?: string): WeaponData {
  if (rawWeapon) return normalizeWeaponData(rawWeapon);
  if (classDefaultName) return weaponTemplateFor(classDefaultName);
  return TEMPLATES.fists;
}

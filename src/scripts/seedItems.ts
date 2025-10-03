// src/scripts/seedItems.ts
import { Item, type ItemDocument } from "../models/Item";
import type { SlotKey, WeaponData } from "../interfaces/Item/Item.interface";

/* ────────────────────────────────────────────────────────────────────────────
   Nocthalis Seed Items (v7, English)
   - Integer-only stats/scaling
   - Clear rarity hierarchy (common < uncommon < rare < epic < legendary)
   - Tiers: t1=1–10, t2=11–20, t3=21–30
   - Per-class THEMES only for role scaling (names/descriptions are NOT class-specific)
   - Weapons + items include generic audio.profile families (e.g., "sword","crossbow","gun","staff","magic",...)
   - Tooltip helpers: avgDamage, damageText
   - Mission/boss/normal tags, drop control via tags
   - iconUrl is SPECIFIC per type/tier/rarity (+ a small variant code), not a generic filename
──────────────────────────────────────────────────────────────────────────── */

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export const TIERS = [
  { key: "t1", label: "Novice", from: 1, to: 10, tierMul_bp: 10000 },
  { key: "t2", label: "Veteran", from: 11, to: 20, tierMul_bp: 14000 },
  { key: "t3", label: "Master", from: 21, to: 30, tierMul_bp: 18000 },
] as const;
export type Tier = (typeof TIERS)[number];
export type TierKey = Tier["key"];

const TIER_MAP: Record<TierKey, Tier> = Object.fromEntries(TIERS.map((t) => [t.key, t])) as Record<TierKey, Tier>;

const NAME_BY_TIER: Record<TierKey, string> = { t1: "Novice", t2: "Veteran", t3: "Master" };

/* Rarity multipliers (basis points) + flat steps (visible hierarchy) */
const RARITY_MUL_BP: Record<Rarity, number> = {
  common: 10000,
  uncommon: 11250,
  rare: 13000,
  epic: 15500,
  legendary: 19000,
};
const RARITY_FLAT_STEP: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 5,
};
const isRareOrAbove = (r: Rarity) => r === "rare" || r === "epic" || r === "legendary";
const isEpicOrAbove = (r: Rarity) => r === "epic" || r === "legendary";

/* Slot templates (t1-common baselines; icons are overridden per-item later) */
type Template = {
  type: "weapon" | "armor" | "accessory";
  baseStats?: Partial<Record<"strength" | "dexterity" | "intelligence" | "constitution" | "physicalDefense" | "magicalDefense" | "luck" | "endurance", number>>;
  baseCombat?: Partial<
    Record<"maxHP" | "criticalChance" | "criticalDamageBonus" | "evasion" | "blockChance" | "blockValue" | "lifeSteal" | "damageReduction" | "movementSpeed" | "magicPower" | "attackPower", number>
  >;
  weaponBase?: { min: number; max: number; speed?: number; hands?: 1 | 2; kind?: WeaponData["type"] };
  icon: string;
  nameHint: string;
};

const SLOT_TEMPLATES: Record<SlotKey, Template> = {
  helmet: { type: "armor", baseStats: { constitution: 2, physicalDefense: 2, magicalDefense: 1 }, icon: "/icons/helmet.png", nameHint: "Helm" },
  chest: { type: "armor", baseStats: { constitution: 3, physicalDefense: 3, magicalDefense: 2, endurance: 1 }, icon: "/icons/chest.png", nameHint: "Chestplate" },
  gloves: { type: "armor", baseStats: { strength: 1, dexterity: 1 }, icon: "/icons/gloves.png", nameHint: "Gauntlets" },
  boots: { type: "armor", baseCombat: { evasion: 1, movementSpeed: 1 }, icon: "/icons/boots.png", nameHint: "Boots" },
  mainWeapon: { type: "weapon", weaponBase: { min: 8, max: 14, speed: 100, hands: 1, kind: "sword" }, baseCombat: { attackPower: 2 }, icon: "/icons/main_weapon.png", nameHint: "Weapon" },
  offWeapon: { type: "accessory", baseStats: { physicalDefense: 1, magicalDefense: 1 }, icon: "/icons/off_weapon.png", nameHint: "Offhand" },
  ring: { type: "accessory", baseStats: { luck: 1 }, baseCombat: { criticalChance: 1 }, icon: "/icons/ring.png", nameHint: "Ring" },
  belt: { type: "accessory", baseStats: { endurance: 1 }, icon: "/icons/belt.png", nameHint: "Belt" },
  amulet: { type: "accessory", baseStats: { intelligence: 1 }, baseCombat: { magicPower: 3 }, icon: "/icons/amulet.png", nameHint: "Amulet" },
};

/* Class THEMES (for role scaling only; not printed in names/descriptions) */
const CLASS_MAP = [
  { name: "Vampire", role: "STR" as const, primary: ["Rapier", "Dagger"], secondary: ["Shortsword", "Scimitar", "Kris", "Shadowfang Blade"] },
  { name: "Necromancer", role: "INT" as const, primary: ["Bone Staff", "Scepter"], secondary: ["Wand", "Occult Rod", "Grimoire", "Soul Orb"] },
  { name: "Revenant", role: "DEX" as const, primary: ["Cursed Crossbow", "Twin Flintlocks"], secondary: ["Shortbow", "Arquebus", "Hexed Rifle", "Twin Daggers"] },
  { name: "Werewolf", role: "STR" as const, primary: ["Iron Claws", "Dual Daggers"], secondary: ["Shortsword", "Light Axe", "Feral Fangblade", "Savage Paw"] },
  { name: "Exorcist", role: "INT" as const, primary: ["Holy Mace", "Flail"], secondary: ["Warhammer", "Morningstar", "Censer", "Cleric Staff"] },
];

/* Generic audio families */
export type HitProfile = "sword" | "dagger" | "axe" | "mace" | "flail" | "warhammer" | "claws" | "bow" | "crossbow" | "gun" | "staff" | "magic";

type WeaponKindDef = { kind: string; hands: 1 | 2; speed?: number; audio: HitProfile };

/* Visual → technical kind map with audio + speed overrides */
const WEAPON_KIND_MAP: Record<string, WeaponKindDef> = {
  // Vampire theme weapons
  Rapier: { kind: "rapier", hands: 1, speed: 105, audio: "sword" },
  Dagger: { kind: "dagger", hands: 1, speed: 110, audio: "dagger" },
  Shortsword: { kind: "shortsword", hands: 1, speed: 100, audio: "sword" },
  Scimitar: { kind: "scimitar", hands: 1, speed: 100, audio: "sword" },
  Kris: { kind: "kris", hands: 1, speed: 105, audio: "dagger" },
  "Shadowfang Blade": { kind: "fangblade", hands: 1, speed: 102, audio: "sword" },

  // Necromancer theme weapons
  "Bone Staff": { kind: "staff", hands: 2, speed: 100, audio: "staff" },
  Scepter: { kind: "scepter", hands: 1, speed: 100, audio: "magic" },
  Wand: { kind: "wand", hands: 1, speed: 105, audio: "magic" },
  "Occult Rod": { kind: "rod", hands: 1, speed: 100, audio: "magic" },
  Grimoire: { kind: "grimoire", hands: 1, speed: 100, audio: "magic" },
  "Soul Orb": { kind: "orb", hands: 1, speed: 100, audio: "magic" },

  // Revenant theme weapons
  "Cursed Crossbow": { kind: "crossbow", hands: 2, speed: 100, audio: "crossbow" },
  "Twin Flintlocks": { kind: "pistol", hands: 2, speed: 105, audio: "gun" },
  Shortbow: { kind: "shortbow", hands: 2, speed: 103, audio: "bow" },
  Arquebus: { kind: "arquebus", hands: 2, speed: 95, audio: "gun" },
  "Hexed Rifle": { kind: "rifle", hands: 2, speed: 95, audio: "gun" },
  "Twin Daggers": { kind: "dagger", hands: 1, speed: 110, audio: "dagger" },

  // Werewolf theme weapons
  "Iron Claws": { kind: "claws", hands: 1, speed: 110, audio: "claws" },
  "Dual Daggers": { kind: "dagger", hands: 1, speed: 110, audio: "dagger" },
  "Light Axe": { kind: "axe", hands: 1, speed: 98, audio: "axe" },
  "Feral Fangblade": { kind: "fangblade", hands: 1, speed: 104, audio: "sword" },
  "Savage Paw": { kind: "claws", hands: 1, speed: 110, audio: "claws" },

  // Exorcist theme weapons
  "Holy Mace": { kind: "mace", hands: 1, speed: 98, audio: "mace" },
  Flail: { kind: "flail", hands: 1, speed: 96, audio: "flail" },
  Warhammer: { kind: "warhammer", hands: 2, speed: 92, audio: "warhammer" },
  Morningstar: { kind: "morningstar", hands: 1, speed: 96, audio: "mace" }, // grouped under "mace"
  Censer: { kind: "censer", hands: 1, speed: 100, audio: "mace" }, // grouped under "mace"
  "Cleric Staff": { kind: "staff", hands: 2, speed: 100, audio: "staff" },
};

/* Base weapon damage per technical kind (integers) */
const BASE_WEAPON_DMG: Record<string, { min: number; max: number; hands: 1 | 2; speed?: number }> = {
  rapier: { min: 8, max: 14, hands: 1 },
  dagger: { min: 8, max: 13, hands: 1 },
  shortsword: { min: 9, max: 15, hands: 1 },
  scimitar: { min: 10, max: 16, hands: 1 },
  kris: { min: 9, max: 14, hands: 1 },
  fangblade: { min: 10, max: 16, hands: 1 },

  staff: { min: 7, max: 12, hands: 2 },
  scepter: { min: 10, max: 16, hands: 1 },
  wand: { min: 9, max: 14, hands: 1 },
  rod: { min: 10, max: 15, hands: 1 },
  grimoire: { min: 8, max: 13, hands: 1 },
  orb: { min: 7, max: 12, hands: 1 },

  crossbow: { min: 10, max: 17, hands: 2 },
  pistol: { min: 12, max: 19, hands: 2 },
  shortbow: { min: 10, max: 16, hands: 2 },
  arquebus: { min: 15, max: 24, hands: 2 },
  rifle: { min: 14, max: 23, hands: 2 },

  claws: { min: 9, max: 15, hands: 1 },
  axe: { min: 12, max: 20, hands: 1 },

  mace: { min: 11, max: 18, hands: 1 },
  flail: { min: 14, max: 22, hands: 1 },
  warhammer: { min: 18, max: 28, hands: 2 },
  morningstar: { min: 12, max: 19, hands: 1 },
  censer: { min: 9, max: 15, hands: 1 },
};

/* Helpers (integers only) */
function scaleInt(base: number, mul1_bp: number, mul2_bp: number) {
  const a = Math.max(0, Math.floor(base));
  const n = a * mul1_bp;
  const n2 = Math.floor(n / 10000) * mul2_bp;
  return Math.floor(n2 / 10000);
}
function avg(min: number, max: number) {
  return Math.round((min + max) / 2);
}
function Cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/* ── ICON HELPERS ─────────────────────────────────────────────────────────── */

const ICON_WEAPONS_DIR = "/icons/weapons";
const ICON_ARMOR_DIR = "/icons/armor";
const ICON_ACCESSORIES_DIR = "/icons/accessories";

function iconForWeapon(kind: string, tierKey: TierKey, rarity: Rarity, variant: number) {
  // Example: /icons/weapons/axe_t3_legendary_v9.png
  return `${ICON_WEAPONS_DIR}/${kind}_${tierKey}_${rarity}_v${variant}.png`;
}
function iconForArmorSlot(slot: SlotKey, tierKey: TierKey, rarity: Rarity, variant: number) {
  // Armor vs Accessories
  const isArmor = slot === "helmet" || slot === "chest" || slot === "gloves" || slot === "boots";
  const baseDir = isArmor ? ICON_ARMOR_DIR : ICON_ACCESSORIES_DIR;
  // Example armor: /icons/armor/helmet_t2_rare_v3.png
  // Example accessory: /icons/accessories/ring_t1_uncommon_v0.png
  return `${baseDir}/${slot}_${tierKey}_${rarity}_v${variant}.png`;
}

/* Power weights for pricing (simple monotonic score) */
const STAT_WEIGHT: Record<string, number> = {
  constitution: 10,
  strength: 3,
  dexterity: 3,
  intelligence: 3,
  physicalDefense: 7,
  magicalDefense: 7,
  endurance: 4,
  luck: 4,
  maxHP: 2,
  evasion: 4,
  movementSpeed: 4,
  magicPower: 5,
  attackPower: 5,
  blockChance: 5,
  blockValue: 6,
  damageReduction: 8,
  criticalChance: 6,
  criticalDamageBonus: 6,
};
const SLOT_PRICE_WEIGHT: Record<SlotKey, number> = {
  helmet: 10,
  chest: 14,
  gloves: 8,
  boots: 9,
  mainWeapon: 16,
  offWeapon: 7,
  amulet: 11,
  belt: 9,
  ring: 10,
};

/* Seed item type (includes audio + UI helpers) */
export type SeedItemInput = {
  slug: string;
  name: string;
  description?: string;

  type: "weapon" | "armor" | "accessory";
  slot: SlotKey;
  rarity: Rarity;
  iconUrl: string;

  audio?: { profile: HitProfile }; // item-level audio tag

  weapon?: WeaponData & { audio?: { profile: HitProfile } };
  stats?: Record<string, number>;
  combatStats?: Record<string, number>;

  // UI helpers (optional)
  avgDamage?: number;
  damageText?: string;

  levelRequirement: number;
  sellPrice?: number;

  tradable?: boolean;
  durable?: boolean;
  durability?: number;

  classRestriction?: string[]; // keep field for future; empty for now
  tags?: string[];

  isUnique?: boolean;
  isBound?: boolean;
  isCraftable?: boolean;
  isConsumable?: boolean;

  mods?: any[];
  affixes?: any[];
};

/* Pricing */
function computePower(stats: Record<string, number> = {}, combat: Record<string, number> = {}, weapon?: WeaponData) {
  let p = 0;
  for (const [k, v] of Object.entries(stats)) p += (STAT_WEIGHT[k] ?? 0) * v;
  for (const [k, v] of Object.entries(combat)) p += (STAT_WEIGHT[k] ?? 0) * v;
  if (weapon?.damage) {
    const a = avg(weapon.damage.min, weapon.damage.max);
    p += a * 3;
    p += weapon.hands === 2 ? 4 : 0;
    p += Math.floor((weapon.speed ?? 100) - 100) / 5;
  }
  return Math.max(1, Math.floor(p));
}
function computeSellPrice(slot: SlotKey, rarity: Rarity, tierKey: TierKey, levelReq: number, powerScore: number) {
  const slotW = SLOT_PRICE_WEIGHT[slot] ?? 10;
  const tierIdx = tierKey === "t1" ? 1 : tierKey === "t2" ? 2 : 3;
  const rMul = { common: 10, uncommon: 12, rare: 16, epic: 22, legendary: 30 }[rarity];
  const base = slotW * rMul * tierIdx;
  const lvlFactor = 10 + Math.floor(levelReq / 2);
  const pFactor = 5 + Math.floor(powerScore / 20);
  return Math.max(1, base + lvlFactor + pFactor);
}

/* makeRow with explicit tierKey */
function makeRowWithTier(p: Omit<SeedItemInput, "slug"> & { slug: string }, tierKey: TierKey): SeedItemInput {
  const power = computePower(p.stats ?? {}, p.combatStats ?? {}, p.weapon);
  const sell = p.sellPrice ?? computeSellPrice(p.slot, p.rarity, tierKey, p.levelRequirement, power);
  return {
    slug: p.slug,
    name: p.name,
    description: p.description ?? "",
    type: p.type,
    slot: p.slot,
    rarity: p.rarity,
    iconUrl: p.iconUrl,
    audio: p.audio,
    weapon: p.weapon,
    stats: p.stats ?? {},
    combatStats: p.combatStats ?? {},
    avgDamage: p.avgDamage ?? 0,
    damageText: p.damageText ?? "",
    levelRequirement: p.levelRequirement,
    sellPrice: sell,
    tradable: p.tradable ?? true,
    durable: p.durable ?? (p.type === "weapon" || p.type === "armor"),
    durability: p.durability ?? (p.type === "weapon" || p.type === "armor" ? 100 : 0),
    classRestriction: p.classRestriction ?? [],
    tags: p.tags ?? [],
    isUnique: p.isUnique ?? p.rarity === "legendary",
    isBound: p.isBound ?? false,
    isCraftable: p.isCraftable ?? false,
    isConsumable: p.isConsumable ?? false,
    mods: p.mods ?? [],
    affixes: p.affixes ?? [],
  };
}

/* Armor/accessory scaling by role/tier/rarity */
function roleArmorStats(role: "STR" | "DEX" | "INT", slot: SlotKey, tierKey: TierKey, rarity: Rarity) {
  const base = SLOT_TEMPLATES[slot];
  const stats: Record<string, number> = {};
  const combat: Record<string, number> = {};

  if (base.baseStats) for (const [k, v] of Object.entries(base.baseStats)) stats[k] = v!;
  if (base.baseCombat) for (const [k, v] of Object.entries(base.baseCombat)) combat[k] = v!;

  const tierMul = TIER_MAP[tierKey].tierMul_bp;
  const rMul = RARITY_MUL_BP[rarity];

  for (const k of Object.keys(stats)) stats[k] = Math.max(0, scaleInt(stats[k], tierMul, rMul));
  for (const k of Object.keys(combat)) combat[k] = Math.max(0, scaleInt(combat[k], tierMul, rMul));

  const step = RARITY_FLAT_STEP[rarity];

  if (slot === "helmet" || slot === "chest") {
    stats.constitution = (stats.constitution ?? 0) + (slot === "chest" ? step + 1 : step);
    stats.physicalDefense = (stats.physicalDefense ?? 0) + step;
    stats.magicalDefense = (stats.magicalDefense ?? 0) + Math.max(0, step - 1);
    if (role === "STR" && isRareOrAbove(rarity)) {
      combat.blockChance = (combat.blockChance ?? 0) + 1;
    }
  }
  if (slot === "gloves") {
    if (role === "STR") stats.strength = (stats.strength ?? 0) + step;
    if (role === "DEX") stats.dexterity = (stats.dexterity ?? 0) + step;
    if (role === "INT") stats.intelligence = (stats.intelligence ?? 0) + step;
  }
  if (slot === "boots") {
    combat.evasion = (combat.evasion ?? 0) + Math.min(step, 3);
    if (isEpicOrAbove(rarity)) combat.movementSpeed = (combat.movementSpeed ?? 0) + 1;
  }
  if (slot === "amulet") {
    stats.intelligence = (stats.intelligence ?? 0) + (role === "INT" ? step : Math.max(0, step - 1));
    combat.magicPower = (combat.magicPower ?? 0) + (role === "INT" ? step + 1 : Math.max(0, step - 1));
  }
  if (slot === "ring") {
    stats.luck = (stats.luck ?? 0) + 1 + Math.floor(step / 2);
    combat.criticalChance = (combat.criticalChance ?? 0) + step;
  }
  if (slot === "belt") {
    stats.endurance = (stats.endurance ?? 0) + step;
  }

  const tierPlus = tierKey === "t2" ? 1 : tierKey === "t3" ? 2 : 0;
  if (slot === "helmet" || slot === "chest") stats.constitution += tierPlus;

  return { stats, combat };
}

/* Generic description/lore (not class-specific) */
function buildDescriptionGeneric(tierKey: TierKey, rarity: Rarity, kind: "weapon" | "armor" | "accessory"): string {
  const tierN = NAME_BY_TIER[tierKey];
  const rarityTxt = Cap(rarity);
  const base = `Forged under the Shattered Moon.`;
  if (rarity === "legendary") return `${base} A ${tierN} ${rarityTxt} piece said to echo Titanic remnants.`;
  if (rarity === "epic") return `${base} A ${tierN} ${rarityTxt} item thrumming with Resonance.`;
  return `${base} A ${tierN} ${rarityTxt} ${kind}.`;
}

/* Rarity generator: cycles to ensure variety */
function* rarityCycle(): Generator<Rarity> {
  const seq: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
  let i = 0;
  while (true) yield seq[i++ % seq.length];
}

/* Armor & Accessories (10 per slot per theme; names/descriptions NOT class-specific) */
function generateArmorAndAccessories(): SeedItemInput[] {
  const out: SeedItemInput[] = [];
  const pieces: { slot: SlotKey; name: string }[] = [
    { slot: "helmet", name: "Helm" },
    { slot: "chest", name: "Chestplate" },
    { slot: "gloves", name: "Gauntlets" },
    { slot: "boots", name: "Boots" },
    { slot: "amulet", name: "Amulet" },
    { slot: "belt", name: "Belt" },
    { slot: "ring", name: "Ring" },
  ];

  for (const theme of CLASS_MAP) {
    const rgen = rarityCycle();
    for (const piece of pieces) {
      for (let n = 0; n < 10; n++) {
        const tier: Tier = n < 4 ? TIER_MAP.t1 : n < 7 ? TIER_MAP.t2 : TIER_MAP.t3;
        const rarity: Rarity = rgen.next().value!;
        const { stats, combat } = roleArmorStats(theme.role, piece.slot, tier.key, rarity);

        const name = `${piece.name} — ${NAME_BY_TIER[tier.key]} (${Cap(rarity)})`;
        const slug = `${piece.slot}_${theme.name.toLowerCase()}_${tier.key}_${rarity}_${n}`;
        const tags = [`tier:${tier.key}`, `lvl:${tier.from}-${tier.to}`, "mission:ready", "drop:allowed", "enemy:normal", "enemy:boss"];

        out.push(
          makeRowWithTier(
            {
              slug,
              name,
              description: buildDescriptionGeneric(tier.key, rarity, piece.slot === "helmet" || piece.slot === "chest" || piece.slot === "gloves" || piece.slot === "boots" ? "armor" : "accessory"),
              type: piece.slot === "helmet" || piece.slot === "chest" || piece.slot === "gloves" || piece.slot === "boots" ? "armor" : "accessory",
              slot: piece.slot,
              rarity,
              iconUrl: iconForArmorSlot(piece.slot, tier.key, rarity, n), // ⬅️ specific icon path
              stats,
              combatStats: combat,
              levelRequirement: tier.from,
              classRestriction: [], // equipable by any class (keep field for future)
              tags,
              durable: piece.slot === "helmet" || piece.slot === "chest" || piece.slot === "gloves" || piece.slot === "boots",
            },
            tier.key
          )
        );
      }
    }
  }
  return out;
}

/* Weapons (10 per theme; names/descriptions NOT class-specific; audio/profile generic) */
function scaledDamage(base: { min: number; max: number }, tierMul_bp: number, rarity_bp: number) {
  const min = Math.max(1, scaleInt(base.min, tierMul_bp, rarity_bp));
  const max = Math.max(min + 1, scaleInt(base.max, tierMul_bp, rarity_bp));
  return { min, max };
}
function buildWeapon(def: WeaponKindDef, tierKey: TierKey, rarity: Rarity): WeaponData & { audio?: { profile: HitProfile } } {
  const t = TIER_MAP[tierKey];
  const base = BASE_WEAPON_DMG[def.kind];
  const dmg = scaledDamage(base, t.tierMul_bp, RARITY_MUL_BP[rarity]);

  const speed = def.speed ?? base.speed ?? 100;
  const hands = def.hands;

  const w: WeaponData & { audio?: { profile: HitProfile } } = {
    slug: `wp_${def.kind}_${dmg.min}to${dmg.max}`,
    type: def.kind as any,
    hands,
    damage: dmg,
    speed,
    critBonus_bp: 0,
    range: ["bow", "shortbow", "crossbow", "pistol", "arquebus", "rifle"].includes(def.kind) ? 1 : 0,
    audio: { profile: def.audio }, // weapon-level audio tag
  };
  return w;
}

function generateClassWeapons(): SeedItemInput[] {
  const out: SeedItemInput[] = [];
  for (const theme of CLASS_MAP) {
    const names = [...theme.primary, ...theme.secondary].filter((n) => WEAPON_KIND_MAP[n]);
    for (let i = 0; i < 10; i++) {
      const vis = names[i % names.length];
      const def = WEAPON_KIND_MAP[vis];
      const tierKey: TierKey = i < 4 ? "t1" : i < 7 ? "t2" : "t3";
      const rarity: Rarity = RARITIES[i % RARITIES.length];

      const weapon = buildWeapon(def, tierKey, rarity);

      // small flat role bonuses (integer-only)
      const cstats: Record<string, number> = {};
      if (theme.role === "STR") cstats.attackPower = (tierKey === "t1" ? 2 : tierKey === "t2" ? 3 : 4) + (rarity === "legendary" ? 2 : isEpicOrAbove(rarity) ? 1 : 0);
      if (theme.role === "DEX") cstats.criticalChance = (tierKey === "t1" ? 2 : tierKey === "t2" ? 3 : 4) + (isEpicOrAbove(rarity) ? 1 : 0);
      if (theme.role === "INT") cstats.magicPower = (tierKey === "t1" ? 3 : tierKey === "t2" ? 4 : 5) + (rarity === "legendary" ? 2 : isEpicOrAbove(rarity) ? 1 : 0);

      // Legendary: light extra to feel special (not OP)
      if (rarity === "legendary") {
        if (theme.role === "STR") {
          cstats.criticalChance = (cstats.criticalChance ?? 0) + 2;
          cstats.damageReduction = (cstats.damageReduction ?? 0) + 1;
        } else if (theme.role === "DEX") {
          cstats.evasion = (cstats.evasion ?? 0) + 2;
          cstats.criticalDamageBonus = (cstats.criticalDamageBonus ?? 0) + 4;
        } else if (theme.role === "INT") {
          cstats.magicPower = (cstats.magicPower ?? 0) + 2;
          cstats.blockValue = (cstats.blockValue ?? 0) + 2;
        }
      }

      const avgDamage = Math.round((weapon.damage.min + weapon.damage.max) / 2);
      const damageText = `Damage ${weapon.damage.min}–${weapon.damage.max} (~${avgDamage})`;

      const name = `${vis} — ${NAME_BY_TIER[tierKey]} (${Cap(rarity)})`;
      const slug = `wp_${def.kind}_${tierKey}_${rarity}_${i}`;
      const desc = buildDescriptionGeneric(tierKey, rarity, "weapon");

      out.push(
        makeRowWithTier(
          {
            slug,
            name,
            description: desc,
            type: "weapon",
            slot: "mainWeapon",
            rarity,
            iconUrl: iconForWeapon(def.kind, tierKey, rarity, i), // ⬅️ specific icon path
            audio: { profile: def.audio }, // item-level audio tag
            weapon,
            stats: {},
            combatStats: cstats,
            avgDamage,
            damageText,
            levelRequirement: TIER_MAP[tierKey].from,
            classRestriction: [], // equipable by any class (kept for future restrictions)
            tags: [`tier:${tierKey}`, `lvl:${TIER_MAP[tierKey].from}-${TIER_MAP[tierKey].to}`, "mission:ready", "drop:allowed", "enemy:normal", "enemy:boss"],
            durable: true,
          },
          tierKey
        )
      );
    }
  }
  return out;
}

/* Build catalog */
export function buildSeedItems(): SeedItemInput[] {
  const items: SeedItemInput[] = [];
  items.push(...generateArmorAndAccessories());
  items.push(...generateClassWeapons());
  return items;
}

/* Insert (idempotent on duplicate slugs) */
export async function insertSeedItems(rows: SeedItemInput[] = buildSeedItems()): Promise<ItemDocument[]> {
  if (!rows.length) return [];
  try {
    const inserted = await Item.insertMany(rows, { ordered: false });
    return inserted as ItemDocument[];
  } catch (err: any) {
    if (err?.writeErrors) {
      const slugs = rows.map((r) => r.slug);
      const existing = await Item.find({ slug: { $in: slugs } }).lean<ItemDocument[]>();
      return existing as ItemDocument[];
    }
    throw err;
  }
}

/* Frontend tooltip hints:
   - Weapons: item.damageText ("Damage X–Y (~avg)")
   - Armor/Accessories: list positive stats/combatStats (>0)
   - Epic/Legendary: description already includes short lore lines.
   - Audio:
       - Item-level: item.audio.profile ("sword","crossbow","gun","staff","magic",...)
       - Weapon-level: item.weapon.audio.profile (same family)
   - Icons:
       - Weapons:  /icons/weapons/{kind}_{tier}_{rarity}_v{n}.png
       - Armor:    /icons/armor/{slot}_{tier}_{rarity}_v{n}.png
       - Access.:  /icons/accessories/{slot}_{tier}_{rarity}_v{n}.png
*/

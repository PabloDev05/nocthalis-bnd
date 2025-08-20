// src/scripts/seedItems.ts
import { Item, type ItemDocument } from "../models/Item";
import type { SlotKey, WeaponData } from "../interfaces/Item/Item.interface";

// ───────────────────────────────────────────────────────────────────────────────
// Tipos y constantes base (todo en enteros / basis points)
// ───────────────────────────────────────────────────────────────────────────────

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

// Multiplicadores en basis points (bp). 10000 = x1.0
const RARITY_BP: Record<Rarity, number> = {
  common: 10000,
  uncommon: 12000,
  rare: 15000,
  epic: 20000,
  legendary: 27000,
} as const;

const TIERS = [
  { key: "novato", from: 1, to: 5, baseMul_bp: 10000 },
  { key: "veterano", from: 6, to: 10, baseMul_bp: 15000 },
  { key: "maestro", from: 11, to: 15, baseMul_bp: 22000 },
] as const;

const NAME_BY_TIER: Record<(typeof TIERS)[number]["key"], string> = {
  novato: "Novato",
  veterano: "Veterano",
  maestro: "Maestro",
};

// Plantillas por slot (sin agility ni wisdom)
type Template = {
  type: "weapon" | "armor" | "accessory" | "potion" | "material";
  // Bonus base a stats “base” válidos
  baseStats?: Partial<Record<"strength" | "dexterity" | "intelligence" | "vitality" | "physicalDefense" | "magicalDefense" | "luck" | "endurance", number>>;
  // Bonus base a stats de combate válidos
  baseCombat?: Partial<
    Record<
      "maxHP" | "criticalChance" | "criticalDamageBonus" | "attackSpeed" | "evasion" | "blockChance" | "blockValue" | "lifeSteal" | "damageReduction" | "movementSpeed" | "magicPower" | "attackPower",
      number
    >
  >;
  // Si es arma principal, definimos “base” para min/max (luego se escala)
  weaponBase?: { min: number; max: number; speed?: number; hands?: 1 | 2; kind?: WeaponData["type"] };
  icon: string;
  nameHint: string;
};

const SLOT_TEMPLATES: Record<SlotKey, Template> = {
  helmet: {
    type: "armor",
    baseStats: { vitality: 1, physicalDefense: 1, magicalDefense: 1 },
    icon: "/icons/helmet.png",
    nameHint: "Yelmo",
  },
  chest: {
    type: "armor",
    baseStats: { vitality: 2, physicalDefense: 2, magicalDefense: 1, endurance: 1 },
    icon: "/icons/chest.png",
    nameHint: "Peto",
  },
  gloves: {
    type: "armor",
    baseStats: { strength: 1, dexterity: 1 },
    icon: "/icons/gloves.png",
    nameHint: "Guanteletes",
  },
  boots: {
    type: "armor",
    baseCombat: { evasion: 1, movementSpeed: 1 },
    icon: "/icons/boots.png",
    nameHint: "Botas",
  },
  mainWeapon: {
    type: "weapon",
    // Referencia base; se escalará por tier/rareza
    weaponBase: { min: 6, max: 10, speed: 100, hands: 1, kind: "sword" },
    // Podés sumar un poquito de AP/Magic si querés mantener compat:
    baseCombat: { attackPower: 2 },
    icon: "/icons/main_weapon.png",
    nameHint: "Arma",
  },
  offWeapon: {
    // Mantengo “accessory” para compat; CombatManager actual ignora offhand
    type: "accessory",
    baseStats: { physicalDefense: 1, magicalDefense: 1 },
    icon: "/icons/off_weapon.png",
    nameHint: "Apoyo",
  },
  ring: {
    type: "accessory",
    baseStats: { luck: 1 },
    baseCombat: { criticalChance: 1 },
    icon: "/icons/ring.png",
    nameHint: "Sortija",
  },
  belt: {
    type: "accessory",
    baseStats: { endurance: 1 },
    icon: "/icons/belt.png",
    nameHint: "Cinturón",
  },
  amulet: {
    type: "accessory",
    baseStats: { intelligence: 1 },
    baseCombat: { magicPower: 3 },
    icon: "/icons/amulet.png",
    nameHint: "Amuleto",
  },
};

// Entrada para crear un ítem (coincide con tu schema — incluye slug y weapon)
export type SeedItemInput = {
  slug: string;
  name: string;
  description?: string;

  type: "weapon" | "armor" | "accessory" | "potion" | "material";
  slot: SlotKey;
  rarity: Rarity;
  iconUrl: string;

  weapon?: WeaponData; // solo para mainWeapon
  stats?: Record<string, number>;
  combatStats?: Record<string, number>;

  levelRequirement: number;
  sellPrice?: number;
  tradable?: boolean;
  effects?: string[];
  durability?: number;
  isUnique?: boolean;
  isBound?: boolean;
  isCraftable?: boolean;
  isConsumable?: boolean;
};

// ───────────────────────────────────────────────────────────────────────────────
// Extras genéricos: SIN maná (sacamos maxMP del juego). Slot “belt” para cumplir schema.
// ───────────────────────────────────────────────────────────────────────────────
const EXTRA_GENERIC: Omit<SeedItemInput, "slug">[] = [
  {
    name: "Poción Pequeña de Vida",
    type: "potion",
    slot: "belt",
    rarity: "common",
    iconUrl: "/icons/pot_hp_s.png",
    levelRequirement: 1,
    isConsumable: true,
    effects: ["restore_hp_50"],
  },
  // ← Eliminada la de Maná
  { name: "Fragmento de Runa", type: "material", slot: "belt", rarity: "uncommon", iconUrl: "/icons/rune_frag.png", levelRequirement: 3 },
  { name: "Gema Brillante", type: "material", slot: "belt", rarity: "rare", iconUrl: "/icons/gem_bright.png", levelRequirement: 6 },
];

// ───────────────────────────────────────────────────────────────────────────────
// Helpers (solo enteros)
// ───────────────────────────────────────────────────────────────────────────────
function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
// (a * m1 * m2) / 10000 / 10000, sólo enteros
function scaleInt(base: number, mul1_bp: number, mul2_bp: number) {
  const a = Math.max(0, Math.floor(base));
  const n = a * mul1_bp;
  const n2 = Math.floor(n / 10000) * mul2_bp;
  return Math.floor(n2 / 10000);
}

function makeRow(p: Omit<SeedItemInput, "slug"> & { slug: string }): SeedItemInput {
  // precio: base 10 * rarity * (1 + lvlReq/10) → todo en enteros/BP
  const lvlFactor_bp = 10000 + p.levelRequirement * 1000; // 10000 + 1000*lvl/10  ≈ 1 + lvl/10
  const price = Math.max(1, scaleInt(10, RARITY_BP[p.rarity], lvlFactor_bp));

  return {
    slug: p.slug,
    name: p.name,
    description: p.description ?? "",
    type: p.type,
    slot: p.slot,
    rarity: p.rarity,
    iconUrl: p.iconUrl,
    weapon: p.weapon,
    stats: p.stats ?? {},
    combatStats: p.combatStats ?? {},
    levelRequirement: p.levelRequirement,
    sellPrice: p.sellPrice ?? price,
    tradable: p.tradable ?? true,
    effects: p.effects ?? [],
    durability: p.durability ?? (p.type === "weapon" || p.type === "armor" ? 100 : 0),
    isUnique: p.isUnique ?? p.rarity === "legendary",
    isBound: p.isBound ?? false,
    isCraftable: p.isCraftable ?? false,
    isConsumable: p.isConsumable ?? false,
  };
}

function weaponFor(slot: SlotKey, tpl: Template, tierMul_bp: number, rarity_bp: number): WeaponData | undefined {
  if (slot !== "mainWeapon" || !tpl.weaponBase) return undefined;
  const min = Math.max(0, scaleInt(tpl.weaponBase.min, tierMul_bp, rarity_bp));
  const max = Math.max(min + 1, scaleInt(tpl.weaponBase.max, tierMul_bp, rarity_bp));
  const hands = tpl.weaponBase.hands ?? 1;
  const kind = tpl.weaponBase.kind ?? "sword";
  return {
    slug: `wp_${kind}_${min}to${max}`,
    type: kind,
    hands,
    damage: { min, max },
    speed: tpl.weaponBase.speed ?? 100,
    critBonus_bp: 0,
    range: kind === "bow" || kind === "crossbow" ? 1 : 0,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
/** Genera el catálogo seed dinámicamente (por slot × tier × rareza) */
export function buildSeedItems(): SeedItemInput[] {
  const items: SeedItemInput[] = [];

  (Object.keys(SLOT_TEMPLATES) as SlotKey[]).forEach((slot) => {
    const tpl = SLOT_TEMPLATES[slot];

    TIERS.forEach((t) => {
      const rarities: Rarity[] = t.from >= 11 ? ["common", "uncommon", "rare", "epic", "legendary"] : ["common", "uncommon", "rare", "epic"];

      rarities.forEach((r) => {
        const stats: Record<string, number> = {};
        const combat: Record<string, number> = {};

        // Escalado entero con basis points
        if (tpl.baseStats) {
          for (const [k, v] of Object.entries(tpl.baseStats)) {
            stats[k] = scaleInt(v as number, t.baseMul_bp, RARITY_BP[r]);
          }
        }
        if (tpl.baseCombat) {
          for (const [k, v] of Object.entries(tpl.baseCombat)) {
            combat[k] = scaleInt(v as number, t.baseMul_bp, RARITY_BP[r]);
          }
        }

        const wpn = weaponFor(slot, tpl, t.baseMul_bp, RARITY_BP[r]);
        const tierName = NAME_BY_TIER[t.key];
        const name = `${tpl.nameHint} ${tierName} (${cap(r)})`;
        const slug = `${slot}_${t.key}_${r}`;

        items.push(
          makeRow({
            slug,
            name,
            description: "",
            type: tpl.type,
            slot,
            rarity: r,
            iconUrl: tpl.icon,
            weapon: wpn, // solo para mainWeapon
            stats,
            combatStats: combat, // mantenemos compat con tu código actual
            levelRequirement: t.from,
          })
        );
      });
    });
  });

  // Extras (agregamos slugs)
  items.push(
    ...EXTRA_GENERIC.map((p) =>
      makeRow({
        ...p,
        slug: p.name.toLowerCase().replace(/\s+/g, "_"),
      })
    )
  );

  return items;
}

/** Inserta los items seed y devuelve los documentos insertados tipados. */
export async function insertSeedItems(rows: SeedItemInput[] = buildSeedItems()): Promise<ItemDocument[]> {
  if (!rows.length) return [];
  // Si querés tolerar duplicados de slug sin tirar toda la inserción, usá { ordered: false }
  const inserted = await Item.insertMany(rows, { ordered: true });
  return inserted as ItemDocument[];
}

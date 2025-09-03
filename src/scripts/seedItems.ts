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

// Plantillas por slot (sin mana/maxMP)
type Template = {
  type: "weapon" | "armor" | "accessory" | "potion" | "material";
  baseStats?: Partial<Record<"strength" | "dexterity" | "intelligence" | "vitality" | "physicalDefense" | "magicalDefense" | "luck" | "endurance", number>>;
  baseCombat?: Partial<
    Record<
      "maxHP" | "criticalChance" | "criticalDamageBonus" | "attackSpeed" | "evasion" | "blockChance" | "blockValue" | "lifeSteal" | "damageReduction" | "movementSpeed" | "magicPower" | "attackPower",
      number
    >
  >;
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
    weaponBase: { min: 6, max: 10, speed: 100, hands: 1, kind: "sword" },
    baseCombat: { attackPower: 2 },
    icon: "/icons/main_weapon.png",
    nameHint: "Arma",
  },
  offWeapon: {
    // Sigue como accessory para compat actual. Cuando agregues escudos reales:
    // usá un objeto con { category: "shield", ... } y el runner aplicará el bonus.
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

// Entrada para crear un ítem (coincide con tu schema)
export type SeedItemInput = {
  slug: string;
  name: string;
  description?: string;

  type: "weapon" | "armor" | "accessory" | "potion" | "material";
  slot: SlotKey;
  rarity: Rarity;
  iconUrl: string;

  weapon?: WeaponData; // solo si slot === "mainWeapon"
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
// Extras genéricos (sin maná)
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
  // precio: base 10 * rarity * (1 + levelRequirement/10)
  const lvlFactor_bp = 10000 + p.levelRequirement * 1000; // 10000 = 1.0; +1000 por nivel = +0.1 por nivel
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
  // 🔧 asegurar min ≥ 1 y max ≥ min + 1
  const minRaw = scaleInt(tpl.weaponBase.min, tierMul_bp, rarity_bp);
  const maxRaw = scaleInt(tpl.weaponBase.max, tierMul_bp, rarity_bp);
  const min = Math.max(1, minRaw);
  const max = Math.max(min + 1, maxRaw);

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
    // ⚠️ cuando agregues escudos, podés añadir `category: "shield"` al offhand
  } as WeaponData;
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
            combatStats: combat,
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
  try {
    // ordered:false → si hay slugs duplicados no aborta toda la operación
    const inserted = await Item.insertMany(rows, { ordered: false });
    return inserted as ItemDocument[];
  } catch (err: any) {
    // Si hay duplicados (E11000) igual retornamos lo que se haya insertado
    if (err?.writeErrors) {
      const ok: ItemDocument[] = [];
      for (const we of err.writeErrors) {
        if (we.err && we.err.op) {
          // no hay doc insertado en los errores; ignoramos
        }
      }
      // Re-leemos lo existente para devolver algo útil (opcional)
      const slugs = rows.map((r) => r.slug);
      const existing = await Item.find({ slug: { $in: slugs } }).lean<ItemDocument[]>();
      return existing as ItemDocument[];
    }
    throw err;
  }
}

// src/scripts/seedItems.ts
import { Item, type ItemDocument, type SlotKey } from "../models/Item";

// ───────────────────────────────────────────────────────────────────────────────
// Tipos y constantes base
// ───────────────────────────────────────────────────────────────────────────────

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

const RARITY_MUL: Record<Rarity, number> = {
  common: 1.0,
  uncommon: 1.2,
  rare: 1.5,
  epic: 2.0,
  legendary: 2.7,
} as const;

const TIERS = [
  { name: "Novato", from: 1, to: 5, baseMul: 1.0 },
  { name: "Veterano", from: 6, to: 10, baseMul: 1.5 },
  { name: "Maestro", from: 11, to: 15, baseMul: 2.2 },
] as const;

// Plantillas por slot
type Template = {
  type: "weapon" | "armor" | "accessory" | "potion" | "material";
  baseStats?: Record<string, number>;
  baseCombat?: Record<string, number>;
  baseResists?: Record<string, number>;
  icon: string;
  nameHint: string;
};

const SLOT_TEMPLATES: Record<SlotKey, Template> = {
  helmet: { type: "armor", baseStats: { wisdom: 0.5, vitality: 0.5, magicalDefense: 1, physicalDefense: 1 }, baseResists: { sleep: 1, paralysis: 1 }, icon: "/icons/helmet.png", nameHint: "Yelmo" },
  chest: { type: "armor", baseStats: { vitality: 1.5, physicalDefense: 2, magicalDefense: 1 }, baseResists: { stun: 1 }, icon: "/icons/chest.png", nameHint: "Peto" },
  gloves: { type: "armor", baseStats: { strength: 1, dexterity: 1 }, icon: "/icons/gloves.png", nameHint: "Guanteletes" },
  boots: { type: "armor", baseStats: { agility: 1 }, baseCombat: { evasion: 1, movementSpeed: 1 }, icon: "/icons/boots.png", nameHint: "Botas" },
  mainWeapon: { type: "weapon", baseStats: { strength: 1, dexterity: 1, intelligence: 1 }, baseCombat: { attackPower: 6, magicPower: 6 }, icon: "/icons/main_weapon.png", nameHint: "Arma" },
  offWeapon: { type: "accessory", baseStats: { physicalDefense: 1, magicalDefense: 1, wisdom: 0.5 }, icon: "/icons/off_weapon.png", nameHint: "Apoyo" },
  ring: { type: "accessory", baseStats: { luck: 1 }, baseCombat: { criticalChance: 1 }, icon: "/icons/ring.png", nameHint: "Sortija" },
  belt: { type: "accessory", baseStats: { endurance: 1 }, baseResists: { bleed: 1, poison: 1 }, icon: "/icons/belt.png", nameHint: "Cinturón" },
  amulet: { type: "accessory", baseStats: { wisdom: 1 }, baseCombat: { magicPower: 4 }, icon: "/icons/amulet.png", nameHint: "Amuleto" },
};

// Entrada para crear un ítem (coincide con tu schema)
export type SeedItemInput = {
  name: string;
  description?: string;

  type: "weapon" | "armor" | "accessory" | "potion" | "material";
  slot: SlotKey;
  rarity: Rarity;
  iconUrl: string;

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
// Extras genéricos (consumibles/materiales) – usan slot "belt" para cumplir schema
// ───────────────────────────────────────────────────────────────────────────────
const EXTRA_GENERIC: SeedItemInput[] = [
  { name: "Poción Pequeña de Vida", type: "potion", slot: "belt", rarity: "common", iconUrl: "/icons/pot_hp_s.png", levelRequirement: 1, isConsumable: true, effects: ["restore_hp_50"] },
  { name: "Poción Pequeña de Maná", type: "potion", slot: "belt", rarity: "common", iconUrl: "/icons/pot_mp_s.png", levelRequirement: 1, isConsumable: true, effects: ["restore_mp_30"] },
  { name: "Fragmento de Runa", type: "material", slot: "belt", rarity: "uncommon", iconUrl: "/icons/rune_frag.png", levelRequirement: 3 },
  { name: "Gema Brillante", type: "material", slot: "belt", rarity: "rare", iconUrl: "/icons/gem_bright.png", levelRequirement: 6 },
];

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────
function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function makeRow(p: SeedItemInput): SeedItemInput {
  return {
    name: p.name,
    description: p.description ?? "",
    type: p.type,
    slot: p.slot,
    rarity: p.rarity,
    iconUrl: p.iconUrl,
    stats: p.stats ?? {},
    combatStats: p.combatStats ?? {},
    levelRequirement: p.levelRequirement,
    sellPrice: p.sellPrice ?? Math.round(10 * RARITY_MUL[p.rarity] * (1 + p.levelRequirement / 10)),
    tradable: p.tradable ?? true,
    effects: p.effects ?? [],
    durability: p.durability ?? (p.type === "weapon" || p.type === "armor" ? 100 : 0),
    isUnique: p.isUnique ?? p.rarity === "legendary",
    isBound: p.isBound ?? false,
    isCraftable: p.isCraftable ?? false,
    isConsumable: p.isConsumable ?? false,
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
        const mul = RARITY_MUL[r] * t.baseMul;

        const stats: Record<string, number> = {};
        const combat: Record<string, number> = {};

        if (tpl.baseStats) for (const k of Object.keys(tpl.baseStats)) stats[k] = Math.round((tpl.baseStats[k] as number) * mul);
        if (tpl.baseCombat) for (const k of Object.keys(tpl.baseCombat)) combat[k] = Math.round((tpl.baseCombat[k] as number) * mul);
        if (tpl.baseResists) for (const k of Object.keys(tpl.baseResists)) stats[k] = (stats[k] ?? 0) + Math.round((tpl.baseResists[k] as number) * mul);

        const name = `${tpl.nameHint} ${t.name} (${capitalize(r)})`;

        items.push(
          makeRow({
            name,
            description: "",
            type: tpl.type,
            slot,
            rarity: r,
            iconUrl: tpl.icon,
            stats,
            combatStats: combat,
            levelRequirement: t.from,
          })
        );
      });
    });
  });

  // Extras
  items.push(...EXTRA_GENERIC.map(makeRow));

  return items;
}

/** Inserta los items seed y devuelve los documentos insertados tipados. */
export async function insertSeedItems(rows: SeedItemInput[] = buildSeedItems()): Promise<ItemDocument[]> {
  if (!rows.length) return [];
  const inserted = await Item.insertMany(rows, { ordered: true }); // si querés tolerar duplicados: { ordered: false }
  return inserted as ItemDocument[];
}

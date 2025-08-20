// src/interfaces/Item/Item.interface.ts
import type { BaseStats, CombatStats } from "../character/CharacterClass.interface";

// === Tipos base (alineados al modelo Mongoose) ===
export type SlotKey = "helmet" | "chest" | "gloves" | "boots" | "mainWeapon" | "offWeapon" | "ring" | "belt" | "amulet";

export type ItemType = "weapon" | "armor" | "accessory" | "potion" | "material";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

// Porcentajes como basis points (10000 = 100%). Sin floats.
export type BP = number;

// Stats válidos (sin agility ni wisdom)
export type StatKey = "strength" | "dexterity" | "intelligence" | "vitality" | "physicalDefense" | "magicalDefense" | "luck" | "endurance";

export type CombatKey =
  | "maxHP"
  | "attackPower"
  | "magicPower"
  | "criticalChance"
  | "criticalDamageBonus"
  | "attackSpeed"
  | "evasion"
  | "blockChance"
  | "blockValue"
  | "lifeSteal"
  | "damageReduction"
  | "movementSpeed";

// Modificador normalizado (enteros)
export interface Mod {
  scope: "stat" | "combat" | "special";
  key: StatKey | CombatKey | string; // "special" permite claves libres (ej: "poisonStacksMax")
  mode: "add" | "mul_bp"; // add = suma entera; mul_bp = multiplicador en BP (10000 = x1.0)
  value: number; // entero
  min?: number;
  max?: number;
}

// Datos por tipo de pieza (sin floats)
export interface WeaponData {
  slug: string; // ej: "basic_sword_1"
  type: "sword" | "dagger" | "bow" | "staff" | "axe" | "mace" | "spear" | "wand" | "crossbow";
  hands: 1 | 2;
  damage: { min: number; max: number }; // enteros
  speed: number; // rating entero (100 = base)
  critBonus_bp?: BP; // bonus crítico del arma (bp)
  range?: number; // 0 = melee, 1 = ranged simple (entero)
}

export interface OffHandData {
  type: "shield" | "quiver" | "focus" | "dagger" | "tome";
  blockChance_bp?: BP; // en bp
  blockValue?: number; // entero
  damage?: { min: number; max: number }; // para dual-wield con dagas
}

export interface ArmorData {
  armor: number; // rating entero
  blockChance_bp?: BP; // si es escudo (también cabe en OffHand)
  blockValue?: number;
}

export interface Affix {
  slug: string; // ej: "of_precision"
  tier: number; // 1..N
  mods: Mod[]; // mods que aplica el afijo
}

// === Interface canónica para usar en services/DTOs ===
export interface Item {
  // Identidad / metadatos
  id?: string; // útil en DTOs (virtual del modelo)
  slug: string; // único y estable
  name: string;
  description?: string;

  type: ItemType;
  slot: SlotKey;
  rarity: Rarity;

  iconUrl: string;

  // Subdocs por tipo (opcionales según el slot)
  weapon?: WeaponData;
  offHand?: OffHandData;
  armorData?: ArmorData;

  // Mods normalizados (enteros; % en bp). Preferir esto a stats/combatStats sueltos.
  mods?: Mod[];

  // Legacy / compatibilidad
  stats?: Partial<BaseStats>;
  combatStats?: Partial<CombatStats>;

  // Afijos y rolls (para drops/procedural)
  affixes?: Affix[];
  rollSeed?: number;
  rolled?: Record<string, number>; // ej: { "damage.min": 12 }

  // Reglas y estado
  levelRequirement?: number;
  sellPrice?: number;
  tradable?: boolean;
  durable?: boolean;
  durability?: number;

  classRestriction?: string[]; // ej: ["Guerrero","Asesino"]
  tags?: string[]; // "bleed", "poison", "fire", etc.

  isUnique?: boolean;
  isBound?: boolean;
  isCraftable?: boolean;
  isConsumable?: boolean;

  createdAt?: Date;
  modifiedAt?: Date;
}

// src/interfaces/Item/Item.interface.ts
import type { BaseStats, CombatStats } from "../character/CharacterClass.interface";

/**
 * ✅ NOTAS DE DISEÑO
 * - Mantenemos compat con tu shape anterior.
 * - Agregamos campos para: armas primarias por clase (+10% dmg), consumibles (pociones), y extensibilidad.
 * - Los % se expresan en basis points (bp) cuando son multiplicadores (10000 = 100% = x1.0).
 */

// === Tipos base (alineados al modelo Mongoose) ===
export type SlotKey = "helmet" | "chest" | "gloves" | "boots" | "mainWeapon" | "offWeapon" | "ring" | "belt" | "amulet";

export type ItemType = "weapon" | "armor" | "accessory" | "potion" | "material";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

// Porcentajes como basis points (10000 = 100%). Sin floats.
export type BP = number;

// Stats válidos (sin agility ni wisdom)
export type StatKey = "strength" | "dexterity" | "intelligence" | "constitution" | "physicalDefense" | "magicalDefense" | "luck" | "endurance";

export type CombatKey =
  | "maxHP"
  | "attackPower"
  | "magicPower"
  | "criticalChance"
  | "criticalDamageBonus"
  | "evasion"
  | "blockChance"
  | "blockValue"
  | "lifeSteal"
  | "damageReduction"
  | "movementSpeed";

/** Modificador normalizado (enteros) */
export interface Mod {
  scope: "stat" | "combat" | "special";
  key: StatKey | CombatKey | string; // "special" permite claves libres (ej: "poisonStacksMax")
  mode: "add" | "mul_bp"; // add = suma entera; mul_bp = multiplicador en BP (10000 = x1.0)
  value: number; // entero
  min?: number;
  max?: number;
}

/**
 * ⚔️ Datos por tipo de arma
 * - `type` (legacy) se mantiene para compatibilidad (sword/bow/etc).
 * - `kind` (nuevo) es libre y te deja usar nombres de tu seed: "Rapier", "Bone Staff", etc.
 * - `damageType` (physical/magical) opcional para engines que lo usen.
 * - `primaryForClasses`: lista de clases que consideran esta arma como primaria (para +10% dmg).
 */
export interface WeaponData {
  slug: string; // ej: "rapier_1"
  /** LEGACY: categorías clásicas; mantener si ya lo usás en filtros UI */
  type?: "sword" | "dagger" | "bow" | "staff" | "axe" | "mace" | "spear" | "wand" | "crossbow";

  /** NUEVO: descripción libre alineada al seed (ej: "Rapier", "Bone Staff") */
  kind?: string;

  hands: 1 | 2;
  damage: { min: number; max: number }; // enteros
  speed: number; // rating entero (100 = base)
  critBonus_bp?: BP; // bonus crítico del arma (bp)
  range?: number; // 0 = melee, 1 = ranged simple (entero)
  damageType?: "physical" | "magical";

  /** NUEVO: si la clase actual figura aquí, aplica el bonus de arma primaria (+10% daño) */
  primaryForClasses?: string[]; // ej: ["Vampire","Necromancer"]
}

/** Mano secundaria (escudos, tomos, aljabas, dagas dual-wield) */
export interface OffHandData {
  type: "shield" | "quiver" | "focus" | "dagger" | "tome";
  blockChance_bp?: BP; // en bp
  blockValue?: number; // entero
  damage?: { min: number; max: number }; // para dual-wield con dagas
}

/** Armaduras */
export interface ArmorData {
  armor: number; // rating entero
  blockChance_bp?: BP; // si es escudo (también cabe en OffHand)
  blockValue?: number;
}

/** Afijos (crafting/drops) */
export interface Affix {
  slug: string; // ej: "of_precision"
  tier: number; // 1..N
  mods: Mod[]; // mods que aplica el afijo
}

/**
 * 🧪 Efectos de consumible
 * - `restore_stamina`: recupera stamina (se clampa a staminaMax en el servicio).
 * - `restore_hp`: para futuro (mismo patrón).
 * - `apply_buff`: para buffs temporales (UI/runner).
 */
export type ConsumableEffectType = "restore_stamina" | "restore_hp" | "apply_buff";

export interface ConsumableEffect {
  type: ConsumableEffectType;
  /** Valor entero; semántica depende del tipo (p.ej. puntos de stamina/HP) */
  value?: number;
  /** Buff genérico: nombre/clave y duración en turnos, si aplica */
  buffKey?: string;
  durationTurns?: number;
  /** Metadata adicional para UI o runner */
  meta?: Record<string, any>;
}

/** Datos de consumible (pociones, etc.) */
export interface ConsumableData {
  charges?: number; // p.ej. 1 si se destruye al usar
  cooldownSeconds?: number; // CD entre usos (opcional)
  onUse: ConsumableEffect[]; // lista de efectos
}

/**
 * === Interface canónica para usar en services/DTOs ===
 */
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

  // Legacy / compatibilidad (si tu inventario aún usa estos campos)
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

  /**
   * Restricciones de clase:
   * - `classRestriction`: sólo estas clases pueden equiparlo.
   * - `weapon.primaryForClasses` (en el subdoc): define qué clases obtienen el bonus +10%.
   */
  classRestriction?: string[];

  tags?: string[]; // "bleed", "poison", "fire", etc.

  isUnique?: boolean;
  isBound?: boolean;
  isCraftable?: boolean;

  // Consumibles (pociones, etc.)
  isConsumable?: boolean;
  consumable?: ConsumableData;

  createdAt?: Date;
  modifiedAt?: Date;
}

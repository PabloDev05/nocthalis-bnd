import { BaseStats, CombatStats } from "./CharacterClass.interface";

export type ItemType = "weapon" | "armor" | "accessory" | "potion" | "material";

export type ItemSlot = "head" | "chest" | "legs" | "boots" | "gloves" | "weapon" | "offHand" | "ring" | "amulet";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface Item {
  name: string;
  description?: string;
  type: ItemType;
  slot: ItemSlot;
  rarity: ItemRarity;
  iconUrl: string;

  stats?: Partial<BaseStats>; // bonus a stats base
  combatStats?: Partial<CombatStats>; // bonus a stats de combate

  levelRequirement?: number;
  sellPrice?: number;
  tradable?: boolean;
  effects?: string[]; // para pasivas o efectos especiales
  durability?: number; // opcional, si el ítem tiene durabilidad
  isUnique?: boolean; // si es un ítem único o legendario
  isBound?: boolean; // si está ligado a un personaje
  isCraftable?: boolean; // si se puede crear a partir de materiales
  isConsumable?: boolean; // si es un ítem consumible como pociones
  createdAt?: Date; // fecha de creación del ítem
  modifiedAt?: Date; // fecha de última modificación del ítem
}

/*
Notas:

Use Partial<> para que no tenga que definir todos los stats, solo los que aplica ese ítem.
    El campo effects es ideal para cosas como "Burn", "Freeze", "Lifesteal".
    Si un ítem tiene efectos especiales, podemos listarlos ahí.
    El campo combatStats es opcional, así que si un ítem no tiene bonus de combate, no hace falta definirlo.
    El campo stats es para bonus a stats base como fuerza, agilidad, etc.
    Podés agregar más campos según necesites, como durabilidad, nivel de mejora, etc.
*/

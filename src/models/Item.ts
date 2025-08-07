import mongoose, { Document } from "mongoose";
import { Item as ItemInterface } from "./interfaces/Item.interface";

interface ItemDocument extends ItemInterface, Document {}

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ["weapon", "armor", "accessory", "potion", "material"], required: true },
  slot: {
    type: String,
    enum: ["head", "chest", "legs", "boots", "gloves", "weapon", "offHand", "ring", "amulet"],
    required: true,
  },
  rarity: {
    type: String,
    enum: ["common", "uncommon", "rare", "epic", "legendary"],
    required: true,
  },
  iconUrl: { type: String, required: true },

  stats: { type: Object, default: {} },
  combatStats: { type: Object, default: {} },

  levelRequirement: { type: Number, default: 1 },
  sellPrice: { type: Number, default: 0 },
  tradable: { type: Boolean, default: true },
  effects: [{ type: String }],
  durability: { type: Number, default: 100 }, // opcional, si el ítem tiene durabilidad
  isUnique: { type: Boolean, default: false }, // si es un ítem único o legendario
  isBound: { type: Boolean, default: false }, // si está ligado a un personaje
  isCraftable: { type: Boolean, default: false }, // si se puede crear a partir de materiales
  isConsumable: { type: Boolean, default: false }, // si es un ítem consumible como pociones
  createdAt: { type: Date, default: Date.now }, // fecha de creación del ítem
  modifiedAt: { type: Date, default: Date.now }, // fecha de última modificación del ítem
});

export const Item = mongoose.model<ItemDocument>("Item", ItemSchema);

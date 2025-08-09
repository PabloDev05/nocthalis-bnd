// src/models/Item.ts
import mongoose, { Document } from "mongoose";
import { Item as ItemInterface } from "../interfaces/Item/Item.interface";

export type SlotKey = "helmet" | "chest" | "gloves" | "boots" | "mainWeapon" | "offWeapon" | "ring" | "belt" | "amulet";

interface ItemDocument extends ItemInterface, Document {}

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },

  type: { type: String, enum: ["weapon", "armor", "accessory", "potion", "material"], required: true },

  slot: {
    type: String,
    enum: ["helmet", "chest", "gloves", "boots", "mainWeapon", "offWeapon", "ring", "belt", "amulet"],
    required: true,
  },

  rarity: { type: String, enum: ["common", "uncommon", "rare", "epic", "legendary"], required: true },
  iconUrl: { type: String, required: true },

  stats: { type: Object, default: {} },
  combatStats: { type: Object, default: {} },

  levelRequirement: { type: Number, default: 1 },
  sellPrice: { type: Number, default: 0 },
  tradable: { type: Boolean, default: true },
  effects: [{ type: String }],
  durability: { type: Number, default: 100 },
  isUnique: { type: Boolean, default: false },
  isBound: { type: Boolean, default: false },
  isCraftable: { type: Boolean, default: false },
  isConsumable: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  modifiedAt: { type: Date, default: Date.now },
});

// ⬇️ importante para hot-reload
export const Item = mongoose.models.Item || mongoose.model<ItemDocument>("Item", ItemSchema);

export type { ItemDocument };

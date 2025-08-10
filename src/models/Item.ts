import mongoose, { Document, Schema, Types } from "mongoose";
import { Item as ItemInterface } from "../interfaces/Item/Item.interface";

// Claves de slot que usa tu schema actual
export type SlotKey = "helmet" | "chest" | "gloves" | "boots" | "mainWeapon" | "offWeapon" | "ring" | "belt" | "amulet";

// Documento hidratado con virtual 'id'
export interface ItemDocument extends ItemInterface, Document<Types.ObjectId> {
  id: string;
}

const ItemSchema = new Schema<ItemDocument>(
  {
    name: { type: String, required: true },
    description: { type: String },

    type: {
      type: String,
      enum: ["weapon", "armor", "accessory", "potion", "material"],
      required: true,
    },

    slot: {
      type: String,
      enum: ["helmet", "chest", "gloves", "boots", "mainWeapon", "offWeapon", "ring", "belt", "amulet"],
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
    durability: { type: Number, default: 100 },
    isUnique: { type: Boolean, default: false },
    isBound: { type: Boolean, default: false },
    isCraftable: { type: Boolean, default: false },
    isConsumable: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        Reflect.deleteProperty(ret as any, "_id");
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id?.toString();
        Reflect.deleteProperty(ret as any, "_id");
        return ret;
      },
    },
  }
);

// Virtual para docs hidratados
ItemSchema.virtual("id").get(function (this: { _id: Types.ObjectId }) {
  return this._id.toString();
});

export const Item = (mongoose.models.Item as mongoose.Model<ItemDocument>) || mongoose.model<ItemDocument>("Item", ItemSchema);

// Tipo para resultados con .lean() (sin _id)
export type ItemLean = Omit<ItemInterface, "_id"> & { id: string; _id?: never };

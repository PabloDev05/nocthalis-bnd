// src/models/Item.ts
import mongoose, { Document, Schema, Types } from "mongoose";
import type { Item as ItemInterface, Mod, WeaponData, OffHandData, ArmorData, Affix } from "../interfaces/Item/Item.interface";

// Documento hidratado
export interface ItemDocument extends ItemInterface, Document<Types.ObjectId> {
  id: string; // virtual
}

// 👇 Lean tipado (lo vas a usar en controllers con .lean({ virtuals:true }))
export type ItemLean = mongoose.InferSchemaType<typeof ItemSchema> & {
  _id: Types.ObjectId; // viene en lean()
  id?: string; // virtual agregado por toJSON/toObject si lo pedís
};

// ----- Sub-esquemas -----
const ModSchema = new Schema<Mod>(
  {
    scope: { type: String, enum: ["stat", "combat", "special"], required: true },
    key: { type: String, required: true },
    mode: { type: String, enum: ["add", "mul_bp"], required: true },
    value: { type: Number, required: true },
    min: { type: Number },
    max: { type: Number },
  },
  { _id: false }
);

const WeaponSchema = new Schema<WeaponData>(
  {
    slug: { type: String, required: true },
    type: { type: String, enum: ["sword", "dagger", "bow", "staff", "axe", "mace", "spear", "wand", "crossbow"], required: true },
    hands: { type: Number, enum: [1, 2], default: 1 },
    damage: { min: { type: Number, required: true }, max: { type: Number, required: true } },
    speed: { type: Number, default: 100 },
    critBonus_bp: { type: Number, default: 0, min: 0, max: 10000 },
    range: { type: Number, default: 0 },
  },
  { _id: false }
);

const OffHandSchema = new Schema<OffHandData>(
  {
    type: { type: String, enum: ["shield", "quiver", "focus", "dagger", "tome"], required: true },
    blockChance_bp: { type: Number, min: 0, max: 10000 },
    blockValue: { type: Number },
    damage: { min: { type: Number }, max: { type: Number } },
  },
  { _id: false }
);

const ArmorDataSchema = new Schema<ArmorData>(
  {
    armor: { type: Number, required: true },
    blockChance_bp: { type: Number, min: 0, max: 10000 },
    blockValue: { type: Number },
  },
  { _id: false }
);

const AffixSchema = new Schema<Affix>(
  {
    slug: { type: String, required: true },
    tier: { type: Number, required: true },
    mods: { type: [ModSchema], default: [] },
  },
  { _id: false }
);

// ---------------- Esquema principal ----------------
const ItemSchema = new Schema<ItemDocument>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },

    type: { type: String, enum: ["weapon", "armor", "accessory", "potion", "material"], required: true },
    slot: { type: String, enum: ["helmet", "chest", "gloves", "boots", "mainWeapon", "offWeapon", "ring", "belt", "amulet"], required: true },
    rarity: { type: String, enum: ["common", "uncommon", "rare", "epic", "legendary"], required: true },

    iconUrl: { type: String, required: true },

    weapon: { type: WeaponSchema, required: false },
    offHand: { type: OffHandSchema, required: false },
    armorData: { type: ArmorDataSchema, required: false },

    mods: { type: [ModSchema], default: [] },

    // Legacy / compat
    stats: { type: Schema.Types.Mixed, default: {} },
    combatStats: { type: Schema.Types.Mixed, default: {} },

    affixes: { type: [AffixSchema], default: [] },
    rollSeed: { type: Number },
    rolled: { type: Schema.Types.Mixed },

    levelRequirement: { type: Number, default: 1 },
    sellPrice: { type: Number, default: 0 },
    tradable: { type: Boolean, default: true },
    durable: { type: Boolean, default: false },
    durability: { type: Number, default: 100 },

    classRestriction: { type: [String], default: [] },
    tags: { type: [String], default: [] },

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

// Virtual id
ItemSchema.virtual("id").get(function (this: { _id: Types.ObjectId }) {
  return this._id.toString();
});

// Mantener modifiedAt actualizado
ItemSchema.pre("save", function (next) {
  (this as any).modifiedAt = new Date();
  next();
});

// Índices útiles
ItemSchema.index({ type: 1, rarity: 1, levelRequirement: 1 });

export const Item = (mongoose.models.Item as mongoose.Model<ItemDocument>) || mongoose.model<ItemDocument>("Item", ItemSchema);

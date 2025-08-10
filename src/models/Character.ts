import mongoose, { Document, Schema, Types } from "mongoose";
import { Character as CharacterInterface } from "../interfaces/character/Character.interface";

/** Claves reales del schema de equipo */
export type EquipmentSlot = "helmet" | "chest" | "gloves" | "boots" | "mainWeapon" | "offWeapon" | "ring" | "belt" | "amulet";

/** Objeto de equipo fuertemente tipado */
export type Equipment = Record<EquipmentSlot, string | null>;

export interface CharacterDocument extends Omit<CharacterInterface, "userId" | "classId" | "equipment">, Document<Types.ObjectId> {
  userId: Types.ObjectId;
  classId: Types.ObjectId;
  subclassId?: Types.ObjectId | null;
  inventory: string[];
  equipment: Equipment; // <- forzamos el tipo correcto
  id: string;
}

const StatsSchema = new Schema(
  {
    strength: { type: Number, default: 0 },
    dexterity: { type: Number, default: 0 },
    intelligence: { type: Number, default: 0 },
    vitality: { type: Number, default: 0 },
    physicalDefense: { type: Number, default: 0 },
    magicalDefense: { type: Number, default: 0 },
    luck: { type: Number, default: 0 },
    agility: { type: Number, default: 0 },
    endurance: { type: Number, default: 0 },
    wisdom: { type: Number, default: 0 },
  },
  { _id: false }
);

const ResistancesSchema = new Schema(
  {
    fire: { type: Number, default: 0 },
    ice: { type: Number, default: 0 },
    lightning: { type: Number, default: 0 },
    poison: { type: Number, default: 0 },
    sleep: { type: Number, default: 0 },
    paralysis: { type: Number, default: 0 },
    confusion: { type: Number, default: 0 },
    fear: { type: Number, default: 0 },
    dark: { type: Number, default: 0 },
    holy: { type: Number, default: 0 },
    stun: { type: Number, default: 0 },
    bleed: { type: Number, default: 0 },
    curse: { type: Number, default: 0 },
    knockback: { type: Number, default: 0 },
    criticalChanceReduction: { type: Number, default: 0 },
    criticalDamageReduction: { type: Number, default: 0 },
  },
  { _id: false }
);

const CombatStatsSchema = new Schema(
  {
    maxHP: { type: Number, default: 0 },
    maxMP: { type: Number, default: 0 },
    attackPower: { type: Number, default: 0 },
    magicPower: { type: Number, default: 0 },
    criticalChance: { type: Number, default: 0 },
    criticalDamageBonus: { type: Number, default: 0 },
    attackSpeed: { type: Number, default: 0 },
    evasion: { type: Number, default: 0 },
    blockChance: { type: Number, default: 0 },
    blockValue: { type: Number, default: 0 },
    lifeSteal: { type: Number, default: 0 },
    manaSteal: { type: Number, default: 0 },
    damageReduction: { type: Number, default: 0 },
    movementSpeed: { type: Number, default: 0 },
  },
  { _id: false }
);

const EquipmentSchema = new Schema(
  {
    helmet: { type: String, default: null },
    chest: { type: String, default: null },
    gloves: { type: String, default: null },
    boots: { type: String, default: null },
    mainWeapon: { type: String, default: null },
    offWeapon: { type: String, default: null },
    ring: { type: String, default: null },
    belt: { type: String, default: null },
    amulet: { type: String, default: null },
  },
  { _id: false }
);

const CharacterSchema = new Schema<CharacterDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      unique: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: "CharacterClass",
      required: true,
      index: true,
    },
    subclassId: { type: Schema.Types.ObjectId, default: null, index: true },

    level: { type: Number, default: 1, min: 1 },
    experience: { type: Number, default: 0, min: 0 },

    stats: { type: StatsSchema, default: () => ({}) },
    resistances: { type: ResistancesSchema, default: () => ({}) },
    combatStats: { type: CombatStatsSchema, default: () => ({}) },

    passivesUnlocked: { type: [String], default: [] },
    inventory: { type: [String], default: [] },

    equipment: { type: EquipmentSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
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

CharacterSchema.pre("save", function (next) {
  if (!this.combatStats) this.combatStats = {} as any;
  if (!this.stats) this.stats = {} as any;
  if (!this.resistances) this.resistances = {} as any;
  if (!this.equipment) this.equipment = {} as any;
  if (!this.inventory) this.inventory = [];
  next();
});

CharacterSchema.virtual("id").get(function (this: { _id: Types.ObjectId }) {
  return this._id.toString();
});

export const Character = (mongoose.models.Character as mongoose.Model<CharacterDocument>) || mongoose.model<CharacterDocument>("Character", CharacterSchema);

export type { CharacterDocument as TCharacterDoc };

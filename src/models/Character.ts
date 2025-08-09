import mongoose, { Document, Schema, Types } from "mongoose";
import { Character as CharacterInterface } from "../interfaces/character/Character.interface";

export interface CharacterDocument extends Omit<CharacterInterface, "userId" | "classId">, Document {
  userId: Types.ObjectId;
  classId: Types.ObjectId;
  subclassId?: Types.ObjectId | null;
}

const CharacterSchema = new Schema<CharacterDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true },
    classId: { type: Schema.Types.ObjectId, ref: "CharacterClass", required: true },
    subclassId: { type: Schema.Types.ObjectId, default: null },

    level: { type: Number, default: 1, min: 1 },
    experience: { type: Number, default: 0, min: 0 },

    stats: { type: Map, of: Number, default: {} },
    resistances: { type: Map, of: Number, default: {} },
    combatStats: { type: Map, of: Number, default: {} },

    passivesUnlocked: [{ type: String, default: [] }],
    inventory: [{ type: String, default: [] }],

    equipment: {
      head: { type: String, default: null },
      chest: { type: String, default: null },
      legs: { type: String, default: null },
      boots: { type: String, default: null },
      gloves: { type: String, default: null },
      weapon: { type: String, default: null },
      offHand: { type: String, default: null },
      ring1: { type: String, default: null },
      ring2: { type: String, default: null },
      amulet: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

export const Character = mongoose.model<CharacterDocument>("Character", CharacterSchema);
export type { CharacterDocument as TCharacterDoc };

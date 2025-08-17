// src/models/CombatResult.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface CombatSnapshotDoc {
  round: number;
  actor: "player" | "enemy";
  damage: number;
  playerHP: number;
  enemyHP: number;
  events: string[];
  status?: {
    player: { key: string; stacks: number; turnsLeft: number }[];
    enemy: { key: string; stacks: number; turnsLeft: number }[];
  };
}

export interface CombatResultDocument extends Document<Types.ObjectId> {
  userId?: Types.ObjectId | null;
  characterId?: Types.ObjectId | null; // en PvP puede ser null si no querés guardar
  enemyId?: Types.ObjectId | null;

  mode: "preview" | "resolve" | "pvp-preview" | "pvp-resolve";
  winner: "player" | "enemy" | "draw";
  turns: number;
  seed?: number | null;
  log: string[];
  snapshots: CombatSnapshotDoc[];
  rewards?: {
    xpGained?: number;
    goldGained?: number;
    honorDelta?: number;
    levelUps?: number[];
    drops?: string[];
  } | null;

  createdAt: Date;
}

const StatusEntrySchema = new Schema({ key: String, stacks: Number, turnsLeft: Number }, { _id: false });

const SnapshotSchema = new Schema<CombatSnapshotDoc>(
  {
    round: { type: Number, required: true },
    actor: { type: String, enum: ["player", "enemy"], required: true },
    damage: { type: Number, required: true },
    playerHP: { type: Number, required: true },
    enemyHP: { type: Number, required: true },
    events: { type: [String], default: [] },
    status: {
      player: { type: [StatusEntrySchema], default: undefined },
      enemy: { type: [StatusEntrySchema], default: undefined },
    },
  },
  { _id: false }
);

const CombatResultSchema = new Schema<CombatResultDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    characterId: { type: Schema.Types.ObjectId, ref: "Character", default: null, index: true },
    enemyId: { type: Schema.Types.ObjectId, ref: "Enemy", default: null, index: true },

    mode: { type: String, enum: ["preview", "resolve", "pvp-preview", "pvp-resolve"], required: true },
    winner: { type: String, enum: ["player", "enemy", "draw"], required: true },
    turns: { type: Number, required: true },
    seed: { type: Number, default: null },

    log: { type: [String], default: [] },
    snapshots: { type: [SnapshotSchema], default: [] },

    rewards: {
      xpGained: Number,
      goldGained: Number,
      honorDelta: Number,
      levelUps: { type: [Number], default: [] },
      drops: { type: [String], default: [] },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

CombatResultSchema.index({ userId: 1, createdAt: -1 });
CombatResultSchema.index({ characterId: 1, createdAt: -1 });
CombatResultSchema.index({ mode: 1, winner: 1 });

CombatResultSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    Reflect.deleteProperty(ret as any, "_id");
    return ret;
  },
});

export const CombatResult = (mongoose.models.CombatResult as mongoose.Model<CombatResultDocument>) || mongoose.model<CombatResultDocument>("CombatResult", CombatResultSchema);

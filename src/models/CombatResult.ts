// src/models/CombatResult.ts
import mongoose, { Schema, Document, Types } from "mongoose";

/** Helper: entero no-negativo (0..∞) */
const IntNonNeg = {
  type: Number,
  min: 0,
  default: 0,
  set: (v: any) => Math.max(0, Math.trunc(Number(v) || 0)),
};

/** Helper: entero cualquiera (…,-2,-1,0,1,2,…) */
const IntAny = {
  type: Number,
  default: 0,
  set: (v: any) => Math.trunc(Number(v) || 0),
};

export interface CombatSnapshotDoc {
  round: number; // >= 1
  actor: "player" | "enemy";
  damage: number; // >= 0
  playerHP: number;
  enemyHP: number;
  events: string[]; // tags libres para UI/VFX/analytics
  status?: {
    player: { key: string; stacks: number; turnsLeft: number }[];
    enemy: { key: string; stacks: number; turnsLeft: number }[];
  };
}

export interface CombatResultDocument extends Document<Types.ObjectId> {
  userId?: Types.ObjectId | null;
  characterId?: Types.ObjectId | null;
  enemyId?: Types.ObjectId | null;

  matchId?: Types.ObjectId | null;

  mode: "preview" | "resolve" | "pvp-preview" | "pvp-resolve";
  winner: "player" | "enemy" | "draw";
  turns: number; // >= 0
  seed?: number | null;

  log: string[];
  snapshots: CombatSnapshotDoc[];
  rewards?: {
    xpGained?: number;
    goldGained?: number;
    honorDelta?: number; // puede ser negativo en PvP
    levelUps?: number[];
    drops?: string[];
  } | null;

  createdAt: Date;
}

/* ───────── Sub-schemas ───────── */
const StatusEntrySchema = new Schema(
  {
    key: { type: String, required: true },
    stacks: { ...IntNonNeg, required: true },
    turnsLeft: { ...IntNonNeg, required: true },
  },
  { _id: false }
);

// Bloque status como subdocumento para tipado estricto
const StatusBlockSchema = new Schema(
  {
    player: { type: [StatusEntrySchema], default: undefined },
    enemy: { type: [StatusEntrySchema], default: undefined },
  },
  { _id: false }
);

const SnapshotSchema = new Schema<CombatSnapshotDoc>(
  {
    round: { ...IntNonNeg, min: 1, required: true }, // >= 1
    actor: { type: String, enum: ["player", "enemy"], required: true },
    damage: { ...IntNonNeg, required: true },
    playerHP: { ...IntNonNeg, required: true },
    enemyHP: { ...IntNonNeg, required: true },
    events: { type: [String], default: [] },
    status: { type: StatusBlockSchema, default: undefined },
  },
  { _id: false }
);

const CombatResultSchema = new Schema<CombatResultDocument>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: "User",      default: null, index: true },
    characterId: { type: Schema.Types.ObjectId, ref: "Character", default: null, index: true },
    enemyId:     { type: Schema.Types.ObjectId, ref: "Enemy",     default: null, index: true },

    matchId: { type: Schema.Types.ObjectId, ref: "Match", default: null, index: true },

    mode:   { type: String, enum: ["preview", "resolve", "pvp-preview", "pvp-resolve"], required: true, index: true },
    winner: { type: String, enum: ["player", "enemy", "draw"], required: true, index: true },
    turns:  { ...IntNonNeg, required: true },

    seed: {
      type: Number,
      default: null,
      set: (v: any) => (v == null ? null : Math.max(0, Math.trunc(Number(v) || 0))),
    },

    log: { type: [String], default: [] },
    snapshots: { type: [SnapshotSchema], default: [] },

    rewards: {
      xpGained:  IntNonNeg,
      goldGained:IntNonNeg,
      honorDelta:IntAny, // puede ser negativo
      levelUps: {
        type: [Number],
        default: [],
        set: (arr: any) =>
          Array.isArray(arr)
            ? arr
                .map((v) => Math.trunc(Number(v) || 0))
                .filter((n) => Number.isFinite(n))
            : [],
      },
      drops: { type: [String], default: [] },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

/* ───────── Índices útiles ───────── */
CombatResultSchema.index({ userId: 1, createdAt: -1 });
CombatResultSchema.index({ characterId: 1, createdAt: -1 });
CombatResultSchema.index({ mode: 1, winner: 1 });
CombatResultSchema.index({ matchId: 1, createdAt: -1 });

CombatResultSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    (ret as any).id = String(ret._id);
    delete (ret as any)._id;
    return ret;
  },
});

export const CombatResult =
  (mongoose.models.CombatResult as mongoose.Model<CombatResultDocument>) ||
  mongoose.model<CombatResultDocument>("CombatResult", CombatResultSchema);

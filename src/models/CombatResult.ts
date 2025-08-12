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
  characterId: Types.ObjectId;
  enemyId: Types.ObjectId;
  mode: "preview" | "resolve";
  winner: "player" | "enemy";
  turns: number;
  seed?: number | null;
  log: string[];
  snapshots: CombatSnapshotDoc[];
  rewards?: {
    xpGained: number;
    goldGained: number;
    levelUps: number[];
    drops: string[]; // ids string
  } | null;
  createdAt: Date;
}

// Sub-schema para entradas de estado (sin _id)
const StatusEntrySchema = new Schema(
  {
    key: { type: String, required: true },
    stacks: { type: Number, required: true },
    turnsLeft: { type: Number, required: true },
  },
  { _id: false }
);

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
    characterId: { type: Schema.Types.ObjectId, ref: "Character", required: true, index: true },
    enemyId: { type: Schema.Types.ObjectId, ref: "Enemy", required: true, index: true },
    mode: { type: String, enum: ["preview", "resolve"], required: true },
    winner: { type: String, enum: ["player", "enemy"], required: true },
    turns: { type: Number, required: true },
    seed: { type: Number, default: null },
    log: { type: [String], default: [] },
    snapshots: { type: [SnapshotSchema], default: [] },
    rewards: {
      xpGained: Number,
      goldGained: Number,
      levelUps: { type: [Number], default: [] },
      drops: { type: [String], default: [] },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Índices útiles
CombatResultSchema.index({ userId: 1, createdAt: -1 });
CombatResultSchema.index({ characterId: 1, createdAt: -1 });
CombatResultSchema.index({ enemyId: 1, createdAt: -1 });
CombatResultSchema.index({ mode: 1, winner: 1 });

// JSON prolijo (id string)
CombatResultSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    Reflect.deleteProperty(ret as any, "_id");
    return ret;
  },
});

// Hot-reload guard (evita OverwriteModelError en dev)
export const CombatResult = (mongoose.models.CombatResult as mongoose.Model<CombatResultDocument>) || mongoose.model<CombatResultDocument>("CombatResult", CombatResultSchema);

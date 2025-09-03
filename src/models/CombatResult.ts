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
  round: number; // entero >= 1
  actor: "player" | "enemy"; // quién golpeó
  damage: number; // entero >= 0
  playerHP: number; // HP restante del atacante (POV player) tras el evento
  enemyHP: number; // HP restante del defensor tras el evento
  events: string[]; // tags: "player:hit", "enemy:weapon:basic_bow", "player:passive:Bleed", "enemy:ultimate:ShadowNova", etc.
  status?: {
    player: { key: string; stacks: number; turnsLeft: number }[];
    enemy: { key: string; stacks: number; turnsLeft: number }[];
  };
}

export interface CombatResultDocument extends Document<Types.ObjectId> {
  userId?: Types.ObjectId | null; // dueño del registro (PvE / preview)
  characterId?: Types.ObjectId | null; // personaje involucrado (opcional en PvP)
  enemyId?: Types.ObjectId | null; // PvE

  /** Link opcional a Match cuando es PvP (útil para trazabilidad) */
  matchId?: Types.ObjectId | null;

  /** preview/resolve + variantes PvP */
  mode: "preview" | "resolve" | "pvp-preview" | "pvp-resolve";
  winner: "player" | "enemy" | "draw";
  turns: number; // entero >= 0
  seed?: number | null; // si hubo corrida determinística
  log: string[]; // mensajes humanos (opcional)
  snapshots: CombatSnapshotDoc[]; // timeline compacta
  rewards?: {
    xpGained?: number; // enteros
    goldGained?: number;
    honorDelta?: number; // puede ser negativo en PvP
    levelUps?: number[]; // niveles alcanzados (enteros)
    drops?: string[]; // ids de drop
  } | null;

  createdAt: Date;
}

const StatusEntrySchema = new Schema(
  {
    key: { type: String, required: true },
    stacks: { ...IntNonNeg, required: true },
    turnsLeft: { ...IntNonNeg, required: true },
  },
  { _id: false }
);

const SnapshotSchema = new Schema<CombatSnapshotDoc>(
  {
    // override min a 1 para cumplir contrato “>= 1”
    round: { ...IntNonNeg, min: 1, required: true },
    actor: { type: String, enum: ["player", "enemy"], required: true },
    damage: { ...IntNonNeg, required: true },
    playerHP: { ...IntNonNeg, required: true },
    enemyHP: { ...IntNonNeg, required: true },
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
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    characterId: { type: Schema.Types.ObjectId, ref: "Character", default: null, index: true },
    enemyId: { type: Schema.Types.ObjectId, ref: "Enemy", default: null, index: true },

    matchId: { type: Schema.Types.ObjectId, ref: "Match", default: null, index: true },

    mode: { type: String, enum: ["preview", "resolve", "pvp-preview", "pvp-resolve"], required: true, index: true },
    winner: { type: String, enum: ["player", "enemy", "draw"], required: true, index: true },
    turns: { ...IntNonNeg, required: true },
    seed: {
      type: Number,
      default: null,
      set: (v: any) => (v == null ? null : Math.max(0, Math.trunc(Number(v) || 0))),
    },

    log: { type: [String], default: [] },
    snapshots: { type: [SnapshotSchema], default: [] },

    rewards: {
      xpGained: IntNonNeg,
      goldGained: IntNonNeg,
      honorDelta: IntAny, // puede ser negativo
      levelUps: {
        type: [Number],
        default: [],
        // fuerza enteros por si llegan como strings/floats
        set: (arr: any) => (Array.isArray(arr) ? arr.map((v) => Math.trunc(Number(v) || 0)).filter((n) => Number.isFinite(n)) : []),
      },
      drops: { type: [String], default: [] },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

// Índices útiles
CombatResultSchema.index({ userId: 1, createdAt: -1 });
CombatResultSchema.index({ characterId: 1, createdAt: -1 });
CombatResultSchema.index({ mode: 1, winner: 1 });
// Enlazado PvP
CombatResultSchema.index({ matchId: 1, createdAt: -1 });

CombatResultSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = String(ret._id);
    Reflect.deleteProperty(ret as any, "_id");
    return ret;
  },
});

export const CombatResult = (mongoose.models.CombatResult as mongoose.Model<CombatResultDocument>) || mongoose.model<CombatResultDocument>("CombatResult", CombatResultSchema);

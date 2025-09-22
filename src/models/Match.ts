// src/models/Match.ts
import { Schema, model, Types, Document, Model } from "mongoose";

/* ───────── tipos base ───────── */
export type MatchStatus = "pending" | "simulated" | "resolved";
export type MatchOutcome = "attacker" | "defender" | "draw";
export type MatchWinner = "player" | "enemy" | "draw";
export type MatchMode = "pvp" | "pve";
export type AbilityKind = "passive" | "ultimate";

/* timeline del runner (POV atacante) */
export interface TimelineEntry {
  turn: number;
  source: "attacker" | "defender";
  event:
    | "hit"
    | "crit"
    | "block"
    | "miss"
    | "passive_proc"
    | "ultimate_cast"
    | "dot_tick"; // ← añadido para DoT ticks
  damage: number;
  attackerHP: number;
  defenderHP: number;
  ability?: {
    kind: AbilityKind;
    name?: string;
    id?: string;
    durationTurns?: number;
  };
  tags?: string[];
}

/* snapshot arma */
export interface WeaponSpec {
  slug: string;
  min: number;
  max: number;
  type?: string;
}

/** Metadata de clase persistible */
export interface ClassMeta {
  primaryWeapons?: string[];
  passiveDefaultSkill?: any;
  ultimateSkill?: any;
}

export interface CharacterSnapshot {
  characterId: Types.ObjectId;
  userId: Types.ObjectId;
  username: string;
  level: number;
  className: string;
  weapon: string | WeaponSpec;
  offHand?: string | WeaponSpec;
  classMeta?: ClassMeta;
  stats: Record<string, number>; // flexible (incluye constitution, etc.)
  combat: {
    maxHP: number;
    attackPower: number;
    magicPower: number;
    evasion: number;              // 0..100
    blockChance: number;          // 0..100
    damageReduction: number;      // 0..100
    criticalChance: number;       // 0..100
    criticalDamageBonus: number;  // 0..100
    attackSpeed: number;          // >= 1
  };
  currentHP: number;
}

export interface Rewards {
  honor: number;
  xp: number;
  gold: number;
}

export interface CombatSnapshot {
  round: number;
  actor: "player" | "enemy";
  damage: number;
  playerHP: number;
  enemyHP: number;
  events: string[];
  status?: Record<string, any>;
}

/* ───────── helpers ───────── */
const i = (v: any) => (Number.isFinite(Number(v)) ? Math.floor(Number(v)) : v);

/* ───────── subesquemas ───────── */
const WeaponSpecSchema = new Schema<WeaponSpec>(
  {
    slug: { type: String, required: true },
    min: { type: Number, required: true, set: i },
    max: { type: Number, required: true, set: i },
    type: { type: String },
  },
  { _id: false }
);
WeaponSpecSchema.path("max").validate(function (this: any, v: number) {
  return typeof v === "number" && typeof this.min === "number" ? v >= this.min : true;
}, "WeaponSpec.max must be >= min");

const SnapshotSchema = new Schema<CharacterSnapshot>(
  {
    characterId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    username: { type: String, required: true },
    level: { type: Number, required: true, set: i },
    className: { type: String, required: true },
    weapon: { type: Schema.Types.Mixed, required: true },
    offHand: { type: Schema.Types.Mixed },
    classMeta: { type: Schema.Types.Mixed },
    stats: { type: Schema.Types.Mixed, default: {} },

    combat: {
      maxHP: { type: Number, required: true, set: i, min: 1 },
      attackPower: { type: Number, required: true, set: i, min: 0 },
      magicPower: { type: Number, required: true, set: i, min: 0 },

      evasion: { type: Number, required: true, set: i, min: 0, max: 100 },
      blockChance: { type: Number, required: true, set: i, min: 0, max: 100 },
      damageReduction: { type: Number, required: true, set: i, min: 0, max: 100 },
      criticalChance: { type: Number, required: true, set: i, min: 0, max: 100 },
      criticalDamageBonus: { type: Number, required: true, set: i, min: 0, max: 100 },

      attackSpeed: { type: Number, required: true, set: i, min: 1 },
    },

    currentHP: { type: Number, required: true, min: 0, set: i },
  },
  { _id: false }
);

const TimelineSchema = new Schema<TimelineEntry>(
  {
    turn: { type: Number, required: true, set: i, min: 1 },
    source: { type: String, enum: ["attacker", "defender"], required: true },
    event: {
      type: String,
      enum: ["hit", "crit", "block", "miss", "passive_proc", "ultimate_cast", "dot_tick"], // ← añadido
      required: true,
    },
    damage: { type: Number, required: true, min: 0, set: i },
    attackerHP: { type: Number, required: true, min: 0, set: i },
    defenderHP: { type: Number, required: true, min: 0, set: i },
    ability: {
      kind: { type: String, enum: ["passive", "ultimate"] },
      name: { type: String },
      id: { type: String },
      durationTurns: { type: Number, set: i },
    },
    tags: { type: [String], default: [] },
  },
  { _id: false }
);

const CombatSnapshotSchema = new Schema<CombatSnapshot>(
  {
    round: { type: Number, required: true, set: i, min: 1 },
    actor: { type: String, enum: ["player", "enemy"], required: true },
    damage: { type: Number, required: true, min: 0, set: i },
    playerHP: { type: Number, required: true, min: 0, set: i },
    enemyHP: { type: Number, required: true, min: 0, set: i },
    events: { type: [String], default: [] },
    status: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

/* ───────── Match ───────── */
export interface MatchDoc extends Document {
  _id: Types.ObjectId;

  attackerUserId: Types.ObjectId;
  defenderUserId: Types.ObjectId;
  attackerCharacterId: Types.ObjectId;
  defenderCharacterId: Types.ObjectId;

  mode: MatchMode;

  attackerSnapshot: CharacterSnapshot;
  defenderSnapshot: CharacterSnapshot;

  seed: number;
  status: MatchStatus;

  outcome?: MatchOutcome;
  winner?: MatchWinner;

  turns?: number;
  timeline?: TimelineEntry[];
  log?: string[];
  snapshots?: CombatSnapshot[];

  rewards?: Rewards;

  runnerVersion?: number;

  /** idempotencia de creación de match desde el cliente */
  clientKey?: string | null;

  /** virtual */
  id?: string;
}

const MatchSchema = new Schema<MatchDoc>(
  {
    attackerUserId: { type: Schema.Types.ObjectId, required: true },
    defenderUserId: { type: Schema.Types.ObjectId, required: true },
    attackerCharacterId: { type: Schema.Types.ObjectId, required: true },
    defenderCharacterId: { type: Schema.Types.ObjectId, required: true },

    mode: { type: String, enum: ["pvp", "pve"], default: "pvp" },

    attackerSnapshot: { type: SnapshotSchema, required: true },
    defenderSnapshot: { type: SnapshotSchema, required: true },

    seed: { type: Number, required: true, set: i },

    status: {
      type: String,
      enum: ["pending", "simulated", "resolved"],
      default: "pending",
    },

    outcome: { type: String, enum: ["attacker", "defender", "draw"] },
    winner: { type: String, enum: ["player", "enemy", "draw"] },

    turns: { type: Number, set: i, min: 0 },
    timeline: { type: [TimelineSchema], default: [] },
    log: { type: [String], default: [] },
    snapshots: { type: [CombatSnapshotSchema], default: [] },

    rewards: {
      honor: { type: Number, default: 0, set: i },
      xp: { type: Number, default: 0, set: i },
      gold: { type: Number, default: 0, set: i },
    },

    runnerVersion: { type: Number, default: 2, set: i },

    /** idempotencia */
    clientKey: { type: String, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        (ret as any).id = String(ret._id);
        delete (ret as any)._id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret) => {
        (ret as any).id = String(ret._id);
        delete (ret as any)._id;
        return ret;
      },
    },
  }
);

/* virtual id */
MatchSchema.virtual("id").get(function (this: { _id: Types.ObjectId }) {
  return this._id.toString();
});

/* ───────── Índices ───────── */
MatchSchema.index({ attackerUserId: 1 });
MatchSchema.index({ defenderUserId: 1 });
MatchSchema.index({ attackerCharacterId: 1 });
MatchSchema.index({ defenderCharacterId: 1 });
MatchSchema.index({ mode: 1 });
MatchSchema.index({ status: 1 });

MatchSchema.index({ status: 1, createdAt: -1 });
MatchSchema.index({ attackerUserId: 1, createdAt: -1 });
MatchSchema.index({ defenderUserId: 1, createdAt: -1 });
MatchSchema.index({ mode: 1, createdAt: -1 });
MatchSchema.index({ seed: 1 });

/** Unicidad “suave” por atacante+clientKey para idempotencia */
MatchSchema.index(
  { attackerUserId: 1, clientKey: 1 },
  { unique: true, partialFilterExpression: { clientKey: { $type: "string" } } }
);

export const Match: Model<MatchDoc> = model<MatchDoc>("Match", MatchSchema);
export type { MatchDoc as TMatchDoc };

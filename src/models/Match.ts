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
  event: "hit" | "crit" | "block" | "miss" | "passive_proc" | "ultimate_cast";
  damage: number; // >= 0
  attackerHP: number; // HP del atacante después del evento
  defenderHP: number; // HP del defensor después del evento
  ability?: {
    kind: AbilityKind; // "passive" | "ultimate"
    name?: string;
    id?: string;
    durationTurns?: number;
  };
  tags?: string[]; // etiquetas libres para VFX
}

/* snapshot arma (prepara min/max + futuro offhand) */
export interface WeaponSpec {
  slug: string;
  min: number; // daño mínimo del ítem
  max: number; // daño máximo del ítem
  type?: string; // ej. "sword" | "dagger" | "bow" | "staff"
}

/** Metadata de clase que podemos persistir sin acoplar:
 * - primaryWeapons: para aplicar bonus al daño del arma “de clase”
 * - passiveDefaultSkill / ultimateSkill: shapes libres (el runner puede leer lo que necesite)
 */
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

  // weapon/offHand aceptan string (legacy) o objeto (nuevo)
  weapon: string | WeaponSpec;
  offHand?: string | WeaponSpec;

  // Metadata opcional de clase (bonus primarios / skill descriptors)
  classMeta?: ClassMeta;

  stats: Record<string, number>; // base stats “congelados” al crear el match

  combat: {
    maxHP: number;
    attackPower: number;
    magicPower: number;

    /** Porcentajes: 0..1 o 0..100; el runner normaliza. */
    evasion: number;
    blockChance: number;
    damageReduction: number;
    criticalChance: number;
    criticalDamageBonus: number; // 0.5 => +50% o 50 => +50%
    attackSpeed: number;
  };

  currentHP: number; // = maxHP al crear el match
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
  events: string[]; // ej. ["player:attack","player:hit","player:crit","enemy:block"]
  status?: Record<string, any>;
}

/* ───────── Documento principal ───────── */
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

  /** outcome POV atacante (para rankings/estadística rápida) */
  outcome?: MatchOutcome;

  /** winner POV motor ("player" | "enemy" | "draw") */
  winner?: MatchWinner;

  /** métricas guardadas del run */
  turns?: number;
  timeline?: TimelineEntry[];
  log?: string[];
  snapshots?: CombatSnapshot[];

  rewards?: Rewards;

  /** para migraciones/compat con runners nuevos */
  runnerVersion?: number;

  /** virtual */
  id?: string;
}

/* ───────── helpers de casteo a entero ───────── */
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
    offHand: { type: Schema.Types.Mixed, required: false },

    classMeta: { type: Schema.Types.Mixed, required: false }, // primaryWeapons / skills

    stats: { type: Schema.Types.Mixed, default: {} },

    combat: {
      maxHP: { type: Number, required: true, set: i },
      attackPower: { type: Number, required: true, set: i },
      magicPower: { type: Number, required: true, set: i },
      evasion: { type: Number, required: true },
      blockChance: { type: Number, required: true },
      damageReduction: { type: Number, required: true },
      criticalChance: { type: Number, required: true },
      criticalDamageBonus: { type: Number, required: true },
      attackSpeed: { type: Number, required: true },
    },

    currentHP: { type: Number, required: true, min: 0, set: i },
  },
  { _id: false }
);

/** Timeline con eventos extendidos */
const TimelineSchema = new Schema<TimelineEntry>(
  {
    turn: { type: Number, required: true, set: i },
    source: { type: String, enum: ["attacker", "defender"], required: true },
    event: {
      type: String,
      enum: ["hit", "crit", "block", "miss", "passive_proc", "ultimate_cast"],
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
    round: { type: Number, required: true, set: i },
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

    turns: { type: Number, set: i },
    timeline: { type: [TimelineSchema], default: [] },
    log: { type: [String], default: [] },
    snapshots: { type: [CombatSnapshotSchema], default: [] },

    rewards: {
      honor: { type: Number, default: 0, set: i },
      xp: { type: Number, default: 0, set: i },
      gold: { type: Number, default: 0, set: i },
    },

    runnerVersion: { type: Number, default: 2, set: i }, // ← Fate runner v2
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

/* ───────── Índices (centralizados para evitar duplicados) ───────── */
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

export const Match: Model<MatchDoc> = model<MatchDoc>("Match", MatchSchema);
export type { MatchDoc as TMatchDoc };

import { Schema, model, Types, Document } from "mongoose";

/* ───────── tipos base ───────── */
export type MatchStatus = "pending" | "simulated" | "resolved";
export type MatchOutcome = "attacker" | "defender" | "draw";
export type MatchWinner = "player" | "enemy" | "draw";
export type MatchMode = "pvp" | "pve";

/* timeline del runner (POV atacante) */
export interface TimelineEntry {
  turn: number;
  source: "attacker" | "defender";
  event: "hit" | "crit" | "block" | "miss";
  damage: number; // >= 0
  attackerHP: number; // HP del atacante después del evento
  defenderHP: number; // HP del defensor después del evento
}

/* snapshot arma (prepara min/max + futuro offhand) */
export interface WeaponSpec {
  slug: string;
  min: number; // daño mínimo del ítem
  max: number; // daño máximo del ítem
  type?: string; // ej. "sword" | "dagger" | "bow" | "staff"
}

export interface CharacterSnapshot {
  characterId: Types.ObjectId;
  userId: Types.ObjectId;
  username: string;
  level: number;
  className: string;

  /** Puede ser string (legacy) o WeaponSpec (nuevo). */
  weapon: string | WeaponSpec;
  /** Preparado para el futuro (puede ser string o WeaponSpec). */
  offHand?: string | WeaponSpec;

  /** Nombre de la pasiva por defecto (para tagging en snapshots.events). */
  passiveDefaultName?: string | null;

  stats: Record<string, number>; // base stats “congelados” al crear el match

  combat: {
    maxHP: number;
    attackPower: number;
    magicPower: number;

    /** Porcentajes: 0..1 o 0..100; el runner normaliza. */
    evasion: number; // 0..1 o %
    blockChance: number; // 0..1 o %
    damageReduction: number; // 0..1 o %
    criticalChance: number; // 0..1 o %
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

export interface MatchDoc extends Document<Types.ObjectId> {
  attackerUserId: Types.ObjectId;
  defenderUserId: Types.ObjectId;
  attackerCharacterId: Types.ObjectId;
  defenderCharacterId: Types.ObjectId;

  mode: MatchMode; // pvp por defecto

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
}

/* ───────── subesquemas ───────── */

const WeaponSpecSchema = new Schema<WeaponSpec>(
  {
    slug: { type: String, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    type: { type: String },
  },
  { _id: false }
);

const SnapshotSchema = new Schema<CharacterSnapshot>(
  {
    characterId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    username: { type: String, required: true },
    level: { type: Number, required: true },
    className: { type: String, required: true },

    // weapon/offHand aceptan string (legacy) o objeto (nuevo)
    weapon: { type: Schema.Types.Mixed, required: true },
    offHand: { type: Schema.Types.Mixed, required: false },

    passiveDefaultName: { type: String, default: null },

    stats: { type: Schema.Types.Mixed, default: {} },

    combat: {
      maxHP: { type: Number, required: true },
      attackPower: { type: Number, required: true },
      magicPower: { type: Number, required: true },
      evasion: { type: Number, required: true },
      blockChance: { type: Number, required: true },
      damageReduction: { type: Number, required: true },
      criticalChance: { type: Number, required: true },
      criticalDamageBonus: { type: Number, required: true },
      attackSpeed: { type: Number, required: true },
    },

    currentHP: { type: Number, required: true },
  },
  { _id: false }
);

const TimelineSchema = new Schema<TimelineEntry>(
  {
    turn: { type: Number, required: true },
    source: { type: String, enum: ["attacker", "defender"], required: true },
    event: { type: String, enum: ["hit", "crit", "block", "miss"], required: true },
    damage: { type: Number, required: true, min: 0 },
    attackerHP: { type: Number, required: true, min: 0 },
    defenderHP: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CombatSnapshotSchema = new Schema<CombatSnapshot>(
  {
    round: { type: Number, required: true },
    actor: { type: String, enum: ["player", "enemy"], required: true },
    damage: { type: Number, required: true, min: 0 },
    playerHP: { type: Number, required: true, min: 0 },
    enemyHP: { type: Number, required: true, min: 0 },
    events: { type: [String], default: [] },
    status: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

/* ───────── Match ───────── */

const MatchSchema = new Schema<MatchDoc>(
  {
    attackerUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    defenderUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    attackerCharacterId: { type: Schema.Types.ObjectId, required: true },
    defenderCharacterId: { type: Schema.Types.ObjectId, required: true },

    mode: { type: String, enum: ["pvp", "pve"], default: "pvp", index: true },

    attackerSnapshot: { type: SnapshotSchema, required: true },
    defenderSnapshot: { type: SnapshotSchema, required: true },

    seed: { type: Number, required: true },

    status: { type: String, enum: ["pending", "simulated", "resolved"], default: "pending", index: true },

    outcome: { type: String, enum: ["attacker", "defender", "draw"] },
    winner: { type: String, enum: ["player", "enemy", "draw"] },

    turns: { type: Number },
    timeline: { type: [TimelineSchema], default: [] },
    log: { type: [String], default: [] },
    snapshots: { type: [CombatSnapshotSchema], default: [] },

    rewards: {
      honor: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      gold: { type: Number, default: 0 },
    },

    runnerVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

/* índices compuestos útiles para listados */
MatchSchema.index({ status: 1, createdAt: -1 });
MatchSchema.index({ attackerUserId: 1, createdAt: -1 });
MatchSchema.index({ defenderUserId: 1, createdAt: -1 });

export const Match = model<MatchDoc>("Match", MatchSchema);

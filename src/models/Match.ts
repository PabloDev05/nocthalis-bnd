import { Schema, model, Types, Document } from "mongoose";

export type MatchStatus = "pending" | "simulated" | "resolved";
export type MatchOutcome = "attacker" | "defender" | "draw";

export interface TimelineEntry {
  turn: number;
  source: "attacker" | "defender";
  event: "hit" | "crit" | "block" | "miss";
  damage: number; // >= 0
  attackerHP: number; // HP restante del atacante después del evento
  defenderHP: number; // HP restante del defensor después del evento
}

export interface CharacterSnapshot {
  characterId: Types.ObjectId;
  userId: Types.ObjectId;
  username: string;
  level: number;
  className: string;
  weapon: string; // arma básica para anims
  stats: Record<string, number>; // si querés conservar stats base
  combat: {
    maxHP: number;
    attackPower: number;
    magicPower: number;
    evasion: number; // 0..1
    blockChance: number; // 0..1
    damageReduction: number; // 0..1
    criticalChance: number; // 0..1
    criticalDamageBonus: number; // ej. 0.5 = +50% daño
    attackSpeed: number; // golpes/seg o factor relativo
  };
  currentHP: number; // = maxHP al crear el match
}

export interface Rewards {
  honor: number;
  xp: number;
  gold: number;
}

export interface MatchDoc extends Document<Types.ObjectId> {
  attackerUserId: Types.ObjectId;
  defenderUserId: Types.ObjectId;
  attackerCharacterId: Types.ObjectId;
  defenderCharacterId: Types.ObjectId;
  attackerSnapshot: CharacterSnapshot;
  defenderSnapshot: CharacterSnapshot;
  seed: number;
  status: MatchStatus;
  outcome?: MatchOutcome;
  rewards?: Rewards;
}

const SnapshotSchema = new Schema<CharacterSnapshot>(
  {
    characterId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    username: { type: String, required: true },
    level: { type: Number, required: true },
    className: { type: String, required: true },
    weapon: { type: String, required: true },
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

const MatchSchema = new Schema<MatchDoc>(
  {
    attackerUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    defenderUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    attackerCharacterId: { type: Schema.Types.ObjectId, required: true },
    defenderCharacterId: { type: Schema.Types.ObjectId, required: true },
    attackerSnapshot: { type: SnapshotSchema, required: true },
    defenderSnapshot: { type: SnapshotSchema, required: true },
    seed: { type: Number, required: true },
    status: { type: String, enum: ["pending", "simulated", "resolved"], default: "pending", index: true },
    outcome: { type: String, enum: ["attacker", "defender", "draw"] },
    rewards: {
      honor: { type: Number, default: 0 },
      xp: { type: Number, default: 0 },
      gold: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const Match = model<MatchDoc>("Match", MatchSchema);

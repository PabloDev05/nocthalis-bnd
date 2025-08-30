/**
 * Base definitions of BUFFS/DEBUFFS for turn-based combat.
 * - Keys, names, description for UI/logs.
 * - No numbers in balance yet, only structure.
 */

export const STATUS_KEYS = [
  // Damage / CC debuffs
  "burn",
  "freeze",
  "shock",
  "poison",
  "bleed",
  "curse",
  "stun",
  "sleep",
  "paralysis",
  "confusion",
  "fear",
  "knockback",
  "weaken",
  "silence",

  // Generic buffs
  "haste",
  "shield",
  "rage",
  "fortify",
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];
export type StatusKind = "buff" | "debuff";

/**
 * Definition of a status effect (buff or debuff).
 */
export interface StatusDef {
  key: StatusKey;
  kind: StatusKind;
  name: string;
  description?: string;
  tags?: string[];
  maxStacks?: number;
  baseDuration?: number;
  tickOn?: "turnStart" | "turnEnd";
  affects?: string[];
}

export const STATUS_CATALOG: Record<StatusKey, StatusDef> = {
  // ───── Debuffs ─────
  burn: {
    key: "burn",
    kind: "debuff",
    name: "Burn",
    description: "Damage over time from fire.",
    tags: ["dot", "fire"],
    baseDuration: 2,
    tickOn: "turnStart",
  },

  freeze: {
    key: "freeze",
    kind: "debuff",
    name: "Frozen",
    description: "Cannot act while frozen.",
    tags: ["control", "ice"],
    baseDuration: 1,
  },

  shock: {
    key: "shock",
    kind: "debuff",
    name: "Shock",
    description: "Disrupts actions with lightning.",
    tags: ["control", "lightning"],
    baseDuration: 1,
  },

  poison: {
    key: "poison",
    kind: "debuff",
    name: "Poison",
    description: "Toxic damage over time.",
    tags: ["dot"],
    baseDuration: 2,
    tickOn: "turnStart",
  },

  bleed: {
    key: "bleed",
    kind: "debuff",
    name: "Bleed",
    description: "Physical damage over time.",
    tags: ["dot", "physical"],
    baseDuration: 2,
    maxStacks: 3,
    tickOn: "turnStart",
  },

  curse: {
    key: "curse",
    kind: "debuff",
    name: "Curse",
    description: "Weakened by dark magic.",
    tags: ["magic"],
    baseDuration: 2,
    affects: ["attackPower", "defense"],
  },

  stun: {
    key: "stun",
    kind: "debuff",
    name: "Stunned",
    description: "Cannot act for 1 turn.",
    tags: ["control"],
    baseDuration: 1,
  },

  sleep: {
    key: "sleep",
    kind: "debuff",
    name: "Sleep",
    description: "Inactive until damaged.",
    tags: ["control"],
    baseDuration: 2,
  },

  paralysis: {
    key: "paralysis",
    kind: "debuff",
    name: "Paralysis",
    description: "Chance to lose actions each turn.",
    tags: ["control"],
    baseDuration: 2,
  },

  confusion: {
    key: "confusion",
    kind: "debuff",
    name: "Confusion",
    description: "Erratic actions or target errors.",
    tags: ["control"],
    baseDuration: 2,
  },

  fear: {
    key: "fear",
    kind: "debuff",
    name: "Fear",
    description: "Reduces offensive capability.",
    tags: ["control", "mental"],
    baseDuration: 2,
    affects: ["criticalChance"],
  },

  knockback: {
    key: "knockback",
    kind: "debuff",
    name: "Knockback",
    description: "Displaced or interrupted.",
    tags: ["control", "physical"],
    baseDuration: 1,
  },

  weaken: {
    key: "weaken",
    kind: "debuff",
    name: "Weaken",
    description: "Reduced Physical Defense.",
    tags: ["defense", "physical"],
    baseDuration: 2,
    affects: ["physicalDefense"],
  },

  silence: {
    key: "silence",
    kind: "debuff",
    name: "Silence",
    description: "Cannot use ultimate skill.",
    tags: ["control", "magic"],
    baseDuration: 1,
  },

  // ───── Buffs ─────
  haste: {
    key: "haste",
    kind: "buff",
    name: "Haste",
    description: "Increases Attack Speed.",
    tags: ["speed"],
    baseDuration: 2,
    affects: ["attackSpeed"],
  },

  shield: {
    key: "shield",
    kind: "buff",
    name: "Shield",
    description: "Absorbs incoming damage.",
    tags: ["defense"],
    baseDuration: 2,
  },

  rage: {
    key: "rage",
    kind: "buff",
    name: "Rage",
    description: "Boosts damage dealt.",
    tags: ["offense"],
    baseDuration: 2,
    affects: ["attackPower"],
  },

  fortify: {
    key: "fortify",
    kind: "buff",
    name: "Fortify",
    description: "Reduces damage taken.",
    tags: ["defense"],
    baseDuration: 2,
    affects: ["damageReduction"],
  },
};

export function getStatusDef(key: StatusKey): StatusDef {
  return STATUS_CATALOG[key];
}

/**
 * 📌 EXPLICACIÓN
 *
 * - Cada estado tiene duración en turnos (`baseDuration`).
 * - Los DoT (`burn`, `poison`, `bleed`) aplican su daño al inicio del turno (`tickOn: turnStart`).
 * - Estados con `affects` modifican stats mientras están activos (ej: `weaken` → baja defensa física).
 * - Control (CC): `stun`, `sleep`, `silence` bloquean acciones o ultimates por turnos definidos.
 *
 * - Ultimates de las clases están alineadas:
 *   Vampire → `weaken`
 *   Werewolf → `bleed`
 *   Necromancer → `curse`
 *   Revenant → `fear`
 *   Exorcist → `silence`
 *
 * ✅ Esto asegura un combate automático por turnos simple, balanceado y fácil de mantener.
 */

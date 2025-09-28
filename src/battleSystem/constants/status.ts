/**
 * Definiciones base de BUFFS/DEBUFFS para combate por turnos.
 * - Solo estructura y metadata legible por UI/runner.
 * - Sin números de balance “duros” más allá de duración base y maxStacks.
 * - Todo en ENTEROS (stacks, turnos).
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
  "shield",
  "rage",
  "fortify",
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];
export type StatusKind = "buff" | "debuff";

/** Definición legible de un estado (buff o debuff). */
export interface StatusDef {
  key: StatusKey;
  kind: StatusKind;
  name: string;
  description?: string;
  /** Tags libres para UI/filtrado (“dot”, “control”, “physical”, “magic”, etc.) */
  tags?: string[];
  /** Máximo de acumulaciones (omitido o 1 ⇒ no stackea) */
  maxStacks?: number;
  /** Duración base en turnos (para UI y fallback) */
  baseDuration?: number;
  /** Momento de tiqueo para DoTs */
  tickOn?: "turnStart" | "turnEnd";
  /**
   * Stats derivados que se espera modifique mientras esté activo (sólo hints).
   * Ej.: ["attackPower", "damageReduction"]
   * ⚠️ El Engine decide cómo aplicar estos efectos.
   */
  affects?: string[];
}

/** Catálogo con nombres y metadata mínima. */
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
    affects: ["attackPower", "magicPower"],
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
    description: "Reduces offensive capability (often Crit).",
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
    // 👉 esto ayuda a StatusEngine.silenced() a detectarlo si consulta affects
    affects: ["ultimateLock"],
  },

  // ───── Buffs ─────
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

/* ───────────────────────── Helpers exportados ───────────────────────── */

/** Type guard para validar keys dinámicamente. */
export function isStatusKey(x: any): x is StatusKey {
  return typeof x === "string" && (STATUS_KEYS as readonly string[]).includes(x);
}

/** Obtiene la definición de un status; arroja si la key es inválida. */
export function getStatusDef(key: StatusKey): StatusDef {
  return STATUS_CATALOG[key];
}

/** Instancia de estado que usa el runner/snapshots. */
export interface StatusInstance {
  key: StatusKey;
  stacks: number; // entero ≥ 1 (si stackea)
  turnsLeft: number; // entero ≥ 0
}

/** Enteriza/limita stacks a [1..maxStacks] (o 1 si no stackea). */
export function clampStacks(key: StatusKey, wantStacks: number): number {
  const def = getStatusDef(key);
  const max = Math.max(1, Math.trunc(def.maxStacks ?? 1));
  const s = Math.max(1, Math.trunc(wantStacks || 1));
  return s > max ? max : s;
}

/** Duración por defecto en turnos (≥1) para inicializar efectos. */
export function defaultDuration(key: StatusKey): number {
  const def = getStatusDef(key);
  const d = Math.trunc(def.baseDuration ?? 1);
  return d >= 1 ? d : 1;
}

/** Crea una instancia normalizada (enteros) lista para aplicar. */
export function makeStatusInstance(key: StatusKey, stacks?: number, durationTurns?: number): StatusInstance {
  const s = clampStacks(key, stacks ?? 1);
  const t = Math.max(0, Math.trunc(durationTurns ?? defaultDuration(key)));
  return { key, stacks: s, turnsLeft: t };
}

/* Listas útiles para lógica rápida en el runner/UI */
export const DOT_STATUS: Readonly<StatusKey[]> = ["burn", "poison", "bleed"];
export const CONTROL_STATUS: Readonly<StatusKey[]> = ["freeze", "shock", "stun", "sleep", "paralysis", "confusion", "fear", "knockback", "silence"];

/**
 * 📌 Notas de mapeo (según seed/ultimates):
 *   Vampire    → aplica `weaken`
 *   Werewolf   → aplica `bleed`
 *   Necromancer→ aplica `curse`
 *   Revenant   → aplica `fear`
 *   Exorcist   → aplica `silence`
 *
 * Este módulo NO altera el combate por sí mismo: tu engine decide cómo
 * interpretar `affects`, cuándo tiquean los DoTs, cómo consume `turnsLeft`,
 * y cómo interactúan stacks con refresh/extend.
 */

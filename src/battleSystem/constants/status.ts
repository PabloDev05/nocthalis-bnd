/**
 * Definiciones base de BUFFS/DEBUFFS (sin efectos aún).
 * - Claves, nombres y descripción para UI/logs.
 * - Nada de números concretos por ahora: sólo estructura.
 */
export const STATUS_KEYS = [
  // Debuffs de daño/CC
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
  // Buffs genéricos
  "haste",
  "shield",
  "rage",
  "fortify",
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];
export type StatusKind = "buff" | "debuff";

export interface StatusDef {
  key: StatusKey;
  kind: StatusKind;
  name: string;
  description?: string;
  tags?: string[]; // p.ej. ["dot","control","defense"]
  maxStacks?: number; // default: 1
  baseDuration?: number; // en rondas; opcional
}

export const STATUS_CATALOG: Record<StatusKey, StatusDef> = {
  burn: { key: "burn", kind: "debuff", name: "Quemadura", description: "Daño en el tiempo (futuro).", tags: ["dot", "fire"] },
  freeze: { key: "freeze", kind: "debuff", name: "Congelado", description: "Control temporal (futuro).", tags: ["control", "ice"] },
  shock: { key: "shock", kind: "debuff", name: "Choque", description: "Puede penalizar turnos (futuro).", tags: ["control", "lightning"] },
  poison: { key: "poison", kind: "debuff", name: "Veneno", description: "Daño en el tiempo (futuro).", tags: ["dot"] },
  bleed: { key: "bleed", kind: "debuff", name: "Sangrado", description: "Daño en el tiempo (futuro).", tags: ["dot", "physical"] },
  curse: { key: "curse", kind: "debuff", name: "Maldición", description: "Penalidades varias (futuro).", tags: ["magic"] },
  stun: { key: "stun", kind: "debuff", name: "Aturdido", description: "Pierde acciones (futuro).", tags: ["control"] },
  sleep: { key: "sleep", kind: "debuff", name: "Sueño", description: "No actúa hasta recibir daño (futuro).", tags: ["control"] },
  paralysis: { key: "paralysis", kind: "debuff", name: "Parálisis", description: "No puede moverse (futuro).", tags: ["control"] },
  confusion: { key: "confusion", kind: "debuff", name: "Confusión", description: "Acciones erráticas (futuro).", tags: ["control"] },
  fear: { key: "fear", kind: "debuff", name: "Miedo", description: "Penaliza ofensiva (futuro).", tags: ["control"] },
  knockback: { key: "knockback", kind: "debuff", name: "Empuje", description: "Descoloca (futuro).", tags: ["control", "physical"] },

  haste: { key: "haste", kind: "buff", name: "Prisa", description: "Acelera ataques (futuro).", tags: ["speed"] },
  shield: { key: "shield", kind: "buff", name: "Escudo", description: "Absorbe daño (futuro).", tags: ["defense"] },
  rage: { key: "rage", kind: "buff", name: "Ira", description: "Aumenta daño (futuro).", tags: ["offense"] },
  fortify: { key: "fortify", kind: "buff", name: "Fortificar", description: "Reduce daño (futuro).", tags: ["defense"] },
};

export function getStatusDef(key: StatusKey): StatusDef {
  return STATUS_CATALOG[key];
}

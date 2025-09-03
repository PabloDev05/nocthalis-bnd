// src/battleSystem/passives/DefaultPassives.ts

/**
 * Tabla de "pasivas por defecto" por CLASE.
 * Son NUMÉRICAS y simples (no procs, no duración). Útiles para aplicar
 * modificadores planos a stats/combat ANTES del snapshot (fuera del motor).
 *
 * 👉 El motor de combate (pvpRunner/CombatManager) NO usa esto directamente.
 *    Sirve como fuente de verdad opcional para builders/cálculo previo.
 */

export type PassiveNumbers = {
  // Porcentajes enteros (p.ej. 30 => 30%)
  magicToDamagePct?: number; // Convierte % de magicPower a daño base simple
  critChancePct?: number; // +X% probabilidad de crítico
  critDamagePct?: number; // +X% bonus de daño crítico
  damageReductionPct?: number; // +X% reducción de daño
  blockAddPct?: number; // +X% probabilidad de bloqueo
  rampPerHitPct?: number; // +X% por golpe (acumulativo)
  rampMaxPct?: number; // tope del ramp
  evasionPct?: number; // +X% evasión
  attackSpeedPct?: number; // +X% velocidad de ataque
  attackPowerFlat?: number; // +X AP plano
  magicPowerFlat?: number; // +X MP plano
};

export const DEFAULT_PASSIVES: Record<
  "Vampire" | "Werewolf" | "Necromancer" | "Revenant" | "Exorcist",
  {
    name: string;
    description: string;
    effects: PassiveNumbers;
  }
> = {
  Vampire: {
    name: "Crimson Grace",
    description: "+2% Evasión y +5% Chance de Crítico.",
    effects: { evasionPct: 2, critChancePct: 5 },
  },
  Werewolf: {
    name: "Predatory Hide",
    description: "Daño recibido -5% y +2% Velocidad de Ataque.",
    effects: { damageReductionPct: 5, attackSpeedPct: 2 },
  },
  Necromancer: {
    name: "Umbral Infusion",
    description: "Convierte +30% del Poder Mágico a daño base.",
    effects: { magicToDamagePct: 30 },
  },
  Revenant: {
    name: "Deadeye",
    description: "+6% Chance de Crítico y +10% Daño Crítico.",
    effects: { critChancePct: 6, critDamagePct: 10 },
  },
  Exorcist: {
    name: "Iron Faith",
    description: "+3% Bloqueo y +5% Reducción de Daño.",
    effects: { blockAddPct: 3, damageReductionPct: 5 },
  },
};

/**
 * Helper: resuelve efectos por nombre de clase (string libre).
 * Si no matchea, retorna objeto vacío.
 */
export function effectsForClassName(className?: string): PassiveNumbers {
  const c = String(className ?? "").toLowerCase();
  if (c.includes("vampire")) return DEFAULT_PASSIVES.Vampire.effects;
  if (c.includes("werewolf")) return DEFAULT_PASSIVES.Werewolf.effects;
  if (c.includes("necromancer")) return DEFAULT_PASSIVES.Necromancer.effects;
  if (c.includes("revenant")) return DEFAULT_PASSIVES.Revenant.effects;
  if (c.includes("exorcist")) return DEFAULT_PASSIVES.Exorcist.effects;
  return {};
}

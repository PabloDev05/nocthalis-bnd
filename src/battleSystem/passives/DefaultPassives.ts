export type PassiveNumbers = {
  // porcentajes enteros (p.ej. 30 => 30%)
  magicToDamagePct?: number; // Convierte % de magicPower a daño físico/base
  critChancePct?: number; // +X% prob. de crítico
  critDamagePct?: number; // +X% daño crítico
  damageReductionPct?: number; // +X% reducción de daño
  blockAddPct?: number; // +X% prob. de bloqueo
  rampPerHitPct?: number; // +X% por golpe
  rampMaxPct?: number; // tope del ramp
};

export const DEFAULT_PASSIVES: Record<
  "Guerrero" | "Mago" | "Asesino" | "Arquero",
  {
    name: string;
    description: string; // que coincida con los efectos
    effects: PassiveNumbers;
  }
> = {
  Guerrero: {
    name: "Guardia de Acero",
    description: "Daño recibido -5% y +3% prob. de bloqueo.",
    effects: { damageReductionPct: 5, blockAddPct: 3 },
  },
  Mago: {
    name: "Infusión Arcana",
    description: "Convierte +30% del Poder Mágico a daño.",
    effects: { magicToDamagePct: 30 },
  },
  Asesino: {
    name: "Golpe Letal",
    description: "+5% prob. de crítico y +20% daño crítico.",
    effects: { critChancePct: 5, critDamagePct: 20 },
  },
  Arquero: {
    name: "Ojo del Águila",
    description: "+1% de daño por golpe (máx. +5%).",
    effects: { rampPerHitPct: 1, rampMaxPct: 5 },
  },
};

// Helper: resolver por nombre libre de clase
export function effectsForClassName(className?: string): PassiveNumbers {
  const c = (className || "").toLowerCase();
  if (c.includes("guerrero")) return DEFAULT_PASSIVES.Guerrero.effects;
  if (c.includes("mago")) return DEFAULT_PASSIVES.Mago.effects;
  if (c.includes("asesino")) return DEFAULT_PASSIVES.Asesino.effects;
  if (c.includes("arquero")) return DEFAULT_PASSIVES.Arquero.effects;
  return {};
}

/**
 * Pasivas numéricas por CLASE para aplicar ANTES del snapshot.
 */
export type PassiveNumbers = {
  // Porcentajes en puntos % (enteros)
  magicToDamagePct?: number; // Convierte % de magicPower/AP a daño base simple
  critChancePct?: number; // +X% probabilidad de crítico (puntos %)
  critDamagePct?: number; // +X% bonus de daño crítico (puntos %)
  damageReductionPct?: number; // +X% reducción de daño (puntos %)
  blockAddPct?: number; // +X% probabilidad de bloqueo (puntos %)
  evasionPct?: number; // +X% evasión (puntos %)

  // Planos
  attackPowerFlat?: number; // +X AP plano (entero)
  magicPowerFlat?: number; // +X MP plano (entero)

  // Placeholders para UI/runner (no aplicados acá)
  rampPerHitPct?: number;
  rampMaxPct?: number;
};

export const DEFAULT_PASSIVES: Record<"Vampire" | "Werewolf" | "Necromancer" | "Revenant" | "Exorcist", { name: string; description: string; effects: PassiveNumbers }> = {
  Vampire: {
    name: "Crimson Grace",
    description: "+2% Evasión y +5% Chance de Crítico.",
    effects: { evasionPct: 2, critChancePct: 5 },
  },
  Werewolf: {
    name: "Predatory Hide",
    description: "Daño recibido -5% y +2 ticks de Velocidad de Ataque.",
    effects: { damageReductionPct: 5 },
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

/** Resolver efectos por nombre de clase (string libre). */
export function effectsForClassName(className?: string): PassiveNumbers {
  const c = String(className ?? "").toLowerCase();
  if (c.includes("vampire")) return DEFAULT_PASSIVES.Vampire.effects;
  if (c.includes("werewolf")) return DEFAULT_PASSIVES.Werewolf.effects;
  if (c.includes("necromancer")) return DEFAULT_PASSIVES.Necromancer.effects;
  if (c.includes("revenant")) return DEFAULT_PASSIVES.Revenant.effects;
  if (c.includes("exorcist")) return DEFAULT_PASSIVES.Exorcist.effects;
  return {};
}

/* ──────────────────────────────────────────────────────────────
 * Aplicador: suma sólo enteros, nunca genera fracciones aquí.
 * ────────────────────────────────────────────────────────────── */
type CombatWritable = {
  attackPower?: number;
  magicPower?: number;
  maxHP?: number;

  // Porcentajes en puntos % (enteros)
  criticalChance?: number;
  criticalDamageBonus?: number;
  damageReduction?: number;
  blockChance?: number;
  evasion?: number;

  [k: string]: any; // compat
};
type DominantFlavor = "physical" | "magical";

const toInt = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
};
const clampMin = (n: number, lo = 0) => (n < lo ? lo : n);

/**
 * Aplica pasivas a un bloque "combat" (en puntos % y enteros).
 * NO normaliza porcentajes (runner se encarga).
 */
export function applyDefaultPassivesToCombat<T extends CombatWritable>(className: string | undefined, combatLike: T, opts?: { dominant?: DominantFlavor }): T {
  const out: T = { ...(combatLike ?? ({} as T)) };
  const eff = effectsForClassName(className);
  const dominant: DominantFlavor = opts?.dominant ?? (/\b(necromancer|exorcist|mage|wizard|sorcer(er|ess))\b/i.test(String(className ?? "")) ? "magical" : "physical");

  // 1) Planos (enteros)
  if (typeof eff.attackPowerFlat === "number") {
    out.attackPower = clampMin(toInt(out.attackPower, 0) + toInt(eff.attackPowerFlat, 0), 0);
  }
  if (typeof eff.magicPowerFlat === "number") {
    out.magicPower = clampMin(toInt(out.magicPower, 0) + toInt(eff.magicPowerFlat, 0), 0);
  }

  // 2) Porcentajes en puntos % (enteros)
  if (typeof eff.critChancePct === "number") {
    out.criticalChance = toInt(out.criticalChance, 0) + toInt(eff.critChancePct, 0);
  }
  if (typeof eff.critDamagePct === "number") {
    out.criticalDamageBonus = toInt(out.criticalDamageBonus, 0) + toInt(eff.critDamagePct, 0);
  }
  if (typeof eff.damageReductionPct === "number") {
    out.damageReduction = toInt(out.damageReduction, 0) + toInt(eff.damageReductionPct, 0);
  }
  if (typeof eff.blockAddPct === "number") {
    out.blockChance = toInt(out.blockChance, 0) + toInt(eff.blockAddPct, 0);
  }
  if (typeof eff.evasionPct === "number") {
    out.evasion = toInt(out.evasion, 0) + toInt(eff.evasionPct, 0);
  }

  // 4) Conversión “magicToDamagePct” (usa enteros, redondea hacia abajo)
  if (typeof eff.magicToDamagePct === "number" && eff.magicToDamagePct > 0) {
    const pct = toInt(eff.magicToDamagePct, 0);
    if (dominant === "magical") {
      const mp = toInt(out.magicPower, 0);
      out.magicPower = clampMin(mp + Math.floor((mp * pct) / 100), 0);
    } else {
      const ap = toInt(out.attackPower, 0);
      const mp = toInt(out.magicPower, 0);
      out.attackPower = clampMin(ap + Math.floor((mp * pct) / 100), 0);
    }
  }

  // rampPerHitPct / rampMaxPct → los manejás fuera (UI/runner) si querés.
  return out;
}

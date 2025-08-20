// Paquetes de pasivas por CLASE: lógica runtime (por ronda/golpe).
const DBG = process.env.DEBUG_COMBAT === "1";

import type { PassiveHooks } from "../passives/types";

export type ClassPassivePack = {
  name: string;
  hooks?: PassiveHooks | null;
};

/**
 * Mago – Llama Interna
 * +2% daño por ronda (máx 10%). Emite evento para animación.
 */
function mageInnerFlamePack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onRoundStart({ state, side }) {
      state.innerFlameStacks = Math.min(5, Number(state.innerFlameStacks ?? 0) + 1);
      if (DBG) console.log(`[PASSIVE][${side}] Llama Interna stacks =`, state.innerFlameStacks);
    },
    onModifyOutgoing({ dmg, state, side, pushEvent, self }) {
      const className = (self as any)?.className || null;
      if (className !== "Mago") return;
      const stacks = Math.max(0, Math.min(5, Number(state.innerFlameStacks ?? 0)));
      if (stacks > 0) {
        const mult = 1 + stacks * 0.02;
        const boosted = dmg * mult;
        pushEvent(`${side}:innerFlame`);
        if (DBG) console.log(`[PASSIVE][${side}] Llama Interna +${((mult - 1) * 100).toFixed(1)}% =>`, { before: dmg, after: boosted });
        return boosted;
      }
    },
  };
  return { name: "Mago", hooks };
}

/**
 * Arquero – Ojo del Águila
 * Igual filosofía que el mago: rampa de +2% daño por ronda (máx 10%).
 */
function archerEagleEyePack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onRoundStart({ state, side }) {
      state.eagleEyeStacks = Math.min(5, Number(state.eagleEyeStacks ?? 0) + 1);
      if (DBG) console.log(`[PASSIVE][${side}] Ojo del Águila stacks =`, state.eagleEyeStacks);
    },
    onModifyOutgoing({ dmg, state, side, pushEvent, self }) {
      const className = (self as any)?.className || null;
      if (className !== "Arquero") return;
      const stacks = Math.max(0, Math.min(5, Number(state.eagleEyeStacks ?? 0)));
      if (stacks > 0) {
        const mult = 1 + stacks * 0.02;
        const boosted = dmg * mult;
        pushEvent(`${side}:eagleEye`);
        if (DBG) console.log(`[PASSIVE][${side}] Ojo del Águila +${((mult - 1) * 100).toFixed(1)}% =>`, { before: dmg, after: boosted });
        return boosted;
      }
    },
  };
  return { name: "Arquero", hooks };
}

/**
 * Guerrero – Espíritu de Guardia
 * “Reduce el daño recibido mientras el escudo está activo”.
 * Hoy modelamos “escudo activo” como CUANDO BLOQUEA: si el golpe fue bloqueado,
 * aplica reducción adicional del 15% al daño ya mitigado por el bloqueo.
 */
function warriorShieldSpiritPack(): ClassPassivePack {
  const hooks: PassiveHooks = {
    onModifyIncoming({ dmg, flags, side, pushEvent, self }) {
      const className = (self as any)?.className || null;
      if (className !== "Guerrero") return;

      if (flags.blocked) {
        const reduced = dmg * 0.85; // -15% extra sobre el daño ya mitigado
        pushEvent(`${side}:shieldSpirit`);
        if (DBG) console.log(`[PASSIVE][${side}] Espíritu de Guardia aplicado sobre bloqueo =>`, { before: dmg, after: reduced });
        return reduced;
      }
    },
  };
  return { name: "Guerrero", hooks };
}

/**
 * Builder de pack según nombre de clase.
 * Asesino no necesita hooks: su pasiva por defecto es un bono plano (+30% CDB) que ya aplicamos fuera.
 */
export function buildClassPassivePack(className?: string | null): ClassPassivePack {
  switch (className) {
    case "Mago":
      return mageInnerFlamePack();
    case "Arquero":
      return archerEagleEyePack();
    case "Guerrero":
      return warriorShieldSpiritPack();
    // "Asesino": sólo bono plano (se aplica en utils/passives.ts)
    default:
      return { name: className || "N/A", hooks: null };
  }
}

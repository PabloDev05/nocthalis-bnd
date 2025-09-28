// Proc de habilidades pasivas y definitivas (ultimates).
// - Cálculo de chances (fate-based).
// - Aplicación y refresco de estados pasivos.
// - Helpers varios.
import { asInt } from "./CombatMath";
import type { PassiveConfig, PassiveRuntime } from "./CombatTypes";
import { PASSIVE_BASE_CHANCE, PASSIVE_PER_FATE, PASSIVE_MAX_CHANCE, ULT_BASE_CHANCE, ULT_PER_FATE, ULT_MAX_CHANCE } from "./CombatConfig";

export const passiveChance = (fate: number) => Math.max(0, Math.min(PASSIVE_MAX_CHANCE, PASSIVE_BASE_CHANCE + asInt(fate) * PASSIVE_PER_FATE));

export const ultimateChance = (fate: number) => Math.max(0, Math.min(ULT_MAX_CHANCE, ULT_BASE_CHANCE + asInt(fate) * ULT_PER_FATE));

export function applyOrRefreshPassiveRuntime(current: PassiveRuntime | null | undefined, cfg: PassiveConfig) {
  const fresh: PassiveRuntime = {
    active: true,
    remainingTurns: Math.max(1, asInt(cfg.durationTurns)),
    bonusDamage: Math.max(0, asInt(cfg.bonusDamage || 0)),
    effects: {
      evasionFlat: asInt(cfg.extraEffects?.evasionFlat || 0),
      magicPowerFlat: asInt(cfg.extraEffects?.magicPowerFlat || 0),
      blockChancePercent: asInt(cfg.extraEffects?.blockChancePercent || 0),
      criticalChancePercent: asInt(cfg.extraEffects?.criticalChancePercent || 0),
    },
  };
  if (current?.active && current.remainingTurns > 0) {
    return { runtime: { ...fresh, remainingTurns: Math.max(current.remainingTurns, fresh.remainingTurns) }, refreshed: true };
  }
  return { runtime: fresh, refreshed: false };
}

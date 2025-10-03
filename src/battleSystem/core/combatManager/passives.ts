import { applyOrRefreshPassiveRuntime, passiveChance } from "../CombatProcs";
import { roll100, asInt } from "../CombatMath";
import { PASSIVE_PITY_AFTER_FAILS, DEBUG_PROC } from "../CombatConfig";
import type { CombatSide, PassiveTriggerCheck, SideKey, CombatEvent } from "../CombatTypes";

/** Intenta activar/refrescar la pasiva (con pity) y añade el evento correspondiente. */
export function pushPassiveEvent(who: SideKey, side: CombatSide, fate: number, trigger: PassiveTriggerCheck, evts: CombatEvent[], rng: () => number) {
  const cfg = side.passiveDefaultSkill!;
  const chance = passiveChance(fate);
  const roll = roll100(rng);
  let result: "activated" | "refreshed" | "failed" = "failed";
  let remaining: number | undefined;
  let forced = false;

  if (roll <= chance) {
    const { runtime, refreshed } = applyOrRefreshPassiveRuntime(side._passiveRuntime__, cfg);
    side._passiveRuntime__ = runtime;
    side._passiveFailStreak__ = 0;
    result = refreshed ? "refreshed" : "activated";
    remaining = runtime.remainingTurns;
  } else {
    side._passiveFailStreak__ = (side._passiveFailStreak__ || 0) + 1;
    if (side._passiveFailStreak__ >= PASSIVE_PITY_AFTER_FAILS) {
      const { runtime, refreshed } = applyOrRefreshPassiveRuntime(side._passiveRuntime__, cfg);
      side._passiveRuntime__ = runtime;
      side._passiveFailStreak__ = 0;
      result = refreshed ? "refreshed" : "activated";
      remaining = runtime.remainingTurns;
      forced = true;
    }
  }

  evts.push({
    type: "passive_proc",
    actor: who,
    name: cfg.name,
    trigger: cfg.trigger.check,
    chancePercent: chance,
    roll,
    result,
    remainingTurns: remaining,
    duration: cfg.durationTurns,
    forcedByPity: forced,
  });

  if (DEBUG_PROC) console.debug("[PASSIVE]", side.name, cfg.name, "fate=", fate, "chance=", chance, "roll=", roll, "=>", result, forced ? "(PITY)" : "");
}

/** Consume 1 turno de la pasiva activa; devuelve null si expiró. */
export function tickPassive(run?: NonNullable<CombatSide["_passiveRuntime__"]> | null) {
  if (!run?.active) return run ?? null;
  const left = (run.remainingTurns ?? 0) - 1;
  return left <= 0 ? null : { ...run, remainingTurns: left };
}

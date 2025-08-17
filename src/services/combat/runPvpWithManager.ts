import type { CharacterSnapshot } from "../../models/Match";
import { runPvpWithManager as runCombatPvp } from "../combat/pvpWithManager";

// Timeline esperado por el esquema de Match (source en vez de actor)
export type TimelineEvent = "hit" | "crit" | "block" | "miss";
export interface MatchTimelineEntry {
  turn: number;
  source: "attacker" | "defender";
  event: TimelineEvent;
  damage: number;
  attackerHP: number;
  defenderHP: number;
}

export type RunResult = {
  outcome: "attacker" | "defender" | "draw";
  timeline: MatchTimelineEntry[];
};

/**
 * Adaptador: usa tu implementación canónica (services/combat/pvpWithManager)
 * y la transforma al contrato "attacker|defender|draw" + timeline con "source".
 */
export function runPvpWithManager(attacker: CharacterSnapshot, defender: CharacterSnapshot, seed: number, _extra?: unknown): RunResult {
  const { outcome, timeline } = runCombatPvp({
    attackerSnapshot: attacker,
    defenderSnapshot: defender,
    seed,
    maxRounds: 30,
  });

  const mappedOutcome: RunResult["outcome"] = outcome === "win" ? "attacker" : outcome === "lose" ? "defender" : "draw";

  const mappedTimeline: MatchTimelineEntry[] = timeline.map((e) => ({
    turn: e.turn,
    source: e.actor, // actor -> source
    event: e.event,
    damage: e.damage,
    attackerHP: e.attackerHP,
    defenderHP: e.defenderHP,
  }));

  return { outcome: mappedOutcome, timeline: mappedTimeline };
}

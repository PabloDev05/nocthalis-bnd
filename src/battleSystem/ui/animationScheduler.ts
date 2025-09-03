// src/battleSystem/ui/animationScheduler.ts
import type { TimelineEntry } from "../pvp/pvpRunner"; // tipos del runner

export type ScheduledEventType = "attack_windup" | "impact_hit" | "impact_crit" | "impact_block" | "impact_miss" | "passive_proc" | "ultimate_cast";

export type ActorSide = "attacker" | "defender";

export interface ScheduledEvent {
  id: string;
  type: ScheduledEventType;
  actor: ActorSide;
  startMs: number;
  endMs: number;
  // payload opcional para UI (daño, nombre de habilidad, etc)
  payload?: Partial<TimelineEntry> & { source?: ActorSide };
}

/** Parámetros para controlar velocidad y solapamientos */
export interface ScheduleOptions {
  /** duración mínima de un turno (todos los eventos de ese turno deben caber acá) */
  minTurnMs: number; // p.ej. 1100
  gapSmallMs: number; // gap entre micro-eventos del mismo turno (p.ej. 120)
  // Duraciones base
  passiveProcMs: number; // 500
  ultimateCastMs: number; // 900
  attackWindupMs: number; // 350
  impactMs: number; // 250
  extraCritMs: number; // 200 (se suma a impact)
  extraBlockMs: number; // 180 (se suma a impact)
  extraMissMs: number; // 150 (se suma a impact)
}

export const DEFAULTS: ScheduleOptions = {
  minTurnMs: 1100,
  gapSmallMs: 120,
  passiveProcMs: 500,
  ultimateCastMs: 900,
  attackWindupMs: 350,
  impactMs: 250,
  extraCritMs: 200,
  extraBlockMs: 180,
  extraMissMs: 150,
};

function makeId(type: ScheduledEventType, idx: number, turn: number) {
  return `${turn}:${idx}:${type}`;
}

// Fallbacks resistentes de lectura de actor/evento
function readActor(e: Partial<TimelineEntry> & { source?: ActorSide }): ActorSide {
  return (e.actor as ActorSide) ?? (e.source as ActorSide) ?? "attacker";
}
function readEvent(e: Partial<TimelineEntry>): TimelineEntry["event"] {
  if (e.event) return e.event;
  const dmg = Number(e.damage ?? 0);
  return dmg > 0 ? "hit" : "miss";
}

/**
 * Recibe tu timeline (del runner) y devuelve eventos con timestamps absolutos (ms)
 * garantizando que:
 *  - los "ability events" (passive/ultimate) se colocan antes del golpe con
 *    pequeños gaps (no se pisan entre sí)
 *  - el impacto nunca se solapa con otro impacto
 *  - cada turno dura al menos minTurnMs
 * También tolera timelines "normalizados" que usan `source` en vez de `actor`.
 */
export function buildAnimationSchedule(
  timeline: Array<TimelineEntry | (Partial<TimelineEntry> & { source?: ActorSide })>,
  opts?: Partial<ScheduleOptions>
): { totalMs: number; events: ScheduledEvent[] } {
  const cfg: ScheduleOptions = { ...DEFAULTS, ...(opts || {}) };
  const out: ScheduledEvent[] = [];

  if (!Array.isArray(timeline) || timeline.length === 0) {
    return { totalMs: 0, events: out };
  }

  let tCursor = 0; // tiempo absoluto en ms
  let lastTurn = Number(timeline[0]?.turn ?? 1);
  let turnStart = 0;
  let perTurnIndex = 0;

  const schedule = (type: ScheduledEventType, actor: ActorSide, dur: number, payload?: Partial<TimelineEntry> & { source?: ActorSide }) => {
    const id = makeId(type, perTurnIndex++, Number(payload?.turn ?? lastTurn));
    const startMs = tCursor;
    const endMs = startMs + Math.max(0, dur);
    out.push({ id, type, actor, startMs, endMs, payload });
    tCursor = endMs;
  };

  for (let i = 0; i < timeline.length; i++) {
    const raw = timeline[i] as Partial<TimelineEntry> & { source?: ActorSide };
    const next = timeline[i + 1] as (Partial<TimelineEntry> & { source?: ActorSide }) | undefined;

    const turn = Number(raw.turn ?? lastTurn);
    // Si cambia el turno, garantizamos el cierre del turno previo con duración mínima
    if (turn !== lastTurn) {
      const minEnd = turnStart + cfg.minTurnMs;
      if (tCursor < minEnd) tCursor = minEnd;

      lastTurn = turn;
      turnStart = tCursor;
      perTurnIndex = 0;
    }

    const actor: ActorSide = readActor(raw);
    const ev = readEvent(raw);

    // 1) Habilidades (secuenciadas, mini gaps)
    if (ev === "passive_proc") {
      schedule("passive_proc", actor, cfg.passiveProcMs, raw);
      tCursor += cfg.gapSmallMs;
      continue; // seguimos al próximo entry; éste no es el impacto
    }

    if (ev === "ultimate_cast") {
      schedule("ultimate_cast", actor, cfg.ultimateCastMs, raw);
      tCursor += cfg.gapSmallMs;
      continue;
    }

    // 2) Ataque: windup + impacto. El entry 'raw' es el golpe real.
    schedule("attack_windup", actor, cfg.attackWindupMs, raw);

    // impacto según tipo
    let impactType: ScheduledEventType = "impact_hit";
    let extra = 0;
    if (ev === "crit") {
      impactType = "impact_crit";
      extra = cfg.extraCritMs;
    } else if (ev === "block") {
      impactType = "impact_block";
      extra = cfg.extraBlockMs;
    } else if (ev === "miss") {
      impactType = "impact_miss";
      extra = cfg.extraMissMs;
    }

    schedule(impactType, actor, cfg.impactMs + extra, raw);

    // ¿cierre de turno? Garantizamos piso de duración cuando el siguiente evento es de otro turno
    if (!next || Number(next.turn ?? turn) !== turn) {
      const minEnd = turnStart + cfg.minTurnMs;
      if (tCursor < minEnd) tCursor = minEnd;
    }
  }

  const totalMs = out.length ? out[out.length - 1].endMs : 0;
  return { totalMs, events: out };
}

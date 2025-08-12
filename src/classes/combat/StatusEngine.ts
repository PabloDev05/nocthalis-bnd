/**
 * Lleva el estado activo de buffs/debuffs en cada bando.
 * HOY: sólo gestiona stacks/duración y emite eventos.
 * MAÑANA: podés hacer que afecte daño, turnos, etc.
 */
import type { StatusKey } from "../../constants/status";

const DBG = process.env.DEBUG_COMBAT === "1";
type Side = "player" | "enemy";

export interface StatusInstance {
  key: StatusKey;
  stacks: number;
  turnsLeft: number; // en rondas
  source?: Side;
}

type StateMap = Map<StatusKey, StatusInstance>;

export class StatusEngine {
  private states: Record<Side, StateMap> = { player: new Map(), enemy: new Map() };

  constructor(
    private rng: () => number,
    /** función para obtener resistencia 0–100 de un lado frente a un status (cuando lo apliques) */
    private getResistance: (side: Side, key: StatusKey) => number = () => 0
  ) {}

  /** Para snapshots/UI */
  public getPublicState() {
    const toArr = (m: StateMap) => [...m.values()].map((s) => ({ key: s.key, stacks: s.stacks, turnsLeft: s.turnsLeft }));
    return { player: toArr(this.states.player), enemy: toArr(this.states.enemy) };
  }

  /** Llamar al inicio de cada ronda para decrementar y limpiar expirados. */
  public onRoundStart(round: number, pushEvent: (e: string) => void) {
    ["player", "enemy"].forEach((side) => {
      const map = this.states[side as Side];
      for (const s of map.values()) {
        s.turnsLeft = Math.max(0, s.turnsLeft - 1);
        if (s.turnsLeft <= 0) {
          map.delete(s.key);
          pushEvent(`${side}:expire:${s.key}`);
          if (DBG) console.log("[STATUS] Expira", { side, key: s.key });
        }
      }
    });
    if (DBG) console.log("[STATUS] onRoundStart", { round, player: this.getPublicState().player, enemy: this.getPublicState().enemy });
  }

  /**
   * Intento de aplicar un estado. HOY: siempre entra si llamás con baseChance=100
   * y no hay resistencias conectadas. Guardado de stacks/duración y evento.
   */
  public tryApply(opts: {
    to: Side;
    key: StatusKey;
    baseChance?: number; // 0–100
    duration?: number; // en rondas
    stacks?: number; // default 1
    source?: Side;
    pushEvent: (e: string) => void;
  }) {
    const { to, key, baseChance = 100, duration = 2, stacks = 1, source, pushEvent } = opts;

    const res = this.getResistance(to, key) || 0; // 0–100
    const effChance = Math.max(0, Math.min(100, baseChance * (1 - res / 100)));
    const roll = this.rng() * 100;
    const applied = roll < effChance;

    if (!applied) {
      pushEvent(`${to}:resist:${key}`);
      if (DBG) console.log("[STATUS] Resistió", { to, key, baseChance, res, effChance, roll });
      return { applied: false };
    }

    const map = this.states[to];
    const current = map.get(key);
    if (current) {
      current.stacks += stacks;
      current.turnsLeft = Math.max(current.turnsLeft, duration);
    } else {
      map.set(key, { key, stacks, turnsLeft: duration, source });
    }

    pushEvent(`${to}:apply:${key}`);
    if (DBG) console.log("[STATUS] Aplica", { to, key, stacks, duration, res, effChance, roll });
    return { applied: true };
  }

  /** Helpers de consulta para futuro (p.ej. saltar turno si stun) */
  public has(side: Side, key: StatusKey) {
    return this.states[side].has(key);
  }
  public get(side: Side, key: StatusKey) {
    return this.states[side].get(key);
  }
  public remove(side: Side, key: StatusKey) {
    this.states[side].delete(key);
  }
}

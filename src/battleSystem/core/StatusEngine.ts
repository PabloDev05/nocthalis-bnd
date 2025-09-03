// src/battleSystem/core/StatusEngine.ts
/**
 * Lleva el estado activo de buffs/debuffs en cada bando.
 * HOY: solo gestiona stacks/duración y emite eventos.
 * MAÑANA: podés hacer que afecte daño, turnos, etc. (ver hooks del runner).
 */

import type { StatusKey } from "../constants/status";

const DBG = process.env.DEBUG_COMBAT === "1";
export type Side = "player" | "enemy";

export interface StatusInstance {
  key: StatusKey;
  stacks: number;
  turnsLeft: number; // en rondas
  source?: Side;
}

type StateMap = Map<StatusKey, StatusInstance>;

const SIDES: Side[] = ["player", "enemy"];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const toInt = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : d;
};

export class StatusEngine {
  private states: Record<Side, StateMap> = { player: new Map(), enemy: new Map() };

  constructor(
    private rng: () => number,
    /**
     * Resistencia (0–100) del lado frente a un status. Si no pasás nada, asume 0.
     */
    private getResistance: (side: Side, key: StatusKey) => number = () => 0,
    /**
     * Tope de stacks por status. Si no pasás nada, sin tope.
     */
    private getMaxStacks: (key: StatusKey) => number | undefined = () => undefined
  ) {}

  /** Limpia todo */
  public reset() {
    this.states.player.clear();
    this.states.enemy.clear();
  }

  /** Elimina todos los estados de un lado específico */
  public clear(side: Side) {
    this.states[side].clear();
  }

  /** Para snapshots/UI (no expone `source`) */
  public getPublicState() {
    const toArr = (m: StateMap) => [...m.values()].map((s) => ({ key: s.key, stacks: s.stacks, turnsLeft: s.turnsLeft }));
    return { player: toArr(this.states.player), enemy: toArr(this.states.enemy) };
  }

  /** Estado interno completo (incluye `source`). Útil para debug. */
  public getInternalState() {
    const toArr = (m: StateMap) => [...m.values()].map((s) => ({ ...s }));
    return { player: toArr(this.states.player), enemy: toArr(this.states.enemy) };
  }

  /** Serializa para guardar entre turnos si quisieras persistirlo */
  public serialize(): { player: StatusInstance[]; enemy: StatusInstance[] } {
    const toArr = (m: StateMap) => [...m.values()].map((s) => ({ ...s }));
    return { player: toArr(this.states.player), enemy: toArr(this.states.enemy) };
  }

  /** Restaura desde `serialize()` (no valida claves) */
  public hydrate(payload: { player?: StatusInstance[]; enemy?: StatusInstance[] } | null | undefined) {
    if (!payload) return;
    if (Array.isArray(payload.player)) {
      this.states.player.clear();
      for (const s of payload.player) {
        this.states.player.set(s.key, { ...s, stacks: toInt(s.stacks, 1), turnsLeft: Math.max(0, toInt(s.turnsLeft, 0)) });
      }
    }
    if (Array.isArray(payload.enemy)) {
      this.states.enemy.clear();
      for (const s of payload.enemy) {
        this.states.enemy.set(s.key, { ...s, stacks: toInt(s.stacks, 1), turnsLeft: Math.max(0, toInt(s.turnsLeft, 0)) });
      }
    }
  }

  /** Llamar al inicio de cada ronda para decrementar y limpiar expirados. */
  public onRoundStart(round: number, pushEvent: (e: string) => void) {
    for (const side of SIDES) {
      const map = this.states[side];
      for (const s of [...map.values()]) {
        s.turnsLeft = Math.max(0, s.turnsLeft - 1);
        if (s.turnsLeft <= 0) {
          map.delete(s.key);
          pushEvent(`${side}:expire:${s.key}`);
          if (DBG) console.log("[STATUS] Expira", { side, key: s.key });
        }
      }
    }
    if (DBG) console.log("[STATUS] onRoundStart", { round, public: this.getPublicState() });
  }

  /**
   * Intenta aplicar un estado.
   * - `baseChance` 0–100. Se ajusta por resistencia: eff = base*(1 - res/100).
   * - Si ya existe, **refresca** duración al máximo entre actual y nueva y suma stacks (respetando tope si hay).
   * - Emite `<side>:apply:<key>` cuando aplica, `<side>:resist:<key>` si falla por suerte/resistencia.
   */
  public tryApply(opts: {
    to: Side;
    key: StatusKey;
    baseChance?: number; // 0–100
    duration?: number; // en rondas (>=1)
    stacks?: number; // default 1
    source?: Side;
    pushEvent: (e: string) => void;
  }) {
    const { to, key } = opts;
    const baseChance = clamp(toInt(opts.baseChance ?? 100, 100), 0, 100);
    const duration = Math.max(1, toInt(opts.duration ?? 2, 2));
    const stacks = Math.max(1, toInt(opts.stacks ?? 1, 1));
    const source = opts.source;
    const pushEvent = opts.pushEvent;

    const res = clamp(this.getResistance(to, key) || 0, 0, 100); // 0–100
    const effChance = clamp(baseChance * (1 - res / 100), 0, 100);
    const roll = this.rng() * 100;
    const applied = roll < effChance;

    if (!applied) {
      pushEvent(`${to}:resist:${key}`);
      if (DBG) console.log("[STATUS] Resistió", { to, key, baseChance, res, effChance, roll });
      return { applied: false };
    }

    const map = this.states[to];
    const current = map.get(key);
    const cap = this.getMaxStacks(key);
    if (current) {
      const nextStacks = current.stacks + stacks;
      current.stacks = typeof cap === "number" ? clamp(nextStacks, 1, Math.max(1, cap)) : nextStacks;
      current.turnsLeft = Math.max(current.turnsLeft, duration);
      if (source) current.source = source;
    } else {
      const initStacks = typeof cap === "number" ? clamp(stacks, 1, Math.max(1, cap)) : stacks;
      map.set(key, { key, stacks: initStacks, turnsLeft: duration, source });
    }

    pushEvent(`${to}:apply:${key}`);
    if (DBG) console.log("[STATUS] Aplica", { to, key, stacks, duration, res, effChance, roll, cap });
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

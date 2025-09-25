// src/battleSystem/core/StatusEngine.ts
/* eslint-disable no-console */
/**
 * Lleva el estado activo de buffs/debuffs en cada bando.
 * - Mantiene stacks, duración y magnitudes (value/dotDamage).
 * - Integra resistencias del OBJETIVO para:
 *   (a) bajar la chance de aplicación
 *   (b) atenuar magnitud (value) de algunos estados
 *   (c) reducir el daño por tick de DoT (bleed/poison/burn)
 * - Los DoT tiquean en "turnStart" (PvP táctico).
 *
 * 👉 El tick emite un payload que el CombatManager convierte en evento `dot_tick`
 *    (separado de `hit`) para logs/VFX.
 */

import { STATUS_CATALOG, getStatusDef } from "../constants/status";
import type { StatusKey } from "../constants/status";

const DBG = process.env.DEBUG_COMBAT === "1";

/* ========== Tipos de módulo (¡fuera de la clase!) ========== */
export type Side = "player" | "enemy";
export type DotKey = "bleed" | "poison" | "burn";

/** Payload que emite un tick de DoT para que el Manager loguee `dot_tick`. */
export type DotTickEvent = { actor: Side; victim: Side; key: DotKey; dmg: number };

/** Defaults de magnitudes y pps; exportados para tuning/balance. */
export const STATUS_DEFAULTS = {
  bleedPerStack: 6,
  poisonPerStack: 5,
  burnPerStack: 5,

  weakenPct: 10,
  cursePct: 10,
  ragePct: 10,
  fortifyPct: 5,
  shieldPct: 8,

  fearPP: 10, // puntos porcentuales de reducción de crítico
  hasteFlat: 2, // +AS por stack
  shockFlat: -2, // -AS por stack
} as const;

export interface StatusInstance {
  key: StatusKey;
  stacks: number;
  turnsLeft: number; // rondas
  source?: Side;
  value?: number; // magnitud por stack (fear/curse/etc.)
  dotDamage?: number; // dps por stack (DoT)
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
    /** Resistencia (0–100) del OBJETIVO frente a un status. */
    private getResistance: (side: Side, key: StatusKey) => number = () => 0,
    /** Tope de stacks por status. */
    private getMaxStacks: (key: StatusKey) => number | undefined = () => undefined
  ) {}

  // ───────────────── Reset/Query ─────────────────
  public reset() {
    this.states.player.clear();
    this.states.enemy.clear();
  }
  public clear(side: Side) {
    this.states[side].clear();
  }

  public getPublicState() {
    const toArr = (m: StateMap) => [...m.values()].map((s) => ({ key: s.key, stacks: s.stacks, turnsLeft: s.turnsLeft, value: s.value }));
    return { player: toArr(this.states.player), enemy: toArr(this.states.enemy) };
  }
  public getInternalState() {
    const toArr = (m: StateMap) => [...m.values()].map((s) => ({ ...s }));
    return { player: toArr(this.states.player), enemy: toArr(this.states.enemy) };
  }
  public serialize(): { player: StatusInstance[]; enemy: StatusInstance[] } {
    const toArr = (m: StateMap) => [...m.values()].map((s) => ({ ...s }));
    return { player: toArr(this.states.player), enemy: toArr(this.states.enemy) };
  }
  public hydrate(payload: { player?: StatusInstance[]; enemy?: StatusInstance[] } | null | undefined) {
    if (!payload) return;
    if (Array.isArray(payload.player)) {
      this.states.player.clear();
      for (const s of payload.player) {
        this.states.player.set(s.key, {
          ...s,
          stacks: Math.max(1, toInt(s.stacks, 1)),
          turnsLeft: Math.max(0, toInt(s.turnsLeft, 0)),
          value: typeof s.value === "number" ? s.value : undefined,
          dotDamage: typeof s.dotDamage === "number" ? s.dotDamage : undefined,
        });
      }
    }
    if (Array.isArray(payload.enemy)) {
      this.states.enemy.clear();
      for (const s of payload.enemy) {
        this.states.enemy.set(s.key, {
          ...s,
          stacks: Math.max(1, toInt(s.stacks, 1)),
          turnsLeft: Math.max(0, toInt(s.turnsLeft, 0)),
          value: typeof s.value === "number" ? s.value : undefined,
          dotDamage: typeof s.dotDamage === "number" ? s.dotDamage : undefined,
        });
      }
    }
  }

  /**
   * Llamar al INICIO de cada ronda para decrementar y limpiar expirados.
   * (El tick de DoT debe hacerse ANTES desde el CombatManager).
   */
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

  // ───────────────── Aplicación ─────────────────
  public tryApply(opts: {
    to: Side;
    key: StatusKey;
    baseChance?: number; // 0–100
    duration?: number; // rondas
    stacks?: number; // default 1
    value?: number; // magnitud por stack (fear/curse/etc.)
    dotDamage?: number; // daño por turno por stack (DoT)
    source?: Side;
    pushEvent: (e: string) => void;
  }) {
    const { to, key } = opts;
    const baseChance = clamp(toInt(opts.baseChance ?? 100, 100), 0, 100);
    const duration = Math.max(1, toInt(opts.duration ?? getStatusDef(key).baseDuration ?? 2, 2));
    const stacks = Math.max(1, toInt(opts.stacks ?? 1, 1));
    const source = opts.source;
    const pushEvent = opts.pushEvent;

    const res = clamp(this.getResistance(to, key) || 0, 0, 100);
    const effChance = clamp(baseChance * (1 - res / 100), 0, 100);
    const roll = this.rng() * 100;
    const applied = roll < effChance;

    if (!applied) {
      pushEvent(`${to}:resist:${key}`);
      if (DBG) console.log("[STATUS] Resistió", { to, key, baseChance, res, effChance, roll });
      return { applied: false };
    }

    // Atenuar magnitud de value por resistencia:
    const incomingValue = typeof opts.value === "number" ? opts.value : undefined;
    const scaledValue = typeof incomingValue === "number" ? Math.max(0, Math.floor(incomingValue * (1 - res / 100))) : undefined;

    // dotDamage se ajusta en tickDots (no aquí).
    const map = this.states[to];
    const current = map.get(key);
    const cap = this.getMaxStacks(key);

    if (current) {
      const nextStacks = current.stacks + stacks;
      current.stacks = typeof cap === "number" ? clamp(nextStacks, 1, Math.max(1, cap)) : nextStacks;
      current.turnsLeft = Math.max(current.turnsLeft, duration);
      if (source) current.source = source;
      if (typeof scaledValue === "number") current.value = Math.max(current.value ?? scaledValue, scaledValue);
      if (typeof opts.dotDamage === "number") current.dotDamage = Math.max(current.dotDamage ?? opts.dotDamage, opts.dotDamage);
    } else {
      const initStacks = typeof cap === "number" ? clamp(stacks, 1, Math.max(1, cap)) : stacks;
      map.set(key, { key, stacks: initStacks, turnsLeft: duration, source, value: scaledValue, dotDamage: opts.dotDamage });
    }

    pushEvent(`${to}:apply:${key}`);
    if (DBG) console.log("[STATUS] Aplica", { to, key, stacks, duration, res, effChance, roll, scaledValue, dot: opts.dotDamage, cap });
    return { applied: true };
  }

  // ───────────────── Helpers CRUD ─────────────────
  public has(side: Side, key: StatusKey) {
    return this.states[side].has(key);
  }
  public get(side: Side, key: StatusKey) {
    return this.states[side].get(key);
  }
  public remove(side: Side, key: StatusKey) {
    this.states[side].delete(key);
  }
  public wakeIfDamaged(side: Side) {
    if (this.has(side, "sleep")) this.remove(side, "sleep");
  }

  // ───────────────── Ticks de DoT ─────────────────
  /**
   * Devuelve el daño total aplicado y llama `emit` por cada DoT en tick.
   * El callback recibe un payload estructurado para que el manager emita `dot_tick`.
   */
  public tickDots(victim: Side, when: "turnStart" | "turnEnd", emit: (e: DotTickEvent) => void): number {
    const map = this.states[victim];
    if (!map.size) return 0;
    let total = 0;

    for (const [key, inst] of map.entries()) {
      const def = STATUS_CATALOG[key];
      if (!def?.tickOn || def.tickOn !== when) continue;
      if (key !== "bleed" && key !== "poison" && key !== "burn") continue;

      const res = clamp(this.getResistance(victim, key) || 0, 0, 100);
      const resFactor = Math.max(0, 1 - res / 100);

      const fallback = key === "bleed" ? STATUS_DEFAULTS.bleedPerStack : key === "poison" ? STATUS_DEFAULTS.poisonPerStack : STATUS_DEFAULTS.burnPerStack;

      const perStack = inst.dotDamage ?? fallback;
      const raw = Math.max(0, toInt(perStack) * Math.max(1, inst.stacks));
      const dmg = Math.floor(raw * resFactor);
      if (dmg > 0) {
        total += dmg;
        const actor = inst.source ?? (victim === "player" ? "enemy" : "player");
        emit({ actor, victim, key: key as DotKey, dmg });
      }
    }
    return total;
  }

  // ───────────────── Modificadores consultables ─────────────────

  public critChanceReductionFrac(side: Side): number {
    const fear = this.states[side].get("fear");
    if (!fear) return 0;
    const per = (fear.value ?? STATUS_DEFAULTS.fearPP) / 100;
    return clamp(per * Math.max(1, fear.stacks), 0, 1);
  }
  public attackPowerMul(side: Side): number {
    const curse = this.states[side].get("curse");
    const rage = this.states[side].get("rage");
    const curMul = curse ? Math.max(0, 1 - (curse.value ?? STATUS_DEFAULTS.cursePct) / 100) ** Math.max(1, curse.stacks) : 1;
    const ragMul = rage ? (1 + (rage.value ?? STATUS_DEFAULTS.ragePct) / 100) ** Math.max(1, rage.stacks) : 1;
    return Math.max(0, curMul * ragMul);
  }
  public extraDamageReduction(side: Side): number {
    const fortify = this.states[side].get("fortify");
    const shield = this.states[side].get("shield");
    const f = fortify ? ((fortify.value ?? STATUS_DEFAULTS.fortifyPct) / 100) * Math.max(1, fortify.stacks) : 0;
    const s = shield ? ((shield.value ?? STATUS_DEFAULTS.shieldPct) / 100) * Math.max(1, shield.stacks) : 0;
    return clamp(f + s, 0, 1);
  }
  public physDefMul(side: Side): number {
    const w = this.states[side].get("weaken");
    if (!w) return 1;
    const m = Math.max(0, 1 - (w.value ?? STATUS_DEFAULTS.weakenPct) / 100);
    return Math.max(0, m ** Math.max(1, w.stacks));
  }

  public cannotAct(side: Side): boolean {
    return this.states[side].has("stun") || this.states[side].has("freeze");
  }
  public silenced(side: Side): boolean {
    return this.states[side].has("silence");
  }
  public paralysisSkip(side: Side): boolean {
    return this.states[side].has("paralysis") && this.rng() < 0.5;
  }
  public confusionMiss(side: Side): boolean {
    return this.states[side].has("confusion") && this.rng() < 0.25;
  }
}

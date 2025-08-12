// src/classes/combat/CombatManager.ts
// Manager del combate con hooks + StatusEngine.
// - Tipo de daño (physical/magical) y mitigación con la defensa correcta.
// - Eventos para animación (attack, hit, crit, block, weapon:*).
// - Hooks de pasivas (onRoundStart / onModifyOutgoing / onModifyIncoming).
// - SIN uso de MP/mana (se eliminaron normalizaciones y logs de MP).

const DBG = process.env.DEBUG_COMBAT === "1";

import { StatusEngine } from "./StatusEngine";

export type AttackFlags = { miss?: boolean; crit?: boolean; blocked?: boolean };
export type AttackOutcome = { damage: number; flags: AttackFlags; events: string[] };

export interface PassiveHooks {
  onRoundStart?(args: { self: any; opponent: any; round: number; state: any; side: "player" | "enemy" }): void;

  onModifyOutgoing?(args: { self: any; opponent: any; round: number; state: any; dmg: number; flags: AttackFlags; side: "player" | "enemy"; pushEvent: (e: string) => void }): number | void;

  onModifyIncoming?(args: { self: any; opponent: any; round: number; state: any; dmg: number; flags: AttackFlags; side: "player" | "enemy"; pushEvent: (e: string) => void }): number | void;
}

type ManagerOpts = {
  rng?: () => number;
  playerHooks?: PassiveHooks | null;
  enemyHooks?: PassiveHooks | null;
};

// Tipo de daño
type DamageType = "physical" | "magical";

export class CombatManager {
  private rng: () => number;
  private round = 1;

  private playerHooks?: PassiveHooks | null;
  private enemyHooks?: PassiveHooks | null;

  private playerState: Record<string, any> = {};
  private enemyState: Record<string, any> = {};

  private status: StatusEngine;

  constructor(public player: any, public enemy: any, opts: ManagerOpts = {}) {
    this.rng = opts.rng ?? Math.random;
    this.playerHooks = opts.playerHooks ?? null;
    this.enemyHooks = opts.enemyHooks ?? null;

    // Normalizar HP actuales (SIN MP)
    this.player.currentHP = Math.max(0, Number(this.player.currentHP ?? this.player.maxHP ?? 0));
    this.enemy.currentHP = Math.max(0, Number(this.enemy.currentHP ?? this.enemy.maxHP ?? 0));

    // Motor de estados (resistencias a cablear cuando actives status)
    this.status = new StatusEngine(this.rng, (_side, _key) => 0);

    if (DBG) {
      console.log("[CM] Init combate:", {
        player: {
          name: this.player.name,
          cls: (this.player as any)?.className || null,
          hp: this.player.currentHP,
          attackPower: this.cstat(this.player, "attackPower"),
          magicPower: this.cstat(this.player, "magicPower"),
        },
        enemy: {
          name: this.enemy.name,
          cls: (this.enemy as any)?.className || null,
          hp: this.enemy.currentHP,
          attackPower: this.cstat(this.enemy, "attackPower"),
          magicPower: this.cstat(this.enemy, "magicPower"),
        },
      });
    }
  }

  // --- ciclo de ronda ---
  startRound(round: number, pushGlobalEvent: (e: string) => void) {
    this.round = round;

    // hooks de pasivas
    this.playerHooks?.onRoundStart?.({
      self: this.player,
      opponent: this.enemy,
      round,
      state: this.playerState,
      side: "player",
    });

    this.enemyHooks?.onRoundStart?.({
      self: this.enemy,
      opponent: this.player,
      round,
      state: this.enemyState,
      side: "enemy",
    });

    // tick de estados
    this.status.onRoundStart(round, pushGlobalEvent);
  }

  getStatusPublicState() {
    return this.status.getPublicState();
  }

  // --- helpers de stat y RNG ---
  private cstat(o: any, k: string, def = 0) {
    return Number(o?.[k] ?? o?.combatStats?.[k] ?? o?.stats?.[k] ?? def) || def;
  }
  private r(o: any, k: string, def = 0) {
    return Number(o?.resistances?.[k] ?? def) || def;
  }
  private rollPct(p: number) {
    return this.rng() * 100 < (p || 0);
  }
  private withVariance(value: number) {
    const f = 0.95 + this.rng() * 0.1; // ±5%
    return Math.max(0, Math.round(value * f));
  }

  // === base de daño según ATACANTE (mago vs resto) ===
  private getBaseDamage(attacker: any): { base: number; type: DamageType } {
    const className = (attacker as any)?.className || null;
    const ap = this.cstat(attacker, "attackPower", 0);
    const magPower = this.cstat(attacker, "magicPower", 0); // poder mágico (NO mana)

    // Regla: mago => mágico. Fallback: si magicPower >> attackPower, tratar como caster (enemigos).
    if (className === "Mago" || magPower > ap * 1.2) {
      const int = Number(attacker?.stats?.intelligence ?? 0);
      const base = magPower * (1 + int * 0.05);
      if (DBG) console.log("[CM] Base mágico:", { attacker: attacker.name, magicPower: magPower, int, base });
      return { base, type: "magical" };
    } else {
      const str = Number(attacker?.stats?.strength ?? 0);
      const base = ap * (1 + str * 0.04);
      if (DBG) console.log("[CM] Base físico:", { attacker: attacker.name, attackPower: ap, str, base });
      return { base, type: "physical" };
    }
  }

  // === mitigación: usa physicalDefense o magicalDefense según type ===
  private applyMitigations(rawDmg: number, type: DamageType, _att: any, def: any) {
    let dmg = rawDmg;
    const defStat = type === "magical" ? Number(def?.stats?.magicalDefense ?? 0) : Number(def?.stats?.physicalDefense ?? 0);

    const mitigation = defStat / (defStat + 100);
    dmg *= 1 - mitigation;

    let blocked = false;
    if (this.rollPct(this.cstat(def, "blockChance", 0))) {
      const before = dmg;
      dmg *= 1 - this.cstat(def, "blockValue", 0) / 100;
      blocked = true;
      if (DBG) console.log("[CM] Bloqueo:", { defender: def.name, before, after: dmg, type });
    }
    return { dmg, blocked };
  }

  /** ejemplo de status a futuro (no usado hoy) */
  private maybeApplyStatusExample(pushEvent: (e: string) => void) {
    // this.status.tryApply({ to: "enemy", key: "poison", baseChance: 20, duration: 2, stacks: 1, source: "player", pushEvent });
  }

  // --- anim helpers ---------------------------------------------------------
  private getWeaponVisual(attacker: any, type: DamageType): string {
    // 1) intentar derivar del arma equipada
    const main = attacker?.equipment?.mainWeapon;
    const cat = main?.type || main?.category || main?.kind || main?.tags?.find?.((t: string) => ["sword", "dagger", "bow", "staff", "axe", "mace"].includes(String(t).toLowerCase()));

    if (typeof cat === "string") {
      const low = cat.toLowerCase();
      if (["sword", "dagger", "bow", "staff", "axe", "mace"].includes(low)) return low;
    }

    // 2) fallback por clase / tipo de daño
    const cls = (attacker as any)?.className;
    if (type === "magical") return "staff";
    switch (cls) {
      case "Guerrero":
        return "sword";
      case "Asesino":
        return "dagger";
      case "Arquero":
        return "bow";
      case "Mago":
        return "staff";
      default:
        return (type as DamageType) === "magical" ? "staff" : "fists";
    }
  }

  // --- turnos ---------------------------------------------------------------

  playerAttack(): AttackOutcome {
    const flags: AttackFlags = {};
    const events: string[] = [];
    const pushEvent = (e: string) => events.push(e);

    // intento de ataque (sirve para animar el swing aun si falla)
    events.push("player:attack");

    // evasión
    if (this.rollPct(this.cstat(this.enemy, "evasion", 0))) {
      flags.miss = true;
      return { damage: 0, flags, events };
    }

    const { base, type } = this.getBaseDamage(this.player);

    // etiquetas visuales del golpe que va a conectar
    events.push(`player:weapon:${this.getWeaponVisual(this.player, type)}`);
    events.push("player:hit");
    events.push(`player:hit:${type}`);

    let dmg = base;

    // crítico
    const critChance = this.cstat(this.player, "criticalChance", 0) - this.r(this.enemy, "criticalChanceReduction", 0);

    if (this.rollPct(critChance)) {
      flags.crit = true;
      const bonus = this.cstat(this.player, "criticalDamageBonus", 0) - this.r(this.enemy, "criticalDamageReduction", 0);
      const before = dmg;
      dmg *= 1 + Math.max(0, bonus) / 100;
      if (DBG) console.log("[CM] CRIT jugador:", { chance: critChance, bonus, before, after: dmg });
    }

    // mitigaciones
    const m = this.applyMitigations(dmg, type, this.player, this.enemy);
    dmg = m.dmg;
    if (m.blocked) events.push("enemy:block");
    if (m.blocked) flags.blocked = true;

    // reducción plana del defensor
    const red = this.cstat(this.enemy, "damageReduction", 0);
    dmg *= 1 - red / 100;

    // hooks de pasivas
    const d1 = this.playerHooks?.onModifyOutgoing?.({
      self: this.player,
      opponent: this.enemy,
      round: this.round,
      state: this.playerState,
      dmg,
      flags,
      side: "player",
      pushEvent,
    });
    if (typeof d1 === "number") dmg = d1;

    const d2 = this.enemyHooks?.onModifyIncoming?.({
      self: this.enemy,
      opponent: this.player,
      round: this.round,
      state: this.enemyState,
      dmg,
      flags,
      side: "enemy",
      pushEvent,
    });
    if (typeof d2 === "number") dmg = d2;

    // this.maybeApplyStatusExample(pushEvent);

    // varianza y aplicación
    const beforeVar = dmg;
    dmg = this.withVariance(dmg);
    dmg = Math.max(1, Math.round(dmg));
    this.enemy.currentHP = Math.max(0, (this.enemy.currentHP ?? this.enemy.maxHP) - dmg);

    if (DBG) {
      console.log("[CM] Golpe jugador:", {
        type,
        target: this.enemy.name,
        redPct: red,
        beforeVar,
        final: dmg,
        targetHP: this.enemy.currentHP,
        flags,
        events,
      });
    }

    return { damage: dmg, flags, events };
  }

  enemyAttack(): AttackOutcome {
    const flags: AttackFlags = {};
    const events: string[] = [];
    const pushEvent = (e: string) => events.push(e);

    // intento de ataque enemigo
    events.push("enemy:attack");

    if (this.rollPct(this.cstat(this.player, "evasion", 0))) {
      flags.miss = true;
      return { damage: 0, flags, events };
    }

    const { base, type } = this.getBaseDamage(this.enemy);

    events.push(`enemy:weapon:${this.getWeaponVisual(this.enemy, type)}`);
    events.push("enemy:hit");
    events.push(`enemy:hit:${type}`);

    let dmg = base;

    const critChance = this.cstat(this.enemy, "criticalChance", 0) - this.r(this.player, "criticalChanceReduction", 0);
    if (this.rollPct(critChance)) {
      flags.crit = true;
      const bonus = this.cstat(this.enemy, "criticalDamageBonus", 0) - this.r(this.player, "criticalDamageReduction", 0);
      const before = dmg;
      dmg *= 1 + Math.max(0, bonus) / 100;
      if (DBG) console.log("[CM] CRIT enemigo:", { chance: critChance, bonus, before, after: dmg });
    }

    const m = this.applyMitigations(dmg, type, this.enemy, this.player);
    dmg = m.dmg;
    if (m.blocked) events.push("player:block");
    if (m.blocked) flags.blocked = true;

    const red = this.cstat(this.player, "damageReduction", 0);
    dmg *= 1 - red / 100;

    const d1 = this.enemyHooks?.onModifyOutgoing?.({
      self: this.enemy,
      opponent: this.player,
      round: this.round,
      state: this.enemyState,
      dmg,
      flags,
      side: "enemy",
      pushEvent,
    });
    if (typeof d1 === "number") dmg = d1;

    const d2 = this.playerHooks?.onModifyIncoming?.({
      self: this.player,
      opponent: this.enemy,
      round: this.round,
      state: this.playerState,
      dmg,
      flags,
      side: "player",
      pushEvent,
    });
    if (typeof d2 === "number") dmg = d2;

    const beforeVar = dmg;
    dmg = this.withVariance(dmg);
    dmg = Math.max(1, Math.round(dmg));
    this.player.currentHP = Math.max(0, (this.player.currentHP ?? this.player.maxHP) - dmg);

    if (DBG) {
      console.log("[CM] Golpe enemigo:", {
        type,
        target: this.player.name,
        redPct: red,
        beforeVar,
        final: dmg,
        targetHP: this.player.currentHP,
        flags,
        events,
      });
    }

    return { damage: dmg, flags, events };
  }

  // --- fin combate ----------------------------------------------------------
  isCombatOver() {
    return (this.player.currentHP ?? 0) <= 0 || (this.enemy.currentHP ?? 0) <= 0;
  }
  getWinner(): "player" | "enemy" | null {
    if ((this.player.currentHP ?? 0) <= 0) return "enemy";
    if ((this.enemy.currentHP ?? 0) <= 0) return "player";
    return null;
  }
}

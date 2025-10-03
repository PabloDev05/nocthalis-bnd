// Orquestador de combate por turnos: DOTs, cooldowns, selección de acción y eventos.
import { StatusEngine, type Side } from "./StatusEngine";
import { clamp } from "./CombatMath";
import { STATUS_CATALOG, isStatusKey } from "../constants/status";
import type { AttackOutput, CombatEvent, CombatSide, SideKey } from "./CombatTypes";
import { performBasicStrike } from "../../battleSystem/core/combatManager/basicStrike";
import { tryUltimate } from "../../battleSystem/core/combatManager/ultimateStrike";
import { tickPassive } from "../../battleSystem/core/combatManager/passives";

export class CombatManager {
  public player: CombatSide;
  public enemy: CombatSide;

  private rng: () => number;
  private rounds = 0;

  private SE: StatusEngine;
  private pendingStartEvents: CombatEvent[] = [];

  /** Inicializa estados, fallback de armas, HP y StatusEngine. */
  constructor(attackerLike: any, defenderLike: any, opts?: { rng?: () => number }) {
    this.player = attackerLike as CombatSide;
    this.enemy = defenderLike as CombatSide;
    this.rng = opts?.rng ?? Math.random;

    this.player.weaponMain = this.player.weaponMain || { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon", hands: 1 };
    this.enemy.weaponMain = this.enemy.weaponMain || { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon", hands: 1 };

    this.player.currentHP = clamp(this.player.currentHP, 0, this.player.maxHP);
    this.enemy.currentHP = clamp(this.enemy.currentHP, 0, this.enemy.maxHP);

    this.player._passiveFailStreak__ = 0;
    this.enemy._passiveFailStreak__ = 0;
    this.player._ultimateRuntime__ = { cooldown: 0, failStreak: 0 };
    this.enemy._ultimateRuntime__ = { cooldown: 0, failStreak: 0 };

    this.SE = new StatusEngine(
      this.rng,
      (side, key) => {
        const ref = side === "player" ? this.player : this.enemy;
        const k = isStatusKey(key) ? key : undefined;
        const resObj = (ref.resistances ?? {}) as Record<string, number>;
        return Math.max(0, Math.min(100, resObj[k ?? ""] ?? 0));
      },
      (key) => (isStatusKey(key) ? STATUS_CATALOG[key]?.maxStacks : undefined)
    );
  }

  /** Avanza el inicio de turno: aplica DoTs y reduce cooldowns al cierre de ronda. */
  startRound(turn: number) {
    if (turn % 2 === 1) this.rounds++;

    const collect = (e: { actor: Side; victim: Side; key: "bleed" | "poison" | "burn"; dmg: number }) => {
      const victim = e.victim;
      if (victim === "player") this.player.currentHP = Math.max(0, this.player.currentHP - e.dmg);
      else this.enemy.currentHP = Math.max(0, this.enemy.currentHP - e.dmg);
      this.SE.wakeIfDamaged(victim);
      this.pendingStartEvents.push({
        type: "dot_tick",
        actor: e.actor === "player" ? "player" : "enemy",
        victim: e.victim === "player" ? "player" : "enemy",
        key: e.key,
        damage: e.dmg,
        vfx: e.key === "bleed" ? "bleed-tick" : e.key === "poison" ? "poison-tick" : "burn-tick",
      });
    };
    this.SE.tickDots("player", "turnStart", collect);
    this.SE.tickDots("enemy", "turnStart", collect);

    this.SE.onRoundStart(turn, () => {});

    if (turn % 2 === 0) {
      if (this.player._ultimateRuntime__!.cooldown > 0) this.player._ultimateRuntime__!.cooldown--;
      if (this.enemy._ultimateRuntime__!.cooldown > 0) this.enemy._ultimateRuntime__!.cooldown--;
    }
  }

  /** Indica si alguien ya llegó a 0 HP. */
  isCombatOver(): boolean {
    return this.player.currentHP <= 0 || this.enemy.currentHP <= 0;
  }

  /** Devuelve "player", "enemy" o null si hay doble KO. */
  getWinner(): "player" | "enemy" | null {
    if (this.player.currentHP <= 0 && this.enemy.currentHP <= 0) return null;
    if (this.player.currentHP <= 0) return "enemy";
    if (this.enemy.currentHP <= 0) return "player";
    return null;
  }

  /** HPs clampados para UI. */
  public getHPs() {
    return { playerHP: Math.max(0, this.player.currentHP), enemyHP: Math.max(0, this.enemy.currentHP) };
  }

  /** Turno del jugador (sintáctico). */
  playerAttack(): AttackOutput {
    return this.performTurn("player", "enemy");
  }
  /** Turno del enemigo (sintáctico). */
  enemyAttack(): AttackOutput {
    return this.performTurn("enemy", "player");
  }

  /** Núcleo de turno: intenta ulti, si no, golpe básico; agrega eventos de inicio y de acción. */
  private performTurn(attackerKey: SideKey, defenderKey: SideKey): AttackOutput {
    const events: CombatEvent[] = this.pendingStartEvents.splice(0);

    if (this.isCombatOver()) return { damage: 0, flags: { miss: false }, events };

    const A = attackerKey === "player" ? this.player : this.enemy;
    const D = defenderKey === "player" ? this.player : this.enemy;

    const ult = tryUltimate(A, attackerKey, defenderKey, D, this.SE, this.rng, events);
    if (ult) {
      if (this.isCombatOver()) return { damage: ult.damage, flags: { miss: false }, events };
    }

    const basic = performBasicStrike(A, attackerKey, D, defenderKey, this.SE, this.rng, events);

    if (attackerKey === "enemy") {
      this.player._passiveRuntime__ = tickPassive(this.player._passiveRuntime__);
      this.enemy._passiveRuntime__ = tickPassive(this.enemy._passiveRuntime__);
    }

    return { damage: basic.damage, flags: basic.flags, events };
  }
}

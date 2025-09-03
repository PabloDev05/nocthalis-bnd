// src/battleSystem/core/CombatManager.ts
import type { WeaponData } from "./Weapon";
import { isPrimaryWeapon, PRIMARY_WEAPON_BONUS_MULT } from "./Weapon";

export interface ManagerOpts {
  rng?: () => number; // PRNG [0,1)
  seed?: number; // si no hay rng, genera uno determinístico
  maxRounds?: number; // límite de rondas lógicas (pares de ataques)
  blockReduction?: number; // 0.5 => bloquea 50% del daño
  critMultiplierBase?: number; // si el atacante no trae criticalDamageBonus, usar este
  damageJitter?: number; // 0.15 => ±15% de variación de daño
}

const DEBUG_MAN = false;

// ───────────────────────────────────────────────────────────────────────────────
// Constantes de balance (ajustables)
// ───────────────────────────────────────────────────────────────────────────────
const OFFHAND_WEAPON_CONTRIB = 0.35; // 35% del roll de su arma (apoyo)
const OFFHAND_FOCUS_CONTRIB = 0.15; // 15% del roll si es focus (muy leve)
const SHIELD_BLOCK_BONUS = 0.05; // +5% block si el defensor tiene escudo en offhand
const SHIELD_DR_BONUS = 0.03; // +3% DR si el defensor tiene escudo en offhand

// ───────────────────────────────────────────────────────────────────────────────
// Utils
// ───────────────────────────────────────────────────────────────────────────────
const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function makeSeededRng(seed: number): () => number {
  let t = seed >>> 0 || 1;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export type SideKey = "player" | "enemy";

export interface CombatSide {
  name: string;
  className?: string;

  maxHP: number;
  currentHP: number;

  stats?: Record<string, number>;
  resistances?: Record<string, number>;
  equipment?: Record<string, unknown>;

  combat: {
    attackPower: number;
    magicPower: number;
    evasion: number; // 0..1
    blockChance: number; // 0..1
    damageReduction: number; // 0..1
    criticalChance: number; // 0..1
    criticalDamageBonus: number; // 0.5 => +50%
    attackSpeed: number;
    maxHP?: number;
  };

  // Armas normalizadas
  weaponMain?: WeaponData;
  weaponOff?: WeaponData | null;

  // Metadatos de clase (para bonus por arma primaria)
  classMeta?: {
    primaryWeapons?: string[];
  };
}

export interface AttackFlags {
  miss?: boolean;
  blocked?: boolean;
  crit?: boolean;
}
export interface AttackOutput {
  damage: number;
  flags: AttackFlags;
  extra?: { offhandUsed?: boolean };
}

export class CombatManager {
  public player: CombatSide;
  public enemy: CombatSide;

  private rng: () => number;
  private opts: Required<Pick<ManagerOpts, "maxRounds" | "blockReduction" | "critMultiplierBase" | "damageJitter">> & ManagerOpts;

  private rounds = 0;
  private dbgCount = 0;

  constructor(attackerLike: any, defenderLike: any, optsOrSeed?: number | ManagerOpts) {
    this.player = attackerLike as CombatSide;
    this.enemy = defenderLike as CombatSide;

    const defaults = {
      maxRounds: 50,
      blockReduction: 0.5,
      critMultiplierBase: 0.5,
      damageJitter: 0.15,
    };
    const provided: ManagerOpts = typeof optsOrSeed === "number" ? { seed: optsOrSeed } : optsOrSeed ?? {};
    this.rng = provided.rng ?? (typeof provided.seed === "number" ? makeSeededRng(provided.seed) : Math.random);
    this.opts = { ...defaults, ...provided };

    // Seguridad: fists si no hay arma
    this.player.weaponMain = this.player.weaponMain || { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon", hands: 1 };
    this.enemy.weaponMain = this.enemy.weaponMain || { slug: "fists", minDamage: 1, maxDamage: 3, type: "physical", category: "weapon", hands: 1 };
  }

  startRound(turn: number, onStart?: (s: { turn: number; playerHP: number; enemyHP: number }) => void) {
    if (turn % 2 === 1) this.rounds++;
    onStart?.({ turn, playerHP: this.player.currentHP, enemyHP: this.enemy.currentHP });
  }

  playerAttack(): AttackOutput {
    return this.performStrike("player", "enemy");
  }
  enemyAttack(): AttackOutput {
    return this.performStrike("enemy", "player");
  }

  isCombatOver(): boolean {
    if (this.player.currentHP <= 0 || this.enemy.currentHP <= 0) return true;
    if (this.rounds >= this.opts.maxRounds) return true;
    return false;
  }

  getWinner(): "player" | "enemy" | null {
    if (this.player.currentHP <= 0 && this.enemy.currentHP <= 0) return null;
    if (this.player.currentHP <= 0) return "enemy";
    if (this.enemy.currentHP <= 0) return "player";
    return null;
  }

  /** Roll entero según min/max del arma */
  private rollWeapon(w?: WeaponData | null): number {
    if (!w) return 0;
    const lo = Math.max(0, Math.floor((w as any).minDamage || 0));
    const hi = Math.max(lo, Math.floor((w as any).maxDamage || 0));
    if (hi <= lo) return lo;
    return Math.floor(lo + this.rng() * (hi - lo + 1));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Resolución de un golpe
  // ───────────────────────────────────────────────────────────────────────────
  private performStrike(attackerKey: SideKey, defenderKey: SideKey): AttackOutput {
    const A = attackerKey === "player" ? this.player : this.enemy;
    const D = defenderKey === "player" ? this.player : this.enemy;

    // 1) Evasión
    const ev = clamp01(num(D.combat.evasion, 0));
    if (this.rng() < ev) return { damage: 0, flags: { miss: true } };

    // 2) Shield bonuses (defensa por offhand escudo)
    const defHasShield = (D.weaponOff?.category ?? "").toLowerCase() === "shield";
    const blockChanceBase = clamp01(num(D.combat.blockChance, 0));
    const blockChance = clamp01(blockChanceBase + (defHasShield ? SHIELD_BLOCK_BONUS : 0));
    const blocked = this.rng() < blockChance;

    // 3) Crit
    const critChance = clamp01(num(A.combat.criticalChance, 0.05));
    const isCrit = this.rng() < critChance;

    // 4) Daño base por arma principal
    let mainRoll = this.rollWeapon(A.weaponMain);
    // bonus si arma es primaria para la clase
    if (isPrimaryWeapon(A.weaponMain, A.classMeta?.primaryWeapons)) {
      mainRoll = Math.floor(mainRoll * PRIMARY_WEAPON_BONUS_MULT);
    }

    // 5) Aporte de offhand (según categoría)
    let offhandUsed = false;
    let offRollPart = 0;
    if (A.weaponOff) {
      const cat = (A.weaponOff.category ?? "weapon").toLowerCase();
      if (cat === "weapon") {
        const r = this.rollWeapon(A.weaponOff);
        offRollPart = Math.floor(r * OFFHAND_WEAPON_CONTRIB);
        if (offRollPart > 0) offhandUsed = true;
      } else if (cat === "focus") {
        const r = this.rollWeapon(A.weaponOff);
        offRollPart = Math.floor(r * OFFHAND_FOCUS_CONTRIB);
        if (offRollPart > 0) offhandUsed = true;
      }
      // shield => no añade daño
    }

    // 6) AP + variación (jitter)
    let dmg = mainRoll + offRollPart + Math.max(0, Math.floor(num(A.combat.attackPower, 0)));
    const j = clamp01(num(this.opts.damageJitter, 0.15));
    dmg = Math.floor(dmg * (1 - j + this.rng() * (2 * j)));

    // 7) Crítico
    if (isCrit) {
      const baseCrit = Math.max(0, num(A.combat.criticalDamageBonus, this.opts.critMultiplierBase));
      dmg = Math.floor(dmg * (1 + baseCrit));
    }

    // 8) Bloqueo
    if (blocked) dmg = Math.floor(dmg * (1 - this.opts.blockReduction));

    // 9) Reducción de daño (con bonus por escudo)
    const drBase = clamp01(num(D.combat.damageReduction, 0));
    const dr = clamp01(drBase + (defHasShield ? SHIELD_DR_BONUS : 0));
    dmg = Math.floor(dmg * (1 - dr));

    // 10) Aplicar daño
    const finalDmg = Math.max(0, Math.floor(dmg));
    D.currentHP = Math.max(0, D.currentHP - finalDmg);

    if (DEBUG_MAN && this.dbgCount++ < 2) {
      // eslint-disable-next-line no-console
      console.log("[MAN] blocked=", blocked, "crit=", isCrit, "finalDmg=", finalDmg, "D.hp=", D.currentHP);
    }
    return { damage: finalDmg, flags: { miss: false, blocked, crit: isCrit }, extra: { offhandUsed } };
  }
}

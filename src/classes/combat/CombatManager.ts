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
// Utils
// ───────────────────────────────────────────────────────────────────────────────
const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** PRNG determinístico (mulberry32) */
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
}

export interface AttackFlags {
  miss?: boolean;
  blocked?: boolean;
  crit?: boolean;
}
export interface AttackOutput {
  damage: number;
  flags: AttackFlags;
}

// ───────────────────────────────────────────────────────────────────────────────
// Pasivas por clase (suaves, editables)
// ───────────────────────────────────────────────────────────────────────────────
const PassiveTweaks = {
  offensiveStatic: (cls?: string) => {
    const c = (cls || "").toLowerCase();
    return {
      // Mago convierte parte de magicPower a daño base
      magicToDamage: c.includes("mago") ? 0.3 : 0,
      // Asesino: +30% al bono de crítico del atacante
      critBonusAdd: c.includes("asesino") ? 0.3 : 0,
      // Dejo critChanceAdd en 0 para todos (si quisieras, edítalo aquí)
      critChanceAdd: 0,
      damageMult: 1.0,
    };
  },
  defensiveStatic: (cls?: string) => {
    const c = (cls || "").toLowerCase();
    return {
      // Guerrero: más tanque
      damageReductionAdd: c.includes("guerrero") ? 0.05 : 0,
      blockAdd: c.includes("guerrero") ? 0.03 : 0,
      // No doy evasión extra; ya está en los stats base del Asesino/Arquero
    };
  },
};

// ───────────────────────────────────────────────────────────────────────────────
// CombatManager
// ───────────────────────────────────────────────────────────────────────────────
export class CombatManager {
  public player: CombatSide; // atacante
  public enemy: CombatSide; // defensor

  private rng: () => number;
  private opts: Required<Pick<ManagerOpts, "maxRounds" | "blockReduction" | "critMultiplierBase" | "damageJitter">> & ManagerOpts;

  private rounds: number = 0;

  // Ramping por clase (Mago/Arquero): escala con el tiempo
  private ramp: Record<SideKey, { mage: number; archer: number }> = {
    player: { mage: 0, archer: 0 },
    enemy: { mage: 0, archer: 0 },
  };

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
  }

  startRound(turn: number, onStart?: (state: { turn: number; playerHP: number; enemyHP: number }) => void) {
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

  // ───────────────────────────────────────────────────────────────────────────
  // Resolución de un golpe
  // ───────────────────────────────────────────────────────────────────────────
  private performStrike(attackerKey: SideKey, defenderKey: SideKey): AttackOutput {
    const A = attackerKey === "player" ? this.player : this.enemy;
    const D = defenderKey === "player" ? this.player : this.enemy;

    const off = PassiveTweaks.offensiveStatic(A.className);
    const def = PassiveTweaks.defensiveStatic(D.className);

    // Evasión del defensor
    const ev = clamp01(num(D.combat.evasion, 0));
    const rEv = this.rng();
    if (DEBUG_MAN && this.dbgCount < 2) {
      console.log("[MAN] evasion=", ev, "blockChance=", D.combat.blockChance, "critChance=", A.combat.criticalChance, "atk=", A.combat.attackPower, "dr=", D.combat.damageReduction);
      console.log("[MAN] rEv=", rEv);
    }
    if (rEv < ev) {
      this.dbgCount++;
      return { damage: 0, flags: { miss: true } };
    }

    // Block del defensor
    const blockChance = clamp01(num(D.combat.blockChance, 0) + def.blockAdd);
    const blocked = this.rng() < blockChance;

    // Crítico del atacante
    const critChance = clamp01(num(A.combat.criticalChance, 0.05) + off.critChanceAdd);
    const isCrit = this.rng() < critChance;

    // Daño base (AP + % de MP si es mago)
    let dmg = Math.max(0, num(A.combat.attackPower, 0));
    if (off.magicToDamage > 0) {
      dmg += off.magicToDamage * Math.max(0, num(A.combat.magicPower, 0));
    }

    // Variación ±jitter
    const j = clamp01(num(this.opts.damageJitter, 0.15));
    const jitter = 1 - j + this.rng() * (2 * j); // [1-j, 1+j]
    dmg *= jitter;

    // Crítico
    if (isCrit) {
      const baseCrit = Math.max(0, num(A.combat.criticalDamageBonus, this.opts.critMultiplierBase));
      dmg *= 1 + baseCrit + off.critBonusAdd; // Asesino +30% aquí
    }

    // Mitigación por bloqueo
    if (blocked) {
      dmg *= 1 - this.opts.blockReduction;
    }

    // Reducción de daño del defensor (Guerrero +5% adicional)
    let dr = clamp01(num(D.combat.damageReduction, 0) + def.damageReductionAdd);
    dmg *= 1 - dr;

    // ── RAMPING por clase del atacante ────────────────────────────────────────
    const cls = (A.className || "").toLowerCase();
    let rampMult = 1;
    if (cls.includes("mago")) {
      this.ramp[attackerKey].mage++;
      const bonus = Math.min(0.1, 0.02 * this.ramp[attackerKey].mage); // +2% por ataque, máx +10%
      rampMult *= 1 + bonus;
    }
    if (cls.includes("arquero")) {
      this.ramp[attackerKey].archer++;
      const bonus = Math.min(0.075, 0.015 * this.ramp[attackerKey].archer); // +1.5% por ataque, máx +7.5%
      rampMult *= 1 + bonus;
    }
    dmg *= rampMult;

    // Multiplicador ofensivo estático (si definís alguno)
    dmg *= off.damageMult;

    const finalDmg = Math.max(0, Math.floor(dmg));
    D.currentHP = Math.max(0, D.currentHP - finalDmg);

    if (DEBUG_MAN && this.dbgCount < 2) {
      console.log("[MAN] blocked=", blocked, "crit=", isCrit, "finalDmg=", finalDmg, "D.hp=", D.currentHP);
      this.dbgCount++;
    }
    return { damage: finalDmg, flags: { miss: false, blocked, crit: isCrit } };
  }
}

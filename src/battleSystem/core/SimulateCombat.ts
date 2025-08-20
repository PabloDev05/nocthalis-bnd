// src/battleSystem/core/SimulateCombat.ts
const DBG = process.env.DEBUG_COMBAT === "1";

import { PlayerCharacter } from "../entities/PlayerCharacter";
import { EnemyBot } from "../entities/EnemyBot";
import { CombatManager } from "./CombatManager";
import { mulberry32 } from "../core/RngFightSeed";

import { applyPassivesToBlocks, collectPassivesForCharacter } from "../passives/PassiveEffects";
import { buildClassPassivePack } from "../passives/ClassPacks";

import { baseStatsGuerrero, resistenciasGuerrero, combatStatsGuerrero, baseStatsEnemigo, resistenciasEnemigo, combatStatsEnemigo } from "../fixtures/Fixtures";

export type SimMode = "fixtures" | "real-preview" | "real";

export interface SimulateParams {
  mode?: SimMode;
  player?: any;
  enemy?: any;
  useConsumables?: boolean;
  skills?: string[];
  seed?: number;
}

export type StatusPublic = { key: string; stacks: number; turnsLeft: number };

export type CombatSnapshot = {
  round: number;
  actor: "player" | "enemy";
  damage: number;
  playerHP: number;
  enemyHP: number;
  events: string[]; // p.ej. ["player:attack","player:hit","enemy:block"]
  // status?: { player: StatusPublic[]; enemy: StatusPublic[] }; // <-- si más adelante expones estado público, lo reactivas
};

export interface SimulateResult {
  winner: "player" | "enemy";
  turns: number;
  log: string[];
  snapshots: CombatSnapshot[];
}

// -------------------------- helpers -----------------------------------------

function obj(o: any, fallback: any) {
  if (!o || typeof o !== "object") return { ...fallback };
  return { ...fallback, ...o };
}

function ensurePlayer(pcLike: any): { pc: PlayerCharacter; className?: string | null } {
  if (pcLike instanceof PlayerCharacter) {
    const className = (pcLike as any)?.className ?? null;
    if (DBG) console.log("[SIM] ensurePlayer: ya es instancia", { className });
    return { pc: pcLike, className };
  }

  const id = String(pcLike?.id || pcLike?._id || "p1");
  const name = String(pcLike?.name || pcLike?.username || "Jugador");
  const level = Number(pcLike?.level ?? 1);

  const statsBase = obj(pcLike?.stats, baseStatsGuerrero);
  const res = obj(pcLike?.resistances, resistenciasGuerrero);
  const cmbBase = obj(pcLike?.combatStats, combatStatsGuerrero);

  const className: string | null = pcLike?.classId && typeof pcLike.classId === "object" && "name" in pcLike.classId ? (pcLike.classId as any).name : pcLike?.className ?? null;

  const flatPassives = collectPassivesForCharacter(pcLike);
  const { stats, combatStats } = applyPassivesToBlocks(statsBase, cmbBase, flatPassives);

  const pc = new PlayerCharacter(id, name, level, stats, res, combatStats);
  (pc as any).className = className;
  return { pc, className };
}

function ensureEnemy(ebLike: any): { eb: EnemyBot; className?: string | null } {
  if (ebLike instanceof EnemyBot) {
    const className = (ebLike as any)?.className ?? null;
    if (DBG) console.log("[SIM] ensureEnemy: ya es instancia", { className });
    return { eb: ebLike, className };
  }

  const id = String(ebLike?.id || ebLike?._id || "e1");
  const name = String(ebLike?.name || "Enemigo");
  const level = Number(ebLike?.level ?? 1);

  const stats = obj(ebLike?.stats, baseStatsEnemigo);
  const res = obj(ebLike?.resistances, resistenciasEnemigo);
  const cmb = obj(ebLike?.combatStats, combatStatsEnemigo);

  const eb = new EnemyBot(id, name, level, stats, res, cmb);
  const className: string | null = ebLike?.className ?? null;
  (eb as any).className = className;
  return { eb, className };
}

// --------------------------- main -------------------------------------------

export async function simulateCombat(params: SimulateParams = {}): Promise<SimulateResult> {
  const mode: SimMode = params.mode ?? "fixtures";
  const rng = typeof params.seed === "number" ? mulberry32(params.seed) : Math.random;

  if (DBG) console.log("[SIM] Iniciando simulateCombat:", { mode, seed: params.seed });

  const log: string[] = [];
  const snapshots: CombatSnapshot[] = [];

  let player: PlayerCharacter;
  let enemy: EnemyBot;
  let playerClassName: string | null = null;
  let enemyClassName: string | null = null;

  if (mode === "fixtures") {
    player = new PlayerCharacter("p1", "Jugador Guerrero", 1, baseStatsGuerrero, resistenciasGuerrero, combatStatsGuerrero);
    (player as any).className = "Guerrero";
    enemy = new EnemyBot("e1", "Rata Gigante", 1, baseStatsEnemigo, resistenciasEnemigo, combatStatsEnemigo);
  } else {
    const p = ensurePlayer(params.player);
    player = p.pc;
    playerClassName = p.className ?? null;

    const e = ensureEnemy(params.enemy);
    enemy = e.eb;
    enemyClassName = e.className ?? null;
  }

  // Packs de clase (por ahora NO se inyectan al manager porque el core no los consume aún)
  const pPack = buildClassPassivePack(playerClassName || (player as any).className || null);
  const ePack = buildClassPassivePack(enemyClassName || (enemy as any).className || null);
  if (DBG) {
    console.log("[SIM] class hooks:", {
      playerClass: (player as any).className || null,
      enemyClass: (enemy as any).className || null,
      pHooks: !!pPack.hooks,
      eHooks: !!ePack.hooks,
    });
  }

  // ⚠️ Manager core actual NO acepta playerHooks/enemyHooks en options
  const manager = new CombatManager(player, enemy, { rng });

  let round = 1;

  log.push("⚔️ Inicio del combate ⚔️");
  log.push(`${player.name} (HP: ${player.currentHP}) VS ${enemy.name} (HP: ${enemy.currentHP})`);
  log.push("======================================");

  while (!manager.isCombatOver() && round <= 200) {
    if (DBG) console.log("[SIM] >>> Ronda", round);

    manager.startRound(round, () => {}); // mantenemos la señal de inicio si el core la usa
    log.push(`🔄 Ronda ${round}`);

    // --- Turno del jugador
    const outP = manager.playerAttack();
    const pEvents: string[] = ["player:attack"];
    if (outP.flags.miss) pEvents.push("player:miss");
    else {
      if (outP.flags.crit) pEvents.push("player:crit");
      if (outP.flags.blocked) pEvents.push("enemy:block");
      pEvents.push("player:hit", "player:hit:physical");
    }
    log.push(`🗡️ ${player.name} ataca e inflige ${outP.damage} de daño.`);
    log.push(`💔 ${enemy.name} HP restante: ${Math.max(0, enemy.currentHP)}`);
    snapshots.push({
      round,
      actor: "player",
      damage: outP.damage,
      playerHP: Math.max(0, player.currentHP),
      enemyHP: Math.max(0, enemy.currentHP),
      events: pEvents,
      // status: undefined,
    });
    if (manager.isCombatOver()) break;

    // --- Turno del enemigo
    const outE = manager.enemyAttack();
    const eEvents: string[] = ["enemy:attack"];
    if (outE.flags.miss) eEvents.push("enemy:miss");
    else {
      if (outE.flags.crit) eEvents.push("enemy:crit");
      if (outE.flags.blocked) eEvents.push("player:block");
      eEvents.push("enemy:hit", "enemy:hit:physical");
    }
    log.push(`⚡ ${enemy.name} ataca e inflige ${outE.damage} de daño.`);
    log.push(`💔 ${player.name} HP restante: ${Math.max(0, player.currentHP)}`);
    snapshots.push({
      round,
      actor: "enemy",
      damage: outE.damage,
      playerHP: Math.max(0, player.currentHP),
      enemyHP: Math.max(0, enemy.currentHP),
      events: eEvents,
      // status: undefined,
    });

    round++;
  }

  log.push("🏁 Fin del combate 🏁");
  const raw = (player.currentHP <= 0 ? "enemy" : enemy.currentHP <= 0 ? "player" : null) as "player" | "enemy" | null;
  const winner: "player" | "enemy" = raw ?? (enemy.currentHP <= 0 ? "player" : "enemy");
  log.push(`🥇 Ganador: ${winner === "player" ? player.name : enemy.name}`);

  if (DBG) console.log("[SIM] Fin combate:", { winner, rounds: round, snapshots: snapshots.length });

  return { winner, turns: round, log, snapshots };
}

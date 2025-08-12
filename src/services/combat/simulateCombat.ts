// src/services/combat/simulateCombat.ts
// Simulador de combate por turnos: arma Player/Enemy, inyecta hooks por clase,
// corre el CombatManager y devuelve log + snapshots (con eventos y estados).
// Incluye soporte de seed para RNG reproducible.
// Nota: no usamos MP/mana en ningún cálculo; si existe en el modelo, se ignora.

const DBG = process.env.DEBUG_COMBAT === "1";

import { PlayerCharacter } from "../../classes/combat/PlayerCharacter";
import { EnemyBot } from "../../classes/combat/EnemyBot";
import { CombatManager } from "../../classes/combat/CombatManager";
import { mulberry32 } from "../../classes/combat/RngFightSeed";

import { applyPassivesToBlocks, collectPassivesForCharacter } from "../../utils/passives";
import { buildClassPassivePack } from "../../classes/combat/passives/classPacks";

// Fixtures por si querés probar rápido (modo "fixtures")
import { baseStatsGuerrero, resistenciasGuerrero, combatStatsGuerrero, baseStatsEnemigo, resistenciasEnemigo, combatStatsEnemigo } from "../../classes/combat/Fixtures";

export type SimMode = "fixtures" | "real-preview" | "real";

export interface SimulateParams {
  mode?: SimMode;
  player?: any; // POJO/lean de Character o instancia PlayerCharacter
  enemy?: any; // POJO/lean de Enemy o instancia EnemyBot
  useConsumables?: boolean; // reservado para futuro
  skills?: string[]; // reservado para futuro
  seed?: number; // RNG reproducible
}

export type StatusPublic = { key: string; stacks: number; turnsLeft: number };

export type CombatSnapshot = {
  round: number;
  actor: "player" | "enemy";
  damage: number;
  playerHP: number;
  enemyHP: number;
  events: string[]; // ej: ["player:attack","player:hit","player:crit","enemy:block",...]
  status?: {
    player: StatusPublic[];
    enemy: StatusPublic[];
  };
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

/**
 * Construye PlayerCharacter desde POJO o instancia.
 * - Aplica pasivas planas provenientes de DB (p.ej. "Sombra Letal": +30% CDB).
 * - Setea className en la instancia (lo usan hooks de clase y el motor p/ tipo de daño).
 */
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

  // className si classId viene populado { name }, o si ya trae className
  const className: string | null = pcLike?.classId && typeof pcLike.classId === "object" && "name" in pcLike.classId ? (pcLike.classId as any).name : pcLike?.className ?? null;

  // Pasivas planas desde DB (o fallback por clase)
  const flatPassives = collectPassivesForCharacter(pcLike);
  const { stats, combatStats } = applyPassivesToBlocks(statsBase, cmbBase, flatPassives);

  if (DBG) {
    console.log("[SIM] ensurePlayer:", {
      id,
      name,
      level,
      className,
      flatPassives: flatPassives.map((p) => p.name),
    });
  }

  const pc = new PlayerCharacter(id, name, level, stats, res, combatStats);
  (pc as any).className = className; // usado por hooks y por el tipo de daño

  return { pc, className };
}

/**
 * Construye EnemyBot desde POJO o instancia.
 * Podés setear enemy.className si querés hooks por clase también para enemigos.
 */
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

  if (DBG) console.log("[SIM] ensureEnemy:", { id, name, level, className });
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
    // Caso demo: Guerrero vs Rata
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

  // 🔌 HOOKS por clase (player y enemigo)
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

  const manager = new CombatManager(player, enemy, {
    rng,
    playerHooks: pPack.hooks ?? null,
    enemyHooks: ePack.hooks ?? null, // si no querés hooks del enemigo, poné null
  });

  let round = 1;

  log.push("⚔️ Inicio del combate ⚔️");
  log.push(`${player.name} (HP: ${player.currentHP}) VS ${enemy.name} (HP: ${enemy.currentHP})`);
  log.push("======================================");

  while (!manager.isCombatOver() && round <= 200) {
    if (DBG) console.log("[SIM] >>> Ronda", round);

    // Inicio de ronda: hooks + expiración de estados
    const roundEvents: string[] = [];
    manager.startRound(round, (ev) => roundEvents.push(ev));
    if (roundEvents.length && DBG) console.log("[SIM] Eventos de inicio de ronda:", roundEvents);

    log.push(`🔄 Ronda ${round}`);

    // Turno del jugador
    const outP = manager.playerAttack();
    log.push(`🗡️ ${player.name} ataca e inflige ${outP.damage} de daño.`);
    log.push(`💔 ${enemy.name} HP restante: ${Math.max(0, enemy.currentHP)}`);
    const st1 = manager.getStatusPublicState();
    snapshots.push({
      round,
      actor: "player",
      damage: outP.damage,
      playerHP: Math.max(0, player.currentHP),
      enemyHP: Math.max(0, enemy.currentHP),
      events: [
        ...roundEvents, // eventos de inicio de ronda (buffs/estados)
        ...(outP.flags.miss ? ["player:miss"] : []),
        ...(outP.flags.crit ? ["player:crit"] : []),
        ...(outP.flags.blocked ? ["enemy:block"] : []),
        ...outP.events, // eventos del CM (attack, hit, weapon, etc.)
      ],
      status: st1,
    });
    if (DBG) console.log("[SIM] Snapshot jugador:", snapshots[snapshots.length - 1]);
    if (manager.isCombatOver()) break;

    // Turno del enemigo
    const outE = manager.enemyAttack();
    log.push(`⚡ ${enemy.name} ataca e inflige ${outE.damage} de daño.`);
    log.push(`💔 ${player.name} HP restante: ${Math.max(0, player.currentHP)}`);
    const st2 = manager.getStatusPublicState();
    snapshots.push({
      round,
      actor: "enemy",
      damage: outE.damage,
      playerHP: Math.max(0, player.currentHP),
      enemyHP: Math.max(0, enemy.currentHP),
      events: [...(outE.flags.miss ? ["enemy:miss"] : []), ...(outE.flags.crit ? ["enemy:crit"] : []), ...(outE.flags.blocked ? ["player:block"] : []), ...outE.events],
      status: st2,
    });
    if (DBG) console.log("[SIM] Snapshot enemigo:", snapshots[snapshots.length - 1]);

    round++;
  }

  log.push("🏁 Fin del combate 🏁");
  const raw = (player.currentHP <= 0 ? "enemy" : enemy.currentHP <= 0 ? "player" : null) as "player" | "enemy" | null;
  const winner: "player" | "enemy" = raw ?? (enemy.currentHP <= 0 ? "player" : "enemy");
  log.push(`🥇 Ganador: ${winner === "player" ? player.name : enemy.name}`);

  if (DBG) console.log("[SIM] Fin combate:", { winner, rounds: round, snapshots: snapshots.length });

  return { winner, turns: round, log, snapshots };
}

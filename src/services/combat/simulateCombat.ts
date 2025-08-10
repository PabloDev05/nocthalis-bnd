// Adaptador: usa tu motor POO (PlayerCharacter, EnemyBot, CombatManager)
// Soporta "fixtures" (pruebas) y "real/real-preview" (datos desde DB o builders).
import { PlayerCharacter } from "../../classes/combat/PlayerCharacter";
import { EnemyBot } from "../../classes/combat/EnemyBot";
import { CombatManager } from "../../classes/combat/CombatManager";

// Fixtures actuales
import { baseStatsGuerrero, resistenciasGuerrero, combatStatsGuerrero, baseStatsEnemigo, resistenciasEnemigo, combatStatsEnemigo } from "../../classes/combat/Fixtures";

export type SimMode = "fixtures" | "real-preview" | "real";

export interface SimulateParams {
  mode?: SimMode; // default: "fixtures"
  player?: any; // POJO o instancia PlayerCharacter (ambos sirven)
  enemy?: any; // POJO o instancia EnemyBot
  useConsumables?: boolean;
  skills?: string[];
  seed?: number;
}

export interface SimulateResult {
  winner: "player" | "enemy";
  turns: number;
  log: string[];
}

function obj(o: any, fallback: any) {
  if (!o || typeof o !== "object") return { ...fallback };
  return { ...fallback, ...o };
}

function ensurePlayer(pcLike: any): PlayerCharacter {
  if (pcLike instanceof PlayerCharacter) return pcLike;

  const id = String(pcLike?.id || pcLike?._id || "p1");
  const name = String(pcLike?.name || pcLike?.username || "Jugador");
  const level = Number(pcLike?.level ?? 1);

  const stats = obj(pcLike?.stats, baseStatsGuerrero);
  const res = obj(pcLike?.resistances, resistenciasGuerrero);
  const cmb = obj(pcLike?.combatStats, combatStatsGuerrero);

  return new PlayerCharacter(id, name, level, stats, res, cmb);
}

function ensureEnemy(ebLike: any): EnemyBot {
  if (ebLike instanceof EnemyBot) return ebLike;

  const id = String(ebLike?.id || ebLike?._id || "e1");
  const name = String(ebLike?.name || "Enemigo");
  const level = Number(ebLike?.level ?? 1);

  const stats = obj(ebLike?.stats, baseStatsEnemigo);
  const res = obj(ebLike?.resistances, resistenciasEnemigo);
  const cmb = obj(ebLike?.combatStats, combatStatsEnemigo);

  return new EnemyBot(id, name, level, stats, res, cmb);
}

export async function simulateCombat(params: SimulateParams = {}): Promise<SimulateResult> {
  const mode: SimMode = params.mode ?? "fixtures";
  const log: string[] = [];

  let player: PlayerCharacter;
  let enemy: EnemyBot;

  if (mode === "fixtures") {
    player = new PlayerCharacter("p1", "Jugador Guerrero", 1, baseStatsGuerrero, resistenciasGuerrero, combatStatsGuerrero);
    enemy = new EnemyBot("e1", "Rata Gigante", 1, baseStatsEnemigo, resistenciasEnemigo, combatStatsEnemigo);
  } else {
    player = ensurePlayer(params.player);
    enemy = ensureEnemy(params.enemy);
  }

  const manager = new CombatManager(player, enemy);
  let round = 1;

  log.push("⚔️ Inicio del combate ⚔️");
  log.push(`${player.name} (HP: ${player.currentHP}) VS ${enemy.name} (HP: ${enemy.currentHP})`);
  log.push("======================================");

  while (!manager.isCombatOver() && round <= 200) {
    log.push(`🔄 Ronda ${round}`);

    const dmgToEnemy = manager.playerAttack();
    log.push(`🗡️ ${player.name} ataca e inflige ${dmgToEnemy} de daño.`);
    log.push(`💔 ${enemy.name} HP restante: ${Math.max(0, enemy.currentHP)}`);
    if (manager.isCombatOver()) break;

    const dmgToPlayer = manager.enemyAttack();
    log.push(`⚡ ${enemy.name} ataca e inflige ${dmgToPlayer} de daño.`);
    log.push(`💔 ${player.name} HP restante: ${Math.max(0, player.currentHP)}`);

    round++;
  }

  log.push("🏁 Fin del combate 🏁");

  const raw = manager.getWinner() as "player" | "enemy" | null;
  const winner: "player" | "enemy" = raw ?? (enemy.currentHP <= 0 ? "player" : "enemy");

  log.push(`🥇 Ganador: ${winner === "player" ? player.name : enemy.name}`);

  return { winner, turns: round, log };
}

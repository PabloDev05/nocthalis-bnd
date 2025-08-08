import { PlayerCharacter } from "../../classes/combat/PlayerCharacter";
import { EnemyBot } from "../../classes/combat/EnemyBot";
import { CombatManager } from "../../classes/combat/CombatManager";

// 📌 Datos temporales para pruebas (luego vendrán de la BD)
import { baseStatsGuerrero, resistenciasGuerrero, combatStatsGuerrero, baseStatsEnemigo, resistenciasEnemigo, combatStatsEnemigo } from "../../classes/combat/Fixtures";

/**
 * Simula un combate entre un jugador y un enemigo.
 * Retorna el ganador y un log de acciones para que el controlador pueda responder.
 */
export function simulateCombat() {
  const player = new PlayerCharacter("p1", "Jugador Guerrero", 1, baseStatsGuerrero, resistenciasGuerrero, combatStatsGuerrero);
  const enemy = new EnemyBot("e1", "Rata Gigante", 1, baseStatsEnemigo, resistenciasEnemigo, combatStatsEnemigo);

  const manager = new CombatManager(player, enemy);

  let round = 1;
  const log: string[] = []; // 🔹 Registro turno a turno

  log.push("⚔️ Inicio del combate ⚔️");
  log.push(`${player.name} (HP: ${player.currentHP}) VS ${enemy.name} (HP: ${enemy.currentHP})`);
  log.push("======================================");

  while (!manager.isCombatOver()) {
    log.push(`🔄 Ronda ${round}`);

    // Turno del jugador
    const dmgToEnemy = manager.playerAttack();
    log.push(`🗡️ ${player.name} ataca e inflige ${dmgToEnemy} de daño.`);
    log.push(`💔 ${enemy.name} HP restante: ${enemy.currentHP}`);

    if (manager.isCombatOver()) break;

    // Turno del enemigo
    const dmgToPlayer = manager.enemyAttack();
    log.push(`⚡ ${enemy.name} ataca e inflige ${dmgToPlayer} de daño.`);
    log.push(`💔 ${player.name} HP restante: ${player.currentHP}`);

    round++;
  }

  log.push("🏁 Fin del combate 🏁");
  const winner = manager.getWinner();
  log.push(`🥇 Ganador: ${winner === "player" ? player.name : enemy.name}`);

  // 🔹 Ahora devolvemos un objeto para que el controlador pueda acceder a `winner` y `log`
  return { winner, log };
}

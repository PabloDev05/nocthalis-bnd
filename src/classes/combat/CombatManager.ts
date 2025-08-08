import { CombatEntity } from "../../interfaces/combat/CombatEntity";

export class CombatManager {
  constructor(private player: CombatEntity, private enemy: CombatEntity) {}

  calculateDamage(attacker: CombatEntity, defender: CombatEntity): number {
    const base = attacker.combatStats.attackPower;
    const reduction = defender.combatStats.damageReduction || 0;
    const rawDamage = Math.max(0, base * (1 - reduction / 100));
    return Math.floor(rawDamage);
  }

  playerAttack(): number {
    const dmg = this.calculateDamage(this.player, this.enemy);
    this.enemy.takeDamage(dmg);
    return dmg;
  }

  enemyAttack(): number {
    const dmg = this.calculateDamage(this.enemy, this.player);
    this.player.takeDamage(dmg);
    return dmg;
  }

  isCombatOver(): boolean {
    return !this.player.isAlive() || !this.enemy.isAlive();
  }

  getWinner(): "player" | "enemy" | null {
    if (!this.player.isAlive()) return "enemy";
    if (!this.enemy.isAlive()) return "player";
    return null;
  }
}

import { Character } from "../../models/Character";
import { Enemy } from "../../models/Enemy";
import { PlayerCharacter } from "../../classes/combat/PlayerCharacter";
import { EnemyBot } from "../../classes/combat/EnemyBot";

export async function buildPlayerCharacter(userId: string) {
  const c = await Character.findOne({ userId });
  if (!c) throw new Error("Character not found for user");
  return new PlayerCharacter(
    String(c._id),
    "Player",
    c.level,
    c.stats as any,
    c.resistances as any,
    c.combatStats!, // asumimos creado al elegir clase
    c.combatStats?.maxHP ?? 1
  );
}

export async function buildEnemyById(enemyId: string) {
  const e = await Enemy.findById(enemyId);
  if (!e) throw new Error("Enemy not found");
  return new EnemyBot(String(e._id), e.name, e.level, e.stats as any, e.resistances as any, e.combatStats, e.combatStats.maxHP);
}

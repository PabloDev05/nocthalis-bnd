// src/services/enemy.service.ts
import { Enemy } from "../models/Enemy";
import type { EnemyLean } from "../types/lean";

/**
 * Devuelve un Enemy lean (con _id:ObjectId) y le agrega id:string para el JSON.
 * Incluye stats/resistances/combatStats por si tu motor los usa.
 */
export async function findEnemyByIdLean(id: string): Promise<(EnemyLean & { id: string }) | null> {
  const doc = await Enemy.findById(id).select("_id name level tier bossType xpReward goldReward dropProfile stats resistances combatStats").lean<EnemyLean>().exec();

  if (!doc) return null;
  return { ...doc, id: doc._id.toString() };
}

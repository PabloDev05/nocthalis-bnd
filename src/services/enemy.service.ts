import { Types } from "mongoose";
import { Enemy } from "../models/Enemy";
import type { EnemyLean } from "../types/lean";

/** Campos públicos que usamos en motor/UI */
const ENEMY_PUBLIC_PROJECTION = "_id name level tier bossType xpReward goldReward dropProfile stats resistances combatStats";

/**
 * Devuelve un Enemy plano (lean) y agrega id:string.
 * Si id no es válido o no existe, retorna null.
 */
export async function findEnemyByIdLean(id: string): Promise<(Omit<EnemyLean, "_id"> & { id: string }) | null> {
  if (!id || !Types.ObjectId.isValid(id)) return null;

  const doc = await Enemy.findById(id).select(ENEMY_PUBLIC_PROJECTION).lean<EnemyLean>().exec();

  if (!doc) return null;

  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
}

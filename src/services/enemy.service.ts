// src/services/enemy.service.ts
import { Types } from "mongoose";
import { Enemy } from "../models/Enemy";
import type { EnemyLean } from "../types/lean";

/** Campos públicos que usamos en motor/UI */
export const ENEMY_PUBLIC_PROJECTION = "_id name level tier bossType xpReward goldReward dropProfile stats resistances combatStats";

/** DTO que devolvemos hacia fuera (id en string, sin _id) */
export type EnemyDTO = Omit<EnemyLean, "_id"> & { id: string };

/** Utilidad local */
const isObjId = (s?: string) => !!s && Types.ObjectId.isValid(String(s));

/**
 * Devuelve un Enemy plano (lean) y agrega id:string.
 * Si id no es válido o no existe, retorna null.
 */
export async function findEnemyByIdLean(id: string): Promise<EnemyDTO | null> {
  if (!isObjId(id)) return null;

  const doc = await Enemy.findById(id).select(ENEMY_PUBLIC_PROJECTION).lean<EnemyLean>().exec();

  if (!doc) return null;

  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

/**
 * Batch: trae varios enemigos por sus IDs válidos (ignora inválidos/ausentes).
 * Útil para armar listas o precargar combates.
 */
export async function findEnemiesByIdsLean(ids: string[]): Promise<EnemyDTO[]> {
  const valid = (ids || []).filter(isObjId);
  if (!valid.length) return [];

  const rows = await Enemy.find({ _id: { $in: valid } })
    .select(ENEMY_PUBLIC_PROJECTION)
    .lean<EnemyLean[]>()
    .exec();

  return rows.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: String(_id) };
  });
}

/**
 * Listado simple con filtros comunes.
 * Todos los filtros son opcionales; `limit` por defecto 50 (clamp 1..200).
 */
export async function listEnemiesLean(params?: { tier?: number; minLevel?: number; maxLevel?: number; bossType?: string; limit?: number }): Promise<EnemyDTO[]> {
  const q: Record<string, any> = {};
  if (typeof params?.tier === "number") q.tier = params.tier;
  if (params?.bossType) q.bossType = params.bossType;

  if (typeof params?.minLevel === "number" || typeof params?.maxLevel === "number") {
    q.level = {};
    if (typeof params.minLevel === "number") q.level.$gte = params.minLevel;
    if (typeof params.maxLevel === "number") q.level.$lte = params.maxLevel;
  }

  const limit = Math.max(1, Math.min(200, Number(params?.limit ?? 50)));

  const rows = await Enemy.find(q).select(ENEMY_PUBLIC_PROJECTION).sort({ level: 1, tier: 1, name: 1 }).limit(limit).lean<EnemyLean[]>().exec();

  return rows.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: String(_id) };
  });
}

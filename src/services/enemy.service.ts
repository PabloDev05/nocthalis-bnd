// src/services/enemy.service.ts
import { Types } from "mongoose";
import { Enemy } from "../models/Enemy";
import type { EnemyLean } from "../types/lean";
import { RESISTANCE_KEYS, clampRes } from "../battleSystem/constants/resistances";

/** Campos públicos que usamos en motor/UI */
export const ENEMY_PUBLIC_PROJECTION = "_id name level tier bossType xpReward goldReward dropProfile stats resistances combatStats";

/** DTO que devolvemos hacia fuera (id en string, sin _id) */
export type EnemyDTO = Omit<EnemyLean, "_id"> & { id: string };

/** Utilidad local */
const isObjId = (s?: string) => !!s && Types.ObjectId.isValid(String(s));

const toInt = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
};

/** Normaliza bloques numéricos: enteros; resistencias 0..100. */
function sanitizeEnemy(doc: EnemyLean): EnemyDTO {
  const { _id, stats, resistances, combatStats, ...rest } = doc;

  // stats: trunc plano de todo valor numérico
  const statsOut: Record<string, number> = {};
  Object.entries(stats || {}).forEach(([k, v]) => {
    statsOut[k] = toInt(v, 0);
  });

  // resistencias: asegurar todas las claves y clamp 0..100
  const resOut: Record<string, number> = {};
  for (const k of RESISTANCE_KEYS) {
    resOut[k] = clampRes(toInt((resistances as any)?.[k], 0));
  }

  // combatStats: trunc de campos conocidos (en puntos % o planos)
  const cmbIn: any = combatStats || {};
  const cmbOut = {
    maxHP: toInt(cmbIn.maxHP, 1),
    attackPower: toInt(cmbIn.attackPower, 0),
    magicPower: toInt(cmbIn.magicPower, 0),
    criticalChance: toInt(cmbIn.criticalChance, 0),
    criticalDamageBonus: toInt(cmbIn.criticalDamageBonus, 0),
    evasion: toInt(cmbIn.evasion, 0),
    blockChance: toInt(cmbIn.blockChance, 0),
    blockValue: toInt(cmbIn.blockValue, 0),
    lifeSteal: toInt(cmbIn.lifeSteal, 0),
    damageReduction: toInt(cmbIn.damageReduction, 0),
    movementSpeed: toInt(cmbIn.movementSpeed, 0),
  };

  return {
    ...rest,
    id: String(_id),
    stats: statsOut as any,
    resistances: resOut as any,
    combatStats: cmbOut as any,
  };
}

/**
 * Devuelve un Enemy plano (lean) y agrega id:string, con bloques saneados.
 * Si id no es válido o no existe, retorna null.
 */
export async function findEnemyByIdLean(id: string): Promise<EnemyDTO | null> {
  if (!isObjId(id)) return null;

  const doc = await Enemy.findById(id).select(ENEMY_PUBLIC_PROJECTION).lean<EnemyLean>().exec();

  if (!doc) return null;
  return sanitizeEnemy(doc);
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

  return rows.map(sanitizeEnemy);
}

/**
 * Listado simple con filtros comunes.
 * Todos los filtros son opcionales; `limit` por defecto 50 (clamp 1..200).
 */
export async function listEnemiesLean(params?: {
  tier?: string; // ← en tus seeds lo manejás string
  minLevel?: number;
  maxLevel?: number;
  bossType?: string;
  limit?: number;
}): Promise<EnemyDTO[]> {
  const q: Record<string, any> = {};
  if (typeof params?.tier === "string" && params.tier) q.tier = params.tier;
  if (params?.bossType) q.bossType = params.bossType;

  if (typeof params?.minLevel === "number" || typeof params?.maxLevel === "number") {
    q.level = {};
    if (typeof params.minLevel === "number") q.level.$gte = params.minLevel;
    if (typeof params.maxLevel === "number") q.level.$lte = params.maxLevel;
  }

  const limit = Math.max(1, Math.min(200, Number(params?.limit ?? 50)));

  const rows = await Enemy.find(q).select(ENEMY_PUBLIC_PROJECTION).sort({ level: 1, tier: 1, name: 1 }).limit(limit).lean<EnemyLean[]>().exec();

  return rows.map(sanitizeEnemy);
}

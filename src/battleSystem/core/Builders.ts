// src/battleSystem/factories/buildCombatEntities.ts
import { Types } from "mongoose";
import { Character } from "../../models/Character";
import { Enemy } from "../../models/Enemy";
import { PlayerCharacter } from "../entities/PlayerCharacter";
import { EnemyBot } from "../entities/EnemyBot";
import type { CharacterForBattleLean, EnemyForBattleLean, Stats, Resistances, CombatStats } from "../../types/lean";

const DEF_STATS: Stats = {
  strength: 0,
  dexterity: 0,
  intelligence: 0,
  vitality: 0,
  physicalDefense: 0,
  magicalDefense: 0,
  luck: 0,
  endurance: 0,
  fate: 0, // ✅ faltaba este campo requerido por Stats
};

const DEF_RES: Resistances = {
  fire: 0,
  ice: 0,
  lightning: 0,
  poison: 0,
  sleep: 0,
  paralysis: 0,
  confusion: 0,
  fear: 0,
  dark: 0,
  holy: 0,
  stun: 0,
  bleed: 0,
  curse: 0,
  knockback: 0,
  criticalChanceReduction: 0,
  criticalDamageReduction: 0,
};

const DEF_COMBAT: CombatStats = {
  maxHP: 100,
  attackPower: 10,
  magicPower: 5,
  criticalChance: 5,
  criticalDamageBonus: 25,
  attackSpeed: 5,
  evasion: 5,
  blockChance: 0,
  blockValue: 0,
  lifeSteal: 0,
  damageReduction: 0,
  movementSpeed: 5,
};

function mergeDefaults<T extends object>(src: Partial<T> | undefined, defaults: T): T {
  return { ...defaults, ...(src ?? {}) } as T;
}

/**
 * Construye un PlayerCharacter POO desde:
 *  - characterId (preferido), o
 *  - userId (si coincide con el _id del User), ambos deben ser ObjectId válidos.
 * En DEV, si `id` viene vacío/null, toma el primer Character encontrado.
 */
export async function buildPlayerCharacter(id?: string) {
  let c: CharacterForBattleLean | null = null;

  if (!id) {
    // modo DEV/seed: toma el primero que haya
    c = await Character.findOne().select("_id level stats resistances combatStats name username").lean<CharacterForBattleLean>().exec();
  } else if (Types.ObjectId.isValid(id)) {
    // 1) intentar por characterId
    c = await Character.findById(id).select("_id level stats resistances combatStats name username").lean<CharacterForBattleLean>().exec();

    // 2) si no hay, intentar por userId == id
    if (!c) {
      c = await Character.findOne({ userId: new Types.ObjectId(id) })
        .select("_id level stats resistances combatStats name username")
        .lean<CharacterForBattleLean>()
        .exec();
    }
  } else {
    throw new Error("buildPlayerCharacter: id debe ser un ObjectId válido (characterId o userId).");
  }

  if (!c) throw new Error("Character not found");

  const name = c.name ?? c.username ?? "Jugador";
  const level = Number(c.level ?? 1);
  const stats = mergeDefaults(c.stats, DEF_STATS);
  const res = mergeDefaults(c.resistances, DEF_RES);
  const cmb = mergeDefaults(c.combatStats, DEF_COMBAT);

  return new PlayerCharacter(String(c._id), name, level, stats, res, cmb);
}

/**
 * Construye un EnemyBot POO desde enemyId (ObjectId).
 * En DEV, si `enemyId` viene vacío/null, toma el primer Enemy encontrado.
 */
export async function buildEnemyById(enemyId?: string) {
  let e: EnemyForBattleLean | null = null;

  if (!enemyId) {
    e = await Enemy.findOne().select("_id name level stats resistances combatStats").lean<EnemyForBattleLean>().exec();
  } else if (Types.ObjectId.isValid(enemyId)) {
    e = await Enemy.findById(enemyId).select("_id name level stats resistances combatStats").lean<EnemyForBattleLean>().exec();
  } else {
    throw new Error("buildEnemyById: enemyId debe ser un ObjectId válido.");
  }

  if (!e) throw new Error("Enemy not found");

  const name = e.name ?? "Enemigo";
  const level = Number(e.level ?? 1);
  const stats = mergeDefaults(e.stats, DEF_STATS);
  const res = mergeDefaults(e.resistances, DEF_RES);
  const cmb = mergeDefaults(e.combatStats, DEF_COMBAT);

  return new EnemyBot(String(e._id), name, level, stats, res, cmb);
}

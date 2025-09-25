// src/services/character.service.ts
const DBG = process.env.DEBUG_COMBAT === "1";

import { Types } from "mongoose";
import { Character } from "../models/Character";
import { rollLootForEnemy, type PlayerClassName } from "../utils/loot";
import type { CharacterLean, ClassLean, EnemyLean } from "../types/lean";
import { applyExperience } from "./progression.service";

/** Lee el nombre de la clase desde el populate (si está) o usa un fallback. */
function getPopulatedClassName(
  player: CharacterLean | null | undefined,
  fallback?: PlayerClassName
): PlayerClassName | undefined {
  const cls = player?.classId;
  if (cls && typeof cls === "object" && "name" in cls) {
    return (cls as ClassLean).name as PlayerClassName;
  }
  return fallback;
}

/**
 * Busca un personaje por:
 *  - _id (si es ObjectId válido, intenta primero por _id)
 *  - userId (si no encontró por _id, intenta por userId; castea si es ObjectId válido)
 * Popula classId con campos relevantes para UI/loot.
 */
export async function findCharacterById(id: string): Promise<CharacterLean | null> {
  const projection = "name passiveDefaultSkill subclasses"; // ✅ sin campos legacy
  const isObjId = Types.ObjectId.isValid(id);

  if (isObjId) {
    const byDoc = await Character.findById(id)
      .populate<{ classId: any }>("classId", projection)
      .lean<CharacterLean>()
      .exec();
    if (byDoc) return byDoc;
  }

  // Intento por userId (acepta string u ObjectId casteado)
  const byUser =
    (await Character.findOne({
      userId: isObjId ? new Types.ObjectId(id) : id,
    })
      .populate<{ classId: any }>("classId", projection)
      .lean<CharacterLean>()
      .exec()) || null;

  return byUser;
}

/**
 * PvE: aplica XP y loot, y devuelve el personaje refrescado + info de recompensas.
 * Nota: NO tocamos el oro del personaje aquí; devolvemos `goldGained`.
 */
export async function grantRewardsAndLoot({
  player,
  enemy,
  battleLog,
}: {
  player: CharacterLean;
  enemy: EnemyLean;
  battleLog?: string[];
}) {
  const doc = await Character.findById(player._id);
  if (!doc) throw new Error("Character not found to grant rewards");

  const xpGained = Math.max(0, Number((enemy as any)?.xpReward ?? 0));
  const goldGained = Math.max(0, Number((enemy as any)?.goldReward ?? 0));

  const beforeXP = doc.experience ?? 0;
  const beforeLevel = doc.level ?? 1;

  // 1) Subir XP/Nivel usando la fuente de verdad
  const { level: afterLevel, experience: afterXP, levelUps } = await applyExperience(doc, xpGained);

  // 2) Loot según clase (nombre desde populate o fallback)
  const playerClassName = getPopulatedClassName(
    player,
    (doc as any)?.classId?.name as PlayerClassName | undefined
  );
  const drops = await rollLootForEnemy(enemy, playerClassName);

  // 3) Agregar al inventario (evitando duplicados)
  doc.inventory = (doc.inventory as any) || [];
  for (const it of drops) {
    const id = String((it as any)._id ?? (it as any).id ?? "");
    if (!id) continue;
    const exists = (doc.inventory as any[]).some((x: any) => String(x) === id);
    if (!exists) (doc.inventory as any[]).push(id);
  }

  // Guardamos nuevamente (applyExperience ya guardó level/exp)
  await doc.save();

  // Refrescar representación final con classId poblada (con passiveDefaultSkill)
  const updated = await Character.findById(doc._id)
    .populate<{ classId: any }>("classId", "name passiveDefaultSkill subclasses")
    .lean<CharacterLean>()
    .exec();

  if (DBG) {
    console.log("[REWARDS PvE] Aplicadas:", {
      charId: String(doc._id),
      xpGained,
      goldGained,
      beforeXP,
      afterXP,
      beforeLevel,
      afterLevel,
      levelUps,
      drops: drops.map((d) => String((d as any)._id ?? (d as any).id ?? "?")),
    });
  }

  return { xpGained, goldGained, levelUps, drops, character: updated };
}

/**
 * PvP: aplica solo XP al atacante (no hay loot).
 * Mantiene el comportamiento actual.
 */
export async function grantPvpExperience({
  userId,
  xpGained,
}: {
  userId: string;
  xpGained: number;
}) {
  const isObjId = Types.ObjectId.isValid(userId);
  const doc =
    (isObjId
      ? await Character.findOne({ userId: new Types.ObjectId(userId) })
      : await Character.findOne({ userId })) || (await Character.findById(userId));

  if (!doc) {
    if (DBG) console.warn("[REWARDS PvP] Character no encontrado para userId:", userId);
    return { levelUps: [], character: null as any };
  }

  const beforeXP = doc.experience ?? 0;
  const beforeLevel = doc.level ?? 1;

  const { level: afterLevel, experience: afterXP, levelUps } = await applyExperience(
    doc,
    Math.max(0, xpGained)
  );

  if (DBG) {
    console.log("[REWARDS PvP] XP aplicada:", {
      userId,
      xpGained,
      beforeXP,
      afterXP,
      beforeLevel,
      afterLevel,
      levelUps,
    });
  }

  return { levelUps, character: doc.toObject() };
}

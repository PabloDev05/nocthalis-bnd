// src/services/character.service.ts
const DBG = process.env.DEBUG_COMBAT === "1";

import { Types } from "mongoose";
import { Character } from "../models/Character";
import { rollLootForEnemy, type PlayerClassName } from "../utils/loot";
import type { CharacterLean, ClassLean, EnemyLean } from "../types/lean";

function xpNeededFor(level: number) {
  return Math.floor(100 + level * level * 20);
}

function getPopulatedClassName(player: CharacterLean | null | undefined, fallback?: PlayerClassName): PlayerClassName | undefined {
  const cls = player?.classId;
  if (cls && typeof cls === "object" && "name" in cls) {
    return (cls as ClassLean).name;
  }
  return fallback;
}

/** Busca por _id si es ObjectId válido; si no, por userId. Popula classId para pasivas. */
export async function findCharacterById(id: string): Promise<CharacterLean | null> {
  const projection = "name passiveDefault subclasses";
  if (Types.ObjectId.isValid(id)) {
    const byDoc = await Character.findById(id).populate<{ classId: any }>("classId", projection).lean<CharacterLean>().exec();
    if (byDoc) return byDoc;
  }
  const byUser = await Character.findOne({ userId: id }).populate<{ classId: any }>("classId", projection).lean<CharacterLean>().exec();
  return byUser ?? null;
}

/** PvE: aplica XP/loot y devuelve personaje actualizado + info. */
export async function grantRewardsAndLoot({ player, enemy, battleLog }: { player: CharacterLean; enemy: EnemyLean; battleLog?: string[] }) {
  const doc = await Character.findById(player._id);
  if (!doc) throw new Error("Character not found to grant rewards");

  const xpGained = Math.max(0, Number((enemy as any)?.xpReward ?? 0));
  const goldGained = Math.max(0, Number((enemy as any)?.goldReward ?? 0));

  const beforeXP = doc.experience ?? 0;
  const beforeLevel = doc.level ?? 1;

  doc.experience = beforeXP + xpGained;
  const levelUps: number[] = [];
  while ((doc.experience ?? 0) >= xpNeededFor((doc.level ?? 1) + 1)) {
    doc.level = (doc.level ?? 1) + 1;
    levelUps.push(doc.level);
  }

  const playerClassName = getPopulatedClassName(player, (doc as any)?.classId?.name as PlayerClassName | undefined);
  const drops = await rollLootForEnemy(enemy, playerClassName);

  doc.inventory = (doc.inventory as any) || [];
  for (const it of drops) {
    const id = String((it as any)._id ?? (it as any).id ?? "");
    if (!id) continue;
    const exists = (doc.inventory as any[]).some((x: any) => String(x) === id);
    if (!exists) (doc.inventory as any[]).push(id);
  }

  await doc.save();

  const updated = await Character.findById(doc._id).populate<{ classId: any }>("classId", "name passiveDefault subclasses").lean<CharacterLean>().exec();

  if (DBG) {
    console.log("[REWARDS PvE] Aplicadas:", {
      charId: String(doc._id),
      xpGained,
      goldGained,
      beforeXP,
      afterXP: doc.experience,
      beforeLevel,
      afterLevel: doc.level,
      levelUps,
      drops: drops.map((d) => String((d as any)._id ?? (d as any).id ?? "?")),
    });
  }

  return { xpGained, goldGained, levelUps, drops, character: updated };
}

/** PvP: sólo XP al atacante (no hay loot). */
export async function grantPvpExperience({ userId, xpGained }: { userId: string; xpGained: number }) {
  const doc = (Types.ObjectId.isValid(userId) ? await Character.findOne({ userId: new Types.ObjectId(userId) }) : await Character.findOne({ userId })) || (await Character.findById(userId));

  if (!doc) {
    if (DBG) console.warn("[REWARDS PvP] Character no encontrado para userId:", userId);
    return { levelUps: [], character: null as any };
  }

  const beforeXP = doc.experience ?? 0;
  const beforeLevel = doc.level ?? 1;

  doc.experience = (doc.experience ?? 0) + Math.max(0, xpGained);
  const levelUps: number[] = [];
  while ((doc.experience ?? 0) >= xpNeededFor((doc.level ?? 1) + 1)) {
    doc.level = (doc.level ?? 1) + 1;
    levelUps.push(doc.level);
  }

  await doc.save();

  if (DBG) {
    console.log("[REWARDS PvP] XP aplicada:", {
      userId,
      xpGained,
      beforeXP,
      afterXP: doc.experience,
      beforeLevel,
      afterLevel: doc.level,
      levelUps,
    });
  }

  return { levelUps, character: doc.toObject() };
}

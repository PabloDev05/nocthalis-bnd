// src/services/character.service.ts
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

/**
 * Busca por _id si es ObjectId válido; si no, por userId (1 personaje por usuario).
 * Devuelve LEAN con classId populado (solo name) o null.
 */
export async function findCharacterById(id: string): Promise<CharacterLean | null> {
  if (Types.ObjectId.isValid(id)) {
    const byDoc = await Character.findById(id).populate<{ classId: ClassLean }>("classId", "name").lean<CharacterLean>().exec();
    if (byDoc) return byDoc;
  }

  const byUser = await Character.findOne({ userId: id }).populate<{ classId: ClassLean }>("classId", "name").lean<CharacterLean>().exec();

  return byUser ?? null;
}

/**
 * Aplica recompensas (XP, nivel, loot e inventario) y persiste.
 * Retorna personaje actualizado (lean + classId.name).
 */
export async function grantRewardsAndLoot({ player, enemy, battleLog }: { player: CharacterLean; enemy: EnemyLean; battleLog?: string[] }) {
  const doc = await Character.findById(player._id);
  if (!doc) throw new Error("Character not found to grant rewards");

  const xpGained = Math.max(0, Number(enemy?.xpReward ?? 0));
  const goldGained = Math.max(0, Number(enemy?.goldReward ?? 0));

  // XP + level up
  doc.experience = (doc.experience ?? 0) + xpGained;
  const levelUps: number[] = [];
  while ((doc.experience ?? 0) >= xpNeededFor((doc.level ?? 1) + 1)) {
    doc.level = (doc.level ?? 1) + 1;
    levelUps.push(doc.level);
  }

  // Nombre de clase para sesgar loot
  const playerClassName = getPopulatedClassName(player, (doc as any)?.classId?.name as PlayerClassName | undefined);

  // Loot
  const drops = await rollLootForEnemy(enemy, playerClassName);

  // Inventario sin duplicados (guardamos ids string)
  doc.inventory = (doc.inventory as any) || [];
  for (const it of drops) {
    const id = String((it as any)._id ?? (it as any).id ?? "");
    if (!id) continue;
    const exists = (doc.inventory as any[]).some((x: any) => String(x) === id);
    if (!exists) (doc.inventory as any[]).push(id);
  }

  // Si llevás oro, descomenta:
  // doc.gold = (doc.gold ?? 0) + goldGained;

  await doc.save();

  const updated = await Character.findById(doc._id).populate<{ classId: ClassLean }>("classId", "name").lean<CharacterLean>().exec();

  return { xpGained, goldGained, levelUps, drops, character: updated };
}

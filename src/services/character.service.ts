// findCharacterById: trae classId con pasivas/subclases para aplicar antes del combate
// grantRewardsAndLoot: aplica XP/level-ups y agrega drops al inventario, con logs.
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

/**
 * Busca por _id si es ObjectId válido; si no, por userId (1 personaje por usuario).
 * Popula classId con campos necesarios para pasivas.
 */
export async function findCharacterById(id: string): Promise<CharacterLean | null> {
  const projection = "name passiveDefault subclasses"; // campos necesarios para pasivas
  if (Types.ObjectId.isValid(id)) {
    const byDoc = await Character.findById(id).populate<{ classId: any }>("classId", projection).lean<CharacterLean>().exec();
    if (byDoc) {
      if (DBG) console.log("[CHAR] findCharacterById por _id OK:", byDoc._id);
      return byDoc;
    }
  }

  const byUser = await Character.findOne({ userId: id }).populate<{ classId: any }>("classId", projection).lean<CharacterLean>().exec();

  if (DBG) console.log("[CHAR] findCharacterById por userId:", byUser?._id);
  return byUser ?? null;
}

/**
 * Aplica recompensas (XP/niveles/loot) y devuelve personaje actualizado.
 */
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
    console.log("[REWARDS] Aplicadas:", {
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

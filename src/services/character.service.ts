const DBG = process.env.DEBUG_COMBAT === "1";

import { Types } from "mongoose";
import { Character } from "../models/Character";
import { rollLootForEnemy, type PlayerClassName } from "../utils/loot";
import type { CharacterLean, ClassLean, EnemyLean } from "../types/lean";
import { applyExperience } from "./progression.service";

function getPopulatedClassName(player: CharacterLean | null | undefined, fallback?: PlayerClassName): PlayerClassName | undefined {
  const cls = player?.classId;
  if (cls && typeof cls === "object" && "name" in cls) {
    return (cls as ClassLean).name as PlayerClassName;
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

  // 1) Subir XP/Nivel usando la fuente de verdad
  const { level: afterLevel, experience: afterXP, levelUps } = await applyExperience(doc, xpGained);

  // 2) Loot según clase (nombre desde populado o fallback)
  const playerClassName = getPopulatedClassName(player, (doc as any)?.classId?.name as PlayerClassName | undefined);
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

  // Refrescar representacion final con classId poblada
  const updated = await Character.findById(doc._id).populate<{ classId: any }>("classId", "name passiveDefault subclasses").lean<CharacterLean>().exec();

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

/** PvP: sólo XP al atacante (no hay loot). */
export async function grantPvpExperience({ userId, xpGained }: { userId: string; xpGained: number }) {
  const doc = (Types.ObjectId.isValid(userId) ? await Character.findOne({ userId: new Types.ObjectId(userId) }) : await Character.findOne({ userId })) || (await Character.findById(userId));

  if (!doc) {
    if (DBG) console.warn("[REWARDS PvP] Character no encontrado para userId:", userId);
    return { levelUps: [], character: null as any };
  }

  const beforeXP = doc.experience ?? 0;
  const beforeLevel = doc.level ?? 1;

  const { level: afterLevel, experience: afterXP, levelUps } = await applyExperience(doc, Math.max(0, xpGained));

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

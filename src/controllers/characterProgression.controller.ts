/* eslint-disable no-console */
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeProgression } from "../services/progression.service";
import { computeAvailablePoints } from "../services/allocation.service";
import type { BaseStats } from "../interfaces/character/CharacterClass.interface";

/** Normaliza a BaseStats (incluye fate) */
function coerceBaseStats(src: any): BaseStats {
  return {
    strength: Number(src?.strength ?? 0),
    dexterity: Number(src?.dexterity ?? 0),
    intelligence: Number(src?.intelligence ?? 0),
    vitality: Number(src?.vitality ?? 0),
    physicalDefense: Number(src?.physicalDefense ?? 0),
    magicalDefense: Number(src?.magicalDefense ?? 0),
    luck: Number(src?.luck ?? 0),
    endurance: Number(src?.endurance ?? 0),
    fate: Number(src?.fate ?? 0),
  };
}

/**
 * GET /character/progression
 * Curva acumulada; agrega availablePoints y canAllocateNow para el UI.
 */
export const getProgression = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const character = await Character.findOne({ userId }).lean();
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    const exp = Number(character.experience ?? 0);
    const lvl = Number(character.level ?? 1);

    // Progresión (enteros)
    const p = computeProgression(exp, lvl);

    // Cálculo de availablePoints (igual que /character/me)
    let availablePoints = 0;
    const classDoc = await CharacterClass.findById(character.classId).select("baseStats").lean();
    if (classDoc) {
      const statsBS = coerceBaseStats(character.stats || {});
      const baseBS = coerceBaseStats(classDoc.baseStats || {});
      availablePoints = computeAvailablePoints(p.level, statsBS, baseBS);
    }

    // Flag para el front: si ya podés asignar ahora (porque subiste o alcanzaste el umbral)
    const pendingLevels = Number(p.pendingLevels ?? 0);
    const canAllocateNow = availablePoints > 0 || pendingLevels > 0;

    return res.json({
      level: p.level,
      experience: exp,
      currentLevelAt: p.currentLevelAt,
      nextLevelAt: p.nextLevelAt,
      xpSinceLevel: p.xpSinceLevel,
      xpForThisLevel: p.xpForThisLevel,
      xpToNext: p.xpToNext,
      xpPercent: p.xpPercentInt, // entero 0..100
      isMaxLevel: p.isMaxLevel,
      pendingLevels,
      availablePoints,
      canAllocateNow,
    });
  } catch (err) {
    console.error("getProgression error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
};

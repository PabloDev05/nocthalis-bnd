// src/controllers/characterProgression.controller.ts
/* eslint-disable no-console */
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeProgression } from "../services/progression.service";
import { computeAvailablePoints } from "../services/allocation.service";
import type { BaseStats } from "../interfaces/character/CharacterClass.interface";

/* Helpers enteros */
const toInt = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
};

function coerceBaseStats(src: any): BaseStats {
  return {
    strength: toInt(src?.strength, 0),
    dexterity: toInt(src?.dexterity, 0),
    intelligence: toInt(src?.intelligence, 0),
    constitution: toInt(src?.constitution, 0), 
    physicalDefense: toInt(src?.physicalDefense, 0),
    magicalDefense: toInt(src?.magicalDefense, 0),
    luck: toInt(src?.luck, 0),
    endurance: toInt(src?.endurance, 0),
    fate: toInt(src?.fate, 0),
  };
}

/**
 * GET /character/progression
 */
export const getProgression = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const character = await Character.findOne({ userId }).lean();
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    const exp = toInt(character.experience, 0);
    const lvl = toInt(character.level, 1);

    // Barra y nivel efectivo (enteros)
    const p = computeProgression(exp, lvl);

    // Puntos disponibles basados en (stats actuales - baseStats) y nivel efectivo
    let availablePoints = 0;
    const classDoc = await CharacterClass.findById(character.classId)
      .select("baseStats")
      .lean();

    if (classDoc) {
      const statsNow = coerceBaseStats(character.stats || {});
      const statsBase = coerceBaseStats(classDoc.baseStats || {});
      availablePoints = computeAvailablePoints(p.level, statsNow, statsBase);
    }

    const pendingLevels = toInt(p.pendingLevels, 0);
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

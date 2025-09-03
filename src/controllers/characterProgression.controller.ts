/* eslint-disable no-console */
import { Request, Response } from "express";
import { Character } from "../models/Character";
import { computeProgression } from "../services/progression.service";

/**
 * GET /character/progression
 * Usa la curva acumulada; incluye isMaxLevel y porcentaje INT (0..100).
 */
export const getProgression = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const character = await Character.findOne({ userId }).lean();
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    const exp = Number(character.experience ?? 0);
    const lvl = Number(character.level ?? 1);

    const p = computeProgression(exp, lvl);

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
      pendingLevels: p.pendingLevels,
    });
  } catch (err) {
    console.error("getProgression error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
};

export default getProgression;

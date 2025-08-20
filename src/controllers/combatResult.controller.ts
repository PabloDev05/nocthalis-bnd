const DBG = process.env.DEBUG_COMBAT === "1";

import { Request, Response } from "express";
import { Types } from "mongoose";
import { CombatResult } from "../models/CombatResult";

type ModeFilter = "preview" | "resolve" | "pvp-preview" | "pvp-resolve";
type WinnerFilter = "player" | "enemy" | "none";

export async function getCombatResultsController(req: Request, res: Response) {
  try {
    const { page = "1", limit = "20", mode, enemyId, characterId, winner } = req.query as Record<string, string>;

    const p = Math.max(1, parseInt(page || "1", 10));
    const l = Math.min(100, Math.max(1, parseInt(limit || "20", 10)));

    const filter: any = {};

    // Por defecto mostramos historial del usuario autenticado
    if (req.user?.id && Types.ObjectId.isValid(req.user.id)) {
      filter.userId = new Types.ObjectId(req.user.id);
    }

    // Si te pasan characterId, priorizá ese sobre userId
    if (characterId && Types.ObjectId.isValid(characterId)) {
      filter.characterId = new Types.ObjectId(characterId);
      delete filter.userId;
    }

    // PvE puede tener enemyId; solo filtrar si lo mandan válido.
    if (enemyId && Types.ObjectId.isValid(enemyId)) {
      filter.enemyId = new Types.ObjectId(enemyId);
    }

    const allowedModes: ModeFilter[] = ["preview", "resolve", "pvp-preview", "pvp-resolve"];
    if (mode && (allowedModes as string[]).includes(mode)) {
      filter.mode = mode;
    }

    const allowedWinners: WinnerFilter[] = ["player", "enemy", "none"];
    if (winner && (allowedWinners as string[]).includes(winner)) {
      filter.winner = winner;
    }

    if (DBG) console.log("[HIST] Listar combates:", { p, l, filter });

    const [total, results] = await Promise.all([
      CombatResult.countDocuments(filter),
      CombatResult.find(filter)
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .select({
          _id: 1,
          userId: 1,
          characterId: 1,
          enemyId: 1,
          mode: 1,
          winner: 1,
          turns: 1,
          seed: 1,
          createdAt: 1,
          snapshots: { $slice: 0 },
          log: { $slice: 0 },
          rewards: 1,
        })
        .lean()
        .exec(),
    ]);

    return res.json({ page: p, limit: l, total, results });
  } catch (err) {
    console.error("getCombatResultsController error:", err);
    return res.status(500).json({ message: "Error listando historial" });
  }
}

export async function getCombatResultDetailController(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "id inválido" });
    }

    const doc = await CombatResult.findById(id).lean();
    if (!doc) return res.status(404).json({ message: "No encontrado" });

    // (opcional) validar pertenencia
    if (doc.userId && req.user?.id && String(doc.userId) !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (DBG)
      console.log("[HIST] Detalle combate:", {
        id,
        winner: doc.winner,
        mode: doc.mode,
        turns: doc.turns,
      });

    return res.json(doc);
  } catch (err) {
    console.error("getCombatResultDetailController error:", err);
    return res.status(500).json({ message: "Error obteniendo detalle" });
  }
}

// src/controllers/combatResult.controller.ts
/* eslint-disable no-console */

// Listado y detalle de historiales de combate (con slicing opcional)
// Guarda log y snapshots del combate (PvE o PvP viejo)
const DBG = process.env.DEBUG_COMBAT === "1";

import { Request, Response } from "express";
import { Types } from "mongoose";
import { CombatResult } from "../models/CombatResult";

type ModeFilter = "preview" | "resolve" | "pvp-preview" | "pvp-resolve";
type WinnerFilter = "player" | "enemy" | "draw" | "none";

/* utils */
const toInt = (v: any, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : d;
};
const isObjId = (s?: string) => !!s && Types.ObjectId.isValid(s);

/* ------------------------------------------------------------------ */
/* GET /combat/results  (listado “liviano”)                            */
/* ------------------------------------------------------------------ */
export async function getCombatResultsController(req: Request, res: Response) {
  try {
    const { page = "1", limit = "20", mode, enemyId, characterId, winner, matchId } = req.query as Record<string, string>;

    const p = Math.max(1, parseInt(page || "1", 10));
    const l = Math.min(100, Math.max(1, parseInt(limit || "20", 10)));

    const filter: any = {};

    // Por defecto, historial del usuario autenticado
    if (req.user?.id && isObjId(req.user.id)) {
      filter.userId = new Types.ObjectId(req.user.id);
    }

    // Si mandan characterId, prioriza sobre userId
    if (characterId && isObjId(characterId)) {
      filter.characterId = new Types.ObjectId(characterId);
      delete filter.userId;
    }

    // PvE con enemyId (si viene)
    if (enemyId && isObjId(enemyId)) {
      filter.enemyId = new Types.ObjectId(enemyId);
    }

    // Enlazado PvP (si viene)
    if (matchId && isObjId(matchId)) {
      filter.matchId = new Types.ObjectId(matchId);
    }

    // Filtro por modo
    const allowedModes: ModeFilter[] = ["preview", "resolve", "pvp-preview", "pvp-resolve"];
    if (mode && (allowedModes as string[]).includes(mode)) {
      filter.mode = mode;
    }

    // Filtro por winner (acepta 'none' para dumps viejos)
    const allowedWinners: WinnerFilter[] = ["player", "enemy", "draw", "none"];
    if (winner && (allowedWinners as string[]).includes(winner)) {
      if (winner === "none") {
        filter.$or = [{ winner: "none" }, { winner: "draw" }, { winner: null }];
      } else {
        filter.winner = winner;
      }
    }

    if (DBG) console.log("[HIST] Listar combates:", { p, l, filter });

    // Listado liviano: NO arrastramos arrays grandes
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
          matchId: 1,
          mode: 1,
          winner: 1,
          turns: 1,
          seed: 1,
          createdAt: 1,
          // arrays fuera del listado
          snapshots: { $slice: 0 },
          log: { $slice: 0 },
          // rewards compacto
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

/* ------------------------------------------------------------------ */
/* GET /combat/results/:id  (detalle con slicing + counts opcional)   */
/* ------------------------------------------------------------------ */
/**
 * Query params (opcionales):
 *  - ssSkip, ssLimit: paginado para snapshots
 *  - logSkip, logLimit: paginado para log
 *  - withCounts=1: devuelve {counts:{snapshots,log}} sin cargar arrays completos
 *
 * Defaults:
 *  - ...Limit por defecto = 200; ...Skip por defecto = 0
 */
export async function getCombatResultDetailController(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "id inválido" });
    }

    // slicing params
    const q = req.query as Record<string, string>;
    const ssSkip = Math.max(0, toInt(q.ssSkip, 0));
    const ssLimit = Math.max(0, toInt(q.ssLimit, 200));
    const logSkip = Math.max(0, toInt(q.logSkip, 0));
    const logLimit = Math.max(0, toInt(q.logLimit, 200));
    const withCounts = q.withCounts === "1";

    // Solo slices que existen en el modelo (no hay timeline aquí)
    const query = CombatResult.findById(id).slice("snapshots", [ssSkip, ssLimit]).slice("log", [logSkip, logLimit]);

    const doc = await query.lean().exec();
    if (!doc) return res.status(404).json({ message: "No encontrado" });

    // (opcional) validar pertenencia
    if (doc.userId && req.user?.id && String(doc.userId) !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    let counts: { snapshots: number; log: number } | undefined;

    if (withCounts) {
      // Traemos sólo los tamaños con un aggregate, sin cargar arrays
      const agg = await CombatResult.aggregate<{ snapshots: number; log: number }>([
        { $match: { _id: new Types.ObjectId(id) } },
        {
          $project: {
            snapshots: { $size: { $ifNull: ["$snapshots", []] } },
            log: { $size: { $ifNull: ["$log", []] } },
          },
        },
      ]);
      counts = agg[0] ?? { snapshots: 0, log: 0 };
    }

    if (DBG)
      console.log("[HIST] Detalle combate:", {
        id,
        winner: (doc as any).winner,
        mode: (doc as any).mode,
        turns: (doc as any).turns,
        slices: { ssSkip, ssLimit, logSkip, logLimit },
      });

    return res.json({ ...doc, counts });
  } catch (err) {
    console.error("getCombatResultDetailController error:", err);
    return res.status(500).json({ message: "Error obteniendo detalle" });
  }
}

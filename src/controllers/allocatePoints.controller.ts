// src/controllers/allocatePoints.controller.ts
/* eslint-disable no-console */
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { ASSIGNABLE_KEYS, POINTS_PER_LEVEL, computeAvailablePoints, applyIncrements } from "../services/allocation.service";

/* ───────────────────────── tipos ───────────────────────── */
type AllocOk = {
  ok: true;
  payload: {
    message: string;
    spent: number;
    pointsLeft: number;
    perLevel: number;
    stats: any; // puedes tipar con BaseStats
    combatStats: any; // snapshot
  };
};
type AllocErr = {
  ok: false;
  error: {
    code: 400 | 401 | 404;
    message: string;
    details?: Record<string, unknown>;
  };
};
type AllocResult = AllocOk | AllocErr;

const isOk = (r: AllocResult): r is AllocOk => r.ok === true;
const isErr = (r: AllocResult): r is AllocErr => r.ok === false;

/* ───────────────────────── helpers ───────────────────────── */
const toInt = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
};

/** Lee incrementos desde body plano o `{ allocations: {...} }`, solo claves válidas. */
function readAllocations(body: any): Partial<Record<(typeof ASSIGNABLE_KEYS)[number], number>> {
  const src = body?.allocations ? body.allocations : body;
  const out: any = {};
  for (const k of ASSIGNABLE_KEYS) {
    const raw = src?.[k as string];
    if (raw === undefined || raw === null) continue;
    const n = Math.max(0, toInt(raw, 0));
    if (n > 0) out[k] = n;
  }
  return out;
}

function sendAllocResult(res: Response, r: AllocResult) {
  if (isOk(r)) {
    return res.json(r.payload);
  }
  return res.status(r.error.code).json({ message: r.error.message, ...(r.error.details ?? {}) });
}

/* ───────────────────────── core ───────────────────────── */
async function allocateWithSession(userId: string, inc: Partial<Record<(typeof ASSIGNABLE_KEYS)[number], number>>, session?: mongoose.ClientSession): Promise<AllocResult> {
  const character = await Character.findOne({ userId }).session(session ?? null);
  if (!character) {
    return { ok: false, error: { code: 404, message: "Personaje no encontrado" } };
  }

  const cls = await CharacterClass.findById(character.classId)
    .select("baseStats")
    .lean()
    .session(session ?? null);
  if (!cls) {
    return { ok: false, error: { code: 400, message: "Clase base no encontrada" } };
  }

  const level = Number(character.level ?? 1);
  const available = computeAvailablePoints(level, character.stats as any, (cls as any).baseStats as any);

  const spentNow = Object.values(inc).reduce((a, b) => a + (b || 0), 0);
  if (spentNow <= 0) {
    return { ok: false, error: { code: 400, message: "No se enviaron asignaciones válidas" } };
  }
  if (available < spentNow) {
    return {
      ok: false,
      error: {
        code: 400,
        message: "Puntos insuficientes",
        details: { available, requested: spentNow, perLevel: POINTS_PER_LEVEL },
      },
    };
  }

  character.stats = applyIncrements(character.stats as any, inc);
  await character.save({ session });

  const pointsLeft = computeAvailablePoints(level, character.stats as any, (cls as any).baseStats as any);

  return {
    ok: true,
    payload: {
      message: "Puntos asignados",
      spent: spentNow,
      pointsLeft,
      perLevel: POINTS_PER_LEVEL,
      stats: character.stats,
      combatStats: character.combatStats,
    },
  };
}

/* ───────────────────────── controller ────────────────────── */
/**
 * POST /character/allocate
 * Body:
 *  - { allocations: { strength: 2, fate: 1 } }
 *  - { strength: 2, fate: 1 }
 */
export async function allocatePointsController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const inc = readAllocations(req.body || {});
    const spentNow = Object.values(inc).reduce((a, b) => a + (b || 0), 0);
    if (spentNow <= 0) {
      return res.status(400).json({ message: "No se enviaron asignaciones válidas" });
    }

    // Intento con transacción (si hay réplica)
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();

      // Inicializado para evitar "possibly undefined" y "never"
      let result: AllocResult = {
        ok: false,
        error: { code: 400, message: "Transacción no ejecutada" },
      };

      await session.withTransaction(async () => {
        const r = await allocateWithSession(userId, inc, session!);
        result = r;
        if (isErr(r)) {
          const err: any = new Error(r.error.message);
          err.statusCode = r.error.code;
          err.details = r.error.details;
          throw err; // aborta la tx
        }
      });

      await session.endSession().catch(() => {});
      // TS sabe que "result" es AllocResult; usamos helper para estrechar
      return sendAllocResult(res, result);
    } catch (txErr: any) {
      try {
        await session?.endSession();
      } catch {}

      // Si no hay soporte de transacciones (código 20), caemos al fallback
      const isNoTx = txErr?.code === 20 || /Transaction numbers are only allowed on a replica set member or mongos/i.test(String(txErr?.message || ""));

      // Errores propios de validación ocurridos dentro de la tx → devolver tal cual
      if (!isNoTx && txErr?.statusCode) {
        return res.status(txErr.statusCode).json({ message: txErr.message, ...(txErr.details ?? {}) });
      }

      if (!isNoTx) console.error("allocatePointsController tx error:", txErr);

      // Fallback simple, sin transacción
      const r = await allocateWithSession(userId, inc, undefined);
      return sendAllocResult(res, r);
    }
  } catch (err) {
    console.error("allocatePointsController error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default allocatePointsController;

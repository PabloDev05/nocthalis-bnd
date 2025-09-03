// src/controllers/allocatePoints.controller.ts
/* eslint-disable no-console */
import { Request, Response } from "express";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import {
  ASSIGNABLE_KEYS, // ["strength","dexterity","intelligence","vitality","endurance","luck","fate"]
  POINTS_PER_LEVEL, // visible en la respuesta para depurar si hace falta
  computeAvailablePoints, // calcula puntos disponibles = level*perLevel - (current - base)
  applyIncrements, // aplica sumas enteras y clampa ≥ 0
} from "../services/allocation.service";

/* ───────────────────────── helpers ───────────────────────── */
const toInt = (v: any, d = 0) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : d;
};

/** Lee incrementos desde body plano o `{ allocations: {...} }`, solo claves válidas. */
function readAllocations(body: any): Partial<Record<(typeof ASSIGNABLE_KEYS)[number], number>> {
  const src = body?.allocations ? body.allocations : body;
  const out: any = {};
  for (const k of ASSIGNABLE_KEYS) {
    const raw = src?.[k];
    if (raw === undefined || raw === null) continue;
    const n = Math.max(0, toInt(raw, 0));
    if (n > 0) out[k] = n;
  }
  return out;
}

/* ───────────────────────── controller ────────────────────── */
/**
 * POST /character/allocate
 * Body admite:
 *  - { allocations: { strength: 2, fate: 1 } }
 *  - { strength: 2, fate: 1 }
 *
 * Regla: no toca combatStats aquí (eso ahora lo hace el motor durante el combate).
 */
export async function allocatePointsController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    // 1) Normalizar incrementos
    const inc = readAllocations(req.body || {});
    const spentNow = Object.values(inc).reduce((a, b) => a + (b || 0), 0);
    if (spentNow <= 0) {
      return res.status(400).json({ message: "No se enviaron asignaciones válidas" });
    }

    // 2) Obtener personaje y clase base
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    const cls = await CharacterClass.findById(character.classId).lean();
    if (!cls) return res.status(400).json({ message: "Clase base no encontrada" });

    // 3) Puntos disponibles (misma fórmula que /character/me)
    const available = computeAvailablePoints(Number(character.level ?? 1), character.stats as any, cls.baseStats as any);

    if (available < spentNow) {
      return res.status(400).json({
        message: "Puntos insuficientes",
        available,
        requested: spentNow,
        perLevel: POINTS_PER_LEVEL,
      });
    }

    // 4) Aplicar incrementos (enteros; incluye 'fate')
    character.stats = applyIncrements(character.stats as any, inc);
    await character.save();

    // 5) Puntos restantes tras aplicar
    const pointsLeft = computeAvailablePoints(Number(character.level ?? 1), character.stats as any, cls.baseStats as any);

    return res.json({
      message: "Puntos asignados",
      spent: spentNow,
      pointsLeft,
      stats: character.stats,
      // Para compatibilidad con UI antigua; ya no se recalcula aquí
      combatStats: character.combatStats,
    });
  } catch (err) {
    console.error("allocatePointsController error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default allocatePointsController;

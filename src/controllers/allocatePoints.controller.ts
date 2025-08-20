// src/controllers/allocatePoints.controller.ts
import { Request, Response } from "express";
import { Character } from "../models/Character";

/** Stats permitidos (sin agility ni wisdom) */
const ALLOWED_STATS = ["strength", "dexterity", "intelligence", "vitality", "physicalDefense", "magicalDefense", "luck", "endurance"] as const;
type AllowedStat = (typeof ALLOWED_STATS)[number];

/** Nombres posibles del campo de “puntos sin asignar” para compat hacia atrás */
const POINTS_FIELDS = ["statPoints", "unallocatedPoints", "pointsAvailable", "attributePoints"] as const;

/** Toma un objeto cualquiera y devuelve asignaciones válidas, enteras y ≥ 0 */
function normalizeAllocations(input: any): Partial<Record<AllowedStat, number>> {
  const out: Partial<Record<AllowedStat, number>> = {};
  for (const k of ALLOWED_STATS) {
    const raw = input?.[k];
    if (raw === undefined || raw === null) continue;
    const n = Math.floor(Number(raw));
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

/** Lee la cantidad de puntos disponibles del personaje (compat multi‐campo) */
function readAvailablePoints(char: any): { field: string | null; value: number } {
  for (const f of POINTS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(char, f)) {
      const v = Math.max(0, Math.floor(Number(char[f] ?? 0)));
      return { field: f, value: v };
    }
  }
  return { field: null, value: 0 };
}

/** Setea la nueva cantidad de puntos disponibles (si existe campo compatible) */
function writeAvailablePoints(char: any, field: string | null, newValue: number) {
  if (field) {
    char[field] = Math.max(0, Math.floor(newValue));
  }
}

/**
 * POST /character/allocate
 * Body ejemplo:
 * {
 *   "strength": 2,
 *   "vitality": 1,
 *   "luck": 1
 * }
 */
export async function allocatePointsController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    // Normalizamos asignaciones (solo claves válidas, enteros, ≥ 0)
    const allocations = normalizeAllocations(req.body || {});
    const spent = Object.values(allocations).reduce((a, b) => a + (b || 0), 0);

    if (spent <= 0) {
      return res.status(400).json({ message: "No se enviaron asignaciones válidas" });
    }

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    // Leemos puntos disponibles (compat con varios nombres de campo)
    const { field: pointsField, value: available } = readAvailablePoints(character);

    if (available < spent) {
      return res.status(400).json({
        message: "Puntos insuficientes",
        available,
        requested: spent,
      });
    }

    // Aseguramos objeto stats
    (character as any).stats = (character as any).stats || {};

    // Aplica asignaciones (todo entero)
    for (const k of Object.keys(allocations) as AllowedStat[]) {
      const inc = Math.floor(allocations[k] || 0);
      if (inc <= 0) continue;
      const prev = Math.floor(Number((character as any).stats[k] ?? 0));
      (character as any).stats[k] = prev + inc;
    }

    // Descuenta puntos y guarda
    writeAvailablePoints(character, pointsField, available - spent);
    await character.save();

    return res.json({
      message: "Puntos asignados",
      spent,
      pointsLeft: pointsField ? Math.max(0, Math.floor(Number((character as any)[pointsField] ?? 0))) : 0,
      pointsField: pointsField ?? null, // para que el front sepa cuál es el campo en uso
      stats: (character as any).stats,
    });
  } catch (err) {
    console.error("allocatePointsController error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

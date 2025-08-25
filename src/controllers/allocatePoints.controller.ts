// src/controllers/allocatePoints.controller.ts
import { Request, Response } from "express";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeAvailablePoints } from "../services/allocation.service";

/** Stats permitidos (sin agility ni wisdom) */
const ALLOWED_STATS = ["strength", "dexterity", "intelligence", "vitality", "physicalDefense", "magicalDefense", "luck", "endurance"] as const;
type AllowedStat = (typeof ALLOWED_STATS)[number];

/** Utilidades */
const toInt = (v: any, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : def;
};
const clampInt = (n: number) => Math.round(n);

/** Normaliza asignaciones desde body plano o `{ allocations: {...} }` */
function getAllocationsFromBody(body: any): Partial<Record<AllowedStat, number>> {
  const src = body?.allocations ? body.allocations : body;
  const out: Partial<Record<AllowedStat, number>> = {};
  for (const k of ALLOWED_STATS) {
    const raw = src?.[k];
    if (raw === undefined || raw === null) continue;
    const n = toInt(raw);
    if (n > 0) out[k] = n;
  }
  return out;
}

/** Recalcula combatStats en base a deltas (stats - baseStats) y clase */
function recomputeCombatFromStats(params: { className: string; baseCombat: any; baseStats: Record<string, number>; stats: Record<string, number> }) {
  const { className, baseCombat = {}, baseStats = {}, stats = {} } = params;

  const name = (className || "").toLowerCase();
  const isMage = /mago|mage|wizard|sorcer|sorcerer/.test(name);
  const isAssassin = /asesino|assassin/.test(name);
  const isArcher = /arquero|archer|ranger/.test(name);

  const d = (k: string) => Math.max(0, toInt(stats[k]) - toInt(baseStats[k]));

  const dStr = d("strength");
  const dDex = d("dexterity");
  const dInt = d("intelligence");
  const dVit = d("vitality");
  const dEnd = d("endurance");
  const dLuck = d("luck");

  const result = { ...(baseCombat || {}) };

  // Strength
  result.attackPower = clampInt(toInt(result.attackPower) + 1 * dStr);

  // Dexterity
  result.evasion = clampInt(toInt(result.evasion) + 0.5 * dDex);
  result.attackSpeed = clampInt(toInt(result.attackSpeed) + 0.2 * dDex);
  if (isAssassin || isArcher) {
    result.attackPower = clampInt(toInt(result.attackPower) + 0.5 * dDex);
    result.movementSpeed = clampInt(toInt(result.movementSpeed) + 0.2 * dDex);
  }

  // Vitality
  result.maxHP = clampInt(toInt(result.maxHP) + 5 * dVit);

  // Endurance
  result.damageReduction = clampInt(toInt(result.damageReduction) + 0.2 * dEnd);
  result.blockValue = clampInt(toInt(result.blockValue) + 0.5 * dEnd);
  result.blockChance = clampInt(toInt(result.blockChance) + 0.3 * dEnd);
  // Nota: tus defensas “physicalDefense/magicalDefense” están dentro de stats,
  // pero pediste que Endurance también las empuje un poco:
  // si prefieres NO tocarlas aquí, comenta estas 2 líneas:
  // (Si las dejas, verás subir estos campos en la UI de la izquierda.)
  // result.physicalDefense = clampInt(toInt(result.physicalDefense) + 0.4 * dEnd);
  // result.magicalDefense  = clampInt(toInt(result.magicalDefense)  + 0.2 * dEnd);

  // Luck
  result.criticalChance = clampInt(toInt(result.criticalChance) + 0.3 * dLuck);
  result.criticalDamageBonus = clampInt(toInt(result.criticalDamageBonus) + 0.5 * dLuck);

  // Intelligence (solo Mago)
  if (isMage) {
    result.magicPower = clampInt(toInt(result.magicPower) + 2 * dInt);
  }

  return result;
}

/**
 * POST /character/allocate
 * Body admitido:
 *  - { allocations: { strength: 1 } }
 *  - { strength: 1 }
 */
export async function allocatePointsController(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    // 1) Normalizamos asignaciones
    const allocations = getAllocationsFromBody(req.body || {});
    const spent = Object.values(allocations).reduce((a, b) => a + (b || 0), 0);
    if (spent <= 0) {
      return res.status(400).json({ message: "No se enviaron asignaciones válidas" });
    }

    // 2) Cargamos personaje + clase
    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    const cls = await CharacterClass.findById(character.classId).lean();
    if (!cls) return res.status(400).json({ message: "Clase base no encontrada" });

    // 3) Calculamos puntos disponibles derivados (misma regla que /character/me)
    const baseStats = (cls as any)?.baseStats || {};
    const currentStats = (character as any).stats || {};
    const available = computeAvailablePoints(toInt((character as any).level, 1), currentStats, baseStats);

    if (available < spent) {
      return res.status(400).json({
        message: "Puntos insuficientes",
        available,
        requested: spent,
      });
    }

    // 4) Aplicamos asignaciones (enteros)
    (character as any).stats = currentStats;
    for (const k of Object.keys(allocations) as AllowedStat[]) {
      const inc = toInt(allocations[k], 0);
      if (inc <= 0) continue;
      const prev = toInt((character as any).stats[k], 0);
      (character as any).stats[k] = prev + inc;
    }

    // 5) Recalcular combatStats en base a deltas vs base
    const baseCombat = (cls as any)?.combatStats || {};
    const className = (cls as any)?.name || "";
    const newCombat = recomputeCombatFromStats({
      className,
      baseCombat,
      baseStats,
      stats: (character as any).stats,
    });
    (character as any).combatStats = { ...(character as any).combatStats, ...newCombat };

    await character.save();

    // 6) Recalcular los puntos restantes (derivados) tras guardar
    const pointsLeft = computeAvailablePoints(toInt((character as any).level, 1), (character as any).stats, baseStats);

    return res.json({
      message: "Puntos asignados",
      spent,
      pointsLeft,
      stats: (character as any).stats,
      combatStats: (character as any).combatStats,
    });
  } catch (err) {
    console.error("allocatePointsController error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

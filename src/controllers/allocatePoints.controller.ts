// src/controllers/allocatePoints.controller.ts
import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeAvailablePoints, sumAllocations, applyAllocationsToCharacter } from "../services/allocation.service";
import { POINTS_PER_LEVEL } from "../constants/allocateCoeffs";
import type { BaseStats } from "../interfaces/character/CharacterClass.interface";

const DBG = process.env.DEBUG_ALLOCATION === "1";

interface AuthReq extends Request {
  user?: any; // flexible
}

type AllocateBody = {
  characterId?: string;
  allocations: Record<string, number>;
};

/* ------------------------ helpers ------------------------ */

function coerceBaseStats(src: any): BaseStats {
  return {
    strength: Number(src?.strength ?? 0),
    dexterity: Number(src?.dexterity ?? 0),
    intelligence: Number(src?.intelligence ?? 0),
    vitality: Number(src?.vitality ?? 0),
    physicalDefense: Number(src?.physicalDefense ?? 0),
    magicalDefense: Number(src?.magicalDefense ?? 0),
    luck: Number(src?.luck ?? 0),
    agility: Number(src?.agility ?? 0),
    endurance: Number(src?.endurance ?? 0),
    wisdom: Number(src?.wisdom ?? 0),
  };
}

function toFixedN(n: any, places: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const p = Math.pow(10, places);
  return Math.round(v * p) / p;
}

// Redondeo “para respuesta” de deltaCombat (no toca DB)
function roundDeltaCombatForResponse(delta: Record<string, number> = {}) {
  const d = { ...delta };

  // enteros
  if (d.maxHP != null) d.maxHP = Math.round(d.maxHP);
  if (d.blockChance != null) d.blockChance = Math.round(d.blockChance);

  // 1 decimal
  if (d.attackPower != null) d.attackPower = toFixedN(d.attackPower, 1);
  if (d.magicPower != null) d.magicPower = toFixedN(d.magicPower, 1);
  if (d.criticalDamageBonus != null) d.criticalDamageBonus = toFixedN(d.criticalDamageBonus, 1);

  // 2 decimales
  if (d.attackSpeed != null) d.attackSpeed = toFixedN(d.attackSpeed, 2);
  if (d.evasion != null) d.evasion = toFixedN(d.evasion, 2);
  if (d.criticalChance != null) d.criticalChance = toFixedN(d.criticalChance, 2);
  if (d.blockValue != null) d.blockValue = toFixedN(d.blockValue, 2);
  if (d.damageReduction != null) d.damageReduction = toFixedN(d.damageReduction, 2);
  if (d.movementSpeed != null) d.movementSpeed = toFixedN(d.movementSpeed, 2);

  // fallback por si aparece otra clave nueva
  for (const k of Object.keys(d)) {
    if (typeof d[k] === "number" && !Number.isInteger(d[k])) {
      if (!["attackPower", "magicPower", "criticalDamageBonus", "attackSpeed", "evasion", "criticalChance", "blockValue", "damageReduction", "movementSpeed"].includes(k)) {
        d[k] = toFixedN(d[k], 2);
      }
    }
  }
  return d;
}

// Redondeo SOLO de evasion y attackSpeed en character.combatStats (respuesta)
function roundCharacterCombatForResponse(cs: Record<string, number> | undefined | null) {
  if (!cs) return cs;
  const c = { ...cs };
  if (c.evasion != null) c.evasion = toFixedN(c.evasion, 2);
  if (c.attackSpeed != null) c.attackSpeed = toFixedN(c.attackSpeed, 2);
  return c;
}

// Obtiene { name, baseStats } de la clase del personaje (via populate o consulta)
async function getClassTemplateFromCharacter(doc: any): Promise<{ name: string; baseStats: BaseStats } | null> {
  const classField = doc?.classId;

  if (classField && typeof classField === "object") {
    const name = classField.name;
    const baseStats = coerceBaseStats(classField.baseStats || {});
    if (name && baseStats) {
      if (DBG) console.log("[ALLOC] Clase via populate:", { name });
      return { name, baseStats };
    }
  }

  const classId = classField && (classField._id || classField);
  if (!classId || !Types.ObjectId.isValid(String(classId))) {
    if (DBG) console.log("[ALLOC] classId inválido/no presente:", classField);
    return null;
  }

  const cls = await CharacterClass.findById(classId).select("name baseStats").lean<{ _id: any; name: string; baseStats: any }>().exec();

  if (!cls) return null;

  if (DBG) console.log("[ALLOC] Clase via query:", { name: cls.name });
  return { name: cls.name, baseStats: coerceBaseStats(cls.baseStats || {}) };
}

/* ------------------------ controller ------------------------ */

export async function allocatePointsController(req: AuthReq, res: Response) {
  try {
    const { characterId, allocations } = (req.body || {}) as AllocateBody;
    if (!allocations || typeof allocations !== "object") {
      return res.status(400).json({ message: "allocations requerido (objeto con puntos por stat)" });
    }

    const auth = req.user || {};
    const candidates = [characterId, auth.characterId, auth.character?._id, auth.characterId?._id, auth.id, auth._id, auth.userId].filter(Boolean);

    if (candidates.length === 0) {
      return res.status(400).json({ message: "Falta characterId o autenticación" });
    }

    let doc: any = null;
    const first = String(candidates[0]);
    if (Types.ObjectId.isValid(first)) {
      doc = await Character.findById(first).populate("classId", "name baseStats").exec();
    }

    if (!doc) {
      for (const cand of candidates) {
        const asStr = String(cand);
        const query: any = { userId: asStr };
        if (Types.ObjectId.isValid(asStr)) query.userId = asStr;
        const tryDoc = await Character.findOne(query).populate("classId", "name baseStats").exec();
        if (tryDoc) {
          doc = tryDoc;
          break;
        }
      }
    }

    if (!doc) return res.status(404).json({ message: "Personaje no encontrado" });

    const cls = await getClassTemplateFromCharacter(doc);
    if (!cls) {
      return res.status(400).json({ message: "No se pudo resolver la clase/baseStats del personaje" });
    }

    const available = computeAvailablePoints(Number(doc.level ?? 1), coerceBaseStats(doc.stats), cls.baseStats);
    const toSpend = sumAllocations(allocations);

    if (toSpend <= 0) {
      return res.status(400).json({ message: "Nada para asignar (suma de allocations <= 0)" });
    }
    if (toSpend > available) {
      return res.status(400).json({ message: `Puntos insuficientes. Disponibles: ${available}, intentas gastar: ${toSpend}` });
    }

    const { applied, deltaStats, deltaCombat } = applyAllocationsToCharacter(
      doc as any,
      cls.name as any, // "Guerrero" | "Asesino" | "Mago" | "Arquero"
      allocations
    );

    await doc.save();

    const remaining = computeAvailablePoints(Number(doc.level ?? 1), coerceBaseStats(doc.stats), cls.baseStats);

    // Redondeos SOLO para respuesta
    const deltaCombatRounded = roundDeltaCombatForResponse(deltaCombat as any);
    const combatStatsRoundedForChar = roundCharacterCombatForResponse(doc.combatStats);

    return res.json({
      ok: true,
      pointsPerLevel: POINTS_PER_LEVEL,
      spentThis: applied,
      deltaStats,
      deltaCombat: deltaCombatRounded, // <- limpio para UI
      availableAfter: remaining,
      character: {
        id: String(doc._id),
        level: doc.level,
        stats: doc.stats,
        combatStats: combatStatsRoundedForChar, // <- evasion/attackSpeed con 2 decimales
        className: cls.name,
      },
    });
  } catch (err: any) {
    console.error("[ALLOC][ERR]", err);
    return res.status(500).json({ message: "Error asignando puntos" });
  }
}

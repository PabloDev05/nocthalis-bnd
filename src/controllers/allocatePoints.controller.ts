/* eslint-disable no-console */
import { Response } from "express";
import mongoose from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";

import {
  ASSIGNABLE_KEYS,
  POINTS_PER_LEVEL,
  computeAvailablePoints,
  applyIncrements,
  type AssignKey,
} from "../services/allocation.service";

import { getAllocateCoeffsForClass } from "../battleSystem/constants/allocateCoeffs";
import {
  ensureWeaponOrDefault,
  isPrimaryWeapon,
  PRIMARY_WEAPON_BONUS_MULT,
  type WeaponData,
} from "../battleSystem/core/Weapon";

/* ───────────────────────── helpers ───────────────────────── */
const toInt = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
};

const CANON_KEYS: AssignKey[] = [...ASSIGNABLE_KEYS];

/** Normaliza: garantiza que cada stat ≥ base (sin alias). */
function seedStatsWithBase(stats: any, base: any) {
  const out: Record<string, number> = { ...(stats || {}) };

  for (const k of CANON_KEYS) {
    const baseVal = Math.max(0, toInt(base?.[k], 0));
    const curVal = toInt(out[k], Number.NaN);
    if (!Number.isFinite(curVal)) out[k] = baseVal;
    else out[k] = Math.max(curVal, baseVal); // nunca bajamos debajo de base
  }
  return out;
}

/** Lee incrementos SOLO de claves exactas (sin alias). */
function readAllocations(body: any) {
  const src = body?.allocations ? body.allocations : body;
  const out: Partial<Record<AssignKey, number>> = {};

  for (const k of CANON_KEYS) {
    const raw = src?.[k];
    const n = Math.max(0, toInt(raw, 0));
    if (n > 0) out[k] = n;
  }
  return out;
}

/** Aplica el delta de combate (todos enteros) según allocateCoeffs. */
function applyCombatDeltaFromInc(
  combat: any,
  inc: Partial<Record<AssignKey, number>>,
  className?: string
) {
  const coeffs = getAllocateCoeffsForClass(className);

  // Acumuladores (todos enteros)
  const delta = {
    maxHP: 0,
    attackPower: 0,
    magicPower: 0,
    blockValue: 0,
    evasion: 0,
    damageReduction: 0,
    blockChance: 0,
    criticalChance: 0,
    criticalDamageBonus: 0,
    attackSpeed: 0,
  };

  for (const key of CANON_KEYS) {
    const add = Math.max(0, toInt(inc[key] ?? 0));
    if (!add) continue;

    const c = (coeffs as any)[key];
    if (!c) continue;

    // Stats base (defensas planas)
    if (c.stats) {
      for (const sk of Object.keys(c.stats)) {
        // Si tu diseño actual guarda DEF planas en stats, las tocarías afuera.
        // Aquí solo sumamos combate; las planas se reflejan luego en el snapshot/calculadora.
      }
    }

    // Combate puro
    if (c.combat) {
      for (const field of Object.keys(delta) as (keyof typeof delta)[]) {
        const perPoint = toInt((c.combat as any)[field] ?? 0, 0);
        if (!perPoint) continue;
        (delta as any)[field] += perPoint * add;
      }
    }
  }

  const next = { ...(combat || {}) };

  next.maxHP = Math.max(1, toInt((next.maxHP ?? 0) + delta.maxHP));
  next.attackPower = toInt((next.attackPower ?? 0) + delta.attackPower);
  next.magicPower = toInt((next.magicPower ?? 0) + delta.magicPower);

  // Resto de campos: enteros y suma directa
  const bump = (cur: any, d: number) => toInt((toInt(cur, 0) + d), 0);
  next.evasion = bump(next.evasion, delta.evasion);
  next.damageReduction = bump(next.damageReduction, delta.damageReduction);
  next.blockChance = bump(next.blockChance, delta.blockChance);
  next.criticalChance = bump(next.criticalChance, delta.criticalChance);
  next.criticalDamageBonus = bump(next.criticalDamageBonus, delta.criticalDamageBonus);
  next.attackSpeed = bump(next.attackSpeed, delta.attackSpeed);

  return next;
}

/** Daño UI según arma por defecto/primaria. */
function computeUiDamageRange(
  character: any,
  classMeta?: { primaryWeapons?: string[] | null; defaultWeapon?: string | null }
) {
  const equip = character?.equipment ?? {};
  const candidates = [
    character?.weapon,
    equip?.weapon,
    equip?.mainWeapon,
    equip?.mainHand,
    equip?.weaponName,
    equip?.weapon?.slug,
    equip?.mainWeapon?.slug,
    equip?.mainHand?.slug,
  ].filter(Boolean);

  const w: WeaponData = candidates.length
    ? ensureWeaponOrDefault(candidates[0])
    : ensureWeaponOrDefault(null, classMeta?.defaultWeapon || undefined);

  const primary = isPrimaryWeapon(w, classMeta?.primaryWeapons || undefined);
  const mult = primary ? PRIMARY_WEAPON_BONUS_MULT : 1;

  return {
    uiDamageMin: Math.floor((w?.minDamage ?? 0) * mult),
    uiDamageMax: Math.floor((w?.maxDamage ?? 0) * mult),
  };
}

/* ───────────────────────── core ───────────────────────── */
async function allocateWithSession(
  userId: string,
  incRaw: Record<string, number>,
  session?: mongoose.ClientSession
) {
  const character = await Character.findOne({ userId })
    .select("level stats combatStats classId equipment")
    .session(session ?? null);

  if (!character) {
    return { ok: false as const, error: { code: 404, message: "Personaje no encontrado" } };
  }

  const cls = await CharacterClass.findById(character.classId)
    .select("name baseStats primaryWeapons defaultWeapon")
    .lean()
    .session(session ?? null);

  if (!cls) {
    return { ok: false as const, error: { code: 400, message: "Clase base no encontrada" } };
  }

  const className = (cls as any).name as string | undefined;

  // Stats mínimas = base
  const seeded = seedStatsWithBase(character.stats, (cls as any).baseStats);
  const seededChanged = JSON.stringify(seeded) !== JSON.stringify(character.stats);
  if (seededChanged) character.stats = seeded;

  // Leer increments exactos
  const inc = readAllocations(incRaw);

  const level = Number(character.level ?? 1);
  const available = computeAvailablePoints(level, character.stats, (cls as any).baseStats);

  const spentNow = Object.values(inc).reduce((a, b) => a + (b || 0), 0);
  if (spentNow <= 0) {
    return { ok: false as const, error: { code: 400, message: "No se enviaron asignaciones válidas" } };
  }
  if (available < spentNow) {
    return {
      ok: false as const,
      error: {
        code: 400,
        message: "Puntos insuficientes",
        details: { available, requested: spentNow, perLevel: POINTS_PER_LEVEL },
      },
    };
  }

  // Aplicar increments a stats
  character.stats = applyIncrements(character.stats, inc);

  // Delta de combate según clase (coeficientes enteros)
  character.combatStats = applyCombatDeltaFromInc(character.combatStats, inc, className);

  // Recalcular rango de daño visual (arma por defecto/primaria)
  const { uiDamageMin, uiDamageMax } = computeUiDamageRange(character, {
    primaryWeapons: (cls as any).primaryWeapons ?? null,
    defaultWeapon: (cls as any).defaultWeapon ?? null,
  });
  (character as any).uiDamageMin = uiDamageMin;
  (character as any).uiDamageMax = uiDamageMax;

  await character.save({ session });

  const pointsLeft = computeAvailablePoints(level, character.stats, (cls as any).baseStats);

  return {
    ok: true as const,
    payload: {
      message: "Puntos asignados",
      spent: spentNow,
      pointsLeft,
      perLevel: POINTS_PER_LEVEL,
      stats: character.stats,
      combatStats: character.combatStats,
      ui: { damageMin: uiDamageMin, damageMax: uiDamageMax },
    },
  };
}

/* ───────────────────────── controller ────────────────────── */
export async function allocatePointsController(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const inc = readAllocations(req.body || {});
    const spentNow = Object.values(inc).reduce((a, b) => a + (b || 0), 0);
    if (spentNow <= 0) {
      return res.status(400).json({ message: "No se enviaron asignaciones válidas" });
    }

    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();

      let result:
        | Awaited<ReturnType<typeof allocateWithSession>>
        | { ok: false; error: { code: 400; message: string } } = {
        ok: false,
        error: { code: 400, message: "Transacción no ejecutada" },
      };

      await session.withTransaction(async () => {
        const r = await allocateWithSession(userId, req.body || {}, session!);
        result = r;
        if (!r.ok) {
          const err: any = new Error(r.error.message);
          err.statusCode = r.error.code;
          err.details = (r as any).error?.details;
          throw err;
        }
      });

      await session.endSession().catch(() => {});
      return (result as any).ok
        ? res.json((result as any).payload)
        : res.status((result as any).error.code).json({ message: (result as any).error.message });
    } catch (txErr: any) {
      try { await session?.endSession(); } catch {}

      const isNoTx =
        txErr?.code === 20 ||
        /Transaction numbers are only allowed on a replica set member or mongos/i.test(
          String(txErr?.message || "")
        );

      if (!isNoTx && txErr?.statusCode) {
        return res.status(txErr.statusCode).json({
          message: txErr.message,
          ...(txErr.details ?? {}),
        });
      }

      // Fallback sin transacción
      const r = await allocateWithSession(userId, req.body || {}, undefined);
      return r.ok
        ? res.json(r.payload)
        : res.status(r.error.code).json({ message: r.error.message, ...(r as any).error?.details });
    }
  } catch (err) {
    console.error("allocatePointsController error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default allocatePointsController;

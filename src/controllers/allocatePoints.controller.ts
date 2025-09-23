/* eslint-disable no-console */
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { ASSIGNABLE_KEYS, POINTS_PER_LEVEL, computeAvailablePoints, applyIncrements, type AssignKey } from "../services/allocation.service";
import { getAllocateCoeffsForClass } from "../battleSystem/constants/allocateCoeffs";

/* ── helpers num ── */
const toInt = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(toInt(v, lo), lo), hi);

/* ── caps ── */
const CAPS = {
  evasion: 60,
  blockChance: 60,
  damageReduction: 60,
  criticalChance: 50,
  criticalDamageBonus: 300,
  attackSpeedMin: 3,
  attackSpeedMax: 12,
};

/* ── claves/alias ── */
const CANON_KEYS: AssignKey[] = [...ASSIGNABLE_KEYS];
const CANON_SET = new Set<AssignKey>(CANON_KEYS);

const ALIAS: Record<string, AssignKey> = {
  str: "strength",
  strength: "strength",
  dex: "dexterity",
  dexterity: "dexterity",
  int: "intelligence",
  intelligence: "intelligence",
  con: "constitution",
  vit: "constitution",
  constitution: "constitution",
  pdef: "physicalDefense",
  physicaldefense: "physicalDefense",
  mdef: "magicalDefense",
  magicaldefense: "magicalDefense",
  luk: "luck",
  luck: "luck",
  end: "endurance",
  endurance: "endurance",
  fate: "fate",
};

/* ── logging ── */
type LogCtx = { userId?: string; charId?: string; className?: string };
const tag = (ctx: LogCtx) => `[ALLOC uid=${ctx.userId ?? "?"} cid=${ctx.charId ?? "?"} ts=${new Date().toISOString().replace("T", " ").replace("Z", "")}]`;
const j = (x: any) => {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
};

/* ── alias → canon ── */
function canonKey(k: string | undefined | null): AssignKey | null {
  if (!k) return null;
  const low = String(k).trim().toLowerCase();
  const mapped = ALIAS[low];
  return mapped && CANON_SET.has(mapped) ? mapped : null;
}

/* ── parse body → inc ── */
function readAllocations(ctx: { userId?: string; charId?: string }, body: any) {
  console.log(tag(ctx), "req.body:", j(body));

  const src = body?.allocations ? body.allocations : body;
  const out: Partial<Record<AssignKey, number>> = {};

  for (const k of CANON_KEYS) {
    const n = Math.max(0, toInt(src?.[k], 0));
    if (n > 0) out[k] = (out[k] || 0) + n;
  }
  for (const [k, v] of Object.entries(src || {})) {
    if (CANON_SET.has(k as AssignKey)) continue;
    const ck = canonKey(k);
    if (!ck) continue;
    const n = Math.max(0, toInt(v, 0));
    if (n > 0) out[ck] = (out[ck] || 0) + n;
  }

  console.log(tag(ctx), "parsed inc:", j(out));
  return out;
}

/* ── delta combate ── */
function applyCombatDeltaFromInc(ctx: { userId?: string; charId?: string; className?: string }, combat: any, inc: Partial<Record<AssignKey, number>>, className?: string) {
  const coeffs = getAllocateCoeffsForClass(className);
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

  // console.log(tag(ctx), "applyCombatDeltaFromInc inc=", j(inc), "className=", className || "-");

  for (const key of CANON_KEYS) {
    const add = Math.max(0, toInt(inc[key] ?? 0));
    if (!add) continue;
    const c = (coeffs as any)[key];
    if (!c?.combat) continue;
    for (const field of Object.keys(delta) as (keyof typeof delta)[]) {
      const per = toInt((c.combat as any)[field] ?? 0, 0);
      if (!per) continue;
      delta[field] += per * add;
    }
  }

  // console.log(tag(ctx), "combat delta computed:", j(delta));

  const next = { ...(combat || {}) };

  // absolutos
  const beforeAbs = {
    maxHP: toInt(next.maxHP ?? 0),
    attackPower: toInt(next.attackPower ?? 0),
    magicPower: toInt(next.magicPower ?? 0),
    blockValue: toInt(next.blockValue ?? 0),
  };

  next.maxHP = Math.max(1, toInt((next.maxHP ?? 0) + delta.maxHP, 1));
  next.attackPower = toInt((next.attackPower ?? 0) + delta.attackPower, 0);
  next.magicPower = toInt((next.magicPower ?? 0) + delta.magicPower, 0);
  next.blockValue = toInt((next.blockValue ?? 0) + delta.blockValue, 0);

  // porcentuales con caps
  const bump = (cur: any, d: number) => toInt(toInt(cur, 0) + d, 0);

  const beforePct = {
    evasion: toInt(next.evasion ?? 0),
    damageReduction: toInt(next.damageReduction ?? 0),
    blockChance: toInt(next.blockChance ?? 0),
    criticalChance: toInt(next.criticalChance ?? 0),
    criticalDamageBonus: toInt(next.criticalDamageBonus ?? 0),
    attackSpeed: toInt(next.attackSpeed ?? 0),
  };

  next.evasion = clamp(bump(next.evasion, delta.evasion), 0, CAPS.evasion);
  next.damageReduction = clamp(bump(next.damageReduction, delta.damageReduction), 0, CAPS.damageReduction);
  next.blockChance = clamp(bump(next.blockChance, delta.blockChance), 0, CAPS.blockChance);
  next.criticalChance = clamp(bump(beforePct.criticalChance, delta.criticalChance), 0, CAPS.criticalChance);
  next.criticalDamageBonus = clamp(bump(next.criticalDamageBonus, delta.criticalDamageBonus), 0, CAPS.criticalDamageBonus);

  if (delta.attackSpeed !== 0) {
    next.attackSpeed = clamp(bump(next.attackSpeed, delta.attackSpeed), CAPS.attackSpeedMin, CAPS.attackSpeedMax);
  } else {
    next.attackSpeed = toInt(next.attackSpeed ?? 0, 0);
  }

  const afterPct = {
    evasion: toInt(next.evasion ?? 0),
    damageReduction: toInt(next.damageReduction ?? 0),
    blockChance: toInt(next.blockChance ?? 0),
    criticalChance: toInt(next.criticalChance ?? 0),
    criticalDamageBonus: toInt(next.criticalDamageBonus ?? 0),
    attackSpeed: toInt(next.attackSpeed ?? 0),
  };

  // console.log(
  //   tag(ctx),
  //   "combat abs before→after",
  //   j(beforeAbs),
  //   "→",
  //   j({
  //     maxHP: next.maxHP,
  //     attackPower: next.attackPower,
  //     magicPower: next.magicPower,
  //     blockValue: next.blockValue,
  //   }),
  //   "| pct before→after",
  //   j(beforePct),
  //   "→",
  //   j(afterPct)
  // );

  return next;
}

/* ── núcleo con plainificación de subdocs ── */
async function allocateWithSession(userId: string, incRaw: Record<string, number>, session?: mongoose.ClientSession) {
  const ctxBase = { userId };

  const character = await Character.findOne({ userId })
    .select("level stats combatStats classId currentHP")
    .session(session ?? null);

  if (!character) {
    console.warn(tag(ctxBase), "404 Character no encontrado");
    return { ok: false as const, error: { code: 404, message: "Personaje no encontrado" } };
  }

  const ctx = { ...ctxBase, charId: String(character._id) };

  const cls = await CharacterClass.findById(character.classId)
    .select("name baseStats")
    .lean()
    .session(session ?? null);

  if (!cls) {
    // console.warn(tag(ctx), "400 Clase base no encontrada");
    return { ok: false as const, error: { code: 400, message: "Clase base no encontrada" } };
  }

  const className = (cls as any).name as string | undefined;

  // 🔴 parse increments
  const inc = readAllocations(ctx, incRaw);
  const spentNow = Object.values(inc).reduce((a, b) => a + (b || 0), 0);
  if (spentNow <= 0) {
    // console.warn(tag(ctx), "400 No se enviaron asignaciones válidas", j(inc));
    return { ok: false as const, error: { code: 400, message: "No se enviaron asignaciones válidas" } };
  }

  // 🔴 PLAIN STATS para evitar el “reset a 1”
  const statsPlain = typeof (character as any).stats?.toObject === "function" ? (character as any).stats.toObject() : JSON.parse(JSON.stringify((character as any).stats || {}));

  const level = Number(character.level ?? 1);
  const available = computeAvailablePoints(level, statsPlain, (cls as any).baseStats || {});

  // console.log(tag({ ...ctx, className }), "BEFORE | level=", level, "| available=", available, "| inc=", j(inc), "| stats=", j(statsPlain), "| combat=", j((character as any).combatStats || {}));

  if (available < spentNow) {
    console.warn(tag(ctx), "400 Puntos insuficientes", "| available=", available, "| requested=", spentNow, "| perLevel=", POINTS_PER_LEVEL);
    return {
      ok: false as const,
      error: { code: 400, message: "Puntos insuficientes", details: { available, requested: spentNow, perLevel: POINTS_PER_LEVEL } },
    };
  }

  /* 1) stats planos (partiendo de plain) */
  const nextStats = applyIncrements(statsPlain, inc);
  // console.log(tag(ctx), "applyIncrements stats before→after", j(statsPlain), "→", j(nextStats));
  character.set("stats", nextStats, { strict: false });
  character.markModified("stats");

  /* 2) combate */
  const prevCombat = (character as any).combatStats || {};
  const prevMaxHP = toInt(prevCombat?.maxHP ?? 1, 1);
  const nextCombat = applyCombatDeltaFromInc({ ...ctx, className }, prevCombat, inc, className);
  character.set("combatStats", nextCombat, { strict: false });
  character.markModified("combatStats");

  /* 3) currentHP clamp (no tocamos maxHP exótico) */
  const newMaxHP = toInt(nextCombat?.maxHP ?? prevMaxHP, 1);
  const curHP = toInt((character as any).currentHP ?? newMaxHP, newMaxHP);
  (character as any).currentHP = clamp(curHP, 1, newMaxHP);

  // console.log(tag(ctx), "AFTER (pre-save)", "| stats=", j(nextStats), "| combat=", j(nextCombat), "| currentHP=", (character as any).currentHP);

  await character.save({ session });

  // console.log(tag(ctx), "AFTER (saved)", "| stats=", j(character.stats), "| combat=", j(character.combatStats), "| currentHP=", (character as any).currentHP);

  const pointsLeft = computeAvailablePoints(
    level,
    // volver a plain para cálculo consistente post-save
    typeof (character as any).stats?.toObject === "function" ? (character as any).stats.toObject() : JSON.parse(JSON.stringify((character as any).stats || {})),
    (cls as any).baseStats || {}
  );

  console.log(tag(ctx), "POINTS left after save:", pointsLeft);

  return {
    ok: true as const,
    payload: {
      message: "Puntos asignados",
      spent: spentNow,
      pointsLeft,
      perLevel: POINTS_PER_LEVEL,
      stats: character.stats,
      combatStats: character.combatStats,
      currentHP: (character as any).currentHP,
    },
  };
}

/* ── controller ── */
export async function allocatePointsController(req: Request & { user?: any }, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // console.warn("[ALLOC uid=?] 401 No autenticado");
      return res.status(401).json({ message: "No autenticado" });
    }

    // console.log(tag({ userId }), "HTTP POST /character/allocate");

    const incPreview = readAllocations({ userId }, req.body || {});
    const spentNow = Object.values(incPreview).reduce((a, b) => a + (b || 0), 0);
    if (spentNow <= 0) {
      // console.warn(tag({ userId }), "400 Body sin asignaciones válidas", j(req.body));
      return res.status(400).json({ message: "No se enviaron asignaciones válidas" });
    }

    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      let result: Awaited<ReturnType<typeof allocateWithSession>> | any = {
        ok: false,
        error: { code: 400, message: "Tx no ejecutada" },
      };

      await session.withTransaction(async () => {
        const r = await allocateWithSession(userId, req.body || {}, session!);
        result = r;
        if (!r.ok) {
          const err: any = new Error(r.error.message);
          err.statusCode = r.error.code;
          throw err;
        }
      });

      await session.endSession().catch(() => {});
      // console.log(tag({ userId }), "TX OK result.ok=", (result || {}).ok);
      return result.ok ? res.json(result.payload) : res.status(result.error.code).json({ message: result.error.message });
    } catch (txErr: any) {
      console.warn(tag({ userId }), "TX FAIL → fallback sin transacción:", txErr?.message);
      try {
        await session?.endSession();
      } catch {}

      const isNoTx = txErr?.code === 20 || /replica set member|mongos/i.test(String(txErr?.message || ""));
      if (!isNoTx && txErr?.statusCode) {
        // console.warn(tag({ userId }), "HTTP error (txErr.statusCode)", txErr?.statusCode);
        return res.status(txErr.statusCode).json({ message: txErr.message });
      }

      const r = await allocateWithSession(userId, req.body || {}, undefined);
      // console.log(tag({ userId }), "fallback result.ok=", r.ok);
      return r.ok ? res.json(r.payload) : res.status(r.error.code).json({ message: r.error.message });
    }
  } catch (err) {
    console.error("[ALLOC] allocatePointsController error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

export default allocatePointsController;

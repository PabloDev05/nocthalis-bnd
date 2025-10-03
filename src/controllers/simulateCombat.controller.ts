// src/controllers/simulateCombat.controller.ts
// Simulación y resolución de combates PvP (nuevo sistema)

import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { Match } from "../models/Match";
import { Character } from "../models/Character";
import { runPvp } from "../battleSystem";
import { computeProgression } from "../services/progression.service";
import { TimelineEvent } from "../battleSystem/pvp/pvpRunner";

/** Versión de runner (Fate/procs/ultimate) */
const RUNNER_VERSION = 4; // ↑ bump: DOT visible + turns del runner + finalHP

/* ───────────────── helpers de log ───────────────── */
const safeId = (v: any) => {
  try {
    const s = String(v ?? "");
    return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
  } catch {
    return String(v ?? "");
  }
};
const asBool = (v: any) => (v ? "true" : "false");

function mapOutcomeForMatch(outcome: "win" | "lose" | "draw") {
  return outcome === "win" ? "attacker" : outcome === "lose" ? "defender" : "draw";
}

function computePvpRewards(outcome: "win" | "lose" | "draw") {
  if (outcome === "win") {
    return {
      attacker: { xp: 25, gold: 20, honorDelta: +10 },
      defender: { xp: 12, gold: 10, honorDelta: -8 },
      responseForAttacker: { xpGained: 25, goldGained: 20, honorDelta: +10 },
    };
  }
  if (outcome === "lose") {
    return {
      attacker: { xp: 12, gold: 10, honorDelta: -8 },
      defender: { xp: 25, gold: 20, honorDelta: +10 },
      responseForAttacker: { xpGained: 12, goldGained: 10, honorDelta: -8 },
    };
  }
  return {
    attacker: { xp: 18, gold: 12, honorDelta: 0 },
    defender: { xp: 18, gold: 12, honorDelta: 0 },
    responseForAttacker: { xpGained: 18, goldGained: 12, honorDelta: 0 },
  };
}

/** Compatibilidad: campos de puntos según esquema viejo */
const POINTS_FIELDS = ["availablePoints", "statPoints", "unallocatedPoints", "pointsAvailable", "attributePoints"] as const;
const ATTR_POINTS_PER_LEVEL = 5;

async function applyRewardsToCharacter(charId: any | undefined, userId: any | undefined, rw: { xp?: number; gold?: number; honorDelta?: number }) {
  console.log(`[PVP][Rewards] apply → charId=${safeId(charId)} userId=${safeId(userId)} rw=`, rw);

  let doc = (charId && (await Character.findById(charId))) || (userId && (await Character.findOne({ userId })));

  if (!doc) {
    console.log(`[PVP][Rewards] character NOT FOUND for charId=${safeId(charId)} userId=${safeId(userId)}`);
    return { updated: false };
  }

  // sumas planas
  if (typeof (doc as any).experience === "number" && typeof rw.xp === "number") {
    (doc as any).experience += rw.xp;
  }
  if (typeof rw.gold === "number" && rw.gold > 0) {
    if (typeof (doc as any).gold === "number") (doc as any).gold += rw.gold;
    else if (typeof (doc as any).coins === "number") (doc as any).coins += rw.gold;
  }
  if (typeof rw.honorDelta === "number" && typeof (doc as any).honor === "number") {
    (doc as any).honor += rw.honorDelta;
  }

  // recalcular nivel
  const prevLevel = Number((doc as any).level ?? 1);
  const totalXP = Number((doc as any).experience ?? 0);
  const prog = computeProgression(totalXP, prevLevel);
  const newLevel = Number(prog?.level ?? prevLevel);

  if (newLevel > prevLevel) {
    (doc as any).level = newLevel;

    // asignar puntos de atributos
    const gained = (newLevel - prevLevel) * ATTR_POINTS_PER_LEVEL;
    for (const f of POINTS_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(doc, f)) {
        (doc as any)[f] = Math.max(0, Math.floor(Number((doc as any)[f] ?? 0))) + gained;
        break;
      }
    }
    console.log(`[PVP][Rewards] level up → ${prevLevel} → ${newLevel} (+${gained} pts)`);
  }

  await doc.save();
  console.log(`[PVP][Rewards] character updated OK: ${safeId((doc as any)?._id)}`);
  return { updated: true, characterId: (doc as any)._id };
}

/* ───────────────── normalizeTimeline (compat DB + block details + overkill) ───────────────── */
/**
 * - damage: siempre número (evita ValidationError del schema)
 * - damageObj.final/damageNumber: helpers para el front
 * - block:*: preBlock, blockedAmount, finalAfterBlock, drReducedPercent, finalAfterDR (y en breakdown)
 * - overkill: daño que excede la vida previa del objetivo (usa HP iniciales del match para el 1er evento)
 */
function normalizeTimeline(items: any[], initHP?: { attackerStart?: number; defenderStart?: number }) {
  const arr = Array.isArray(items) ? items : [];
  const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : undefined);

  // HP previos al evento (se actualizan tras cada item)
  let prevAttHP = Number.isFinite(initHP?.attackerStart) ? Math.max(0, Number(initHP!.attackerStart)) : undefined;
  let prevDefHP = Number.isFinite(initHP?.defenderStart) ? Math.max(0, Number(initHP!.defenderStart)) : undefined;

  return arr.map((it, idx) => {
    const source = (it.source ?? it.actor ?? "attacker") as "attacker" | "defender";
    const turn = Number.isFinite(Number(it.turn)) ? Math.trunc(it.turn) : idx + 1;

    // HP reportados luego del evento (post)
    const attackerHP_post = Math.max(0, Number(it.attackerHP ?? it.playerHP ?? 0));
    const defenderHP_post = Math.max(0, Number(it.defenderHP ?? it.enemyHP ?? 0));

    const evRaw = (it.event as TimelineEvent | string) || "hit";
    const isNonImpact = evRaw === "passive_proc" || evRaw === "ultimate_cast" || evRaw === "dot_tick";

    // daño final/crudo
    const dmgObj = it.damage && typeof it.damage === "object" ? it.damage : undefined;
    const bdSrc = (dmgObj?.breakdown ?? it.breakdown) || {};
    const finalDamage = toNum(dmgObj?.final) ?? toNum(it.damage) ?? 0;
    const rawDamage = toNum(it.rawDamage) ?? toNum(dmgObj?.raw) ?? toNum(it.damageRaw) ?? toNum(it.intendedDamage) ?? toNum(it.baseDamage) ?? toNum(it.preMitigation);

    // HP del objetivo antes del evento (clave para overkill)
    const targetPrevHP_guess = source === "attacker" ? prevDefHP : prevAttHP;
    // si no tenemos prev aún (primer item), NO usar “post” (que sesga),
    // mejor asumir que el inicio fue la vida máxima (debe venir en initHP)
    const targetPrevHP = Number.isFinite(targetPrevHP_guess as number) ? (targetPrevHP_guess as number) : undefined;

    const computeOverkill = () => {
      if (!Number.isFinite(finalDamage)) return 0;
      if (!Number.isFinite(targetPrevHP)) return 0; // sin HP previo fiable, no inventamos
      return Math.max(0, Math.round((finalDamage as number) - Math.max(0, targetPrevHP as number)));
    };

    /* ── eventos no-impacto (dot/ultimate_cast/passive_proc) ── */
    if (isNonImpact) {
      const uiEvent = evRaw === "dot_tick" ? "dot" : (evRaw as "passive_proc" | "ultimate_cast" | "dot");

      const out = {
        turn,
        source,
        event: uiEvent,
        damage: Math.max(0, finalDamage ?? 0), // (DB: número)
        damageObj: { final: Math.max(0, finalDamage ?? 0) }, // (UI helper)
        attackerHP: attackerHP_post,
        defenderHP: defenderHP_post,
        overkill: uiEvent === "dot" ? computeOverkill() : 0,
        ability: it.ability
          ? {
              kind: it.ability.kind === "ultimate" ? "ultimate" : "passive",
              name: it.ability.name,
              id: it.ability.id,
              durationTurns: Number(it.ability.durationTurns ?? 0),
            }
          : undefined,
        tags: Array.isArray(it.tags) || typeof it.tags === "object" ? it.tags : [],
      };

      // actualizar prev
      prevAttHP = attackerHP_post;
      prevDefHP = defenderHP_post;
      return out;
    }

    /* ── impactos ── */
    let event: "hit" | "crit" | "block" | "miss";
    if (evRaw === "hit" || evRaw === "crit" || evRaw === "block" || evRaw === "miss") {
      event = evRaw as any;
    } else {
      event = (finalDamage ?? 0) > 0 ? "hit" : "miss";
    }

    const blockedExplicit = toNum(it.blockedAmount) ?? toNum(bdSrc.blockedAmount) ?? (typeof it.tags === "object" && !Array.isArray(it.tags) ? toNum((it.tags as any).blockedAmount) : undefined);

    const base: any = {
      turn,
      source,
      event,
      damage: Math.max(0, finalDamage ?? 0), // (DB)
      damageObj: { final: Math.max(0, finalDamage ?? 0) }, // (UI)
      damageNumber: Math.max(0, finalDamage ?? 0), // compat
      attackerHP: attackerHP_post,
      defenderHP: defenderHP_post,
      rawDamage: toNum(rawDamage),
      tags: Array.isArray(it.tags) || typeof it.tags === "object" ? it.tags : [],
      overkill: event === "miss" ? 0 : computeOverkill(),
    };

    if (event === "hit" || event === "crit") {
      const bdOut: any = { ...bdSrc };
      if (toNum(bdOut.blockedAmount) == null && toNum(blockedExplicit) != null) {
        bdOut.blockedAmount = Math.max(0, Math.round(blockedExplicit as number));
      }
      base.breakdown = bdOut;

      prevAttHP = attackerHP_post;
      prevDefHP = defenderHP_post;
      return base;
    }

    if (event === "block") {
      const preBlock = toNum(it.preBlock) ?? toNum(bdSrc.preBlock) ?? toNum(rawDamage);
      const blockReducedPercent = toNum(it.blockReducedPercent) ?? toNum(bdSrc.blockReducedPercent);

      const blockedAmount =
        toNum(blockedExplicit) ??
        (preBlock != null && blockReducedPercent != null
          ? Math.max(0, Math.round(((preBlock as number) * (blockReducedPercent as number)) / 100))
          : rawDamage != null && finalDamage != null
          ? Math.max(0, Math.round((rawDamage as number) - (finalDamage as number)))
          : undefined);

      const finalAfterBlock =
        toNum(it.finalAfterBlock) ?? toNum(bdSrc.finalAfterBlock) ?? (preBlock != null && blockedAmount != null ? Math.max(0, (preBlock as number) - (blockedAmount as number)) : undefined);

      const drReducedPercent = toNum(it.drReducedPercent) ?? toNum(bdSrc.drReducedPercent);
      const finalAfterDR = toNum(it.finalAfterDR) ?? toNum(bdSrc.finalAfterDR) ?? toNum(finalDamage);

      base.blockedAmount = blockedAmount;
      base.preBlock = preBlock;
      base.blockReducedPercent = blockReducedPercent;
      base.finalAfterBlock = finalAfterBlock;
      base.drReducedPercent = drReducedPercent;
      base.finalAfterDR = finalAfterDR;

      base.breakdown = {
        ...(it.breakdown || {}),
        preBlock,
        blockedAmount,
        blockReducedPercent,
        finalAfterBlock,
        drReducedPercent,
        finalAfterDR,
      };

      prevAttHP = attackerHP_post;
      prevDefHP = defenderHP_post;
      return base;
    }

    // MISS
    prevAttHP = attackerHP_post;
    prevDefHP = defenderHP_post;
    return base;
  });
}

/* ---------------- GET /combat/simulate (preview público) ---------------- */
export const simulateCombatPreviewController: RequestHandler = async (req, res) => {
  const matchId = String(req.query.matchId || "");
  console.log(`[PVP][GET /combat/simulate] preview hit matchId=${safeId(matchId)} auth=${asBool(!!req.user)}`);
  try {
    if (!matchId || !Types.ObjectId.isValid(matchId)) {
      console.log(`[PVP][GET preview] 400 invalid matchId`);
      return res.status(400).json({ ok: false, message: "matchId inválido" });
    }

    const match = await Match.findById(matchId).lean();
    if (!match) {
      console.log(`[PVP][GET preview] 404 match not found`);
      return res.status(404).json({ ok: false, message: "Match no encontrado" });
    }

    console.time(`[PVP][GET preview] runPvp ${safeId(matchId)}`);
    const { outcome, timeline, log, snapshots, turns, finalHP } = runPvp({
      attackerSnapshot: (match as any).attackerSnapshot,
      defenderSnapshot: (match as any).defenderSnapshot,
      seed: (match as any).seed,
    } as any);
    console.timeEnd(`[PVP][GET preview] runPvp ${safeId(matchId)}`);

    // Pasar HP iniciales (máximos) para que el overkill del 1er evento sea correcto
    const timelineNorm = normalizeTimeline(timeline, {
      attackerStart: Number(finalHP?.attackerMax ?? 0),
      defenderStart: Number(finalHP?.defenderMax ?? 0),
    });

    console.log(`[PVP][GET preview] OK outcome=${outcome} turns=${turns} seed=${(match as any).seed}`);
    return res.json({
      ok: true,
      outcome,
      turns,
      timeline: timelineNorm,
      log,
      snapshots,
      finalHP,
      runnerVersion: RUNNER_VERSION,
    });
  } catch (err) {
    console.error("[PVP][GET preview] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/* ---------------- POST /combat/simulate (preview, auth) ---------------- */
export const simulateCombatController: RequestHandler = async (req, res) => {
  const { matchId } = (req.body || {}) as { matchId?: string };
  console.log(`[PVP][POST /combat/simulate] hit user=${safeId(req.user?.id)} matchId=${safeId(matchId)}`);
  try {
    if (!matchId || !Types.ObjectId.isValid(matchId)) {
      console.log(`[PVP][POST simulate] 400 invalid matchId`);
      return res.status(400).json({ ok: false, message: "matchId inválido" });
    }

    const match = await Match.findById(matchId).lean();
    if (!match) {
      console.log(`[PVP][POST simulate] 404 match not found`);
      return res.status(404).json({ ok: false, message: "Match no encontrado" });
    }

    console.time(`[PVP][POST simulate] runPvp ${safeId(matchId)}`);
    const { outcome, timeline, log, snapshots, turns, finalHP } = runPvp({
      attackerSnapshot: (match as any).attackerSnapshot,
      defenderSnapshot: (match as any).defenderSnapshot,
      seed: (match as any).seed,
    } as any);
    console.timeEnd(`[PVP][POST simulate] runPvp ${safeId(matchId)}`);

    const timelineNorm = normalizeTimeline(timeline, {
      attackerStart: Number(finalHP?.attackerMax ?? 0),
      defenderStart: Number(finalHP?.defenderMax ?? 0),
    });

    console.log(`[PVP][POST simulate] OK outcome=${outcome} turns=${turns}`);
    return res.json({
      ok: true,
      outcome,
      turns,
      timeline: timelineNorm,
      log,
      snapshots,
      finalHP,
      runnerVersion: RUNNER_VERSION,
    });
  } catch (err) {
    console.error("[PVP][POST simulate] error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/* ---------------- POST /combat/resolve ---------------- */
export const resolveCombatController: RequestHandler = async (req, res) => {
  const callerUserId = req.user?.id;
  const { matchId } = (req.body || {}) as { matchId?: string };
  console.log(`[PVP][POST /combat/resolve] hit user=${safeId(callerUserId)} matchId=${safeId(matchId)}`);

  try {
    if (!callerUserId) {
      console.log("[PVP][resolve] 401 not authenticated");
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    if (!matchId || !Types.ObjectId.isValid(matchId)) {
      console.log("[PVP][resolve] 400 invalid matchId");
      return res.status(400).json({ ok: false, message: "matchId inválido" });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      console.log("[PVP][resolve] 404 match not found");
      return res.status(404).json({ ok: false, message: "Match no encontrado" });
    }

    const mAny = match as any;

    // Solo el atacante puede resolver su match
    if (String(mAny.attackerUserId) !== String(callerUserId)) {
      console.log(`[PVP][resolve] 403 forbidden: attackerUserId=${safeId(mAny.attackerUserId)} caller=${safeId(callerUserId)}`);
      return res.status(403).json({ ok: false, message: "No autorizado" });
    }

    // Idempotente
    if (mAny.status === "resolved") {
      const storedOutcome = (mAny.outcome ?? "draw") as "attacker" | "defender" | "draw";
      const outcomeForAttacker: "win" | "lose" | "draw" = storedOutcome === "attacker" ? "win" : storedOutcome === "defender" ? "lose" : "draw";

      console.log(`[PVP][resolve] already-resolved outcome=${storedOutcome} turns=${mAny.turns}`);
      return res.json({
        ok: true,
        outcome: outcomeForAttacker,
        rewards: mAny.rewards ?? {},
        timeline: Array.isArray(mAny.timeline) ? mAny.timeline : [],
        snapshots: Array.isArray(mAny.snapshots) ? mAny.snapshots : [],
        log: Array.isArray(mAny.log) ? mAny.log : [],
        turns: Number(mAny.turns ?? mAny.timeline?.length ?? 0),
        finalHP: mAny.finalHP ?? undefined,
        alreadyResolved: true,
        runnerVersion: Number(mAny.runnerVersion ?? RUNNER_VERSION),
      });
    }

    // Ejecutar combate
    console.time(`[PVP][resolve] runPvp ${safeId(matchId)}`);
    const { outcome, timeline, log, snapshots, turns, finalHP } = runPvp({
      attackerSnapshot: mAny.attackerSnapshot,
      defenderSnapshot: mAny.defenderSnapshot,
      seed: mAny.seed,
    } as any);
    console.timeEnd(`[PVP][resolve] runPvp ${safeId(matchId)}`);

    const timelineNorm = normalizeTimeline(timeline, {
      attackerStart: Number(finalHP?.attackerMax ?? 0),
      defenderStart: Number(finalHP?.defenderMax ?? 0),
    });
    const rw = computePvpRewards(outcome);

    console.log(`[PVP][resolve] outcome=${outcome} turns=${turns} seed=${mAny.seed} final=${finalHP.attacker}/${finalHP.defender}`);

    // Aplicar recompensas a ambos personajes
    const att = mAny.attackerSnapshot || {};
    const def = mAny.defenderSnapshot || {};
    await Promise.all([applyRewardsToCharacter(att.characterId, att.userId, rw.attacker), applyRewardsToCharacter(def.characterId, def.userId, rw.defender)]);

    // Persistir resultado en el match
    mAny.status = "resolved";
    mAny.outcome = mapOutcomeForMatch(outcome);
    mAny.winner = outcome === "win" ? "player" : outcome === "lose" ? "enemy" : "draw";
    mAny.turns = turns;
    mAny.rewards = {
      xp: rw.responseForAttacker.xpGained,
      gold: rw.responseForAttacker.goldGained,
      honor: rw.responseForAttacker.honorDelta,
    };
    mAny.timeline = timelineNorm;
    mAny.snapshots = Array.isArray(snapshots) ? snapshots : [];
    mAny.log = Array.isArray(log) ? log : [];
    mAny.finalHP = finalHP; // ← útil para UI
    mAny.runnerVersion = RUNNER_VERSION;

    await match.save();
    console.log(`[PVP][resolve] saved OK match=${safeId(matchId)} outcome=${outcome} turns=${turns}`);

    return res.json({
      ok: true,
      outcome,
      rewards: rw.responseForAttacker,
      timeline: timelineNorm,
      snapshots,
      log,
      turns,
      finalHP,
      runnerVersion: RUNNER_VERSION,
    });
  } catch (err: any) {
    console.error("[PVP][resolve] error:", err?.name, err?.message);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

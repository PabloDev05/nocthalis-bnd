// Simulación y resolución de combates PvP (nuevo sistema)
// src/controllers/simulateCombat.controller.ts

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

/* Normalización timeline (mapea dot_tick→dot e infiere blockedAmount) */
function normalizeTimeline(items: any[]) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((it, idx) => {
    const source = (it.source ?? it.actor ?? "attacker") as "attacker" | "defender";
    const turn = Number.isFinite(Number(it.turn)) ? Math.floor(it.turn) : idx + 1;

    const attackerHP = Math.max(0, Number(it.attackerHP ?? it.playerHP ?? 0));
    const defenderHP = Math.max(0, Number(it.defenderHP ?? it.enemyHP ?? 0));

    const ev = (it.event as TimelineEvent) || "hit";

    // Final y raw
    const finalDamage = Number.isFinite(Number(it.damage?.final)) ? Number(it.damage.final) : Number.isFinite(Number(it.damage)) ? Number(it.damage) : 0;
    const rawDamage = Number(it.rawDamage ?? it.damage?.raw ?? it.damageRaw ?? it.intendedDamage ?? it.baseDamage ?? it.preMitigation ?? 0);

    const blockedExplicit = it.breakdown?.blockedAmount ?? it.blockedAmount ?? (typeof it.tags === "object" && !Array.isArray(it.tags) ? (it.tags as any).blockedAmount : undefined);

    const blockedAmount = Number.isFinite(Number(blockedExplicit))
      ? Math.max(0, Math.round(Number(blockedExplicit)))
      : rawDamage > finalDamage
      ? Math.max(0, Math.round(rawDamage - finalDamage))
      : undefined;

    // Eventos “no impacto”
    if (ev === "passive_proc" || ev === "ultimate_cast" || ev === "dot_tick") {
      const uiEvent: any = ev === "dot_tick" ? "dot" : ev;
      return {
        turn,
        source,
        event: uiEvent,
        damage: Math.max(0, finalDamage),
        attackerHP,
        defenderHP,
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
    }

    // Impacto
    const event: "hit" | "crit" | "block" | "miss" = (["hit", "crit", "block", "miss"].includes(ev as any) ? ev : null) || (finalDamage > 0 ? "hit" : "miss");

    const base: any = {
      turn,
      source,
      event,
      damage: Math.max(0, finalDamage),
      attackerHP,
      defenderHP,
      tags: Array.isArray(it.tags) || typeof it.tags === "object" ? it.tags : [],
    };

    if (Number.isFinite(rawDamage)) base.rawDamage = Math.max(0, Math.round(rawDamage));
    if (Number.isFinite(blockedAmount)) {
      base.breakdown = { ...(it.breakdown || {}), blockedAmount: blockedAmount as number };
      if (base.tags && typeof base.tags === "object" && !Array.isArray(base.tags)) {
        (base.tags as any).blockedAmount = blockedAmount;
      }
    }

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

    const timelineNorm = normalizeTimeline(timeline);

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

    const timelineNorm = normalizeTimeline(timeline);

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

    const timelineNorm = normalizeTimeline(timeline);
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

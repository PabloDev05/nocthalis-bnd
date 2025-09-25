/* eslint-disable no-console */
// Simulación y resolución de combates PvP (nuevo sistema)
// src/controllers/simulateCombat.controller.ts
// - Resolve YA NO cobra stamina (el cobro ocurre en /arena/challenges)
// - Preview público (cualquiera puede ver la simulación de un match)
// - Guarda log y snapshots del combate en el match
// - Actualiza stats de personajes y usuarios
// - No guarda historial de combate (CombatResult) como en el sistema viejo
// - No soporta PvE (usar /combat/preview y /combat/resolve del sistema viejo)

import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { Match } from "../models/Match";
import { Character } from "../models/Character";
import { runPvp } from "../battleSystem";
import { computeProgression } from "../services/progression.service";
import { TimelineEvent } from "../battleSystem/pvp/pvpRunner";

/** Versión de runner (Fate/procs/ultimate) */
const RUNNER_VERSION = 3; // ↑ bump por fixes de roles y blockedAmount

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
  let doc = (charId && (await Character.findById(charId))) || (userId && (await Character.findOne({ userId })));

  if (!doc) return { updated: false };

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
  }

  await doc.save();
  return { updated: true, characterId: (doc as any)._id };
}

/* Normalización timeline (además infiere blockedAmount cuando es posible) */
function normalizeTimeline(items: any[]) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((it, idx) => {
    const source = (it.source ?? it.actor ?? "attacker") as "attacker" | "defender";
    const turn = Number.isFinite(Number(it.turn)) ? Math.floor(it.turn) : idx + 1;

    const attackerHP = Math.max(0, Number(it.attackerHP ?? it.playerHP ?? 0));
    const defenderHP = Math.max(0, Number(it.defenderHP ?? it.enemyHP ?? 0));

    const ev = (it.event as TimelineEvent) || "hit";

    // Final y raw por si vienen desde el runner/manager
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
      return {
        turn,
        source,
        event: ev,
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
      // ayuda extra para front que lee tags.obj
      if (base.tags && typeof base.tags === "object" && !Array.isArray(base.tags)) {
        (base.tags as any).blockedAmount = blockedAmount;
      }
    }

    return base;
  });
}

/* ---------------- GET /combat/simulate (preview público) ---------------- */
export const simulateCombatPreviewController: RequestHandler = async (req, res) => {
  try {
    const matchId = String(req.query.matchId || "");
    if (!matchId || !Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ ok: false, message: "matchId inválido" });
    }

    const match = await Match.findById(matchId).lean();
    if (!match) return res.status(404).json({ ok: false, message: "Match no encontrado" });

    const { outcome, timeline, log, snapshots } = runPvp({
      attackerSnapshot: (match as any).attackerSnapshot,
      defenderSnapshot: (match as any).defenderSnapshot,
      seed: (match as any).seed,
      maxRounds: 30,
    });

    const timelineNorm = normalizeTimeline(timeline);

    return res.json({
      ok: true,
      outcome,
      turns: timelineNorm.length,
      timeline: timelineNorm,
      log,
      snapshots,
      runnerVersion: RUNNER_VERSION,
    });
  } catch (err) {
    console.error("GET /combat/simulate (preview) error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/* ---------------- POST /combat/simulate (preview, auth) ---------------- */
export const simulateCombatController: RequestHandler = async (req, res) => {
  try {
    const { matchId } = req.body as { matchId?: string };
    if (!matchId || !Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ ok: false, message: "matchId inválido" });
    }

    const match = await Match.findById(matchId).lean();
    if (!match) return res.status(404).json({ ok: false, message: "Match no encontrado" });

    const { outcome, timeline, log, snapshots } = runPvp({
      attackerSnapshot: (match as any).attackerSnapshot,
      defenderSnapshot: (match as any).defenderSnapshot,
      seed: (match as any).seed,
      maxRounds: 30,
    });

    const timelineNorm = normalizeTimeline(timeline);

    return res.json({
      ok: true,
      outcome,
      turns: timelineNorm.length,
      timeline: timelineNorm,
      log,
      snapshots,
      runnerVersion: RUNNER_VERSION,
    });
  } catch (err) {
    console.error("POST /combat/simulate error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/* ---------------- POST /combat/resolve ---------------- */
export const resolveCombatController: RequestHandler = async (req, res) => {
  try {
    const callerUserId = req.user?.id;
    if (!callerUserId) return res.status(401).json({ ok: false, message: "No autenticado" });

    const { matchId } = req.body as { matchId?: string };
    if (!matchId || !Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ ok: false, message: "matchId inválido" });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ ok: false, message: "Match no encontrado" });

    const mAny = match as any;

    // Solo el atacante puede resolver su match
    if (String(mAny.attackerUserId) !== String(callerUserId)) {
      return res.status(403).json({ ok: false, message: "No autorizado" });
    }

    // Idempotente: si ya está resuelto devolvemos lo guardado
    if (mAny.status === "resolved") {
      const storedOutcome = (mAny.outcome ?? "draw") as "attacker" | "defender" | "draw";
      const outcomeForAttacker: "win" | "lose" | "draw" = storedOutcome === "attacker" ? "win" : storedOutcome === "defender" ? "lose" : "draw";

      return res.json({
        ok: true,
        outcome: outcomeForAttacker,
        rewards: mAny.rewards ?? {},
        timeline: Array.isArray(mAny.timeline) ? mAny.timeline : [],
        snapshots: Array.isArray(mAny.snapshots) ? mAny.snapshots : [],
        log: Array.isArray(mAny.log) ? mAny.log : [],
        turns: Number(mAny.turns ?? mAny.timeline?.length ?? 0),
        alreadyResolved: true,
        runnerVersion: Number(mAny.runnerVersion ?? RUNNER_VERSION),
      });
    }

    // ⛔️ Ya NO se descuenta stamina aquí. El gasto se hace en /arena/challenges.

    const { outcome, timeline, log, snapshots } = runPvp({
      attackerSnapshot: mAny.attackerSnapshot,
      defenderSnapshot: mAny.defenderSnapshot,
      seed: mAny.seed,
      maxRounds: 30,
    });

    const timelineNorm = normalizeTimeline(timeline);
    const rw = computePvpRewards(outcome);

    // Aplicar recompensas a ambos personajes
    const att = mAny.attackerSnapshot || {};
    const def = mAny.defenderSnapshot || {};
    await Promise.all([applyRewardsToCharacter(att.characterId, att.userId, rw.attacker), applyRewardsToCharacter(def.characterId, def.userId, rw.defender)]);

    // Persistir resultado en el match
    mAny.status = "resolved";
    mAny.outcome = mapOutcomeForMatch(outcome);
    mAny.winner = outcome === "win" ? "player" : outcome === "lose" ? "enemy" : "draw";
    mAny.turns = timelineNorm.length;
    mAny.rewards = {
      xp: rw.responseForAttacker.xpGained,
      gold: rw.responseForAttacker.goldGained,
      honor: rw.responseForAttacker.honorDelta,
    };
    mAny.timeline = timelineNorm;
    mAny.snapshots = Array.isArray(snapshots) ? snapshots : [];
    mAny.log = Array.isArray(log) ? log : [];
    mAny.runnerVersion = RUNNER_VERSION;

    await match.save();

    return res.json({
      ok: true,
      outcome,
      rewards: rw.responseForAttacker,
      timeline: timelineNorm,
      snapshots,
      log,
      turns: timelineNorm.length,
      runnerVersion: RUNNER_VERSION,
    });
  } catch (err: any) {
    console.error("POST /combat/resolve error:", err?.name, err?.message);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

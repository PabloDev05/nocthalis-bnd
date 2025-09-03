// src/controllers/simulateCombat.controller.ts
/* eslint-disable no-console */
import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { Match } from "../models/Match";
import { Character } from "../models/Character";
import { runPvp } from "../battleSystem";
import { computeProgression } from "../services/progression.service";
import { spendStamina, getStaminaByUserId } from "../services/stamina.service";

/** Costo de stamina por pelea PvP (se cobra al resolver) */
const STAMINA_COST_PVP = 10;

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

/** Compat: si tenés un campo de puntos en la DB, lo incrementamos en level-up */
const POINTS_FIELDS = ["availablePoints", "statPoints", "unallocatedPoints", "pointsAvailable", "attributePoints"] as const;
const ATTR_POINTS_PER_LEVEL = 5;

/** Aplica recompensas + actualiza level si corresponde */
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

  // recalcular nivel segun XP total (misma curva que /character/progression)
  const prevLevel = Number((doc as any).level ?? 1);
  const totalXP = Number((doc as any).experience ?? 0);
  const prog = computeProgression(totalXP, prevLevel);
  const newLevel = Number(prog?.level ?? prevLevel);

  if (newLevel > prevLevel) {
    (doc as any).level = newLevel;

    // Compat opcional: si existe alguno de estos campos, asignamos puntos
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

/* ---------- normalización de timeline para cumplir schema ---------- */
type TLIn =
  | {
      turn?: number;
      source?: "attacker" | "defender";
      actor?: "attacker" | "defender";
      event?: "hit" | "crit" | "block" | "miss" | "passive_proc" | "ultimate_cast";
      damage?: number;
      attackerHP?: number;
      defenderHP?: number;
      playerHP?: number;
      enemyHP?: number;
      events?: string[];
      ability?: {
        kind?: "passive" | "ultimate";
        name?: string;
        id?: string;
        durationTurns?: number;
      };
      tags?: string[];
    }
  | any;

const toInt = (v: any, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : (def as any);
};

function normalizeTimeline(items: TLIn[] | undefined | null) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((it, idx) => {
    const source = (it.source ?? it.actor ?? "attacker") as "attacker" | "defender";
    const turn = toInt(it.turn ?? idx + 1, idx + 1);

    // HPs: aceptar player/enemy (legacy) o attacker/defender directos
    let attackerHP = toInt(it.attackerHP, NaN);
    let defenderHP = toInt(it.defenderHP, NaN);
    if (!Number.isFinite(attackerHP) || !Number.isFinite(defenderHP)) {
      const p = toInt(it.playerHP, 0);
      const e = toInt(it.enemyHP, 0);
      if (source === "attacker") {
        attackerHP = p;
        defenderHP = e;
      } else {
        attackerHP = e;
        defenderHP = p;
      }
    }
    attackerHP = Math.max(0, attackerHP);
    defenderHP = Math.max(0, defenderHP);

    const ev = it.event as TLIn["event"];
    const tags = Array.isArray(it.tags) ? it.tags.slice(0, 8).map(String) : [];

    // Eventos de habilidad: preservar metadatos y normalizar damage
    if (ev === "passive_proc" || ev === "ultimate_cast") {
      const hasDur = typeof it.ability?.durationTurns === "number";
      return {
        turn,
        source,
        event: ev,
        damage: Math.max(0, toInt(it.damage, 0)),
        attackerHP,
        defenderHP,
        ability: it.ability
          ? {
              kind: it.ability.kind === "ultimate" ? "ultimate" : "passive",
              name: it.ability.name,
              id: it.ability.id,
              durationTurns: hasDur ? toInt(it.ability!.durationTurns, 0) : undefined,
            }
          : undefined,
        tags,
      };
    }

    // Golpeo “normal”
    const event: "hit" | "crit" | "block" | "miss" = (ev as any) ?? (toInt(it.damage, 0) > 0 ? "hit" : "miss");

    const damage = Math.max(0, toInt(it.damage, 0));

    return {
      turn,
      source,
      event,
      damage,
      attackerHP,
      defenderHP,
      // ability/tags no aplican aquí
    };
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

    console.log("[PVP][GET/preview] outcome:", outcome, "turns:", (timeline ?? []).length);
    console.log("[PVP][GET/preview] snapshots.len =", (snapshots ?? []).length);

    return res.json({ ok: true, outcome, timeline, log, snapshots });
  } catch (err) {
    console.error("GET /combat/simulate (preview) error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/* ---------------- POST /combat/simulate (preview, auth) ---------------- */
export const simulateCombatController: RequestHandler = async (req, res) => {
  console.log("hace /combat/simulate backend");
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

    console.log("[PVP][POST/sim] outcome:", outcome, "turns:", (timeline ?? []).length);
    console.log("[PVP][POST/sim] snapshots.len =", (snapshots ?? []).length);

    return res.json({ ok: true, outcome, timeline, log, snapshots });
  } catch (err) {
    console.error("POST /combat/simulate error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/* ---------------- POST /combat/resolve (auth, PERSISTE + cobra stamina) ---------------- */
export const resolveCombatController: RequestHandler = async (req, res) => {
  console.log("/combat/resolve..backend");
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

    // Ya resuelto → devolvemos lo persistido
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
        alreadyResolved: true,
      });
    }

    // 💥 Cobro stamina SOLO al usuario que ejecuta el resolve (atacante normalmente)
    const spent = await spendStamina(callerUserId, STAMINA_COST_PVP);
    if (!spent.ok) {
      const snap = await getStaminaByUserId(callerUserId).catch(() => null);
      return res.status(400).json({
        ok: false,
        message: "Stamina insuficiente",
        required: STAMINA_COST_PVP,
        stamina: snap || undefined,
        reason: (spent as any).reason,
      });
    }

    // Simulación y persistencia
    const { outcome, timeline, log, snapshots } = runPvp({
      attackerSnapshot: mAny.attackerSnapshot,
      defenderSnapshot: mAny.defenderSnapshot,
      seed: mAny.seed,
      maxRounds: 30,
    });

    console.log("[PVP][POST/resolve] outcome:", outcome, "turns:", (timeline ?? []).length);
    console.log("[PVP][POST/resolve] snapshots.len =", (snapshots ?? []).length);

    const timelineNorm = normalizeTimeline(timeline);
    const rw = computePvpRewards(outcome);

    const att = mAny.attackerSnapshot || {};
    const def = mAny.defenderSnapshot || {};
    await Promise.all([applyRewardsToCharacter(att.characterId, att.userId, rw.attacker), applyRewardsToCharacter(def.characterId, def.userId, rw.defender)]);

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

    await match.save();

    return res.json({
      ok: true,
      outcome,
      rewards: rw.responseForAttacker,
      timeline: timelineNorm,
      snapshots,
      log,
      staminaAfter: spent.after, // snapshot de stamina luego de cobrar
    });
  } catch (err: any) {
    console.error("POST /combat/resolve error:", err?.name, err?.message);
    if (err?.errors) {
      for (const [k, v] of Object.entries(err.errors)) {
        console.error(`[resolve][validation] ${k}:`, (v as any)?.message);
      }
    }
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { Match } from "../models/Match";
import { Character } from "../models/Character";
import { runPvpWithManager } from "../services/combat/pvpWithManager";

/** Mapea el outcome del runner ("win"|"lose"|"draw") al que guardás en Match ("attacker"|"defender"|"draw") */
function mapOutcomeForMatch(outcome: "win" | "lose" | "draw") {
  return outcome === "win" ? "attacker" : outcome === "lose" ? "defender" : "draw";
}

/** Reglas simples de recompensa PvP (ajustá números si querés) */
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
    attacker: { xp: 18, gold: 12, honorDelta: +0 },
    defender: { xp: 18, gold: 12, honorDelta: +0 },
    responseForAttacker: { xpGained: 18, goldGained: 12, honorDelta: 0 },
  };
}

/** Aplica recompensas a un Character (solo si los campos existen y son numéricos). */
async function applyRewardsToCharacter(charId: any | undefined, userId: any | undefined, rw: { xp?: number; gold?: number; honorDelta?: number }) {
  let doc = (charId && (await Character.findById(charId))) || (userId && (await Character.findOne({ userId })));

  if (!doc) return { updated: false };

  if (typeof (doc as any).experience === "number" && typeof rw.xp === "number") {
    (doc as any).experience += rw.xp;
  }
  if (typeof rw.gold === "number" && rw.gold > 0) {
    if (typeof (doc as any).gold === "number") {
      (doc as any).gold += rw.gold;
    } else if (typeof (doc as any).coins === "number") {
      (doc as any).coins += rw.gold;
    }
  }
  if (typeof rw.honorDelta === "number" && typeof (doc as any).honor === "number") {
    (doc as any).honor += rw.honorDelta;
  }

  await doc.save();
  return { updated: true, characterId: doc._id };
}

/** GET /combat/simulate?matchId=...  (preview público/fixtures) */
export const simulateCombatPreviewController: RequestHandler = async (req, res) => {
  try {
    const matchId = String(req.query.matchId || "");
    if (!matchId || !Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ ok: false, message: "matchId inválido" });
    }

    const match = await Match.findById(matchId).lean();
    if (!match) return res.status(404).json({ ok: false, message: "Match no encontrado" });

    const { outcome, timeline, log, snapshots } = runPvpWithManager({
      attackerSnapshot: (match as any).attackerSnapshot,
      defenderSnapshot: (match as any).defenderSnapshot,
      seed: (match as any).seed,
      maxRounds: 30,
    });

    // >>> DEBUG SNAPSHOTS
    console.log("[PVP][GET/preview] outcome:", outcome, "turns:", timeline.length);
    console.log("[PVP][GET/preview] snapshots.len =", snapshots.length);
    if (snapshots.length) {
      console.log("[PVP][GET/preview] snapshots[0..2] =", snapshots.slice(0, 3));
      console.log("[PVP][GET/preview] snapshots[last] =", snapshots[snapshots.length - 1]);
    }

    return res.json({ ok: true, outcome, timeline, log, snapshots });
  } catch (err) {
    console.error("GET /combat/simulate (preview) error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/** POST /combat/simulate  (preview real con auth, NO persiste)  body: { matchId } */
export const simulateCombatController: RequestHandler = async (req, res) => {
  try {
    const { matchId } = req.body as { matchId?: string };
    if (!matchId || !Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ ok: false, message: "matchId inválido" });
    }

    const match = await Match.findById(matchId).lean();
    if (!match) return res.status(404).json({ ok: false, message: "Match no encontrado" });

    const { outcome, timeline, log, snapshots } = runPvpWithManager({
      attackerSnapshot: (match as any).attackerSnapshot,
      defenderSnapshot: (match as any).defenderSnapshot,
      seed: (match as any).seed,
      maxRounds: 30,
    });

    // >>> DEBUG SNAPSHOTS
    console.log("[PVP][POST/sim] outcome:", outcome, "turns:", timeline.length);
    console.log("[PVP][POST/sim] snapshots.len =", snapshots.length);
    if (snapshots.length) {
      console.log("[PVP][POST/sim] snapshots[0..2] =", snapshots.slice(0, 3));
      console.log("[PVP][POST/sim] snapshots[last] =", snapshots[snapshots.length - 1]);
    }

    return res.json({ ok: true, outcome, timeline, log, snapshots });
  } catch (err) {
    console.error("POST /combat/simulate error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

/** POST /combat/resolve  (auth, PERSISTE)  body: { matchId } */
export const resolveCombatController: RequestHandler = async (req, res) => {
  try {
    const { matchId } = req.body as { matchId?: string };
    if (!matchId || !Types.ObjectId.isValid(matchId)) {
      return res.status(400).json({ ok: false, message: "matchId inválido" });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ ok: false, message: "Match no encontrado" });

    const mAny = match as any; // para campos opcionales no tipeados (timeline/log/rewards/snapshots)

    // Evitar doble otorgamiento: si ya está resuelto, devolvemos lo guardado
    if (mAny.status === "resolved") {
      const outcomeStored = (mAny.outcome ?? "draw") as "attacker" | "defender" | "draw";
      const outcomeForAttacker: "win" | "lose" | "draw" = outcomeStored === "attacker" ? "win" : outcomeStored === "defender" ? "lose" : "draw";

      // >>> DEBUG SNAPSHOTS (ya guardados)
      const prevSnaps = Array.isArray(mAny.snapshots) ? mAny.snapshots : [];
      console.log("[PVP][POST/resolve][already] outcome:", outcomeForAttacker);
      console.log("[PVP][POST/resolve][already] snapshots.len =", prevSnaps.length);
      if (prevSnaps.length) {
        console.log("[PVP][POST/resolve][already] snapshots[0..2] =", prevSnaps.slice(0, 3));
        console.log("[PVP][POST/resolve][already] snapshots[last] =", prevSnaps[prevSnaps.length - 1]);
      }

      return res.json({
        ok: true,
        outcome: outcomeForAttacker,
        rewards: mAny.rewards ?? {},
        timeline: Array.isArray(mAny.timeline) ? mAny.timeline : [],
        snapshots: prevSnaps,
        log: Array.isArray(mAny.log) ? mAny.log : [],
        alreadyResolved: true,
      });
    }

    // Ejecutar combate
    const { outcome, timeline, log, snapshots } = runPvpWithManager({
      attackerSnapshot: mAny.attackerSnapshot,
      defenderSnapshot: mAny.defenderSnapshot,
      seed: mAny.seed,
      maxRounds: 30,
    });

    // >>> DEBUG SNAPSHOTS (recién calculados)
    console.log("[PVP][POST/resolve] outcome:", outcome, "turns:", timeline.length);
    console.log("[PVP][POST/resolve] snapshots.len =", snapshots.length);
    if (snapshots.length) {
      console.log("[PVP][POST/resolve] snapshots[0..2] =", snapshots.slice(0, 3));
      console.log("[PVP][POST/resolve] snapshots[last] =", snapshots[snapshots.length - 1]);
    }

    // Recompensas (vista del atacante)
    const rw = computePvpRewards(outcome);

    // Persistir recompensas en personajes
    const att = mAny.attackerSnapshot || {};
    const def = mAny.defenderSnapshot || {};
    await Promise.all([applyRewardsToCharacter(att.characterId, att.userId, rw.attacker), applyRewardsToCharacter(def.characterId, def.userId, rw.defender)]);

    // Guardar Match resuelto
    mAny.status = "resolved";
    mAny.mode = "resolve";
    mAny.winner = outcome === "win" ? "player" : outcome === "lose" ? "enemy" : "draw";
    mAny.turns = timeline.length;
    mAny.outcome = mapOutcomeForMatch(outcome);
    mAny.rewards = rw.responseForAttacker;
    mAny.timeline = timeline;
    mAny.snapshots = snapshots;
    mAny.log = log;

    await match.save();

    return res.json({
      ok: true,
      outcome,
      rewards: rw.responseForAttacker,
      timeline,
      snapshots,
      log,
    });
  } catch (err) {
    console.error("POST /combat/resolve error:", err);
    return res.status(500).json({ ok: false, message: "Error interno" });
  }
};

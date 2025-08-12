// Controladores de simulación/resolve.
// Incluyen logs de entrada/salida y persistencia de historiales.
const DBG = process.env.DEBUG_COMBAT === "1";

import { Request, Response } from "express";
import { Types } from "mongoose";
import { simulateCombat } from "../services/combat/simulateCombat";
import { findEnemyByIdLean } from "../services/enemy.service";
import { findCharacterById, grantRewardsAndLoot } from "../services/character.service";
import { CombatResult } from "../models/CombatResult";

type SimulateBody = {
  enemyId: string;
  characterId?: string;
  useConsumables?: boolean;
  skills?: string[];
  seed?: number;
};

interface AuthReq extends Request {
  user?: { id: string };
}

/** GET /combat/simulate (fixtures, sin auth) */
export async function simulateCombatPreviewController(_req: Request, res: Response) {
  try {
    if (DBG) console.log("[CTRL] GET /combat/simulate (fixtures)");
    const result = await simulateCombat({ mode: "fixtures" });
    return res.json({ mode: "preview-fixtures", ...result });
  } catch (err) {
    console.error("simulateCombatPreviewController error:", err);
    return res.status(500).json({ message: "Error en simulación de pruebas" });
  }
}

/** POST /combat/simulate (auth) → preview real (NO persiste) */
export async function simulateCombatController(req: AuthReq, res: Response) {
  try {
    const { enemyId, characterId, useConsumables, skills, seed } = (req.body || {}) as SimulateBody;
    if (DBG) console.log("[CTRL] POST /combat/simulate body:", req.body);

    if (!enemyId) return res.status(400).json({ message: "Falta enemyId" });

    const effectiveCharacterId = characterId ?? req.user?.id;
    if (!effectiveCharacterId) return res.status(400).json({ message: "Falta characterId o autenticación" });

    const [player, enemy] = await Promise.all([findCharacterById(effectiveCharacterId), findEnemyByIdLean(enemyId)]);
    if (!player) return res.status(404).json({ message: "Personaje no encontrado" });
    if (!enemy) return res.status(404).json({ message: "Enemigo no encontrado" });

    if (DBG) console.log("[CTRL] Simulando preview real:", { player: player._id, enemy: enemy.id, seed });

    const result = await simulateCombat({
      mode: "real-preview",
      player,
      enemy,
      useConsumables: !!useConsumables,
      skills: skills ?? [],
      seed,
    });

    // Guardar preview (QA/analytics)
    const safeLog = (result.log || []).slice(0, 300);
    const safeSnapshots = (result.snapshots || []).slice(0, 500);
    await CombatResult.create({
      userId: req.user?.id && Types.ObjectId.isValid(req.user.id) ? new Types.ObjectId(req.user.id) : null,
      characterId: new Types.ObjectId(String(player._id)),
      enemyId: new Types.ObjectId(String(enemy.id)),
      mode: "preview",
      winner: result.winner,
      turns: result.turns,
      seed: typeof seed === "number" ? seed : null,
      log: safeLog,
      snapshots: safeSnapshots,
      rewards: null,
    });

    if (DBG) console.log("[CTRL] Preview almacenado OK");

    return res.json({
      mode: "preview-real",
      enemy: { id: enemy.id, name: enemy.name, level: enemy.level, tier: enemy.tier, bossType: enemy.bossType ?? null },
      ...result,
    });
  } catch (err) {
    console.error("simulateCombatController error:", err);
    return res.status(500).json({ message: "Error en simulación" });
  }
}

/** POST /combat/resolve (auth) → combate real que PERSISTE recompensas + historial */
export async function resolveCombatController(req: AuthReq, res: Response) {
  try {
    const { enemyId, characterId, useConsumables, skills, seed } = (req.body || {}) as SimulateBody;
    if (DBG) console.log("[CTRL] POST /combat/resolve body:", req.body);

    if (!enemyId) return res.status(400).json({ message: "Falta enemyId" });

    const effectiveCharacterId = characterId ?? req.user?.id;
    if (!effectiveCharacterId) return res.status(400).json({ message: "Falta characterId o autenticación" });

    const [player, enemy] = await Promise.all([findCharacterById(effectiveCharacterId), findEnemyByIdLean(enemyId)]);
    if (!player) return res.status(404).json({ message: "Personaje no encontrado" });
    if (!enemy) return res.status(404).json({ message: "Enemigo no encontrado" });

    if (DBG) console.log("[CTRL] Resolviendo combate:", { player: player._id, enemy: enemy.id, seed });

    const sim = await simulateCombat({
      mode: "real",
      player,
      enemy,
      useConsumables: !!useConsumables,
      skills: skills ?? [],
      seed,
    });

    let rewards: null | {
      xpGained: number;
      goldGained: number;
      levelUps: number[];
      drops: any[];
      character: any;
    } = null;

    if (sim.winner === "player") {
      rewards = await grantRewardsAndLoot({ player, enemy, battleLog: sim.log });
      if (DBG) console.log("[CTRL] Recompensas:", { xp: rewards.xpGained, gold: rewards.goldGained, levelUps: rewards.levelUps, drops: rewards.drops?.length });
    } else {
      if (DBG) console.log("[CTRL] Derrota del jugador: no hay recompensas");
    }

    const dropsIds = (rewards?.drops ?? []).map((d: any) => String(d._id ?? d.id ?? "")).filter(Boolean);
    const safeLog = (sim.log || []).slice(0, 300);
    const safeSnapshots = (sim.snapshots || []).slice(0, 500);

    await CombatResult.create({
      userId: req.user?.id && Types.ObjectId.isValid(req.user.id) ? new Types.ObjectId(req.user.id) : null,
      characterId: new Types.ObjectId(String(player._id)),
      enemyId: new Types.ObjectId(String(enemy.id)),
      mode: "resolve",
      winner: sim.winner,
      turns: sim.turns,
      seed: typeof seed === "number" ? seed : null,
      log: safeLog,
      snapshots: safeSnapshots,
      rewards: rewards
        ? {
            xpGained: rewards.xpGained,
            goldGained: rewards.goldGained,
            levelUps: rewards.levelUps,
            drops: dropsIds,
          }
        : null,
    });

    if (DBG) console.log("[CTRL] Historial resolve almacenado OK");

    return res.json({
      mode: "resolve",
      enemy: { id: enemy.id, name: enemy.name, level: enemy.level, tier: enemy.tier, bossType: enemy.bossType ?? null },
      result: sim,
      rewards,
    });
  } catch (err) {
    console.error("resolveCombatController error:", err);
    return res.status(500).json({ message: "Error resolviendo combate" });
  }
}

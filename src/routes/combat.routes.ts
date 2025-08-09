import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  simulateCombatPreviewController, // GET (fixtures)
  simulateCombatController, // POST (preview real, sin persistir)
  resolveCombatController, // POST (verdad: persiste y otorga loot/xp)
} from "../controllers/simulateCombat.controller";

const combatRoutes = express.Router();

/**
 * PRUEBAS (sin auth): usa fixtures/mocks, no persiste nada.
 * Útil para front en early dev o para probar el motor de combate rápido.
 */
combatRoutes.get("/combat/simulate", simulateCombatPreviewController);

/**
 * PREVIEW REAL (con auth): usa datos reales del body (characterId/enemyId…),
 * NO persiste cambios (solo devuelve el resultado de la simulación).
 */
combatRoutes.post("/combat/simulate", requireAuth, simulateCombatController);

/**
 * VERDAD (con auth): resuelve el combate real y PERSISTE:
 * - suma XP/Gold (enemy.xpReward/goldReward)
 * - genera y entrega loot (dropProfile)
 * - actualiza inventario/personaje
 */
combatRoutes.post("/combat/resolve", requireAuth, resolveCombatController);

export default combatRoutes;

// GET /combat/simulate → modo pruebas (usa fixtures, no requiere auth, no persiste).

// POST /combat/simulate → modo preview real (usa req.body, requiere auth, no persiste).

// POST /combat/resolve → modo verdad (usa req.body, requiere auth, persiste XP/Gold y genera loot).

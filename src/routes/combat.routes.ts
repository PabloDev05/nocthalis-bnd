// src/routes/combat.routes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { simulateCombatPreviewController, simulateCombatController, resolveCombatController } from "../controllers/simulateCombat.controller";
import { getCombatResultsController, getCombatResultDetailController } from "../controllers/combatResult.controller";

const combatRoutes = Router();

// 🧪 Fixtures (público, sin auth)
combatRoutes.get("/simulate", simulateCombatPreviewController);

// 🔍 Preview real (auth, NO persiste)
combatRoutes.post("/simulate", requireAuth, simulateCombatController);

// ⚔️ Resolver (auth, PERSISTE)
combatRoutes.post("/resolve", requireAuth, resolveCombatController);

// 🗂️ Historial (auth)
combatRoutes.get("/results", requireAuth, getCombatResultsController);
combatRoutes.get("/results/:id", requireAuth, getCombatResultDetailController);

export default combatRoutes;

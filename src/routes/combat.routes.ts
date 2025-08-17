import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { simulateCombatPreviewController, simulateCombatController, resolveCombatController } from "../controllers/simulateCombat.controller";
import { getCombatResultsController, getCombatResultDetailController } from "../controllers/combatResult.controller";

const combatRoutes = Router();

// 🧪 Fixtures (público, sin auth)
combatRoutes.get("/combat/simulate", simulateCombatPreviewController);

// 🔍 Preview real (auth, NO persiste)
combatRoutes.post("/combat/simulate", requireAuth, simulateCombatController);

// ⚔️ Resolver (auth, PERSISTE)
combatRoutes.post("/combat/resolve", requireAuth, resolveCombatController);

// 🗂️ Historial (auth)
combatRoutes.get("/combat/results", requireAuth, getCombatResultsController);
combatRoutes.get("/combat/results/:id", requireAuth, getCombatResultDetailController);

export default combatRoutes;

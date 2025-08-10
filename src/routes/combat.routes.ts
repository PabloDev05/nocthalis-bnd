import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { simulateCombatPreviewController, simulateCombatController, resolveCombatController } from "../controllers/simulateCombat.controller";

const combatRoutes = express.Router();

// 🧪 Simulación de combate con datos mock (sin auth, no persiste)
combatRoutes.get("/combat/simulate", simulateCombatPreviewController);

// 🔍 Simulación real con datos del jugador (con auth, no persiste)
combatRoutes.post("/combat/simulate", requireAuth, simulateCombatController);

// ⚔️ Combate real que persiste XP, oro y loot (con auth)
combatRoutes.post("/combat/resolve", requireAuth, resolveCombatController);

export default combatRoutes;

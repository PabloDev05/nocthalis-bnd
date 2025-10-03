// src/routes/arena.routes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  getArenaOpponentsController,
  postArenaChallengeController, // ← nombre correcto del handler
} from "../controllers/arena.controller";

const arenaRoutes = Router();

// Lista de oponentes PvP
arenaRoutes.get("/opponents", requireAuth, getArenaOpponentsController);

// Crear desafío PvP
arenaRoutes.post("/challenges", requireAuth, postArenaChallengeController);

export default arenaRoutes;

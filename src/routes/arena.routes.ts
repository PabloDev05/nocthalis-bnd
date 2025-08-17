// src/routes/arena.routes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  getArenaOpponentsController,
  postArenaChallengeController, // ← nombre correcto del handler
} from "../controllers/arena.controller";

const arenaRoutes = Router();

arenaRoutes.get("/arena/opponents", requireAuth, getArenaOpponentsController);
arenaRoutes.post("/arena/challenges", requireAuth, postArenaChallengeController);

export default arenaRoutes;

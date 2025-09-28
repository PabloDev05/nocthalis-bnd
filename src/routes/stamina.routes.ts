import { Router } from "express";
import { getMyStamina, useStamina, adminSetStamina, useStaminaAction } from "../controllers/stamina.controller";
import { requireAuth } from "../middleware/requireAuth";

// Asegurate de tener tu middleware de auth que setea req.user
// por ejemplo: router.use(requireAuth)
const router = Router();

router.get("/", requireAuth, getMyStamina);
router.post("/use", requireAuth, useStamina);
router.post("/use-action", requireAuth, useStaminaAction);
router.post("/admin/set", requireAuth, adminSetStamina);

export default router;

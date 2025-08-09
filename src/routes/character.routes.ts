import { Router } from "express";
import { chooseClass } from "../controllers/chooseClass.controller";
import { chooseSubclass } from "../controllers/chooseSubClass.controller";
import { getCharacterClasses } from "../controllers/getCharacterClasses.controller";
import { getMyCharacter } from "../controllers/character.controller";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// pública
router.get("/character/classes", getCharacterClasses);

// protegidas
router.post("/character/choose-class", requireAuth, chooseClass);
router.post("/character/choose-subclass", requireAuth, chooseSubclass);
router.get("/character/me", requireAuth, getMyCharacter);

export default router;

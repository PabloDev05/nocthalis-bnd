import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getCharacterClasses } from "../controllers/getCharacterClasses.controller";
import { chooseClass } from "../controllers/chooseClass.controller";
import { chooseSubclass } from "../controllers/chooseSubClass.controller";
import { getMyCharacter } from "../controllers/character.controller";
import { getInventory, equipItem, unequipItem, useConsumable, getProgression } from "../controllers/characterEquipment.controller";
import { allocatePointsController } from "../controllers/allocatePoints.controller";
import { getArenaOpponentsController, postArenaChallengeController } from "../controllers/arena.controller";

const router = Router();

router.get("/character/classes", getCharacterClasses);
router.post("/character/choose-class", requireAuth, chooseClass);
router.post("/character/choose-subclass", requireAuth, chooseSubclass);
router.get("/character/me", requireAuth, getMyCharacter);
router.get("/character/inventory", requireAuth, getInventory);
router.post("/character/equip", requireAuth, equipItem);
router.post("/character/unequip", requireAuth, unequipItem);
router.post("/character/use-item", requireAuth, useConsumable);
router.get("/character/progression", requireAuth, getProgression);
router.post("/character/allocate", requireAuth, allocatePointsController);

// Arena PvP
router.get("/arena/opponents", requireAuth, getArenaOpponentsController);
router.post("/arena/challenges", requireAuth, postArenaChallengeController);

export default router;

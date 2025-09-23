import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getCharacterClasses } from "../controllers/getCharacterClasses.controller";
import { chooseClass } from "../controllers/chooseClass.controller";
import { chooseSubclass } from "../controllers/chooseSubClass.controller";
import { getMyCharacter } from "../controllers/character.controller";
import { getProgression } from "../controllers/characterProgression.controller";
import { getInventory, equipItem, unequipItem, useConsumable } from "../controllers/characterEquipment.controller";
import allocatePointsController from "../controllers/allocatePoints.controller";

const router = Router();

/** Clases y selección */
router.get("/character/classes", getCharacterClasses);
router.post("/character/choose-class", requireAuth, chooseClass);
router.post("/character/choose-subclass", requireAuth, chooseSubclass);

/** Perfil de personaje */
router.get("/character/me", requireAuth, getMyCharacter);
router.get("/character/progression", requireAuth, getProgression);

/** Inventario / equipo */
router.get("/character/inventory", requireAuth, getInventory);
router.post("/character/equip", requireAuth, equipItem);
router.post("/character/unequip", requireAuth, unequipItem);
router.post("/character/use-item", requireAuth, useConsumable);

/** Asignación de puntos */
router.post("/character/allocate", requireAuth, allocatePointsController);

export default router;

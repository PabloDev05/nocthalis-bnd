import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getCharacterClasses } from "../controllers/getCharacterClasses.controller";
import { chooseClass } from "../controllers/chooseClass.controller";
import { chooseSubclass } from "../controllers/chooseSubClass.controller";
import { getMyCharacter } from "../controllers/character.controller";
import { getProgression } from "../controllers/characterProgression.controller";
// import { getInventory, equipItem, unequipItem, useConsumable } from "../controllers/characterEquipment.controller";
import allocatePointsController from "../controllers/allocatePoints.controller";

const router = Router();

/** Clases y selección */
router.get("/classes", getCharacterClasses);
router.post("/choose-class", requireAuth, chooseClass);
router.post("/choose-subclass", requireAuth, chooseSubclass);

/** Perfil de personaje */
router.get("/me", requireAuth, getMyCharacter);
router.get("/progression", requireAuth, getProgression);

/** Inventario / equipo */
// router.get("/inventory", requireAuth, getInventory);
// router.post("/equip", requireAuth, equipItem);
// router.post("/unequip", requireAuth, unequipItem);
// router.post("/use-item", requireAuth, useConsumable);

/** Asignación de puntos */
router.post("/allocate", requireAuth, allocatePointsController);

export default router;

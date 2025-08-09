// src/routes/character.routes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { chooseClass } from "../controllers/chooseClass.controller";
import { chooseSubclass } from "../controllers/chooseSubClass.controller";
import { getMyCharacter } from "../controllers/character.controller";
import { getCharacterClasses } from "../controllers/getCharacterClasses.controller";

// nuevos controladores sugeridos:
import { getInventory, equipItem, unequipItem, useConsumable, getProgression } from "../controllers/characterEquipment.controller";

const router = Router();

// Catálogo público (para pantallas de selección)
router.get("/character/classes", getCharacterClasses);

// Personaje (protegidas)
router.post("/character/choose-class", requireAuth, chooseClass);
router.post("/character/choose-subclass", requireAuth, chooseSubclass); //! testeando aun
router.get("/character/me", requireAuth, getMyCharacter); //! testeando aun

// Inventario / equipo
router.get("/character/inventory", requireAuth, getInventory);
router.post("/character/equip", requireAuth, equipItem); // body: { itemId } //! testeando aun
router.post("/character/unequip", requireAuth, unequipItem); // body: { slot } //! testeando aun
router.post("/character/use-item", requireAuth, useConsumable); // body: { itemId } //! testeando aun
router.get("/character/progression", requireAuth, getProgression); //! testeando aun

export default router;

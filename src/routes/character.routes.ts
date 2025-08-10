import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";

// catálogos públicos
import { getCharacterClasses } from "../controllers/getCharacterClasses.controller";

// flujo de personaje
import { chooseClass } from "../controllers/chooseClass.controller";
import { chooseSubclass } from "../controllers/chooseSubClass.controller";
import { getMyCharacter } from "../controllers/character.controller";

// inventario / equipo
import { getInventory, equipItem, unequipItem, useConsumable, getProgression } from "../controllers/characterEquipment.controller";

const router = Router();

// 📜 Lista las clases de personaje disponibles (público)
router.get("/character/classes", getCharacterClasses);

// 🎯 Selecciona clase (requiere auth)
router.post("/character/choose-class", requireAuth, chooseClass);

// 🛠️ Selecciona subclase (requiere auth)
router.post("/character/choose-subclass", requireAuth, chooseSubclass);

// 👤 Obtiene datos completos de tu personaje (requiere auth)
router.get("/character/me", requireAuth, getMyCharacter);

// 🎒 Obtiene inventario y equipo actual (requiere auth)
router.get("/character/inventory", requireAuth, getInventory);

// 🗡️ Equipa un ítem del inventario (requiere auth)
router.post("/character/equip", requireAuth, equipItem); // body: { itemId }

// 🧤 Desequipa un ítem (requiere auth)
router.post("/character/unequip", requireAuth, unequipItem); // body: { slot }

// 🍖 Usa un consumible (requiere auth)
router.post("/character/use-item", requireAuth, useConsumable); // body: { itemId }

// 📈 Progresión de nivel y XP (requiere auth)
router.get("/character/progression", requireAuth, getProgression);

export default router;

import express from "express";
import { chooseClass } from "../controllers/chooseClass.controller";
import { getCharacterClasses } from "../controllers/getCharacterClasses.controller";

const characterRoutes = express.Router();

// POST para elegir clase
characterRoutes.post("/character/choose-class", chooseClass);

// GET para obtener todas las clases disponibles
characterRoutes.get("/character/classes", getCharacterClasses);

export default characterRoutes;

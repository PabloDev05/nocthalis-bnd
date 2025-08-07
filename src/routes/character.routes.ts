import express from "express";
import { chooseClass } from "../controllers/chooseClass.controller";
import { getCharacterClasses } from "../controllers/getCharacterClasses.controller";

const characterRoutes = express.Router();

characterRoutes.post("/character/choose-class", chooseClass);
characterRoutes.get("/character/classes", getCharacterClasses);

export default characterRoutes;

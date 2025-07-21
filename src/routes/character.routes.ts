import express from "express";
import { chooseClass } from "../controllers/chooseClass.controller"; // Ajustá el path si tu archivo se llama distinto

const characterRoutes = express.Router();

characterRoutes.post("/character/choose-class", chooseClass);

export default characterRoutes;

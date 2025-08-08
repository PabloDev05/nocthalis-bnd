import express from "express";
import { simulateCombatController } from "../controllers/simulateCombat.controller";

const combatRoutes = express.Router();

// Simulación de combate contra un bot
combatRoutes.get("/combat/simulate", simulateCombatController);

export default combatRoutes;

// ⚠Si en el futuro la simulación recibe datos del cliente (por ejemplo:
// ID del usuario
// ID del enemigo

// Estadísticas personalizadas
// entonces sí convendría usar POST, porque ahí estarías enviando un cuerpo JSON con información para generar el combate.

// 💡 Resumen:
// GET → pruebas actuales con datos fijos de Fixtures.

// POST → cuando pases a simular con datos enviados por el jugador o cuando la simulación guarde algo en la base de datos.

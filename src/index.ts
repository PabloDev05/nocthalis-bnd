// src/index.ts
import dotenv from "dotenv";
dotenv.config(); // 👈 ① cargar .env primero

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import characterRoutes from "./routes/character.routes";
import combatRoutes from "./routes/combat.routes";
import arenaRoutes from "./routes/arena.routes";
import staminaRoutes from "./routes/stamina.routes";
import { connectDB } from "./config/db";

// Cargar módulo de PVP DESPUÉS de dotenv
import "./config/pvp"; // 👈 ② este log ahora verá la env correcta

const app = express();
connectDB();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api", characterRoutes);
app.use("/api", combatRoutes);
app.use("/api", arenaRoutes);
app.use("/api/stamina", staminaRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

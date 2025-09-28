import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import characterRoutes from "./routes/character.routes";
import combatRoutes from "./routes/combat.routes";
import arenaRoutes from "./routes/arena.routes";
import staminaRoutes from "./routes/stamina.routes";
import feedbackRoutes from "./routes/feedback.routes";
import { connectDB } from "./config/db";

import "./config/pvp";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/character", characterRoutes);
app.use("/api/combat", combatRoutes);
app.use("/api/arena", arenaRoutes);
app.use("/api/stamina", staminaRoutes);
app.use("/api/feedback", feedbackRoutes);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error conectando a MongoDB:", err);
    process.exit(1);
  });

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import characterRoutes from "./routes/character.routes";
import { connectDB } from "./config/db";
import dotenv from "dotenv";
import combatRoutes from "./routes/combat.routes";
import arenaRoutes from "./routes/arena.routes";
dotenv.config();

const app = express();
connectDB();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api", characterRoutes);
app.use("/api", combatRoutes);
app.use("/api", arenaRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

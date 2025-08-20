import "dotenv/config";
import mongoose from "mongoose";
import { buildPlayerCharacter, buildEnemyById } from "../battleSystem/core/Builders";

const MONGO = process.env.MONGO_URI || process.env.DATABASE_URL;
if (!MONGO) throw new Error("MONGO_URI / DATABASE_URL no definido en .env");

(async () => {
  try {
    await mongoose.connect(MONGO);
    console.log("✅ Mongo conectado");

    // 👉 Dejá vacío para que tome el primer registro automáticamente (útil en DEV)
    const player = await buildPlayerCharacter("6897632eb204af9644019572"); // ID_PLAYER
    const enemy = await buildEnemyById("6897616441b08fe6b157d5e8"); // ID_ENEMY

    console.log("PLAYER:", player);
    console.log("ENEMY :", enemy);
  } catch (err) {
    console.error("❌ Error en test:", err);
  } finally {
    await mongoose.disconnect();
  }
})();

// ¿Para qué te sirve?
// Detectar rápido errores de tipos/casting, campos faltantes o índices.
// Ver que tus defaults están bien y que las clases POO reciben lo que esperan.
// Tener IDs listos para pruebas de /combat/simulate y /combat/resolve.

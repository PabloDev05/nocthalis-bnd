// src/scripts/resetDb.ts
import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db";
import { User } from "../models/User";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { Enemy } from "../models/Enemy";
import { seedCharacterClasses } from "./seedCharacterClasses";
import { seedEnemies } from "./seedEnemies";

(async () => {
  let exitCode = 0;

  try {
    // Seguridad: impedir ejecución en producción
    if (process.env.NODE_ENV === "production") {
      console.error("❌ No se puede resetear la base en producción.");
      exitCode = 1;
      return;
    }

    await connectDB();

    // 1) Vaciar colecciones en paralelo
    await Promise.all([User.deleteMany({}), Character.deleteMany({}), CharacterClass.deleteMany({}), Enemy.deleteMany({})]);
    console.log("🧹 Colecciones vaciadas: users, characters, characterclasses, enemies");

    // 2) Dropear índices existentes (evita conflicto al recrear)
    await Promise.allSettled([CharacterClass.collection.dropIndexes(), Enemy.collection.dropIndexes()]);

    // 3) Crear índices únicos por name
    await Promise.allSettled([CharacterClass.collection.createIndex({ name: 1 }, { unique: true }), Enemy.collection.createIndex({ name: 1 }, { unique: true })]);

    // 4) Insertar seeds
    const [classesInserted, enemiesInserted] = await Promise.all([CharacterClass.insertMany(seedCharacterClasses), Enemy.insertMany(seedEnemies)]);

    console.log(`🌱 Insertadas ${classesInserted.length} clases y ${enemiesInserted.length} enemigos.`);
    console.log("✅ Base reseteada e insertadas clases y enemigos.");
  } catch (err) {
    console.error("❌ Error reseteando DB:", err);
    exitCode = 1;
  } finally {
    // Cerrar conexión siempre
    try {
      await disconnectDB();
    } catch {
      // ignore
    }
    process.exit(exitCode);
  }
})();

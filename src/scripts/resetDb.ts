// src/scripts/resetDb.ts
import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db";
import { User } from "../models/User";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { Enemy } from "../models/Enemy";
import { seedCharacterClasses } from "./seedCharacterClasses";
import { buildSeedEnemies } from "./generateEnemies";

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

    // 1) Vaciar colecciones en paralelo (ignora si no existen)
    await Promise.all([User.deleteMany({}).catch(() => null), Character.deleteMany({}).catch(() => null), CharacterClass.deleteMany({}).catch(() => null), Enemy.deleteMany({}).catch(() => null)]);
    console.log("🧹 Colecciones vaciadas: users, characters, characterclasses, enemies");

    // 2) Dropear índices existentes (evita conflicto al recrear)
    await Promise.allSettled([CharacterClass.collection.dropIndexes(), Enemy.collection.dropIndexes()]);

    // 3) Crear índices
    //    - CharacterClass: único por name
    //    - Enemy: único por (name, level, tier) para permitir mismo nombre/level con distinta rareza
    await Promise.allSettled([CharacterClass.collection.createIndex({ name: 1 }, { unique: true }), Enemy.collection.createIndex({ name: 1, level: 1, tier: 1 }, { unique: true })]);

    // 4) Insertar seeds
    //    Clases: con slugs en subclases desde el seed
    //    Enemigos: generados (rangos 1–5, 6–10, 11–15) con tier common/elite/rare
    const enemiesSeed = buildSeedEnemies();

    const [classesInserted, enemiesInserted] = await Promise.all([CharacterClass.insertMany(seedCharacterClasses, { ordered: true }), Enemy.insertMany(enemiesSeed, { ordered: true })]);

    console.log(`🌱 Insertadas ${classesInserted.length} clases y ${enemiesInserted.length} enemigos.`);
    console.log("✅ Base reseteada e insertadas clases y enemigos.");

    // (Opcional) Log de muestra de enemigos
    const preview = enemiesSeed.slice(0, 5).map((e) => ({ name: e.name, lvl: e.level, tier: e.tier }));
    console.log("🔎 Preview enemigos:", preview);
  } catch (err) {
    console.error("❌ Error reseteando DB:", err);
    exitCode = 1;
  } finally {
    try {
      await disconnectDB();
    } catch {
      // ignore
    }
    process.exit(exitCode);
  }
})();

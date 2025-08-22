// src/scripts/resetDb.ts
import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db";
import { User } from "../models/User";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { Enemy } from "../models/Enemy";
import { Item } from "../models/Item";
import { Match } from "../models/Match";
import { CombatResult } from "../models/CombatResult";
import { seedCharacterClasses } from "./seedCharacterClasses";
import { buildSeedEnemies } from "./generateEnemies";
import { insertSeedItems } from "./seedItems";

(async () => {
  let exitCode = 0;

  try {
    if (process.env.NODE_ENV === "production") {
      console.error("No se puede resetear la base en producción.");
      exitCode = 1;
      return;
    }

    await connectDB();

    // 1) Limpiar colecciones (incluye historial y matches)
    await Promise.all([
      User.deleteMany({}).catch(() => null),
      Character.deleteMany({}).catch(() => null),
      CharacterClass.deleteMany({}).catch(() => null),
      Enemy.deleteMany({}).catch(() => null),
      Item.deleteMany({}).catch(() => null),
      Match.deleteMany({}).catch(() => null),
      CombatResult.deleteMany({}).catch(() => null),
    ]);
    console.log("🧹 Limpio users, characters, classes, enemies, items, matches, combatresults");

    // 2) Sincronizar índices
    await Promise.allSettled([User.syncIndexes(), Character.syncIndexes(), CharacterClass.syncIndexes(), Enemy.syncIndexes(), Item.syncIndexes(), Match.syncIndexes(), CombatResult.syncIndexes()]);
    console.log("🧩 Índices sincronizados con los Schemas");

    // 3) Seeds de clases e ítems
    const [classesInserted, itemsInserted] = await Promise.all([
      CharacterClass.insertMany(seedCharacterClasses, { ordered: true }),
      insertSeedItems(), // asegúrate de generar 'slug' si tu Item schema lo exige
    ]);

    // 4) Enemigos
    const enemies = buildSeedEnemies();
    if (!Array.isArray(enemies) || enemies.length === 0) {
      throw new Error("El generador de enemigos devolvió 0 resultados.");
    }
    const enemiesInserted = await Enemy.insertMany(enemies, { ordered: true });

    // 5) Logs de referencia
    console.log(`🌱 Clases: ${classesInserted.length} | Items: ${itemsInserted.length} | Enemigos: ${enemiesInserted.length}`);
    if (classesInserted[0]) console.log("📌 Ejemplo ClassId:", String(classesInserted[0]._id));
    if (itemsInserted[0]) console.log("📌 Ejemplo ItemId :", String(itemsInserted[0]._id));
    if (enemiesInserted[0]) console.log("📌 Ejemplo EnemyId:", String(enemiesInserted[0]._id));

    console.log("✅ Reset DB OK");
  } catch (err) {
    console.error("❌ Error resetDb:", err);
    exitCode = 1;
  } finally {
    try {
      await disconnectDB();
    } catch {}
    process.exit(exitCode);
  }
})();

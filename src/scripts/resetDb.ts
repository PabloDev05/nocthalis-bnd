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

type AnyEnemy = {
  name: string;
  level: number;
  tier: string;
  bossType?: string | null;
  [k: string]: any;
};

function enemyKey(e: AnyEnemy) {
  return `${e.name}|${e.level}|${e.tier}|${e.bossType ?? "null"}`;
}

function dedupeEnemies(enemies: AnyEnemy[]) {
  const seen = new Set<string>();
  const out: AnyEnemy[] = [];
  const skipped: string[] = [];

  for (const e of enemies) {
    const k = enemyKey(e);
    if (seen.has(k)) {
      skipped.push(k);
      continue;
    }
    seen.add(k);
    out.push(e);
  }
  return { out, skipped };
}

(async () => {
  let exitCode = 0;

  try {
    // 🔒 Evitar uso accidental en producción (salimos ANTES de conectar)
    if (process.env.NODE_ENV === "production") {
      console.error("⛔ No se puede resetear la base en producción.");
      process.exit(1);
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
      // Si tenés una colección de stamina, podés agregarla aquí:
      // Stamina.deleteMany({}).catch(() => null),
    ]);
    console.log("🧹 Limpio users, characters, classes, enemies, items, matches, combatresults");

    // 2) Sincronizar índices (no falla si algún modelo no tiene cambios)
    await Promise.allSettled([User.syncIndexes(), Character.syncIndexes(), CharacterClass.syncIndexes(), Enemy.syncIndexes(), Item.syncIndexes(), Match.syncIndexes(), CombatResult.syncIndexes()]);
    console.log("🧩 Índices sincronizados con los Schemas");

    // 3) Seeds de clases e ítems
    const [classesInserted, itemsInserted] = await Promise.all([
      CharacterClass.insertMany(seedCharacterClasses, { ordered: true }),
      insertSeedItems(), // puede retornar array de docs o un resultado tipo bulk
    ]);

    // Contabilizar ítems de forma tolerante
    const itemsCount = Array.isArray(itemsInserted) ? itemsInserted.length : (itemsInserted as any)?.insertedCount ?? 0;

    // 4) Enemigos (con deduplicación + insert tolerante)
    const generated = buildSeedEnemies();
    if (!Array.isArray(generated) || generated.length === 0) {
      throw new Error("El generador de enemigos devolvió 0 resultados.");
    }

    // Deduplicar por (name, level, tier, bossType)
    const { out: enemies, skipped } = dedupeEnemies(generated);
    if (skipped.length) {
      console.warn("🔁 Seeds de Enemy duplicados (omitidos):");
      // Mostrar hasta 10 para no saturar consola
      skipped.slice(0, 10).forEach((k) => console.warn("   -", k));
      if (skipped.length > 10) console.warn(`   …(+${skipped.length - 10} más)`);
    }

    let enemiesInsertedCount = 0;
    try {
      const enemiesInserted = await Enemy.insertMany(enemies, { ordered: false });
      enemiesInsertedCount = Array.isArray(enemiesInserted) ? enemiesInserted.length : (enemiesInserted as any)?.insertedCount ?? 0;
    } catch (err: any) {
      if (err?.code === 11000) {
        console.warn("⚠️ Se detectaron duplicados durante insertMany (Mongo E11000), pero se continuó (ordered:false).");
        // Aún podemos contar los que sí entraron si viene result
        const insertedCount = (err?.result?.result?.nInserted ?? err?.result?.insertedCount ?? 0) as number;
        enemiesInsertedCount = insertedCount;
      } else {
        throw err;
      }
    }

    // 5) Logs de referencia
    console.log(`🌱 Clases: ${classesInserted.length} | Items: ${itemsCount} | Enemigos: ${enemiesInsertedCount}`);

    if (classesInserted[0]) {
      console.log("📌 Ejemplo ClassId:", String(classesInserted[0]._id));
    }
    if (Array.isArray(itemsInserted) && itemsInserted[0]) {
      console.log("📌 Ejemplo ItemId :", String(itemsInserted[0]._id));
    }
    // No siempre tenemos array directo de enemies cuando hubo E11000, por eso no mostramos ejemplo condicionalmente.

    console.log("✅ Reset DB OK");
  } catch (err) {
    console.error("❌ Error resetDb:", err);
    exitCode = 1;
  } finally {
    try {
      await disconnectDB();
    } catch {
      // no-op
    }
    process.exit(exitCode);
  }
})();

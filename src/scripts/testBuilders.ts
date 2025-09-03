// src/scripts/testBuilder.ts
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { buildPlayerCharacter, buildEnemyById } from "../battleSystem/core/Builders";

const MONGO = process.env.MONGO_URI || process.env.DATABASE_URL;
if (!MONGO) throw new Error("MONGO_URI / DATABASE_URL no definido en .env");

// ---- helpers CLI/env --------------------------------------------------------
function getArg(name: string) {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : undefined;
}
const WANT_JSON = process.argv.includes("--json");

const PLAYER_ID_ARG = getArg("player") || process.env.PLAYER_ID;
const ENEMY_ID_ARG = getArg("enemy") || process.env.ENEMY_ID;

const playerId = Types.ObjectId.isValid(String(PLAYER_ID_ARG || "")) ? String(PLAYER_ID_ARG) : undefined;
const enemyId = Types.ObjectId.isValid(String(ENEMY_ID_ARG || "")) ? String(ENEMY_ID_ARG) : undefined;

// ---- pretty print -----------------------------------------------------------
function summarizeEntity(e: any) {
  const cmb = e?.combatStats || e?.combat || {};
  return {
    id: e?.id ?? e?._id ?? "—",
    name: e?.name ?? e?.username ?? "—",
    level: e?.level ?? 1,
    currentHP: e?.currentHP ?? cmb?.maxHP ?? 0,
    maxHP: cmb?.maxHP ?? 0,
    attackPower: cmb?.attackPower ?? 0,
    magicPower: cmb?.magicPower ?? 0,
    criticalChance: cmb?.criticalChance ?? 0,
    criticalDamageBonus: cmb?.criticalDamageBonus ?? 0,
    evasion: cmb?.evasion ?? 0,
    blockChance: cmb?.blockChance ?? 0,
  };
}

(async () => {
  let exitCode = 0;
  try {
    await mongoose.connect(MONGO);
    console.log("✅ Mongo conectado");

    // Si los IDs son inválidos o no se pasaron, los builders ya caen al primer registro (DEV)
    const player = await buildPlayerCharacter(playerId);
    const enemy = await buildEnemyById(enemyId);

    if (WANT_JSON) {
      console.log(
        JSON.stringify(
          {
            player: summarizeEntity(player),
            enemy: summarizeEntity(enemy),
          },
          null,
          2
        )
      );
    } else {
      console.log("PLAYER:", summarizeEntity(player));
      console.log("ENEMY :", summarizeEntity(enemy));
      console.log("\nTips:");
      console.log("  • Podés pasar IDs por CLI:  pnpm ts-node src/scripts/testBuilder.ts --player=<charId> --enemy=<enemyId>");
      console.log("  • O en .env: PLAYER_ID=... / ENEMY_ID=...");
      console.log("  • Para salida JSON: añade --json");
    }
  } catch (err) {
    console.error("❌ Error en test:", err);
    exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(exitCode);
  }
})();

// ¿Para qué te sirve?
// - Validar rápido casting/fields y defaults que consumen los builders.
// - Obtener ejemplos listos para /combat/simulate y /combat/resolve.
// - Tener salida JSON para automatizar pruebas.

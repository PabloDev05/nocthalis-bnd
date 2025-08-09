import { Request, Response } from "express";
// Servicio de simulación por turnos (tu motor actual)
import { simulateCombat } from "../services/combat/simulateCombat";

// Servicios reales (pueden vivir en /services/battle o similar)
import { findEnemyByIdLean } from "../services/enemy.service";
import { findCharacterById, grantRewardsAndLoot } from "../services/character.service";

// Tipos de ayuda (opcionales)
type SimulateBody = {
  enemyId: string;
  characterId?: string; // opcional si se infiere por req.user
  useConsumables?: boolean;
  skills?: string[]; // ids de skills a usar en la sim
  seed?: number; // para reproducibilidad de RNG si tu motor lo admite
};

interface AuthReq extends Request {
  user?: { id: string };
}

/**
 * GET /combat/simulate
 * Modo PRUEBAS: datos fijos/fixtures, sin persistencia ni auth.
 */
export async function simulateCombatPreviewController(_req: Request, res: Response) {
  try {
    // ⚠️ Usa tus Fixtures: jugador/enemigo basados en clases de /classes/combat/Fixtures.ts
    const result = await simulateCombat({ mode: "fixtures" });
    return res.json({ mode: "preview-fixtures", ...result });
  } catch (err) {
    console.error("simulateCombatPreviewController error:", err);
    return res.status(500).json({ message: "Error en simulación de pruebas" });
  }
}

/**
 * POST /combat/simulate  (requireAuth)
 * Modo PREVIEW REAL: usa datos reales de DB, NO persiste.
 */
export async function simulateCombatController(req: AuthReq, res: Response) {
  try {
    const { enemyId, characterId, useConsumables, skills, seed } = (req.body || {}) as SimulateBody;

    if (!enemyId) return res.status(400).json({ message: "Falta enemyId" });

    // Obtenemos player y enemy reales
    const effectiveCharacterId = characterId ?? req.user?.id; // si tu schema usa 1 personaje por usuario
    if (!effectiveCharacterId) return res.status(400).json({ message: "Falta characterId o autenticación" });

    const [player, enemy] = await Promise.all([findCharacterById(effectiveCharacterId), findEnemyByIdLean(enemyId)]);
    if (!player) return res.status(404).json({ message: "Personaje no encontrado" });
    if (!enemy) return res.status(404).json({ message: "Enemigo no encontrado" });

    // Simulación "seca" (sin persistir)
    const result = await simulateCombat({
      mode: "real-preview",
      player,
      enemy,
      useConsumables: !!useConsumables,
      skills: skills ?? [],
      seed,
    });

    return res.json({
      mode: "preview-real",
      enemy: { id: enemy.id, name: enemy.name, level: enemy.level, tier: enemy.tier, bossType: enemy.bossType ?? null },
      ...result,
    });
  } catch (err) {
    console.error("simulateCombatController error:", err);
    return res.status(500).json({ message: "Error en simulación" });
  }
}

/**
 * POST /combat/resolve  (requireAuth)
 * Modo VERDAD: usa datos reales y PERSISTE:
 *  - XP/Gold
 *  - Loot (dropProfile)
 *  - Inventario y progresión
 */
export async function resolveCombatController(req: AuthReq, res: Response) {
  try {
    const { enemyId, characterId, useConsumables, skills, seed } = (req.body || {}) as SimulateBody;

    if (!enemyId) return res.status(400).json({ message: "Falta enemyId" });

    const effectiveCharacterId = characterId ?? req.user?.id;
    if (!effectiveCharacterId) return res.status(400).json({ message: "Falta characterId o autenticación" });

    const [player, enemy] = await Promise.all([findCharacterById(effectiveCharacterId), findEnemyByIdLean(enemyId)]);
    if (!player) return res.status(404).json({ message: "Personaje no encontrado" });
    if (!enemy) return res.status(404).json({ message: "Enemigo no encontrado" });

    // 1) Simular combate real
    const sim = await simulateCombat({
      mode: "real",
      player,
      enemy,
      useConsumables: !!useConsumables,
      skills: skills ?? [],
      seed,
    });

    // 2) Si ganó el player, aplicar recompensas y loot
    let rewards: null | {
      xpGained: number;
      goldGained: number;
      levelUps: number[];
      drops: any[]; // tipar con tu ItemDocument si querés
      character: any; // personaje actualizado
    } = null;

    if (sim.winner === "player") {
      rewards = await grantRewardsAndLoot({
        player,
        enemy,
        // acá podés pasar el log de combate para analytics si querés
        battleLog: sim.log,
      });
    }

    return res.json({
      mode: "resolve",
      enemy: { id: enemy.id, name: enemy.name, level: enemy.level, tier: enemy.tier, bossType: enemy.bossType ?? null },
      result: sim,
      rewards, // null si perdió
    });
  } catch (err) {
    console.error("resolveCombatController error:", err);
    return res.status(500).json({ message: "Error resolviendo combate" });
  }
}

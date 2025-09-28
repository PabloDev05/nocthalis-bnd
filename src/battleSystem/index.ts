// src/battleSystem/index.ts

/**
 * Barrel del sistema de batalla:
 * - Core/Engine: CombatManager, StatusEngine, RNG determinístico.
 * - Snapshots: buildCharacterSnapshot (copia valores tal cual para el runner).
 * - Weapons: tipos + helpers (roll, plantillas, primary bonus).
 * - PvP Runner: runPvp (+ tipos de salida/timeline).
 * - Passives: packs y sumatoria de modificadores (para stats/combate).
 * - Constants/Fixtures/UI: utilidades compartidas.
 */

// ───────────────────────────────────────────
// Core / Engine
// ───────────────────────────────────────────
export { CombatManager } from "./core/CombatManager";
export type { AttackFlags, SideKey } from "./core/CombatManager";
export { mulberry32 } from "./core/RngFightSeed";
export { StatusEngine } from "./core/StatusEngine";

// OJO: la función de snapshot vive en /snapshots (ruta en minúsculas)
export { buildCharacterSnapshot } from "../battleSystem/snapshots/CharacterSnapshot";

// ───────────────────────────────────────────
// Weapons (helpers + tipos)
// ───────────────────────────────────────────
export type { WeaponData, WeaponCategory, WeaponDamageType } from "./core/Weapon";
export { rollWeaponDamage, weaponTemplateFor, normalizeWeaponData, ensureWeaponOrDefault, isPrimaryWeapon, PRIMARY_WEAPON_BONUS_MULT } from "./core/Weapon";

// ───────────────────────────────────────────
// PvP Runner (canónico)
// ───────────────────────────────────────────
export { runPvp } from "./pvp/pvpRunner";
export type { PvpFightResult, TimelineEntry as PvpTimelineEntry, TimelineEvent as PvpTimelineEvent } from "./pvp/pvpRunner";

// ───────────────────────────────────────────
// Entities (opcionales fuera del módulo)
// ───────────────────────────────────────────
export { PlayerCharacter } from "./entities/PlayerCharacter";
export { EnemyBot } from "./entities/EnemyBot";

// ───────────────────────────────────────────
// Passives (packs + efectos)
// ───────────────────────────────────────────
export { buildClassPassivePack } from "./passives/ClassPacks";
export { collectPassivesForCharacter, applyPassivesToBlocks } from "./passives/PassiveEffects";

// ───────────────────────────────────────────
// Fixtures / Constants
// ───────────────────────────────────────────
export * from "./fixtures/Fixtures";
export * from "./constants/allocateCoeffs";
export * from "./constants/resistances";
export * from "./constants/status";

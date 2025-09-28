// src/battleSystem/index.ts
/**
 * Módulo principal del sistema de combate.
 * Exporta la API pública: CombatManager, entidades, armas, pasivas, utilidades.
 * No exporta nada que no sea parte de la API pública (evitar fugas de abstracción).
 * Mantiene dependencias internas (core, entidades, pasivas, utilidades).
 * Evita dependencias externas fuera de battleSystem (salvo constantes).
 * Usa snapshots de CharacterSnapshot para copiar estados de personajes (sin referencias).
 * Usa RNG inyectable (por defecto Math.random, pero puede ser determinístico).
 * Usa StatusEngine para manejar estados y resistencias (separación de responsabilidades).
 * Evita lógica de UI, IO, red, almacenamiento, etc. (solo lógica de combate).
 * Evita lógica específica de juego (solo lógica genérica de combate táctico).
 */

// ───────────────────────────────────────────
// Core / Engine
// ───────────────────────────────────────────
export { CombatManager } from "./core/CombatManager";
export type { AttackFlags, SideKey } from "./core/CombatTypes"; // ⬅️ tipos ahora viven en combatTypes
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

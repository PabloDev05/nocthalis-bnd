// src/battleSystem/index.ts

// ───────────────────────────────────────────
// Core / Engine
// ───────────────────────────────────────────
export { CombatManager } from "./core/CombatManager";
export { mulberry32 } from "./core/RngFightSeed";
export { buildCharacterSnapshot } from "./core/CharacterSnapshot";
export { StatusEngine } from "./core/StatusEngine";

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
//  ⚠️ sin comodín para evitar conflictos de tipos
// ───────────────────────────────────────────
export { buildClassPassivePack } from "./passives/ClassPacks";
export { collectPassivesForCharacter, applyPassivesToBlocks } from "./passives/PassiveEffects";
export type { PassiveHooks, AttackFlags, SideKey } from "./passives/types";

// ───────────────────────────────────────────
// Fixtures (para tests / dev only)
// ───────────────────────────────────────────
export * from "./fixtures/Fixtures";

// ───────────────────────────────────────────
// Constants
// ───────────────────────────────────────────
export * from "./constants/allocateCoeffs";
export * from "./constants/resistances";
export * from "./constants/status";

// ───────────────────────────────────────────
// UI helpers (animación de timeline)
// ───────────────────────────────────────────
export * from "./ui/animationScheduler";

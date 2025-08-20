// ───────────────────────────────────────────
// Core / Engine
// ───────────────────────────────────────────
export { CombatManager } from "./core/CombatManager";
export { mulberry32 } from "./core/RngFightSeed";

// ───────────────────────────────────────────
// PvP Runner (canónico)
// ───────────────────────────────────────────
export { runPvp, runPvpForMatch } from "./pvp/pvpRunner";
export type { PvpFightResult, TimelineEntry as PvpTimelineEntry, TimelineEvent as PvpTimelineEvent, RunPvpForMatchResult, MatchTimelineEntry } from "./pvp/pvpRunner";

// ───────────────────────────────────────────
// Entities (si las usas fuera del módulo)
// ───────────────────────────────────────────
export { PlayerCharacter } from "./entities/PlayerCharacter";
export { EnemyBot } from "./entities/EnemyBot";

// ───────────────────────────────────────────
// Passives (packs + efectos)
// ───────────────────────────────────────────
export * from "./passives/ClassPacks";
export * from "./passives/PassiveEffects";

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

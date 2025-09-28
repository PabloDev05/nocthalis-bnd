// Balance/constantes enteras y estables para el motor de PvP.
// No debe importar nada fuera de battleSystem (salvo constantes).
// Usar solo en cálculos, no en lógica de combate (que va en CombatManager).
// Valores enteros, porcentajes como enteros 0..100.
// Ajustar con cuidado, afectan el balance general.
// Estos valores son estables y no dependen de la configuración del combate.
// Cambiarlos puede romper el balance y la experiencia del juego.
export const DEBUG_PROC = false;

/** Bloqueo reduce este porcentaje del daño (entero 0..100) */
export const BLOCK_REDUCTION_PERCENT = 50;

/** Softcaps de defensa (valores ENTEROS) */
export const PHYS_DEF_SOFTCAP = 40;
export const MAG_DEF_SOFTCAP = 40;

/** Bonos de escudo (enteros %) */
export const SHIELD_BLOCK_BONUS_PERCENT = 5;
export const SHIELD_DR_BONUS_PERCENT = 3;

/** Crítico base si falta dato (enteros %) y bonus daño crit (enteros %) */
export const CRIT_DEFAULT_CHANCE_PERCENT = 5;
export const CRIT_DEFAULT_BONUS_PERCENT = 40;

/** Caps de procs y escalado por Fate (enteros) */
export const PASSIVE_BASE_CHANCE = 5; // %
export const PASSIVE_PER_FATE = 2; // % por punto de Fate
export const PASSIVE_MAX_CHANCE = 50; // %
export const PASSIVE_PITY_AFTER_FAILS = 6; // garantía tras N fallos seguidos

export const ULT_BASE_CHANCE = 2; // %
export const ULT_PER_FATE = 1; // % por punto de Fate
export const ULT_MAX_CHANCE = 25; // %
export const ULT_COOLDOWN_TURNS = 4; // CD fijo (entero ≥ 1)
export const ULT_PITY_AFTER_FAILS = 8; // garantía tras N turnos sin lanzar

/** Daño base de Ultimate (enteros) */
export const ULT_DAMAGE_MAIN_MULT = 3; // multiplica el stat base
export const ULT_DAMAGE_WEAPON_PART = 1; // agrega min+max/2 aproximado arma
export const ULT_EXTRA_FLAT = 0; // flat extra (ajustable)

/** Contribuciones de offhand (enteros %) */
export const OFFHAND_WEAPON_CONTRIB_PERCENT = 35;
export const OFFHAND_FOCUS_CONTRIB_PERCENT = 15;

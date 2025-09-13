// Tipos compartidos para packs de pasivas orientados a UI/VFX.
// ⚠️ Estos hooks NO deben tocar la matemática del combate en esta capa.
// El motor (CombatManager) ya resuelve procs, daño, estados, etc.
// passives/types.ts
export type SideKey = "player" | "enemy";

/** Flags mínimos que describe un resultado de golpe */
export type AttackFlags = {
  miss?: boolean;
  blocked?: boolean;
  crit?: boolean;
};

/** Contexto estándar que recibirán los hooks */
export type PassiveContext = {
  /** Lado en el que se ejecuta el hook */
  side: SideKey;

  /**
   * Estado mutable “por lado” donde cada pack puede guardar contadores, stacks, etc.
   * Vida corta (solo dura el combate) y es específico de la clase.
   */
  state?: any;

  /** Permite “emitir” etiquetas para animaciones/logs (las consume el runner/UI) */
  pushEvent: (ev: string) => void;

  /** Snapshot ligero del propio lado (para leer className, etc.) */
  self?: { className?: string | null } | any;
};

/** Hooks opcionales que puede implementar una pasiva/clase (solo VFX/tags) */
export type PassiveHooks = {
  /** Se llama al inicio de cada ronda (turnos impares desde el POV del atacante inicial) */
  onRoundStart?(args: PassiveContext & { round?: number }): void;

  /**
   * Se invoca para generar tags sobre el DAÑO SALIENTE del lado que ataca,
   * antes de aplicar bloqueo/DR del defensor. No modificar números aquí.
   */
  onModifyOutgoing?(
    args: PassiveContext & {
      dmg: number;
      flags?: AttackFlags;
    }
  ): void;

  /**
   * Se invoca para generar tags sobre el DAÑO ENTRANTE del lado que recibe,
   * después del bloqueo pero antes del clamp final a >= 0. No modificar números.
   */
  onModifyIncoming?(
    args: PassiveContext & {
      dmg: number;
      flags: AttackFlags;
    }
  ): void;

  /**
   * Se dispara cuando la pasiva Fate-driven de la clase PROCea.
   * Útil para disparar flashes, auras, overlays, etc.
   */
  onPassiveProc?(args: PassiveContext & { name: string; durationTurns?: number; result?: "activated" | "refreshed" }): void;

  /**
   * Se dispara cuando la clase castea su Ultimate (independiente del daño).
   * Útil para bloom, cámara, postprocesos, etc.
   */
  onUltimateCast?(args: PassiveContext & { name: string }): void;
};

/** Un “pack” de pasiva por clase (o feature) */
export type ClassPassivePack = {
  /** Nombre descriptivo (usado para depurar/logs) */
  name: string;

  /** Conjunto de hooks; puede ser null si la clase no define lógica aquí */
  hooks: PassiveHooks | null;
};

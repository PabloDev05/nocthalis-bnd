// src/battleSystem/passives/types.ts

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

  /** Estado mutable “por lado” donde cada pack puede guardar contadores, stacks, etc. */
  state: any;

  /** Permite “emitir” etiquetas para animaciones/logs (se consumirán en el runner) */
  pushEvent: (ev: string) => void;

  /** Snapshot ligero del propio lado (para leer className, etc.) */
  self?: { className?: string | null } | any;
};

/** Hooks opcionales que puede implementar una pasiva/clase */
export type PassiveHooks = {
  /** Se llama al inicio de cada ronda (turnos impares del POV atacante) */
  onRoundStart?(args: PassiveContext & { round?: number }): void;

  /**
   * Se invoca para permitir modificar el daño SALIENTE del lado que ataca,
   * antes de aplicar reducción por bloqueo/DR del defensor.
   * - Retornar un número para reemplazar el daño.
   * - Si no retorna nada, se conserva el daño original.
   */
  onModifyOutgoing?(
    args: PassiveContext & {
      dmg: number;
      flags?: AttackFlags;
    }
  ): number | void;

  /**
   * Se invoca para permitir modificar el daño ENTRANTE del lado que recibe,
   * después del bloqueo pero antes del clamp final a >= 0.
   */
  onModifyIncoming?(
    args: PassiveContext & {
      dmg: number;
      flags: AttackFlags;
    }
  ): number | void;
};

/** Un “pack” de pasiva por clase (o feature) */
export type ClassPassivePack = {
  /** Nombre descriptivo (usado para depurar/logs) */
  name: string;

  /** Conjunto de hooks; puede ser null si la clase no define lógica aquí */
  hooks?: PassiveHooks | null;
};

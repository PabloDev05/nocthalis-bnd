export type SideKey = "player" | "enemy";

// Copiamos la forma mínima de flags para evitar dependencias cruzadas
export type AttackFlags = {
  miss?: boolean;
  blocked?: boolean;
  crit?: boolean;
};

export type PassiveHooks = {
  /** Inicio de ronda */
  onRoundStart?(args: { state: any; side: SideKey }): void;

  /** Modifica daño SALIENTE del lado que ataca */
  onModifyOutgoing?(args: { dmg: number; side: SideKey; state: any; pushEvent: (ev: string) => void; self?: { className?: string | null } | any; flags?: AttackFlags }): number | void;

  /** Modifica daño ENTRANTE del lado que recibe */
  onModifyIncoming?(args: {
    dmg: number;
    side: SideKey; // lado del DEFENSOR
    state: any;
    pushEvent: (ev: string) => void;
    self?: { className?: string | null } | any;
    flags: AttackFlags;
  }): number | void;
};

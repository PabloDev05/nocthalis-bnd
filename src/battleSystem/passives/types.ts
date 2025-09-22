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
  side: SideKey;
  state?: any;
  pushEvent: (ev: string) => void;
  self?: { className?: string | null } | any;
};

/** Hooks opcionales que puede implementar una pasiva/clase (solo VFX/tags) */
export type PassiveHooks = {
  onRoundStart?(args: PassiveContext & { round?: number }): void;
  onModifyOutgoing?(args: PassiveContext & { dmg: number; flags?: AttackFlags }): void;
  onModifyIncoming?(args: PassiveContext & { dmg: number; flags: AttackFlags }): void;
  onPassiveProc?(args: PassiveContext & { name: string; durationTurns?: number; result?: "activated" | "refreshed" }): void;
  onUltimateCast?(args: PassiveContext & { name: string }): void;
};

/** Un “pack” de pasiva por clase (o feature) */
export type ClassPassivePack = {
  name: string;
  hooks: PassiveHooks | null;
};

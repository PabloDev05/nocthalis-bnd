export interface Passive {
  /** _id opcional para cuando viene de Mongoose */
  _id?: string;
  id?: string;
  name: string;
  description: string;
  detail?: string;
  /** bonus que podría aplicar la clase/subclase */
  modifiers?: Partial<BaseStats & CombatStats>;
}

export interface Subclass {
  /** _id opcional para subdocs de Mongoose */
  _id?: string;
  id?: string;
  name: string;
  iconName: string;
  imageSubclassUrl?: string;
  passiveDefault?: Passive;
  passives: Passive[];
  /** slug opcional para lookup */
  slug?: string | null;
}

export interface CharacterClass {
  /** ids opcionales para DTOs/docs */
  _id?: string;
  id?: string;

  name: string;
  description?: string;
  iconName: string;
  imageMainClassUrl: string;

  passiveDefault: Passive;
  subclasses: Subclass[];

  /** Template de la clase */
  baseStats: BaseStats;
  resistances: Resistances;
  combatStats?: CombatStats;
}

/** Bloques de stats base */
export interface BaseStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number;
  endurance: number;
}

export interface Resistances {
  fire: number;
  ice: number;
  lightning: number;
  poison: number;
  sleep: number;
  paralysis: number;
  confusion: number;
  fear: number;
  dark: number;
  holy: number;
  stun: number;
  bleed: number;
  curse: number;
  knockback: number;
  criticalChanceReduction: number;
  criticalDamageReduction: number;
}

export interface CombatStats {
  maxHP: number;
  attackPower: number;
  magicPower: number;
  criticalChance: number;
  criticalDamageBonus: number;
  attackSpeed: number;
  evasion: number;
  blockChance: number;
  blockValue: number;
  lifeSteal: number;
  damageReduction: number;
  movementSpeed: number;
}

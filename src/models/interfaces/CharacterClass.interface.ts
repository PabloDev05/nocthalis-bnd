export interface Passive {
  name: string;
  description: string;
  detail?: string;
  modifiers?: Partial<BaseStats & CombatStats>; // bonus pasivo
}

export interface CharacterClass {
  name: string;
  description?: string;
  iconName: string;
  imageMainClassUrl: string;
  passiveDefault: Passive;
  subclasses: Subclass[];
  baseStats: BaseStats;
  resistances: Resistances;
  combatStats?: CombatStats;
}

export interface Subclass {
  name: string;
  iconName: string;
  passiveDefault?: Passive;
  imageSubclassUrl?: string;
  passives: Passive[];
}

export interface BaseStats {
  strength: number;
  dexterity: number;
  intelligence: number;
  vitality: number;
  physicalDefense: number;
  magicalDefense: number;
  luck: number;
  agility: number;
  endurance: number;
  wisdom: number;
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
  maxMP: number;
  attackPower: number;
  magicPower: number;
  criticalChance: number;
  criticalDamageBonus: number;
  attackSpeed: number;
  evasion: number;
  blockChance: number;
  blockValue: number;
  lifeSteal: number;
  manaSteal: number;
  damageReduction: number;
  movementSpeed: number;
}

import { BaseStats, Resistances, CombatStats } from "./CharacterClass.interface";

export interface EquipmentSlot {
  head: string | null;
  chest: string | null;
  legs: string | null;
  boots: string | null;
  gloves: string | null;
  weapon: string | null;
  offHand: string | null;
  ring1: string | null;
  ring2: string | null;
  amulet: string | null;
}

export interface Character {
  userId: string;
  classId: string;
  level: number;
  experience: number;
  stats: BaseStats;
  resistances: Resistances;
  passivesUnlocked: string[];
  inventory: string[];
  equipment: EquipmentSlot;
  createdAt: Date;
  combatStats?: CombatStats;
}

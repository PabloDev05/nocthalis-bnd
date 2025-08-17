import { BaseStats, Resistances, CombatStats } from "./CharacterClass.interface";

/**
 * NOTA: renombrado a `Equipment` para evitar colisión con el `EquipmentSlot`
 * (union de strings) exportado por el modelo Mongoose.
 */
export interface Equipment {
  helmet: string | null;
  chest: string | null;
  gloves: string | null;
  boots: string | null;
  mainWeapon: string | null;
  offWeapon: string | null;
  ring: string | null;
  belt: string | null;
  amulet: string | null;
}

export interface Character {
  /** IDs como strings para DTOs / API */
  id?: string;
  userId: string;
  classId: string;
  /** puede no existir aún */
  subclassId?: string | null;

  level: number;
  experience: number;

  /** Fuente de verdad en el personaje */
  stats: BaseStats;
  resistances: Resistances;
  combatStats?: CombatStats;

  passivesUnlocked: string[];
  inventory: string[];
  equipment: Equipment;

  /** timestamps del doc */
  createdAt: Date;
  updatedAt: Date;
}

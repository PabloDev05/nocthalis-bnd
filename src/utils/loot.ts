// src/utils/loot.ts
import { Item } from "../models/Item";

/** Clases jugables (ajusta si agregás más) */
export type PlayerClassName = "Guerrero" | "Mago" | "Asesino" | "Arquero";

/** Forma normalizada del drop */
export type ItemDrop = {
  id: string; // string amigable para el front
  _id: any; // ObjectId por conveniencia interna
  name: string;
  rarity: string;
  slot: string;
  iconUrl: string;
  levelRequirement: number;
};

// Overloads para admitir string u options
export async function rollLootForEnemy(enemy: any, playerClass?: PlayerClassName): Promise<ItemDrop[]>;
export async function rollLootForEnemy(enemy: any, opts?: { playerClass?: PlayerClassName }): Promise<ItemDrop[]>;

export async function rollLootForEnemy(_enemy: any, arg?: PlayerClassName | { playerClass?: PlayerClassName }): Promise<ItemDrop[]> {
  const _playerClass: PlayerClassName | undefined = typeof arg === "string" ? arg : arg?.playerClass;

  // 🎯 STUB: devuelve 0–2 ítems aleatorios del catálogo
  const count = Math.min(2, Math.max(0, Math.round(Math.random() * 2)));
  if (count === 0) return [];

  const sample = await Item.aggregate([{ $sample: { size: count } }]);

  // Mapear _id → id (aggregate no aplica transform de Mongoose)
  return sample.map((doc: any) => ({
    id: String(doc._id),
    _id: doc._id,
    name: doc.name,
    rarity: doc.rarity,
    slot: doc.slot,
    iconUrl: doc.iconUrl,
    levelRequirement: doc.levelRequirement,
  }));
}

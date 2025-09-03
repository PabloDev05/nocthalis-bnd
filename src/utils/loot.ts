// src/utils/loot.ts
import { Item } from "../models/Item";

/** Clases jugables actuales (alineadas al seedCharacterClasses) */
export type PlayerClassName = "Vampire" | "Werewolf" | "Necromancer" | "Revenant" | "Exorcist";

/** Forma normalizada del drop (DTO para el front) */
export type ItemDrop = {
  id: string; // string amigable para el front
  _id: any; // ObjectId por conveniencia interna
  name: string;
  rarity: string;
  slot: string;
  iconUrl: string;
  levelRequirement: number | undefined;
};

// Overloads para admitir string u options (back-compat)
export async function rollLootForEnemy(enemy: any, playerClass?: PlayerClassName): Promise<ItemDrop[]>;
export async function rollLootForEnemy(enemy: any, opts?: { playerClass?: PlayerClassName }): Promise<ItemDrop[]>;

/**
 * STUB simple de loot:
 * - Intenta 0–2 ítems según catálogo.
 * - Si se pasa playerClass, filtra primero por classRestriction compatible (o sin restricción).
 * - Filtra opcionalmente por levelRequirement <= enemy.level + 2 si el enemigo trae level.
 * - Si no encuentra nada con filtros, hace fallback a sample aleatorio.
 */
export async function rollLootForEnemy(enemy: any, arg?: PlayerClassName | { playerClass?: PlayerClassName }): Promise<ItemDrop[]> {
  const playerClass: PlayerClassName | undefined = typeof arg === "string" ? arg : arg?.playerClass;

  // Cantidad aleatoria 0..2 (misma lógica simple que tenías)
  const count = Math.min(2, Math.max(0, Math.round(Math.random() * 2)));
  if (count === 0) return [];

  // Filtros opcionales
  const level = Number(enemy?.level);
  const hasLevel = Number.isFinite(level);

  // 1) Intento con filtros “inteligentes” (classRestriction + level)
  const match: Record<string, any> = {};
  if (playerClass) {
    // Items sin restricción de clase o que incluyen la clase del jugador
    match.$or = [{ classRestriction: { $exists: false } }, { classRestriction: { $size: 0 } }, { classRestriction: playerClass }, { classRestriction: { $in: [playerClass] } }];
  }
  if (hasLevel) {
    // Si el item tiene requirement, que sea alcanzable (tolerancia +2 niveles)
    match.$and = [
      ...(match.$and ?? []),
      {
        $or: [{ levelRequirement: { $exists: false } }, { levelRequirement: { $lte: level + 2 } }],
      },
    ];
  }

  // Primero probamos con filtros si hay alguno armado
  if (Object.keys(match).length > 0) {
    const filtered = await Item.aggregate([{ $match: match }, { $sample: { size: count } }]);

    if (filtered?.length) {
      return filtered.map((doc: any) => ({
        id: String(doc._id),
        _id: doc._id,
        name: doc.name,
        rarity: doc.rarity,
        slot: doc.slot,
        iconUrl: doc.iconUrl,
        levelRequirement: doc.levelRequirement,
      }));
    }
  }

  // 2) Fallback: sample aleatorio sin filtros (para no devolver vacío)
  const sample = await Item.aggregate([{ $sample: { size: count } }]);

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

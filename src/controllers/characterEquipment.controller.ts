// src/controllers/characterEquipment.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { Item } from "../models/Item";

interface AuthReq extends Request {
  user?: { id: string };
}

const SLOT_MAP: Record<string, keyof InstanceType<typeof Character>["equipment"]> = {
  // modernos -> actuales del schema
  helmet: "head",
  chest: "chest",
  gloves: "gloves",
  boots: "boots",
  mainWeapon: "weapon",
  offWeapon: "offHand",
  ring: "ring1", // por ahora 1 solo anillo
  belt: "legs", // TEMP: usamos legs como “belt” hasta migrar el schema
  amulet: "amulet",

  // por si el front ya manda los legacy
  head: "head",
  weapon: "weapon",
  offHand: "offHand",
  ring1: "ring1",
  ring2: "ring2",
  legs: "legs",
};

const ALLOWED_SLOTS = Object.keys(SLOT_MAP);

/** helper: asegura estructura de equipment */
function ensureEquipment(char: any) {
  char.equipment = char.equipment || {};
  const defaults = {
    head: null,
    chest: null,
    legs: null, // TEMP usado para "belt"
    boots: null,
    gloves: null,
    weapon: null,
    offHand: null,
    ring1: null,
    ring2: null,
    amulet: null,
  };
  for (const k of Object.keys(defaults)) {
    if (typeof char.equipment[k] === "undefined") char.equipment[k] = (defaults as any)[k];
  }
}

/** GET /character/inventory */
export async function getInventory(req: AuthReq, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    ensureEquipment(character);

    // Items por id (si están guardados como strings, igual sirven para _id)
    const invIds = (character.inventory || []).filter(Boolean);
    const items = invIds.length ? await Item.find({ _id: { $in: invIds } }).lean() : [];

    return res.json({
      equipment: character.equipment,
      inventory: items,
    });
  } catch (err) {
    console.error("getInventory error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

/** POST /character/equip  { itemId } */
export async function equipItem(req: AuthReq, res: Response) {
  try {
    const userId = req.user?.id;
    const { itemId } = req.body as { itemId?: string };
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    if (!itemId || !Types.ObjectId.isValid(itemId)) return res.status(400).json({ message: "itemId inválido" });

    const [character, item] = await Promise.all([Character.findOne({ userId }), Item.findById(itemId).lean()]);
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });
    if (!item) return res.status(404).json({ message: "Ítem no encontrado" });

    // Determinar slot de ese item (con tu schema actual)
    // Nota: tu Item tiene `slot`: "head"|"chest"|"legs"|...|"weapon"|"offHand"|...
    const incomingSlot = item.slot;
    const mapped = SLOT_MAP[incomingSlot];
    if (!mapped) return res.status(400).json({ message: `Slot no soportado: ${incomingSlot}` });

    if ((item.levelRequirement ?? 1) > character.level) {
      return res.status(400).json({ message: "Nivel insuficiente para equipar este ítem" });
    }

    ensureEquipment(character);

    // mover equip anterior al inventario
    const prev = (character.equipment as any)[mapped];
    if (prev) {
      character.inventory = character.inventory || [];
      if (!character.inventory.find((x: string) => String(x) === String(prev))) {
        character.inventory.push(String(prev));
      }
    }

    // equipar el nuevo
    (character.equipment as any)[mapped] = item._id;

    // quitar de inventario si estaba
    character.inventory = (character.inventory || []).filter((x: string) => String(x) !== String(item._id));

    await character.save();

    return res.json({
      message: "Ítem equipado",
      slot: mapped,
      equipment: character.equipment,
      inventory: character.inventory,
    });
  } catch (err) {
    console.error("equipItem error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

/** POST /character/unequip  { slot } */
export async function unequipItem(req: AuthReq, res: Response) {
  try {
    const userId = req.user?.id;
    let { slot } = req.body as { slot?: string };
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    if (!slot) return res.status(400).json({ message: "Falta slot" });

    if (!ALLOWED_SLOTS.includes(slot)) {
      return res.status(400).json({ message: `Slot no soportado: ${slot}` });
    }
    const mapped = SLOT_MAP[slot];

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    ensureEquipment(character);

    const equipped = (character.equipment as any)[mapped];
    if (!equipped) {
      return res.status(400).json({ message: "No hay ítem equipado en ese slot" });
    }

    // pasar al inventario
    character.inventory = character.inventory || [];
    if (!character.inventory.find((x: string) => String(x) === String(equipped))) {
      character.inventory.push(String(equipped));
    }

    (character.equipment as any)[mapped] = null;
    await character.save();

    return res.json({
      message: "Ítem desequipado",
      slot: mapped,
      equipment: character.equipment,
      inventory: character.inventory,
    });
  } catch (err) {
    console.error("unequipItem error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

/** POST /character/use-item  { itemId }  — solo consumibles básicos por ahora */
export async function useConsumable(req: AuthReq, res: Response) {
  try {
    const userId = req.user?.id;
    const { itemId } = req.body as { itemId?: string };
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    if (!itemId || !Types.ObjectId.isValid(itemId)) return res.status(400).json({ message: "itemId inválido" });

    const [character, item] = await Promise.all([Character.findOne({ userId }), Item.findById(itemId).lean()]);
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });
    if (!item) return res.status(404).json({ message: "Ítem no encontrado" });

    // validar que esté en inventario
    const inInv = (character.inventory || []).some((x: string) => String(x) === String(item._id));
    if (!inInv) return res.status(400).json({ message: "El ítem no está en tu inventario" });

    // Debe ser consumible
    if (!item.isConsumable) {
      return res.status(400).json({ message: "El ítem no es consumible" });
    }

    // ⚠️ Efecto placeholder (aplicar según tu diseño)
    // p.ej., si es "potion" y tiene combatStats.maxHP => curar fuera de combate, etc.
    // Por ahora solo lo removemos del inventario.
    character.inventory = (character.inventory || []).filter((x: string) => String(x) !== String(item._id));
    await character.save();

    return res.json({ message: "Consumible usado", itemId: item._id });
  } catch (err) {
    console.error("useConsumable error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

/** GET /character/progression */
export async function getProgression(req: AuthReq, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const character = await Character.findOne({ userId }).lean();
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    const level = character.level || 1;
    const experience = character.experience || 0;
    const xpToNext = Math.max(0, xpNeededFor(level + 1) - experience);

    return res.json({
      level,
      experience,
      nextLevelAt: xpNeededFor(level + 1),
      xpToNext,
    });
  } catch (err) {
    console.error("getProgression error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

// Curva simple (ajústala cuando quieras)
function xpNeededFor(level: number) {
  // base 100 + growth cuadrática
  return Math.floor(100 + level * level * 20);
}

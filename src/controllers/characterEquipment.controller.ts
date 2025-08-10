import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character, type Equipment, type EquipmentSlot } from "../models/Character";
import { Item, type ItemLean } from "../models/Item";

interface AuthReq extends Request {
  user?: { id: string };
}

// Claves de slot válidas (desde el tipo del modelo)
const ALLOWED_SLOTS: readonly EquipmentSlot[] = ["helmet", "chest", "gloves", "boots", "mainWeapon", "offWeapon", "ring", "belt", "amulet"] as const;

type AllowedSlot = (typeof ALLOWED_SLOTS)[number];

/** Asegura estructura completa de equipment */
function ensureEquipment(char: { equipment?: Partial<Equipment> }) {
  const defaults: Equipment = {
    helmet: null,
    chest: null,
    gloves: null,
    boots: null,
    mainWeapon: null,
    offWeapon: null,
    ring: null,
    belt: null,
    amulet: null,
  };
  if (!char.equipment) {
    char.equipment = { ...defaults };
    return;
  }
  for (const k of ALLOWED_SLOTS) {
    if (typeof char.equipment[k] === "undefined") {
      char.equipment[k] = defaults[k];
    }
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

    // Cargar ítems del inventario
    const invIds = (character.inventory || []).filter(Boolean);
    let items: ItemLean[] = [];
    if (invIds.length > 0) {
      items = await Item.find({ _id: { $in: invIds } }).lean<ItemLean[]>({ virtuals: true });
    }

    return res.json({
      equipment: character.equipment, // ids string o null
      inventory: items, // objetos con 'id' (sin _id)
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
    if (!itemId || !Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "itemId inválido" });
    }

    const [character, item] = await Promise.all([Character.findOne({ userId }), Item.findById(itemId).lean<ItemLean>({ virtuals: true })]);
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });
    if (!item) return res.status(404).json({ message: "Ítem no encontrado" });

    // Validar slot del ítem
    const incomingSlot = item.slot as EquipmentSlot;
    if (!ALLOWED_SLOTS.includes(incomingSlot)) {
      return res.status(400).json({ message: `Slot no soportado: ${incomingSlot}` });
    }
    const slot: AllowedSlot = incomingSlot;

    // Requisito de nivel
    if ((item.levelRequirement ?? 1) > (character.level || 1)) {
      return res.status(400).json({ message: "Nivel insuficiente para equipar este ítem" });
    }

    ensureEquipment(character);

    // Si había algo equipado, moverlo al inventario
    const prev = character.equipment[slot];
    if (prev) {
      character.inventory = character.inventory || [];
      if (!character.inventory.find((x: string) => String(x) === String(prev))) {
        character.inventory.push(String(prev));
      }
    }

    // Equipar el nuevo (guardamos el id como string)
    character.equipment[slot] = item.id;

    // Remover del inventario si estaba
    character.inventory = (character.inventory || []).filter((x: string) => String(x) !== String(item.id));

    await character.save();

    return res.json({
      message: "Ítem equipado",
      slot,
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
    const { slot } = req.body as { slot?: string };
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    if (!slot) return res.status(400).json({ message: "Falta slot" });

    if (!ALLOWED_SLOTS.includes(slot as EquipmentSlot)) {
      return res.status(400).json({ message: `Slot no soportado: ${slot}` });
    }
    const typedSlot = slot as EquipmentSlot;

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    ensureEquipment(character);

    const equipped = character.equipment[typedSlot];
    if (!equipped) {
      return res.status(400).json({ message: "No hay ítem equipado en ese slot" });
    }

    // Mover al inventario
    character.inventory = character.inventory || [];
    if (!character.inventory.find((x: string) => String(x) === String(equipped))) {
      character.inventory.push(String(equipped));
    }

    character.equipment[typedSlot] = null;
    await character.save();

    return res.json({
      message: "Ítem desequipado",
      slot: typedSlot,
      equipment: character.equipment,
      inventory: character.inventory,
    });
  } catch (err) {
    console.error("unequipItem error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

/** POST /character/use-item  { itemId } — consumibles */
export async function useConsumable(req: AuthReq, res: Response) {
  try {
    const userId = req.user?.id;
    const { itemId } = req.body as { itemId?: string };
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    if (!itemId || !Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "itemId inválido" });
    }

    const [character, item] = await Promise.all([Character.findOne({ userId }), Item.findById(itemId).lean<ItemLean>({ virtuals: true })]);
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });
    if (!item) return res.status(404).json({ message: "Ítem no encontrado" });

    // Validar que esté en inventario (por id string)
    const inInv = (character.inventory || []).some((x: string) => String(x) === String(item.id));
    if (!inInv) return res.status(400).json({ message: "El ítem no está en tu inventario" });

    // Debe ser consumible
    if (!item.isConsumable) {
      return res.status(400).json({ message: "El ítem no es consumible" });
    }

    // TODO: aplicar efecto según tipo/efectos
    character.inventory = (character.inventory || []).filter((x: string) => String(x) !== String(item.id));
    await character.save();

    return res.json({ message: "Consumible usado", itemId: item.id });
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
    const nextLevelAt = xpNeededFor(level + 1);
    const xpToNext = Math.max(0, nextLevelAt - experience);

    return res.json({ level, experience, nextLevelAt, xpToNext });
  } catch (err) {
    console.error("getProgression error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

// Curva simple
function xpNeededFor(level: number) {
  return Math.floor(100 + level * level * 20);
}

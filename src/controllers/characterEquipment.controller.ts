import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character, type Equipment, type EquipmentSlot } from "../models/Character";
import { Item, type ItemLean } from "../models/Item";
import { computeProgression } from "../services/progression.service";

// Slots válidos según el modelo
const ALLOWED_SLOTS = ["helmet", "chest", "gloves", "boots", "mainWeapon", "offWeapon", "ring", "belt", "amulet"] as const satisfies Readonly<EquipmentSlot[]>;
type AllowedSlot = (typeof ALLOWED_SLOTS)[number];

/** Garantiza que `character.equipment` tenga todas las claves inicializadas */
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
    if (typeof char.equipment[k] === "undefined") char.equipment[k] = defaults[k];
  }
}

/** GET /character/inventory  → equipo (ids) + inventario (items lean) */
export async function getInventory(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const character = await Character.findOne({ userId });
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    ensureEquipment(character);

    const invIds = (character.inventory || []).filter(Boolean);
    let items: ItemLean[] = [];
    if (invIds.length) {
      items = await Item.find({ _id: { $in: invIds } }).lean<ItemLean[]>({ virtuals: true });
    }

    return res.json({
      equipment: character.equipment, // ids string o null
      inventory: items, // objetos lean con 'id' (virtual)
    });
  } catch (err) {
    console.error("getInventory error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

/** POST /character/equip  { itemId } */
export async function equipItem(req: Request, res: Response) {
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

    // Si había algo equipado en ese slot, lo mandamos al inventario
    const prev = character.equipment[slot];
    if (prev) {
      character.inventory = character.inventory || [];
      if (!character.inventory.find((x: string) => String(x) === String(prev))) {
        character.inventory.push(String(prev));
      }
    }

    // Equipa nuevo (guardamos id como string)
    const itemIdStr = item.id ?? (item as any)._id?.toString();
    character.equipment[slot] = itemIdStr;

    // Quitar del inventario si estaba
    character.inventory = (character.inventory || []).filter((x: string) => String(x) !== String(itemIdStr));

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
export async function unequipItem(req: Request, res: Response) {
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
export async function useConsumable(req: Request, res: Response) {
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

    // Debe estar en inventario
    const inInv = (character.inventory || []).some((x: string) => String(x) === String(item.id ?? (item as any)._id));
    if (!inInv) return res.status(400).json({ message: "El ítem no está en tu inventario" });

    if (!item.isConsumable) {
      return res.status(400).json({ message: "El ítem no es consumible" });
    }

    // TODO: aplicar efecto según 'effects' / tipo
    character.inventory = (character.inventory || []).filter((x: string) => String(x) !== String(item.id ?? (item as any)._id));
    await character.save();

    return res.json({ message: "Consumible usado", itemId: item.id ?? (item as any)._id?.toString() });
  } catch (err) {
    console.error("useConsumable error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

/** GET /character/progression — curva acumulativa (todos enteros) */
export async function getProgression(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const character = await Character.findOne({ userId }).lean();
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    const exp = Number(character.experience ?? 0);
    const lvl = Number(character.level ?? 1);

    const p = computeProgression(exp, lvl);

    return res.json({
      level: p.level,
      experience: exp,
      currentLevelAt: p.currentLevelAt,
      nextLevelAt: p.nextLevelAt,
      xpSinceLevel: p.xpSinceLevel,
      xpForThisLevel: p.xpForThisLevel,
      xpToNext: p.xpToNext,
      xpPercent: p.xpPercentInt, // porcentaje entero 0..100
      isMaxLevel: p.isMaxLevel,
    });
  } catch (err) {
    console.error("getProgression error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

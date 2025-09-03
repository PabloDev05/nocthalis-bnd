// src/controllers/characterEquipment.controller.ts
/* eslint-disable no-console */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character, type Equipment, type EquipmentSlot } from "../models/Character";
import { Item, type ItemLean } from "../models/Item";
import { getStaminaByUserId, setStamina } from "../services/stamina.service";

// Slots válidos según el modelo
const ALLOWED_SLOTS = ["helmet", "chest", "gloves", "boots", "mainWeapon", "offWeapon", "ring", "belt", "amulet"] as const;
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

    // Requisito de nivel (si el item lo define)
    if ((item.levelRequirement ?? 1) > (character.level || 1)) {
      return res.status(400).json({ message: "Nivel insuficiente para equipar este ítem" });
    }

    // (Opcional) Restringir a clase si el item trae restricción
    if (Array.isArray((item as any).classRestriction) && (item as any).classRestriction.length) {
      // Si querés validar de verdad, populá la clase del personaje y chequea el nombre contra classRestriction.
      // Por ahora solo permitimos; descomenta si ya tenés className en Character.
      // const className = (character as any).className;
      // if (!className || !(item as any).classRestriction.includes(className)) {
      //   return res.status(400).json({ message: "Tu clase no puede equipar este ítem" });
      // }
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

/** Detecta “curas” básicas en un consumible sin romper si no existen */
function detectConsumableHeals(item: any): { staminaGain: number; hpGain: number } {
  let staminaGain = 0;
  let hpGain = 0;

  // Campos sencillos comunes
  if (Number.isFinite((item as any).staminaRestore)) staminaGain = Math.max(0, Math.floor((item as any).staminaRestore));
  if (Number.isFinite((item as any).hpRestore)) hpGain = Math.max(0, Math.floor((item as any).hpRestore));

  // effects?: { stamina?: number; hp?: number }
  if ((item as any).effects) {
    if (Number.isFinite((item as any).effects.stamina)) staminaGain = Math.max(staminaGain, Math.floor((item as any).effects.stamina));
    if (Number.isFinite((item as any).effects.hp)) hpGain = Math.max(hpGain, Math.floor((item as any).effects.hp));
  }

  // mods[]: buscamos special stamina / hp
  if (Array.isArray((item as any).mods)) {
    for (const m of (item as any).mods) {
      if (!m || typeof m !== "object") continue;
      if (m.scope === "special" && (m.key === "stamina" || m.key === "staminaRestore") && m.mode === "add") {
        staminaGain = Math.max(staminaGain, Math.floor(Number(m.value || 0)));
      }
      if (m.scope === "special" && (m.key === "hp" || m.key === "hpRestore") && m.mode === "add") {
        hpGain = Math.max(hpGain, Math.floor(Number(m.value || 0)));
      }
    }
  }

  return { staminaGain, hpGain };
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
    const idStr = String(item.id ?? (item as any)._id);
    const inInv = (character.inventory || []).some((x: string) => String(x) === idStr);
    if (!inInv) return res.status(400).json({ message: "El ítem no está en tu inventario" });

    if (!item.isConsumable && (item as any).type !== "potion") {
      return res.status(400).json({ message: "El ítem no es consumible" });
    }

    // Detectar curas básicas
    const { staminaGain, hpGain } = detectConsumableHeals(item);

    // Aplicar stamina (cap y ETA manejados por el servicio)
    let staminaAfter: any | undefined;
    if (staminaGain > 0) {
      const snap = await getStaminaByUserId(userId).catch(() => null);
      const next = Math.max(0, Math.floor((snap?.stamina ?? 0) + staminaGain));
      staminaAfter = await setStamina(userId, next).catch(() => undefined);
    }

    // Aplicar HP si corresponde (cap a maxHP)
    if (hpGain > 0) {
      const maxHP = Number((character as any).combatStats?.maxHP ?? (character as any).maxHP ?? 0);
      const curHP = Number((character as any).currentHP ?? maxHP);
      const nextHP = Math.min(maxHP, Math.max(0, curHP + Math.floor(hpGain)));
      (character as any).currentHP = nextHP;
    }

    // Consumir: quitar del inventario
    character.inventory = (character.inventory || []).filter((x: string) => String(x) !== idStr);
    await character.save();

    return res.json({
      message: "Consumible usado",
      itemId: idStr,
      staminaAfter, // snapshot si aplicó
      currentHP: (character as any).currentHP,
    });
  } catch (err) {
    console.error("useConsumable error:", err);
    return res.status(500).json({ message: "Error interno" });
  }
}

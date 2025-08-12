// src/controllers/character.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeAvailablePoints } from "../services/allocation.service";
import type { BaseStats } from "../interfaces/character/CharacterClass.interface";

const DBG = process.env.DEBUG_ALLOCATION === "1";

interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string };
}

/** DTOs */
type PassiveDTO = { id: string; name: string; description: string; detail?: string };
type SubclassDTO = {
  id: string;
  name: string;
  iconName: string;
  imageSubclassUrl?: string;
  passiveDefault?: PassiveDTO | null;
  passives: PassiveDTO[];
  slug?: string | null;
};
type ClassMetaDTO = {
  id: string;
  name: string;
  iconName: string;
  imageMainClassUrl: string;
  passiveDefault: PassiveDTO;
  subclasses: SubclassDTO[];
};
type CharacterResponseDTO = {
  id: string;
  userId: Types.ObjectId;
  username: string;
  class: ClassMetaDTO;
  selectedSubclass: SubclassDTO | null;
  level: number;
  experience: number;
  stats: Record<string, number>;
  resistances: Record<string, number>;
  combatStats: Record<string, number>;
  equipment: Record<string, string | null>;
  inventory: string[];
  passivesUnlocked: string[];
  createdAt: Date;
  updatedAt: Date;
  availablePoints?: number;
};

/** helpers de mapeo */
const toId = (x: any) => (x?._id ?? x?.id)?.toString();
const mapPassive = (p: any | undefined): PassiveDTO | null => (!p ? null : { id: toId(p), name: p.name, description: p.description, detail: p.detail });
const mapSubclass = (s: any): SubclassDTO => ({
  id: toId(s),
  name: s.name,
  iconName: s.iconName,
  imageSubclassUrl: s.imageSubclassUrl,
  passiveDefault: mapPassive(s.passiveDefault),
  passives: Array.isArray(s.passives) ? (s.passives.map(mapPassive).filter(Boolean) as PassiveDTO[]) : [],
  slug: s.slug ?? null,
});
const mapClassMeta = (raw: any): ClassMetaDTO => ({
  id: toId(raw),
  name: raw.name,
  iconName: raw.iconName,
  imageMainClassUrl: raw.imageMainClassUrl,
  passiveDefault: mapPassive(raw.passiveDefault)!,
  subclasses: Array.isArray(raw.subclasses) ? raw.subclasses.map(mapSubclass) : [],
});

/** Normaliza cualquier objeto a BaseStats (evita error de tipos) */
function coerceBaseStats(src: any): BaseStats {
  return {
    strength: Number(src?.strength ?? 0),
    dexterity: Number(src?.dexterity ?? 0),
    intelligence: Number(src?.intelligence ?? 0),
    vitality: Number(src?.vitality ?? 0),
    physicalDefense: Number(src?.physicalDefense ?? 0),
    magicalDefense: Number(src?.magicalDefense ?? 0),
    luck: Number(src?.luck ?? 0),
    agility: Number(src?.agility ?? 0),
    endurance: Number(src?.endurance ?? 0),
    wisdom: Number(src?.wisdom ?? 0),
  };
}

/** Redondeo de combatStats solo para RESPUESTA */
function toFixedN(n: any, places: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const p = Math.pow(10, places);
  return Math.round(v * p) / p;
}
function roundCombatStatsForResponse(cs: Record<string, number>) {
  const c = { ...(cs as any) };
  c.maxHP = Math.round(c.maxHP ?? 0);
  c.maxMP = Math.round(c.maxMP ?? 0);
  c.blockChance = Math.round(c.blockChance ?? 0);
  c.lifeSteal = Math.round(c.lifeSteal ?? 0);
  c.manaSteal = Math.round(c.manaSteal ?? 0);
  c.attackPower = toFixedN(c.attackPower, 1);
  c.magicPower = toFixedN(c.magicPower, 1);
  c.criticalDamageBonus = toFixedN(c.criticalDamageBonus, 1);
  c.attackSpeed = toFixedN(c.attackSpeed, 2);
  c.evasion = toFixedN(c.evasion, 2);
  c.criticalChance = toFixedN(c.criticalChance, 2);
  c.blockValue = toFixedN(c.blockValue, 2);
  c.damageReduction = toFixedN(c.damageReduction, 2);
  c.movementSpeed = toFixedN(c.movementSpeed, 2);
  return c;
}

export const getMyCharacter = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const characterDoc = await Character.findOne({ userId });
    if (!characterDoc) return res.status(404).json({ message: "Personaje no encontrado" });

    // Traemos la clase con baseStats para el cálculo de availablePoints
    const baseClassDoc = await CharacterClass.findById(characterDoc.classId).select("name iconName imageMainClassUrl passiveDefault subclasses baseStats");
    if (!baseClassDoc) return res.status(404).json({ message: "Clase base no encontrada" });

    const ch = characterDoc.toObject();
    const baseClassRaw = baseClassDoc.toObject();
    const baseClass = mapClassMeta(baseClassRaw);

    // Subclase seleccionada
    const subclassIdStr = ch.subclassId ? ch.subclassId.toString() : null;
    const selectedSubclass = subclassIdStr && Array.isArray(baseClass.subclasses) ? baseClass.subclasses.find((s) => s.id === subclassIdStr) ?? null : null;

    // >>> TIPOS ARREGLADOS AQUÍ
    const statsBS: BaseStats = coerceBaseStats(ch.stats);
    const baseBS: BaseStats = coerceBaseStats(baseClassRaw.baseStats);

    // Puntos disponibles contra template
    const availablePoints = computeAvailablePoints(Number(ch.level ?? 1), statsBS, baseBS);
    if (DBG) console.log("[/character/me] availablePoints:", availablePoints);

    // Redondeo de salida
    const combatStatsRounded = roundCombatStatsForResponse(ch.combatStats || {});

    const payload: CharacterResponseDTO = {
      id: String(characterDoc._id),
      userId: ch.userId,
      username: req.user!.username,
      class: baseClass,
      selectedSubclass,
      level: ch.level,
      experience: ch.experience,
      stats: ch.stats,
      resistances: ch.resistances,
      combatStats: combatStatsRounded,
      equipment: ch.equipment,
      inventory: ch.inventory,
      passivesUnlocked: ch.passivesUnlocked,
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt,
      availablePoints, // 👈 listo para UI
    };

    return res.json(payload);
  } catch (err) {
    console.error("getMyCharacter error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

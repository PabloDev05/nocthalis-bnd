// src/controllers/character.controller.ts
/* eslint-disable no-console */
import { RequestHandler } from "express";
import mongoose, { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeAvailablePoints } from "../services/allocation.service";
import { getStaminaByUserId } from "../services/stamina.service";
import type { BaseStats, CombatStats, Resistances } from "../interfaces/character/CharacterClass.interface";
import { roundCombatStatsForResponse } from "../utils/characterFormat";

const DBG = process.env.DEBUG_ALLOCATION === "1";

/** DTOs minimalistas y alineados al diseño nuevo */
type SubclassDTO = {
  id: string;
  name: string;
  iconName: string;
  imageSubclassUrl?: string;
  slug?: string | null;
};

type ClassMetaDTO = {
  id: string;
  name: string;
  iconName: string;
  imageMainClassUrl: string;
  // info de armas para la UI (bono 10% si es primaria, lo aplica el motor)
  primaryWeapons: string[];
  secondaryWeapons: string[];
  defaultWeapon: string;
  allowedWeapons: string[];

  passiveDefaultSkill: any | null;
  ultimateSkill: any | null;
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

  stats: BaseStats; // incluye fate
  resistances: Resistances;
  combatStats: CombatStats; // ya redondeado para UI

  equipment: Record<string, string | null>;
  inventory: string[];

  createdAt: Date;
  updatedAt: Date;

  availablePoints?: number;

  stamina: {
    stamina: number;
    staminaMax: number;
    usedRate: number;
    updatedAt: string;
    etaFullAt: string | null;
  };
};

/** helpers */
const toId = (x: any) => (x?._id ?? x?.id)?.toString() || "";

const mapSubclass = (s: any): SubclassDTO => ({
  id: toId(s),
  name: String(s.name ?? ""),
  iconName: String(s.iconName ?? ""),
  imageSubclassUrl: s.imageSubclassUrl,
  slug: s.slug ?? null,
});

const mapClassMeta = (raw: any): ClassMetaDTO => ({
  id: toId(raw),
  name: String(raw.name ?? ""),
  iconName: String(raw.iconName ?? ""),
  imageMainClassUrl: String(raw.imageMainClassUrl ?? ""),

  primaryWeapons: Array.isArray(raw.primaryWeapons) ? raw.primaryWeapons : [],
  secondaryWeapons: Array.isArray(raw.secondaryWeapons) ? raw.secondaryWeapons : [],
  defaultWeapon: String(raw.defaultWeapon ?? ""),
  allowedWeapons: Array.isArray(raw.allowedWeapons) ? raw.allowedWeapons : [],

  passiveDefaultSkill: raw.passiveDefaultSkill ?? null,
  ultimateSkill: raw.ultimateSkill ?? null,
  subclasses: Array.isArray(raw.subclasses) ? raw.subclasses.map(mapSubclass) : [],
});

/** Normaliza a BaseStats (incluye fate) */
function coerceBaseStats(src: any): BaseStats {
  return {
    strength: Number(src?.strength ?? 0),
    dexterity: Number(src?.dexterity ?? 0),
    intelligence: Number(src?.intelligence ?? 0),
    vitality: Number(src?.vitality ?? 0),
    physicalDefense: Number(src?.physicalDefense ?? 0),
    magicalDefense: Number(src?.magicalDefense ?? 0),
    luck: Number(src?.luck ?? 0),
    endurance: Number(src?.endurance ?? 0),
    fate: Number(src?.fate ?? 0),
  };
}

/** GET /character/me */
export const getMyCharacter: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "No autenticado" });
    }

    // Personaje + username del User
    const characterDoc = await Character.findOne({ userId }).populate({ path: "userId", select: "username" }).lean();

    if (!characterDoc) return res.status(404).json({ message: "Personaje no encontrado" });

    // Clase con metadatos nuevos
    const baseClassDoc = await CharacterClass.findById(characterDoc.classId)
      .select("name iconName imageMainClassUrl primaryWeapons secondaryWeapons defaultWeapon allowedWeapons passiveDefaultSkill ultimateSkill subclasses baseStats")
      .lean();

    if (!baseClassDoc) return res.status(404).json({ message: "Clase base no encontrada" });

    const classMeta = mapClassMeta(baseClassDoc);

    // Subclase seleccionada (si existe)
    const subclassIdStr = characterDoc.subclassId ? String(characterDoc.subclassId) : null;
    const selectedSubclass = subclassIdStr && Array.isArray(classMeta.subclasses) ? classMeta.subclasses.find((s) => s.id === subclassIdStr) ?? null : null;

    // Puntos disponibles respecto a base de la clase (ahora con fate)
    const statsBS: BaseStats = coerceBaseStats(characterDoc.stats);
    const baseBS: BaseStats = coerceBaseStats(baseClassDoc.baseStats);
    const availablePoints = computeAvailablePoints(Number(characterDoc.level ?? 1), statsBS, baseBS);
    if (DBG) console.log("[/character/me] availablePoints:", availablePoints);

    // Combat stats “bonitos” para UI
    const combatStatsRounded = roundCombatStatsForResponse(characterDoc.combatStats || ({} as any));

    // username desde el populate (o desde req.user)
    const usernameFromPopulate = (characterDoc as any)?.userId?.username ?? (req.user as any)?.username ?? "—";

    // Regeneración perezosa de stamina + snapshot
    const staminaSnap = await getStaminaByUserId(userId);

    const payload: CharacterResponseDTO = {
      id: String(characterDoc._id),
      userId: characterDoc.userId as unknown as Types.ObjectId,
      username: usernameFromPopulate,

      class: classMeta,
      selectedSubclass,

      level: characterDoc.level,
      experience: characterDoc.experience,

      stats: characterDoc.stats as BaseStats,
      resistances: characterDoc.resistances as Resistances,
      combatStats: combatStatsRounded,

      equipment: characterDoc.equipment,
      inventory: characterDoc.inventory,

      createdAt: characterDoc.createdAt as Date,
      updatedAt: characterDoc.updatedAt as Date,

      availablePoints,
      stamina: staminaSnap,
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error("getMyCharacter error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export default getMyCharacter;

// src/controllers/character.controller.ts
import { RequestHandler } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeAvailablePoints } from "../services/allocation.service";
import type { BaseStats, CombatStats, Resistances } from "../interfaces/character/CharacterClass.interface";
import { roundCombatStatsForResponse } from "../utils/characterFormat";

const DBG = process.env.DEBUG_ALLOCATION === "1";

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
  stats: BaseStats;
  resistances: Resistances;
  combatStats: CombatStats;
  equipment: Record<string, string | null>;
  inventory: string[];
  passivesUnlocked: string[];
  createdAt: Date;
  updatedAt: Date;
  availablePoints?: number;
};

/** helpers */
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

/** Normaliza a BaseStats */
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
  };
}

/** GET /character/me */
export const getMyCharacter: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    // ⬇️ Traigo también el username del User
    const characterDoc = await Character.findOne({ userId }).populate({ path: "userId", select: "username" }).exec();
    if (!characterDoc) return res.status(404).json({ message: "Personaje no encontrado" });

    const baseClassDoc = await CharacterClass.findById(characterDoc.classId).select("name iconName imageMainClassUrl passiveDefault subclasses baseStats");
    if (!baseClassDoc) return res.status(404).json({ message: "Clase base no encontrada" });

    const ch = characterDoc.toObject();
    const baseClassRaw = baseClassDoc.toObject();

    const baseClass: ClassMetaDTO = mapClassMeta(baseClassRaw);

    const subclassIdStr = ch.subclassId ? String(ch.subclassId) : null;
    const selectedSubclass = subclassIdStr && Array.isArray(baseClass.subclasses) ? baseClass.subclasses.find((s) => s.id === subclassIdStr) ?? null : null;

    const statsBS: BaseStats = coerceBaseStats(ch.stats);
    const baseBS: BaseStats = coerceBaseStats(baseClassRaw.baseStats);

    const availablePoints = computeAvailablePoints(Number(ch.level ?? 1), statsBS, baseBS);
    if (DBG) console.log("[/character/me] availablePoints:", availablePoints);

    const combatStatsRounded = roundCombatStatsForResponse(ch.combatStats || ({} as any));

    // ⬇️ username desde el populate (o desde req.user), sin tocar el modelo de Character
    const usernameFromPopulate = (characterDoc as any)?.userId?.username ?? (req.user as any)?.username ?? "—";

    const payload: CharacterResponseDTO = {
      id: String(characterDoc._id),
      userId: ch.userId,
      username: usernameFromPopulate,
      class: baseClass,
      selectedSubclass,
      level: ch.level,
      experience: ch.experience,
      stats: ch.stats as BaseStats,
      resistances: ch.resistances as Resistances,
      combatStats: combatStatsRounded,
      equipment: ch.equipment,
      inventory: ch.inventory,
      passivesUnlocked: ch.passivesUnlocked,
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt,
      availablePoints,
    };

    return res.json(payload);
  } catch (err) {
    console.error("getMyCharacter error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

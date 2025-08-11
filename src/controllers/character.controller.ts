import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";

interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string }; // 👈 agrega username aquí
}

/** ───────── DTOs del payload de respuesta ───────── */
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
  username: string; // 👈 NUEVO
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
};

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

export const getMyCharacter = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const characterDoc = await Character.findOne({ userId });
    if (!characterDoc) return res.status(404).json({ message: "Personaje no encontrado" });

    const ch = characterDoc.toObject();

    const baseClassDoc = await CharacterClass.findById(ch.classId).select("name iconName imageMainClassUrl passiveDefault subclasses");
    if (!baseClassDoc) return res.status(404).json({ message: "Clase base no encontrada" });

    const baseClass = mapClassMeta(baseClassDoc.toObject());

    const subclassIdStr = ch.subclassId ? ch.subclassId.toString() : null;
    const selectedSubclass = subclassIdStr && Array.isArray(baseClass.subclasses) ? baseClass.subclasses.find((s) => s.id === subclassIdStr) ?? null : null;

    const payload: CharacterResponseDTO = {
      id: ch.id,
      userId: ch.userId,
      username: req.user!.username, // 👈 aquí lo enviamos
      class: baseClass,
      selectedSubclass,
      level: ch.level,
      experience: ch.experience,
      stats: ch.stats,
      resistances: ch.resistances,
      combatStats: ch.combatStats,
      equipment: ch.equipment,
      inventory: ch.inventory,
      passivesUnlocked: ch.passivesUnlocked,
      createdAt: ch.createdAt,
      updatedAt: ch.updatedAt,
    };

    return res.json(payload);
  } catch (err) {
    console.error("getMyCharacter error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

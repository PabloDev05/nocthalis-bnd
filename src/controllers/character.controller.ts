import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

type Passive = {
  _id: Types.ObjectId;
  name: string;
  description: string;
  detail?: string;
};

type Subclass = {
  _id: Types.ObjectId;
  name: string;
  iconName: string;
  imageSubclassUrl?: string;
  passiveDefault?: Passive;
  passives: Passive[];
  slug?: string | null;
};

type BaseClass = {
  _id: Types.ObjectId;
  name: string;
  subclasses: Subclass[];
};

type ClassWithOneSubclass = {
  _id: Types.ObjectId;
  subclasses: Subclass[];
};

export const getMyCharacter = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const character = await Character.findOne({ userId }).lean();
    if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

    const baseClass = await CharacterClass.findById(character.classId).lean<BaseClass | null>();
    if (!baseClass) return res.status(404).json({ message: "Clase base no encontrada" });

    let selectedSubclass: Subclass | null = null;
    if (character.subclassId) {
      const cls = await CharacterClass.findById(character.classId, { subclasses: { $elemMatch: { _id: character.subclassId } } }).lean<ClassWithOneSubclass | null>();

      selectedSubclass = cls?.subclasses?.[0] ?? null;
    }

    return res.json({
      ...character,
      class: baseClass,
      selectedSubclass,
    });
  } catch (err) {
    console.error("getMyCharacter error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

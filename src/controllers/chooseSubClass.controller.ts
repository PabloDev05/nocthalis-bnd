import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";

interface AuthReq extends Request {
  user?: { id: string };
  body: { selectedSubclassId: string };
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

type ClassWithOneSubclass = {
  _id: Types.ObjectId;
  subclasses: Subclass[];
};

export const chooseSubclass = async (req: AuthReq, res: Response) => {
  const userId = req.user?.id;
  const { selectedSubclassId } = req.body;

  if (!userId) return res.status(401).json({ message: "No autenticado" });
  if (!selectedSubclassId) return res.status(400).json({ message: "Falta selectedSubclassId" });

  if (!Types.ObjectId.isValid(selectedSubclassId)) {
    return res.status(400).json({ message: "selectedSubclassId inválido" });
  }

  const character = await Character.findOne({ userId });
  if (!character) return res.status(404).json({ message: "Personaje no encontrado" });

  const REQUIRED_LEVEL = 10;
  if (character.level < REQUIRED_LEVEL) {
    return res.status(400).json({ message: `Nivel insuficiente (mínimo ${REQUIRED_LEVEL})` });
  }

  const subclassObjectId = new Types.ObjectId(String(selectedSubclassId));

  const cls = await CharacterClass.findById(character.classId, { subclasses: { $elemMatch: { _id: subclassObjectId } } }).lean<ClassWithOneSubclass | null>();

  if (!cls || !cls.subclasses || cls.subclasses.length === 0) {
    return res.status(404).json({ message: "Subclase inválida para tu clase" });
  }

  const selectedSubclass = cls.subclasses[0];

  character.subclassId = selectedSubclass._id;
  await character.save();

  return res.json({
    message: "Subclase asignada",
    subclassId: character.subclassId,
    selectedSubclass,
  });
};

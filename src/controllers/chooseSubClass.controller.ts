import { RequestHandler } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";

/**
 * POST /character/choose-subclass
 * body: { selectedSubclassId: string }
 */
export const chooseSubclass: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const { selectedSubclassId } = (req.body as { selectedSubclassId?: string }) || {};

  if (!userId) {
    res.status(401).json({ message: "No autenticado" });
    return;
  }
  if (!selectedSubclassId || !Types.ObjectId.isValid(selectedSubclassId)) {
    res.status(400).json({ message: "selectedSubclassId inválido" });
    return;
  }

  const character = await Character.findOne({ userId });
  if (!character) {
    res.status(404).json({ message: "Personaje no encontrado" });
    return;
  }

  // Requisito: nivel mínimo
  const REQUIRED_LEVEL = 10;
  if (character.level < REQUIRED_LEVEL) {
    res.status(400).json({ message: `Nivel insuficiente (mínimo ${REQUIRED_LEVEL})` });
    return;
  }

  const subclassObjectId = new Types.ObjectId(String(selectedSubclassId));

  // Buscar la subclase embebida dentro de la clase del personaje
  const cls = await CharacterClass.findById(character.classId, {
    subclasses: { $elemMatch: { _id: subclassObjectId } },
  }).lean<{ _id: Types.ObjectId; subclasses?: Array<any> } | null>();

  if (!cls?.subclasses?.length) {
    res.status(404).json({ message: "Subclase inválida para tu clase" });
    return;
  }

  const selectedSubclass = cls.subclasses[0];

  character.subclassId = selectedSubclass._id;
  await character.save();

  res.json({
    message: "Subclase asignada",
    subclassId: character.subclassId,
    selectedSubclass,
  });
};

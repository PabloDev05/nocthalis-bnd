import { Request, Response } from "express";
import { CharacterClass } from "../models/CharacterClass";

export const getCharacterClasses = async (_req: Request, res: Response) => {
  try {
    const classes = await CharacterClass.find();
    return res.status(200).json(classes);
  } catch (error) {
    console.error("Error al obtener las clases:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};

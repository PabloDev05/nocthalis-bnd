// src/controllers/getCharacterClasses.controller.ts
import { Request, Response } from "express";
import { CharacterClass } from "../models/CharacterClass";

export const getCharacterClasses = async (_req: Request, res: Response) => {
  try {
    const docs = await CharacterClass.find()
      .select(
        // mantené esta lista alineada con lo que mostrás en el front
        "name description iconName imageMainClassUrl passiveDefault " + "baseStats resistances combatStats subclasses createdAt updatedAt"
      )
      .sort({ name: 1 })
      .lean({ virtuals: true })
      .exec();

    // Aseguramos `id` como string para el front
    const classes = docs.map((c: any) => ({
      id: String(c.id ?? c._id),
      name: c.name,
      description: c.description,
      iconName: c.iconName,
      imageMainClassUrl: c.imageMainClassUrl,
      passiveDefault: c.passiveDefault ?? null,
      baseStats: c.baseStats ?? {},
      resistances: c.resistances ?? {},
      combatStats: c.combatStats ?? {},
      subclasses: c.subclasses ?? [],
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return res.status(200).json(classes);
  } catch (error) {
    console.error("Error al obtener las clases:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};

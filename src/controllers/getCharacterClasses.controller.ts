// src/controllers/getCharacterClasses.controller.ts
import { Request, Response } from "express";
import { CharacterClass } from "../models/CharacterClass";

/**
 * GET /character/classes
 * Devuelve la lista de clases para la UI de selección.
 * - Incluye: primaryWeapons, secondaryWeapons, defaultWeapon, allowedWeapons,
 *   passiveDefaultSkill, ultimateSkill, baseStats, resistances, combatStats, subclasses.
 * - Compat: expone también `passiveDefault` como alias de `passiveDefaultSkill`.
 * - No hace transformaciones: si tus baseStats ya usan `constitution`, se devuelven tal cual.
 */
export const getCharacterClasses = async (_req: Request, res: Response) => {
  try {
    const docs = await CharacterClass.find()
      .select([
        "name",
        "description",
        "iconName",
        "imageMainClassUrl",
        "primaryWeapons",
        "secondaryWeapons",
        "defaultWeapon",
        "allowedWeapons",
        "passiveDefaultSkill",
        "ultimateSkill",
        "baseStats",
        "resistances",
        "combatStats",
        "subclasses",
        "createdAt",
        "updatedAt",
      ].join(" "))
      .sort({ name: 1 })
      .lean({ virtuals: true })
      .exec();

    const classes = docs.map((c: any) => ({
      id: String(c.id ?? c._id),
      name: c.name,
      description: c.description,
      iconName: c.iconName,
      imageMainClassUrl: c.imageMainClassUrl,

      // Armas
      primaryWeapons: Array.isArray(c.primaryWeapons) ? c.primaryWeapons : [],
      secondaryWeapons: Array.isArray(c.secondaryWeapons) ? c.secondaryWeapons : [],
      defaultWeapon: c.defaultWeapon ?? null,
      allowedWeapons: Array.isArray(c.allowedWeapons) ? c.allowedWeapons : [],

      // Skills
      passiveDefaultSkill: c.passiveDefaultSkill ?? null,
      ultimateSkill: c.ultimateSkill ?? null,

      // Compat backward
      passiveDefault: c.passiveDefaultSkill ?? null,

      // Bloques base (se devuelven tal cual estén en la clase)
      baseStats: c.baseStats ?? {},
      resistances: c.resistances ?? {},
      combatStats: c.combatStats ?? {},

      // Subclases
      subclasses: Array.isArray(c.subclasses) ? c.subclasses : [],

      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return res.status(200).json(classes);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error al obtener las clases:", error);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};

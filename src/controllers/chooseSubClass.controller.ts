// src/controllers/chooseSubClass.controller.ts
import { RequestHandler } from "express";
import mongoose, { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";

/**
 * POST /character/choose-subclass
 * body:
 *  - { selectedSubclassId: string }         // compat antiguo: _id de la subclase
 *  - { selectedSubclass: string }           // NUEVO: puede ser slug o name (case-insensitive)
 *
 * Mantiene:
 *  - chequeo de nivel mínimo (REQUIRED_LEVEL)
 *  - mismo estilo de respuesta
 *  - NO bloquea si ya tenía subclase (igual que tu versión previa)
 *
 * Ajustes:
 *  - si llega slug/name también funciona (no sólo ObjectId)
 *  - validación y búsqueda robusta dentro de la clase del personaje
 */
export const chooseSubclass: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const { selectedSubclassId, selectedSubclass } = (req.body as { selectedSubclassId?: string; selectedSubclass?: string }) || {};

  if (!userId) {
    res.status(401).json({ message: "No autenticado" });
    return;
  }

  // Normalizamos el "needle": priorizamos el campo antiguo si viene
  const needle = (selectedSubclassId ?? selectedSubclass ?? "").trim();
  if (!needle) {
    res.status(400).json({ message: "Falta selectedSubclassId o selectedSubclass" });
    return;
  }

  // Personaje del usuario
  const character = await Character.findOne({ userId });
  if (!character) {
    res.status(404).json({ message: "Personaje no encontrado" });
    return;
  }

  // Requisito de nivel (igual que antes)
  const REQUIRED_LEVEL = 10;
  if (character.level < REQUIRED_LEVEL) {
    res.status(400).json({ message: `Nivel insuficiente (mínimo ${REQUIRED_LEVEL})` });
    return;
  }

  // Traemos la clase base con sus subclases
  const clazz = await CharacterClass.findById(character.classId).select("name subclasses").lean<{ _id: Types.ObjectId; name: string; subclasses?: any[] } | null>();

  if (!clazz || !Array.isArray(clazz.subclasses) || !clazz.subclasses.length) {
    res.status(404).json({ message: "Clase base o subclases no disponibles" });
    return;
  }

  const isObjId = Types.ObjectId.isValid(needle);
  const needleLC = needle.toLowerCase();

  // Buscamos dentro de las subclases de ESA clase (no global)
  const match = clazz.subclasses.find((s: any) => {
    // por _id exacto
    if (isObjId && String(s._id) === String(needle)) return true;
    // por slug (case-insensitive)
    if (typeof s.slug === "string" && s.slug.toLowerCase() === needleLC) return true;
    // por name (case-insensitive)
    if (typeof s.name === "string" && s.name.toLowerCase() === needleLC) return true;
    return false;
  });

  if (!match) {
    res.status(404).json({ message: "Subclase inválida para tu clase" });
    return;
  }

  // Guardamos (igual que antes; no bloquea si ya tenía)
  character.subclassId = match._id;
  await character.save();

  res.json({
    message: "Subclase asignada",
    subclassId: character.subclassId,
    selectedSubclass: {
      id: String(match._id),
      name: match.name,
      slug: match.slug ?? null,
      iconName: match.iconName ?? null,
      imageSubclassUrl: match.imageSubclassUrl ?? null,
    },
  });
};

export default chooseSubclass;

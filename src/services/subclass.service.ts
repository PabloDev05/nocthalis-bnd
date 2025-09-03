// src/services/subclass.service.ts
import { Types } from "mongoose";
import { CharacterClass } from "../models/CharacterClass";

/** Passive mínima embebida en una Subclass */
export type SubclassPassive = {
  _id?: Types.ObjectId;
  name: string;
  description: string;
  detail?: string;
};

/** Estructura de una subclase embebida en CharacterClass (lean) */
export type SubclassLean = {
  _id: Types.ObjectId;
  name: string;
  iconName: string;
  imageSubclassUrl?: string;
  slug?: string | null;
  passives?: SubclassPassive[];
};

/** Resumen minimal para UI */
export type SubclassSummary = {
  id: string;
  name: string;
  iconName: string;
  imageSubclassUrl: string;
  slug: string | null;
};

/**
 * Devuelve SOLO la subclase pedida por _id (si existe) usando $elemMatch.
 * - Si los IDs no son válidos, retorna null (evita querys innecesarias).
 * - No trae toda la clase, solo la subclase que matchea → más eficiente.
 */
export async function getSubclassById(classId: string, subclassId: string): Promise<SubclassLean | null> {
  if (!Types.ObjectId.isValid(classId) || !Types.ObjectId.isValid(subclassId)) {
    return null;
  }
  const cId = new Types.ObjectId(classId);
  const sId = new Types.ObjectId(subclassId);

  const doc = await CharacterClass.findOne({ _id: cId, "subclasses._id": sId }, { subclasses: { $elemMatch: { _id: sId } } })
    .lean<{ _id: Types.ObjectId; subclasses?: SubclassLean[] }>()
    .exec();

  return doc?.subclasses?.[0] ?? null;
}

/**
 * Búsqueda alternativa por slug (útil para rutas amigables).
 * - Retorna la primera subclase que matchee el slug exacto dentro de la clase dada.
 */
export async function getSubclassBySlug(classId: string, slug: string): Promise<SubclassLean | null> {
  if (!Types.ObjectId.isValid(classId) || !slug) return null;

  const cId = new Types.ObjectId(classId);
  const doc = await CharacterClass.findOne({ _id: cId, "subclasses.slug": slug }, { subclasses: { $elemMatch: { slug } } })
    .lean<{ _id: Types.ObjectId; subclasses?: SubclassLean[] }>()
    .exec();

  return doc?.subclasses?.[0] ?? null;
}

/**
 * Devuelve un resumen listo para UI a partir de una subclase (por id).
 */
export async function getSubclassSummary(classId: string, subclassId: string): Promise<SubclassSummary | null> {
  const sub = await getSubclassById(classId, subclassId);
  if (!sub) return null;

  return {
    id: String(sub._id),
    name: sub.name,
    iconName: sub.iconName,
    imageSubclassUrl: sub.imageSubclassUrl ?? "",
    slug: sub.slug ?? null,
  };
}

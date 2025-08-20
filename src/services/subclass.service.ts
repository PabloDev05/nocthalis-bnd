// src/services/subclass.service.ts
import { Types } from "mongoose";
import { CharacterClass } from "../models/CharacterClass";

/** Estructura de una subclase embebida en CharacterClass */
export type SubclassLean = {
  _id: Types.ObjectId;
  name: string;
  iconName: string;
  imageSubclassUrl?: string;
  slug?: string | null;
  passiveDefault?: {
    _id?: Types.ObjectId;
    name: string;
    description: string;
    detail?: string;
  };
  passives?: Array<{
    _id?: Types.ObjectId;
    name: string;
    description: string;
    detail?: string;
  }>;
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
 * Devuelve SOLO la subclase pedida (si existe) usando $elemMatch.
 * - Si los IDs no son válidos, retorna null (evita querys innecesarias).
 * - No trae toda la clase, solo la subclase que matchea → más eficiente.
 */
export async function getSubclassById(classId: string, subclassId: string): Promise<SubclassLean | null> {
  // chicos: validamos IDs antes de pegarle a la DB
  if (!Types.ObjectId.isValid(classId) || !Types.ObjectId.isValid(subclassId)) {
    return null;
  }
  const cId = new Types.ObjectId(classId);
  const sId = new Types.ObjectId(subclassId);

  // chicos: $elemMatch para traer una sola subclase
  const doc = await CharacterClass.findOne({ _id: cId, "subclasses._id": sId }, { subclasses: { $elemMatch: { _id: sId } } })
    .lean<{ _id: Types.ObjectId; subclasses?: SubclassLean[] }>()
    .exec();

  return doc?.subclasses?.[0] ?? null;
}

/**
 * Devuelve un resumen listo para UI.
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

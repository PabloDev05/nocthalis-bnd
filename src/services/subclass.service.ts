// src/services/subclass.service.ts
import { Types } from "mongoose";
import { CharacterClass } from "../models/CharacterClass";

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

/**
 * Devuelve la subclase embebida si existe dentro de la clase.
 */
export async function getSubclassById(classId: string, subclassId: string) {
  const cls = await CharacterClass.findById(classId).lean<{
    _id: Types.ObjectId;
    name: string;
    subclasses?: SubclassLean[];
  }>();
  if (!cls?.subclasses?.length) return null;

  const sub = cls.subclasses.find((s) => String(s._id) === String(subclassId));
  return sub ?? null;
}

/**
 * Un resumen listo para UI (opcional).
 */
export async function getSubclassSummary(classId: string, subclassId: string) {
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

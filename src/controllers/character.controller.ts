/* eslint-disable no-console */
import { RequestHandler } from "express";
import mongoose from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeAvailablePoints } from "../services/allocation.service";
import { getStaminaByUserId } from "../services/stamina.service";

const UI_DAMAGE_SPREAD_PCT = 25;

const toId = (x: any) => (x?._id ?? x?.id)?.toString() || "";
const toInt = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
};

type SubclassDTO = {
  id: string;
  name: string;
  iconName: string;
  imageSubclassUrl?: string;
  slug?: string | null;
};
type ClassMetaDTO = {
  id: string;
  name: string;
  description?: string;
  iconName: string;
  imageMainClassUrl: string;
  primaryWeapons: string[];
  secondaryWeapons: string[];
  defaultWeapon: string;
  allowedWeapons: string[];
  passiveDefaultSkill: any | null;
  passiveDefault?: any | null;
  ultimateSkill: any | null;
  subclasses: SubclassDTO[];
};
type CharacterResponseDTO = {
  id: string;
  userId: string;
  username: string;
  class: ClassMetaDTO;
  selectedSubclass: SubclassDTO | null;
  level: number;
  experience: number;
  stats: any;
  resistances: any;
  combatStats: any;
  primaryPowerKey: "attackPower" | "magicPower";
  primaryPower: number;
  uiDamageMin: number;
  uiDamageMax: number;
  equipment: Record<string, string | null>;
  inventory: string[];
  createdAt: Date;
  updatedAt: Date;
  availablePoints?: number;
  stamina: {
    stamina: number;
    staminaMax: number;
    usedRate: number;
    updatedAt: string;
    etaFullAt: string | null;
  };
};

const mapSubclass = (s: any): SubclassDTO => ({
  id: toId(s),
  name: String(s?.name ?? ""),
  iconName: String(s?.iconName ?? ""),
  imageSubclassUrl: s?.imageSubclassUrl,
  slug: s?.slug ?? null,
});
const mapClassMeta = (raw: any): ClassMetaDTO => ({
  id: toId(raw),
  name: String(raw?.name ?? ""),
  description: String(raw?.description ?? ""),
  iconName: String(raw?.iconName ?? ""),
  imageMainClassUrl: String(raw?.imageMainClassUrl ?? ""),
  primaryWeapons: Array.isArray(raw?.primaryWeapons) ? raw.primaryWeapons : [],
  secondaryWeapons: Array.isArray(raw?.secondaryWeapons) ? raw.secondaryWeapons : [],
  defaultWeapon: String(raw?.defaultWeapon ?? ""),
  allowedWeapons: Array.isArray(raw?.allowedWeapons) ? raw.allowedWeapons : [],
  passiveDefaultSkill: raw?.passiveDefaultSkill ?? null,
  passiveDefault: raw?.passiveDefault ?? raw?.passiveDefaultSkill ?? null,
  ultimateSkill: raw?.ultimateSkill ?? null,
  subclasses: Array.isArray(raw?.subclasses) ? raw.subclasses.map(mapSubclass) : [],
});

function isMagicClassName(name?: string | null) {
  const n = (name ?? "").toLowerCase();
  return /necromancer|exorcist|mage|wizard|sorcer/.test(n);
}
function resolvePrimaryPower(classMeta: ClassMetaDTO, cs: any) {
  const ap = toInt(cs?.attackPower, 0);
  const mp = toInt(cs?.magicPower, 0);
  if (isMagicClassName(classMeta?.name)) return { key: "magicPower" as const, value: mp };
  return mp > ap ? { key: "magicPower" as const, value: mp } : { key: "attackPower" as const, value: ap };
}
function computeUiDamageRange(primary: number) {
  const p = Math.max(0, toInt(primary, 0));
  const min = Math.max(1, Math.floor((p * (100 - UI_DAMAGE_SPREAD_PCT)) / 100));
  const max = Math.max(min, Math.ceil((p * (100 + UI_DAMAGE_SPREAD_PCT)) / 100));
  return { min, max };
}

export const getMyCharacter: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return res.status(401).json({ message: "No autenticado" });

    const characterDoc = await Character.findOne({ userId })
      .populate({ path: "userId", select: "username" }) // _id viene por defecto
      .lean();

    if (!characterDoc) return res.status(404).json({ message: "Personaje no encontrado" });

    const baseClassDoc = await CharacterClass.findById(characterDoc.classId)
      .select("name description iconName imageMainClassUrl primaryWeapons secondaryWeapons defaultWeapon allowedWeapons passiveDefaultSkill passiveDefault ultimateSkill subclasses baseStats")
      .lean();

    if (!baseClassDoc) return res.status(404).json({ message: "Clase base no encontrada" });

    const classMeta = mapClassMeta(baseClassDoc);
    const subclassIdStr = characterDoc.subclassId ? String(characterDoc.subclassId) : null;
    const selectedSubclass = subclassIdStr && Array.isArray(classMeta.subclasses) ? classMeta.subclasses.find((s) => s.id === subclassIdStr) ?? null : null;

    // ⚠️ SIN “seed” ni normalización destructiva
    const statsNow = (characterDoc as any).stats || {};
    const baseStats = (baseClassDoc as any).baseStats || {};
    const availablePoints = computeAvailablePoints(toInt(characterDoc.level, 1), statsNow, baseStats);

    const combat = (characterDoc as any).combatStats || {};
    const usernameFromPopulate = (characterDoc as any)?.userId?.username ?? (req.user as any)?.username ?? "—";

    const staminaSnap = await getStaminaByUserId(userId);
    const { key: primaryPowerKey, value: primaryPower } = resolvePrimaryPower(classMeta, combat);
    const { min: uiDamageMin, max: uiDamageMax } = computeUiDamageRange(primaryPower);

    const payload: CharacterResponseDTO = {
      id: String(characterDoc._id),
      userId: toId((characterDoc as any).userId), // ⭐ asegurar string del _id incluso cuando userId está populado
      username: usernameFromPopulate,
      class: classMeta,
      selectedSubclass,
      level: toInt(characterDoc.level, 1),
      experience: toInt(characterDoc.experience, 0),
      stats: statsNow, // ← se devuelve tal cual DB
      resistances: (characterDoc as any).resistances,
      combatStats: combat, // ← tal cual DB
      primaryPowerKey,
      primaryPower,
      uiDamageMin,
      uiDamageMax,
      equipment: (characterDoc as any).equipment,
      inventory: (characterDoc as any).inventory,
      createdAt: characterDoc.createdAt as Date,
      updatedAt: characterDoc.updatedAt as Date,
      availablePoints: Number(availablePoints ?? 0),
      stamina: staminaSnap,
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error("getMyCharacter error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

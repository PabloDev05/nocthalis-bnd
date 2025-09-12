/* eslint-disable no-console */
import { RequestHandler } from "express";
import mongoose from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeAvailablePoints } from "../services/allocation.service";
import { getStaminaByUserId } from "../services/stamina.service";
import type { BaseStats, CombatStats, Resistances } from "../interfaces/character/CharacterClass.interface";
import { roundCombatStatsForResponse } from "../utils/characterFormat";

const DBG = process.env.DEBUG_ALLOCATION === "1";

/** Parámetro visual para el rango de daño mostrado en UI */
const UI_DAMAGE_SPREAD = 0.2; // ±20%

/** DTOs minimalistas y alineados al diseño nuevo */
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
  description?: string; // ✅ añadido para UI
  iconName: string;
  imageMainClassUrl: string;

  // info de armas para la UI (bono 10% si es primaria, lo aplica el motor)
  primaryWeapons: string[];
  secondaryWeapons: string[];
  defaultWeapon: string;
  allowedWeapons: string[];

  passiveDefaultSkill: any | null;
  passiveDefault?: any | null; // ✅ alias opcional por compatibilidad
  ultimateSkill: any | null;

  subclasses: SubclassDTO[];
};

type CharacterResponseDTO = {
  id: string;
  userId: string; // ✅ el frontend lo espera como string
  username: string;

  class: ClassMetaDTO;
  selectedSubclass: SubclassDTO | null;

  level: number;
  experience: number;

  stats: BaseStats; // incluye fate
  resistances: Resistances;
  combatStats: CombatStats; // ya redondeado para UI

  /** Campos de apoyo para UI */
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

/** helpers */
const toId = (x: any) => (x?._id ?? x?.id)?.toString() || "";

const mapSubclass = (s: any): SubclassDTO => ({
  id: toId(s),
  name: String(s.name ?? ""),
  iconName: String(s.iconName ?? ""),
  imageSubclassUrl: s.imageSubclassUrl,
  slug: s.slug ?? null,
});

const mapClassMeta = (raw: any): ClassMetaDTO => ({
  id: toId(raw),
  name: String(raw.name ?? ""),
  description: String(raw.description ?? ""),
  iconName: String(raw.iconName ?? ""),
  imageMainClassUrl: String(raw.imageMainClassUrl ?? ""),

  primaryWeapons: Array.isArray(raw.primaryWeapons) ? raw.primaryWeapons : [],
  secondaryWeapons: Array.isArray(raw.secondaryWeapons) ? raw.secondaryWeapons : [],
  defaultWeapon: String(raw.defaultWeapon ?? ""),
  allowedWeapons: Array.isArray(raw.allowedWeapons) ? raw.allowedWeapons : [],

  passiveDefaultSkill: raw.passiveDefaultSkill ?? null,
  passiveDefault: raw.passiveDefault ?? raw.passiveDefaultSkill ?? null, // ✅ alias
  ultimateSkill: raw.ultimateSkill ?? null,

  subclasses: Array.isArray(raw.subclasses) ? raw.subclasses.map(mapSubclass) : [],
});

/** Normaliza a BaseStats (incluye fate) */
function coerceBaseStats(src: any): BaseStats {
  return {
    strength: Number(src?.strength ?? 0),
    dexterity: Number(src?.dexterity ?? 0),
    intelligence: Number(src?.intelligence ?? 0),
    vitality: Number(src?.vitality ?? 0),
    physicalDefense: Number(src?.physicalDefense ?? 0),
    magicalDefense: Number(src?.magicalDefense ?? 0),
    luck: Number(src?.luck ?? 0),
    endurance: Number(src?.endurance ?? 0),
    fate: Number(src?.fate ?? 0),
  };
}

/** Detecta si la clase es de corte mágico por nombre (fallback) */
function isMagicClassName(name: string | undefined | null) {
  const n = (name ?? "").toLowerCase();
  return /necromancer|exorcist|mage|wizard|sorcer/.test(n);
}

/** Resuelve clave de poder primario y valor a partir de combatStats y clase */
function resolvePrimaryPower(classMeta: ClassMetaDTO, cs: Partial<CombatStats> | null | undefined): { key: "attackPower" | "magicPower"; value: number } {
  const ap = Math.round(Number(cs?.attackPower ?? 0));
  const mp = Math.round(Number(cs?.magicPower ?? 0));

  if (isMagicClassName(classMeta?.name)) {
    return { key: "magicPower", value: mp };
  }
  // Si la clase no es claramente mágica, tomar el mayor
  if (mp > ap) return { key: "magicPower", value: mp };
  return { key: "attackPower", value: ap };
}

/** Calcula rango visual de daño en enteros (UI only) */
function computeUiDamageRange(primary: number): { min: number; max: number } {
  const p = Math.max(0, Math.round(Number(primary)));
  const min = Math.max(1, Math.floor(p * (1 - UI_DAMAGE_SPREAD)));
  const max = Math.max(min, Math.ceil(p * (1 + UI_DAMAGE_SPREAD)));
  return { min, max };
}

/** GET /character/me */
export const getMyCharacter: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "No autenticado" });
    }

    // Personaje + username del User
    const characterDoc = await Character.findOne({ userId }).populate({ path: "userId", select: "username" }).lean();

    if (!characterDoc) {
      return res.status(404).json({ message: "Personaje no encontrado" });
    }

    // Clase con metadatos nuevos
    const baseClassDoc = await CharacterClass.findById(characterDoc.classId)
      .select(
        [
          "name",
          "description",
          "iconName",
          "imageMainClassUrl",
          "primaryWeapons",
          "secondaryWeapons",
          "defaultWeapon",
          "allowedWeapons",
          "passiveDefaultSkill",
          "passiveDefault",
          "ultimateSkill",
          "subclasses",
          "baseStats",
        ].join(" ")
      )
      .lean();

    if (!baseClassDoc) {
      return res.status(404).json({ message: "Clase base no encontrada" });
    }

    const classMeta = mapClassMeta(baseClassDoc);

    // Subclase seleccionada (si existe)
    const subclassIdStr = characterDoc.subclassId ? String(characterDoc.subclassId) : null;
    const selectedSubclass = subclassIdStr && Array.isArray(classMeta.subclasses) ? classMeta.subclasses.find((s) => s.id === subclassIdStr) ?? null : null;

    // Puntos disponibles respecto a base de la clase (ahora con fate)
    const statsBS: BaseStats = coerceBaseStats(characterDoc.stats);
    const baseBS: BaseStats = coerceBaseStats(baseClassDoc.baseStats);
    const availablePoints = computeAvailablePoints(Number(characterDoc.level ?? 1), statsBS, baseBS);
    if (DBG) console.log("[/character/me] availablePoints:", availablePoints);

    // Combat stats “bonitos” para UI
    const combatStatsRounded = roundCombatStatsForResponse((characterDoc.combatStats as CombatStats) || ({} as any));

    // username desde el populate (o desde req.user)
    const usernameFromPopulate = (characterDoc as any)?.userId?.username ?? (req.user as any)?.username ?? "—";

    // Stamina (lazy regen)
    const staminaSnap = await getStaminaByUserId(userId);

    // Poder primario y rango de daño para UI (enteros)
    const { key: primaryPowerKey, value: primaryPower } = resolvePrimaryPower(classMeta, combatStatsRounded);
    const { min: uiDamageMin, max: uiDamageMax } = computeUiDamageRange(primaryPower);

    const payload: CharacterResponseDTO = {
      id: String(characterDoc._id),
      userId: String(characterDoc.userId), // ✅ como string
      username: usernameFromPopulate,

      class: classMeta,
      selectedSubclass,

      level: Number(characterDoc.level ?? 1),
      experience: Number(characterDoc.experience ?? 0),

      stats: characterDoc.stats as BaseStats,
      resistances: characterDoc.resistances as Resistances,
      combatStats: combatStatsRounded,

      primaryPowerKey,
      primaryPower,
      uiDamageMin,
      uiDamageMax,

      equipment: characterDoc.equipment,
      inventory: characterDoc.inventory,

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

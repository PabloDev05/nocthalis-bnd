// src/controllers/character.controller.ts
/* eslint-disable no-console */
import { RequestHandler } from "express";
import mongoose from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { computeAvailablePoints } from "../services/allocation.service";
import { getStaminaByUserId } from "../services/stamina.service";
import type {
  BaseStats,
  CombatStats,
  Resistances,
} from "../interfaces/character/CharacterClass.interface";

const DBG = process.env.DEBUG_ALLOCATION === "1";
const UI_DAMAGE_SPREAD_PCT = 25;  // ±25% (antes 0.25 = ±25%)

/* ───────── tipos DTO locales (solo lo que enviamos) ───────── */

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
  stats: BaseStats;          // ← canonical, solo constitution
  resistances: Resistances;
  combatStats: CombatStats;
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

/* ───────── helpers ───────── */

const toId = (x: any) => (x?._id ?? x?.id)?.toString() || "";

const toInt = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
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

/** Canoniza BaseStats con SOLO constitution. */
function coerceBaseStats(src: any): BaseStats {
  return {
    strength: toInt(src?.strength, 0),
    dexterity: toInt(src?.dexterity, 0),
    intelligence: toInt(src?.intelligence, 0),
    constitution: toInt(src?.constitution, 0),
    physicalDefense: toInt(src?.physicalDefense, 0),
    magicalDefense: toInt(src?.magicalDefense, 0),
    luck: toInt(src?.luck, 0),
    endurance: toInt(src?.endurance, 0),
    fate: toInt(src?.fate, 0),
  };
}

function isMagicClassName(name?: string | null) {
  const n = (name ?? "").toLowerCase();
  return /necromancer|exorcist|mage|wizard|sorcer/.test(n);
}

function resolvePrimaryPower(
  classMeta: ClassMetaDTO,
  cs: Partial<CombatStats> | null | undefined
): { key: "attackPower" | "magicPower"; value: number } {
  const ap = toInt(cs?.attackPower, 0);
  const mp = toInt(cs?.magicPower, 0);
  if (isMagicClassName(classMeta?.name)) return { key: "magicPower", value: mp };
  return mp > ap ? { key: "magicPower", value: mp } : { key: "attackPower", value: ap };
}

function computeUiDamageRange(primary: number) {
  const p = Math.max(0, toInt(primary, 0));
  const min = Math.max(1, Math.floor((p * (100 - UI_DAMAGE_SPREAD_PCT)) / 100));
  const max = Math.max(min, Math.ceil((p * (100 + UI_DAMAGE_SPREAD_PCT)) / 100));
  return { min, max };
}

/* ───────── handler ───────── */

export const getMyCharacter: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const characterDoc = await Character.findOne({ userId })
      .populate({ path: "userId", select: "username" })
      .lean();

    if (!characterDoc) {
      return res.status(404).json({ message: "Personaje no encontrado" });
    }

    const baseClassDoc = await CharacterClass.findById(characterDoc.classId)
      .select(
        "name description iconName imageMainClassUrl " +
          "primaryWeapons secondaryWeapons defaultWeapon allowedWeapons " +
          "passiveDefaultSkill passiveDefault ultimateSkill subclasses baseStats"
      )
      .lean();

    if (!baseClassDoc) {
      return res.status(404).json({ message: "Clase base no encontrada" });
    }

    const classMeta = mapClassMeta(baseClassDoc);

    // Subclase seleccionada (si hay)
    const subclassIdStr = characterDoc.subclassId ? String(characterDoc.subclassId) : null;
    const selectedSubclass =
      subclassIdStr && Array.isArray(classMeta.subclasses)
        ? classMeta.subclasses.find((s) => s.id === subclassIdStr) ?? null
        : null;

    // Canonicalizamos stats (SOLO constitution)
    const statsBS = coerceBaseStats(characterDoc.stats);
    const baseBS = coerceBaseStats(baseClassDoc.baseStats);

    const availablePoints = computeAvailablePoints(
      toInt(characterDoc.level, 1),
      statsBS,
      baseBS
    );
    if (DBG) console.log("[/character/me] availablePoints:", availablePoints);

    // Combat: cerrar unidades para respuesta
    const combatStatsRounded = (characterDoc as any).combatStats || {};

    const usernameFromPopulate =
      (characterDoc as any)?.userId?.username ??
      (req.user as any)?.username ??
      "—";

    const staminaSnap = await getStaminaByUserId(userId);

    // Poder primario y daño UI
    const { key: primaryPowerKey, value: primaryPower } = resolvePrimaryPower(
      classMeta,
      combatStatsRounded
    );
    const { min: uiDamageMin, max: uiDamageMax } =
      computeUiDamageRange(primaryPower);

    const payload: CharacterResponseDTO = {
      id: String(characterDoc._id),
      userId: String(characterDoc.userId),
      username: usernameFromPopulate,
      class: classMeta,
      selectedSubclass,
      level: toInt(characterDoc.level, 1),
      experience: toInt(characterDoc.experience, 0),

      // ✅ stats canónicos
      stats: statsBS,
      resistances: (characterDoc as any).resistances as Resistances,

      combatStats: combatStatsRounded,
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

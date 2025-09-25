/* eslint-disable no-console */

import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { Match } from "../models/Match";
import { buildCharacterSnapshot } from "../battleSystem/snapshots/CharacterSnapshot";

// Armas (para calcular min/max del arma con bonus si es primaria)
import {
  ensureWeaponOrDefault,
  isPrimaryWeapon,
  PRIMARY_WEAPON_BONUS_MULT,
  type WeaponData,
} from "../battleSystem/core/Weapon";

// ✅ Stamina (único gasto aquí)
import { spendStamina } from "../services/stamina.service";

const PVP_STAMINA_COST: number = Number.isFinite(Number(process.env.PVP_STAMINA_COST))
  ? Number(process.env.PVP_STAMINA_COST)
  : 10;

const toId = (x: any) => (x?._id ?? x?.id)?.toString() || "";
const asObjectId = (v: any) => {
  const s = String(v ?? "");
  return Types.ObjectId.isValid(s) ? new Types.ObjectId(s) : null;
};

// Sólo lo que necesitamos de la clase
type ClassMetaSnap = {
  name: string;
  passiveDefaultSkill?: any | null;
  ultimateSkill?: any | null;
  primaryWeapons?: string[] | null;
  defaultWeapon?: string | null;
};

/* ----------------------------- helpers ----------------------------- */
const asNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pick = <T = any>(...vals: any[]): T | undefined =>
  vals.find((vv) => vv !== undefined && vv !== null);

const slimSkill = (s: any) =>
  s?.name
    ? {
        name: String(s.name),
        description:
          (s?.description ?? s?.shortDescEn ?? s?.longDescEn ?? undefined) &&
          String(s?.description ?? s?.shortDescEn ?? s?.longDescEn),
      }
    : null;

/** Deducción de arma + bonus por arma primaria. */
function computeWeaponRange(
  rawChar: any,
  classMeta?: { defaultWeapon?: string | null; primaryWeapons?: string[] | null }
) {
  const equip = rawChar?.equipment ?? {};
  const candidates = [
    rawChar?.weapon,
    equip?.weapon,
    equip?.mainWeapon,
    equip?.mainHand,
    equip?.weaponName,
    equip?.weapon?.slug,
    equip?.mainWeapon?.slug,
    equip?.mainHand?.slug,
  ].filter(Boolean);

  let w: WeaponData;
  if (candidates.length) w = ensureWeaponOrDefault(candidates[0]);
  else w = ensureWeaponOrDefault(null, classMeta?.defaultWeapon || undefined);

  const primary = isPrimaryWeapon(w, classMeta?.primaryWeapons || undefined);
  const mult = primary ? PRIMARY_WEAPON_BONUS_MULT : 1;

  return {
    minDamage: Math.floor((w?.minDamage ?? 0) * mult),
    maxDamage: Math.floor((w?.maxDamage ?? 0) * mult),
  };
}

function extractCombatCompact(src: any) {
  const c = src?.combat ?? src?.combatStats ?? src ?? {};
  return {
    maxHP: asNum(pick(c.maxHP, src?.maxHP, 0)),
    attackPower: asNum(c.attackPower),
    blockChance: asNum(pick(c.blockChance, c.block)),
    criticalChance: asNum(pick(c.criticalChance, c.critChance, c.crit)),
    damageReduction: asNum(pick(c.damageReduction, c.dr)),
    // min/max por defecto (pueden ser overrideados con rango de arma)
    minDamage: asNum(pick(c.minDamage, c.damageMin, c.min)),
    maxDamage: asNum(pick(c.maxDamage, c.damageMax, c.max)),
  };
}

function buildSideMeta(rawDoc: any, classMeta: any, snapshot: any) {
  const baseCombat = extractCombatCompact(snapshot || rawDoc?.combatStats || {});
  const range = computeWeaponRange(rawDoc, {
    defaultWeapon: classMeta?.defaultWeapon ?? undefined,
    primaryWeapons: classMeta?.primaryWeapons ?? undefined,
  });

  return {
    userId: toId(rawDoc.userId),
    characterId: toId(rawDoc._id),
    name: rawDoc?.userId?.username ?? rawDoc?.name ?? "—",
    level: Number(rawDoc?.level ?? 1),
    className: classMeta?.name ?? "—",
    avatarUrl: rawDoc?.avatarUrl ?? null,
    passiveDefaultSkill: slimSkill(
      classMeta?.passiveDefaultSkill ?? rawDoc?.passiveDefaultSkill
    ),
    ultimateSkill: slimSkill(
      classMeta?.ultimateSkill ?? rawDoc?.ultimateSkill
    ),
    combatStats: { ...baseCombat, ...range },
  };
}

/* ============================== GET /arena/opponents ============================== */
export async function getArenaOpponentsController(req: Request, res: Response) {
  try {
    const meId = req.user?.id;
    if (!meId) return res.status(401).json({ message: "No autenticado" });

    const size = Math.max(1, Math.min(100, Number(req.query.size ?? 24)));
    const spread = Number.isFinite(Number(req.query.levelSpread))
      ? Number(req.query.levelSpread)
      : null;

    const myChar = await Character.findOne({ userId: asObjectId(meId) })
      .select("level")
      .lean();
    if (!myChar)
      return res
        .status(404)
        .json({ message: "Personaje propio no encontrado" });

    const filter: any = { userId: { $ne: asObjectId(meId) } };
    if (typeof spread === "number") {
      const myLv = Number(myChar.level ?? 1);
      filter.level = { $gte: myLv - spread, $lte: myLv + spread };
    }

    const rivals = await Character.find(filter)
      .sort({ level: -1 })
      .limit(size)
      .select(
        "userId level classId stats resistances combatStats maxHP currentHP equipment avatarUrl name"
      )
      .populate({ path: "userId", select: "username" })
      .lean();

    // Meta mínima de clase
    const classIds = Array.from(
      new Set((rivals ?? []).map((r: any) => toId(r.classId)).filter(Boolean))
    );
    const classMetaById = new Map<string, ClassMetaSnap>();
    if (classIds.length) {
      const classes = await CharacterClass.find({ _id: { $in: classIds } })
        .select("name primaryWeapons defaultWeapon")
        .lean<ClassMetaSnap[]>();
      for (const c of classes as any[]) {
        classMetaById.set(toId((c as any)._id), {
          name: String((c as any).name ?? "—"),
          primaryWeapons: (c as any).primaryWeapons ?? null,
          defaultWeapon: (c as any).defaultWeapon ?? null,
        });
      }
    }

    const opponents = (rivals ?? []).map((r: any) => {
      const combat = r?.combatStats ?? r?.combat ?? {};
      const name = r?.userId?.username ?? r?.username ?? r?.name ?? "—";
      const meta = classMetaById.get(toId(r.classId));
      const className = meta?.name ?? "—";

      const range = computeWeaponRange(r, {
        defaultWeapon: meta?.defaultWeapon ?? undefined,
        primaryWeapons: meta?.primaryWeapons ?? undefined,
      });

      const maxHP = Number(r?.maxHP ?? combat?.maxHP ?? 0);
      const currentHP = Number(r?.currentHP ?? maxHP);

      return {
        id: toId(r.userId ?? r._id),
        userId: toId(r.userId),
        characterId: toId(r._id),
        name,
        level: Number(r?.level ?? 1),
        className,
        clan: r?.clan ?? null,
        honor: r?.honor ?? 0,
        maxHP,
        currentHP,
        stats: r?.stats ?? {},
        combatStats: {
          ...(combat ?? {}),
          ...range, // Damage min/max visible para el front
        },
        avatarUrl: r?.avatarUrl ?? null,
      };
    });

    return res.json({ opponents });
  } catch (err) {
    console.error("[ARENA][GET/opponents] error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ============================== POST /arena/challenges ============================== */
export async function postArenaChallengeController(
  req: Request,
  res: Response
) {
  try {
    const meId = req.user?.id;
    if (!meId) return res.status(401).json({ message: "No autenticado" });

    const opponentId = String((req.body ?? {}).opponentId ?? "");
    if (!opponentId)
      return res.status(400).json({ message: "opponentId requerido" });
    if (opponentId === meId) {
      return res
        .status(400)
        .json({ message: "No podés desafiarte a vos mismo" });
    }

    const meOID = asObjectId(meId);
    const oppOID = asObjectId(opponentId);
    if (!meOID || !oppOID) {
      console.error("[ARENA][POST/challenges] ObjectId inválido", {
        meId,
        opponentId,
      });
      return res.status(400).json({ message: "Ids inválidos" });
    }

    /* ---------- Anti doble click (reutiliza pending reciente sin cobrar) ---------- */
    const reuseWindowMs = 5000;
    const since = new Date(Date.now() - reuseWindowMs);
    const recentPending = await Match.findOne({
      attackerUserId: meOID,
      status: "pending",
      createdAt: { $gte: since },
    }).lean();

    if (recentPending) {
      const [attackerDoc, defenderDoc] = await Promise.all([
        Character.findById(recentPending.attackerCharacterId).populate({
          path: "userId",
          select: "username",
        }),
        Character.findById(recentPending.defenderCharacterId).populate({
          path: "userId",
          select: "username",
        }),
      ]);

      const [attClass, defClass] = await Promise.all([
        attackerDoc?.classId
          ? CharacterClass.findById(attackerDoc.classId)
              .select(
                "name passiveDefaultSkill ultimateSkill primaryWeapons defaultWeapon"
              )
              .lean<ClassMetaSnap>()
          : null,
        defenderDoc?.classId
          ? CharacterClass.findById(defenderDoc.classId)
              .select(
                "name passiveDefaultSkill ultimateSkill primaryWeapons defaultWeapon"
              )
              .lean<ClassMetaSnap>()
          : null,
      ]);

      return res.status(200).json({
        matchId: String(recentPending._id),
        status: recentPending.status,
        seed: (recentPending as any).seed,
        attacker: buildSideMeta(
          attackerDoc?.toObject(),
          attClass,
          (recentPending as any).attackerSnapshot
        ),
        defender: buildSideMeta(
          defenderDoc?.toObject(),
          defClass,
          (recentPending as any).defenderSnapshot
        ),
        reused: true,
      });
    }

    /* ------------------------ ÚNICO gasto de stamina (server) ----------------------- */
    const spend = await spendStamina(String(meOID), PVP_STAMINA_COST);
    if (!spend.ok) {
      if (spend.reason === "insufficient") {
        return res
          .status(400)
          .json({
            message: `Stamina insuficiente. Necesitas ${PVP_STAMINA_COST}.`,
          });
      }
      return res.status(404).json({ message: "Personaje no encontrado" });
    }

    /* ------------------------------- Carga de docs ------------------------------- */
    const [attackerDoc, defenderDoc] = await Promise.all([
      Character.findOne({ userId: meOID }),
      Character.findOne({ userId: oppOID }),
    ]);

    if (!attackerDoc)
      return res.status(404).json({ message: "Tu personaje no existe" });
    if (!defenderDoc)
      return res.status(404).json({ message: "Oponente no encontrado" });

    const [attClass, defClass] = await Promise.all([
      attackerDoc.classId
        ? CharacterClass.findById(attackerDoc.classId)
            .select(
              "name passiveDefaultSkill ultimateSkill primaryWeapons defaultWeapon"
            )
            .lean<ClassMetaSnap>()
        : null,
      defenderDoc.classId
        ? CharacterClass.findById(defenderDoc.classId)
            .select(
              "name passiveDefaultSkill ultimateSkill primaryWeapons defaultWeapon"
            )
            .lean<ClassMetaSnap>()
        : null,
    ]);

    const attackerRaw: any = attackerDoc.toObject();
    const defenderRaw: any = defenderDoc.toObject();

    if (attClass) {
      attackerRaw.class = {
        name: attClass.name,
        passiveDefaultSkill: attClass.passiveDefaultSkill ?? null,
        ultimateSkill: attClass.ultimateSkill ?? null,
        primaryWeapons: attClass.primaryWeapons ?? null,
        defaultWeapon: attClass.defaultWeapon ?? null,
      };
    }
    if (defClass) {
      defenderRaw.class = {
        name: defClass.name,
        passiveDefaultSkill: defClass.passiveDefaultSkill ?? null,
        ultimateSkill: defClass.ultimateSkill ?? null,
        primaryWeapons: defClass.primaryWeapons ?? null,
        defaultWeapon: defClass.defaultWeapon ?? null,
      };
    }

    /* --------------------------- Snapshots y creación --------------------------- */
    const attackerSnapshot = buildCharacterSnapshot(attackerRaw);
    const defenderSnapshot = buildCharacterSnapshot(defenderRaw);

    const seed =
      (Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0xffffffff);

    const match = await Match.create({
      attackerUserId: attackerDoc.userId,
      attackerCharacterId: attackerDoc._id,
      defenderUserId: defenderDoc.userId,
      defenderCharacterId: defenderDoc._id,
      attackerSnapshot,
      defenderSnapshot,
      seed,
      mode: "pvp",
      status: "pending",
      runnerVersion: 2,
    });

    const attacker = buildSideMeta(attackerRaw, attClass, attackerSnapshot);
    const defender = buildSideMeta(defenderRaw, defClass, defenderSnapshot);

    return res.status(201).json({
      matchId: match.id,
      status: match.status,
      seed,
      attacker,
      defender,
    });
  } catch (err: any) {
    console.error("postArenaChallengeController error:", err);
    const message = err?.errors
      ? `Validación: ${Object.keys(err.errors).join(", ")}`
      : err?.message || "Error interno del servidor";
    return res.status(500).json({ message });
  }
}

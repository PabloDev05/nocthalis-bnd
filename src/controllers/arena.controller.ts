/* eslint-disable no-console */

import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { Match } from "../models/Match";
import { buildCharacterSnapshot } from "../battleSystem/snapshots/CharacterSnapshot";

// Stamina
import { spendStamina } from "../services/stamina.service";

const PVP_STAMINA_COST: number = Number.isFinite(Number(process.env.PVP_STAMINA_COST)) ? Number(process.env.PVP_STAMINA_COST) : 10;

/* ───────── helpers ids & números ───────── */
const toId = (x: any): string => (x?._id ?? x?.id)?.toString() || String(x ?? "") || "";

const asObjectId = (v: any): Types.ObjectId | null => {
  const s = String(v ?? "");
  return Types.ObjectId.isValid(s) ? new Types.ObjectId(s) : null;
};

const asNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const pick = <T = any>(...vals: any[]): T | undefined => vals.find((vv) => vv !== undefined && vv !== null);

/* ───────── tipos mínimos de clase ───────── */
type ClassMetaSnap = {
  name: string;
  passiveDefaultSkill?: any | null;
  ultimateSkill?: any | null;
  primaryWeapons?: string[] | null;
  secondaryWeapons?: string[] | null;
  defaultWeapon?: string | null;
};

/* ───────── skills a formato corto ───────── */
const slimSkill = (s: any) =>
  s?.name
    ? {
        name: String(s.name),
        description: (s?.description ?? s?.shortDescEn ?? s?.longDescEn ?? undefined) && String(s?.description ?? s?.shortDescEn ?? s?.longDescEn),
      }
    : null;

/* ───────── lógica compartida con /me ───────── */
const UI_DAMAGE_SPREAD_PCT = 25;

function isMagicClassName(name?: string | null) {
  const n = (name ?? "").toLowerCase();
  return /necromancer|exorcist|mage|wizard|sorcer/.test(n);
}

function resolvePrimaryPower(className: string, cs: any) {
  const ap = asNum(cs?.attackPower);
  const mp = asNum(cs?.magicPower);
  if (isMagicClassName(className)) return { key: "magicPower" as const, value: mp };
  return mp > ap ? ({ key: "magicPower", value: mp } as const) : ({ key: "attackPower", value: ap } as const);
}

function computeUiDamageRange(primary: number) {
  const p = Math.max(0, asNum(primary));
  const min = Math.max(1, Math.floor((p * (100 - UI_DAMAGE_SPREAD_PCT)) / 100));
  const max = Math.max(min, Math.ceil((p * (100 + UI_DAMAGE_SPREAD_PCT)) / 100));
  return { min, max };
}

/* ───────── extracción compacta de stats ───────── */
function extractCombatCompact(src: any) {
  const c = src?.combat ?? src?.combatStats ?? src ?? {};
  const attackPower = asNum(c.attackPower);
  const magicPower = asNum(c.magicPower);
  const attack = asNum(pick(c.attack, magicPower, attackPower));

  return {
    maxHP: asNum(pick(c.maxHP, src?.maxHP, 0)),
    attackPower,
    magicPower,
    attack,
    blockChance: asNum(pick(c.blockChance, c.block)),
    criticalChance: asNum(pick(c.criticalChance, c.critChance, c.crit)),
    evasion: asNum(pick(c.evasion, c.evade, c.evasionChance, c.evadeChance, c.dodge, c.dodgeChance)),
    damageReduction: asNum(pick(c.damageReduction, c.dr)),
    minDamage: asNum(pick(c.minDamage, c.damageMin, c.min)), // será overrideado por UI range
    maxDamage: asNum(pick(c.maxDamage, c.damageMax, c.max)),
  } as any;
}

/* ───────── asegura consistencia de claves primarias ───────── */
function ensurePrimaryKeys(cs: any, className: string) {
  const out: any = { ...(cs || {}) };
  const ap = asNum(out.attackPower);
  const mp = asNum(out.magicPower);

  if (isMagicClassName(className)) {
    if (!mp && ap) out.magicPower = ap;
    out.attack = asNum(out.attack) || asNum(out.magicPower) || asNum(out.attackPower);
  } else {
    if (!ap && mp) out.attackPower = mp;
    out.attack = asNum(out.attack) || asNum(out.attackPower) || asNum(out.magicPower);
  }

  return out;
}

/* ───────── normalizador de snapshots (IDs a ObjectId) ───────── */
function normalizeSnapshotIds(snap: any) {
  const s = { ...(snap || {}) };
  const u = asObjectId(toId(s.userId));
  if (u) s.userId = u;
  const ch = asObjectId(toId(s.characterId));
  if (ch) s.characterId = ch;
  return s;
}

/* ───────── salida compacta para la UI ───────── */
function buildSideMeta(rawDoc: any, classMeta: any, snapshotOrStats: any) {
  const className = classMeta?.name ?? "—";

  // base del personaje (snapshot o combatStats del doc)
  const baseCombat = extractCombatCompact(snapshotOrStats || rawDoc?.combatStats || {});
  const withPrimary = ensurePrimaryKeys(baseCombat, className);

  // cálculo UI del rango (igual a /me)
  const { key: primaryPowerKey, value: primaryPower } = resolvePrimaryPower(className, withPrimary);
  const { min, max } = computeUiDamageRange(primaryPower);

  // replicamos en combatStats para que cualquier consumidor vea lo mismo
  const combatStats: any = {
    ...withPrimary,
    minDamage: min,
    maxDamage: max,
  };

  return {
    userId: toId(rawDoc.userId),
    characterId: toId(rawDoc._id),
    name: rawDoc?.userId?.username ?? rawDoc?.name ?? "—",
    level: Number(rawDoc?.level ?? 1),
    className,
    primaryPowerKey,
    avatarUrl: rawDoc?.avatarUrl ?? null,
    passiveDefaultSkill: slimSkill(classMeta?.passiveDefaultSkill ?? rawDoc?.passiveDefaultSkill),
    ultimateSkill: slimSkill(classMeta?.ultimateSkill ?? rawDoc?.ultimateSkill),
    combatStats,
    uiDamageMin: min,
    uiDamageMax: max,
  };
}

/* ============================== GET /arena/opponents ============================== */
export async function getArenaOpponentsController(req: Request, res: Response) {
  try {
    const meId = req.user?.id;
    if (!meId) return res.status(401).json({ message: "No autenticado" });

    const size = Math.max(1, Math.min(100, Number(req.query.size ?? 24)));
    const spread = Number.isFinite(Number(req.query.levelSpread)) ? Number(req.query.levelSpread) : null;

    const myChar = await Character.findOne({ userId: asObjectId(meId) })
      .select("level")
      .lean();
    if (!myChar) return res.status(404).json({ message: "Personaje propio no encontrado" });

    const filter: any = { userId: { $ne: asObjectId(meId) } };
    if (typeof spread === "number") {
      const myLv = Number(myChar.level ?? 1);
      filter.level = { $gte: myLv - spread, $lte: myLv + spread };
    }

    const rivals = await Character.find(filter)
      .sort({ level: -1 })
      .limit(size)
      .select("userId level classId stats resistances combatStats maxHP currentHP equipment avatarUrl name")
      .populate({ path: "userId", select: "username" })
      .populate({
        path: "classId",
        select: "name primaryWeapons secondaryWeapons defaultWeapon",
      })
      .lean();

    const opponents = (rivals ?? []).map((r: any) => {
      const meta = r?.classId as ClassMetaSnap;
      const side = buildSideMeta(r, meta, r?.combatStats ?? r?.combat ?? {});
      const combat = r?.combatStats ?? r?.combat ?? {};
      const maxHP = Number(r?.maxHP ?? combat?.maxHP ?? 0);
      const currentHP = Number(r?.currentHP ?? maxHP);

      return {
        id: toId(r.userId ?? r._id),
        userId: toId(r.userId),
        characterId: toId(r._id),
        name: r?.userId?.username ?? r?.username ?? r?.name ?? "—",
        level: Number(r?.level ?? 1),
        className: side.className,
        primaryPowerKey: side.primaryPowerKey,
        clan: (r as any)?.clan ?? null,
        honor: (r as any)?.honor ?? 0,
        maxHP,
        currentHP,
        stats: r?.stats ?? {},
        combatStats: side.combatStats,
        avatarUrl: r?.avatarUrl ?? null,
        uiDamageMin: side.uiDamageMin,
        uiDamageMax: side.uiDamageMax,
      };
    });

    return res.json({ opponents });
  } catch (err) {
    console.error("[ARENA][GET/opponents] error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ============================== POST /arena/challenges ============================== */
export async function postArenaChallengeController(req: Request, res: Response) {
  try {
    const meId = req.user?.id;
    if (!meId) return res.status(401).json({ message: "No autenticado" });

    const opponentId = String((req.body ?? {}).opponentId ?? "");
    if (!opponentId) return res.status(400).json({ message: "opponentId requerido" });
    if (opponentId === meId) {
      return res.status(400).json({ message: "No podés desafiarte a vos mismo" });
    }

    const meOID = asObjectId(meId);
    const oppOID = asObjectId(opponentId);
    if (!meOID || !oppOID) {
      return res.status(400).json({ message: "Ids inválidos" });
    }

    // ÚNICO gasto de stamina
    const spend = await spendStamina(String(meOID), PVP_STAMINA_COST);
    if (!spend.ok) {
      if (spend.reason === "insufficient") {
        return res.status(400).json({
          message: `Stamina insuficiente. Necesitas ${PVP_STAMINA_COST}.`,
        });
      }
      return res.status(404).json({ message: "Personaje no encontrado" });
    }

    /* ------------------------------- Carga de docs con populate ------------------------------- */
    const [attackerDoc, defenderDoc] = await Promise.all([
      Character.findOne({ userId: meOID }).populate({ path: "userId", select: "username" }).populate({
        path: "classId",
        select: "name passiveDefaultSkill ultimateSkill primaryWeapons secondaryWeapons defaultWeapon",
      }),
      Character.findOne({ userId: oppOID }).populate({ path: "userId", select: "username" }).populate({
        path: "classId",
        select: "name passiveDefaultSkill ultimateSkill primaryWeapons secondaryWeapons defaultWeapon",
      }),
    ]);

    if (!attackerDoc) return res.status(404).json({ message: "Tu personaje no existe" });
    if (!defenderDoc) return res.status(404).json({ message: "Oponente no encontrado" });

    const attClass = attackerDoc.classId as any as ClassMetaSnap;
    const defClass = defenderDoc.classId as any as ClassMetaSnap;

    const attackerRaw: any = attackerDoc.toObject();
    const defenderRaw: any = defenderDoc.toObject();
    attackerRaw.class = attClass;
    defenderRaw.class = defClass;

    /* --------------------------- Snapshots y normalización --------------------------- */
    const attackerSnapshotRaw = buildCharacterSnapshot(attackerRaw);
    const defenderSnapshotRaw = buildCharacterSnapshot(defenderRaw);

    const attackerSnapshot = normalizeSnapshotIds(attackerSnapshotRaw);
    const defenderSnapshot = normalizeSnapshotIds(defenderSnapshotRaw);

    const seed = (Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0xffffffff);

    /* --------------------------- Crear Match --------------------------- */
    const match = await Match.create({
      attackerUserId: asObjectId(toId(attackerDoc.userId)),
      attackerCharacterId: asObjectId(toId(attackerDoc._id)),
      defenderUserId: asObjectId(toId(defenderDoc.userId)),
      defenderCharacterId: asObjectId(toId(defenderDoc._id)),
      attackerSnapshot,
      defenderSnapshot,
      seed,
      mode: "pvp",
      status: "pending",
      runnerVersion: 2,
    });

    /* --------------------------- Respuesta UI (con UI range) --------------------------- */
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
    const message = err?.errors ? `Validación: ${Object.keys(err.errors).join(", ")}` : err?.message || "Error interno del servidor";
    return res.status(500).json({ message });
  }
}

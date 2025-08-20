import { Request, Response } from "express";
import { Types } from "mongoose";
import { Character } from "../models/Character";
import { CharacterClass } from "../models/CharacterClass";
import { Match } from "../models/Match";
import { buildCharacterSnapshot } from "../battleSystem/core/CharacterSnapshot";

const toId = (x: any) => (x?._id ?? x?.id)?.toString();
const asObjectId = (v: any) => {
  const s = String(v ?? "");
  return Types.ObjectId.isValid(s) ? new Types.ObjectId(s) : null;
};

/* --------------------------------- GET /arena/opponents --------------------------------- */
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
      .select("userId level classId className stats resistances combatStats maxHP currentHP equipment avatarUrl")
      .populate({ path: "userId", select: "username" })
      .lean();

    const classIds = Array.from(new Set((rivals ?? []).map((r: any) => toId(r.classId)).filter(Boolean)));
    let classNameById = new Map<string, string>();
    if (classIds.length) {
      const classes = await CharacterClass.find({ _id: { $in: classIds } })
        .select("name")
        .lean();
      classNameById = new Map(classes.map((c: any) => [toId(c._id), c.name]));
    }

    const opponents = (rivals ?? []).map((r: any) => {
      const combat = r?.combatStats ?? r?.combat ?? {};
      const name = r?.userId?.username ?? r?.username ?? r?.name ?? "—";
      const className = r?.className ?? classNameById.get(toId(r.classId)) ?? "—";
      const maxHP = Number(r?.maxHP ?? combat?.maxHP ?? 0);
      const currentHP = Number(r?.currentHP ?? maxHP);

      return {
        id: toId(r.userId ?? r._id), // el front usa userId rival
        name,
        level: Number(r?.level ?? 1),
        className,
        clan: r?.clan ?? null,
        honor: r?.honor ?? 0,
        maxHP,
        currentHP,
        stats: r?.stats ?? {},
        combatStats: combat ?? {},
        avatarUrl: r?.avatarUrl ?? null,
      };
    });

    return res.json({ opponents });
  } catch (err) {
    console.error("[ARENA][GET/opponents] error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* -------------------------------- POST /arena/challenges -------------------------------- */
export async function postArenaChallengeController(req: Request, res: Response) {
  try {
    const meId = req.user?.id;
    if (!meId) return res.status(401).json({ message: "No autenticado" });

    const opponentId = String((req.body ?? {}).opponentId ?? "");
    if (!opponentId) {
      return res.status(400).json({ message: "opponentId requerido" });
    }

    const meOID = asObjectId(meId);
    const oppOID = asObjectId(opponentId);
    if (!meOID || !oppOID) {
      console.error("[ARENA][POST/challenges] ObjectId inválido", { meId, opponentId });
      return res.status(400).json({ message: "Ids inválidos" });
    }

    const [attackerDoc, defenderDoc] = await Promise.all([Character.findOne({ userId: meOID }), Character.findOne({ userId: oppOID })]);

    if (!attackerDoc) {
      console.error("[ARENA][POST/challenges] attackerDoc no encontrado", { meId });
      return res.status(404).json({ message: "Tu personaje no existe" });
    }
    if (!defenderDoc) {
      console.error("[ARENA][POST/challenges] defenderDoc no encontrado", { opponentId });
      return res.status(404).json({ message: "Oponente no encontrado" });
    }

    const [attClass, defClass] = await Promise.all([
      attackerDoc.classId ? CharacterClass.findById(attackerDoc.classId).select("name passiveDefault") : null,
      defenderDoc.classId ? CharacterClass.findById(defenderDoc.classId).select("name passiveDefault") : null,
    ]);

    const attackerRaw: any = attackerDoc.toObject();
    const defenderRaw: any = defenderDoc.toObject();

    // Inyectamos { class: { name, passiveDefault } } antes del snapshot
    if (attClass) {
      const c = attClass.toObject();
      attackerRaw.class = { name: c.name, passiveDefault: c.passiveDefault };
    }
    if (defClass) {
      const c = defClass.toObject();
      defenderRaw.class = { name: c.name, passiveDefault: c.passiveDefault };
    }

    const attackerSnapshot = buildCharacterSnapshot(attackerRaw);
    const defenderSnapshot = buildCharacterSnapshot(defenderRaw);

    const seed = (Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0xffffffff);

    const match = await Match.create({
      attackerUserId: attackerDoc.userId,
      attackerCharacterId: attackerDoc._id,
      defenderUserId: defenderDoc.userId,
      defenderCharacterId: defenderDoc._id,

      attackerSnapshot,
      defenderSnapshot,
      seed,

      // Campos neutros para compat con tu schema previo
      mode: "pending",
      status: "pending",
      winner: null,
      outcome: null,
      turns: 0,
      timeline: [],
      log: [],
      snapshots: [],
      rewards: null,
    });

    return res.json({ matchId: (match._id as any).toString() });
  } catch (err: any) {
    console.error("postArenaChallengeController error:", err);
    const message = err?.errors ? `Validación: ${Object.keys(err.errors).join(", ")}` : err?.message || "Error interno del servidor";
    return res.status(500).json({ message });
  }
}

// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { CharacterClass } from "../models/CharacterClass";
import { Character } from "../models/Character";
import { User } from "../models/User";

const DBG = process.env.DEBUG_AUTH === "1";

/* ------------------------------ helpers ------------------------------ */

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Selecciona de forma explícita todos los campos que usamos en login. */
const USER_LOGIN_PROJECTION = "password passwordHash classChosen characterClass username email";

/* ------------------------------ REGISTER ----------------------------- */

export const register = async (req: Request, res: Response) => {
  const { username, password, email, characterClass } = req.body;

  if (!username || !password || !email || !characterClass) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  const exists = await User.findOne({ $or: [{ username }, { email }] }).lean();
  if (exists) {
    return res.status(400).json({ message: "Usuario o email ya existe" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET no configurado");
    return res.status(500).json({ message: "Config error" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const clazz = await CharacterClass.findById(characterClass).session(session).lean();
    if (!clazz) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Clase no encontrada" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.create(
      [
        {
          username,
          email,
          // guardamos en "password" (si tu esquema usa "passwordHash", igual lo traemos en login)
          password: passwordHash,
          classChosen: true,
          characterClass: clazz._id,
        },
      ],
      { session }
    ).then((r) => r[0]);

    await Character.create(
      [
        {
          userId: newUser._id,
          classId: clazz._id,
          level: 1,
          experience: 0,
          stats: clazz.baseStats,
          resistances: clazz.resistances,
          combatStats: clazz.combatStats,
          passivesUnlocked: [clazz.passiveDefault?.name].filter(Boolean),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const token = jwt.sign({ id: newUser._id.toString(), username: newUser.username }, secret, { expiresIn: "1h", algorithm: "HS256" });

    return res.status(201).json({
      message: "Usuario registrado correctamente",
      token,
      userId: newUser._id,
      username: newUser.username,
      classChosen: true,
      characterClassId: clazz._id,
      characterClassName: clazz.name,
    });
  } catch (err) {
    if (DBG) console.error("Register error:", err);
    try {
      await session.abortTransaction();
    } catch {}
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    session.endSession();
  }
};

/* -------------------------------- LOGIN ------------------------------ */

export const login = async (req: Request, res: Response) => {
  let { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET no configurado");
    return res.status(500).json({ message: "Config error" });
  }

  username = String(username).trim();
  const isEmail = username.includes("@");

  // 1) intento exacto
  let user =
    (await User.findOne(isEmail ? { email: username } : { username })
      .select(USER_LOGIN_PROJECTION)
      .lean()) || null;

  // 2) fallback case-insensitive si no lo encuentra exacto
  if (!user) {
    const rx = new RegExp(`^${escapeRegex(username)}$`, "i");
    user =
      (await User.findOne(isEmail ? { email: rx } : { username: rx })
        .select(USER_LOGIN_PROJECTION)
        .lean()) || null;
    if (DBG && user) console.log("[LOGIN] match por regex case-insensitive");
  }

  if (!user) {
    if (DBG) console.warn("[LOGIN] user no encontrado:", { isEmail, username });
    return res.status(400).json({ message: "Credenciales inválidas" });
  }

  const hashed = (user as any).password || (user as any).passwordHash;
  if (!hashed || typeof hashed !== "string") {
    if (DBG) console.warn("[LOGIN] usuario sin hash:", { id: user._id });
    return res.status(400).json({ message: "Credenciales inválidas" });
  }

  const ok = await bcrypt.compare(password, String(hashed));
  if (!ok) {
    if (DBG) console.warn("[LOGIN] password no coincide:", { id: user._id });
    return res.status(400).json({ message: "Credenciales inválidas" });
  }

  // opcional: nombre de clase (para UI)
  let className: string | null = null;
  if (user.characterClass) {
    const clazz = await CharacterClass.findById(user.characterClass).select("name").lean();
    className = clazz?.name ?? null;
  }

  const token = jwt.sign({ id: user._id.toString(), username: user.username }, secret, { expiresIn: "1h", algorithm: "HS256" });

  return res.json({
    token,
    userId: user._id,
    username: user.username,
    classChosen: !!user.classChosen,
    characterClassId: user.characterClass ?? null,
    characterClassName: className,
  });
};

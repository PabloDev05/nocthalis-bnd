// src/controllers/auth.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { CharacterClass } from "../models/CharacterClass";
import { Character } from "../models/Character";
import { User } from "../models/User";

const DBG = process.env.DEBUG_AUTH === "1";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Para login: incluimos hash y campos mínimos */
const USER_LOGIN_PROJECTION = "+password +passwordHash email username classChosen characterClass";

export const register = async (req: Request, res: Response) => {
  const { username, email, password, characterClass } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    characterClass?: string;
  };

  if (!username || !email || !password || !characterClass) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET no configurado");
    return res.status(500).json({ message: "Config error" });
  }

  const usernameNorm = String(username).trim();
  const emailNorm = String(email).trim().toLowerCase();

  // Evitar duplicados por carrera (además manejamos E11000)
  const exists = await User.findOne({
    $or: [{ username: usernameNorm }, { email: emailNorm }],
  }).lean();
  if (exists) {
    return res.status(400).json({ message: "El usuario o el email ya están registrados" });
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

    // Crear usuario
    const newUser = await User.create(
      [
        {
          username: usernameNorm,
          email: emailNorm,
          password: passwordHash, // campo actual; mantenemos compat con passwordHash legacy en login
          classChosen: true,
          characterClass: clazz._id,
        },
      ],
      { session }
    ).then((r) => r[0]);

    // Crear personaje base
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

    const token = jwt.sign({ id: newUser._id.toString(), email: emailNorm, username: usernameNorm }, secret, { expiresIn: "1h", algorithm: "HS256" });

    return res.status(201).json({
      message: "Usuario registrado correctamente",
      token,
      user: {
        id: newUser._id.toString(),
        email: emailNorm,
        username: usernameNorm,
      },
      classChosen: true,
      characterClass: clazz._id, // lo que usa tu front
      characterClassId: clazz._id, // alias por si algo viejo lo lee
      characterClassName: clazz.name,
    });
  } catch (err: any) {
    if (DBG) console.error("Register error:", err);
    try {
      await session.abortTransaction();
    } catch {}
    if (err?.code === 11000) {
      return res.status(400).json({ message: "El usuario o el email ya están registrados" });
    }
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    session.endSession();
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET no configurado");
    return res.status(500).json({ message: "Config error" });
  }

  const emailNorm = String(email).trim().toLowerCase();

  // 1) Búsqueda directa por email normalizado
  let user = (await User.findOne({ email: emailNorm }).select(USER_LOGIN_PROJECTION).lean()) || null;

  if (!user) {
    const rx = new RegExp(`^${escapeRegex(emailNorm)}$`, "i");
    user = (await User.findOne({ email: rx }).select(USER_LOGIN_PROJECTION).lean()) || null;
    if (DBG && user) console.log("[LOGIN] match por regex (case-insensitive)");
  }

  if (!user) {
    if (DBG) console.warn("[LOGIN] user no encontrado:", { email: emailNorm });
    return res.status(400).json({ message: "Credenciales inválidas" });
  }

  // Compat: aceptamos `password` (actual) o `passwordHash` (legacy)
  const hashed = (user as any).password || (user as any).passwordHash;
  if (!hashed || typeof hashed !== "string") {
    if (DBG) console.warn("[LOGIN] usuario sin hash:", { id: (user as any)._id });
    return res.status(400).json({ message: "Credenciales inválidas" });
  }

  const ok = await bcrypt.compare(password, String(hashed));
  if (!ok) {
    if (DBG) console.warn("[LOGIN] password no coincide:", { id: (user as any)._id });
    return res.status(400).json({ message: "Credenciales inválidas" });
  }

  // Nombre de clase (para UI)
  let className: string | null = null;
  if ((user as any).characterClass) {
    const clazz = await CharacterClass.findById((user as any).characterClass)
      .select("name")
      .lean();
    className = clazz?.name ?? null;
  }

  const token = jwt.sign(
    {
      id: (user as any)._id.toString(),
      email: (user as any).email,
      username: (user as any).username ?? undefined,
    },
    secret,
    { expiresIn: "1h", algorithm: "HS256" }
  );

  return res.json({
    token,
    user: {
      id: (user as any)._id.toString(),
      email: (user as any).email,
      username: (user as any).username ?? null,
    },
    classChosen: !!(user as any).classChosen,
    characterClass: (user as any).characterClass ?? null, // lo que tu front espera
    characterClassId: (user as any).characterClass ?? null, // alias
    characterClassName: className,
  });
};

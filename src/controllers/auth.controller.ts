// src/controllers/auth.controller.ts
/* eslint-disable no-console */
import { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { CharacterClass } from "../models/CharacterClass";
import { Character } from "../models/Character";
import { User } from "../models/User";

const DBG = process.env.DEBUG_AUTH === "1";

/* ───────────────── helpers ───────────────── */

const i = (v: any, d = 0) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : d;
};
const sanitizeBlock = <T extends Record<string, any>>(obj: T | undefined | null): T => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, i(v, 0)])) as T;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Para login: incluimos hash y campos mínimos */
const USER_LOGIN_PROJECTION = "+password +passwordHash email username classChosen characterClass";

/* ───────────────── REGISTER ───────────────── */

/**
 * POST /auth/register
 * body: { username, email, password, characterClass }
 *
 * Crea User + Character en una transacción.
 * - Character toma stats/resistances/combatStats desde la clase (ya con constitution/fate)
 * - currentHP = combatStats.maxHP
 * - equipment.mainWeapon = defaultWeapon
 * - stamina inicial 100/100
 */
export const register = async (req: Request, res: Response) => {
  const { username, email, password, characterClass } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    characterClass?: string; // _id de CharacterClass
  };

  if (!username || !email || !password || !characterClass) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }
  if (!mongoose.Types.ObjectId.isValid(characterClass)) {
    return res.status(400).json({ message: "characterClass inválido" });
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

    // Hash
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const newUser = await User.create(
      [
        {
          username: usernameNorm,
          email: emailNorm,
          password: passwordHash, // guardamos el hash en el campo actual
          classChosen: true,
          characterClass: clazz._id,
        },
      ],
      { session }
    ).then((r) => r[0]);

    // Bloques base (enteros)
    const stats = sanitizeBlock(clazz.baseStats); // ← con constitution/fate
    const resistances = sanitizeBlock(clazz.resistances);
    const combatStats = sanitizeBlock(clazz.combatStats);

    // Blindaje de maxHP:
    // - Usamos el de la clase si viene válido
    // - Si no, fallback entero coherente con tu regla: 100 + CON*10
    const computedMaxHpFromClass = i((combatStats as any).maxHP, 0);
    const fallbackMaxHP = 100 + i((stats as any).constitution, 0) * 10;
    const maxHP = Math.max(1, computedMaxHpFromClass > 0 ? computedMaxHpFromClass : fallbackMaxHP);

    // Escribimos también en el bloque de combate para mantener consistencia
    (combatStats as any).maxHP = maxHP;

    // Vida inicial = tope del bloque de combate
    const currentHP = maxHP;

    // Equipo inicial: arma por defecto de la clase
    const equipment = {
      helmet: null,
      chest: null,
      gloves: null,
      boots: null,
      mainWeapon: (clazz as any).defaultWeapon ?? null,
      offWeapon: null,
      ring: null,
      belt: null,
      amulet: null,
    } as const;

    // Stamina inicial
    const now = new Date();
    const STAMINA_DEFAULTS = {
      stamina: 100,
      staminaMax: 100,
      staminaRegenPerHour: 10,
    } as const;

    // Crear personaje (solo campos definidos en tu Schema actual)
    await Character.create(
      [
        {
          userId: newUser._id,
          classId: clazz._id,

          // progresión
          level: 1,
          experience: 0,

          // bloques
          stats,
          resistances,
          combatStats,

          // tope y vida actual (campos planos para UI/queries rápidas)
          maxHP,
          currentHP,

          // equipo/inventario
          equipment,
          inventory: [],

          // stamina
          stamina: STAMINA_DEFAULTS.stamina,
          staminaMax: STAMINA_DEFAULTS.staminaMax,
          staminaRegenPerHour: STAMINA_DEFAULTS.staminaRegenPerHour,
          staminaUpdatedAt: now,

          // subclase aún sin seleccionar
          subclassId: null,
        } as any,
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
      characterClass: (clazz as any)._id, // lo que usa tu front
      characterClassId: (clazz as any)._id, // alias por si algo viejo lo lee
      characterClassName: (clazz as any).name, // útil para UI
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

/* ───────────────── LOGIN ───────────────── */

/**
 * POST /auth/login
 * body: { email, password }
 *
 * Mantiene compat con passwordHash legacy y devuelve metadatos de clase.
 */
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

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

  // 2) Fallback case-insensitive por regex
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
    className = (clazz as any)?.name ?? null;
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
    characterClass: (user as any).characterClass ?? null, // id de clase para front
    characterClassId: (user as any).characterClass ?? null, // alias
    characterClassName: className,
  });
};

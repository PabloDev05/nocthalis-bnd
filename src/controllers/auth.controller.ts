// controllers/auth.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import { CharacterClass } from "../models/CharacterClass";
import { Character } from "../models/Character";
import { User } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req: Request, res: Response) => {
  const { username, password, email, characterClass } = req.body; // characterClass debe ser el _id de la clase

  if (!username || !password || !email || !characterClass) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    return res.status(400).json({ message: "Usuario o email ya existe" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const clazz = await CharacterClass.findById(characterClass).session(session);
    if (!clazz) return res.status(404).json({ message: "Clase no encontrada" });

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await User.create(
      [
        {
          username,
          email,
          password: passwordHash,
          classChosen: true,
          characterClass: clazz._id, // guardar ObjectId
        },
      ],
      { session }
    ).then((r) => r[0]);

    // crea el personaje con stats base de la clase
    await Character.create(
      [
        {
          userId: newUser._id,
          classId: clazz._id,
          level: 1,
          experience: 0,
          stats: clazz.baseStats,
          resistances: clazz.resistances,
          combatStats: clazz.combatStats, // opcional, si querés iniciar con estos
          passivesUnlocked: [clazz.passiveDefault?.name].filter(Boolean),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const token = jwt.sign({ userId: newUser._id, username: newUser.username }, process.env.JWT_SECRET!, { expiresIn: "1h" });

    return res.status(201).json({
      message: "Usuario registrado correctamente",
      userId: newUser._id,
      token,
      classChosen: true,
      characterClass: clazz._id,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Register error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: "Faltan campos requeridos" });

  const user = await User.findOne({ username }).lean();
  if (!user) return res.status(400).json({ message: "Credenciales inválidas" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Credenciales inválidas" });

  const token = jwt.sign({ id: user._id.toString(), username: user.username }, process.env.JWT_SECRET!, { expiresIn: "1h" });

  return res.json({
    token,
    userId: user._id,
    classChosen: user.classChosen,
    characterClass: user.characterClass,
  });
};

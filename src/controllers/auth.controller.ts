import { Request, Response } from "express";
import { User } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "mi_pass_secreto";

export const register = async (req: Request, res: Response) => {
  const { username, password, email, characterClass } = req.body;

  if (!username || !password || !email || !characterClass) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    return res.status(400).json({ message: "Usuario o email ya existe" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = new User({
    username,
    email,
    password: passwordHash,
    classChosen: true,
    characterClass,
  });

  await newUser.save();

  // 🔐 Generar token
  const token = jwt.sign({ userId: newUser._id, username: newUser.username }, process.env.JWT_SECRET!, { expiresIn: "1h" });

  // ✅ Respuesta con token incluido
  res.status(201).json({
    message: "Usuario registrado correctamente",
    userId: newUser._id,
    token,
    classChosen: newUser.classChosen,
    characterClass: newUser.characterClass,
  });
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(400).json({ message: "Credenciales inválidas" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Credenciales inválidas" });
  }

  const token = jwt.sign(
    {
      id: user._id,
      username: user.username,
      characterClass: user.characterClass,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );

  res.json({
    token,
    userId: user._id,
    classChosen: user.classChosen,
    characterClass: user.characterClass,
  });
};

import { Request, Response } from "express";
import { User } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "mi_pass_secreto";

const users: { username: string; passwordHash: string; email: string }[] = [];

export const register = async (req: Request, res: Response) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ message: "Faltan campos requeridos" });
  }

  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    return res.status(400).json({ message: "Usuario o email ya existe" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = new User({ username, email, password: passwordHash });

  await newUser.save();

  res.status(201).json({ message: "Usuario registrado correctamente" });
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
    { id: user._id, username: user.username },
    SECRET,
    { expiresIn: "1h" }
  );

  res.json({ token });
};

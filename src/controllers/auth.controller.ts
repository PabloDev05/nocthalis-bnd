import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const users: { username: string; passwordHash: string }[] = [];

const SECRET = process.env.JWT_SECRET || "mi_pass_secreto";

export const register = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const userExists = users.find((u) => u.username === username);
  if (userExists) return res.status(400).json({ message: "Usuario ya existe" });

  const passwordHash = await bcrypt.hash(password, 10);
  users.push({ username, passwordHash });

  res.status(201).json({ message: "Usuario registrado" });
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const user = users.find((u) => u.username === username);
  if (!user) return res.status(400).json({ message: "Credenciales inválidas" });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(400).json({ message: "Credenciales inválidas" });

  const token = jwt.sign({ username }, SECRET, { expiresIn: "1h" });

  res.json({ token });
};

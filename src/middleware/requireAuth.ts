// middleware/requireAuth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtUser {
  id: string;
  username: string;
}
export interface AuthReq extends Request {
  user?: JwtUser;
}

export const requireAuth = (req: AuthReq, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Token requerido" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtUser;
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};

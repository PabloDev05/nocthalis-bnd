// middleware/requireAuth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { User } from "../models/User";

export interface JwtUser {
  id: string;
  username: string;
  iat?: number;
  exp?: number;
}
export interface AuthReq extends Request {
  user?: JwtUser;
}

export const requireAuth = async (req: AuthReq, res: Response, next: NextFunction) => {
  try {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET no configurado");
      return res.status(500).json({ message: "Config error" });
    }

    const payload = jwt.verify(token, secret) as JwtUser;

    // Validaciones extra (cubren reset de BD)
    if (!payload?.id || !Types.ObjectId.isValid(payload.id)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const exists = await User.exists({ _id: payload.id });
    if (!exists) return res.status(401).json({ message: "Unauthorized" });

    req.user = { id: payload.id, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

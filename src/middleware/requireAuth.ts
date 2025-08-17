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

/**
 * Middleware de autenticación + "heartbeat" de presencia.
 * - Valida el JWT (id, firma, expiración).
 * - Verifica que el usuario exista (cubre resets de BD).
 * - Setea req.user para downstream.
 * - Actualiza lastSeen en background para presencia (no bloqueante).
 */
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

    let payload: JwtUser;
    try {
      payload = jwt.verify(token, secret) as JwtUser;
    } catch {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!payload?.id || !Types.ObjectId.isValid(payload.id)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const exists = await User.exists({ _id: payload.id });
    if (!exists) return res.status(401).json({ message: "Unauthorized" });

    // Exponemos en la request
    req.user = { id: payload.id, username: payload.username };

    // 👇 Heartbeat de presencia (actualiza lastSeen sin bloquear el request)
    // Si tu modelo User ya tiene el campo lastSeen con índice, esto permitirá
    // filtrar "online" por ventana de minutos (p.ej., 10 minutos).
    User.updateOne({ _id: payload.id }, { $set: { lastSeen: new Date() } }).catch(() => {
      // no arrojamos error al cliente si falla el heartbeat
    });

    return next();
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

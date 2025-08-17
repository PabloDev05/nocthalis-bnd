// src/middleware/requireAuth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { User } from "../models/User";

/** Payload mínimo esperado en el JWT */
export interface JwtUserPayload {
  id: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Tipo de request autenticada.
 * Coincide con tu augmentación de Express (req.user = { id, username }).
 */
export type AuthReq = Request & {
  user?: {
    id: string;
    username: string;
  };
};

/**
 * Middleware de autenticación + "heartbeat" de presencia.
 * - Valida el JWT (id, firma, expiración).
 * - Verifica que el usuario exista (cubre resets de BD).
 * - Setea req.user para downstream (tipado vía AuthReq y augmentación).
 * - Actualiza lastSeen en background para presencia (no bloqueante).
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = req.headers.authorization ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("JWT_SECRET no configurado");
      return res.status(500).json({ message: "Config error" });
    }

    let payload: JwtUserPayload;
    try {
      payload = jwt.verify(token, secret) as JwtUserPayload;
    } catch {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!payload?.id || !Types.ObjectId.isValid(payload.id)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const exists = await User.exists({ _id: payload.id });
    if (!exists) return res.status(401).json({ message: "Unauthorized" });

    // Inyectamos en req.user (id + username)
    (req as AuthReq).user = { id: payload.id, username: payload.username };

    // Heartbeat de presencia (no bloquea la respuesta)
    void User.updateOne({ _id: payload.id }, { $set: { lastSeen: new Date() } }).catch(() => {
      // Silenciamos fallas del heartbeat
    });

    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

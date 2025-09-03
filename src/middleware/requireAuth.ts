import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { User } from "../models/User";

/** Payload mínimo esperado en el JWT */
export interface JwtUserPayload {
  id: string;
  username?: string;
  iat?: number;
  exp?: number;
}

/** Extrae el bearer token del header o de una cookie (ej. auth_token) */
function getTokenFromReq(req: Request): string | null {
  const auth = req.headers.authorization ?? "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim() || null;

  // opcional: si usás cookie-parser, podés leer una cookie
  // @ts-ignore - cookies existe si usás cookie-parser
  const cookieTok = req.cookies?.auth_token as string | undefined;
  if (cookieTok && typeof cookieTok === "string" && cookieTok.length > 10) return cookieTok;

  return null;
}

/**
 * Middleware de autenticación + “heartbeat” de presencia.
 * - Valida el JWT (id, firma, expiración).
 * - Verifica que el usuario exista (cubre resets de BD).
 * - Setea req.user para downstream (tipado vía augmentación en src/types/express.d.ts).
 * - Actualiza lastSeen en background (no bloqueante).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getTokenFromReq(req);
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

    // Confirmar que el usuario exista (por si hay resets de DB)
    const exists = await User.exists({ _id: payload.id });
    if (!exists) return res.status(401).json({ message: "Unauthorized" });

    // Inyectamos en req.user (id + username si vino en el token)
    req.user = { id: payload.id, username: payload.username ?? "—" };

    // Heartbeat de presencia (asíncrono, no bloquea la respuesta)
    void User.updateOne({ _id: payload.id }, { $set: { lastSeen: new Date() } }).catch(() => {});

    return next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

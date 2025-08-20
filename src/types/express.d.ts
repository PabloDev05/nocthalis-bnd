// src/types/express.d.ts
import "express-serve-static-core";

declare global {
  namespace Express {
    /** Debe reflejar lo que setea tu requireAuth */
    interface User {
      id: string;
      username?: string; // <- opcional para no romper AuthReq minimalistas
      email?: string; // <- útil si logueás por email
      characterId?: string; // <- si lo inyectás más adelante
    }

    interface Request {
      /** Inyectado por requireAuth */
      user?: User;
    }
  }
}

export {};

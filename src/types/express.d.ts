// src/types/express.d.ts
import "express";

declare global {
  namespace Express {
    /** Debe reflejar lo que setea tu requireAuth */
    interface User {
      id: string;
      username?: string;
      email?: string;
      characterId?: string;
    }

    interface Request {
      /** Inyectado por requireAuth */
      user?: User;
    }
  }
}

export {};

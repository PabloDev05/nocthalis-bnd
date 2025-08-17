// src/types/express.d.ts
import "express-serve-static-core";

declare global {
  namespace Express {
    /** Ajustá este shape a lo que ponga tu requireAuth */
    interface User {
      id: string;
      username: string;
      characterId?: string;
    }

    interface Request {
      /** Inyectado por requireAuth */
      user?: User;
    }
  }
}

export {};

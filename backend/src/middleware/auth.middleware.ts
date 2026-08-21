import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";
import { AccessTokenPayload } from "../modules/auth/auth.service";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      utilisateur?: AccessTokenPayload;
    }
  }
}

// Vérifie le jeton d'accès et attache l'utilisateur authentifié à la requête.
export function authentifier(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentification requise." });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
    req.utilisateur = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Session invalide ou expirée." });
  }
}

// Contrôle d'accès par rôle (RBAC) — section 10 du CDC.
export function autoriser(...rolesAutorises: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.utilisateur) {
      return res.status(401).json({ message: "Authentification requise." });
    }
    if (!rolesAutorises.includes(req.utilisateur.role)) {
      return res.status(403).json({ message: "Accès refusé." });
    }
    next();
  };
}

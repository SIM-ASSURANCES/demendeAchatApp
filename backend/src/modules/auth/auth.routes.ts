import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  verifierIdentifiants,
  genererAccessToken,
  genererRefreshToken,
  verifierRefreshToken,
} from "./auth.service";
import { prisma } from "../../lib/prisma";
import { consignerAudit } from "../../lib/audit";
import { authentifier } from "../../middleware/auth.middleware";

export const authRouter = Router();

// Limitation des tentatives de connexion — section 10 du CDC / F-12
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de tentatives de connexion. Réessayez plus tard." },
});

const loginSchema = z.object({
  identifiant: z.string().min(1),
  motDePasse: z.string().min(1),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Identifiant et mot de passe requis." });
  }

  const { identifiant, motDePasse } = parsed.data;
  const utilisateur = await verifierIdentifiants(identifiant, motDePasse);

  if (!utilisateur) {
    await consignerAudit({
      action: "CONNEXION_ECHOUEE",
      auteurLibelle: identifiant,
      detail: { ip: req.ip },
    });
    return res.status(401).json({ message: "Identifiants invalides." });
  }

  const accessToken = genererAccessToken({ sub: utilisateur.id, role: utilisateur.role, nom: utilisateur.nom });
  const refreshToken = genererRefreshToken({ sub: utilisateur.id });

  await consignerAudit({
    action: "CONNEXION_REUSSIE",
    auteurId: utilisateur.id,
    auteurLibelle: utilisateur.nom,
    detail: { ip: req.ip },
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken,
    utilisateur: { id: utilisateur.id, nom: utilisateur.nom, role: utilisateur.role },
  });
});

authRouter.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ message: "Session expirée." });

  try {
    const payload = verifierRefreshToken(token);
    const utilisateur = await prisma.utilisateur.findUnique({ where: { id: payload.sub } });
    if (!utilisateur || !utilisateur.actif) {
      return res.status(401).json({ message: "Session expirée." });
    }
    const accessToken = genererAccessToken({ sub: utilisateur.id, role: utilisateur.role, nom: utilisateur.nom });
    res.json({ accessToken });
  } catch {
    return res.status(401).json({ message: "Session expirée." });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("refreshToken");
  res.status(204).send();
});

authRouter.get("/moi", authentifier, (req, res) => {
  res.json({ id: req.utilisateur!.sub, nom: req.utilisateur!.nom, role: req.utilisateur!.role });
});

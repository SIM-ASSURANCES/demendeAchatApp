import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authentifier, autoriser } from "../../middleware/auth.middleware";
import { consignerAudit } from "../../lib/audit";
import { hacherMotDePasse } from "../auth/auth.service";

export const usersRouter = Router();

// Politique de mot de passe robuste (F-12) : 12 caractères minimum, majuscule, minuscule, chiffre.
const motDePasseRobuste = z
  .string()
  .min(12, "12 caractères minimum")
  .regex(/[a-z]/, "au moins une minuscule")
  .regex(/[A-Z]/, "au moins une majuscule")
  .regex(/[0-9]/, "au moins un chiffre");

usersRouter.get("/", authentifier, autoriser("ADMIN"), async (_req, res) => {
  const utilisateurs = await prisma.utilisateur.findMany({
    select: { id: true, nom: true, identifiant: true, email: true, role: true, actif: true, totpActif: true, creeLe: true },
    orderBy: { nom: "asc" },
  });
  res.json(utilisateurs);
});

const creationSchema = z.object({
  nom: z.string().min(1).max(160),
  identifiant: z.string().min(3).max(80),
  email: z.string().email("Adresse email invalide — nécessaire aux notifications (F-09)."),
  motDePasse: motDePasseRobuste,
  role: z.nativeEnum(Role),
});

usersRouter.post("/", authentifier, autoriser("ADMIN"), async (req, res) => {
  const parsed = creationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Données invalides." });
  }

  const existant = await prisma.utilisateur.findFirst({
    where: { OR: [{ identifiant: parsed.data.identifiant }, { email: parsed.data.email }] },
  });
  if (existant) return res.status(409).json({ message: "Cet identifiant ou cet email existe déjà." });

  const motDePasseHash = await hacherMotDePasse(parsed.data.motDePasse);
  const utilisateur = await prisma.utilisateur.create({
    data: {
      nom: parsed.data.nom,
      identifiant: parsed.data.identifiant,
      email: parsed.data.email,
      role: parsed.data.role,
      motDePasseHash,
    },
  });

  await consignerAudit({
    action: "COMPTE_CREE",
    auteurId: req.utilisateur!.sub,
    auteurLibelle: req.utilisateur!.nom,
    detail: { compteId: utilisateur.id, role: utilisateur.role },
  });

  res.status(201).json({ id: utilisateur.id, nom: utilisateur.nom, identifiant: utilisateur.identifiant, email: utilisateur.email, role: utilisateur.role });
});

usersRouter.patch("/:id/desactiver", authentifier, autoriser("ADMIN"), async (req, res) => {
  const utilisateur = await prisma.utilisateur.update({
    where: { id: req.params.id },
    data: { actif: false },
  });

  await consignerAudit({
    action: "COMPTE_DESACTIVE",
    auteurId: req.utilisateur!.sub,
    auteurLibelle: req.utilisateur!.nom,
    detail: { compteId: utilisateur.id },
  });

  res.json({ id: utilisateur.id, actif: utilisateur.actif });
});

usersRouter.patch("/:id/reinitialiser-mot-de-passe", authentifier, autoriser("ADMIN"), async (req, res) => {
  const parsed = z.object({ motDePasse: motDePasseRobuste }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Mot de passe invalide." });
  }

  const motDePasseHash = await hacherMotDePasse(parsed.data.motDePasse);
  const utilisateur = await prisma.utilisateur.update({
    where: { id: req.params.id },
    data: { motDePasseHash },
  });

  await consignerAudit({
    action: "MOT_DE_PASSE_REINITIALISE",
    auteurId: req.utilisateur!.sub,
    auteurLibelle: req.utilisateur!.nom,
    detail: { compteId: utilisateur.id },
  });

  res.status(204).send();
});

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authentifier, autoriser } from "../../middleware/auth.middleware";
import { consignerAudit } from "../../lib/audit";

export const entitesRouter = Router();

// Liste publique (nécessaire au formulaire public F-01) : entités actives uniquement.
entitesRouter.get("/", async (req, res) => {
  const inclureInactives = req.query.toutes === "1";
  const entites = await prisma.entite.findMany({
    where: inclureInactives ? undefined : { actif: true },
    orderBy: { libelle: "asc" },
  });
  res.json(entites);
});

const entiteSchema = z.object({ libelle: z.string().min(1).max(120) });

entitesRouter.post("/", authentifier, autoriser("ADMIN"), async (req, res) => {
  const parsed = entiteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Libellé requis." });

  const entite = await prisma.entite.create({
    data: { libelle: parsed.data.libelle, creeParId: req.utilisateur!.sub },
  });

  await consignerAudit({
    action: "ENTITE_CREEE",
    auteurId: req.utilisateur!.sub,
    auteurLibelle: req.utilisateur!.nom,
    detail: { entiteId: entite.id, libelle: entite.libelle },
  });

  res.status(201).json(entite);
});

entitesRouter.patch("/:id", authentifier, autoriser("ADMIN"), async (req, res) => {
  const parsed = z
    .object({ libelle: z.string().min(1).max(120).optional(), actif: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Données invalides." });

  const entite = await prisma.entite.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  await consignerAudit({
    action: "ENTITE_MODIFIEE",
    auteurId: req.utilisateur!.sub,
    auteurLibelle: req.utilisateur!.nom,
    detail: { entiteId: entite.id, changements: parsed.data },
  });

  res.json(entite);
});

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authentifier, autoriser } from "../../middleware/auth.middleware";
import { consignerAudit } from "../../lib/audit";

export const categoriesRouter = Router();

// Liste publique (nécessaire au formulaire public F-01) : catégories actives uniquement.
categoriesRouter.get("/", async (req, res) => {
  const inclureInactives = req.query.toutes === "1";
  const categories = await prisma.categorie.findMany({
    where: inclureInactives ? undefined : { actif: true },
    orderBy: { libelle: "asc" },
  });
  res.json(categories);
});

const categorieSchema = z.object({ libelle: z.string().min(1).max(120) });

categoriesRouter.post("/", authentifier, autoriser("ADMIN"), async (req, res) => {
  const parsed = categorieSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Libellé requis." });

  const categorie = await prisma.categorie.create({
    data: { libelle: parsed.data.libelle, creeParId: req.utilisateur!.sub },
  });

  await consignerAudit({
    action: "CATEGORIE_CREEE",
    auteurId: req.utilisateur!.sub,
    auteurLibelle: req.utilisateur!.nom,
    detail: { categorieId: categorie.id, libelle: categorie.libelle },
  });

  res.status(201).json(categorie);
});

categoriesRouter.patch("/:id", authentifier, autoriser("ADMIN"), async (req, res) => {
  const parsed = z
    .object({ libelle: z.string().min(1).max(120).optional(), actif: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Données invalides." });

  const categorie = await prisma.categorie.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  await consignerAudit({
    action: "CATEGORIE_MODIFIEE",
    auteurId: req.utilisateur!.sub,
    auteurLibelle: req.utilisateur!.nom,
    detail: { categorieId: categorie.id, changements: parsed.data },
  });

  res.json(categorie);
});

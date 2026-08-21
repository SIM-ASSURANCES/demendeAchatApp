import { Router } from "express";
import { z } from "zod";
import { Devise, StatutDemande } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authentifier, autoriser } from "../../middleware/auth.middleware";
import { consignerAudit } from "../../lib/audit";

export const budgetsRouter = Router();

// Consultation réservée aux espaces privés (RH/DG/Admin) — tableau Budget/Réalisé/Disponible (CDC §7.3).
budgetsRouter.get("/", authentifier, autoriser("RH", "DG", "ADMIN"), async (req, res) => {
  const budgets = await prisma.budget.findMany({
    include: { entite: true, categorie: true },
    orderBy: { periodeDebut: "desc" },
  });

  const budgetsAvecRealise = await Promise.all(
    budgets.map(async (budget) => {
      const agregat = await prisma.demandeAchat.aggregate({
        where: { budgetId: budget.id, statut: StatutDemande.VALIDEE },
        _sum: { montantTotal: true },
      });
      const realise = agregat._sum.montantTotal ?? 0;
      const disponible = Number(budget.montantAlloue) - Number(realise);
      return { ...budget, realise, disponible };
    })
  );

  res.json(budgetsAvecRealise);
});

const budgetSchema = z.object({
  poste: z.string().min(1).max(160),
  entiteId: z.string().uuid(),
  categorieId: z.string().uuid(),
  periodeDebut: z.coerce.date(),
  periodeFin: z.coerce.date(),
  montantAlloue: z.coerce.number().positive(),
  devise: z.nativeEnum(Devise).optional(),
  observations: z.string().max(500).optional(),
});

budgetsRouter.post("/", authentifier, autoriser("ADMIN"), async (req, res) => {
  const parsed = budgetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Données de budget invalides." });

  const budget = await prisma.budget.create({ data: parsed.data });

  await consignerAudit({
    action: "BUDGET_CREE",
    auteurId: req.utilisateur!.sub,
    auteurLibelle: req.utilisateur!.nom,
    detail: { budgetId: budget.id, poste: budget.poste },
  });

  res.status(201).json(budget);
});

budgetsRouter.patch("/:id", authentifier, autoriser("ADMIN"), async (req, res) => {
  const parsed = budgetSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Données de budget invalides." });

  const budget = await prisma.budget.update({ where: { id: req.params.id }, data: parsed.data });

  await consignerAudit({
    action: "BUDGET_MODIFIE",
    auteurId: req.utilisateur!.sub,
    auteurLibelle: req.utilisateur!.nom,
    detail: { budgetId: budget.id, changements: parsed.data },
  });

  res.json(budget);
});

import { Router } from "express";
import { z } from "zod";
import { Devise, StatutBudget } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authentifier, autoriser } from "../../middleware/auth.middleware";
import { consignerAudit } from "../../lib/audit";
import { calculerBudgetsAvecSuivi } from "../../lib/budgetCalcul";
import { notifierNouveauBudgetPropose, notifierDecisionBudget } from "../../lib/notifications";

export const budgetsRouter = Router();

// Consultation réservée aux espaces privés (RH/DG/Admin) — tableau Budget/Réalisé/Disponible (CDC §7.3),
// y compris les postes en attente de validation ou rejetés (pour le suivi du workflow).
budgetsRouter.get("/", authentifier, autoriser("RH", "DG", "ADMIN"), async (_req, res) => {
  res.json(await calculerBudgetsAvecSuivi());
});

// F-01 : le formulaire public ne doit proposer que les postes budgétaires déjà validés par le DG,
// sans exposer les montants (alloué/réalisé/disponible), réservés aux espaces privés.
budgetsRouter.get("/postes", async (_req, res) => {
  const budgets = await prisma.budget.findMany({
    where: { statut: StatutBudget.VALIDE },
    select: { id: true, poste: true, entiteId: true, categorieId: true, periodeDebut: true, periodeFin: true },
    orderBy: { poste: "asc" },
  });
  res.json(budgets);
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

// Paramétrage des budgets : proposé par le RH, en attente de validation par le DG.
budgetsRouter.post("/", authentifier, autoriser("RH"), async (req, res, next) => {
  try {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Données de budget invalides." });

    const budget = await prisma.budget.create({
      data: {
        ...parsed.data,
        statut: StatutBudget.EN_ATTENTE_VALIDATION,
        proposeParId: req.utilisateur!.sub,
      },
      include: { entite: true, categorie: true },
    });

    await consignerAudit({
      action: "BUDGET_PROPOSE",
      auteurId: req.utilisateur!.sub,
      auteurLibelle: req.utilisateur!.nom,
      detail: { budgetId: budget.id, poste: budget.poste },
    });

    await notifierNouveauBudgetPropose(budget, { nom: req.utilisateur!.nom });

    res.status(201).json(budget);
  } catch (err) {
    next(err);
  }
});

// Correction administrative — n'affecte pas le statut de validation.
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

// Validation du poste budgétaire, réservée au DG.
budgetsRouter.post("/:id/valider", authentifier, autoriser("DG"), async (req, res, next) => {
  try {
    const existant = await prisma.budget.findUnique({
      where: { id: req.params.id },
      include: { entite: true, categorie: true, proposePar: { select: { id: true, nom: true, email: true } } },
    });
    if (!existant) return res.status(404).json({ message: "Poste budgétaire introuvable." });
    if (existant.statut !== StatutBudget.EN_ATTENTE_VALIDATION) {
      return res.status(409).json({ message: "Ce poste budgétaire n'est plus en attente de validation." });
    }

    const budget = await prisma.budget.update({
      where: { id: req.params.id },
      data: { statut: StatutBudget.VALIDE, valideParId: req.utilisateur!.sub, valideLe: new Date() },
    });

    await consignerAudit({
      action: "BUDGET_VALIDE",
      auteurId: req.utilisateur!.sub,
      auteurLibelle: req.utilisateur!.nom,
      detail: { budgetId: budget.id, poste: budget.poste },
    });

    await notifierDecisionBudget(existant, existant.proposePar, "VALIDE");

    res.json(budget);
  } catch (err) {
    next(err);
  }
});

const rejetBudgetSchema = z.object({ motif: z.string().min(1).max(1000) });

// Rejet du poste budgétaire, réservé au DG.
budgetsRouter.post("/:id/rejeter", authentifier, autoriser("DG"), async (req, res, next) => {
  try {
    const parsed = rejetBudgetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Motif de rejet requis." });

    const existant = await prisma.budget.findUnique({
      where: { id: req.params.id },
      include: { entite: true, categorie: true, proposePar: { select: { id: true, nom: true, email: true } } },
    });
    if (!existant) return res.status(404).json({ message: "Poste budgétaire introuvable." });
    if (existant.statut !== StatutBudget.EN_ATTENTE_VALIDATION) {
      return res.status(409).json({ message: "Ce poste budgétaire n'est plus en attente de validation." });
    }

    const budget = await prisma.budget.update({
      where: { id: req.params.id },
      data: {
        statut: StatutBudget.REJETE,
        rejeteParId: req.utilisateur!.sub,
        motifRejet: parsed.data.motif,
        rejeteLe: new Date(),
      },
    });

    await consignerAudit({
      action: "BUDGET_REJETE",
      auteurId: req.utilisateur!.sub,
      auteurLibelle: req.utilisateur!.nom,
      detail: { budgetId: budget.id, motif: parsed.data.motif },
    });

    await notifierDecisionBudget(existant, existant.proposePar, "REJETE", parsed.data.motif);

    res.json(budget);
  } catch (err) {
    next(err);
  }
});

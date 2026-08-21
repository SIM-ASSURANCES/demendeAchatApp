import { Router } from "express";
import { RoleSignataire, StatutBudget, StatutDemande } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { authentifier } from "../../middleware/auth.middleware";

export const notificationsRouter = Router();

// Compteur d'actions en attente pour l'utilisateur connecté (cloche de l'espace privé) : le
// nombre de demandes qu'il lui revient de valider ou rejeter, plus — pour le DG — les postes
// budgétaires proposés par le RH qui attendent sa décision. Ce n'est pas un flux d'événements
// « lus/non lus » : c'est ce qui reste concrètement à traiter maintenant.
notificationsRouter.get("/compteur", authentifier, async (req, res) => {
  const role = req.utilisateur!.role;

  if (role !== "RH" && role !== "DG") {
    return res.json({ total: 0 });
  }

  const demandesEnAttenteDeMoi = await prisma.demandeAchat.count({
    where: {
      OR: [
        { statut: StatutDemande.SOUMISE },
        {
          statut: StatutDemande.EN_ATTENTE_SECONDE_VALIDATION,
          signatures: { none: { role: role as RoleSignataire } },
        },
      ],
    },
  });

  let budgetsEnAttente = 0;
  if (role === "DG") {
    budgetsEnAttente = await prisma.budget.count({
      where: { statut: StatutBudget.EN_ATTENTE_VALIDATION },
    });
  }

  res.json({
    total: demandesEnAttenteDeMoi + budgetsEnAttente,
    demandes: demandesEnAttenteDeMoi,
    budgets: budgetsEnAttente,
  });
});

import { StatutDemande } from "@prisma/client";
import { prisma } from "./prisma";

// Seuil de quasi-dépassement (F-09, F-06) : alerte dès 90% du budget alloué consommé.
const SEUIL_ALERTE = 0.9;

export interface BudgetAvecSuivi {
  id: string;
  poste: string;
  entiteId: string;
  categorieId: string;
  periodeDebut: Date;
  periodeFin: Date;
  montantAlloue: number;
  devise: string;
  observations: string | null;
  entite: { id: string; libelle: string };
  categorie: { id: string; libelle: string };
  realise: number;
  disponible: number;
  pourcentageConsomme: number;
  alerte: "DEPASSEMENT" | "QUASI_DEPASSEMENT" | null;
}

// RG-10 : le suivi Budget / Réalisé / Disponible est mis à jour automatiquement à chaque validation.
export async function calculerBudgetsAvecSuivi(): Promise<BudgetAvecSuivi[]> {
  const budgets = await prisma.budget.findMany({
    include: { entite: true, categorie: true },
    orderBy: { periodeDebut: "desc" },
  });

  return Promise.all(
    budgets.map(async (budget) => {
      const agregat = await prisma.demandeAchat.aggregate({
        where: { budgetId: budget.id, statut: StatutDemande.VALIDEE },
        _sum: { montantTotal: true },
      });
      const montantAlloue = Number(budget.montantAlloue);
      const realise = Number(agregat._sum.montantTotal ?? 0);
      const disponible = montantAlloue - realise;
      const pourcentageConsomme = montantAlloue > 0 ? realise / montantAlloue : 0;

      let alerte: BudgetAvecSuivi["alerte"] = null;
      if (disponible < 0) alerte = "DEPASSEMENT";
      else if (pourcentageConsomme >= SEUIL_ALERTE) alerte = "QUASI_DEPASSEMENT";

      return {
        id: budget.id,
        poste: budget.poste,
        entiteId: budget.entiteId,
        categorieId: budget.categorieId,
        periodeDebut: budget.periodeDebut,
        periodeFin: budget.periodeFin,
        montantAlloue,
        devise: budget.devise,
        observations: budget.observations,
        entite: budget.entite,
        categorie: budget.categorie,
        realise,
        disponible,
        pourcentageConsomme,
        alerte,
      };
    })
  );
}

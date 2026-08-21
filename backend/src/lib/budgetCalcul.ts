import { StatutBudget, StatutDemande } from "@prisma/client";
import { prisma } from "./prisma";

// Seuil de quasi-dépassement (F-09, F-06) : alerte dès 90% du budget alloué consommé.
const SEUIL_ALERTE = 0.9;

interface Acteur {
  id: string;
  nom: string;
}

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
  // Paramétrage : proposé par le RH, validé ou rejeté par le DG.
  statut: StatutBudget;
  proposePar: Acteur | null;
  validePar: Acteur | null;
  valideLe: Date | null;
  rejetePar: Acteur | null;
  motifRejet: string | null;
  rejeteLe: Date | null;
}

async function calculerSuivi(budget: {
  id: string;
  poste: string;
  entiteId: string;
  categorieId: string;
  periodeDebut: Date;
  periodeFin: Date;
  montantAlloue: unknown;
  devise: string;
  observations: string | null;
  entite: { id: string; libelle: string };
  categorie: { id: string; libelle: string };
  statut: StatutBudget;
  proposePar: Acteur | null;
  validePar: Acteur | null;
  valideLe: Date | null;
  rejetePar: Acteur | null;
  motifRejet: string | null;
  rejeteLe: Date | null;
}): Promise<BudgetAvecSuivi> {
  const agregat = await prisma.demandeAchat.aggregate({
    where: { budgetId: budget.id, statut: StatutDemande.VALIDEE },
    _sum: { montantTotalXOF: true },
  });
  const montantAlloue = Number(budget.montantAlloue);
  const realise = Number(agregat._sum.montantTotalXOF ?? 0);
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
    statut: budget.statut,
    proposePar: budget.proposePar,
    validePar: budget.validePar,
    valideLe: budget.valideLe,
    rejetePar: budget.rejetePar,
    motifRejet: budget.motifRejet,
    rejeteLe: budget.rejeteLe,
  };
}

const SELECTION_ACTEUR = { select: { id: true, nom: true } } as const;

// RG-10 : le suivi Budget / Réalisé / Disponible est mis à jour automatiquement à chaque validation.
export async function calculerBudgetsAvecSuivi(): Promise<BudgetAvecSuivi[]> {
  const budgets = await prisma.budget.findMany({
    include: {
      entite: true,
      categorie: true,
      proposePar: SELECTION_ACTEUR,
      validePar: SELECTION_ACTEUR,
      rejetePar: SELECTION_ACTEUR,
    },
    orderBy: { creeLe: "desc" },
  });
  return Promise.all(budgets.map(calculerSuivi));
}

// F-09 : suivi d'un seul poste budgétaire, pour déclencher l'alerte de (quasi-)dépassement
// immédiatement après la validation d'une demande qui lui est rattachée.
export async function calculerUnBudgetAvecSuivi(budgetId: string): Promise<BudgetAvecSuivi | null> {
  const budget = await prisma.budget.findUnique({
    where: { id: budgetId },
    include: {
      entite: true,
      categorie: true,
      proposePar: SELECTION_ACTEUR,
      validePar: SELECTION_ACTEUR,
      rejetePar: SELECTION_ACTEUR,
    },
  });
  if (!budget) return null;
  return calculerSuivi(budget);
}

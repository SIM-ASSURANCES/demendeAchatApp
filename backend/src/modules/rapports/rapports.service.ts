import { StatutDemande } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export type Granularite = "jour" | "semaine" | "mois" | "trimestre" | "annee" | "personnalisee";

export interface FiltresRapport {
  dateDebut?: Date;
  dateFin?: Date;
  entiteId?: string;
  categorieId?: string;
  // RG-11 : par défaut, seules les demandes validées alimentent la comptabilité ; les demandes
  // annulées sont exclues des totaux mais restent consultables séparément.
  inclureAnnulees?: boolean;
}

async function listerDemandesPourRapport(filtres: FiltresRapport) {
  return prisma.demandeAchat.findMany({
    where: {
      statut: filtres.inclureAnnulees
        ? { in: [StatutDemande.VALIDEE, StatutDemande.ANNULEE] }
        : StatutDemande.VALIDEE,
      entiteId: filtres.entiteId,
      categorieId: filtres.categorieId,
      valideLe: { gte: filtres.dateDebut, lte: filtres.dateFin },
    },
    include: { entite: true, categorie: true },
    orderBy: { valideLe: "asc" },
  });
}

function agregerParCle<T>(
  demandes: Awaited<ReturnType<typeof listerDemandesPourRapport>>,
  cle: (d: (typeof demandes)[number]) => { id: string; libelle: string }
) {
  const table = new Map<string, { id: string; libelle: string; total: number; nombre: number }>();
  for (const demande of demandes) {
    const { id, libelle } = cle(demande);
    const entree = table.get(id) ?? { id, libelle, total: 0, nombre: 0 };
    entree.total += Number(demande.montantTotal);
    entree.nombre += 1;
    table.set(id, entree);
  }
  return Array.from(table.values()).sort((a, b) => b.total - a.total);
}

function numeroSemaineISO(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const jourSemaine = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jourSemaine);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - debutAnnee.getTime()) / 86400000 + 1) / 7);
}

function cléPeriode(date: Date, granularite: Granularite): { cle: string; libelle: string } {
  const annee = date.getFullYear();
  switch (granularite) {
    case "jour": {
      const cle = date.toISOString().slice(0, 10);
      return { cle, libelle: cle };
    }
    case "semaine": {
      const semaine = numeroSemaineISO(date);
      const cle = `${annee}-S${String(semaine).padStart(2, "0")}`;
      return { cle, libelle: cle };
    }
    case "mois": {
      const mois = String(date.getMonth() + 1).padStart(2, "0");
      const cle = `${annee}-${mois}`;
      return { cle, libelle: cle };
    }
    case "trimestre": {
      const trimestre = Math.floor(date.getMonth() / 3) + 1;
      const cle = `${annee}-T${trimestre}`;
      return { cle, libelle: cle };
    }
    case "annee": {
      const cle = String(annee);
      return { cle, libelle: cle };
    }
    case "personnalisee":
    default:
      return { cle: "periode", libelle: "Période sélectionnée" };
  }
}

function agregerParPeriode(
  demandes: Awaited<ReturnType<typeof listerDemandesPourRapport>>,
  granularite: Granularite
) {
  const table = new Map<string, { periode: string; total: number; nombre: number }>();
  for (const demande of demandes) {
    const date = demande.valideLe ?? demande.creeLe;
    const { cle, libelle } = cléPeriode(date, granularite);
    const entree = table.get(cle) ?? { periode: libelle, total: 0, nombre: 0 };
    entree.total += Number(demande.montantTotal);
    entree.nombre += 1;
    table.set(cle, entree);
  }
  return Array.from(table.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, valeur]) => valeur);
}

// F-06 : tableau de bord des demandes validées, ventilé par catégorie, entité et période.
export async function construireTableauDeBord(filtres: FiltresRapport, granularite: Granularite) {
  const demandes = await listerDemandesPourRapport(filtres);

  const parCategorie = agregerParCle(demandes, (d) => ({ id: d.categorieId, libelle: d.categorie.libelle }));
  const parEntite = agregerParCle(demandes, (d) => ({ id: d.entiteId, libelle: d.entite.libelle }));
  const parPeriode = agregerParPeriode(demandes, granularite);

  const totalGeneral = demandes.reduce((somme, d) => somme + Number(d.montantTotal), 0);

  return {
    totalGeneral,
    nombreDemandes: demandes.length,
    parCategorie,
    parEntite,
    parPeriode,
    demandes: demandes.map((d) => ({
      id: d.id,
      numero: d.numero,
      demandeurNom: d.demandeurNom,
      entite: d.entite.libelle,
      categorie: d.categorie.libelle,
      montantTotal: Number(d.montantTotal),
      statut: d.statut,
      valideLe: d.valideLe,
    })),
  };
}

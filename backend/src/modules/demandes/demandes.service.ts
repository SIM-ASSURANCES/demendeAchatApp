import { nanoid } from "nanoid";
import { RoleSignataire, StatutDemande } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { genererNumeroDemande } from "../../lib/numeroDemande";
import { consignerAudit } from "../../lib/audit";
import { ApiError } from "../../middleware/errorHandler";

export interface LigneArticleInput {
  libelle: string;
  quantite: number;
  prixUnitaire: number;
}

export interface CreerDemandeInput {
  demandeurNom: string;
  demandeurFonction?: string;
  demandeurEmail: string;
  demandeurTelephone?: string;
  entiteId: string;
  motif: string;
  dateLivraisonSouhaitee: Date;
  categorieId: string;
  budgetId?: string;
  devise?: "XOF" | "USD" | "EUR";
  tauxChange?: number;
  lignes: LigneArticleInput[];
}

// RG-09 : le total de chaque ligne et le total général sont calculés automatiquement par le système.
function calculerLignesEtTotal(lignes: LigneArticleInput[]) {
  const lignesCalculees = lignes.map((ligne, index) => ({
    ...ligne,
    total: Math.round(ligne.quantite * ligne.prixUnitaire * 100) / 100,
    ordre: index,
  }));
  const montantTotal = lignesCalculees.reduce((somme, l) => somme + l.total, 0);
  return { lignesCalculees, montantTotal };
}

export async function creerDemande(input: CreerDemandeInput, ip?: string) {
  if (input.lignes.length === 0) {
    throw new ApiError(400, "Au moins une ligne d'article est requise.");
  }

  const numero = await genererNumeroDemande();
  const lienSuiviToken = nanoid(32);
  const { lignesCalculees, montantTotal } = calculerLignesEtTotal(input.lignes);

  const demande = await prisma.demandeAchat.create({
    data: {
      numero,
      lienSuiviToken,
      demandeurNom: input.demandeurNom,
      demandeurFonction: input.demandeurFonction,
      demandeurEmail: input.demandeurEmail,
      demandeurTelephone: input.demandeurTelephone,
      entiteId: input.entiteId,
      motif: input.motif,
      dateLivraisonSouhaitee: input.dateLivraisonSouhaitee,
      categorieId: input.categorieId,
      budgetId: input.budgetId,
      devise: input.devise ?? "XOF",
      tauxChange: input.tauxChange,
      montantTotal,
      statut: StatutDemande.SOUMISE,
      lignes: { create: lignesCalculees },
      // Case "Demandeur" du pied de fiche : renseignée automatiquement à la soumission (CDC §7.4).
      signatures: {
        create: [{ role: RoleSignataire.DEMANDEUR, nom: input.demandeurNom }],
      },
    },
    include: { lignes: true, signatures: true },
  });

  await consignerAudit({
    demandeId: demande.id,
    action: "DEMANDE_SOUMISE",
    auteurLibelle: input.demandeurNom,
    detail: { numero, ip },
  });

  return demande;
}

export async function obtenirParToken(token: string) {
  const demande = await prisma.demandeAchat.findUnique({
    where: { lienSuiviToken: token },
    include: { lignes: true, signatures: true, piecesJointes: true, entite: true, categorie: true, budget: true },
  });
  if (!demande) throw new ApiError(404, "Demande introuvable.");
  return demande;
}

// RG-03 : modifiable/supprimable par son auteur, via son lien de suivi, tant qu'aucun valideur n'a statué.
async function verifierModifiable(demandeId: string) {
  const demande = await prisma.demandeAchat.findUnique({ where: { id: demandeId } });
  if (!demande) throw new ApiError(404, "Demande introuvable.");
  if (demande.statut !== StatutDemande.SOUMISE) {
    throw new ApiError(409, "Cette demande n'est plus modifiable.");
  }
  return demande;
}

export async function modifierDemandeParToken(
  token: string,
  input: Partial<CreerDemandeInput>
) {
  const demande = await obtenirParToken(token);
  await verifierModifiable(demande.id);

  const data: Record<string, unknown> = {};
  if (input.motif !== undefined) data.motif = input.motif;
  if (input.entiteId !== undefined) data.entiteId = input.entiteId;
  if (input.categorieId !== undefined) data.categorieId = input.categorieId;
  if (input.budgetId !== undefined) data.budgetId = input.budgetId;
  if (input.dateLivraisonSouhaitee !== undefined) data.dateLivraisonSouhaitee = input.dateLivraisonSouhaitee;

  if (input.lignes) {
    const { lignesCalculees, montantTotal } = calculerLignesEtTotal(input.lignes);
    await prisma.ligneArticle.deleteMany({ where: { demandeId: demande.id } });
    data.montantTotal = montantTotal;
    data.lignes = { create: lignesCalculees };
  }

  const misAJour = await prisma.demandeAchat.update({
    where: { id: demande.id },
    data,
    include: { lignes: true },
  });

  await consignerAudit({
    demandeId: demande.id,
    action: "DEMANDE_MODIFIEE",
    auteurLibelle: demande.demandeurNom,
  });

  return misAJour;
}

export async function supprimerDemandeParToken(token: string) {
  const demande = await obtenirParToken(token);
  await verifierModifiable(demande.id);

  await consignerAudit({
    demandeId: demande.id,
    action: "DEMANDE_SUPPRIMEE",
    auteurLibelle: demande.demandeurNom,
  });

  await prisma.demandeAchat.delete({ where: { id: demande.id } });
}

export interface FiltresListe {
  statut?: StatutDemande;
  entiteId?: string;
  categorieId?: string;
  dateDebut?: Date;
  dateFin?: Date;
  montantMin?: number;
  montantMax?: number;
  recherche?: string;
}

export async function listerDemandes(filtres: FiltresListe) {
  return prisma.demandeAchat.findMany({
    where: {
      statut: filtres.statut,
      entiteId: filtres.entiteId,
      categorieId: filtres.categorieId,
      montantTotal: {
        gte: filtres.montantMin,
        lte: filtres.montantMax,
      },
      creeLe: { gte: filtres.dateDebut, lte: filtres.dateFin },
      OR: filtres.recherche
        ? [
            { numero: { contains: filtres.recherche, mode: "insensitive" } },
            { demandeurNom: { contains: filtres.recherche, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { entite: true, categorie: true },
    orderBy: { creeLe: "desc" },
  });
}

export async function obtenirDetail(id: string) {
  const demande = await prisma.demandeAchat.findUnique({
    where: { id },
    include: {
      lignes: true,
      signatures: true,
      piecesJointes: true,
      entite: true,
      categorie: true,
      budget: true,
      validePar: { select: { id: true, nom: true, role: true } },
      annulePar: { select: { id: true, nom: true, role: true } },
    },
  });
  if (!demande) throw new ApiError(404, "Demande introuvable.");
  return demande;
}

// RG-04, RG-05, F-03, F-04 : la validation par RH ou DG (l'un des deux suffit) rend la demande
// définitive, appose la signature électronique automatique et verrouille la demande.
export async function validerDemande(
  demandeId: string,
  valideur: { id: string; nom: string; role: "RH" | "DG" },
  contexte: { ip?: string; sessionId?: string }
) {
  const demande = await prisma.demandeAchat.findUnique({ where: { id: demandeId } });
  if (!demande) throw new ApiError(404, "Demande introuvable.");
  if (demande.statut === StatutDemande.VALIDEE) {
    throw new ApiError(409, "Cette demande est déjà validée.");
  }
  if (demande.statut === StatutDemande.ANNULEE) {
    throw new ApiError(409, "Cette demande est annulée.");
  }

  const misAJour = await prisma.demandeAchat.update({
    where: { id: demandeId },
    data: {
      statut: StatutDemande.VALIDEE,
      valideLe: new Date(),
      valideParId: valideur.id,
      signatures: {
        create: [
          {
            role: valideur.role as RoleSignataire,
            nom: valideur.nom,
            utilisateurId: valideur.id,
            adresseIp: contexte.ip,
            sessionId: contexte.sessionId,
          },
        ],
      },
    },
    include: { lignes: true, signatures: true },
  });

  await consignerAudit({
    demandeId,
    action: "DEMANDE_VALIDEE",
    auteurId: valideur.id,
    auteurLibelle: valideur.nom,
    detail: { role: valideur.role },
  });

  return misAJour;
}

// RG-08 : avant validation, rejet possible par RH ou DG, motif obligatoire ; la demande redevient
// modifiable et peut être corrigée puis resoumise par le demandeur.
export async function rejeterDemande(
  demandeId: string,
  motif: string,
  valideur: { id: string; nom: string }
) {
  const demande = await prisma.demandeAchat.findUnique({ where: { id: demandeId } });
  if (!demande) throw new ApiError(404, "Demande introuvable.");
  if (demande.statut !== StatutDemande.SOUMISE) {
    throw new ApiError(409, "Seule une demande en attente de validation peut être rejetée.");
  }

  const misAJour = await prisma.demandeAchat.update({
    where: { id: demandeId },
    data: { statut: StatutDemande.REJETEE, motifRejet: motif, rejeteLe: new Date() },
  });

  await consignerAudit({
    demandeId,
    action: "DEMANDE_REJETEE",
    auteurId: valideur.id,
    auteurLibelle: valideur.nom,
    detail: { motif },
  });

  return misAJour;
}

// F-05, RG-07 : annulation d'une demande validée, sans jamais la supprimer.
export async function annulerDemande(
  demandeId: string,
  motif: { categorie: string; commentaire?: string },
  acteur: { id: string; nom: string }
) {
  const demande = await prisma.demandeAchat.findUnique({ where: { id: demandeId } });
  if (!demande) throw new ApiError(404, "Demande introuvable.");
  if (demande.statut !== StatutDemande.VALIDEE) {
    throw new ApiError(409, "Seule une demande validée peut être annulée.");
  }

  const misAJour = await prisma.demandeAchat.update({
    where: { id: demandeId },
    data: {
      statut: StatutDemande.ANNULEE,
      annuleLe: new Date(),
      annuleParId: acteur.id,
      motifAnnulationCategorie: motif.categorie,
      motifAnnulationCommentaire: motif.commentaire,
    },
  });

  await consignerAudit({
    demandeId,
    action: "DEMANDE_ANNULEE",
    auteurId: acteur.id,
    auteurLibelle: acteur.nom,
    detail: motif,
  });

  return misAJour;
}

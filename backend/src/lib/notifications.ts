import { prisma } from "./prisma";
import { env } from "../config/env";
import { envoyerEmail, envoyerEmails } from "./mailer";
import { gabaritEmail } from "./emails/gabarit";
import type { BudgetAvecSuivi } from "./budgetCalcul";

const FORMAT_MONTANT = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

interface DemandeNotif {
  id: string;
  numero: string;
  demandeurNom: string;
  demandeurEmail: string;
  montantTotal: unknown;
  devise: string;
  motif: string;
  lienSuiviToken?: string;
}

async function destinatairesValideurs(): Promise<{ nom: string; email: string }[]> {
  const utilisateurs = await prisma.utilisateur.findMany({
    where: { role: { in: ["RH", "DG"] }, actif: true, email: { not: null } },
    select: { nom: true, email: true },
  });
  return utilisateurs.filter((u): u is { nom: string; email: string } => !!u.email);
}

// F-09 : accusé de réception au demandeur, avec le lien de suivi personnel.
export async function notifierAccuseReception(demande: DemandeNotif & { lienSuiviToken: string }): Promise<void> {
  const lienSuivi = `${env.frontendUrl}/suivi/${demande.lienSuiviToken}`;
  await envoyerEmail({
    to: demande.demandeurEmail,
    subject: `Demande d'achat ${demande.numero} — accusé de réception`,
    html: gabaritEmail(
      "Votre demande d'achat a bien été enregistrée",
      `<p>Bonjour ${demande.demandeurNom},</p>
       <p>Votre demande d'achat <strong>${demande.numero}</strong>, d'un montant de
       <strong>${FORMAT_MONTANT.format(Number(demande.montantTotal))} ${demande.devise}</strong>, a été soumise avec succès
       et est désormais en attente de validation.</p>
       <p>Conservez le lien ci-dessous : il vous permet de suivre l'état de votre demande à tout moment,
       et de la modifier ou la supprimer tant qu'elle n'a pas été traitée.</p>`,
      lienSuivi,
      "Suivre ma demande"
    ),
  });
}

// F-09 : email aux valideurs RH et DG dès qu'une nouvelle demande est soumise et en attente.
export async function notifierNouvelleDemande(demande: DemandeNotif): Promise<void> {
  const destinataires = await destinatairesValideurs();
  if (destinataires.length === 0) return;

  const lienEspace = `${env.frontendUrl}/espace/demandes`;
  await envoyerEmails(
    destinataires.map((d) => ({
      to: d.email,
      subject: `Nouvelle demande d'achat à traiter — ${demande.numero}`,
      html: gabaritEmail(
        "Une nouvelle demande d'achat attend votre décision",
        `<p>Bonjour ${d.nom},</p>
         <p>${demande.demandeurNom} a soumis la demande <strong>${demande.numero}</strong> pour un montant de
         <strong>${FORMAT_MONTANT.format(Number(demande.montantTotal))} ${demande.devise}</strong>.</p>
         <p><em>Motif : ${demande.motif}</em></p>`,
        lienEspace,
        "Traiter la demande"
      ),
    }))
  );
}

const LIBELLE_EVENEMENT: Record<"VALIDEE" | "REJETEE" | "ANNULEE", string> = {
  VALIDEE: "a été validée",
  REJETEE: "a été rejetée",
  ANNULEE: "a été annulée",
};

// F-09 : email au demandeur à chaque changement de statut de sa demande.
export async function notifierChangementStatut(
  demande: DemandeNotif,
  evenement: "VALIDEE" | "REJETEE" | "ANNULEE",
  motif?: string,
  lienSuiviToken?: string
): Promise<void> {
  const lien = lienSuiviToken ? `${env.frontendUrl}/suivi/${lienSuiviToken}` : undefined;
  await envoyerEmail({
    to: demande.demandeurEmail,
    subject: `Demande d'achat ${demande.numero} — ${LIBELLE_EVENEMENT[evenement]}`,
    html: gabaritEmail(
      `Votre demande ${LIBELLE_EVENEMENT[evenement]}`,
      `<p>Bonjour ${demande.demandeurNom},</p>
       <p>Votre demande d'achat <strong>${demande.numero}</strong> ${LIBELLE_EVENEMENT[evenement]}.</p>
       ${motif ? `<p><em>Motif : ${motif}</em></p>` : ""}`,
      lien,
      "Consulter ma demande"
    ),
  });
}

// F-09 : alerte spécifique en cas de dépassement ou de quasi-dépassement d'un poste budgétaire.
export async function notifierAlerteBudget(budget: BudgetAvecSuivi): Promise<void> {
  if (!budget.alerte) return;
  const destinataires = await destinatairesValideurs();
  if (destinataires.length === 0) return;

  const estDepassement = budget.alerte === "DEPASSEMENT";
  const lienRapports = `${env.frontendUrl}/espace/rapports`;

  await envoyerEmails(
    destinataires.map((d) => ({
      to: d.email,
      subject: `${estDepassement ? "Dépassement" : "Quasi-dépassement"} de budget — ${budget.poste}`,
      html: gabaritEmail(
        estDepassement ? "Un poste budgétaire est dépassé" : "Un poste budgétaire approche de sa limite",
        `<p>Bonjour ${d.nom},</p>
         <p>Le poste budgétaire <strong>${budget.poste}</strong> (${budget.entite.libelle} — ${budget.categorie.libelle})
         a atteint <strong>${Math.round(budget.pourcentageConsomme * 100)} %</strong> du budget alloué.</p>
         <p>Budget alloué : ${FORMAT_MONTANT.format(budget.montantAlloue)} ${budget.devise}<br/>
         Réalisé : ${FORMAT_MONTANT.format(budget.realise)} ${budget.devise}<br/>
         Disponible : ${FORMAT_MONTANT.format(budget.disponible)} ${budget.devise}</p>`,
        lienRapports,
        "Consulter le suivi budgétaire"
      ),
    }))
  );
}

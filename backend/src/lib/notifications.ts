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

// Centre de notifications in-app (cloche de l'espace privé) — distinct de l'email, adressé aux
// seuls comptes RH/DG/Admin (le demandeur, non authentifié, n'a pas d'espace où les consulter).
async function enregistrerNotification(destinataireId: string, titre: string, message: string, lien?: string): Promise<void> {
  await prisma.notification.create({ data: { destinataireId, titre, message, lien } });
}

async function enregistrerNotifications(destinataireIds: string[], titre: string, message: string, lien?: string): Promise<void> {
  if (destinataireIds.length === 0) return;
  await prisma.notification.createMany({
    data: destinataireIds.map((destinataireId) => ({ destinataireId, titre, message, lien })),
  });
}

async function destinatairesValideurs(): Promise<{ id: string; nom: string; email: string }[]> {
  const utilisateurs = await prisma.utilisateur.findMany({
    where: { role: { in: ["RH", "DG"] }, actif: true },
    select: { id: true, nom: true, email: true },
  });
  return utilisateurs.map((u) => ({ id: u.id, nom: u.nom, email: u.email ?? "" }));
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

// F-09 : email + notification in-app aux valideurs RH et DG dès qu'une nouvelle demande est soumise.
export async function notifierNouvelleDemande(demande: DemandeNotif): Promise<void> {
  const destinataires = await destinatairesValideurs();
  if (destinataires.length === 0) return;

  const lienEspace = `/espace/demandes/${demande.id}`;
  const montant = `${FORMAT_MONTANT.format(Number(demande.montantTotal))} ${demande.devise}`;

  await Promise.allSettled([
    envoyerEmails(
      destinataires
        .filter((d) => d.email)
        .map((d) => ({
          to: d.email,
          subject: `Nouvelle demande d'achat à traiter — ${demande.numero}`,
          html: gabaritEmail(
            "Une nouvelle demande d'achat attend votre décision",
            `<p>Bonjour ${d.nom},</p>
             <p>${demande.demandeurNom} a soumis la demande <strong>${demande.numero}</strong> pour un montant de
             <strong>${montant}</strong>.</p>
             <p><em>Motif : ${demande.motif}</em></p>`,
            `${env.frontendUrl}${lienEspace}`,
            "Traiter la demande"
          ),
        }))
    ),
    enregistrerNotifications(
      destinataires.map((d) => d.id),
      `Nouvelle demande à traiter — ${demande.numero}`,
      `${demande.demandeurNom} — ${montant}`,
      lienEspace
    ),
  ]);
}

const LIBELLE_EVENEMENT: Record<"VALIDEE" | "REJETEE" | "ANNULEE" | "LIVREE", string> = {
  VALIDEE: "a été validée",
  REJETEE: "a été rejetée",
  ANNULEE: "a été annulée",
  LIVREE: "a été marquée comme livrée",
};

// F-09 : email au demandeur à chaque changement de statut de sa demande.
export async function notifierChangementStatut(
  demande: DemandeNotif,
  evenement: "VALIDEE" | "REJETEE" | "ANNULEE" | "LIVREE",
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

const LIBELLE_ROLE: Record<"RH" | "DG", string> = {
  RH: "le Responsable Comptable Financier RH",
  DG: "la Direction Générale",
};

// Double validation : email au demandeur dès l'obtention de la première des deux signatures.
export async function notifierValidationPartielle(
  demande: DemandeNotif,
  roleValide: "RH" | "DG",
  roleRestant: "RH" | "DG",
  lienSuiviToken?: string
): Promise<void> {
  const lien = lienSuiviToken ? `${env.frontendUrl}/suivi/${lienSuiviToken}` : undefined;
  await envoyerEmail({
    to: demande.demandeurEmail,
    subject: `Demande d'achat ${demande.numero} — première validation obtenue`,
    html: gabaritEmail(
      "Votre demande a franchi une première étape de validation",
      `<p>Bonjour ${demande.demandeurNom},</p>
       <p>Votre demande d'achat <strong>${demande.numero}</strong> a été validée par ${LIBELLE_ROLE[roleValide]}.</p>
       <p>Elle attend désormais la validation de ${LIBELLE_ROLE[roleRestant]} pour devenir définitive.</p>`,
      lien,
      "Suivre ma demande"
    ),
  });
}

// Double validation : email + notification in-app au valideur dont la signature manque encore.
export async function notifierSecondeValidationRequise(demande: DemandeNotif, roleRestant: "RH" | "DG"): Promise<void> {
  const utilisateurs = await prisma.utilisateur.findMany({
    where: { role: roleRestant, actif: true },
    select: { id: true, nom: true, email: true },
  });
  if (utilisateurs.length === 0) return;

  const lienEspace = `/espace/demandes/${demande.id}`;

  await Promise.allSettled([
    envoyerEmails(
      utilisateurs
        .filter((u): u is { id: string; nom: string; email: string } => !!u.email)
        .map((d) => ({
          to: d.email,
          subject: `Votre validation est encore nécessaire — ${demande.numero}`,
          html: gabaritEmail(
            "Une demande attend votre validation pour devenir définitive",
            `<p>Bonjour ${d.nom},</p>
             <p>La demande <strong>${demande.numero}</strong> (${demande.demandeurNom}, ${FORMAT_MONTANT.format(Number(demande.montantTotal))} ${demande.devise})
             a déjà reçu une première validation et attend désormais la vôtre pour devenir définitive.</p>`,
            `${env.frontendUrl}${lienEspace}`,
            "Traiter la demande"
          ),
        }))
    ),
    enregistrerNotifications(
      utilisateurs.map((u) => u.id),
      `Votre validation est nécessaire — ${demande.numero}`,
      `Première validation déjà obtenue pour ${demande.demandeurNom}`,
      lienEspace
    ),
  ]);
}

interface BudgetNotif {
  id: string;
  poste: string;
  montantAlloue: unknown;
  devise: string;
  entite: { libelle: string };
  categorie: { libelle: string };
}

// Paramétrage des budgets : email + notification in-app au DG dès qu'un poste est proposé par le RH.
export async function notifierNouveauBudgetPropose(budget: BudgetNotif, proposePar: { nom: string }): Promise<void> {
  const destinataires = await prisma.utilisateur.findMany({
    where: { role: "DG", actif: true },
    select: { id: true, nom: true, email: true },
  });
  if (destinataires.length === 0) return;

  const lien = "/espace/budgets";

  await Promise.allSettled([
    envoyerEmails(
      destinataires
        .filter((d): d is { id: string; nom: string; email: string } => !!d.email)
        .map((d) => ({
          to: d.email,
          subject: `Nouveau poste budgétaire à valider — ${budget.poste}`,
          html: gabaritEmail(
            "Un poste budgétaire attend votre validation",
            `<p>Bonjour ${d.nom},</p>
             <p>${proposePar.nom} a proposé le poste budgétaire <strong>${budget.poste}</strong>
             (${budget.entite.libelle} — ${budget.categorie.libelle}) pour un montant alloué de
             <strong>${FORMAT_MONTANT.format(Number(budget.montantAlloue))} ${budget.devise}</strong>.</p>`,
            `${env.frontendUrl}${lien}`,
            "Traiter la proposition"
          ),
        }))
    ),
    enregistrerNotifications(
      destinataires.map((d) => d.id),
      `Poste budgétaire à valider — ${budget.poste}`,
      `Proposé par ${proposePar.nom} (${budget.entite.libelle} — ${budget.categorie.libelle})`,
      lien
    ),
  ]);
}

// Paramétrage des budgets : email + notification in-app au RH proposeur, dès la décision du DG.
export async function notifierDecisionBudget(
  budget: BudgetNotif,
  proposePar: { id: string; email: string | null; nom: string } | null,
  decision: "VALIDE" | "REJETE",
  motif?: string
): Promise<void> {
  if (!proposePar) return;

  const lien = "/espace/budgets";
  const libelle = decision === "VALIDE" ? "a été validé" : "a été rejeté";

  await Promise.allSettled([
    proposePar.email
      ? envoyerEmail({
          to: proposePar.email,
          subject: `Poste budgétaire ${budget.poste} — ${libelle}`,
          html: gabaritEmail(
            `Votre proposition de poste budgétaire ${libelle}`,
            `<p>Bonjour ${proposePar.nom},</p>
             <p>Le poste budgétaire <strong>${budget.poste}</strong> (${budget.entite.libelle} — ${budget.categorie.libelle})
             que vous avez proposé ${libelle} par la Direction Générale.</p>
             ${motif ? `<p><em>Motif : ${motif}</em></p>` : ""}`,
            `${env.frontendUrl}${lien}`,
            "Consulter les budgets"
          ),
        })
      : Promise.resolve(),
    enregistrerNotification(proposePar.id, `Poste budgétaire ${budget.poste} — ${libelle}`, motif ?? "", lien),
  ]);
}

// F-09 : alerte spécifique en cas de dépassement ou de quasi-dépassement d'un poste budgétaire.
export async function notifierAlerteBudget(budget: BudgetAvecSuivi): Promise<void> {
  if (!budget.alerte) return;
  const destinataires = await destinatairesValideurs();
  if (destinataires.length === 0) return;

  const estDepassement = budget.alerte === "DEPASSEMENT";
  const lien = "/espace/rapports";
  const titre = `${estDepassement ? "Dépassement" : "Quasi-dépassement"} de budget — ${budget.poste}`;

  await Promise.allSettled([
    envoyerEmails(
      destinataires
        .filter((d) => d.email)
        .map((d) => ({
          to: d.email,
          subject: titre,
          html: gabaritEmail(
            estDepassement ? "Un poste budgétaire est dépassé" : "Un poste budgétaire approche de sa limite",
            `<p>Bonjour ${d.nom},</p>
             <p>Le poste budgétaire <strong>${budget.poste}</strong> (${budget.entite.libelle} — ${budget.categorie.libelle})
             a atteint <strong>${Math.round(budget.pourcentageConsomme * 100)} %</strong> du budget alloué.</p>
             <p>Budget alloué : ${FORMAT_MONTANT.format(budget.montantAlloue)} ${budget.devise}<br/>
             Réalisé : ${FORMAT_MONTANT.format(budget.realise)} ${budget.devise}<br/>
             Disponible : ${FORMAT_MONTANT.format(budget.disponible)} ${budget.devise}</p>`,
            `${env.frontendUrl}${lien}`,
            "Consulter le suivi budgétaire"
          ),
        }))
    ),
    enregistrerNotifications(
      destinataires.map((d) => d.id),
      titre,
      `${Math.round(budget.pourcentageConsomme * 100)} % du budget alloué consommé`,
      lien
    ),
  ]);
}

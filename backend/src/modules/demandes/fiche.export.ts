import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { Response } from "express";
import { StatutDemande } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { urlVerification } from "../../lib/verification";
import { formatMontantPdf } from "../../lib/formatMontantPdf";

const NAVY = "#004B9C";
const GRIS = "#666666";
const GRIS_CLAIR = "#DDDDDD";

interface DemandeFiche {
  id: string;
  numero: string;
  statut: StatutDemande;
  demandeurNom: string;
  demandeurFonction: string | null;
  demandeurEmail: string;
  demandeurTelephone: string | null;
  motif: string;
  dateLivraisonSouhaitee: Date;
  devise: string;
  montantTotal: unknown;
  creeLe: Date;
  entite: { libelle: string };
  categorie: { libelle: string };
  budgetId: string | null;
  budget: { poste: string; montantAlloue: unknown } | null;
  lignes: { libelle: string; quantite: unknown; prixUnitaire: unknown; total: unknown }[];
  signatures: { role: string; nom: string; horodatage: Date }[];
}

const LABEL_STATUT: Record<string, string> = {
  SOUMISE: "En attente de validation",
  REJETEE: "Rejetée",
  VALIDEE: "Validée",
  ANNULEE: "Annulée",
};

// F-07 : génère le PDF officiel de la fiche de demande d'achat, reproduisant la mise en page de
// la fiche papier (en-tête, tableau des articles, tableau budgétaire, cases de signature), avec
// les signatures électroniques effectivement apposées et un QR code de vérification d'authenticité.
export async function genererFichePdf(res: Response, demande: DemandeFiche) {
  let budgetSuivi: { montantAlloue: number; realise: number; disponible: number } | null = null;
  if (demande.budgetId && demande.budget) {
    const agregat = await prisma.demandeAchat.aggregate({
      where: { budgetId: demande.budgetId, statut: StatutDemande.VALIDEE },
      _sum: { montantTotal: true },
    });
    const montantAlloue = Number(demande.budget.montantAlloue);
    const realise = Number(agregat._sum.montantTotal ?? 0);
    budgetSuivi = { montantAlloue, realise, disponible: montantAlloue - realise };
  }

  const urlQr = urlVerification(demande.numero, demande.statut, env.frontendUrl);
  const qrDataUrl = await QRCode.toDataURL(urlQr, { margin: 0, width: 200 });

  const doc = new PDFDocument({ margin: 0, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${demande.numero}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const marge = 40;
  const largeurUtile = pageWidth - marge * 2;

  // --- En-tête institutionnel ---
  doc.rect(0, 0, pageWidth, 70).fill(NAVY);
  doc.fillColor("#FFFFFF").fontSize(18).font("Helvetica-Bold").text("SIM ASSURANCES", marge, 20);
  doc.fontSize(9).font("Helvetica").text("SOCIÉTÉ IVOIRIENNE DE MICRO-ASSURANCES", marge, 42);
  doc.fontSize(9).text("FICHE DE DEMANDE D'ACHAT", pageWidth - marge - 200, 20, { width: 200, align: "right" });
  doc.fontSize(14).font("Helvetica-Bold").text(demande.numero, pageWidth - marge - 200, 34, { width: 200, align: "right" });
  doc.fontSize(9).font("Helvetica").text(LABEL_STATUT[demande.statut] ?? demande.statut, pageWidth - marge - 200, 52, {
    width: 200,
    align: "right",
  });

  let y = 92;

  // --- En-tête de la fiche (CDC §7.1) ---
  doc.fillColor("#000000").fontSize(11).font("Helvetica-Bold").text("En-tête de la demande", marge, y);
  y += 18;

  const champ = (label: string, valeur: string, x: number, largeur: number) => {
    doc.fontSize(8).font("Helvetica").fillColor(GRIS).text(label.toUpperCase(), x, y, { width: largeur });
    doc.fontSize(10).font("Helvetica").fillColor("#000000").text(valeur || "—", x, y + 12, { width: largeur });
  };

  const demiLargeur = largeurUtile / 2 - 10;
  champ("Date d'établissement", demande.creeLe.toLocaleDateString("fr-FR"), marge, demiLargeur);
  champ("Date de livraison souhaitée", demande.dateLivraisonSouhaitee.toLocaleDateString("fr-FR"), marge + demiLargeur + 20, demiLargeur);
  y += 34;
  champ("Entité bénéficiaire", demande.entite.libelle, marge, demiLargeur);
  champ("Catégorie d'achat", demande.categorie.libelle, marge + demiLargeur + 20, demiLargeur);
  y += 34;
  champ(
    "Demandeur",
    `${demande.demandeurNom}${demande.demandeurFonction ? " — " + demande.demandeurFonction : ""}`,
    marge,
    largeurUtile
  );
  y += 34;
  doc.fontSize(8).font("Helvetica").fillColor(GRIS).text("MOTIF DE L'ACHAT", marge, y, { width: largeurUtile });
  doc.fontSize(10).font("Helvetica").fillColor("#000000").text(demande.motif, marge, y + 12, { width: largeurUtile });
  y += 12 + doc.heightOfString(demande.motif, { width: largeurUtile }) + 16;

  // --- Tableau des articles (CDC §7.2) ---
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000").text("Tableau des articles", marge, y);
  y += 18;

  const colonnes = [
    { titre: "Libellé", largeur: largeurUtile * 0.46 },
    { titre: "Nombre", largeur: largeurUtile * 0.14 },
    { titre: "Prix unitaire", largeur: largeurUtile * 0.2 },
    { titre: "Total", largeur: largeurUtile * 0.2 },
  ];

  const ligneEntete = (titres: { titre: string; largeur: number }[], yy: number, hauteur: number, fond: string, couleurTexte: string) => {
    let x = marge;
    doc.rect(marge, yy, largeurUtile, hauteur).fill(fond);
    doc.fillColor(couleurTexte).fontSize(9).font("Helvetica-Bold");
    titres.forEach((c) => {
      doc.text(c.titre, x + 6, yy + hauteur / 2 - 5, { width: c.largeur - 12 });
      x += c.largeur;
    });
  };

  ligneEntete(colonnes, y, 22, NAVY, "#FFFFFF");
  y += 22;

  doc.font("Helvetica").fontSize(9).fillColor("#000000");
  demande.lignes.forEach((ligne, index) => {
    const hauteur = 20;
    if (index % 2 === 1) doc.rect(marge, y, largeurUtile, hauteur).fill("#F4F6F9");
    doc.fillColor("#000000");
    let x = marge;
    const valeurs = [
      ligne.libelle,
      String(ligne.quantite),
      formatMontantPdf(Number(ligne.prixUnitaire)),
      formatMontantPdf(Number(ligne.total)),
    ];
    valeurs.forEach((v, i) => {
      doc.text(v, x + 6, y + 6, { width: colonnes[i].largeur - 12 });
      x += colonnes[i].largeur;
    });
    doc.rect(marge, y, largeurUtile, hauteur).stroke(GRIS_CLAIR);
    y += hauteur;
  });

  doc.rect(marge, y, largeurUtile, 22).fill(NAVY);
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
  doc.text("TOTAL GÉNÉRAL", marge + 6, y + 6, { width: colonnes[0].largeur + colonnes[1].largeur - 12 });
  doc.text(`${formatMontantPdf(Number(demande.montantTotal))} ${demande.devise}`, marge + colonnes[0].largeur + colonnes[1].largeur + colonnes[2].largeur + 6, y + 6, {
    width: colonnes[3].largeur - 12,
  });
  y += 34;

  // --- Tableau budgétaire (CDC §7.3) ---
  if (budgetSuivi && demande.budget) {
    doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000").text("Tableau budgétaire", marge, y);
    y += 18;

    const colBudget = [
      { titre: "Poste", largeur: largeurUtile * 0.34 },
      { titre: "Budget", largeur: largeurUtile * 0.22 },
      { titre: "Réalisé", largeur: largeurUtile * 0.22 },
      { titre: "Disponible", largeur: largeurUtile * 0.22 },
    ];
    ligneEntete(colBudget, y, 22, NAVY, "#FFFFFF");
    y += 22;

    doc.rect(marge, y, largeurUtile, 20).stroke(GRIS_CLAIR);
    doc.font("Helvetica").fontSize(9).fillColor("#000000");
    let x = marge;
    const valeursBudget = [
      demande.budget.poste,
      formatMontantPdf(budgetSuivi.montantAlloue),
      formatMontantPdf(budgetSuivi.realise),
      formatMontantPdf(budgetSuivi.disponible),
    ];
    valeursBudget.forEach((v, i) => {
      doc.text(v, x + 6, y + 6, { width: colBudget[i].largeur - 12 });
      x += colBudget[i].largeur;
    });
    y += 34;
  }

  // --- Cases de signature (CDC §7.4) ---
  const hauteurSignatures = 70;
  if (y + hauteurSignatures + 90 > doc.page.height) {
    doc.addPage();
    y = marge;
  } else {
    y = Math.max(y, doc.page.height - 180);
  }

  doc.fontSize(11).font("Helvetica-Bold").fillColor("#000000").text("Signatures", marge, y);
  y += 18;

  const cases = [
    { role: "DEMANDEUR", label: "Date et visa du Demandeur" },
    { role: "DIRECTEUR_COMMERCIAL", label: "Date et visa du Directeur Commercial" },
    { role: "RH", label: "Date et visa du Responsable Comptable Financier RH" },
    { role: "DG", label: "Date et visa du Directeur Général" },
  ];
  const largeurCase = largeurUtile / 4 - 9;

  cases.forEach((c, i) => {
    const x = marge + i * (largeurCase + 12);
    doc.rect(x, y, largeurCase, hauteurSignatures).stroke(GRIS_CLAIR);
    doc.fontSize(7).font("Helvetica").fillColor(GRIS).text(c.label, x + 6, y + 6, { width: largeurCase - 12 });

    const signature = demande.signatures.find((s) => s.role === c.role);
    if (signature) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor(NAVY).text(signature.nom, x + 6, y + 32, { width: largeurCase - 12 });
      doc
        .fontSize(7)
        .font("Helvetica")
        .fillColor(GRIS)
        .text(signature.horodatage.toLocaleString("fr-FR"), x + 6, y + 46, { width: largeurCase - 12 });
    } else if (c.role === "DIRECTEUR_COMMERCIAL") {
      doc.fontSize(7).font("Helvetica-Oblique").fillColor(GRIS).text("(case informative — hors circuit de validation)", x + 6, y + 32, {
        width: largeurCase - 12,
      });
    } else {
      doc.fontSize(8).font("Helvetica-Oblique").fillColor(GRIS_CLAIR).text("En attente", x + 6, y + 32, { width: largeurCase - 12 });
    }
  });
  y += hauteurSignatures + 16;

  // --- Pied de page : numéro et QR code de vérification ---
  const yPied = doc.page.height - 70;
  doc.image(qrDataUrl, marge, yPied - 10, { width: 56, height: 56 });
  doc.fontSize(7).font("Helvetica").fillColor(GRIS).text(
    `Document généré automatiquement par SIM ASSURANCES — Demande ${demande.numero}\nScannez le code pour vérifier l'authenticité de ce document.`,
    marge + 66,
    yPied + 6,
    { width: largeurUtile - 66 }
  );

  doc.end();
}

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { Response } from "express";
import { construireTableauDeBord } from "./rapports.service";
import { formatMontantPdf } from "../../lib/formatMontantPdf";

type TableauDeBord = Awaited<ReturnType<typeof construireTableauDeBord>>;


export async function genererClasseurExcel(tableau: TableauDeBord, sousTitre: string): Promise<ExcelJS.Buffer> {
  const classeur = new ExcelJS.Workbook();
  classeur.creator = "SIM ASSURANCES";
  classeur.created = new Date();

  const synthese = classeur.addWorksheet("Synthèse");
  synthese.columns = [{ width: 32 }, { width: 20 }];
  synthese.addRow(["Rapport des demandes d'achat validées", ""]);
  synthese.getRow(1).font = { bold: true, size: 14 };
  synthese.addRow([sousTitre, ""]);
  synthese.addRow([]);
  synthese.addRow(["Nombre de demandes", tableau.nombreDemandes]);
  synthese.addRow(["Montant total", tableau.totalGeneral]);

  const feuille = (nom: string, colonnes: { header: string; key: string; width?: number }[]) => {
    const ws = classeur.addWorksheet(nom);
    ws.columns = colonnes;
    ws.getRow(1).font = { bold: true };
    return ws;
  };

  const wsCategorie = feuille("Par catégorie", [
    { header: "Catégorie", key: "libelle", width: 30 },
    { header: "Nombre de demandes", key: "nombre", width: 20 },
    { header: "Montant total", key: "total", width: 20 },
  ]);
  tableau.parCategorie.forEach((l) => wsCategorie.addRow(l));

  const wsEntite = feuille("Par entité", [
    { header: "Entité", key: "libelle", width: 30 },
    { header: "Nombre de demandes", key: "nombre", width: 20 },
    { header: "Montant total", key: "total", width: 20 },
  ]);
  tableau.parEntite.forEach((l) => wsEntite.addRow(l));

  const wsPeriode = feuille("Par période", [
    { header: "Période", key: "periode", width: 20 },
    { header: "Nombre de demandes", key: "nombre", width: 20 },
    { header: "Montant total", key: "total", width: 20 },
  ]);
  tableau.parPeriode.forEach((l) => wsPeriode.addRow(l));

  const wsDetail = feuille("Détail des demandes", [
    { header: "Numéro", key: "numero", width: 18 },
    { header: "Demandeur", key: "demandeurNom", width: 26 },
    { header: "Entité", key: "entite", width: 24 },
    { header: "Catégorie", key: "categorie", width: 24 },
    { header: "Montant", key: "montantTotal", width: 16 },
    { header: "Statut", key: "statut", width: 14 },
    { header: "Date de validation", key: "valideLe", width: 20 },
  ]);
  tableau.demandes.forEach((d) =>
    wsDetail.addRow({ ...d, valideLe: d.valideLe ? new Date(d.valideLe).toLocaleDateString("fr-FR") : "" })
  );

  return classeur.xlsx.writeBuffer();
}

// Export PDF du rapport (F-06) — synthèse tabulaire, distincte de la fiche officielle (F-07).
export function genererPdfRapport(res: Response, tableau: TableauDeBord, sousTitre: string) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  doc.fontSize(16).fillColor("#004B9C").text("SIM ASSURANCES — Rapport des demandes d'achat validées", { align: "left" });
  doc.fontSize(10).fillColor("#444444").text(sousTitre);
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor("#000000");
  doc.text(`Nombre de demandes : ${tableau.nombreDemandes}`);
  doc.text(`Montant total : ${formatMontantPdf(tableau.totalGeneral)} XOF`);
  doc.moveDown();

  const tableauSection = (titre: string, lignes: { libelle: string; nombre: number; total: number }[]) => {
    doc.fontSize(13).fillColor("#004B9C").text(titre);
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#000000");
    lignes.forEach((l) => {
      doc.text(`${l.libelle}  —  ${l.nombre} demande(s)  —  ${formatMontantPdf(l.total)} XOF`);
    });
    if (lignes.length === 0) doc.text("Aucune donnée pour cette sélection.");
    doc.moveDown();
  };

  tableauSection("Répartition par catégorie", tableau.parCategorie);
  tableauSection("Répartition par entité", tableau.parEntite);

  doc.fontSize(13).fillColor("#004B9C").text("Répartition par période");
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#000000");
  tableau.parPeriode.forEach((l) => {
    doc.text(`${l.periode}  —  ${l.nombre} demande(s)  —  ${formatMontantPdf(l.total)} XOF`);
  });
  if (tableau.parPeriode.length === 0) doc.text("Aucune donnée pour cette sélection.");

  doc.end();
}

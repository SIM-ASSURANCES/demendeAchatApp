import { Router } from "express";
import { z } from "zod";
import { authentifier, autoriser } from "../../middleware/auth.middleware";
import { calculerBudgetsAvecSuivi } from "../../lib/budgetCalcul";
import { construireTableauDeBord, FiltresRapport, Granularite } from "./rapports.service";
import { genererClasseurExcel, genererPdfRapport } from "./rapports.export";

export const rapportsRouter = Router();

// F-06 : consultation réservée aux espaces privés RH/DG/Admin.
rapportsRouter.use(authentifier, autoriser("RH", "DG", "ADMIN"));

const filtresSchema = z.object({
  dateDebut: z.coerce.date().optional(),
  dateFin: z.coerce.date().optional(),
  entiteId: z.string().uuid().optional(),
  categorieId: z.string().uuid().optional(),
  granularite: z
    .enum(["jour", "semaine", "mois", "trimestre", "annee", "personnalisee"])
    .default("mois"),
  inclureAnnulees: z.coerce.boolean().optional(),
});

function extraireFiltres(query: unknown) {
  const parsed = filtresSchema.safeParse(query);
  if (!parsed.success) return null;
  const { granularite, ...filtres } = parsed.data;
  return { filtres: filtres as FiltresRapport, granularite: granularite as Granularite };
}

function libelleFiltres(filtres: FiltresRapport, granularite: Granularite): string {
  const bornes =
    filtres.dateDebut || filtres.dateFin
      ? `Période du ${filtres.dateDebut ? filtres.dateDebut.toLocaleDateString("fr-FR") : "…"} au ${
          filtres.dateFin ? filtres.dateFin.toLocaleDateString("fr-FR") : "…"
        }`
      : "Toutes périodes";
  return `${bornes} — granularité : ${granularite}${filtres.inclureAnnulees ? " — annulées incluses à titre indicatif" : ""}`;
}

// Tableau de bord : totaux, répartition par catégorie/entité/période (F-06).
rapportsRouter.get("/tableau-bord", async (req, res) => {
  const extrait = extraireFiltres(req.query);
  if (!extrait) return res.status(400).json({ message: "Filtres invalides." });
  const tableau = await construireTableauDeBord(extrait.filtres, extrait.granularite);
  res.json(tableau);
});

// Suivi budgétaire avec alertes de dépassement / quasi-dépassement (RG-10, F-06, F-09).
rapportsRouter.get("/budgets", async (_req, res) => {
  res.json(await calculerBudgetsAvecSuivi());
});

rapportsRouter.get("/export.xlsx", async (req, res) => {
  const extrait = extraireFiltres(req.query);
  if (!extrait) return res.status(400).json({ message: "Filtres invalides." });
  const tableau = await construireTableauDeBord(extrait.filtres, extrait.granularite);
  const buffer = await genererClasseurExcel(tableau, libelleFiltres(extrait.filtres, extrait.granularite));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="rapport-demandes-achat.xlsx"`);
  res.send(Buffer.from(buffer));
});

rapportsRouter.get("/export.pdf", async (req, res) => {
  const extrait = extraireFiltres(req.query);
  if (!extrait) return res.status(400).json({ message: "Filtres invalides." });
  const tableau = await construireTableauDeBord(extrait.filtres, extrait.granularite);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="rapport-demandes-achat.pdf"`);
  genererPdfRapport(res, tableau, libelleFiltres(extrait.filtres, extrait.granularite));
});

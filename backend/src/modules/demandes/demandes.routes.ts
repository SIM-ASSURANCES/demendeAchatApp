import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { Devise, StatutDemande } from "@prisma/client";
import { authentifier, autoriser } from "../../middleware/auth.middleware";
import { uploadPieceJointe } from "../uploads/uploads.middleware";
import { prisma } from "../../lib/prisma";
import { consignerAudit } from "../../lib/audit";
import {
  creerDemande,
  obtenirParToken,
  modifierDemandeParToken,
  supprimerDemandeParToken,
  listerDemandes,
  obtenirDetail,
  validerDemande,
  rejeterDemande,
  annulerDemande,
} from "./demandes.service";
import { genererFichePdf } from "./fiche.export";
import { verifierCode } from "../../lib/verification";

export const demandesRouter = Router();

// F-01 / F-16 : limitation du taux de soumission du formulaire public, accessible sans authentification.
const soumissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Trop de demandes soumises depuis cette adresse. Réessayez plus tard." },
});

const ligneSchema = z.object({
  libelle: z.string().min(1).max(200),
  quantite: z.coerce.number().positive(),
  prixUnitaire: z.coerce.number().nonnegative(),
});

const creationSchema = z.object({
  demandeurNom: z.string().min(1).max(160),
  demandeurFonction: z.string().max(120).optional(),
  demandeurEmail: z.string().email(),
  demandeurTelephone: z.string().max(40).optional(),
  entiteId: z.string().uuid(),
  motif: z.string().min(1).max(2000),
  dateLivraisonSouhaitee: z.coerce.date(),
  categorieId: z.string().uuid(),
  budgetId: z.string().uuid().optional(),
  devise: z.nativeEnum(Devise).optional(),
  tauxChange: z.coerce.number().positive().optional(),
  lignes: z.array(ligneSchema).min(1),
});

// --- F-01 : formulaire public de demande d'achat ------------------------------------------------

demandesRouter.post("/", soumissionLimiter, async (req, res, next) => {
  try {
    const parsed = creationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Données invalides." });
    }
    const demande = await creerDemande(parsed.data, req.ip);
    res.status(201).json({ numero: demande.numero, lienSuiviToken: demande.lienSuiviToken });
  } catch (err) {
    next(err);
  }
});

// --- F-08 : suivi de la demande par le demandeur, via son lien personnel ------------------------

demandesRouter.get("/suivi/:token", async (req, res, next) => {
  try {
    const demande = await obtenirParToken(req.params.token);
    res.json(demande);
  } catch (err) {
    next(err);
  }
});

demandesRouter.patch("/suivi/:token", async (req, res, next) => {
  try {
    const parsed = creationSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Données invalides." });
    }
    const demande = await modifierDemandeParToken(req.params.token, parsed.data);
    res.json(demande);
  } catch (err) {
    next(err);
  }
});

demandesRouter.delete("/suivi/:token", async (req, res, next) => {
  try {
    await supprimerDemandeParToken(req.params.token);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// F-07 : fiche officielle PDF, accessible au demandeur via son lien de suivi personnel.
demandesRouter.get("/suivi/:token/fiche.pdf", async (req, res, next) => {
  try {
    const demande = await obtenirParToken(req.params.token);
    await genererFichePdf(res, demande);
  } catch (err) {
    next(err);
  }
});

// F-07 : vérification d'authenticité via le QR code imprimé sur la fiche — aucune authentification,
// et aucune donnée sensible exposée au-delà de ce qui figure déjà sur le document imprimé.
demandesRouter.get("/verifier/:numero", async (req, res, next) => {
  try {
    const code = String(req.query.code ?? "");
    const demande = await prisma.demandeAchat.findUnique({
      where: { numero: req.params.numero },
      select: { numero: true, statut: true, montantTotal: true, valideLe: true, entite: { select: { libelle: true } } },
    });

    if (!demande || !code || !verifierCode(demande.numero, demande.statut, code)) {
      return res.status(404).json({ valide: false, message: "Document non reconnu ou code de vérification invalide." });
    }

    res.json({
      valide: true,
      numero: demande.numero,
      statut: demande.statut,
      montantTotal: demande.montantTotal,
      entite: demande.entite.libelle,
      valideLe: demande.valideLe,
    });
  } catch (err) {
    next(err);
  }
});

// F-14 : pièces jointes déposées via le lien de suivi, tant que la demande n'est pas verrouillée.
demandesRouter.post(
  "/suivi/:token/pieces-jointes",
  uploadPieceJointe.single("fichier"),
  async (req, res, next) => {
    try {
      const demande = await obtenirParToken(req.params.token);
      if (demande.statut !== StatutDemande.SOUMISE) {
        return res.status(409).json({ message: "La demande n'accepte plus de nouvelles pièces jointes." });
      }
      if (!req.file) return res.status(400).json({ message: "Aucun fichier reçu." });

      const piece = await prisma.pieceJointe.create({
        data: {
          demandeId: demande.id,
          nomFichier: req.file.originalname,
          cheminFichier: req.file.filename,
          typeDocument: (req.body.typeDocument as string) ?? "Justificatif",
          tailleOctets: req.file.size,
          mimeType: req.file.mimetype,
        },
      });

      await consignerAudit({
        demandeId: demande.id,
        action: "PIECE_JOINTE_AJOUTEE",
        auteurLibelle: demande.demandeurNom,
        detail: { nomFichier: piece.nomFichier },
      });

      res.status(201).json(piece);
    } catch (err) {
      next(err);
    }
  }
);

// --- F-02 / F-13 : espaces RH et DG (authentifiés) -----------------------------------------------

const filtresSchema = z.object({
  statut: z.nativeEnum(StatutDemande).optional(),
  entiteId: z.string().uuid().optional(),
  categorieId: z.string().uuid().optional(),
  dateDebut: z.coerce.date().optional(),
  dateFin: z.coerce.date().optional(),
  montantMin: z.coerce.number().optional(),
  montantMax: z.coerce.number().optional(),
  recherche: z.string().optional(),
});

demandesRouter.get("/", authentifier, autoriser("RH", "DG", "ADMIN"), async (req, res, next) => {
  try {
    const parsed = filtresSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Filtres invalides." });
    const demandes = await listerDemandes(parsed.data);
    res.json(demandes);
  } catch (err) {
    next(err);
  }
});

demandesRouter.get("/:id", authentifier, autoriser("RH", "DG", "ADMIN"), async (req, res, next) => {
  try {
    const demande = await obtenirDetail(req.params.id);
    res.json(demande);
  } catch (err) {
    next(err);
  }
});

// F-07 : fiche officielle PDF, depuis les espaces RH/DG/Admin.
demandesRouter.get("/:id/fiche.pdf", authentifier, autoriser("RH", "DG", "ADMIN"), async (req, res, next) => {
  try {
    const demande = await obtenirDetail(req.params.id);
    await genererFichePdf(res, demande);
  } catch (err) {
    next(err);
  }
});

// RG-04 : la validation par RH ou par DG — l'un des deux suffit.
demandesRouter.post("/:id/valider", authentifier, autoriser("RH", "DG"), async (req, res, next) => {
  try {
    const demande = await validerDemande(
      req.params.id,
      { id: req.utilisateur!.sub, nom: req.utilisateur!.nom, role: req.utilisateur!.role as "RH" | "DG" },
      { ip: req.ip, sessionId: req.headers["x-session-id"] as string | undefined }
    );
    res.json(demande);
  } catch (err) {
    next(err);
  }
});

const rejetSchema = z.object({ motif: z.string().min(1).max(1000) });

demandesRouter.post("/:id/rejeter", authentifier, autoriser("RH", "DG"), async (req, res, next) => {
  try {
    const parsed = rejetSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Motif de rejet requis." });
    const demande = await rejeterDemande(req.params.id, parsed.data.motif, {
      id: req.utilisateur!.sub,
      nom: req.utilisateur!.nom,
    });
    res.json(demande);
  } catch (err) {
    next(err);
  }
});

const annulationSchema = z.object({
  categorie: z.string().min(1).max(120),
  commentaire: z.string().max(1000).optional(),
});

demandesRouter.post("/:id/annuler", authentifier, autoriser("RH", "DG"), async (req, res, next) => {
  try {
    const parsed = annulationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Motif d'annulation requis." });
    const demande = await annulerDemande(req.params.id, parsed.data, {
      id: req.utilisateur!.sub,
      nom: req.utilisateur!.nom,
    });
    res.json(demande);
  } catch (err) {
    next(err);
  }
});

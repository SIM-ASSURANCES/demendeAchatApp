-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RH', 'DG', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('SOUMISE', 'REJETEE', 'VALIDEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "RoleSignataire" AS ENUM ('DEMANDEUR', 'RH', 'DG');

-- CreateEnum
CREATE TYPE "Devise" AS ENUM ('XOF', 'USD', 'EUR');

-- CreateTable
CREATE TABLE "utilisateurs" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "identifiant" TEXT NOT NULL,
    "motDePasseHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "totpSecret" TEXT,
    "totpActif" BOOLEAN NOT NULL DEFAULT false,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creeParId" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entites" (
    "id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creeParId" TEXT,

    CONSTRAINT "entites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "poste" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "periodeDebut" TIMESTAMP(3) NOT NULL,
    "periodeFin" TIMESTAMP(3) NOT NULL,
    "montantAlloue" DECIMAL(14,2) NOT NULL,
    "devise" "Devise" NOT NULL DEFAULT 'XOF',
    "observations" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandes_achat" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "demandeurNom" TEXT NOT NULL,
    "demandeurFonction" TEXT,
    "demandeurEmail" TEXT NOT NULL,
    "demandeurTelephone" TEXT,
    "lienSuiviToken" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "dateLivraisonSouhaitee" TIMESTAMP(3) NOT NULL,
    "categorieId" TEXT NOT NULL,
    "budgetId" TEXT,
    "devise" "Devise" NOT NULL DEFAULT 'XOF',
    "tauxChange" DECIMAL(12,6),
    "montantTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "statut" "StatutDemande" NOT NULL DEFAULT 'SOUMISE',
    "motifRejet" TEXT,
    "rejeteLe" TIMESTAMP(3),
    "valideLe" TIMESTAMP(3),
    "valideParId" TEXT,
    "annuleLe" TIMESTAMP(3),
    "annuleParId" TEXT,
    "motifAnnulationCategorie" TEXT,
    "motifAnnulationCommentaire" TEXT,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "majLe" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandes_achat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lignes_article" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "quantite" DECIMAL(10,2) NOT NULL,
    "prixUnitaire" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lignes_article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "role" "RoleSignataire" NOT NULL,
    "nom" TEXT NOT NULL,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utilisateurId" TEXT,
    "adresseIp" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_jointes" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "cheminFichier" TEXT NOT NULL,
    "typeDocument" TEXT NOT NULL,
    "tailleOctets" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "deposeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_jointes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_audit" (
    "id" TEXT NOT NULL,
    "demandeId" TEXT,
    "action" TEXT NOT NULL,
    "auteurId" TEXT,
    "auteurLibelle" TEXT NOT NULL,
    "detail" JSONB,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_identifiant_key" ON "utilisateurs"("identifiant");

-- CreateIndex
CREATE UNIQUE INDEX "categories_libelle_key" ON "categories"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "entites_libelle_key" ON "entites"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_achat_numero_key" ON "demandes_achat"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "demandes_achat_lienSuiviToken_key" ON "demandes_achat"("lienSuiviToken");

-- CreateIndex
CREATE INDEX "demandes_achat_statut_idx" ON "demandes_achat"("statut");

-- CreateIndex
CREATE INDEX "demandes_achat_entiteId_idx" ON "demandes_achat"("entiteId");

-- CreateIndex
CREATE INDEX "demandes_achat_categorieId_idx" ON "demandes_achat"("categorieId");

-- CreateIndex
CREATE INDEX "journal_audit_demandeId_idx" ON "journal_audit"("demandeId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entites" ADD CONSTRAINT "entites_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "entites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_achat" ADD CONSTRAINT "demandes_achat_entiteId_fkey" FOREIGN KEY ("entiteId") REFERENCES "entites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_achat" ADD CONSTRAINT "demandes_achat_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_achat" ADD CONSTRAINT "demandes_achat_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_achat" ADD CONSTRAINT "demandes_achat_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandes_achat" ADD CONSTRAINT "demandes_achat_annuleParId_fkey" FOREIGN KEY ("annuleParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lignes_article" ADD CONSTRAINT "lignes_article_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_achat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_achat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes" ADD CONSTRAINT "pieces_jointes_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_achat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_demandeId_fkey" FOREIGN KEY ("demandeId") REFERENCES "demandes_achat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

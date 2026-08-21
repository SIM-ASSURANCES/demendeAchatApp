-- CreateEnum
CREATE TYPE "StatutBudget" AS ENUM ('EN_ATTENTE_VALIDATION', 'VALIDE', 'REJETE');

-- AlterTable
ALTER TABLE "budgets"
  ADD COLUMN "statut" "StatutBudget" NOT NULL DEFAULT 'EN_ATTENTE_VALIDATION',
  ADD COLUMN "proposeParId" TEXT,
  ADD COLUMN "valideParId" TEXT,
  ADD COLUMN "valideLe" TIMESTAMP(3),
  ADD COLUMN "rejeteParId" TEXT,
  ADD COLUMN "motifRejet" TEXT,
  ADD COLUMN "rejeteLe" TIMESTAMP(3);

-- Backfill : les postes budgétaires déjà en place avant ce changement sont considérés validés,
-- pour ne pas interrompre le suivi budgétaire ou le formulaire public en cours d'utilisation.
UPDATE "budgets" SET "statut" = 'VALIDE';

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_proposeParId_fkey" FOREIGN KEY ("proposeParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_rejeteParId_fkey" FOREIGN KEY ("rejeteParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

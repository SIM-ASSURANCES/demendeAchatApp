-- AlterTable
ALTER TABLE "demandes_achat" ADD COLUMN "montantTotalXOF" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Backfill : les demandes existantes sont toutes en XOF, le montant consolidé est donc identique.
UPDATE "demandes_achat" SET "montantTotalXOF" = "montantTotal";

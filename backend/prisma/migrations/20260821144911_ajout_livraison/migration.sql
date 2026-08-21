-- AlterTable
ALTER TABLE "demandes_achat" ADD COLUMN "livreLe" TIMESTAMP(3),
ADD COLUMN "livreParId" TEXT;

-- AddForeignKey
ALTER TABLE "demandes_achat" ADD CONSTRAINT "demandes_achat_livreParId_fkey" FOREIGN KEY ("livreParId") REFERENCES "utilisateurs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

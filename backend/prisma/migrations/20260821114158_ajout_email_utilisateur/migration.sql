-- AlterTable
ALTER TABLE "utilisateurs" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "utilisateurs_email_key" ON "utilisateurs"("email");

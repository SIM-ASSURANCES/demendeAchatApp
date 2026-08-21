import { prisma } from "./prisma";

// Journal d'audit inaltérable (F-10, RG-12) — écriture seule, jamais modifié ni purgé.
export async function consignerAudit(params: {
  demandeId?: string;
  action: string;
  auteurId?: string;
  auteurLibelle: string;
  detail?: Record<string, unknown>;
}) {
  await prisma.journalAudit.create({
    data: {
      demandeId: params.demandeId,
      action: params.action,
      auteurId: params.auteurId,
      auteurLibelle: params.auteurLibelle,
      detail: params.detail as any,
    },
  });
}

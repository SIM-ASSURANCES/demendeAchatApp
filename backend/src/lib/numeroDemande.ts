import { prisma } from "./prisma";

// Format RG-02 : DA-AAAA-NNNNN (ex. DA-2026-00123), séquence par année.
export async function genererNumeroDemande(): Promise<string> {
  const annee = new Date().getFullYear();
  const prefixe = `DA-${annee}-`;

  const derniere = await prisma.demandeAchat.findFirst({
    where: { numero: { startsWith: prefixe } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });

  const dernierIndex = derniere ? Number(derniere.numero.slice(prefixe.length)) : 0;
  const prochainIndex = dernierIndex + 1;

  return `${prefixe}${String(prochainIndex).padStart(5, "0")}`;
}

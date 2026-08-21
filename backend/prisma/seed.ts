import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const motDePasseHash = await bcrypt.hash("ChangezMoi#2026", 12);

  await prisma.utilisateur.upsert({
    where: { identifiant: "admin" },
    update: {},
    create: {
      nom: "Administrateur SIM ASSURANCES",
      identifiant: "admin",
      email: "admin@sim-assurances.example",
      motDePasseHash,
      role: "ADMIN",
    },
  });

  const categories = [
    "Fournitures de bureau",
    "Informatique / Logiciels",
    "Services",
    "Équipement",
    "Maintenance",
    "Assurance",
    "Autre",
  ];
  for (const libelle of categories) {
    await prisma.categorie.upsert({ where: { libelle }, update: {}, create: { libelle } });
  }

  await prisma.entite.upsert({
    where: { libelle: "Siège SIM ASSURANCES" },
    update: {},
    create: { libelle: "Siège SIM ASSURANCES" },
  });

  console.log("Données de référence initialisées.");
  console.log("Compte administrateur : identifiant=admin, mot de passe=ChangezMoi#2026 (à changer immédiatement).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// En production, le compte administrateur initial est piloté par variables d'environnement
// (SUPER_ADMIN_*, convention déjà utilisée sur les autres services SIM ASSURANCES) plutôt que par
// un identifiant/mot de passe fixe en dur — évite de déployer avec des identifiants connus.
// Idempotent (upsert avec update: {}) : ne réécrit jamais un admin déjà présent, donc peut être
// rejoué sans risque à chaque démarrage du conteneur.
const ADMIN_NOM = process.env.SUPER_ADMIN_NOM ?? "Administrateur SIM ASSURANCES";
const ADMIN_IDENTIFIANT = process.env.SUPER_ADMIN_IDENTIFIANT ?? "admin";
const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "admin@sim-assurances.example";
const ADMIN_MOT_DE_PASSE = process.env.SUPER_ADMIN_PASSWORD ?? "ChangezMoi#2026";

async function main() {
  const motDePasseHash = await bcrypt.hash(ADMIN_MOT_DE_PASSE, 12);

  await prisma.utilisateur.upsert({
    where: { identifiant: ADMIN_IDENTIFIANT },
    update: {},
    create: {
      nom: ADMIN_NOM,
      identifiant: ADMIN_IDENTIFIANT,
      email: ADMIN_EMAIL,
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
  if (!process.env.SUPER_ADMIN_PASSWORD) {
    console.log(`Compte administrateur : identifiant=${ADMIN_IDENTIFIANT}, mot de passe=${ADMIN_MOT_DE_PASSE} (à changer immédiatement).`);
  } else {
    console.log(`Compte administrateur initialisé : identifiant=${ADMIN_IDENTIFIANT}.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

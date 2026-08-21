# Demande d'Achat — SIM ASSURANCES

Application de gestion des demandes d'achat (voir [Cahier_des_charges_Demande_Achat_SIM_ASSURANCES.docx](Cahier_des_charges_Demande_Achat_SIM_ASSURANCES.docx) et [Plan_de_developpement_Demande_Achat_SIM_ASSURANCES.docx](Plan_de_developpement_Demande_Achat_SIM_ASSURANCES.docx)).

## Structure

- `backend/` — API Node.js/TypeScript/Express/Prisma/PostgreSQL
- `frontend/` — Application React/Vite/TypeScript/Tailwind

## Démarrage local

```bash
# 1. Base de données PostgreSQL (isolée, port 5434 pour éviter les conflits locaux)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev        # http://localhost:4100

# 3. Frontend (dans un autre terminal)
cd frontend
cp .env.example .env
npm install
npm run dev         # http://localhost:5183
```

Compte administrateur créé par le seed : identifiant `admin`, mot de passe `ChangezMoi#2026` — **à changer immédiatement**.

## État d'avancement (voir le plan de développement)

Réalisé (Sprint 0/1, et parties des Sprints 2 à 7) :
- Authentification RH/DG/Admin, RBAC (F-02, F-12)
- Formulaire public de demande + suivi par lien (F-01, F-08, F-14, RG-01 à RG-03), avec sélection du
  poste budgétaire concerné (nécessaire au rattachement du suivi Budget/Réalisé/Disponible)
- Espaces RH/DG : liste, filtres, détail (F-02, F-13)
- Workflow : validation, rejet, signature électronique automatique, verrouillage (F-03, F-04, RG-04 à RG-09)
- Annulation sans suppression (F-05, RG-07)
- Journal d'audit inaltérable (F-10, RG-12)
- Administration de base : catégories, entités, comptes (F-11, F-12)
- **Module de comptabilité et reporting (F-06)** : tableau de bord `/espace/rapports` (RH/DG/Admin)
  ventilé par catégorie, entité et période (jour/semaine/mois/trimestre/année/personnalisée),
  graphiques (histogramme d'évolution, camembert par catégorie, répartition par entité), suivi
  Budget/Réalisé/Disponible mis à jour automatiquement à chaque validation (RG-10), alertes de
  quasi-dépassement (≥90 % du budget alloué) et de dépassement, exclusion des demandes annulées par
  défaut avec option d'inclusion à titre indicatif (RG-11), exports Excel (`exceljs`) et PDF
  (`pdfkit`) du rapport filtré

Restant à développer (voir §7.6, §7.7 et §7.9 du plan) :
- Génération PDF de la fiche officielle + QR code (F-07) — distincte de l'export de rapport déjà en place
- Notifications email effectives (F-09 — actuellement consignées en audit mais non envoyées), y
  compris l'alerte automatique de dépassement budgétaire par email
- Gestion multi-devises complète (F-15) — le champ existe en base, la conversion n'est pas appliquée
- Authentification à deux facteurs, durcissement sécurité (F-16, section 10)
- Interface d'administration des postes budgétaires (l'API existe déjà : `POST/PATCH /api/budgets`)

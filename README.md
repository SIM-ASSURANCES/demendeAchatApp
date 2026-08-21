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

## Charte graphique

Le design applique la charte graphique officielle SIM ASSURANCES (`DOC SIMAS/CHARTE GRAPHIQUE SIM ASSURANCE CI.pdf`) :
- Bleu institutionnel `#004B9C` (Pantone 004B9C) et bleu clair `#51AEE2` (Pantone 51AEE2)
- Police **Montserrat** (communication institutionnelle et commerciale, chargée via Google Fonts)
- Logotype (`frontend/public/logosim.webp`, version blanche pour fonds colorés) et favicon (`frontend/public/favicon.png`)
- Espaces privés (RH/DG/Admin) : en-tête bleu institutionnel avec logo, identité de l'utilisateur connecté
  et avatar ; barre latérale groupée par section (Demandes, Pilotage, Administration) avec icônes
  (`lucide-react`), état actif, et bouton de réduction — voir [PrivateLayout.tsx](frontend/src/components/PrivateLayout.tsx)

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
- **Génération de la fiche officielle (F-07)** : PDF (`pdfkit`) reproduisant la mise en page de la
  fiche papier (en-tête, tableau des articles, tableau budgétaire, quatre cases de signature dont
  « Directeur Commercial » en case informative), avec les signatures électroniques effectivement
  apposées ; téléchargeable depuis l'espace RH/DG (`GET /api/demandes/:id/fiche.pdf`) et depuis le
  lien de suivi public (`GET /api/demandes/suivi/:token/fiche.pdf`), quel que soit le statut de la
  demande. QR code de vérification d'authenticité (code HMAC dérivé du numéro et du statut, non
  falsifiable sans le secret serveur) menant à `/verification/:numero`
- **Notifications automatiques par email (F-09)** : accusé de réception au demandeur à la
  soumission, email aux comptes RH/DG actifs dès qu'une demande attend un traitement, email au
  demandeur à chaque changement de statut (validée/rejetée/annulée), alerte aux RH/DG en cas de
  quasi-dépassement ou de dépassement d'un poste budgétaire rattaché. Un échec d'envoi est
  journalisé mais n'interrompt jamais le flux métier. Sans SMTP configuré (`SMTP_HOST` vide dans
  `.env`), les emails sont générés et journalisés en console (`[email:dev] ...`) sans envoi réseau
  réel — pratique par défaut pour développer sans compte SMTP. Nécessite un email par compte RH/DG
  (champ ajouté au modèle `Utilisateur`, requis à la création dans l'espace Admin)

Restant à développer (voir §7.9 du plan) :
- Gestion multi-devises complète (F-15) — le champ existe en base, la conversion n'est pas appliquée
- Authentification à deux facteurs, durcissement sécurité (F-16, section 10)
- Interface d'administration des postes budgétaires (l'API existe déjà : `POST/PATCH /api/budgets`)

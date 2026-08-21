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

## Écart avec le cahier des charges — RG-04 (double validation)

Le CDC (§12) laissait la question ouverte et retenait par défaut qu'**une seule validation (RH ou
DG) suffit** (RG-04). Sur demande explicite, l'application implémente désormais une **double
validation obligatoire** : une demande ne devient « Validée » (verrouillée, comptabilisée) que
lorsque le RH ET le DG ont chacun validé depuis leur espace. Entre les deux, elle passe par un
statut intermédiaire `EN_ATTENTE_SECONDE_VALIDATION` :
- chaque rôle ne peut valider qu'une fois (409 en cas de nouvelle tentative) ;
- le rejet reste possible par l'un ou l'autre tant que la double validation n'est pas complète ;
- le suivi budgétaire (RG-10) et le reporting (F-06) ne comptent la demande qu'une fois les deux
  signatures obtenues (statut `VALIDEE`) ;
- notifications dédiées (F-09) : le demandeur est informé dès la première validation, et le
  second valideur reçoit un email ciblé l'invitant à se prononcer.

**Confirmation de livraison** (hors CDC, ajout demandé) : une fois la demande `VALIDEE`, le RH
dispose d'un bouton « Confirmer la livraison » (`POST /api/demandes/:id/livrer`, réservé au RH)
qui horodate la réception effective des articles (`livreLe` / `livreParId`). N'affecte pas le
statut d'approbation — c'est une information de suivi logistique distincte, visible par tous
(espace RH/DG et page de suivi du demandeur), avec notification email au demandeur.

**Paramétrage des budgets** (le CDC confiait le F-11 à l'Admin seul ; sur demande explicite, le
paramétrage des postes budgétaires passe désormais par RH et DG) : le RH propose un poste
budgétaire (`POST /api/budgets`, réservé au RH) depuis `/espace/budgets` ;
il reste `EN_ATTENTE_VALIDATION` — non sélectionnable dans le formulaire public, non compté dans le
suivi — jusqu'à ce que le DG le valide ou le rejette (`POST /api/budgets/:id/valider|rejeter`,
réservé au DG, motif obligatoire pour le rejet). L'Admin conserve une vue de consultation (lecture
seule) et la correction administrative via `PATCH /api/budgets/:id`. Notifications dédiées (F-09) :
le DG est alerté à chaque proposition, le RH proposeur est informé de la décision.

**Le [Plan de développement](Plan_de_developpement_Demande_Achat_SIM_ASSURANCES.docx) livré
mentionne encore l'ancienne règle (RG-04, validation unique, et F-11 confié à l'Admin seul) — il
n'a pas été régénéré suite à ces changements.**

## État d'avancement (voir le plan de développement)

Réalisé (Sprint 0/1, et parties des Sprints 2 à 7) :
- Authentification RH/DG/Admin, RBAC (F-02, F-12)
- Formulaire public de demande + suivi par lien ou par numéro de demande (F-01, F-08, F-14,
  RG-01 à RG-03) — la recherche par numéro exige aussi l'email du demandeur (`GET
  /api/demandes/rechercher`, limité à 10 tentatives / 15 min) car les numéros sont séquentiels et
  donc devinables ; avec sélection du
  poste budgétaire concerné (nécessaire au rattachement du suivi Budget/Réalisé/Disponible)
- Espaces RH/DG : liste, filtres, détail (F-02, F-13)
- Workflow : validation, rejet, signature électronique automatique, verrouillage (F-03, F-04, RG-05 à RG-09)
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
- **Gestion multi-devises (F-15)** : saisie en XOF, USD ou EUR sur le formulaire public, avec taux
  de change de référence obligatoire dès qu'une devise autre que le XOF est choisie. Consolidation
  automatique en XOF (`montantTotalXOF`, devise de référence) pour le suivi budgétaire (RG-10) et le
  reporting (F-06), qui ne peuvent additionner des montants de devises différentes ; la fiche
  officielle (F-07) affiche le montant dans sa devise d'origine avec l'équivalent XOF en note
- **Centre de notifications in-app** : nouveau modèle `Notification` (destinataire, titre, message,
  lien, lu/non lu) alimenté aux mêmes événements que les emails F-09 (nouvelle demande à traiter,
  seconde validation requise, alerte de (quasi-)dépassement budgétaire, nouveau poste budgétaire à
  valider, décision du DG sur une proposition RH) — l'Admin n'en reçoit aucune, rien ne lui revient
  à valider. La cloche de l'en-tête privé affiche un badge rouge (`GET
  /api/notifications/compteur`, rafraîchi toutes les 30 s) ; un clic ouvre un panneau listant les
  dernières non lues (`GET /api/notifications`) et les marque aussitôt comme lues en arrière-plan
  (`POST /api/notifications/marquer-lues`) — elles restent visibles le temps de cette consultation,
  mais ne réapparaissent plus à la prochaine ouverture ni dans le compteur.

Restant à développer (voir §7.9 du plan) :
- Authentification à deux facteurs, durcissement sécurité (F-16, section 10)

# Solid'Pilot — Roadmap des PR

Plan de construction par petites PR autonomes (une PR = un sujet), de l'urgent
vers l'amélioration. Inspiré de l'approche « plateforme auto-administrable »
observée sur OrthoPilot : administration intégrée, droits explicites (RBAC),
traçabilité systématique, interface honnête (« Bientôt » plutôt que boutons
morts), roadmap participative.

Objectif : adoption de Solid'Pilot par YCID pour tous ses projets futurs,
avec toutes les associations partenaires.

---

## 🔴 Phase 0 — Urgences sécurité & bugs visibles

### PR 1 — Sécurité : verrouille l'escalade de privilèges et les tables sans RLS
- Trigger interdisant de modifier `profiles.is_platform_admin` (sauf admin).
- Activation du RLS sur `validation_rules` et `budget_categories` (oubliées).
- Durcissement des policies trop permissives : upload de documents, mesures
  d'indicateurs, création d'organisations, lecture des validations —
  réservés aux membres du projet concerné.
- Validation du paramètre `next` du callback OAuth (chemins internes only).

### PR 2 — Ferme l'inscription publique (mode invitation)
- Retrait du formulaire « Créer un compte » ; message « accès sur invitation ».
- Désactivation du signup ouvert côté Supabase (réglage dashboard).
- Les comptes seront créés depuis l'écran Utilisateurs (PR 6).

### PR 3 — Supprime les boutons morts et le faux import
- « Nouveau projet » et « Nouvelle organisation » : badge « Bientôt »
  en attendant les PR CRUD (8-9).
- Import CSV : l'aperçu reste, le faux message de succès disparaît
  (l'enregistrement réel arrive en PR 10).

### PR 4 — Gestion d'erreurs et exactitude des chiffres
- Pages `error.tsx` / `not-found.tsx` globales.
- Affichage explicite des erreurs de requête (fini les pages vides silencieuses).
- KPIs du dashboard calculés sur tous les projets (plus de `limit(10)`).

## 🟠 Phase 1 — Fondations produit

### PR 5 — Migrations versionnées
Consolidation de `schema.sql` + patchs RLS en migrations Supabase CLI
numérotées ; seed de démonstration séparé.

### PR 6 — Administration > Utilisateurs
Liste (recherche, filtre par rôle, badge « Vous »), invitations par email,
activation/désactivation, attribution des rôles. Réservé admins YCID/LEY.

### PR 7 — Registre de permissions + matrice Accès & rôles (RBAC)
Permissions nommées (`projets.view`, `taches.update`, `taches.reopen_terminee`,
`budget.manage`, `audit.view`, `users.manage`…) utilisées par l'UI et les
server actions ; matrice permissions × rôles affichée dans Configuration.

### PR 8 — CRUD projets & phases
Création `/projets/nouveau`, édition, organisations et membres du projet.

### PR 9 — CRUD tâches
Créer, éditer, changer statut/avancement — s'appuie sur le verrou
« tâche terminée » (double confirmation + audit) déjà en place.

### PR 10 — Import CSV réel et journalisé
Server action transactionnelle tout-ou-rien, aperçu avant validation,
journal des imports (date, type, compteurs créées/ignorées, erreurs).

## 🟡 Phase 2 — Plateforme administrable

### PR 11 — Thème centralisé
Tokens/variables CSS à la place des couleurs codées en dur (prérequis white-label).

### PR 12 — Configuration > Marque
Nom, logo, palette, email expéditeur — paramétrable par déploiement/association.

### PR 13 — Configuration > RGPD
Durées de rétention du journal d'audit (bornées, défaut), purge planifiée,
anonymisation d'un utilisateur parti, page mentions & confidentialité.

### PR 14 — Documents réels
Upload Supabase Storage avec policies par projet ; circuit de validation
des devis/factures.

### PR 15 — CRUD budget, indicateurs & COPIL
Lignes budgétaires, saisie des mesures d'impact, réunions et décisions.

## 🟢 Phase 3 — Adoption & rayonnement

### PR 16 — Dashboard v2
Périodes Jour/Semaine/Mois/Année, tendances vs période précédente,
alertes (retards, échéances proches, budget engagé).

### PR 17 — Navigation par domaines + mobile
Sidebar par sections (Pilotage / Projets / Budget / Administration),
responsive mobile, et **pied de page dynamique sur toutes les pages** :
`Solid'Pilot · Version X.Y.Z[-alpha] · Mis à jour le JJ mois AAAA, HH:MM`.
La version (tag Git) et l'horodatage sont injectés au build (variables
d'environnement `NEXT_PUBLIC_APP_VERSION` / `NEXT_PUBLIC_BUILD_TIME`),
pas codés en dur — ils changent à chaque déploiement. C'est un signal
de confiance fort pour un financeur public : le produit vit et se date.

### PR 18 — Roadmap participative & Déploiements
Voir la spécification détaillée : `docs/roadmap-feature-spec.md`.
En bref : idées d'évolution proposées par tous les utilisateurs, votables,
avec statuts / priorité / difficulté / tags ; commentaires ; section
« Gestion produit » réservée à l'admin ; onglet Déploiements (changelog
alimenté par les PR fusionnées) ; onglet Aide.

### PR 19 — Notifications
In-app + email : échéances, validations en attente, invitations.

### PR 20 — Qualité & exploitation
Tests des parcours critiques, types générés Supabase (suppression des `any`),
monitoring d'erreurs, nettoyage du Dockerfile, sauvegardes documentées.

---

**Logique d'ensemble** : les phases 0-1 rendent l'application sûre et
réellement utilisable, la phase 2 la rend administrable et conforme
(multi-associations, RGPD), la phase 3 la rend désirable (pilotage,
roadmap participative).

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

## 🔵 Phase UX — Compte, accessibilité, aide, langue (reco du 23/07/2026)

### PR 21 — Header + menu compte + page Préférences
Header global (emplacement cloche PR 19 réservé), avatar → menu déroulant
(nom/email lecture seule, rôles par projet, lien Préférences, déconnexion
séparée). Page /preferences : photo de profil (Storage, migration 0009),
informations en lecture seule, changement de mot de passe (vérification de
l'actuel, 12 caractères min, cas Google géré).

### PR 22 — Apparence & accessibilité
Bloc dans /preferences : taille de texte (Compact/Normal/Grand/Très grand),
contraste élevé, réduction des animations. Persistance localStorage.
Contraste complet dépend de la PR 11 (thème centralisé).

### PR 23 — Aide contextuelle par onglet
Page /aide (contenu porté du prototype « Aide et prise en main ») +
icône « ? » sur chaque onglet projet → modale contextuelle (extrait ciblé
+ lien « Voir toute l'aide »). Alimente aussi l'onglet Aide de la PR 18.

### PR 24 — Internationalisation FR/EN (next-intl, progressif)
Décision actée : next-intl en mode cookie (sans routage par préfixe d'URL),
sélecteur FR/EN dans le menu compte, traduction progressive (navigation et
en-têtes d'abord) — la traduction complète attend la stabilisation des CRUD.

---

**Logique d'ensemble** : les phases 0-1 rendent l'application sûre et
réellement utilisable, la phase 2 la rend administrable et conforme
(multi-associations, RGPD), la phase 3 la rend désirable (pilotage,
roadmap participative), la phase UX la rend confortable et inclusive.

## 🟣 Phase 4 — Vision multi-niveaux & IA (validée le 24/07/2026)

Décisions produit actées : validation humaine obligatoire (responsable
asso), mentions CEM & YCID par défaut, canaux v1 = LinkedIn + Facebook +
communiqué + page vitrine, 3 langues (FR/EN/AR) paramétrables,
check-list éthique avant validation, IA provider-agnostic (Kimi pour
les tests via LLM_BASE_URL/LLM_API_KEY/LLM_MODEL).

### PR 25 — Fondation LLM + Rapport d'expert IA
- lib/llm.ts : client compatible OpenAI (Kimi par défaut), configurable env
- Bouton « Rapport d'expert IA » sur la page projet : analyse complète
  (avancement, budget, indicateurs, risques, recommandations COPIL) à
  partir des seules données réelles ; copier / télécharger / imprimer

### PR 26 — Campagnes de communication IA
- Table comm_campaigns + onglet Communication (timeline ----●----○----|)
- Plan de comm généré (kickoff, fins de phase, clôture) ; contenus IA
  multi-canaux et multi-langues ; workflow proposée → validée → publiée ;
  check-list éthique ; notifications au responsable

### PR 27 — Multi-niveaux : pays & programme
- Champs programme (CEM…) sur les projets (country/zone existent déjà)
- Vue Pilotage groupée par pays — première marche vers la vue MEAE

### PR 28 — Page vitrine publique par projet
- Page publique en lecture seule (avancement, indicateurs) partageable
- Canal de publication n°1 des campagnes de communication

---

## 🟤 Phase 5 — Preuves, justificatifs et vérité budgétaire (demandé le 25/07/2026)

Demandes formulées par YCID après parcours du site côté projet. Deux
sujets distincts mais liés : **prouver** ce qui a été fait, et **fiabiliser**
les chiffres qui en découlent.

### PR 38 — Documents réels : preuves, photos avant/après, devis et factures
Reprend et élargit l'ancienne PR 14, jamais réalisée. État actuel à
connaître avant de commencer : la table `documents` existe depuis la
migration 0001 (colonnes `storage_path`, `type doc_type`, `amount`,
`paid`, `uploaded_by`) et l'enum `doc_type` couvre déjà
`devis, facture, recu, justificatif, convention, note, etude, photo,
livrable, rapport`. **Mais rien n'est branché** : aucun bucket Storage
`documents`, aucune server action, aucun composant d'upload, aucune
requête `from('documents')` dans l'application. Le seul usage est le
compteur « 📎 N doc » sur chaque tâche, structurellement toujours à 0.

Livrables :
- Bucket Supabase Storage privé `documents`, chemins
  `projets/<project_id>/<phase_id|_>/<uuid>-<nom>`, policies alignées sur
  `is_project_member()` (lecture) et sur le rôle projet (dépôt).
- **Rattachement élargi** : `documents` ne peut aujourd'hui se rattacher
  qu'à une tâche (`task_id`) ou une ligne budgétaire (`budget_line_id`).
  Ajouter `project_id` et `phase_id` pour permettre le dépôt au niveau
  d'une phase et au niveau du projet, sans passer par une tâche.
- **Photos avant / après par phase** : champ `moment` (`avant`, `apres`,
  `pendant`) sur les documents de type `photo`, galerie comparative dans
  l'onglet Tâches au niveau de la phase. C'est la matière première des
  rapports terrain et des supports de communication.
- **Preuve de réalisation** : le chef de projet joint un justificatif à
  une tâche pour attester qu'elle est faite. Une tâche passée à
  « terminée » sans pièce jointe est signalée (pas bloquée).
- **Devis et factures** : dépôt sur la ligne budgétaire, avec montant et
  statut payé. Réactive la table `validations` (existante, inutilisée) :
  circuit devis déposé → validé → facture → payé.
- **Zone documentaire centralisée par projet** : nouvel onglet
  « Documents » listant *tout* le projet d'un coup, filtrable par type,
  par phase, par tâche et par date, avec téléchargement groupé (ZIP).
  C'est la demande explicite : accéder à l'ensemble en un seul endroit.
- **Rapports IA** : `report-actions.ts` devra citer les pièces
  disponibles par phase — un rapport qui s'appuie sur des preuves
  datées vaut mieux qu'un rapport qui s'appuie sur des pourcentages.

⚠️ Dette d'honnêteté à corriger dans la même PR : l'aide contextuelle
(`lib/help-content.ts`) affirme déjà que « les justificatifs se déposent
directement sur la ligne concernée » et que les tâches portent des
« documents ». C'est faux tant que cette PR n'est pas livrée.

### PR 39 — Prévu / engagé / réalisé : piloter l'écart
**Cadrage produit fixé par YCID le 25/07/2026.** Les lignes budgétaires
sont **le budget établi au départ** : la référence, celle de la
convention de financement. À l'exécution, les montants réels s'en
écartent — au-dessus ou en dessous. Ce que la plateforme doit rendre
lisible, c'est précisément cet écart : *ce qui était prévu* face à
*ce qui a été réalisé*.

Cette formulation **tranche la question laissée ouverte** : le
prévisionnel ne se saisit qu'à un seul endroit, la ligne budgétaire.
`phases.budget`, saisi à la main dans le dialogue de phase et jamais
confronté aux lignes, devient donc **calculé** (Σ des lignes de la
phase) et le champ de saisie disparaît. Garder un second montant
modifiable pour la même chose ne fait que produire des divergences
silencieuses — rien n'empêche aujourd'hui une phase déclarée à 50 000 €
dont les lignes totalisent 12 000 €. Même raisonnement à instruire pour
`projects.budget`.

Le modèle est **déjà spécifié** dans `docs/spec-phase1-mvp.md` §10.3 et
§10.4, jamais implémenté. Les colonnes nécessaires existent aussi déjà :
`documents.amount`, `documents.paid`, et la table `validations`
(inutilisée). Formules de la spec, à reprendre telles quelles :
`engaged = Σ devis validés`, `paid = Σ reçus + factures payées`,
`remaining_to_commit = planned − engaged`, `remaining_to_pay =
engaged − paid`.

Dépend donc de la **PR 38** : sans dépôt de devis et de factures, le
réalisé n'a aucune source. Les deux PR se livrent dans cet ordre.

Livrables :
- Trois montants par ligne, par phase et par projet : **prévu**
  (référence), **engagé** (devis validés), **payé** (factures et reçus),
  plus les deux restes. Barre de consommation sur chaque niveau.
- **Écart prévu / réalisé** affiché explicitement, en valeur et en
  pourcentage, avec le signe : un projet sous-consommé est une
  information de pilotage au même titre qu'un dépassement.
- **Gel du prévisionnel.** Une fois la convention signée, modifier
  `planned_amount` doit être tracé (`audit_log`, motif obligatoire) et
  réservé aux mêmes profils que les tâches terminées. Sans cela l'écart
  s'efface tout seul : on ne compare pas à un plan qui bouge.
  À défaut d'un gel dur, conserver le prévisionnel initial dans une
  colonne dédiée (`planned_amount_initial`) et comparer à celle-ci.
- Onglet Budget **regroupé par phase**, sous-total par phase et section
  « hors phase » pour les lignes non rattachées.
- KPI projet complétés (§10.4) : prévu hors valorisation, engagé, payé,
  restes, valorisations, et répartition par financeur en prévu/engagé —
  c'est la vue qu'attend un financeur.
- Nombre de tâches par phase affiché à côté de l'avancement (aujourd'hui
  seul le total projet est visible, dans le libellé de l'onglet).
- Avancement de phase : décider s'il reste une moyenne simple des tâches
  ou s'il est pondéré (par budget, ou par durée).
- `report-actions.ts` : inclure `phase_id` **et les montants réalisés**
  dans le select des lignes budgétaires — aujourd'hui `phase_id` en est
  absent, donc le modèle ne *peut pas* rapprocher une ligne de sa phase,
  ni commenter un écart qu'il ne voit pas.

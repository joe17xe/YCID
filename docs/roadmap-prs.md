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

**Découpée en cinq PR** (25/07/2026). Telle que spécifiée à l'origine,
elle mélangeait une migration de schéma, un bucket Storage, un circuit
de validation, une galerie et un nouvel onglet : trop pour une revue
utile et pour un retour arrière propre. Le découpage suit les
dépendances réelles — la 38a conditionne les quatre autres, qui sont
ensuite indépendantes entre elles.

#### PR 38a — Socle documentaire
Sans elle, rien d'autre n'est possible : c'est la seule des cinq qui
n'apporte pas de fonction métier visible mais débloque tout le reste.
- Bucket Supabase Storage **privé** `documents`, chemins
  `projets/<project_id>/<phase_id|_>/<uuid>-<nom>`, policies alignées sur
  `is_project_member()` (lecture) et sur le rôle projet (dépôt).
- **Rattachement élargi** : `documents` ne peut aujourd'hui se rattacher
  qu'à une tâche (`task_id`) ou une ligne budgétaire (`budget_line_id`).
  Ajouter `project_id` et `phase_id` pour permettre le dépôt au niveau
  d'une phase et du projet, sans passer par une tâche.
- Server actions (dépôt, suppression, téléchargement par URL signée) et
  composant d'upload réutilisable par les quatre PR suivantes.
- Liste des pièces sur une tâche : le compteur « 📎 N doc », aujourd'hui
  structurellement à 0, affiche enfin une valeur réelle.
- ⚠️ **Dette d'honnêteté**, à corriger ici : l'aide contextuelle
  (`lib/help-content.ts`) affirme déjà que « les justificatifs se
  déposent directement sur la ligne concernée » et que les tâches
  portent des « documents ». C'est faux tant que la 38a n'est pas
  livrée — soit on livre, soit on retire la phrase.

#### PR 38b — Devis, factures et circuit de validation
**C'est elle qui débloque la PR 39** : sans dépôt de devis et de
factures, le réalisé n'a aucune source. À livrer juste après la 38a si
l'on veut avancer vers le prévu/engagé/réalisé.
- Dépôt sur la ligne budgétaire, avec montant et statut payé
  (`documents.amount`, `documents.paid`, colonnes existantes).
- Réactive la table `validations` (existante, inutilisée) : circuit
  devis déposé → validé → facture → payé.

#### PR 38c — Photos avant / après par phase
- Champ `moment` (`avant`, `pendant`, `apres`) sur les documents de type
  `photo`, galerie comparative au niveau de la phase dans l'onglet
  Tâches. Présentation en colonnes par moment plutôt qu'en liste
  chronologique : c'est la comparaison qui porte l'information.
- Matière première des rapports terrain et des supports de
  communication — donc utile à la PR 26 (campagnes) autant qu'au COPIL.
- **Durcissement du bucket**, dette contractée en 38a : la limite de
  10 Mo n'était vérifiée que dans le navigateur. `file_size_limit` et
  `allowed_mime_types` sont posés côté serveur, seul endroit où une
  limite vaut quelque chose. HEIC / HEIF admis — format par défaut des
  iPhone, donc de la majorité des photos de chantier.

#### PR 38d — Onglet Documents centralisé
La demande explicite : accéder à l'ensemble en un seul endroit. Livrée
après 38b et 38c, une vue centralisée n'ayant d'intérêt qu'une fois
plusieurs natures de pièces réellement présentes.
- Nouvel onglet « Documents » listant *tout* le projet d'un coup, avec
  le rattachement de chaque pièce (tâche, ligne, phase ou projet).
- Filtres nature, phase, période, et une **seule** zone de recherche
  couvrant nom de fichier, tâche et poste : trois champs séparés
  obligeraient à savoir où la pièce a été déposée, ce qui est justement
  l'information qui manque.
- Téléchargement groupé (ZIP) assemblé **dans le navigateur** : les
  fichiers ne transitent pas par le serveur Next, qui n'a pas à recopier
  des pièces déjà accessibles à l'utilisateur. L'archive reprend la
  sélection filtrée, pas tout le projet, et dédoublonne les noms — deux
  pièces homonymes s'écraseraient sinon en silence.

#### PR 38e — Preuve de réalisation et pièces citées par l'IA
- Le chef de projet joint un justificatif à une tâche pour attester
  qu'elle est faite. Une tâche passée à « terminée » sans pièce jointe
  est **signalée, pas bloquée** — un blocage dur ferait renoncer à
  marquer les tâches terminées, et l'on perdrait l'avancement en plus de
  la preuve. Signalement sur la tâche, et compte agrégé sur la phase
  pour n'avoir pas à déplier chacune.
- `report-actions.ts` cite les pièces disponibles par phase et par
  tâche, et distingue explicitement ce qui est DÉCLARÉ de ce qui est
  PROUVÉ : une tâche à 100 % sans pièce est un avancement déclaratif, à
  signaler comme tel. Les photos sont comptées par moment (avant /
  après) : c'est la comparaison qui documente une réalisation, pas leur
  nombre total.

**Ordre recommandé** : 38a → 38b → 38c → 38d → 38e. La PR 39 peut
démarrer dès la 38b livrée, sans attendre les trois dernières.

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

Dépend donc de la **PR 38b** précisément (devis et factures) : sans
elle, le réalisé n'a aucune source. Les PR 38c, 38d et 38e ne la
conditionnent pas — la PR 39 peut démarrer dès 38a + 38b livrées.

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

### PR 40 — Lier les lignes budgétaires aux tâches
**Cadrage produit YCID du 25/07/2026 :** « une ligne budgétaire est une
tâche ; on peut ajouter une tâche supplémentaire sans budget (signer un
contrat…) pour une phase donnée ». Phases, tâches et budget doivent être
synchronisés.

État actuel : **aucun lien n'existe**. `tasks` ne porte que `phase_id`
(`0001_schema.sql:120-134`), `budget_lines` porte `project_id` et
`phase_id` (`0001_schema.sql:173-190`). Aucune clé étrangère entre les
deux tables, dans aucun sens. Leur seul ancêtre commun est la phase :
c'est pourquoi l'onglet Budget et l'onglet Tâches racontent aujourd'hui
deux histoires parallèles sur la même phase.

**Modèle retenu : table de liaison `budget_line_tasks`, N:M avec montant.**
Plutôt qu'une correspondance stricte un pour un. Raison : quatre cas
réels du programme CEM ne rentrent pas dans un 1:1.
- **Répartition** (précision YCID du 25/07/2026). « Une ligne budgétaire
  peut avoir plusieurs tâches : un budget de 40 000 € peut être divisé
  en deux tâches, 10 000 € et 30 000 €. » La ligne garde son montant
  intact — c'est la vérité de la convention de financement — et la
  répartition vient par-dessus. La somme des affectations peut donc être
  inférieure au montant de la ligne (reste non affecté), jamais
  supérieure. C'est ce cas qui impose la table de liaison : une simple
  colonne `task_id` n'a nulle part où écrire le montant affecté.
- **Co-financement.** Un même livrable financé par le Département, la
  Mairie et l'association donne trois lignes budgétaires (financeurs
  distincts, `funder_org_id`). En 1:1 strict, le même travail
  apparaîtrait trois fois dans la liste des tâches.
- **Valorisations.** Les lignes `is_valorisation` (bénévolat, mise à
  disposition de locaux) ne sont pas des tâches à exécuter.
- **Frais de structure.** Les lignes de catégorie `fonctionnement` ne
  correspondent à aucun livrable daté.

Le N:M couvre les quatre cas et autorise les deux extrémités voulues :
tâche **sans** ligne (« signer la convention », budget 0 €), ligne
**sans** tâche (frais de structure).

**Toute tâche porte un budget, 0 € compris** (règle YCID). « Sans
budget » ressemblait à une donnée manquante alors que 0 € est une
décision. Le budget d'une tâche n'est jamais saisi directement : c'est
toujours la somme de ce que les lignes lui affectent — une seule source
de vérité, contrairement à `phases.budget` que la PR 39 doit supprimer.

Livrables :
- Migration : table `budget_line_tasks (budget_line_id, task_id, amount)`
  + index + RLS alignée sur `budget_lines`. Triggers de cohérence : la
  tâche affectée doit appartenir à la phase de la ligne, la somme des
  affectations ne peut dépasser le montant de la ligne, et changer la
  phase d'une ligne déjà répartie est refusé plutôt que de détacher les
  affectations en silence. Ferme au passage le trou d'origine : rien ne
  vérifiait que `phase_id` appartenait au projet (`actions.ts:275`).
- Bloc « Tâches financées » dans le dialogue de ligne budgétaire : liste
  répétable (tâche + montant), limitée aux tâches de la phase choisie,
  avec total réparti et reste non affecté affichés.
- Création croisée en un geste : depuis une ligne, « créer la tâche
  correspondante » ; depuis une tâche, « ajouter une ligne budgétaire ».
  C'est ce qui rend la saisie synchrone en pratique, pas la contrainte.
- Onglet Tâches : montant prévu (puis engagé / payé après PR 39) affiché
  sur chaque tâche, et distinction visuelle des tâches sans budget.
- Onglet Budget : les lignes rattachées à une tâche l'affichent ;
  section dédiée aux lignes hors tâche.
- **Avancement de phase pondéré par le budget** devient enfin possible —
  aujourd'hui c'est une moyenne arithmétique des `progress`
  (`page.tsx:225`), où « signer un contrat » pèse autant qu'un chantier
  de 40 000 €. C'est probablement le gain le plus concret de cette PR.
- Import CSV : colonnes `tache` et `montant_tache` sur le gabarit des
  lignes budgétaires, rattachement par titre au sein de la phase. Une
  ligne CSV n'exprime qu'une seule tâche ; les répartitions sur
  plusieurs tâches se saisissent dans l'interface.

- Création croisée en un geste, dans les deux sens. Depuis une ligne,
  « Créer la tâche » reprend le poste comme titre, la phase de la ligne,
  et affecte le montant non encore réparti — aucun dialogue, tout est
  déjà sur la ligne. Depuis une tâche, « ligne budgétaire » ouvre le
  dialogue déjà rattaché à elle, le reste (poste, financeur, montant)
  restant à saisir. Le rattachement seul supposait que les deux existent
  déjà : il fallait saisir deux fois avant de pouvoir relier.

Ordre de livraison : **PR 38** (documents, source du réalisé) → **PR 40**
(le lien) → **PR 39** (prévu / engagé / réalisé, qui s'appuie sur les
deux). La PR 40 peut aussi se livrer avant la 38 si l'on veut d'abord la
pondération de l'avancement, qui n'a besoin que du prévisionnel.

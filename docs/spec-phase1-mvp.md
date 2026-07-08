# Application de pilotage de projets de solidarité internationale
## Spécification Phase 1 — MVP

---

## 1. Structure du MVP

### Stack recommandée
- **Frontend** : Next.js (React) + Tailwind CSS — dashboard responsive, rapide à itérer.
- **Backend / BDD** : Supabase (PostgreSQL managé) — fournit nativement l'authentification Google + email/mot de passe, le stockage de fichiers (documents) et les règles de sécurité par ligne (RLS), ce qui couvre 80 % des besoins de la phase 1 sans backend custom.
- **Import Excel/CSV** : parsing côté client (SheetJS pour .xlsx, PapaParse pour .csv), aperçu avant insertion.

### Modules de la phase 1
1. Authentification et profil utilisateur
2. Organisations (CRUD simple)
3. Projets (CRUD + rôles des organisations)
4. Phases et tâches
5. Documents rattachés aux tâches
6. Tableau de bord
7. Import Excel/CSV

Hors périmètre (phases suivantes) : gestion financière détaillée, workflows de validation, notifications, rapports exportables, multi-langue.

---

## 2. Écrans principaux

| # | Écran | Contenu |
|---|-------|---------|
| 1 | Connexion | Google + email/mot de passe, création de compte |
| 2 | Tableau de bord | Projets, avancement global, tâches en retard, tâches à venir, derniers documents |
| 3 | Projets (liste) | Cartes/tableau des projets, filtre par statut, bouton "Nouveau projet" |
| 4 | Projet (détail) | Infos, organisations et rôles, phases dépliables, tâches, avancement |
| 5 | Tâche (panneau/détail) | Champs de la tâche + documents rattachés |
| 6 | Organisations | Liste + création/édition |
| 7 | Import | Choix du type (projets / phases / tâches), upload, aperçu, validation, confirmation |
| 8 | Profil | Nom, email, organisation(s), déconnexion |

---

## 3. Modèle de données minimum

### Tables

**users** *(gérée en partie par le fournisseur d'auth)*
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text unique | |
| full_name | text | |
| auth_provider | text | `google` \| `email` |
| is_platform_admin | boolean | défaut `false` |
| created_at | timestamp | |

**organizations**
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | obligatoire |
| type | enum | `association`, `collectivite`, `partenaire_local`, `partenaire_medical`, `financeur`, `autre` |
| country | text | |
| email | text | |
| status | enum | `active`, `inactive` |
| created_at | timestamp | |

**memberships** — rattachement utilisateur ↔ organisation
| Champ | Type | Notes |
|---|---|---|
| user_id | uuid FK users | |
| org_id | uuid FK organizations | |
| role | enum | `admin_org`, `membre` |

**projects**
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | obligatoire |
| description | text | |
| country | text | |
| zone | text | |
| start_date / end_date | date | |
| status | enum | `en_preparation`, `en_cours`, `suspendu`, `termine` |
| lead_org_id | uuid FK organizations | **porteur paramétrable — n'importe quel type d'organisation** |
| created_by | uuid FK users | |

**project_organizations** — rôle de chaque organisation dans le projet
| Champ | Type | Notes |
|---|---|---|
| project_id | uuid FK | |
| org_id | uuid FK | |
| role | enum | `porteur`, `partenaire`, `financeur`, `observateur`, `partenaire_terrain`, `partenaire_medical` |

**project_members** — rôle de chaque utilisateur dans le projet
| Champ | Type | Notes |
|---|---|---|
| project_id | uuid FK | |
| user_id | uuid FK | |
| role | enum | `chef_projet`, `contributeur`, `lecteur` |

**phases**
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK | |
| name | text | |
| position | int | ordre d'affichage |
| start_date / end_date | date | |
| status | enum | `a_venir`, `en_cours`, `terminee` |

**tasks**
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| phase_id | uuid FK | |
| title | text | obligatoire |
| description | text | |
| assignee_id | uuid FK users | responsable |
| start_date / end_date | date | |
| status | enum | `a_faire`, `en_cours`, `terminee`, `bloquee` |
| progress | int 0–100 | |
| comment | text | |

**documents**
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| task_id | uuid FK | |
| type | enum | `devis`, `facture`, `photo`, `livrable`, `rapport` |
| filename | text | |
| storage_path | text | fichier dans le bucket de stockage |
| uploaded_by | uuid FK users | |
| uploaded_at | timestamp | |

L'avancement d'une phase = moyenne des `progress` de ses tâches. L'avancement d'un projet = moyenne des phases. Calculé à la volée, pas stocké (simplicité V1).

---

## 4. Rôles et permissions minimum

| Action | Admin plateforme | Admin organisation | Chef de projet | Contributeur | Lecteur / financeur |
|---|---|---|---|---|---|
| Gérer tous les comptes / orgas | ✅ | — | — | — | — |
| Gérer son organisation | ✅ | ✅ | — | — | — |
| Créer un projet | ✅ | ✅ | — | — | — |
| Modifier projet / phases | ✅ | ✅ (si org porteuse) | ✅ | — | — |
| Ajouter / affecter partenaires | ✅ | ✅ | ✅ | — | — |
| Créer / modifier tâches | ✅ | ✅ | ✅ | ✅ (ses tâches) | — |
| Mettre à jour avancement | ✅ | ✅ | ✅ | ✅ (ses tâches) | — |
| Ajouter des documents | ✅ | ✅ | ✅ | ✅ | — |
| Consulter (projets où son orga est impliquée) | ✅ (tout) | ✅ | ✅ | ✅ | ✅ |
| Importer Excel/CSV | ✅ | ✅ | ✅ | — | — |

Règle de visibilité V1 : un utilisateur voit un projet si son organisation figure dans `project_organizations` ou s'il figure dans `project_members`.

---

## 5. Parcours utilisateur type

1. **Inscription / connexion** → Google ou email + mot de passe.
2. **Première connexion** → l'utilisateur crée son organisation ou rejoint une organisation existante (invitation par email en V1 simple : l'admin org ajoute l'email).
3. **Création d'un projet** → nom, pays/zone, dates, statut, **choix de l'organisation porteuse** (paramétrable), ajout des organisations partenaires avec leur rôle.
4. **Structuration** → création des phases, puis des tâches (responsable, dates, statut, avancement).
5. **Suivi au quotidien** → chaque contributeur met à jour ses tâches et ajoute les documents (devis, factures, photos, livrables, rapports).
6. **Pilotage** → le chef de projet et les financeurs suivent le tableau de bord : avancement global, tâches en retard, derniers documents.
7. **Import** → pour un projet existant en Excel, import en 3 étapes : upload → aperçu + validation des colonnes → confirmation.

---

## 6. Format Excel / CSV minimum pour l'import

Un fichier (ou onglet) par type. Colonnes marquées * obligatoires.

### projets.csv
```
nom* ; description ; pays ; zone ; date_debut ; date_fin ; statut ; organisation_porteuse*
```
Exemple :
```
Accès à l'eau — Région de Kayes;Forages et formation;Mali;Kayes;2026-01-15;2027-06-30;en_cours;Eau & Avenir
```

### phases.csv
```
projet* ; phase* ; date_debut ; date_fin ; statut
```

### taches.csv
```
projet* ; phase* ; titre* ; description ; responsable_email ; date_debut ; date_fin ; statut ; avancement ; commentaire
```

Règles V1 :
- Correspondance par **nom exact** (projet, phase, organisation) et par **email** (responsable).
- Dates au format `AAAA-MM-JJ`.
- Statuts limités aux valeurs de l'application ; toute valeur inconnue → `en_preparation` / `a_faire` avec avertissement.
- Aperçu des 20 premières lignes avant import, lignes en erreur signalées et exclues, rien n'est inséré tant que l'utilisateur n'a pas confirmé.

---

## 7. Proposition d'interface

- **Layout** : sidebar fixe à gauche (Tableau de bord, Projets, Organisations, Import), topbar avec recherche et profil, contenu en cartes sobres sur fond gris très clair.
- **Palette** : fond `#F5F6F4`, surfaces blanches, texte `#17211D`, accent vert profond `#0E6B5C` (avancement, actions), ambre `#B4690E` pour les alertes de retard.
- **Typographie** : Sora pour les titres, Inter pour le texte — lisible, professionnel, moderne.
- **Signature visuelle** : badges de rôle colorés pour chaque organisation (porteur, financeur, partenaire médical…) et barres d'avancement fines et discrètes partout où il y a un pourcentage.
- **Responsive** : sidebar repliée en icônes sur mobile, tableaux transformés en cartes.

Un prototype fonctionnel accompagne cette spécification (fichier `prototype-phase1.jsx`) : connexion simulée, tableau de bord, projets avec phases/tâches/documents, organisations et import CSV avec aperçu et validation.

---

## 8. Addendum — Budgets et validation des devis (ajout au périmètre phase 1)

### Principe
- Chaque **projet** a un budget global (et une devise : EUR, XOF…).
- Chaque **phase** a un budget associé. La somme des budgets de phases est comparée au budget projet.
- Les **partenaires terrain** fournissent pour chaque phase : devis, études, factures (rattachés aux tâches).
- Un **devis porte un montant** et doit être **validé** avant d'engager la dépense.
- Le circuit de validation est **configurable par projet** : on définit quels rôles doivent valider (ex. porteur + financeur). Chaque organisation ayant ce rôle dans le projet devient un validateur requis.

### Suivi budgétaire simple (V1)
- **Engagé** = somme des devis validés.
- **Facturé** = somme des factures déposées.
- Affichage par phase et consolidé au niveau projet (barres budget / engagé / facturé).

### Tables ajoutées / modifiées

**projects** : + `budget numeric`, + `currency text` (défaut EUR)

**phases** : + `budget numeric`

**documents** : + `amount numeric` (pour devis et factures)

**validation_rules** — configuration du circuit par projet
| Champ | Type | Notes |
|---|---|---|
| project_id | uuid FK | |
| doc_type | enum | `devis` (extensible plus tard) |
| role | enum | rôle d'organisation devant valider : `porteur`, `financeur`, etc. |

**validations** — une ligne par validateur requis et par devis
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| document_id | uuid FK documents | |
| org_id | uuid FK organizations | organisation validatrice |
| decision | enum | `en_attente`, `valide`, `refuse` |
| decided_by | uuid FK users | |
| decided_at | timestamp | |
| comment | text | motif en cas de refus |

**Statut d'un devis** (dérivé) : `refusé` si au moins un refus ; `validé` si toutes les validations requises sont validées ; sinon `en attente`.

### Permissions ajoutées
| Action | Admin plateforme | Admin org | Chef de projet | Contributeur | Lecteur / financeur |
|---|---|---|---|---|---|
| Définir budgets (projet, phases) | ✅ | ✅ (org porteuse) | ✅ | — | — |
| Configurer le circuit de validation | ✅ | ✅ (org porteuse) | ✅ | — | — |
| Déposer un devis avec montant | ✅ | ✅ | ✅ | ✅ | — |
| Valider / refuser un devis | ✅ | ✅ (si son org est validatrice) | ✅ (si son org est validatrice) | — | ✅ (si son org est financeur validateur) |

---

## 9. Addendum — Contrôle d'accès par projet (mode SaaS)

### Principe
Chaque projet définit **ses parties prenantes et leurs accès** :
1. **Organisations** du projet avec leur rôle (porteur, financeur, partenaire terrain…) — déjà en place.
2. **Membres** du projet : des utilisateurs invités individuellement, chacun avec un **profil d'accès** propre à ce projet.

| Profil d'accès (par projet) | Qui typiquement | Droits |
|---|---|---|
| **Chef de projet (comité)** | Le comité de pilotage : org porteuse, décideurs | Définit le projet, le budget global, crée les phases et leurs budgets, configure le circuit de validation, gère les membres et les organisations, tout le reste |
| **Contributeur (terrain)** | Partenaires terrain qui réalisent les travaux | Ajoute des tâches, met à jour ses tâches, dépose devis / études / factures / photos. Ne peut PAS modifier le projet, les budgets ni les phases |
| **Lecteur / financeur** | Financeurs, observateurs | Consulte tout. Valide ou refuse les devis **si son organisation fait partie du circuit de validation** |

La création de projets est réservée aux **admins d'organisation** et à l'**admin plateforme**.

### Règles d'application (backend)
- Toute écriture vérifie le profil du membre sur le projet (RLS Postgres/Supabase : `project_members.role`).
- La décision de validation d'un devis n'est possible que si `validations.org_id` = organisation de l'utilisateur.
- Visibilité : un utilisateur ne voit que les projets où son organisation participe ou dont il est membre.

---

# PHASE 2 — Budget et finances

## 10.1 Points d'arbitrage (gaps identifiés et choix retenus)

1. **Engagé / payé : calculés, pas saisis.** La demande liste « montant engagé » et « montant payé » comme champs de la ligne. Saisis à la main, ils divergeraient des devis validés (phase 1). Choix : **engagé = somme des devis validés rattachés à la ligne** ; **payé = somme des reçus + factures marquées « payée »**. Seul le prévisionnel est saisi. Une correction manuelle reste possible plus tard si besoin.
2. **Lien avec les budgets de phases (phase 1).** Sans lien, on aurait deux budgets parallèles. Choix : une ligne budgétaire peut être **rattachée à une phase (optionnel)** ; à terme le budget de phase devient la somme de ses lignes. En V2 on garde l'enveloppe de phase et on affiche l'écart.
3. **Catégorie « Projet ».** Tout est déjà dans un projet ; la catégorie est ambiguë. Conservée par défaut (Investissement / Fonctionnement / Projet + Autre), mais la liste doit être **paramétrable** en base (table `budget_categories`) car chaque financeur impose sa nomenclature.
4. **Un financeur par ligne.** Le cofinancement d'une même dépense (60 % AFD / 40 % collectivité) se gère en V2 en **scindant en deux lignes**. Le multi-financeur par ligne (clé de répartition) est reporté en phase 3.
5. **Multi-devises.** Additionner des lignes en devises différentes fausserait tous les KPI. Choix : **une devise par projet** (héritée par les lignes). La devise d'origine d'une pièce peut être notée en commentaire ; la conversion multi-devises est reportée.
6. **Financeurs = organisations.** Pas de nouvelle entité : un financeur est une organisation du projet. Types d'organisation étendus : `financeur_public`, `mecene` s'ajoutent aux types existants.
7. **« Payé » sans module comptable.** Pas de rapprochement bancaire en V2 : le statut « payée » se coche sur la facture. Suffisant pour le reste-à-payer ; la comptabilité complète est hors périmètre.

## 10.2 Nouveaux écrans

| Écran | Contenu |
|---|---|
| Budget du projet (onglet dans le projet) | KPI + tableau des lignes + bouton export |
| Vues budgétaires | Onglets : Lignes / Par catégorie / Par financeur / Par année / Par organisation |
| Ligne budgétaire (fiche) | Champs + justificatifs + état de validation des devis |
| Import budget | 4e type dans l'écran d'import existant |

## 10.3 Nouvelles tables

**budget_categories** (paramétrable) : `id, project_id (null = défauts plateforme), name`

**budget_lines**
| Champ | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK | obligatoire |
| phase_id | uuid FK phases | optionnel |
| poste | text | obligatoire |
| description | text | |
| category | FK budget_categories | |
| funder_org_id | uuid FK organizations | financeur |
| owner_org_id | uuid FK organizations | organisation responsable |
| year | int | |
| planned_amount | numeric | montant prévisionnel |
| is_valorisation | boolean | contribution valorisée (nature, bénévolat) |
| status | enum | `prevue`, `active`, `cloturee` |
| comment | text | |

**documents** (étendue) : + `budget_line_id uuid FK (optionnel)`, + `paid boolean` (factures), types ajoutés : `recu`, `justificatif`, `convention`, `note`. Une pièce se rattache à une tâche OU à une ligne budgétaire.

Montants dérivés par ligne : `engaged = Σ devis validés`, `paid = Σ reçus + factures payées`, `remaining_to_commit = planned − engaged`, `remaining_to_pay = engaged − paid`.

## 10.4 Vues et KPI

KPI projet : budget prévisionnel total (hors valorisation), engagé, payé, reste à engager, reste à payer, total valorisations, répartition par financeur (prévu/engagé). Chaque vue (catégorie, financeur, année, organisation) agrège prévu / engagé / payé avec barres de consommation.

## 10.5 Permissions financières

Nouveau profil par projet : **Responsable financier**.

| Action | Admin plateforme | Admin org | Chef de projet | Resp. financier | Contributeur | Lecteur / financeur |
|---|---|---|---|---|---|---|
| Voir le budget et les KPI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Créer / modifier / clôturer une ligne | ✅ | ✅ (org porteuse) | ✅ | ✅ | — | — |
| Ajouter un justificatif sur une ligne | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Voir les pièces financières | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Marquer une facture « payée » | ✅ | ✅ | ✅ | ✅ | — | — |
| Exporter le budget (CSV) | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| Importer des lignes budgétaires | ✅ | ✅ | ✅ | ✅ | — | — |
| Valider un devis | selon circuit de validation (inchangé, phase 1) | | | | | |

## 10.6 Format Excel / CSV budget

```
projet* ; poste* ; categorie* ; montant_previsionnel* ; description ; financeur ;
organisation_responsable ; phase ; annee ; valorisation (oui/non) ; statut ; commentaire
```
Exemple :
```
Accès à l'eau — Région de Kayes;Pompes manuelles;investissement;18000;Fourniture et pose;AFD;Sahel Santé;Travaux de forage;2026;non;prevue;
```
Règles identiques à la phase 1 : correspondance par nom exact, aperçu 20 lignes, lignes en erreur exclues, droits vérifiés par ligne (chef de projet ou responsable financier du projet visé).

---

# PHASE 3 — Validations, vue financeur et reporting

## 11.1 Ce qui est DÉJÀ couvert par les phases 1-2 (à ne pas redévelopper)

| Demande phase 3 | État |
|---|---|
| Validation d'une dépense (devis) | ✅ Couvert : circuit multi-organisations configurable, valider/refuser avec motif |
| Qui a validé + date + commentaire | ✅ Partiellement couvert par la table `validations` (devis uniquement) |
| Financeur consulte tout, valide les devis | ✅ Couvert par le profil Lecteur/Financeur + circuit |
| Budget lié / dépenses par financeur | ✅ Couvert par la vue budgétaire « Par financeur » |
| Export budgétaire | ✅ Couvert (export CSV phase 2) |

## 11.2 Arbitrages phase 3

1. **Un seul système de validation, pas deux.** Le circuit devis (phases 1-2) et le nouveau workflow générique doivent être unifiés : le workflow générique (brouillon → soumis → en revue → validé/rejeté) s'applique à **tâches, documents/livrables et lignes budgétaires** ; pour les **devis**, l'étape « validé » reste le circuit multi-organisations existant (l'état de revue d'un devis est dérivé : en attente → soumis, validé → validé, refusé → rejeté). On ne demande jamais deux validations parallèles du même objet.
2. **Statut de revue ≠ statut d'exécution.** Une tâche garde son statut opérationnel (à faire / en cours / terminée) ; l'état de validation (brouillon…validé) est un champ distinct.
3. **Workflow en 3 étapes fixes en V3** : contributeur **soumet** → chef de projet **passe en revue** (ou rejette) → **validateur** valide (ou rejette). Le paramétrage d'étapes personnalisées par projet est reporté en phase 4.
4. **Notifications in-app d'abord** : centre de notifications (cloche) alimenté par le journal d'audit + alertes calculées (retards, échéances). Emails/push en production via un worker (hors prototype).
5. **Rapports en CSV/texte d'abord**, générés côté client ; le PDF mis en forme viendra avec un service de génération serveur.

## 11.3 Workflow d'approbation

```
brouillon ──soumettre (contributeur/chef)──▶ soumis ──passer en revue (chef)──▶ en_revue ──valider (validateur)──▶ valide
    ▲                                          │ rejeter (chef)                    │ rejeter (validateur)
    └────────── soumettre à nouveau ◀──────── rejete ◀──────────────────────────────┘
```
Chaque transition écrit une entrée d'audit : qui, quoi, quand (date+heure), commentaire.

## 11.4 Nouvelles tables

**reviews** (état de revue par objet) : `entity ('task'|'document'|'budget_line'), entity_id, state enum(brouillon, soumis, en_revue, valide, rejete)`

**audit_log** : `id, project_id, entity, entity_id, label, action (cree, modifie, soumis, en_revue, valide, rejete, paye…), user_id, at timestamp, comment` — table en append-only (jamais de suppression), lisible par l'auditeur.

**notifications** (en prod ; dérivées à l'affichage dans le prototype) : `user_id, type, payload, read_at`. Types : document soumis, document rejeté, dépense à valider, échéance proche (≤ 14 j), tâche en retard.

## 11.5 Vue financeur (écran dédié)

Onglet « Vue financeur » du projet, filtré sur l'organisation de l'utilisateur si elle finance des lignes :
avancement global, budget lié (prévisionnel/engagé/payé de SES lignes), dépenses liées (factures/reçus), justificatifs autorisés, livrables remis avec leur état de validation, derniers événements (journal).

## 11.6 Rapports exportables

1. Rapport synthétique projet (infos, partenaires, KPI, avancement) — .txt
2. Rapport d'avancement (phases, tâches, %, retards, état de revue) — .csv
3. Rapport budgétaire (lignes + engagé/payé/restes) — .csv (existant, enrichi de l'état de revue)
4. Liste des livrables (fichier, tâche, déposant, date, état) — .csv
5. État des validations (journal des soumissions/validations/rejets) — .csv

## 11.7 Permissions phase 3

Profils par projet : chef de projet, responsable financier, contributeur, **validateur**, **auditeur**, lecteur.

| Action | Chef de projet | Resp. financier | Contributeur | Validateur | Auditeur | Lecteur |
|---|---|---|---|---|---|---|
| Soumettre (tâche, doc, ligne) | ✅ | ✅ (lignes) | ✅ | — | — | — |
| Passer en revue / rejeter à l'étape revue | ✅ | — | — | — | — | — |
| Valider / rejeter (étape finale) | ✅ (si aucun validateur) | — | — | ✅ | — | — |
| Valider un devis | selon circuit multi-organisations (inchangé) | | | | | |
| Vue financeur | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exporter les rapports | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Consulter le journal d'audit | ✅ | ✅ | — | ✅ | ✅ (accès complet, lecture seule) | — |
| Recevoir les notifications | selon rôle : soumissions (chef), à valider (validateur), rejets (auteur), échéances/retards (comité+terrain) |

---

# PHASE 4 — Impact, indicateurs et pilotage avancé

## 12.1 Le cas d'usage de référence (projet Liban)

Financeurs : Ministère de l'Europe et des Affaires étrangères, YCID, ville française, association porteuse (une organisation peut être à la fois porteuse ET financeuse de certaines lignes). Bénéficiaire : ville partenaire au Liban. Un expert local / chef de projet supervise l'exécution sur place.

Le modèle existant couvre presque tout : chaque financeur est une organisation du projet (types `financeur_public`, `collectivite`, `association`), le multi-financement se traduit par des lignes budgétaires portées par des financeurs différents (phase 2), l'expert local est simplement un membre avec le profil Chef de projet. **Gap identifié : le rôle « Bénéficiaire » n'existait pas** → ajouté aux rôles d'organisation sur un projet (`beneficiaire`).

## 12.2 Gaps et arbitrages phase 4

1. **Pas 5 tableaux de bord distincts.** Vue direction et vue comité de pilotage consomment les mêmes données (santé du portefeuille) → **un écran « Pilotage » global** (portefeuille multi-projets : avancement, consommation budgétaire, indicateurs, décisions ouvertes, retards). La vue bailleur = Vue financeur existante **enrichie d'une section impact**. La vue impact = **nouvel onglet Impact** dans le projet. La vue projet existe déjà.
2. **Indicateurs qualitatifs mesurables.** Pour rester agrégeable et graphable, un indicateur qualitatif se mesure sur une **échelle 1-5 + commentaire libre** (ex. autonomie de l'équipe municipale). Le narratif pur reste dans les comptes rendus.
3. **« Réduction d'un problème »** = indicateur dont la cible est INFÉRIEURE à la valeur initiale ; la formule d'atteinte `(valeur − initiale) / (cible − initiale)` gère naturellement les deux sens.
4. **Sources d'alimentation.** Saisie manuelle et import CSV en V4 ; source « tâches » = calcul automatique (nb de tâches terminées d'une phase liée) ; un justificatif peut être joint à une mesure. Connexions API externes hors périmètre.
5. **Décisions ≠ nouveau système de tâches.** Une décision de COPIL a son propre suivi léger (responsable, échéance, statut) ; si elle devient opérationnelle, on crée une tâche classique. On ne duplique pas le moteur de tâches.

## 12.3 Nouvelles tables

**indicators** : `id, project_id, name, description, kind (quantitatif|qualitatif), unit, periodicity (mensuel|trimestriel|annuel|ponctuel), source (manuelle|taches|import|document), baseline, target, phase_id (optionnel, requis si source=taches)`

**indicator_measures** : `id, indicator_id, period (texte : 2026-05, 2026-T2, 2026), value, comment, doc_id (justificatif optionnel), entered_by, at`

**meetings** : `id, project_id, title, kind (copil|technique|terrain), date, attendees, minutes (compte rendu)`

**decisions** : `id, meeting_id, project_id, text, owner_user_id, due_date, status (a_faire|en_cours|fait), task_id (optionnel si convertie en tâche)`

Atteinte d'un indicateur : `pct = clamp((dernière_valeur − baseline) / (target − baseline) × 100)` ; indicateur « à risque » si aucune mesure sur la dernière période attendue ou pct < 40 % à mi-parcours.

## 12.4 Écrans

| Écran | Contenu |
|---|---|
| Onglet Impact (projet) | Cartes indicateurs : dernière valeur, cible, % d'atteinte, mini-graphique des mesures, saisie d'une mesure, justificatif |
| Onglet Copil (projet) | Réunions (CR, participants), décisions avec responsable/échéance/statut, alertes décisions en retard |
| Page Pilotage (globale) | Portefeuille : par projet → avancement, budget engagé/payé, indicateurs atteints/à risque, décisions ouvertes, tâches en retard |
| Vue financeur | + section « Impact » (indicateurs du projet) |
| Rapports | + Rapport consolidé (avancement + budget + validations + impact + livrables + décisions) |

## 12.5 Import CSV avancé

**indicateurs** : `projet* ; nom* ; type* (quantitatif|qualitatif) ; unite ; periodicite ; valeur_initiale ; cible* ; source ; phase`
**resultats** : `projet* ; indicateur* ; periode* ; valeur* ; commentaire` (correspondance indicateur par nom exact)

## 12.6 Permissions phase 4

| Action | Chef de projet | Resp. financier | Contributeur | Validateur | Auditeur | Lecteur |
|---|---|---|---|---|---|---|
| Définir / modifier un indicateur | ✅ | ✅ | — | — | — | — |
| Saisir une mesure | ✅ | ✅ | ✅ | — | — | — |
| Créer réunion / CR / décisions | ✅ | — | — | — | — | — |
| Mettre à jour le statut d'une décision | ✅ | — | ✅ (si responsable) | — | — | — |
| Voir impact, Copil, pilotage, rapports consolidés | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

# Base de données — migrations

Les migrations sont numérotées et s'appliquent **dans l'ordre** dans le
SQL Editor Supabase (ou via `supabase db push` avec la CLI) :

| Fichier | Contenu |
|---|---|
| `migrations/0001_schema.sql` | Schéma complet (tables, enums, index, RLS initial) |
| `migrations/0002_rls_admin_patch.sql` | Les admins plateforme voient tout |
| `migrations/0003_rls_fix_recursion.sql` | Fix récursion infinie sur profiles (`is_admin()`) |
| `migrations/0004_rls_fix_project_orgs.sql` | Policies manquantes project_organizations / project_members |
| `migrations/0005_rls_completed_tasks_admin.sql` | Verrou tâches terminées (admins YCID/LEY) + insert audit_log |
| `migrations/0006_rls_security_hardening.sql` | Verrou is_platform_admin, RLS validation_rules / budget_categories, policies durcies |
| `migrations/0007_admin_users.sql` | Admins YCID/LEY : lecture profils + memberships (`is_lead_org_admin()`) |
| `migrations/0008_project_creation.sql` | Création de projet : admins plateforme + policies bootstrap porteur/chef |
| `migrations/0009_avatars.sql` | Photo de profil : colonne avatar_url + bucket Storage « avatars » |
| `migrations/0010_rls_fix_members_recursion.sql` | Fix récursion infinie policies memberships / project_members |
| `migrations/0011_admin_manage_phases.sql` | Les admins gèrent les phases (écran Tâches, PR 9) |
| `migrations/0012_import_runs.sql` | Journal des imports CSV (table import_runs + RLS) |
| `migrations/0013_admin_manage_project_data.sql` | Les admins gèrent budget, indicateurs, mesures, réunions, décisions |
| `migrations/0014_roadmap.sql` | Roadmap participative : ideas, idea_votes, idea_comments + RLS |
| `migrations/0015_project_members_mgmt.sql` | Gestion des membres : admins YCID/LEY + lecture des profils par les connectés |
| `migrations/0016_admin_crud.sql` | CRUD organisations par les admins + suppression de projet (cascade audit) |
| `migrations/0017_user_management.sql` | Rôle plateforme (admin/ycid/user) + statut actif ; is_admin() étendu |
| `migrations/0018_platform_settings.sql` | Configuration de la marque (white-label) : nom, accroche, couleurs, logo + bucket `branding` |
| `migrations/0019_comm_campaigns.sql` | Campagnes de communication (PR 26) : table comm_campaigns + RLS (membres / chef / responsable) |
| `migrations/0020_project_programme.sql` | Programme de rattachement des projets (CEM…) — vision multi-niveaux (PR 27) |
| `migrations/0021_public_page.sql` | Page vitrine publique par projet : colonne `public_token` (opt-in, lien non devinable) (PR 28) |
| `migrations/0022_fix_handle_new_user.sql` | Fix création de comptes (500 unexpected_failure) : `search_path` des triggers profils |
| `migrations/0023_ai_settings.sql` | Configuration IA administrable (fournisseur, modèle, clé) — lecture/écriture admins uniquement (PR 31) |
| `migrations/0024_reports_history_and_brief.sql` | Historique des rapports IA (ai_reports) + brief de campagne (comm_campaigns.brief) (PR 33) |
| `migrations/0025_legal_settings.sql` | Mentions légales administrables (éditeur, adresse, directeur, contact, conservation) (PR 34) |
| `migrations/0026_role_model.sql` | Modèle de rôles : type d'organisation `expert`, rôle projet `referent_mairie`, durcissement de is_project_member (PR 36) |
| `migrations/0027_task_budget_link.sql` | Lien lignes budgétaires ↔ tâches (`budget_lines.task_id`, N lignes → 1 tâche) + trigger de cohérence tâche/phase/projet (PR 40) |
| `migrations/0028_budget_line_task_split.sql` | Répartition d'une ligne sur plusieurs tâches : table `budget_line_tasks` (N:M + montant), reprise des données 0027, `budget_lines.task_id` supprimée (PR 40b) |
| `migrations/0029_documents_storage.sql` | Socle documentaire : bucket Storage **privé** `documents`, `documents.project_id` / `phase_id`, RLS table + bucket (`can_upload_document`) (PR 38a) |
| `migrations/0030_validations_circuit.sql` | Circuit devis → validé → facture → payé : policy d'INSERT manquante sur `validations`, `documents.paid_at`, `validation_orgs_for_document()` (PR 38b) |
| `migrations/0031_validation_orgs_fallback.sql` | Correctif 38b : repli de validation ordonné (règles → financeur → porteuse) au lieu de solliciter financeur ET porteuse |
| `migrations/0032_photos_moment.sql` | Photos avant/pendant/après : enum `doc_moment`, `documents.moment`, index galerie + durcissement du bucket (taille et types MIME côté serveur) (PR 38c) |
| `migrations/0033_phase_budget_computed.sql` | **Destructive** : `phases.budget` supprimée (valeurs archivées au journal d'audit) — le budget d'une phase devient la somme de ses lignes ; `projects.budget` conservé comme montant voté (PR 39) |
| `migrations/0034_storage_stats.sql` | Écran Stockage : `storage_stats()`, `storage_orphans()`, `storage_by_project()` — lecture agrégée de `storage.objects`, réservée aux admins (PR 41) |
| `migrations/0035_storage_stats_all_buckets.sql` | Correctif 41 : `storage_stats()` part de `storage.buckets` (jointure externe) — un espace vide disparaissait de l'inventaire |
| `migrations/0036_validation_decision_scope.sql` | Décider d'une validation revient aux MEMBRES de l'organisation sollicitée ; recours réservé au rôle `admin` (correctif 38b) |
| `migrations/0037_two_platform_roles.sql` | **Deux rôles plateforme** (admin / user) : `is_admin()` réduit au seul rôle admin, périmètre porté par l'appartenance à une organisation, capacité `profiles.can_manage_roadmap` pour la gouvernance produit. Comptes « ycid » convertis (PR 42) |
| `migrations/0038_reader_role_merge.sql` | **Auditeur, seul rôle de consultation** : `validateur` et `lecteur` convertis en `auditeur` (conversions tracées au journal). Le validateur ne validait plus rien depuis la 0036 ; le lecteur faisait doublon avec le rapport IA et la page vitrine publique. Policy « Add measure » resserrée — un auditeur ne saisit pas les chiffres qu'il contrôle. Sans risque à relancer si la première version, qui convertissait vers `lecteur`, a déjà tourné |
| `migrations/0039_read_only_org_scope.sql` | **Le droit de regard n'écrit rien** : générer un rapport d'expert IA exige un rôle projet (la 0024 l'ouvrait à tout membre — depuis la 0037, l'appartenance à une organisation suffisait, et engageait donc la clé du fournisseur d'IA). Lecture des rapports inchangée. `audit_log` reste écrivable par qui agit, sous son propre identifiant |
| `migrations/0040_email_settings.sql` | **Envoi d'emails configurable** : table `email_settings` (SMTP, expéditeur, adresse publique, trace du dernier test), lecture/écriture admins uniquement — même séparation que la 0023, le mot de passe ne transite jamais vers le navigateur. `notifications.emailed_at` + index des non-lues. Livrée avec l'unanimité : une organisation qui ignore qu'on l'attend gèlerait l'engagé |
| `migrations/0041_validation_chain.sql` | **Le circuit réel : porteur PUIS coordinateur.** Le financeur de la ligne ne route plus rien — le MEAE et le Département votent une enveloppe et attendent un compte rendu, pas une approbation ligne à ligne. `validations.step`, `platform_settings.coordinator_org_id`, `validation_chain_for_document()` en remplacement de `validation_orgs_for_document()`, et policy qui interdit de décider avant l'échelon précédent. `validation_rules` n'est plus consultée (jamais renseignée en un an, et incapable d'exprimer un ordre) |
| `migrations/0042_validation_settings.sql` | **Le circuit devient réglable depuis l'application** : `platform_settings.coordinator_min_amount` (seuil sous lequel le coordinateur n'est pas sollicité, 0 = aucun seuil) et `validation_chain_for_document()` qui en tient compte. L'organisation porteuse n'est jamais sautée. Écrans associés : Configuration ▸ Validation, et l'organisation porteuse dans « Modifier la fiche du projet » |

`seed.sql` contient les données de démonstration CEM Liban et s'exécute
**après** les migrations, uniquement sur un environnement de démo.

## Règles

- Ne jamais modifier une migration déjà appliquée en production :
  créer un nouveau fichier `NNNN_description.sql`.
- Toute nouvelle migration doit être idempotente autant que possible
  (`create or replace`, `drop ... if exists`).
- Tenir ce tableau à jour à chaque ajout.

## Installation complète (base neuve ou reset)

`install-complet.sql` = préambule de nettoyage (**destructif**) + migrations
0001 → 0008 concaténées + correctif du trigger admin. À coller en une fois
dans le SQL Editor. Procédure détaillée : `docs/procedure-deploiement.md`.
Ce fichier est généré par concaténation — après toute nouvelle migration,
le regénérer plutôt que l'éditer à la main.

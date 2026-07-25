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

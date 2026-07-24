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

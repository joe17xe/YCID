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

`seed.sql` contient les données de démonstration CEM Liban et s'exécute
**après** les migrations, uniquement sur un environnement de démo.

## Règles

- Ne jamais modifier une migration déjà appliquée en production :
  créer un nouveau fichier `NNNN_description.sql`.
- Toute nouvelle migration doit être idempotente autant que possible
  (`create or replace`, `drop ... if exists`).
- Tenir ce tableau à jour à chaque ajout.

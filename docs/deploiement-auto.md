# Déploiement automatique (CI/CD)

Objectif : à chaque merge sur `master`, le site se met à jour **tout seul**,
sans se connecter au serveur. Repose sur un **runner GitHub Actions
self-hosted** installé sur le VPS, qui exécute `scripts/deploy.sh`.

Le workflow : `.github/workflows/deploy.yml` (déclenché sur push `master`
+ bouton manuel « Run workflow » dans l'onglet Actions).

---

## Installation du runner (une seule fois, sur le VPS)

À faire avec Claude Code sur le VPS, ou à la main. Le runner doit porter
les labels **`self-hosted`** et **`ycid`** (ceux attendus par le workflow).

1. GitHub → dépôt `joe17xe/YCID` → **Settings → Actions → Runners → New
   self-hosted runner** (Linux x64). GitHub affiche les commandes exactes
   avec un token. Exécutez-les sur le VPS, par exemple :

   ```bash
   sudo mkdir -p /opt/actions-runner && cd /opt/actions-runner
   curl -o actions-runner.tar.gz -L <URL_fournie_par_GitHub>
   tar xzf actions-runner.tar.gz
   ./config.sh --url https://github.com/joe17xe/YCID \
     --token <TOKEN_fourni> --labels ycid --name ycid-vps --unattended
   ```

2. Installer le runner en service (démarre au boot) :
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   ```

3. **Droits sudo sans mot de passe** pour le script de déploiement (le
   workflow lance `sudo -n bash /opt/ycid-app/scripts/deploy.sh`).
   Créez `/etc/sudoers.d/ycid-deploy` :
   ```
   <utilisateur_du_runner> ALL=(root) NOPASSWD: /opt/ycid-app/scripts/deploy.sh
   ```
   (remplacez `<utilisateur_du_runner>` par l'utilisateur qui exécute le
   runner — souvent `deploy` ou celui créé à l'étape 1). Vérifiez avec
   `visudo -c`.

Une fois ces 3 étapes faites : **mergez une PR → le site se déploie seul.**
Suivi en direct dans l'onglet **Actions** du dépôt.

---

## (Optionnel) Migrations SQL automatiques

Par défaut, les migrations restent **manuelles** dans le SQL Editor
(sûr : `0001` n'est pas idempotent). Pour les automatiser aussi :

1. Installer `psql` sur le VPS : `sudo apt-get install -y postgresql-client`.
2. Récupérer la **chaîne de connexion** Postgres : Supabase → Settings →
   Database → Connection string (URI). L'ajouter au serveur, hors Git :
   ```bash
   # dans l'environnement du runner / du script (jamais commité)
   export DATABASE_URL='postgresql://postgres:[MDP]@db.nthyaspoutcfefiafqro.supabase.co:5432/postgres'
   export RUN_MIGRATIONS=1
   ```
3. **Amorcer le suivi** (une seule fois) pour ne pas rejouer les migrations
   déjà appliquées à la main. Dans le SQL Editor :
   ```sql
   create table if not exists schema_migrations (
     name text primary key, applied_at timestamptz not null default now());
   insert into schema_migrations(name) values
     ('0001_schema.sql'),('0002_rls_admin_patch.sql'),
     ('0003_rls_fix_recursion.sql'),('0004_rls_fix_project_orgs.sql'),
     ('0005_rls_completed_tasks_admin.sql'),('0006_rls_security_hardening.sql'),
     ('0007_admin_users.sql'),('0008_project_creation.sql'),
     ('0009_avatars.sql'),('0010_rls_fix_members_recursion.sql'),
     ('0011_admin_manage_phases.sql'),('0012_import_runs.sql'),
     ('0013_admin_manage_project_data.sql'),('0014_roadmap.sql'),
     ('0015_project_members_mgmt.sql'),('0016_admin_crud.sql')
   on conflict do nothing;
   ```
   (listez les migrations **déjà appliquées** ; les suivantes s'appliqueront
   automatiquement au prochain déploiement via `scripts/migrate.sh`).

Ensuite, `deploy.sh` applique les migrations en attente avant le build.
Sans `RUN_MIGRATIONS=1` + `DATABASE_URL`, cette étape est simplement ignorée.

---

## Rappel : déploiement manuel (toujours possible)

```bash
sudo bash /opt/ycid-app/scripts/deploy.sh
```

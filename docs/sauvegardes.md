# Sauvegardes — couverture, installation, restauration

Arbitrage du 28/07 : **l'offre Supabase reste Free** tant que
l'adoption ne justifie pas de payer. Conséquence assumée : **aucune
sauvegarde automatique côté hébergeur**. La copie de référence se fait
sur le VPS — `scripts/backup.sh`, un cron quotidien — et c'est une
protection plus forte qu'une option payante : une copie **hors** de
l'infrastructure Supabase survit à une suppression, une corruption,
ou la perte du compte lui-même.

Rappel du malentendu déjà survenu (27/07) : ouvrir une pièce jointe et
relire un devis prouve que le **stockage** fonctionne, pas qu'une
sauvegarde existe. Et une sauvegarde jamais restaurée est une
intention, pas une sauvegarde — d'où la procédure de restauration
ci-dessous, à éprouver une fois pour de vrai.

## Ce qui est couvert — et ce qui ne l'est pas

| Donnée | Couverte par | Notes |
|---|---|---|
| Base (projets, budgets, validations, journal, comptes `auth`) | `pg_dump` quotidien (`/var/backups/ycid/db/*.dump`) | schéma, données et policies |
| Fichiers du Storage (devis, factures, photos, logos) | copie quotidienne (`/var/backups/ycid/storage/<date>/`) | **pas dans la base** — c'est l'angle mort classique |
| Réglages du dashboard Supabase (SMTP auth, providers, URL) | **rien** | peu nombreux : les re-saisir fait partie de la procédure |
| Le code | GitHub (`joe17xe/YCID`) | déjà hors VPS et hors Supabase |

Rotation par défaut : 30 dumps de base, 7 instantanés de fichiers
(incrémentaux par liens durs — un fichier inchangé n'est pas
retéléchargé, le quota de bande passante Free est ménagé).

## Installation sur le VPS (une fois, ~10 minutes)

1. **Le client Postgres — version 17 minimum.** Constaté à la première
   installation (28/07) : Supabase tourne en Postgres 17, et le
   `postgresql-client` d'Ubuntu 24.04 est un 16 — `pg_dump` refuse un
   serveur plus récent que lui (« server version mismatch »). Le
   client 17 vient du dépôt officiel PostgreSQL :
   ```bash
   sudo install -d /usr/share/postgresql-common/pgdg
   sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
     https://www.postgresql.org/media/keys/ACCC4CF8.asc
   echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
     | sudo tee /etc/apt/sources.list.d/pgdg.list
   sudo apt-get update && sudo apt-get install -y postgresql-client-17
   pg_dump --version   # attendu : 17.x
   ```
2. **Le fichier d'identifiants** — `/opt/ycid-app/backup.env`, en
   root, jamais commité :
   ```bash
   sudo tee /opt/ycid-app/backup.env >/dev/null <<'EOF'
   DATABASE_URL='postgresql://postgres:[MOT_DE_PASSE]@db.nthyaspoutcfefiafqro.supabase.co:5432/postgres'
   # BACKUP_DIR=/var/backups/ycid   KEEP_DB=30   KEEP_STORAGE=7
   EOF
   sudo chmod 600 /opt/ycid-app/backup.env
   ```
   La chaîne de connexion : dashboard Supabase ▸ l'icône « Connect » ▸
   chaîne directe (ou « session pooler » si le VPS n'a pas d'IPv6 —
   même mot de passe). Les identifiants du Storage, eux, sont lus dans
   `web/.env.local`, déjà en place pour l'application.
3. **Premier essai, à la main** :
   ```bash
   sudo bash /opt/ycid-app/scripts/backup.sh
   ```
   Attendu : `✅ Sauvegarde OK`, et l'écran **Administration ▸
   Stockage** affiche « Dernière sauvegarde VPS » à l'instant (après
   la migration 0052).
4. **Le cron quotidien** (3 h 17, heure du serveur) :
   ```bash
   sudo tee /etc/cron.d/ycid-backup >/dev/null <<'EOF'
   17 3 * * * root bash /opt/ycid-app/scripts/backup.sh >> /var/log/ycid-backup.log 2>&1
   EOF
   ```

## Le point de contrôle (mensuel, 30 secondes)

L'écran **Administration ▸ Stockage** affiche la date de la dernière
sauvegarde réussie — neutre si elle a moins de 48 h, **orange**
au-delà, **rouge** après 8 jours ou si elle n'a jamais eu lieu. Le
1ᵉʳ du mois : vérifier qu'elle est neutre, et jeter un œil à
`/var/log/ycid-backup.log` en cas de doute. Le script n'horodate
JAMAIS un échec : base et fichiers doivent avoir réussi tous les deux.

## Restauration — à éprouver UNE FOIS sur un projet jetable

Créer un projet Supabase gratuit temporaire (même compte), noter son
URL, sa clé `service_role` et sa chaîne de connexion, puis :

1. **La base** :
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges \
     -d 'postgresql://postgres:[MDP_JETABLE]@db.[REF_JETABLE].supabase.co:5432/postgres' \
     /var/backups/ycid/db/<date>.dump
   ```
   Des avertissements sur les schémas gérés par Supabase (`auth`,
   `storage`, extensions) sont **attendus** : Supabase les possède
   déjà. Ce qui doit passer sans erreur : le schéma `public` entier.
2. **Les fichiers** :
   ```bash
   cd /opt/ycid-app/web && node scripts/restore-storage.mjs \
     /var/backups/ycid/storage/<date> https://[REF_JETABLE].supabase.co [SERVICE_ROLE_JETABLE]
   ```
   L'URL et la clé cibles se passent en arguments, jamais lues dans
   `.env.local` : se tromper d'environnement ne peut pas écraser la
   production.
3. **Vérifier** : `select count(*) from projects;` dans le SQL Editor
   du jetable, et ouvrir deux ou trois fichiers depuis Storage.
4. **Consigner ici** la date et le résultat, puis supprimer le projet
   jetable.

| Date | Restauration éprouvée par | Résultat |
|---|---|---|
| — | — | à faire : première restauration réelle |

Le jour d'un vrai sinistre : même procédure vers un projet neuf, puis
reporter URL et clés dans `web/.env.local` du VPS, re-saisir les
réglages du dashboard (SMTP, auth), et redéployer.

#!/usr/bin/env bash
# ============================================================
# Migrations SQL incrémentales (optionnel, opt-in)
# ============================================================
# Applique les migrations web/supabase/migrations/*.sql qui n'ont pas
# encore été jouées, dans l'ordre, en les traçant dans la table
# schema_migrations. Idempotent : chaque fichier n'est appliqué qu'une
# fois. Nécessite psql et la variable DATABASE_URL (chaîne de connexion
# Postgres Supabase — jamais commitée).
#
# ⚠️ Sur une base DÉJÀ provisionnée, amorcez d'abord le suivi pour ne pas
# rejouer 0001 (création de tables) — voir docs/deploiement-auto.md.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL requis (chaîne de connexion Postgres Supabase)}"
MIG_DIR="$(cd "$(dirname "$0")/../web/supabase/migrations" && pwd)"

command -v psql >/dev/null || { echo "❌ psql introuvable (installez postgresql-client)"; exit 1; }

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
  "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now());"

applied_any=0
for f in "$MIG_DIR"/*.sql; do
  name="$(basename "$f")"
  exists="$(psql "$DATABASE_URL" -tAc "select 1 from schema_migrations where name = '$name'")"
  if [ "$exists" = "1" ]; then
    continue
  fi
  echo "==> Application de $name"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
  psql "$DATABASE_URL" -q -c "insert into schema_migrations(name) values ('$name')"
  applied_any=1
done

if [ "$applied_any" = "0" ]; then
  echo "✅ Aucune migration en attente."
else
  echo "✅ Migrations appliquées."
fi

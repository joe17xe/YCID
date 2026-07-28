#!/usr/bin/env bash
# ============================================================
# Sauvegarde Solid'Pilot — base + fichiers, sur le VPS
# ============================================================
# Arbitrage du 28/07 : offre Supabase Free tant que l'adoption ne
# justifie pas de payer — donc aucune sauvegarde automatique côté
# hébergeur. La copie de référence est ICI, hors de l'infrastructure
# Supabase : elle survivrait à une suppression, une corruption, la
# perte du compte.
#
# Dans l'ordre :
#   1. pg_dump de la base (format custom — schéma, données, policies) ;
#   2. copie des fichiers du Storage (devis, factures, photos : ils ne
#      sont PAS dans la base — l'angle mort classique), incrémentale
#      par liens durs pour ménager le quota de bande passante Free ;
#   3. rotation (30 dumps, 7 instantanés de fichiers par défaut) ;
#   4. point de contrôle (platform_settings.backup_last_at), horodaté
#      SEULEMENT si tout a réussi — l'écran Admin ▸ Stockage l'affiche,
#      et une date qui vieillit s'y voit en orange puis en rouge.
#
# Installation et procédure de restauration : docs/sauvegardes.md.
# Une sauvegarde jamais restaurée est une intention, pas une sauvegarde.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/ycid-app}"
ENV_FILE="${BACKUP_ENV:-$APP_ROOT/backup.env}"
# shellcheck source=/dev/null
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

: "${DATABASE_URL:?DATABASE_URL requis — renseignez $ENV_FILE (voir docs/sauvegardes.md)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ycid}"
KEEP_DB="${KEEP_DB:-30}"
KEEP_STORAGE="${KEEP_STORAGE:-7}"

command -v pg_dump >/dev/null || { echo "❌ pg_dump introuvable (apt install postgresql-client)" >&2; exit 1; }
command -v node >/dev/null || { echo "❌ node introuvable" >&2; exit 1; }

STAMP="$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/storage"

echo "==> 1/4 Base ($STAMP)"
DB_FILE="$BACKUP_DIR/db/$STAMP.dump"
pg_dump -Fc --no-owner --no-privileges -d "$DATABASE_URL" -f "$DB_FILE"
[ -s "$DB_FILE" ] || { echo "❌ Dump vide : $DB_FILE" >&2; exit 1; }
echo "    $(du -h "$DB_FILE" | cut -f1) — $DB_FILE"

echo "==> 2/4 Fichiers du Storage"
node "$APP_ROOT/web/scripts/backup-storage.mjs" "$BACKUP_DIR/storage/$STAMP"

echo "==> 3/4 Rotation (garde $KEEP_DB dumps, $KEEP_STORAGE instantanés)"
ls -1dt "$BACKUP_DIR"/db/*.dump 2>/dev/null | tail -n +"$((KEEP_DB + 1))" | xargs -r rm -f
ls -1dt "$BACKUP_DIR"/storage/*/ 2>/dev/null | tail -n +"$((KEEP_STORAGE + 1))" | xargs -r rm -rf

echo "==> 4/4 Point de contrôle"
node "$APP_ROOT/web/scripts/backup-storage.mjs" --stamp

echo "✅ Sauvegarde OK — base + fichiers ($STAMP)"

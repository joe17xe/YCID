#!/usr/bin/env bash
# ============================================================
# Déploiement Solid'Pilot — commande unique, à lancer en root :
#   sudo bash /opt/ycid-app/scripts/deploy.sh
# ============================================================
# Post-mortem du 23/07/2026 : le processus pm2 « ycid » pointait
# vers /opt/ycid-local (ancien prototype hors Git) — les rebuilds
# dans /opt/ycid-app/web ne servaient à rien. Ce script verrouille
# le bon dossier, le bon utilisateur (deploy) et vérifie le résultat.
set -euo pipefail

APP_DIR="/opt/ycid-app/web"
RUN_AS="deploy"
PORT=5001

if [ "$(id -un)" != "root" ]; then
  echo "❌ Lancez ce script en root : sudo bash $0" >&2
  exit 1
fi

cd "$APP_DIR"

# Le dépôt Git est à la RACINE (/opt/ycid-app) : web/, scripts/ et docs/
# en sont des sous-dossiers. Ne remettre les droits que sur web/ laissait
# donc .git/ intact — et il suffisait qu'une commande git ait été lancée
# en root sur le VPS pour que .git/objects contienne des fichiers root.
# Le pull suivant échouait alors, en tant que deploy, sur :
#   « insufficient permission for adding an object to repository database »
# (déploiement 31 en échec, 25/07/2026). On corrige donc tout le dépôt.
REPO_ROOT="$(git -C "$APP_DIR" -c safe.directory='*' rev-parse --show-toplevel 2>/dev/null || dirname "$APP_DIR")"
echo "==> 1/6 Droits sur $REPO_ROOT (utilisateur $RUN_AS)"
chown -R "$RUN_AS:$RUN_AS" "$REPO_ROOT"
# chown ne rétablit pas les modes : sans le bit d'écriture sur les dossiers,
# git échoue avec la même erreur alors que le propriétaire est correct.
chmod -R u+rwX "$REPO_ROOT"

echo "==> 2/6 Mise à jour du code (origin/master)"
sudo -u "$RUN_AS" git -C "$APP_DIR" pull origin master

echo "==> 3/6 Dépendances"
sudo -u "$RUN_AS" bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund"

# Migrations SQL automatiques — opt-in : uniquement si RUN_MIGRATIONS=1
# et DATABASE_URL défini (voir docs/deploiement-auto.md). Par défaut,
# les migrations restent manuelles dans le SQL Editor (sûr).
if [ "${RUN_MIGRATIONS:-0}" = "1" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "==> 3bis Migrations SQL en attente"
  bash "$(dirname "$0")/migrate.sh"
fi

VERSION="$(sudo -u "$RUN_AS" git -C "$APP_DIR" rev-parse --short HEAD)"
BUILD_TIME="$(date '+%d/%m/%Y %H:%M')"
echo "==> 4/6 Build (version $VERSION — $BUILD_TIME)"
sudo -u "$RUN_AS" bash -c "cd '$APP_DIR' && NEXT_PUBLIC_APP_VERSION='$VERSION' NEXT_PUBLIC_BUILD_TIME='$BUILD_TIME' npm run build"

echo "==> 5/6 Redémarrage pm2 (utilisateur $RUN_AS)"
# Incident 24/07/2026 : « pm2 restart » sans --update-env conservait un
# SUPABASE_SERVICE_ROLE_KEY « eyJ… » (ancienne clé légale) figé dans
# l'environnement pm2, alors que .env.local contenait déjà la bonne clé
# « sb_secret_… ». Résultat : création d'utilisateurs / invitations en échec
# (JWT ES256 rejeté), sans que les redéploiements n'y changent rien.
#
# Correctif : --update-env recharge l'environnement à CHAQUE déploiement pour
# que « next start » reprenne les valeurs de .env.local. env -u retire les
# clés Supabase de l'environnement du shell : elles ne peuvent donc jamais
# masquer celles de .env.local (seule source de vérité).
sudo -u "$RUN_AS" bash -c "cd '$APP_DIR' && env -u SUPABASE_SERVICE_ROLE_KEY -u NEXT_PUBLIC_SUPABASE_ANON_KEY pm2 startOrRestart ecosystem.config.js --update-env"
sudo -u "$RUN_AS" pm2 save

echo "==> 6/6 Vérification"
sleep 3
if curl -sf "http://localhost:$PORT/" | grep -q "sp-appearance"; then
  echo "✅ Déploiement OK — build $VERSION ($BUILD_TIME) en ligne sur le port $PORT"
else
  echo "❌ Le nouveau build ne répond pas comme attendu." >&2
  echo "   Diagnostic : sudo -u $RUN_AS pm2 logs ycid --lines 30 --nostream" >&2
  exit 1
fi

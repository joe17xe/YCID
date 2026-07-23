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
echo "==> 1/6 Droits sur $APP_DIR (utilisateur $RUN_AS)"
chown -R "$RUN_AS:$RUN_AS" "$APP_DIR"

echo "==> 2/6 Mise à jour du code (origin/master)"
sudo -u "$RUN_AS" git -C "$APP_DIR" pull origin master

echo "==> 3/6 Dépendances"
sudo -u "$RUN_AS" bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund"

VERSION="$(sudo -u "$RUN_AS" git -C "$APP_DIR" rev-parse --short HEAD)"
BUILD_TIME="$(date '+%d/%m/%Y %H:%M')"
echo "==> 4/6 Build (version $VERSION — $BUILD_TIME)"
sudo -u "$RUN_AS" bash -c "cd '$APP_DIR' && NEXT_PUBLIC_APP_VERSION='$VERSION' NEXT_PUBLIC_BUILD_TIME='$BUILD_TIME' npm run build"

echo "==> 5/6 Redémarrage pm2 (utilisateur $RUN_AS)"
sudo -u "$RUN_AS" pm2 restart ycid 2>/dev/null \
  || sudo -u "$RUN_AS" bash -c "cd '$APP_DIR' && pm2 start ecosystem.config.js"
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

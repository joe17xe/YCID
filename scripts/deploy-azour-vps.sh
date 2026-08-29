#!/usr/bin/env bash
# ============================================================
# Visit Azour — déploiement sur le VPS (azour.ezrya.fr)
#
#   nohup bash /root/YCID/scripts/deploy-azour-vps.sh > /root/azour.log 2>&1 &
#
# Écrit pour être lancé depuis le terminal web d'Hostinger, qui perd
# les blocs multi-lignes et les commandes longues, et coupe la session
# au bout de quelques minutes : d'où le script versionné (une commande
# courte suffit) et le nohup (le build survit à la déconnexion).
# ============================================================
set -eux

APP=/root/YCID/tourisme
PORT=5002

cd "$APP"
node -v
npm ci
npm run build

pm2 delete visit-azour || true
pm2 start "$APP/node_modules/.bin/next" --name visit-azour --cwd "$APP" -- start -p "$PORT"
pm2 save

sleep 6
echo "--- vérifications ---"
curl -s -o /dev/null -w "PORT_${PORT} %{http_code}\n" "http://127.0.0.1:${PORT}/"
curl -s -o /dev/null -w "PUBLIC %{http_code}\n" https://azour.ezrya.fr/ || true
curl -s "http://127.0.0.1:${PORT}/" | grep -o "Visit Azour" | head -1 || true
echo "=== FINI ==="

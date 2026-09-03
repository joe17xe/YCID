#!/usr/bin/env bash
# ============================================================
# Visit Azour — déploiement sur le VPS (azour.ezrya.fr)
#
#   nohup bash /root/YCID/scripts/deploy-azour-vps.sh > /root/azour.log 2>&1 &
#   tail -f /root/azour.log
#
# Écrit pour être lancé depuis le terminal web d'Hostinger, qui perd
# les blocs multi-lignes et les commandes longues, et coupe la session
# au bout de quelques minutes : d'où le script versionné (une commande
# courte suffit) et le nohup (le build survit à la déconnexion).
#
# Le script se charge lui-même de la branche : le clone du VPS était
# resté sur « master », et un git pull y redéployait l'ancien code sans
# rien signaler. Désormais la branche est explicite, et le commit
# déployé s'affiche en clair avant le build.
# ============================================================
set -eux

REPO=/root/YCID
APP="$REPO/tourisme"
PORT=5002
BRANCHE="${BRANCHE:-claude/azour-tourism-platform-2j3bsf}"

# ————— 1. la bonne branche, à jour —————
cd "$REPO"
git fetch origin "$BRANCHE"
git checkout "$BRANCHE" 2>/dev/null || git checkout -b "$BRANCHE" "origin/$BRANCHE"
# --ff-only : si le clone du VPS porte des commits locaux, on s'arrête
# plutôt que d'écraser quoi que ce soit. Le message dira quoi faire.
git merge --ff-only "origin/$BRANCHE"

echo "--- ce qui va être déployé ---"
git --no-pager log -1 --format='%h %ad %s' --date=short

# ————— 2. build —————
cd "$APP"
node -v
npm ci
npm run build

# ————— 3. service —————
pm2 delete visit-azour || true
pm2 start "$APP/node_modules/.bin/next" --name visit-azour --cwd "$APP" -- start -p "$PORT"
pm2 save

# ————— 4. vérifications —————
sleep 6
echo "--- vérifications ---"
for R in / /reserver /pratique /parcours; do
  curl -s -o /dev/null -w "LOCAL ${R} %{http_code}\n" "http://127.0.0.1:${PORT}${R}"
done
curl -s -o /dev/null -w "PUBLIC / %{http_code}\n" https://azour.ezrya.fr/ || true
# Deux marqueurs de cette version : la page de réservation doit exister,
# et la table de Blue Jay s'afficher. Si l'un manque, le build servi
# n'est pas le bon.
curl -s "http://127.0.0.1:${PORT}/reserver" | grep -c "Visite guidée du village" || true
curl -s "http://127.0.0.1:${PORT}/pratique" | grep -c "sur réservation" || true
echo "=== FINI ==="

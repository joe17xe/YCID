// PM2 — même convention que web/ (Solid'Pilot, port 5001) :
// Visit Azour tourne à côté, sur le port 5002, servi par nginx
// derrière azour.ezrya.fr. Voir docs/tourisme-azour/08-deploiement-ezrya.md
module.exports = {
  apps: [{
    name: 'visit-azour',
    script: 'node_modules/.bin/next',
    args: 'start -p 5002',
    cwd: '/opt/ycid-app/tourisme',
    env: {
      NODE_ENV: 'production',
      PORT: 5002,
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
  }]
}

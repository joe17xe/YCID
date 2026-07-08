module.exports = {
  apps: [{
    name: 'ycid',
    script: 'node_modules/.bin/next',
    args: 'start -p 5001',
    cwd: '/opt/ycid-app',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
  }]
}

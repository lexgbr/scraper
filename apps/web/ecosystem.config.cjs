module.exports = {
  apps: [{
    name: 'scraper-web',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/scraper/apps/web',
    instances: 1,
    exec_mode: 'fork',
    max_restarts: 3,
    min_uptime: '10s',
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      NEXT_PUBLIC_BASE_PATH: '/scraper',
      SELF_BASE_URL: 'http://localhost:3001/scraper'
    }
  }]
};

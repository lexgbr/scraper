# VPS Deployment Guide

Deploy the scraper application to Ubuntu 24.04 VPS at `94.72.102.173/scraper`

## Quick Deployment

### On your VPS:

```bash
# 1. Connect to VPS
ssh root@94.72.102.173

# 2. Download and run deployment script
curl -o deploy.sh https://raw.githubusercontent.com/lexgbr/scraper/main/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

### After deployment:

1. **Configure credentials:**
   ```bash
   nano /var/www/scraper/.env
   ```

   Add your site credentials:
   ```env
   ROMEGAFOODS_USERNAME=your_email
   ROMEGAFOODS_PASSWORD=your_password
   MAXYWHOLESALE_USERNAME=your_email
   MAXYWHOLESALE_PASSWORD=your_password
   ```

2. **Restart the application:**
   ```bash
   pm2 restart scraper-web
   ```

3. **Access your app:**
   - Web interface: `http://94.72.102.173/scraper`
   - API endpoint: `http://94.72.102.173/scraper/api`

## Manual Deployment (Alternative)

If you prefer to deploy manually:

### 1. Install dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs npm nginx

# Install PM2
sudo npm install -g pm2

# Install Playwright
npx playwright install chromium
npx playwright install-deps chromium
```

### 2. Clone and setup

```bash
# Create app directory
sudo mkdir -p /var/www/scraper
cd /var/www/scraper

# Clone repository
sudo git clone https://github.com/lexgbr/scraper.git .

# Install dependencies
sudo npm install

# Setup environment
sudo cp .env.example .env
sudo nano .env  # Add your credentials
```

### 3. Build application

```bash
cd /var/www/scraper/apps/web
sudo npm install
sudo NEXT_PUBLIC_BASE_PATH=/scraper npm run build
```

### 4. Start with PM2

```bash
cd /var/www/scraper/apps/web
sudo PORT=3001 pm2 start npm --name "scraper-web" -- start
sudo pm2 save
sudo pm2 startup systemd
```

### 5. Configure Nginx

Add to your existing Nginx config at `/etc/nginx/sites-available/default`:

```nginx
server {
    listen 80;
    server_name 94.72.102.173;

    # Existing WordPress at /landing
    # ... your WordPress config ...

    # Scraper application at /scraper
    location /scraper {
        rewrite ^/scraper(/.*)$ $1 break;
        rewrite ^/scraper$ / break;

        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /scraper/_next/ {
        rewrite ^/scraper/_next/(.*)$ /_next/$1 break;
        proxy_pass http://localhost:3001;
    }

    location /scraper/api/ {
        rewrite ^/scraper/api/(.*)$ /api/$1 break;
        proxy_pass http://localhost:3001;
    }

    location /scraper/extensions/ {
        alias /var/www/scraper/apps/web/public/extensions/;
        add_header Content-Disposition 'attachment';
    }
}
```

Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Post-Deployment

### Managing the application

```bash
# View status
pm2 status

# View logs
pm2 logs scraper-web

# Restart application
pm2 restart scraper-web

# Stop application
pm2 stop scraper-web

# Monitor resources
pm2 monit
```

### Updating the application

```bash
cd /var/www/scraper
sudo git pull
sudo npm install
cd apps/web
sudo npm install
sudo NEXT_PUBLIC_BASE_PATH=/scraper npm run build
pm2 restart scraper-web
```

### Setting up scheduled scraping

```bash
# Edit crontab
crontab -e

# Add line to run scraper every 6 hours
0 */6 * * * cd /var/www/scraper && /usr/bin/node /var/www/scraper/src/runner.ts >> /var/log/scraper.log 2>&1
```

## Troubleshooting

### Application won't start

```bash
# Check PM2 logs
pm2 logs scraper-web

# Check if port 3001 is in use
sudo lsof -i :3001

# Restart PM2
pm2 restart all
```

### Nginx errors

```bash
# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Test Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Playwright issues

```bash
# Reinstall Playwright dependencies
cd /var/www/scraper
npx playwright install-deps chromium
```

### Permission issues

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/scraper/apps/web/public
sudo chmod -R 755 /var/www/scraper/apps/web/public
```

## Security Recommendations

1. **Use environment variables for secrets** - Never commit credentials to git
2. **Enable firewall:**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 22/tcp
   sudo ufw enable
   ```
3. **Setup SSL with Let's Encrypt** (if using domain):
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```
4. **Regular updates:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

## Architecture

- **Web App**: Next.js running on port 3001
- **Process Manager**: PM2 for automatic restarts
- **Reverse Proxy**: Nginx routing `/scraper` → `localhost:3001`
- **Scraper**: Node.js scripts with Playwright
- **Base Path**: `/scraper` for all routes

## Support

For issues or questions, check the logs:
```bash
pm2 logs scraper-web
sudo tail -f /var/log/nginx/error.log
```

#!/bin/bash

# Scraper Deployment Script for Ubuntu 24.04 VPS
# This script deploys the scraper app to run at /scraper path

set -e

echo "🚀 Starting deployment..."

# Configuration
APP_DIR="/var/www/scraper"
DOMAIN="94.72.102.173"
BASE_PATH="/scraper"
PORT=3001

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Running as root"

# Install system dependencies
echo -e "\n${YELLOW}Installing system dependencies...${NC}"
apt update

# Remove conflicting packages if they exist
apt remove -y nodejs npm || true

# Install Node.js 20 LTS using NodeSource (better for Ubuntu 24.04)
echo -e "\n${YELLOW}Installing Node.js 20 LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
echo -e "\n${YELLOW}Node.js version:${NC}"
node --version
npm --version

# Install Nginx
echo -e "\n${YELLOW}Installing Nginx...${NC}"
apt install -y nginx

# Install PM2 globally
echo -e "\n${YELLOW}Installing PM2...${NC}"
npm install -g pm2

# Create app directory
echo -e "\n${YELLOW}Setting up application directory...${NC}"
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or pull latest code
if [ -d ".git" ]; then
    echo -e "${YELLOW}Pulling latest changes...${NC}"
    git pull
else
    echo -e "${YELLOW}Cloning repository...${NC}"
    git clone https://github.com/lexgbr/scraper.git .
fi

# Install dependencies
echo -e "\n${YELLOW}Installing Node dependencies...${NC}"
npm install

# Install Playwright and dependencies
echo -e "\n${YELLOW}Installing Playwright...${NC}"
npx playwright install chromium
npx playwright install-deps chromium

# Setup environment file
echo -e "\n${YELLOW}Setting up environment variables...${NC}"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${RED}⚠ Please edit .env file with your credentials${NC}"
fi

# Build the web app
echo -e "\n${YELLOW}Building web application...${NC}"
cd apps/web
npm install
NEXT_PUBLIC_BASE_PATH=$BASE_PATH npm run build
cd ../..

# Setup PM2
echo -e "\n${YELLOW}Setting up PM2 process manager...${NC}"
pm2 delete scraper-web 2>/dev/null || true
cd apps/web
PORT=$PORT pm2 start npm --name "scraper-web" -- start
pm2 save
cd ../..

# Enable PM2 startup
pm2 startup systemd -u root --hp /root

# Create Nginx configuration
echo -e "\n${YELLOW}Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/scraper << 'NGINX_EOF'
# Scraper application at /scraper path
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
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}

# Static files for scraper
location /scraper/_next/ {
    rewrite ^/scraper/_next/(.*)$ /_next/$1 break;
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# API routes for scraper
location /scraper/api/ {
    rewrite ^/scraper/api/(.*)$ /api/$1 break;
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache_bypass $http_upgrade;
}

# Extension downloads
location /scraper/extensions/ {
    alias /var/www/scraper/apps/web/public/extensions/;
    add_header Content-Disposition 'attachment';
}
NGINX_EOF

# Include scraper config in main nginx config if not already included
if ! grep -q "include /etc/nginx/sites-available/scraper;" /etc/nginx/sites-available/default; then
    # Backup original config
    cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

    # Add include before the closing brace of server block
    sed -i '/^[[:space:]]*server[[:space:]]*{/,/^}/ {
        /^}/i \    # Include scraper application\n    include /etc/nginx/sites-available/scraper;
    }' /etc/nginx/sites-available/default
fi

# Test Nginx configuration
echo -e "\n${YELLOW}Testing Nginx configuration...${NC}"
nginx -t

# Reload Nginx
echo -e "\n${YELLOW}Reloading Nginx...${NC}"
systemctl reload nginx

# Set permissions
echo -e "\n${YELLOW}Setting permissions...${NC}"
chown -R www-data:www-data $APP_DIR/apps/web/public
chmod -R 755 $APP_DIR/apps/web/public

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo -e "\n${GREEN}Application is now running at:${NC}"
echo -e "  ${YELLOW}http://$DOMAIN$BASE_PATH${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  1. Edit $APP_DIR/.env with your credentials"
echo -e "  2. Restart the app: pm2 restart scraper-web"
echo -e "  3. View logs: pm2 logs scraper-web"
echo -e "\n${YELLOW}Useful commands:${NC}"
echo -e "  pm2 status              - Check application status"
echo -e "  pm2 restart scraper-web - Restart application"
echo -e "  pm2 logs scraper-web    - View application logs"
echo -e "  pm2 monit               - Monitor resources"

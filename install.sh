#!/bin/bash

# SPS - Survival Preparedness System
# Master Installation Script
# 
# This script installs everything needed to run SPS on a fresh Ubuntu/Debian server
# Run with: sudo bash install.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  SPS Master Installation Script"
echo "========================================"
echo ""
echo "This will install and configure:"
echo "  ✓ PostgreSQL 14+ database"
echo "  ✓ Node.js 18+ runtime"
echo "  ✓ Nginx web server"
echo "  ✓ PM2 process manager"
echo "  ✓ FFmpeg for video processing"
echo "  ✓ yt-dlp for video downloads"
echo "  ✓ Kiwix server for offline content"
echo "  ✓ All SPS dependencies"
echo ""
echo "Requirements:"
echo "  - Ubuntu 20.04+ or Debian 11+"
echo "  - 2GB+ RAM"
echo "  - 20GB+ free disk space"
echo "  - Root/sudo access"
echo ""
read -p "Continue with installation? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo bash install.sh${NC}"
    exit 1
fi

# Detect installation directory
INSTALL_DIR="/var/www/sps"
if [ -d "$(pwd)/backend" ]; then
    INSTALL_DIR="$(pwd)"
    echo -e "${GREEN}Using current directory: ${INSTALL_DIR}${NC}"
fi

cd ${INSTALL_DIR}

# Update system
echo ""
echo "========================================"
echo "STEP 1: Updating system packages"
echo "========================================"
apt update
apt upgrade -y

# Install PostgreSQL
echo ""
echo "========================================"
echo "STEP 2: Installing PostgreSQL"
echo "========================================"
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL already installed${NC}"
else
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
    echo -e "${GREEN}✓ PostgreSQL installed${NC}"
fi

# Install Node.js
echo ""
echo "========================================"
echo "STEP 3: Installing Node.js"
echo "========================================"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js already installed: ${NODE_VERSION}${NC}"
else
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    echo -e "${GREEN}✓ Node.js installed${NC}"
fi

# Install Nginx
echo ""
echo "========================================"
echo "STEP 4: Installing Nginx"
echo "========================================"
if command -v nginx &> /dev/null; then
    echo -e "${GREEN}✓ Nginx already installed${NC}"
else
    apt install -y nginx
    systemctl start nginx
    systemctl enable nginx
    echo -e "${GREEN}✓ Nginx installed${NC}"
fi

# Install PM2
echo ""
echo "========================================"
echo "STEP 5: Installing PM2"
echo "========================================"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✓ PM2 already installed${NC}"
else
    npm install -g pm2
    echo -e "${GREEN}✓ PM2 installed${NC}"
fi

# Install FFmpeg and yt-dlp
echo ""
echo "========================================"
echo "STEP 6: Installing FFmpeg and yt-dlp"
echo "========================================"
apt install -y ffmpeg python3-pip
pip3 install yt-dlp
echo -e "${GREEN}✓ Video processing tools installed${NC}"

# Install Kiwix (optional)
echo ""
echo "========================================"
echo "STEP 7: Installing Kiwix Server"
echo "========================================"
if [ -f "${INSTALL_DIR}/scripts/install-kiwix.sh" ]; then
    bash ${INSTALL_DIR}/scripts/install-kiwix.sh
else
    echo -e "${YELLOW}⚠ Kiwix installation script not found, skipping${NC}"
fi

# Setup database
echo ""
echo "========================================"
echo "STEP 8: Setting up PostgreSQL database"
echo "========================================"

# Generate secure password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Create database and user
sudo -u postgres psql <<EOF
-- Drop if exists (for clean install)
DROP DATABASE IF EXISTS sps_db;
DROP USER IF EXISTS sps_user;

-- Create database and user
CREATE DATABASE sps_db;
CREATE USER sps_user WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE sps_db TO sps_user;
ALTER DATABASE sps_db OWNER TO sps_user;
\c sps_db
GRANT ALL ON SCHEMA public TO sps_user;
EOF

echo -e "${GREEN}✓ Database created${NC}"

# Import schemas
echo "Importing database schemas..."
sudo -u postgres psql -d sps_db -f ${INSTALL_DIR}/database/schema.sql
sudo -u postgres psql -d sps_db -f ${INSTALL_DIR}/database/videos-schema.sql
sudo -u postgres psql -d sps_db -f ${INSTALL_DIR}/database/sharing-schema.sql
echo -e "${GREEN}✓ Schemas imported${NC}"

# Setup backend
echo ""
echo "========================================"
echo "STEP 9: Setting up backend"
echo "========================================"
cd ${INSTALL_DIR}/backend

# Install dependencies
npm install

# Create .env file
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

cat > .env << EOFENV
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sps_db
DB_USER=sps_user
DB_PASSWORD=${DB_PASSWORD}

# JWT Configuration
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=30d

# CORS Configuration
ALLOWED_ORIGINS=http://localhost,http://localhost:80

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10000
EOFENV

echo -e "${GREEN}✓ Backend configured${NC}"

# Create directories
mkdir -p ${INSTALL_DIR}/uploads
mkdir -p ${INSTALL_DIR}/videos
mkdir -p ${INSTALL_DIR}/kiwix/data
mkdir -p ${INSTALL_DIR}/kiwix/library

# Set permissions
chown -R www-data:www-data ${INSTALL_DIR}
chmod -R 755 ${INSTALL_DIR}

# Configure Nginx
echo ""
echo "========================================"
echo "STEP 10: Configuring Nginx"
echo "========================================"

# Check if nginx config exists
if [ -f "/etc/nginx/sites-enabled/sps" ]; then
    echo -e "${GREEN}✓ Nginx already configured${NC}"
else
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Create symlink if config exists
    if [ -f "/etc/nginx/sites-available/sps" ]; then
        ln -s /etc/nginx/sites-available/sps /etc/nginx/sites-enabled/sps
    fi
    
    # Test and reload
    nginx -t
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx configured${NC}"
fi

# Start backend with PM2
echo ""
echo "========================================"
echo "STEP 11: Starting backend API"
echo "========================================"
cd ${INSTALL_DIR}/backend

# Stop if already running
pm2 delete sps-api 2>/dev/null || true

# Start
pm2 start server.js --name sps-api
pm2 save
pm2 startup

echo -e "${GREEN}✓ Backend started${NC}"

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "========================================"
echo "  Installation Complete! 🎉"
echo "========================================"
echo ""
echo -e "${GREEN}Your SPS system is now running!${NC}"
echo ""
echo "Access your system:"
echo "  Homepage:  http://${SERVER_IP}/"
echo "  Dashboard: http://${SERVER_IP}/dashboard.html"
echo "  Videos:    http://${SERVER_IP}/videos.html"
echo "  Kiwix:     http://${SERVER_IP}/kiwix.html"
echo ""
echo "Database credentials saved in:"
echo "  ${INSTALL_DIR}/backend/.env"
echo ""
echo "Management commands:"
echo "  pm2 status          - Check API status"
echo "  pm2 logs sps-api    - View logs"
echo "  pm2 restart sps-api - Restart API"
echo ""
echo "Next steps:"
echo "  1. Create your first user account"
echo "  2. Setup SSL with certbot (recommended)"
echo "  3. Configure firewall (ufw)"
echo "  4. Setup automated backups"
echo ""
echo "Documentation: ${INSTALL_DIR}/README.md"
echo ""

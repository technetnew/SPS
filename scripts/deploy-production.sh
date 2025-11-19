#!/bin/bash

# SPS Production Deployment Script

set -e

echo "========================================"
echo "  SPS Production Deployment"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

SCRIPT_DIR="/var/www/sps/scripts"

echo "This will:"
echo "  1. Configure Nginx reverse proxy"
echo "  2. Set up PM2 for process management"
echo "  3. Enable auto-start on boot"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Step 1: Setup Nginx
echo ""
echo "========================================"
echo "STEP 1: Configuring Nginx"
echo "========================================"
bash ${SCRIPT_DIR}/setup-nginx.sh

# Step 2: Setup PM2
echo ""
echo "========================================"
echo "STEP 2: Setting up PM2"
echo "========================================"
bash ${SCRIPT_DIR}/setup-pm2.sh

# Update .env to production
echo ""
echo "========================================"
echo "STEP 3: Updating Environment"
echo "========================================"
sed -i 's/NODE_ENV=development/NODE_ENV=production/' /var/www/sps/backend/.env
echo "✓ Set NODE_ENV=production"

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Your SPS system is now running in production mode!"
echo ""
echo "Access your site:"
echo "  Homepage:  http://$(hostname -I | awk '{print $1}')/"
echo "  Dashboard: http://$(hostname -I | awk '{print $1}')/dashboard.html"
echo "  API:       http://$(hostname -I | awk '{print $1}')/api"
echo ""
echo "Management Commands:"
echo "  View logs:    pm2 logs sps-api"
echo "  Restart API:  pm2 restart sps-api"
echo "  Stop API:     pm2 stop sps-api"
echo "  Status:       pm2 status"
echo ""
echo "Next steps:"
echo "  - Test the site in your browser"
echo "  - Setup SSL with Let's Encrypt (optional)"
echo "  - Configure firewall"
echo "  - Setup database backups"
echo ""

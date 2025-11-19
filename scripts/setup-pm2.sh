#!/bin/bash

# Setup PM2 for SPS Backend

set -e

echo "================================="
echo "SPS PM2 Setup"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "Step 1/5: Installing PM2..."
npm install -g pm2

echo ""
echo "Step 2/5: Stopping any existing processes..."
sudo -u tne pm2 delete sps-api 2>/dev/null || true

echo ""
echo "Step 3/5: Starting SPS API with PM2..."
cd /var/www/sps/backend
sudo -u tne pm2 start server.js --name sps-api

echo ""
echo "Step 4/5: Saving PM2 process list..."
sudo -u tne pm2 save

echo ""
echo "Step 5/5: Setting up PM2 startup script..."
sudo -u tne pm2 startup systemd -u tne --hp /home/tne | tail -n 1 > /tmp/pm2-startup-command.sh
chmod +x /tmp/pm2-startup-command.sh
bash /tmp/pm2-startup-command.sh
rm /tmp/pm2-startup-command.sh

echo ""
echo "================================="
echo "PM2 Setup Complete!"
echo "================================="
echo ""
echo "PM2 Commands:"
echo "  View logs:    pm2 logs sps-api"
echo "  Restart:      pm2 restart sps-api"
echo "  Stop:         pm2 stop sps-api"
echo "  Status:       pm2 status"
echo "  Monitor:      pm2 monit"
echo ""

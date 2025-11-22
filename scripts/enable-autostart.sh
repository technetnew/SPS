#!/bin/bash

# Enable PM2 Auto-start on Boot
# Run this script with: sudo bash /var/www/sps/scripts/enable-autostart.sh

set -e

echo "================================="
echo "SPS Auto-Start Setup"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash $0"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=$(who am i | awk '{print $1}')
if [ -z "$ACTUAL_USER" ]; then
    ACTUAL_USER="tne"
fi

echo "Setting up auto-start for user: $ACTUAL_USER"
echo ""

# Save current PM2 processes
echo "Step 1/2: Saving current PM2 processes..."
sudo -u $ACTUAL_USER pm2 save

# Set up PM2 startup
echo ""
echo "Step 2/2: Configuring PM2 to start on boot..."
STARTUP_CMD=$(sudo -u $ACTUAL_USER pm2 startup systemd -u $ACTUAL_USER --hp /home/$ACTUAL_USER | grep "sudo")
eval "$STARTUP_CMD"

echo ""
echo "================================="
echo "Auto-Start Enabled!"
echo "================================="
echo ""
echo "The following processes will start automatically on boot:"
sudo -u $ACTUAL_USER pm2 list
echo ""
echo "To disable auto-start: pm2 unstartup systemd"
echo ""

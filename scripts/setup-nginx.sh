#!/bin/bash

# Setup Nginx for SPS

set -e

echo "================================="
echo "SPS Nginx Configuration"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "Step 1/4: Copying Nginx configuration..."
cp /tmp/sps-nginx.conf /etc/nginx/sites-available/sps

echo "Step 2/4: Removing default site..."
rm -f /etc/nginx/sites-enabled/default

echo "Step 3/4: Enabling SPS site..."
ln -sf /etc/nginx/sites-available/sps /etc/nginx/sites-enabled/sps

echo "Step 4/4: Testing and reloading Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo ""
    echo "================================="
    echo "Nginx configured successfully!"
    echo "================================="
    echo ""
    echo "Your SPS site is now available at:"
    echo "  Frontend: http://your-server-ip/"
    echo "  Dashboard: http://your-server-ip/dashboard.html"
    echo "  API: http://your-server-ip/api"
    echo ""
else
    echo "Nginx configuration test failed!"
    exit 1
fi

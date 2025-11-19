#!/bin/bash

echo "================================="
echo "Fixing SPS Permissions & Nginx"
echo "================================="
echo ""

# Fix file permissions
echo "Step 1/3: Fixing file permissions..."
chmod 755 /var/www/sps/js /var/www/sps/css /var/www/sps/backend /var/www/sps/scripts
chmod 644 /var/www/sps/*.html /var/www/sps/*.md 2>/dev/null || true
chmod 644 /var/www/sps/js/*.js
chmod 644 /var/www/sps/css/*.css
chmod 644 /var/www/sps/script.js /var/www/sps/styles.css
echo "✓ Permissions fixed"

# Update Nginx config
echo ""
echo "Step 2/3: Updating Nginx configuration..."
cp /tmp/sps-nginx-fixed.conf /etc/nginx/sites-available/sps

# Test Nginx
echo ""
echo "Step 3/3: Testing and reloading Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    systemctl reload nginx
    echo "✓ Nginx reloaded successfully"
else
    echo "✗ Nginx configuration error"
    exit 1
fi

echo ""
echo "================================="
echo "Fix Complete!"
echo "================================="
echo ""
echo "Test your site:"
echo "  Homepage:  http://192.168.1.111/"
echo "  Dashboard: http://192.168.1.111/dashboard.html"
echo "  API:       http://192.168.1.111/api/auth/login"
echo ""

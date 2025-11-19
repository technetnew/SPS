#!/bin/bash

# SPS PostgreSQL Installation Script
# Run with: sudo bash install-postgres.sh

set -e

echo "================================="
echo "SPS PostgreSQL Installation"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Update package lists
echo "Step 1/7: Updating package lists..."
apt update

# Install PostgreSQL
echo ""
echo "Step 2/7: Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
echo ""
echo "Step 3/7: Starting PostgreSQL service..."
systemctl start postgresql
systemctl enable postgresql

# Check status
echo ""
echo "PostgreSQL Status:"
systemctl status postgresql --no-pager | head -10

echo ""
echo "================================="
echo "PostgreSQL installed successfully!"
echo "================================="
echo ""
echo "Next, run the database setup script:"
echo "  sudo bash /var/www/sps/scripts/setup-database.sh"

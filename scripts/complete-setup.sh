#!/bin/bash

# Complete SPS Setup Script
# Run with: sudo bash complete-setup.sh

set -e

echo "========================================"
echo "  SPS Complete Installation & Setup"
echo "========================================"
echo ""
echo "This script will:"
echo "  1. Install PostgreSQL"
echo "  2. Create database and user"
echo "  3. Import schema"
echo "  4. Install Node.js"
echo "  5. Install backend dependencies"
echo "  6. Test the setup"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

SCRIPT_DIR="/var/www/sps/scripts"

# Make scripts executable
chmod +x ${SCRIPT_DIR}/*.sh

# Step 1: Install PostgreSQL
echo ""
echo "========================================"
echo "STEP 1: Installing PostgreSQL"
echo "========================================"
bash ${SCRIPT_DIR}/install-postgres.sh

# Step 2: Setup Database
echo ""
echo "========================================"
echo "STEP 2: Setting up Database"
echo "========================================"
bash ${SCRIPT_DIR}/setup-database.sh

# Step 3: Install Node.js
echo ""
echo "========================================"
echo "STEP 3: Installing Node.js"
echo "========================================"
bash ${SCRIPT_DIR}/install-nodejs.sh

# Step 4: Install Dependencies
echo ""
echo "========================================"
echo "STEP 4: Installing Backend Dependencies"
echo "========================================"
cd /var/www/sps/backend

# Create uploads directory
mkdir -p uploads
chown -R tne:tne uploads

# Install npm packages
echo "Installing npm packages..."
sudo -u tne npm install

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "✓ PostgreSQL installed and running"
echo "✓ Database created and schema imported"
echo "✓ Node.js and dependencies installed"
echo "✓ Backend configured"
echo ""
echo "To start the API server:"
echo "  cd /var/www/sps/backend"
echo "  npm run dev"
echo ""
echo "API will be available at: http://localhost:3000"
echo "Health check: http://localhost:3000/health"
echo ""
echo "Configuration saved in: /var/www/sps/backend/.env"

#!/bin/bash

# SPS Node.js Installation Script
# Run with: sudo bash install-nodejs.sh

set -e

echo "================================="
echo "Node.js Installation"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "Node.js is already installed: $NODE_VERSION"
    echo ""
    read -p "Do you want to reinstall/update? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

echo "Step 1/3: Adding NodeSource repository (Node.js 18.x LTS)..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

echo ""
echo "Step 2/3: Installing Node.js..."
apt install -y nodejs

echo ""
echo "Step 3/3: Verifying installation..."
echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"

echo ""
echo "================================="
echo "Node.js installed successfully!"
echo "================================="
echo ""
echo "Next, install backend dependencies:"
echo "  cd /var/www/sps/backend"
echo "  npm install"

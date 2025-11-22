#!/bin/bash
# Phase 1: System Cleanup and Dependencies
# OpenStreetMap Rails Port + Tile Server Setup

set -e  # Exit on error

echo "=========================================="
echo "Phase 1: System Cleanup & Dependencies"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

echo "Step 1: Removing old/conflicting Ruby installations"
echo "---------------------------------------------------"

# Remove system Ruby if it exists
if command -v ruby &> /dev/null; then
    print_warning "Removing system Ruby..."
    apt-get remove -y ruby ruby-dev ruby-full rubygems 2>/dev/null || true
    apt-get purge -y ruby* 2>/dev/null || true
fi

# Clean up any leftover Ruby configs
rm -rf /usr/lib/ruby 2>/dev/null || true
rm -rf /usr/share/ruby* 2>/dev/null || true

print_status "Ruby cleanup complete"
echo ""

echo "Step 2: Managing Node.js"
echo "------------------------"

# We'll keep the existing Node 18 but install nvm for user-level management
# Node 18 is fine for Rails asset compilation
print_warning "Keeping system Node.js v18.20.8 (compatible)"
print_warning "Will also install nvm for user flexibility"
echo ""

echo "Step 3: Checking PostgreSQL"
echo "----------------------------"

POSTGRES_VERSION=$(psql --version | grep -oP '\d+' | head -1)
print_status "PostgreSQL $POSTGRES_VERSION detected"

if [ "$POSTGRES_VERSION" -ge 14 ]; then
    print_status "PostgreSQL version is sufficient (16.x)"
else
    print_error "PostgreSQL version too old. Need 14+."
    exit 1
fi

# Check PostGIS
if dpkg -l | grep -q postgresql-16-postgis-3; then
    print_status "PostGIS 3.x already installed"
else
    print_warning "PostGIS not found, will install..."
    apt-get install -y postgresql-16-postgis-3 postgresql-16-postgis-3-scripts
fi

echo ""

echo "Step 4: Removing old Mapnik if exists"
echo "--------------------------------------"

# Remove any old Mapnik installations
apt-get remove -y libmapnik* mapnik-utils python3-mapnik 2>/dev/null || true
print_status "Old Mapnik removed"
echo ""

echo "Step 5: Installing system dependencies"
echo "---------------------------------------"

# Update package lists
apt-get update

# Essential build tools
print_warning "Installing build essentials..."
apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    unzip \
    libssl-dev \
    libreadline-dev \
    zlib1g-dev \
    autoconf \
    bison \
    libyaml-dev \
    libncurses5-dev \
    libffi-dev \
    libgdbm-dev \
    pkg-config

print_status "Build tools installed"

# Image processing libraries (needed for Rails)
print_warning "Installing image processing libraries..."
apt-get install -y \
    libxml2-dev \
    libxslt1-dev \
    imagemagick \
    libmagickwand-dev \
    libvips-dev \
    libvips-tools

print_status "Image libraries installed"

# Geospatial libraries
print_warning "Installing geospatial libraries..."
apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    libgeos-dev \
    libboost-all-dev

print_status "Geospatial libraries installed"

# PostgreSQL development files
print_warning "Installing PostgreSQL dev packages..."
apt-get install -y \
    postgresql-server-dev-16 \
    libpq-dev

print_status "PostgreSQL dev packages installed"

# Mapnik 3.1+ and dependencies (for tile rendering)
print_warning "Installing Mapnik 3.1+ and dependencies..."
apt-get install -y \
    libmapnik3.1 \
    libmapnik-dev \
    mapnik-utils \
    python3-mapnik \
    fonts-noto-cjk \
    fonts-noto-hinted \
    fonts-noto-unhinted \
    fonts-hanazono \
    fonts-unifont

print_status "Mapnik installed"

# Apache2 and mod_tile dependencies
print_warning "Installing Apache2 and mod_tile dependencies..."
apt-get install -y \
    apache2 \
    apache2-dev \
    libapache2-mod-tile \
    renderd

# Stop Apache for now (we'll configure it later)
systemctl stop apache2

print_status "Apache2 and mod_tile installed"

# Additional tools for OSM
print_warning "Installing OSM-specific tools..."
apt-get install -y \
    osm2pgsql \
    osmosis \
    osmium-tool

print_status "OSM tools installed"

# JavaScript runtime
apt-get install -y nodejs

print_status "JavaScript runtime confirmed"

echo ""
echo "Step 6: Installing rbenv for Ruby management"
echo "---------------------------------------------"

# Install rbenv for the actual user (not root)
ACTUAL_USER="${SUDO_USER:-$USER}"
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)

print_warning "Installing rbenv for user: $ACTUAL_USER"

# Install rbenv
if [ ! -d "$ACTUAL_HOME/.rbenv" ]; then
    su - $ACTUAL_USER -c "git clone https://github.com/rbenv/rbenv.git ~/.rbenv"
    su - $ACTUAL_USER -c "cd ~/.rbenv && src/configure && make -C src"
    print_status "rbenv cloned and compiled"
else
    print_warning "rbenv already exists"
fi

# Install ruby-build plugin
if [ ! -d "$ACTUAL_HOME/.rbenv/plugins/ruby-build" ]; then
    su - $ACTUAL_USER -c "git clone https://github.com/rbenv/ruby-build.git ~/.rbenv/plugins/ruby-build"
    print_status "ruby-build plugin installed"
else
    print_warning "ruby-build already exists"
fi

# Add rbenv to PATH in .bashrc if not already there
if ! grep -q 'rbenv init' "$ACTUAL_HOME/.bashrc"; then
    su - $ACTUAL_USER -c "echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.profile"
    su - $ACTUAL_USER -c "echo 'eval "$(rbenv init - bash)"' >> ~/.profile"
    print_status "rbenv added to .bashrc"
fi

echo ""
echo "Step 7: Installing nvm for Node.js management"
echo "----------------------------------------------"

# Install nvm for user
if [ ! -d "$ACTUAL_HOME/.nvm" ]; then
    su - $ACTUAL_USER -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
    print_status "nvm installed"
else
    print_warning "nvm already exists"
fi

echo ""
echo "Step 8: Installing Ruby 3.1.x via rbenv"
echo "---------------------------------------"

print_warning "This may take 10-15 minutes..."

# Install Ruby 3.1.4 (compatible with Rails Port)
su - $ACTUAL_USER -c "source ~/.bashrc && rbenv install 3.1.4 -s"
su - $ACTUAL_USER -c "source ~/.bashrc && rbenv global 3.1.4"
su - $ACTUAL_USER -c "source ~/.bashrc && rbenv rehash"

print_status "Ruby 3.1.4 installed via rbenv"

# Install bundler
su - $ACTUAL_USER -c "source ~/.bashrc && gem install bundler"
su - $ACTUAL_USER -c "source ~/.bashrc && rbenv rehash"

print_status "Bundler installed"

echo ""
echo "=========================================="
echo "Phase 1 Complete!"
echo "=========================================="
echo ""
echo "Installed:"
echo "  ✓ PostgreSQL 16 + PostGIS 3"
echo "  ✓ Mapnik 3.1+"
echo "  ✓ Apache2 + mod_tile + renderd"
echo "  ✓ osm2pgsql, osmosis, osmium-tool"
echo "  ✓ rbenv + Ruby 3.1.4"
echo "  ✓ nvm (optional)"
echo "  ✓ All system dependencies"
echo ""
echo "Next Steps:"
echo "  1. Log out and log back in (or run: source ~/.bashrc)"
echo "  2. Verify Ruby: ruby --version (should show 3.1.4)"
echo "  3. Proceed to Phase 2: Database setup"
echo ""
echo "Verification commands:"
echo "  ruby --version"
echo "  gem --version"
echo "  bundle --version"
echo "  psql --version"
echo "  mapnik-config --version"
echo ""

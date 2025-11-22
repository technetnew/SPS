#!/bin/bash
# SPS Offline OpenStreetMap Installation Script
# Full offline OSM support with PostGIS, osm2pgsql, Nominatim deps, and TileServer GL

set -e

echo "==================================="
echo "SPS Offline OSM Installation"
echo "==================================="
echo ""

# Require root
if [ "$EUID" -ne 0 ]; then
    echo "Run this script as root or with sudo"
    exit 1
fi

echo "[1/6] Updating package lists..."
apt update

echo "[2/6] Installing PostgreSQL PostGIS extensions..."
apt install -y postgresql-16-postgis-3 postgresql-contrib postgis

echo "[3/6] Installing osm2pgsql (OSM data importer)..."
apt install -y osm2pgsql

echo "[4/6] Installing Nominatim build dependencies..."
apt install -y \
    build-essential cmake g++ \
    libboost-dev libboost-system-dev libboost-filesystem-dev libboost-thread-dev \
    libexpat1-dev zlib1g-dev libbz2-dev libpq-dev libproj-dev \
    lua5.3 liblua5.3-dev \
    nlohmann-json3-dev \
    php-cli php-pgsql php-intl php-mbstring \
    wget curl unzip

echo "[5/6] Ensuring Node.js and npm exist..."
if ! command -v npm >/dev/null 2>&1; then
    apt install -y nodejs npm
fi

echo "[6/6] Installing TileServer GL (community package)..."
npm install -g tileserver-gl

echo "Creating local OSM PostgreSQL database..."

su - postgres << 'EOF'
-- create database if missing
if ! psql -lqt | cut -d \| -f 1 | grep -qw osm; then
    createdb osm
    echo "Database 'osm' created"
else
    echo "Database 'osm' already exists"
fi

-- enable extensions
psql -d osm -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -d osm -c "CREATE EXTENSION IF NOT EXISTS hstore;"

-- create user if missing
if ! psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='osm'" | grep -q 1; then
    psql -c "CREATE USER osm WITH PASSWORD 'osm_offline_2025';"
    echo "User 'osm' created"
else
    echo "User 'osm' already exists"
fi

-- grant permissions
psql -c "GRANT ALL PRIVILEGES ON DATABASE osm TO osm;"
EOF

echo ""
echo "==================================="
echo "Installation Complete"
echo "==================================="
echo ""
echo "Installed components:"
echo "  ✓ PostgreSQL + PostGIS"
echo "  ✓ osm2pgsql (OSM importer)"
echo "  ✓ Nominatim build dependencies"
echo "  ✓ TileServer GL (npm: tileserver-gl)"
echo "  ✓ PostgreSQL database 'osm' with user 'osm'"
echo ""
echo "OSM Database credentials:"
echo "  Database: osm"
echo "  User:     osm"
echo "  Password: osm_offline_2025"
echo "  Host:     localhost"
echo "  Port:     5432"
echo ""
echo "Next steps (manual):"
echo "1. Download OSM data (planet or region), for example:"
echo "   wget https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf"
echo ""
echo "2. Import into PostgreSQL with osm2pgsql, for example:"
echo "   osm2pgsql -c -d osm -U osm --slim planet-latest.osm.pbf"
echo ""
echo "3. Generate vector tiles into an MBTiles file or directory"
echo "   using your chosen tool (OpenMapTiles workflow or similar)."
echo ""
echo "4. Start TileServer GL against your tiles, for example:"
echo "   tileserver-gl /path/to/your.mbtiles --port 8081"
echo ""
echo "Then wire gps.html to use:"
echo "   - TileServer GL at http://your-server:8081"
echo "   - Local Nominatim instance for address search (once installed)"
echo ""

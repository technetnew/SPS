#!/bin/bash
# Start Photon Geocoder (Optional - only needed for offline address search)

echo "========================================="
echo "Photon Geocoder Startup Script"
echo "========================================="
echo ""

PHOTON_JAR="/var/www/sps/osm-data/nominatim/photon-0.4.0.jar"
OSM_DATA="/var/www/sps/osm-data/data/current.osm.pbf"
PHOTON_DATA="/var/www/sps/osm-data/nominatim/photon_data"

# Check if Photon JAR exists
if [ ! -f "$PHOTON_JAR" ]; then
    echo "❌ Error: Photon JAR not found at $PHOTON_JAR"
    echo ""
    echo "Download with:"
    echo "  cd /var/www/sps/osm-data/nominatim"
    echo "  wget https://github.com/komoot/photon/releases/download/0.4.0/photon-0.4.0.jar"
    echo ""
    exit 1
fi

echo "✓ Photon JAR found: $PHOTON_JAR"
echo ""

# Check if data has been imported
if [ ! -d "$PHOTON_DATA" ]; then
    echo "⚠️  Photon data not found. Importing OSM data..."
    echo "This may take 30-60 minutes for state-level data."
    echo ""

    if [ ! -f "$OSM_DATA" ]; then
        echo "❌ Error: OSM data file not found at $OSM_DATA"
        exit 1
    fi

    echo "Importing from: $OSM_DATA"
    cd /var/www/sps/osm-data/nominatim

    java -jar "$PHOTON_JAR" \
        -nominatim-import \
        -nominatim-db "$OSM_DATA" \
        -data-dir "$PHOTON_DATA"

    echo ""
    echo "✓ Import complete!"
    echo ""
fi

# Stop existing geocoder if running
pm2 delete osm-geocoder 2>/dev/null || true

echo "Starting Photon geocoder on port 7070..."
echo ""

# Start Photon with PM2
cd /var/www/sps/osm-data/nominatim

pm2 start java \
    --name osm-geocoder \
    -- \
    -jar "$PHOTON_JAR" \
    -port 7070 \
    -data-dir "$PHOTON_DATA"

pm2 save

echo ""
echo "========================================="
echo "Geocoder Started!"
echo "========================================="
echo ""
echo "Access at: http://localhost:7070"
echo ""
echo "Test search:"
echo "  curl 'http://localhost:7070/api?q=New+York'"
echo ""
echo "View logs: pm2 logs osm-geocoder"
echo "Stop: pm2 stop osm-geocoder"
echo ""

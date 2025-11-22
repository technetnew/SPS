#!/bin/bash
# Start OSM Tile Server (Optional - only needed if you want offline vector tiles)
# The SPS system already works with online tile proxy at /api/tiles

echo "========================================="
echo "OSM Tile Server Startup Script"
echo "========================================="
echo ""

# Check if tiles file exists
TILES_FILE="/var/www/sps/osm-data/tiles/world.mbtiles"

if [ ! -f "$TILES_FILE" ]; then
    echo "❌ Error: Tiles file not found at $TILES_FILE"
    echo ""
    echo "You need to generate tiles first using:"
    echo "  cd /var/www/sps/osm-data"
    echo "  tilemaker --input data/current.osm.pbf \\"
    echo "           --output tiles/world.mbtiles \\"
    echo "           --config tilemaker-config.json \\"
    echo "           --process tilemaker-process.lua"
    echo ""
    exit 1
fi

echo "✓ Tiles file found: $TILES_FILE"
TILES_SIZE=$(du -h "$TILES_FILE" | cut -f1)
echo "  Size: $TILES_SIZE"
echo ""

# Check if tileserver-gl is installed
if ! command -v tileserver-gl &> /dev/null; then
    if ! npm list -g tileserver-gl &> /dev/null; then
        echo "❌ Error: tileserver-gl not installed"
        echo ""
        echo "Install with: sudo npm install -g tileserver-gl"
        echo ""
        exit 1
    fi
fi

echo "✓ tileserver-gl is installed"
echo ""

# Stop existing tile server if running
pm2 delete osm-tiles 2>/dev/null || true

echo "Starting tile server on port 8081..."
echo ""

# Start tile server with PM2
pm2 start tileserver-gl \
    --name osm-tiles \
    -- \
    --port 8081 \
    --verbose \
    "$TILES_FILE"

pm2 save

echo ""
echo "========================================="
echo "Tile Server Started!"
echo "========================================="
echo ""
echo "Access at: http://localhost:8081"
echo ""
echo "View logs: pm2 logs osm-tiles"
echo "Stop server: pm2 stop osm-tiles"
echo "Restart: pm2 restart osm-tiles"
echo ""

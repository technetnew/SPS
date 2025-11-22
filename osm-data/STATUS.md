# OSM System Status & Configuration

## Current Status

### ✅ What's Working

1. **OpenStreetMap Display** - FULLY FUNCTIONAL
   - Map tiles are served through `/api/tiles` endpoint
   - Uses online OpenStreetMap tiles with local caching
   - Works in [gps.html](../gps.html) map interface
   - Tiles are automatically cached for offline use

2. **PostgreSQL Database** - CONFIGURED
   - Database: `osm`
   - User: `osm`
   - Password: `osm_offline_2025`
   - Tables: 3 imported (basic OSM schema)

3. **OSM Data Files** - DOWNLOADED
   - California: 1.2 GB
   - New York: 461 MB (currently active as `current.osm.pbf`)
   - Texas: 645 MB
   - Total: 2.3 GB

4. **Required Tools** - INSTALLED
   - PostGIS ✓
   - osm2pgsql ✓
   - tilemaker ✓
   - tileserver-gl ✓

### ⚠️ Optional Components (Not Running)

These are **OPTIONAL** and only needed if you want completely offline functionality:

1. **Tile Server (Port 8081)** - Not Started
   - Purpose: Serve locally-generated vector tiles
   - Current: Not needed - online tiles work via `/api/tiles`
   - Status: Tiles not generated yet

2. **Geocoder (Port 7070)** - Not Installed/Started
   - Purpose: Offline address search
   - Current: Not needed for basic map viewing
   - Status: Photon JAR downloaded but not configured

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SPS Map System - TWO MODES                                  │
└─────────────────────────────────────────────────────────────┘

MODE 1: Online/Hybrid (CURRENT - WORKING)
┌──────────────────────────────────────┐
│ Browser → gps.html                    │
│    ↓                                  │
│ MapLibre GL JS                        │
│    ↓                                  │
│ /api/tiles/{z}/{x}/{y}.png            │
│    ↓                                  │
│ backend/routes/tiles.js (Proxy)       │
│    ↓                                  │
│ OpenStreetMap (online)                │
│    ↓                                  │
│ Local cache (/maps/tiles/)            │
└──────────────────────────────────────┘

MODE 2: Fully Offline (OPTIONAL - NOT CONFIGURED)
┌──────────────────────────────────────┐
│ Browser → gps.html                    │
│    ↓                                  │
│ MapLibre GL JS                        │
│    ↓                                  │
│ TileServer GL (port 8081)             │
│    ↓                                  │
│ world.mbtiles (vector tiles)          │
│                                       │
│ Search → Photon (port 7070)           │
│    ↓                                  │
│ Elasticsearch index of addresses     │
└──────────────────────────────────────┘
```

## Why OSM-Sync Shows "Offline"

The [osm-sync.html](../osm-sync.html) page checks for:
- Tile Server on port 8081 - **Not running** (not needed)
- Geocoder on port 7070 - **Not running** (not needed)

These are **optional components** for fully offline operation. Your maps already work!

## Do You Need the Tile Server & Geocoder?

**NO** - unless you want:
- 100% offline maps (no internet connection at all)
- Faster tile loading (no internet latency)
- Custom map styles
- Offline address search

**Your current system works fine for:**
- GPS tracking
- Map viewing
- Location display
- Online map tiles with local caching

## How to Enable Full Offline Mode (Optional)

If you want completely offline maps, follow these steps:

### Option A: Quick Test (Generate Tiles for Current Data)

```bash
# 1. Generate tiles from your New York data (30-60 minutes)
cd /var/www/sps/osm-data
sudo tilemaker \
    --input data/current.osm.pbf \
    --output tiles/world.mbtiles \
    --config tilemaker-config.json \
    --process tilemaker-process.lua

# 2. Start tile server
/var/www/sps/osm-data/start-tile-server.sh

# 3. (Optional) Start geocoder
/var/www/sps/osm-data/start-geocoder.sh
```

### Option B: Use Existing Online Tiles (Current Setup)

Do nothing! Your maps already work via the `/api/tiles` endpoint which:
- Fetches tiles from OpenStreetMap online
- Caches them locally in `/var/www/sps/maps/tiles/`
- Serves cached tiles when available (offline-friendly)

## Checking Map Functionality

### Test Current Setup (Online/Hybrid Mode)

1. Open: http://your-server/gps.html
2. You should see: Working map with OSM tiles
3. Search might not work (no geocoder) but map displays fine

### Test After Full Offline Setup

1. Run the tile server and geocoder scripts above
2. Open: http://your-server/osm-sync.html
3. You should see: Both Tile Server and Geocoder as "Online"

## Disk Space Usage

Current:
- OSM Downloads: 2.3 GB
- PostgreSQL DB: ~500 MB
- **Total: ~2.8 GB**

If you generate tiles:
- New York tiles: ~1-2 GB
- **Total: ~5 GB**

## Quick Commands

```bash
# Check what's running
pm2 status

# View map tile cache size
du -sh /var/www/sps/maps/tiles/

# Check PostgreSQL
PGPASSWORD='osm_offline_2025' psql -U osm -d osm -h localhost -c "\dt"

# Generate tiles (if you want offline mode)
cd /var/www/sps/osm-data
sudo tilemaker --input data/current.osm.pbf \
    --output tiles/world.mbtiles \
    --config tilemaker-config.json \
    --process tilemaker-process.lua

# Start tile server (after generating tiles)
/var/www/sps/osm-data/start-tile-server.sh

# Start geocoder (optional)
/var/www/sps/osm-data/start-geocoder.sh
```

## Troubleshooting

### Map not loading in gps.html
- Check: `pm2 logs sps-api`
- Verify: Backend is running on port 3000
- Test: `curl http://localhost:3000/api/tiles/0/0/0.png`

### Search not working
- This is normal - geocoder is not configured
- Maps still work for viewing and GPS tracking
- To fix: Run `/var/www/sps/osm-data/start-geocoder.sh`

### osm-sync.html shows services offline
- This is expected - optional services not started
- Your maps work via the hybrid online/cached mode
- To change: Generate tiles and start services above

## Recommendations

**For most users:**
- Keep current setup (online tiles with caching)
- Lightweight, works well
- No additional disk space needed

**For true offline operation:**
- Generate tiles: ~1-2 GB per state
- Start tile server: `/var/www/sps/osm-data/start-tile-server.sh`
- Optional geocoder: `/var/www/sps/osm-data/start-geocoder.sh`

## Support

- Main docs: [SETUP-OFFLINE-OSM.md](./SETUP-OFFLINE-OSM.md)
- osm2pgsql: https://osm2pgsql.org/
- tilemaker: https://github.com/systemed/tilemaker
- TileServer GL: https://github.com/maptiler/tileserver-gl
- Photon: https://github.com/komoot/photon

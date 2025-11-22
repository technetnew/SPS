# Complete Offline OSM Setup Guide for SPS

## Quick Start Summary

**What you have:**
- PostgreSQL 16 ✓
- Node.js & npm ✓
- PM2 for process management ✓
- Kiwix on port 8080 ✓

**What needs to be installed:**
- PostGIS extension
- osm2pgsql
- tilemaker (or OpenMapTiles)
- tileserver-gl-light
- Nominatim (optional, for advanced geocoding)

**Estimated setup time:**
- Tool installation: 30 minutes
- Data download (California): 10 minutes
- Import & tile generation (California): 2-4 hours
- Full Planet: 2-3 days

## Step 1: Install Required Tools

Run the installation script:

```bash
sudo /var/www/sps/osm-data/install-osm-tools.sh
```

This will install:
- PostGIS
- osm2pgsql
- tilemaker
- TileServer GL
- Create OSM database with proper extensions

## Step 2: Download OSM Data

### Option A: Start Small - California (Recommended)

```bash
cd /var/www/sps/osm-data/downloads

# Download California (~2.5 GB)
wget https://download.geofabrik.de/north-america/us/california-latest.osm.pbf

# Create symbolic link
ln -sf california-latest.osm.pbf ../data/current.osm.pbf
```

### Option B: Other Regions

Browse available extracts:
- Geofabrik: https://download.geofabrik.de/
- BBBike: https://extract.bbbike.org/

```bash
# Examples:
wget https://download.geofabrik.de/north-america/us/nevada-latest.osm.pbf
wget https://download.geofabrik.de/europe/germany-latest.osm.pbf
wget https://download.geofabrik.de/north-america-latest.osm.pbf
```

### Option C: Full Planet (Advanced)

```bash
# WARNING: 84+ GB download, requires 500+ GB disk space
wget https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf
```

## Step 3: Import OSM Data into PostgreSQL

### For California (or similar-sized region):

```bash
cd /var/www/sps/osm-data/data

osm2pgsql -c -d osm -U osm -H localhost -P 5432 \\
  --password \\
  --slim \\
  -C 4000 \\
  --number-processes 4 \\
  --hstore \\
  --style /usr/share/osm2pgsql/default.style \\
  --multi-geometry \\
  current.osm.pbf

# When prompted, enter password: osm_offline_2025
```

**Import parameters explained:**
- `-c`: Create new database (drop existing)
- `-d osm`: Database name
- `-U osm`: Database user
- `--slim`: Use slim mode (required for updates)
- `-C 4000`: Use 4GB cache (adjust based on your RAM)
- `--number-processes 4`: Use 4 CPU cores
- `--hstore`: Enable hstore for tags
- `--multi-geometry`: Support multi-geometries

**Time estimates:**
- California: 1-2 hours
- Full US: 8-12 hours
- Europe: 12-24 hours
- Full Planet: 24-72 hours

## Step 4: Generate Vector Tiles

### Using tilemaker (Faster, Good Quality):

```bash
cd /var/www/sps/osm-data

# Generate MBTiles file
tilemaker --input data/current.osm.pbf \\
  --output tiles/world.mbtiles \\
  --process /usr/local/share/tilemaker/resources/process-openmaptiles.lua \\
  --config /usr/local/share/tilemaker/resources/config-openmaptiles.json \\
  --verbose

# Time estimate for California: 30-60 minutes
```

If you get missing config errors, use this simple config:

```bash
tilemaker --input data/current.osm.pbf \\
  --output tiles/world.mbtiles \\
  --bbox=-124.48,32.53,-114.13,42.01  # California bounds
```

## Step 5: Start TileServer

```bash
# Start tile server on port 8081 (kiwix is on 8080)
pm2 start tileserver-gl-light -- \\
  /var/www/sps/osm-data/tiles/world.mbtiles \\
  --port 8081 \\
  --verbose \\
  --public_url http://localhost:8081 \\
  --name osm-tiles

# Save PM2 configuration
pm2 save

# Check status
pm2 status osm-tiles
pm2 logs osm-tiles
```

## Step 6: Set Up Nominatim for Geocoding

### Quick Install (Photon - Lighter Alternative):

```bash
# Download Photon JAR
cd /var/www/sps/osm-data/nominatim
wget https://github.com/komoot/photon/releases/download/0.4.0/photon-0.4.0.jar

# Import OSM data
java -jar photon-0.4.0.jar \\
  -nominatim-import \\
  -nominatim-db /var/www/sps/osm-data/data/current.osm.pbf

# Start Photon geocoder on port 7070
pm2 start java -- \\
  -jar /var/www/sps/osm-data/nominatim/photon-0.4.0.jar \\
  -port 7070 \\
  -name osm-geocoder

pm2 save
```

### Full Nominatim Install (Advanced):

```bash
# Clone Nominatim
cd /var/www/sps/osm-data/nominatim
git clone https://github.com/osm-search/Nominatim.git
cd Nominatim

# Build
mkdir build
cd build
cmake ..
make -j4

# Import (this will take hours)
cd /var/www/sps/osm-data/nominatim/Nominatim/build
./utils/setup.php --osm-file ../../data/current.osm.pbf --all

# Start server
pm2 start nominatim -- serve --server 127.0.0.1:7070 --name osm-nominatim
pm2 save
```

## Step 7: Configure SPS Backend

The SPS backend is already configured to proxy these services. No changes needed if you followed the port assignments:

- TileServer: `http://localhost:8081`
- Geocoder: `http://localhost:7070`
- PostgreSQL: `localhost:5432`

## Step 8: Test Your Setup

### Test Tile Server:

```bash
# Check status
curl http://localhost:8081/

# Get a specific tile
curl http://localhost:8081/styles/basic-preview/14/2621/6331.png -o test-tile.png

# If successful, you'll have a map tile image
```

### Test Geocoder:

```bash
# Search for a place
curl "http://localhost:7070/api?q=San+Francisco"

# Reverse geocode
curl "http://localhost:7070/reverse?lat=37.7749&lon=-122.4194"
```

### Test SPS Integration:

```bash
# Visit in browser
http://your-server/gps.html

# Should show:
# - Map tiles loading from local server
# - Search working with local geocoder
# - GPS tracking if device available
```

## Disk Space Requirements

| Dataset | Download | Imported DB | Tiles | Total |
|---------|----------|-------------|-------|-------|
| California | 2.5 GB | 15 GB | 3 GB | ~21 GB |
| Texas | 3 GB | 18 GB | 4 GB | ~25 GB |
| Full US | 11 GB | 80 GB | 15 GB | ~106 GB |
| Europe | 27 GB | 180 GB | 35 GB | ~242 GB |
| Full Planet | 84 GB | 500 GB | 100 GB | ~684 GB |

## RAM Requirements

| Dataset | osm2pgsql | Tile Generation | PostgreSQL |
|---------|-----------|-----------------|------------|
| State | 4 GB | 2 GB | 2 GB |
| Region | 8 GB | 4 GB | 4 GB |
| Continent | 16 GB | 8 GB | 8 GB |
| Planet | 64 GB | 16 GB | 16 GB |

## Updating OSM Data

To update your offline maps with fresh data:

```bash
# 1. Download latest
cd /var/www/sps/osm-data/downloads
wget -N https://download.geofabrik.de/north-america/us/california-latest.osm.pbf

# 2. Re-import (drops and recreates)
osm2pgsql -c -d osm -U osm --slim -C 4000 california-latest.osm.pbf

# 3. Regenerate tiles
cd /var/www/sps/osm-data
tilemaker --input downloads/california-latest.osm.pbf \\
  --output tiles/world.mbtiles

# 4. Restart tile server
pm2 restart osm-tiles

# Done! Maps are updated.
```

## Troubleshooting

### osm2pgsql fails with "out of memory"

Reduce cache size:
```bash
osm2pgsql -C 2000 ...  # Use only 2GB cache
```

### Tile server won't start

Check if port 8081 is in use:
```bash
lsof -i :8081
pm2 logs osm-tiles
```

### Tiles show but are blank

Verify MBTiles file:
```bash
ls -lh /var/www/sps/osm-data/tiles/world.mbtiles
# Should be several GB in size

# Test with mbt-util
npm install -g @mapbox/mbtiles
mbtiles /var/www/sps/osm-data/tiles/world.mbtiles
```

### Database connection errors

Check PostgreSQL status:
```bash
sudo systemctl status postgresql
PGPASSWORD='osm_offline_2025' psql -U osm -d osm -h localhost -c "\\dt"
```

### Geocoding not working

For Photon:
```bash
pm2 logs osm-geocoder
curl http://localhost:7070/api?q=test
```

For Nominatim:
```bash
pm2 logs osm-nominatim
curl http://localhost:7070/search?q=test
```

## Performance Tuning

### PostgreSQL Configuration

Edit `/etc/postgresql/16/main/postgresql.conf`:

```ini
# For 16GB RAM system
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 2GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 50MB
min_wal_size = 2GB
max_wal_size = 8GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

## What's Next?

Once setup is complete:

1. **Test the sync UI**: Visit `http://your-server/osm-sync.html`
2. **Use the GPS map**: Visit `http://your-server/gps.html`
3. **Monitor services**: `pm2 status`
4. **Check logs**: `pm2 logs osm-tiles`

## Support Resources

- osm2pgsql: https://osm2pgsql.org/doc/manual.html
- tilemaker: https://github.com/systemed/tilemaker
- TileServer GL: https://github.com/maptiler/tileserver-gl
- Nominatim: https://nominatim.org/release-docs/latest/
- Geofabrik Downloads: https://download.geofabrik.de/
- OSM Wiki: https://wiki.openstreetmap.org/

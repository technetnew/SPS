# SPS Offline OpenStreetMap System

## Overview

This system provides a complete offline OpenStreetMap solution including:
- Local OSM data import and storage
- Vector tile generation and serving
- Offline geocoding (Nominatim)
- OSM Carto-style map rendering
- GPS integration

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         SPS Frontend                         │
│                  (gps.html - OSM-style UI)                  │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTP API
             ▼
┌─────────────────────────────────────────────────────────────┐
│                      SPS Backend API                         │
│          /api/osm/* - Proxy to local services               │
└────┬────────┬────────────┬──────────────┬──────────────────┘
     │        │            │              │
     │        │            │              │
     ▼        ▼            ▼              ▼
┌─────────┐ ┌──────────┐ ┌────────────┐ ┌────────┐
│TileServer│ │Nominatim │ │PostgreSQL  │ │ gpsd   │
│   GL     │ │(Geocoder)│ │  +PostGIS  │ │        │
│Port 8081 │ │Port 7070 │ │  osm db    │ │        │
└─────────┘ └──────────┘ └────────────┘ └────────┘
     │            │             │
     │            │             │
     └────────────┴─────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │  OSM Data Store  │
        │  /var/www/sps/   │
        │    osm-data/     │
        └──────────────────┘
```

## Directory Structure

```
/var/www/sps/osm-data/
├── downloads/          # Downloaded .osm.pbf files
├── data/              # Current active OSM data
│   └── current.osm.pbf
├── tiles/             # Generated vector tiles
│   └── world.mbtiles
├── nominatim/         # Nominatim database and config
└── styles/            # MapLibre styles (OSM Carto)
    └── osm-carto.json
```

## System Requirements

### Minimum (Regional Extract - e.g., California)
- CPU: 4 cores
- RAM: 16 GB
- Disk: 100 GB free
- PostgreSQL 12+
- PostGIS 3.0+

### Recommended (Full Planet)
- CPU: 16+ cores
- RAM: 64 GB
- Disk: 1 TB SSD
- PostgreSQL 14+
- PostGIS 3.3+

## Installation Steps

### 1. Install System Dependencies

```bash
# PostgreSQL + PostGIS
sudo apt update
sudo apt install -y postgresql postgresql-contrib postgis

# osm2pgsql for importing OSM data
sudo apt install -y osm2pgsql

# Nominatim dependencies
sudo apt install -y build-essential cmake g++ libboost-dev \\
    libboost-system-dev libboost-filesystem-dev libexpat1-dev \\
    zlib1g-dev libbz2-dev libpq-dev libproj-dev lua5.3 liblua5.3-dev

# Node.js packages for tile serving
npm install -g @maptiler/tileserver-gl-light
```

### 2. Set Up PostgreSQL Database

```bash
# Create OSM database
sudo -u postgres createdb osm
sudo -u postgres psql -d osm -c "CREATE EXTENSION postgis;"
sudo -u postgres psql -d osm -c "CREATE EXTENSION hstore;"

# Create OSM user
sudo -u postgres createuser osm
sudo -u postgres psql -c "ALTER USER osm WITH PASSWORD 'osm_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE osm TO osm;"
```

### 3. Download OSM Data

**Option A: Regional Extract (Recommended for testing)**

```bash
# California example
cd /var/www/sps/osm-data/downloads
wget https://download.geofabrik.de/north-america/us/california-latest.osm.pbf
ln -sf california-latest.osm.pbf ../data/current.osm.pbf
```

**Option B: Full Planet**

```bash
cd /var/www/sps/osm-data/downloads
wget https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf
ln -sf planet-latest.osm.pbf ../data/current.osm.pbf
```

### 4. Import OSM Data with osm2pgsql

```bash
cd /var/www/sps/osm-data/data

# For regional extract (California ~2GB)
osm2pgsql -c -d osm -U osm -H localhost \\
    --slim -C 4000 \\
    --number-processes 4 \\
    --hstore \\
    --style /usr/share/osm2pgsql/default.style \\
    current.osm.pbf

# For full planet (requires 64GB+ RAM)
osm2pgsql -c -d osm -U osm -H localhost \\
    --slim -C 60000 \\
    --number-processes 16 \\
    --flat-nodes /var/www/sps/osm-data/data/nodes.bin \\
    --hstore \\
    --style /usr/share/osm2pgsql/default.style \\
    current.osm.pbf
```

**Import Time Estimates:**
- Small country (e.g., Switzerland): 10-30 minutes
- US State (e.g., California): 1-3 hours
- Full Planet: 24-72 hours

### 5. Generate Vector Tiles

**Option A: Using tilemaker (faster, less features)**

```bash
# Install tilemaker
git clone https://github.com/systemed/tilemaker.git
cd tilemaker
make
sudo make install

# Generate tiles
cd /var/www/sps/osm-data
tilemaker --input data/current.osm.pbf \\
    --output tiles/world.mbtiles \\
    --config /usr/local/share/tilemaker/config-openmaptiles.json \\
    --process /usr/local/share/tilemaker/process-openmaptiles.lua
```

**Option B: Using OpenMapTiles (full features, slower)**

```bash
# Clone OpenMapTiles
git clone https://github.com/openmaptiles/openmaptiles.git
cd openmaptiles

# Generate tiles from PostgreSQL
./quickstart.sh california

# Output: data/tiles.mbtiles
cp data/tiles.mbtiles /var/www/sps/osm-data/tiles/world.mbtiles
```

### 6. Set Up Nominatim for Geocoding

```bash
# Clone Nominatim
cd /var/www/sps/osm-data/nominatim
git clone https://github.com/osm-search/Nominatim.git
cd Nominatim

# Build
mkdir build
cd build
cmake ..
make
sudo make install

# Import OSM data into Nominatim
cd /var/www/sps/osm-data/nominatim
nominatim import --osm-file ../data/current.osm.pbf

# Start Nominatim server (port 7070)
nominatim serve --server 127.0.0.1:7070
```

### 7. Start TileServer GL

```bash
# Create PM2 config for tile server
pm2 start tileserver-gl-light -- \\
    --mbtiles /var/www/sps/osm-data/tiles/world.mbtiles \\
    --port 8081 \\
    --public_url http://localhost:8081 \\
    --name osm-tileserver

pm2 save
```

### 8. Configure SPS Backend

The SPS backend will proxy requests to these local services:
- TileServer GL: http://localhost:8081
- Nominatim: http://localhost:7070
- PostgreSQL: localhost:5432

## Usage

### Sync Maps Page

Navigate to: `http://your-server/osm-sync.html`

This page allows you to:
1. Choose a data source (planet or regional)
2. Start download
3. Monitor import progress
4. Track tile generation
5. View system status

### GPS Map Page

Navigate to: `http://your-server/gps.html`

Features:
- OSM Carto-style map
- Offline search (address and places)
- GPS tracking
- Click-to-query features
- No internet required after setup

## Performance Tuning

### PostgreSQL Settings

Edit `/etc/postgresql/14/main/postgresql.conf`:

```ini
# For regional extracts (16GB RAM)
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

# For full planet (64GB RAM)
shared_buffers = 16GB
effective_cache_size = 48GB
maintenance_work_mem = 8GB
work_mem = 100MB
max_wal_size = 32GB
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

## Maintenance

### Update OSM Data

```bash
# Download latest
cd /var/www/sps/osm-data/downloads
wget -N https://download.geofabrik.de/north-america/us/california-latest.osm.pbf

# Re-import
osm2pgsql -c -d osm ...

# Regenerate tiles
tilemaker --input california-latest.osm.pbf ...

# Update Nominatim
nominatim import --osm-file california-latest.osm.pbf

# Restart services
pm2 restart osm-tileserver
```

## Troubleshooting

### Import Fails with "Out of Memory"

Reduce `-C` parameter in osm2pgsql:
```bash
osm2pgsql -C 2000 ...  # Use less RAM
```

### Tiles Not Loading

Check TileServer GL logs:
```bash
pm2 logs osm-tileserver
```

Verify MBTiles file exists:
```bash
ls -lh /var/www/sps/osm-data/tiles/world.mbtiles
```

### Geocoding Not Working

Check Nominatim status:
```bash
curl http://localhost:7070/status
```

### Database Connection Errors

Verify PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

Test connection:
```bash
psql -U osm -h localhost -d osm -c "SELECT COUNT(*) FROM planet_osm_point;"
```

## Licenses and Attribution

### OpenStreetMap Data
© OpenStreetMap contributors
License: ODbL (Open Database License)
https://www.openstreetmap.org/copyright

### OSM Carto Style
© OpenStreetMap Carto contributors
License: CC0 1.0 Universal
https://github.com/gravitystorm/openstreetmap-carto

### Nominatim
© OpenStreetMap contributors
License: GPL-2.0
https://github.com/osm-search/Nominatim

## Resources

- OSM Wiki: https://wiki.openstreetmap.org/
- osm2pgsql: https://osm2pgsql.org/
- OpenMapTiles: https://openmaptiles.org/
- Nominatim: https://nominatim.org/
- Geofabrik Extracts: https://download.geofabrik.de/
- BBBike Extracts: https://extract.bbbike.org/

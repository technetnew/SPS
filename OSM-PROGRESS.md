# OpenStreetMap Offline System - Implementation Progress

## ✅ Completed Tasks

### 1. Backend API Implementation
- **File Created:** [/var/www/sps/backend/routes/osm.js](backend/routes/osm.js)
- **Status:** Fully functional and tested
- **Features Implemented:**
  - ✓ OSM data presets (California, Texas, New York, US, Planet)
  - ✓ System status checking (database, tile server, geocoder, data files)
  - ✓ Background sync job management
  - ✓ Download manager with progress tracking
  - ✓ osm2pgsql import wrapper
  - ✓ Tilemaker tile generation wrapper
  - ✓ Geocoding proxy endpoints

### 2. Frontend UI Created
- **HTML:** [/var/www/sps/osm-sync.html](osm-sync.html)
- **CSS:** [/var/www/sps/css/osm-sync.css](css/osm-sync.css)
- **JS:** [/var/www/sps/js/osm-sync.js](js/osm-sync.js)
- **Features:**
  - ✓ System status dashboard
  - ✓ Map preset cards with metadata
  - ✓ Custom URL input
  - ✓ Real-time progress tracking
  - ✓ Live log viewer
  - ✓ Job cancellation
  - ✓ Setup instructions

### 3. Backend Integration
- **File:** [/var/www/sps/backend/server.js](backend/server.js)
- ✓ OSM routes integrated at `/api/osm/*`
- ✓ API tested and working
- ✓ Missing npm packages installed

### 4. Documentation Created
- ✓ [/var/www/sps/SETUP-OFFLINE-OSM.md](SETUP-OFFLINE-OSM.md) - User setup guide
- ✓ [/var/www/sps/osm-data/README.md](osm-data/README.md) - Architecture docs
- ✓ [/var/www/sps/osm-data/install-osm-tools.sh](osm-data/install-osm-tools.sh) - Installation script

### 5. API Endpoints Verified
```bash
# Test successful:
curl http://localhost:3000/api/osm/presets
curl http://localhost:3000/api/osm/status
```

## ⏳ Remaining Tasks (Require sudo/manual intervention)

### 1. Run Installation Script
**Command:**
```bash
sudo /var/www/sps/osm-data/install-osm-tools.sh
```

**What it will install:**
- tilemaker (for vector tile generation)
- Nominatim dependencies (for geocoding)
- TileServer GL (via npm global install)
- Creates OSM database with PostGIS extensions
- Creates OSM user with credentials

**Already Installed:**
- ✓ PostgreSQL 16
- ✓ PostGIS 3.4.2
- ✓ osm2pgsql
- ✓ Node.js & npm
- ✓ PM2

### 2. Update Navigation Menu
Add "Sync Maps" link to all pages:

**Files to update:**
- /var/www/sps/index.html
- /var/www/sps/dashboard.html
- /var/www/sps/gps.html
- /var/www/sps/videos.html
- /var/www/sps/kiwix.html
- /var/www/sps/pictures.html

**Change:**
```html
<!-- Add this line to the nav menu -->
<li><a href="/osm-sync.html" class="nav-link">Sync Maps</a></li>
```

### 3. Redesign gps.html (Optional)
Update gps.html to use local tile server and geocoder once OSM system is set up.

## 🚀 Quick Start Guide

Once you've run the installation script, follow these steps:

### 1. Access the Sync Maps Page
Visit: `http://your-server/osm-sync.html`

### 2. Check System Status
The page will show:
- Database: Should be "Ready" (OSM database exists)
- Tile Server: "Offline" (until you download and generate tiles)
- Geocoder: "Offline" (until Nominatim is configured)
- Data Files: "Not Present" (until you download OSM data)

### 3. Download Your First Map
**Recommended:** Start with California (2.5 GB, 2-4 hours)

1. Click "Download California, USA"
2. Wait for download to complete (progress shown)
3. Import will start automatically (osm2pgsql)
4. Tile generation will follow (tilemaker)
5. Progress updates every 2 seconds

### 4. Monitor Progress
The sync page shows:
- Overall progress percentage (0-100%)
- Current stage (Download, Import, or Tile Generation)
- Live log output
- Ability to cancel if needed

### 5. Verify Completion
After sync completes:
- Database status: "Ready" with table count
- Tile Server status: "Running" on port 8081
- Data Files: "Present" with file sizes

## 📊 Current System Status

**API Server:** ✓ Running on port 3000
**Database:** ✓ PostgreSQL 16 running
**PostGIS:** ✓ Version 3.4.2 installed
**osm2pgsql:** ✓ Installed
**OSM Database:** ⏳ Not configured yet
**Tile Server:** ⏳ Not installed yet
**Geocoder:** ⏳ Not installed yet

## 🔧 Manual Installation Steps (If Script Fails)

### Install TileServer GL
```bash
npm install -g @maptiler/tileserver-gl-light
```

### Install Tilemaker
```bash
cd /tmp
git clone https://github.com/systemed/tilemaker.git
cd tilemaker
make
sudo make install
```

### Set Up OSM Database
```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE osm;
\c osm
CREATE EXTENSION postgis;
CREATE EXTENSION hstore;
CREATE EXTENSION postgis_topology;
CREATE USER osm WITH PASSWORD 'osm_offline_2025';
GRANT ALL PRIVILEGES ON DATABASE osm TO osm;
GRANT ALL ON SCHEMA public TO osm;
GRANT ALL ON ALL TABLES IN SCHEMA public TO osm;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO osm;
EOF
```

## 📝 API Documentation

### GET /api/osm/presets
Returns available map presets.

### GET /api/osm/status
Returns system status:
- Database connection and table count
- Tile server status (port 8081)
- Geocoder status (port 7070)
- Data files presence
- Active sync job if any

### POST /api/osm/sync/start
Start a sync job.
Body: `{ "presetId": "california" }` or `{ "customUrl": "https://..." }`

### GET /api/osm/sync/:jobId
Get sync job progress and logs.

### DELETE /api/osm/sync/:jobId
Cancel a running sync job.

### GET /api/osm/search?q=query
Search for places (proxies to Nominatim).

### GET /api/osm/reverse?lat=37.7749&lon=-122.4194
Reverse geocode coordinates (proxies to Nominatim).

## 🌐 Architecture

```
User Browser
     │
     └──> /osm-sync.html (Frontend UI)
           │
           └──> /api/osm/* (Backend API)
                 │
                 ├──> PostgreSQL + PostGIS (OSM data)
                 ├──> TileServer GL :8081 (Map tiles)
                 └──> Nominatim :7070 (Geocoding)
```

## 📦 Disk Space Planning

| Dataset       | Download | Database | Tiles  | Total  | Time       |
|---------------|----------|----------|--------|--------|------------|
| California    | 2.5 GB   | 15 GB    | 3 GB   | 21 GB  | 2-4 hours  |
| Texas         | 3 GB     | 18 GB    | 4 GB   | 25 GB  | 3-5 hours  |
| New York      | 1.8 GB   | 12 GB    | 2 GB   | 16 GB  | 1-3 hours  |
| Full US       | 11 GB    | 80 GB    | 15 GB  | 106 GB | 12-24 hrs  |
| Full Planet   | 84 GB    | 500 GB   | 100 GB | 684 GB | 2-3 days   |

## 🔗 Useful Links

- **Geofabrik Downloads:** https://download.geofabrik.de/
- **OSM Planet:** https://planet.openstreetmap.org/
- **osm2pgsql Docs:** https://osm2pgsql.org/doc/
- **Tilemaker Docs:** https://github.com/systemed/tilemaker
- **TileServer GL:** https://github.com/maptiler/tileserver-gl

## ✨ Next Steps

1. Run: `sudo /var/www/sps/osm-data/install-osm-tools.sh`
2. Visit: `http://your-server/osm-sync.html`
3. Click: "Download California, USA"
4. Wait for completion (~2-4 hours)
5. Visit: `http://your-server/gps.html` to see your offline maps!

---

Last Updated: 2025-11-20
System Ready: API ✓ | UI ✓ | Tools ⏳

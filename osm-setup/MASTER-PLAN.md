# OpenStreetMap Local Clone - Master Plan

## Project Goal

Set up a **fully functional local OpenStreetMap clone** where you can:
- ✓ View maps with locally-rendered tiles
- ✓ Log in and create user accounts
- ✓ Edit the map (add points, roads, etc.)
- ✓ See edits reflected immediately on your tiles
- ✓ All data and rendering 100% local

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Complete Local OSM Stack                                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ LAYER 1: Web Application (Rails Port)                        │
│   • openstreetmap-website (Ruby on Rails)                    │
│   • Port 3001 (separate from your SPS app on 3000)           │
│   • User login, map editing, changesets                      │
│   • API for map data                                         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 2: Database (PostgreSQL + PostGIS)                     │
│   • Database: "openstreetmap" (main data)                    │
│   • Database: "gis" (tile rendering)                         │
│   • Stores: nodes, ways, relations, changesets, users        │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 3: Tile Server (Apache + mod_tile + renderd)           │
│   • Apache2 on port 80 (or 8081 to avoid conflicts)          │
│   • mod_tile: serves tiles via /tile/{z}/{x}/{y}.png         │
│   • renderd: renders tiles on-demand using Mapnik            │
│   • Mapnik: uses "gis" database + OpenStreetMap Carto style  │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ LAYER 4: Map Styles (OpenStreetMap Carto)                    │
│   • CartoCSS stylesheets                                     │
│   • Defines how roads, buildings, water appear               │
│   • Compiled to Mapnik XML                                   │
└──────────────────────────────────────────────────────────────┘

FLOW:
User edits map → Rails app saves to "openstreetmap" DB
                → osm2pgsql exports to "gis" DB
                → renderd + Mapnik render new tiles
                → User sees updated map
```

## Five-Phase Implementation Plan

### Phase 1: System Cleanup & Dependencies ⏳ READY TO EXECUTE
**Location:** `/var/www/sps/osm-setup/phase1-cleanup-and-deps.sh`

**Tasks:**
- Remove old Ruby installations
- Install rbenv + Ruby 3.1.4
- Install Mapnik 3.1+
- Install Apache2 + mod_tile + renderd
- Install osm2pgsql, osmosis, osmium-tool
- Install all system dependencies

**Time:** 15-20 minutes
**Manual intervention:** None (runs fully automated)

**Deliverable:** Clean system with all dependencies installed

---

### Phase 2: Database Layer 📋 WAITING
**Script:** `phase2-database-setup.sh` (will be created after Phase 1)

**Tasks:**
- Create PostgreSQL databases:
  - `openstreetmap` (main Rails app database)
  - `gis` (rendering database)
- Install PostGIS extensions
- Create database users with proper permissions
- Tune `postgresql.conf` for OSM workload
- Set up connection pooling

**Time:** 5-10 minutes
**Manual intervention:** Review postgresql.conf changes

**Deliverable:** Two databases ready for OSM data

---

### Phase 3: Rails Application 🚂 WAITING
**Script:** `phase3-rails-app-setup.sh`

**Tasks:**
- Clone `openstreetmap/openstreetmap-website` to `/var/www/osm-rails-port`
- Install Ruby gems via bundler
- Install JavaScript packages via yarn
- Create `config/database.yml`
- Create `config/settings.local.yml`
- Run database migrations
- Precompile assets
- Set up systemd service or PM2 process
- Test on http://localhost:3001

**Time:** 20-30 minutes
**Manual intervention:** Review config files before running migrations

**Deliverable:** Working Rails app (no tiles yet)

---

### Phase 4: Tile Server 🗺️ WAITING
**Script:** `phase4-tile-server-setup.sh`

**Tasks:**
- Download sample OSM data (Liechtenstein ~30MB for testing)
- Import to `gis` database with osm2pgsql
- Clone OpenStreetMap Carto styles
- Install CartoCSS dependencies (Node.js)
- Compile CartoCSS to Mapnik XML
- Configure `renderd.conf`
- Configure Apache2 + mod_tile (port 8081)
- Start renderd service
- Generate test tiles
- Verify tile server responds

**Time:** 30-45 minutes
**Manual intervention:** Choose sample region, review renderd.conf

**Deliverable:** Working tile server serving test tiles

---

### Phase 5: Integration & Glue 🔗 WAITING
**Script:** `phase5-integration.sh`

**Tasks:**
- Configure Rails app to use local tile server
  - Edit `config/settings.local.yml`
  - Point "standard" layer to `http://localhost:8081/tile/{z}/{x}/{y}.png`
- Set up osm2pgsql triggers (optional - for instant tile updates)
- Install and configure `openstreetmap-cgimap` (faster API)
- Create sample user account
- Test full workflow:
  1. Log into Rails app
  2. Create a test edit (add a node)
  3. Export changeset
  4. Update gis database
  5. Expire old tiles
  6. Verify new tiles show edit
- Set up backup scripts
- Document the system

**Time:** 20-30 minutes
**Manual intervention:** Test each step manually

**Deliverable:** Fully integrated local OSM clone

---

## Disk Space Requirements

| Component | Disk Space |
|-----------|-----------|
| System dependencies | ~2 GB |
| Ruby + gems | ~500 MB |
| Rails application | ~200 MB |
| Liechtenstein data (test) | ~30 MB |
| Liechtenstein tiles (z0-z14) | ~100 MB |
| PostgreSQL (test data) | ~500 MB |
| **Total (testing)** | **~3.5 GB** |

For full state/country:
| Region | PBF Size | DB Size | Tile Size (z0-z14) |
|--------|----------|---------|-------------------|
| California | 1.2 GB | ~15 GB | ~3 GB |
| Full US | 11 GB | ~100 GB | ~20 GB |

## Port Allocation

To avoid conflicts with your existing SPS system:

| Service | Port | Current Use |
|---------|------|-------------|
| SPS Backend | 3000 | ✓ In use |
| Kiwix | 8080 | ✓ In use |
| **OSM Rails App** | **3001** | New |
| **OSM Tile Server** | **8081** | New |
| PostgreSQL | 5432 | ✓ In use (shared) |

## Key Configuration Files (Preview)

After setup, these files will control your OSM instance:

```
/var/www/osm-rails-port/
├── config/
│   ├── database.yml              # PostgreSQL connection
│   ├── settings.local.yml        # Tile server URL, API settings
│   └── storage.yml               # File uploads
├── db/
│   └── structure.sql             # Database schema
└── public/
    └── assets/                   # Compiled CSS/JS

/etc/renderd.conf                 # Tile rendering config
/etc/apache2/sites-available/     # Tile server virtual host
/var/lib/mod_tile/                # Tile cache

/usr/local/share/maps/style/      # OpenStreetMap Carto style
```

## Safety & Rollback

### What's Safe
- All new components use separate directories
- OSM Rails app on different port (3001) than SPS (3000)
- Tile server on port 8081
- New PostgreSQL databases (won't touch existing `sps_db` or `osm`)

### Rollback Plan
Each phase has a rollback section. To completely undo:
```bash
# Stop services
sudo systemctl stop renderd apache2
pm2 delete osm-rails-app

# Drop databases
sudo -u postgres psql -c "DROP DATABASE openstreetmap;"
sudo -u postgres psql -c "DROP DATABASE gis;"

# Remove directories
sudo rm -rf /var/www/osm-rails-port
sudo rm -rf /usr/local/share/maps/style

# Remove rbenv (if desired)
rm -rf ~/.rbenv
```

## Success Criteria

After Phase 5, you should be able to:
1. ✓ Visit http://localhost:3001 and see the OSM website
2. ✓ Register a new user account
3. ✓ View the map (tiles loading from http://localhost:8081)
4. ✓ Switch to "Edit" mode
5. ✓ Add a node (e.g., a point of interest)
6. ✓ Save the changeset
7. ✓ Refresh the map and see your edit

## Timeline

| Phase | Time | Cumulative |
|-------|------|------------|
| Phase 1 | 20 min | 20 min |
| Phase 2 | 10 min | 30 min |
| Phase 3 | 30 min | 1h 00min |
| Phase 4 | 45 min | 1h 45min |
| Phase 5 | 30 min | 2h 15min |

**Total:** ~2-3 hours (including testing and troubleshooting)

## Current Status

- [x] System audit complete
- [ ] Phase 1 script ready - **EXECUTE NOW**
- [ ] Phase 2 pending
- [ ] Phase 3 pending
- [ ] Phase 4 pending
- [ ] Phase 5 pending

## Execute Phase 1

Ready to start? Run:

```bash
sudo /var/www/sps/osm-setup/phase1-cleanup-and-deps.sh
```

After completion:
1. Log out and log back in
2. Run verification commands from PHASE1-README.md
3. Report any errors before proceeding to Phase 2

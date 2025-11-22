# Phase 1: System Cleanup & Dependencies

## What This Phase Does

1. **Removes** old/conflicting Ruby installations (system Ruby)
2. **Keeps** your existing Node.js 18.x (compatible)
3. **Verifies** PostgreSQL 16 + PostGIS 3
4. **Installs** rbenv + Ruby 3.1.4 (clean, isolated)
5. **Installs** all system dependencies:
   - Mapnik 3.1+ (tile rendering engine)
   - Apache2 + mod_tile + renderd
   - osm2pgsql (data import)
   - Image processing libraries
   - Geospatial libraries
   - Build tools

## Prerequisites

- Ubuntu 24.04 (your current system)
- sudo access
- ~5 GB free disk space
- Internet connection

## Execution

```bash
# Run as sudo
sudo /var/www/sps/osm-setup/phase1-cleanup-and-deps.sh
```

**Estimated time:** 15-20 minutes (Ruby compilation takes the longest)

## What Gets Installed

### Ruby Environment
- **rbenv** in `~/.rbenv/`
- **Ruby 3.1.4** (compatible with openstreetmap-website)
- **Bundler** gem

### Tile Rendering Stack
- **Mapnik 3.1+** - Map rendering library
- **Apache2** - Web server
- **mod_tile** - Tile serving module
- **renderd** - Tile rendering daemon

### OSM Tools
- **osm2pgsql** - Import OSM data to PostgreSQL
- **osmosis** - OSM data manipulation
- **osmium-tool** - Fast OSM data processing

### System Libraries
- Build essentials (gcc, make, etc.)
- Image libraries (ImageMagick, libvips)
- Geospatial libraries (GDAL, PROJ, GEOS)
- PostgreSQL dev headers
- SSL, XML, YAML libraries

## Verification After Phase 1

After the script completes, **log out and log back in**, then run:

```bash
# Check Ruby (should show 3.1.4)
ruby --version

# Check gem
gem --version

# Check bundler
bundle --version

# Check PostgreSQL
psql --version

# Check Mapnik
mapnik-config --version

# Check osm2pgsql
osm2pgsql --version

# Check Apache
apache2 -v

# Check mod_tile
ls -la /usr/lib/apache2/modules/mod_tile.so
```

Expected outputs:
```
ruby 3.1.4
gem 3.3.x
Bundler version 2.x
psql (PostgreSQL) 16.10
3.1.0
osm2pgsql version 1.x
Apache/2.4.x
mod_tile.so exists
```

## What Doesn't Get Broken

This phase is **safe** and doesn't affect:
- Your existing SPS application (runs on port 3000)
- Your PostgreSQL databases (sps_db, osm)
- Your downloaded OSM data
- PM2 processes
- Nginx configuration
- Your Kiwix setup

## Troubleshooting

### Ruby installation fails
```bash
# Install additional dependencies
sudo apt-get install -y libgmp-dev libssl-dev

# Retry Ruby installation
rbenv install 3.1.4
```

### rbenv not in PATH
```bash
# Manually add to .bashrc
echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(rbenv init - bash)"' >> ~/.bashrc
source ~/.bashrc
```

### Mapnik version check fails
```bash
# Install mapnik-utils
sudo apt-get install -y mapnik-utils

# Check version
mapnik-config --version
```

## File Locations After Phase 1

```
~/.rbenv/                          # Ruby version manager
~/.rbenv/versions/3.1.4/           # Ruby 3.1.4 installation
~/.nvm/                            # Node version manager (optional)
/usr/lib/mapnik/                   # Mapnik libraries
/usr/bin/osm2pgsql                 # OSM import tool
/etc/apache2/                      # Apache config (not yet configured)
/usr/bin/renderd                   # Tile rendering daemon
```

## Next Phase Preview

**Phase 2** will:
- Create PostgreSQL databases (`openstreetmap` and `gis`)
- Configure PostGIS extensions
- Set up database users and permissions
- Tune PostgreSQL for OSM workload
- Import initial database schema

## Rollback (if needed)

If you need to undo Phase 1:

```bash
# Remove rbenv
rm -rf ~/.rbenv

# Remove nvm
rm -rf ~/.nvm

# Remove added lines from .bashrc
sed -i '/rbenv/d' ~/.bashrc
sed -i '/nvm/d' ~/.bashrc

# Remove installed packages (optional - be careful!)
sudo apt-get remove --purge mapnik-utils libmapnik-dev apache2 renderd
```

However, I recommend completing the full setup before considering rollback.

## Support

If you encounter issues:
1. Check the script output for specific errors
2. Run the verification commands above
3. Check `/var/log/apt/` for package installation logs
4. Verify disk space: `df -h`

Ready to proceed? Run the Phase 1 script!

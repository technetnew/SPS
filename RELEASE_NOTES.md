# SPS - Release Notes

All notable changes to the Survival Preparedness System are documented in this file.

## [v2.0.0] - 2025-11-22

### Major Update: Complete SPS System with All Modules

This release represents a comprehensive overhaul of the entire SPS system, adding multiple new modules and features for complete emergency preparedness management.

#### New Features

**Food Pantry System**
- Complete food storage tracking with nutritional information (calories, protein, carbs, fat)
- Expiration monitoring with 7/30/90 day alerts
- Category and location organization
- Quick consume feature with consumption history
- Item grouping by name for batch management

**Equipment Inventory**
- Non-food item management with barcode/QR scanning
- Par level alerts for restocking notifications
- Location tracking and serial number management
- Search and filter capabilities

**Garden Planner**
- Planting scheduler with growing zone support
- Seed-to-harvest tracking
- Harvest logging with yield data
- Companion planting suggestions

**Survival Simulation Engine**
- Emergency scenario planning (power outage, evacuation, shelter-in-place)
- What-if analysis with resource projections
- Family needs calculator based on member profiles
- DOS (Days of Supply) calculations
- Resource consumption modeling

**QR Code System**
- Full item data embedded in QR codes for offline readability
- Compressed data format with `SPS:` prefix
- Sync detection between QR and database
- Group QR codes for multiple items (`SPSG:` prefix)
- Print labels with full metadata

**GPS & Offline Maps**
- OpenStreetMap integration for offline use
- GPS tracking and waypoint management
- Meeting point coordination
- Offline geocoding with Photon

**Photo Gallery**
- Secure photo storage with album organization
- Photo metadata management
- User-specific galleries

#### Improvements
- Updated all database schemas for new modules
- Added comprehensive API routes for all features
- Improved styling with dark theme support
- Enhanced mobile responsiveness
- Better error handling across all modules

#### Files Added/Modified
- 110 files changed
- 137,179 insertions
- New route files: pantry, inventory, garden, simulation, qr, gps, pictures, osm
- New CSS files for all modules
- New HTML pages for all features
- Database schema files for all modules

---

## [v1.2.0] - 2025-11-22

### Complete Kiwix System Rewrite

#### Changes
- Fixed Kiwix download functionality
- Improved library management
- Better catalog browsing
- Fixed server start/stop operations

---

## [v1.1.1] - 2025-11-21

### Fix File Permissions

#### Changes
- Corrected permissions for web files
- Fixed 403 Forbidden errors for static assets

---

## [v1.1.0] - 2025-11-21

### One-Command Installer

#### New Features
- Added `install.sh` one-command installer
- Added deployment guides
- Automated PostgreSQL setup
- Automated Nginx configuration
- PM2 process management setup

---

## [v1.0.0] - 2025-11-19

### Major Update: Multi-user Sharing, Video Library, and Kiwix

#### New Features

**Multi-User System**
- User authentication with JWT tokens
- Share resources between users
- Granular permissions (view, edit, admin)
- Family/group collaboration
- Activity logging

**Video Library**
- Upload local videos
- YouTube download integration with yt-dlp
- Playlist organization
- List and grid view modes

**Kiwix Integration**
- Download Wikipedia and other encyclopedias
- Completely offline access
- Search across downloaded content
- Multiple ZIM file support

---

## [v0.1.0] - 2025-11-19

### Initial Release

#### Features
- Basic inventory management
- Emergency plans
- Family member profiles
- Meeting points
- Skills tracking
- Alerts and notifications
- Document storage
- Checklists

---

## Version History Summary

| Version | Date | Description |
|---------|------|-------------|
| v2.0.0 | 2025-11-22 | Complete SPS System with All Modules |
| v1.2.0 | 2025-11-22 | Kiwix System Rewrite |
| v1.1.1 | 2025-11-21 | File Permissions Fix |
| v1.1.0 | 2025-11-21 | One-Command Installer |
| v1.0.0 | 2025-11-19 | Multi-user, Video, Kiwix |
| v0.1.0 | 2025-11-19 | Initial Release |

---

## Commit Reference

- `fc81a62` - v2.0.0 - Major Update: Complete SPS System with All Modules
- `e27edbd` - v1.2.0 - Complete Kiwix system rewrite
- `911162e` - v1.1.1 - Fix file permissions for web files
- `59ca234` - v1.1.0 - Add one-command installer and deployment guides
- `6a5e8fc` - v1.0.0 - Major Update: Multi-user sharing, video library, and Kiwix
- `61318b4` - v0.1.0 - Initial SPS structure

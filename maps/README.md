# SPS GPS and Offline Maps Setup

## Overview
The GPS system provides navigation using:
- **OpenStreetMap** - Map tiles served from OSM tile servers
- **MapLibre GL JS** - Client-side map rendering (served locally)
- **gpsd** - Interfaces with GPS hardware

## 1. OpenStreetMap Integration

### How It Works
SPS uses OpenStreetMap for map tiles:
- **Map Library**: MapLibre GL JS (served locally from `/lib/maplibre/`)
- **Map Tiles**: Raster tiles from OpenStreetMap tile servers
- **Tile Servers**:
  - `https://a.tile.openstreetmap.org/{z}/{x}/{y}.png`
  - `https://b.tile.openstreetmap.org/{z}/{x}/{y}.png`
  - `https://c.tile.openstreetmap.org/{z}/{x}/{y}.png`

### Local Files
The following files are served locally for offline operation:
- `/var/www/sps/lib/maplibre/maplibre-gl.js` (785KB)
- `/var/www/sps/lib/maplibre/maplibre-gl.css` (64KB)

### Tile Source
Map tiles are fetched from OpenStreetMap tile servers as raster images (PNG format).

**Note**: An internet connection is required to load map tiles. The MapLibre library works offline, but tiles need to be cached by the browser.

**Usage Policy**: Please respect OpenStreetMap's [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/). For heavy usage, consider setting up your own tile server.

## 2. Setting Up GPS (gpsd)

### Install gpsd and clients
```bash
sudo apt update
sudo apt install gpsd gpsd-clients -y
```

### Configure gpsd

Edit `/etc/default/gpsd`:
```bash
sudo nano /etc/default/gpsd
```

Add your GPS device:
```
# Start gpsd automatically
START_GPSD="true"

# Devices gpsd should collect data from
DEVICES="/dev/ttyUSB0"  # or /dev/ttyACM0 for USB GPS

# Other options
GPSD_OPTIONS="-n"
```

**Common GPS device paths:**
- USB GPS: `/dev/ttyUSB0` or `/dev/ttyACM0`
- Serial GPS: `/dev/ttyS0`
- Bluetooth GPS: `/dev/rfcomm0`

### Find your GPS device
```bash
# List USB devices
ls /dev/ttyUSB* /dev/ttyACM*

# Or check dmesg after plugging in GPS
sudo dmesg | tail -20

# Test GPS connection
sudo gpsd -D 5 -N -n /dev/ttyUSB0
```

### Start gpsd service
```bash
sudo systemctl enable gpsd
sudo systemctl start gpsd
sudo systemctl status gpsd
```

### Test GPS functionality
```bash
# Watch GPS data live
cgps

# Or get JSON output
gpspipe -w -n 10

# Check if getting fix
gpsmon
```

## 3. Verification

### Check GPS API
```bash
# Should return GPS status
curl http://localhost:3000/api/gps/status

# Should return location data
curl http://localhost:3000/api/gps/location
```

### Test in Browser
Navigate to: `http://your-server-ip/gps.html`

You should see:
- OpenStreetMap-based map viewer
- GPS status bar showing position, altitude, speed, satellites
- Real-time GPS tracking (updates every second)
- Auto-follow toggle
- Fullscreen support

## 4. Troubleshooting

### Map tiles not loading
1. Check internet connection (tiles load from OpenStreetMap servers)
2. Verify MapLibre GL files are accessible:
   - `curl http://localhost/lib/maplibre/maplibre-gl.js`
   - `curl http://localhost/lib/maplibre/maplibre-gl.css`
3. Check browser console for errors
4. Verify OpenStreetMap tile servers are accessible: `curl https://a.tile.openstreetmap.org/`

### GPS not working
1. Check gpsd is running: `sudo systemctl status gpsd`
2. Verify GPS device is connected: `ls /dev/ttyUSB* /dev/ttyACM*`
3. Test with gpspipe: `gpspipe -w -n 10`
4. Check permissions: `sudo usermod -a -G dialout $USER`
5. Restart gpsd: `sudo systemctl restart gpsd`

### No GPS fix
- GPS needs clear view of sky
- May take 1-5 minutes for initial fix (cold start)
- Check satellite count in status bar
- Use `cgps` or `gpsmon` to see satellite signal strength

## 5. System Architecture

```
┌─────────────────┐
│   Browser       │
│ (MapLibre GL)   │
└────────┬────────┘
         │
    HTTP │ (Tiles from OSM)
         │
         ├─────────────────────────────┐
         │                             │
         ▼                             ▼
┌─────────────────┐          ┌──────────────────┐
│  OpenStreetMap  │          │  SPS Backend     │
│  Tile Servers   │          │  (Port 3000)     │
│  (Raster Tiles) │          │  /api/gps/*      │
└─────────────────┘          └────────┬─────────┘
                                      │
                                      │ (gpspipe)
                                      ▼
                             ┌──────────────────┐
                             │    gpsd          │
                             │                  │
                             └────────┬─────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │  GPS Device      │
                             │  (Hardware)      │
                             └──────────────────┘
```

## 6. Performance Notes

- **Raster tiles**: OpenStreetMap uses raster (PNG) tiles at 256x256 pixels
- **GPS update rate**: Frontend polls every 1 second by default
- **Auto-start**: Backend is managed by PM2 and restarts on reboot
- **Browser caching**: Map tiles are cached by the browser for offline use
- **Tile servers**: Uses a/b/c subdomains for load balancing

## 7. Features

### Map Controls
- **Locate button**: Start GPS tracking and center on current location
- **Follow button**: Toggle auto-follow mode (map follows GPS position)
- **Fullscreen button**: Toggle fullscreen mode
- **Zoom controls**: Built-in MapLibre zoom controls
- **Scale**: Metric and imperial scale indicator

### GPS Status Bar
Displays real-time GPS information:
- **GPS Status**: Fix quality (0-3, where 2+ is good)
- **Position**: Latitude and longitude in decimal degrees
- **Altitude**: Height above sea level in meters
- **Speed**: Current speed in km/h
- **Accuracy**: Position accuracy in meters
- **Satellites**: Number of satellites in view

### Auto-Follow
- Enabled by default when GPS fix is acquired
- Automatically centers map on GPS position
- Disables when user manually pans the map
- Can be re-enabled with the follow button

## 8. OpenStreetMap Resources

- **Project**: https://www.openstreetmap.org/
- **Tile Usage Policy**: https://operations.osmfoundation.org/policies/tiles/
- **Wiki**: https://wiki.openstreetmap.org/
- **MapLibre GL JS**: https://maplibre.org/

## 9. Alternative Tile Servers

If you need higher usage or want to host tiles locally, consider:

1. **Self-hosted tile server**: Set up your own tile server using:
   - [TileServer GL](https://github.com/maptiler/tileserver-gl) with MBTiles
   - [OpenMapTiles](https://openmaptiles.org/)
   - [Nominatim](https://nominatim.org/) for geocoding

2. **Third-party tile providers**:
   - [MapTiler](https://www.maptiler.com/)
   - [Thunderforest](https://www.thunderforest.com/)
   - [Stamen](http://maps.stamen.com/)

## Support

For issues:
1. Check PM2 logs: `pm2 logs sps-api`
2. Check system logs: `journalctl -u gpsd -f`
3. Check browser console for JavaScript errors
4. Verify backend is running: `pm2 list`
5. Test GPS endpoint: `curl http://localhost:3000/api/gps/location`

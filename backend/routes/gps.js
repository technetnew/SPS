const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const router = express.Router();

// No authentication required for GPS - it's just location data
// In a production system, you might want to require auth

/**
 * Get current GPS position
 * Returns: { lat, lon, alt, speed, fix, satellites, timestamp }
 */
router.get('/location', async (req, res) => {
    try {
        // Try to get GPS data from gpsd using gpspipe
        // gpspipe -w -n 10 outputs JSON data from gpsd
        let gpsData = null;

        try {
            const { stdout, stderr } = await execAsync('timeout 3 gpspipe -w -n 10 2>&1', {
                timeout: 4000
            });

            if (stderr && stderr.includes('connect')) {
                // gpsd is not running
                return res.json({
                    success: false,
                    error: 'GPS daemon not running',
                    lat: null,
                    lon: null,
                    alt: null,
                    speed: null,
                    fix: 0,
                    satellites: 0,
                    timestamp: new Date().toISOString()
                });
            }

            // Parse JSON output from gpspipe
            const lines = stdout.split('\n').filter(line => line.trim());
            let tpvData = null;
            let skyData = null;

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.class === 'TPV' && data.lat && data.lon) {
                        tpvData = data;
                    }
                    if (data.class === 'SKY') {
                        skyData = data;
                    }
                } catch (e) {
                    // Skip invalid JSON lines
                }
            }

            if (tpvData) {
                gpsData = {
                    success: true,
                    lat: tpvData.lat || null,
                    lon: tpvData.lon || null,
                    alt: tpvData.alt || tpvData.altHAE || null,
                    speed: tpvData.speed || null,
                    track: tpvData.track || null,
                    fix: tpvData.mode || 0,
                    accuracy: tpvData.eph || null,
                    satellites: skyData ? (skyData.uSat || 0) : 0,
                    timestamp: tpvData.time || new Date().toISOString()
                };
            } else {
                // No fix
                gpsData = {
                    success: false,
                    error: 'No GPS fix',
                    lat: null,
                    lon: null,
                    alt: null,
                    speed: null,
                    fix: 0,
                    satellites: skyData ? (skyData.uSat || 0) : 0,
                    timestamp: new Date().toISOString()
                };
            }

        } catch (error) {
            // gpsd or gpspipe not available
            console.log('[GPS] Error querying GPS:', error.message);
            return res.json({
                success: false,
                error: 'GPS not available',
                lat: null,
                lon: null,
                alt: null,
                speed: null,
                fix: 0,
                satellites: 0,
                timestamp: new Date().toISOString()
            });
        }

        res.json(gpsData);

    } catch (error) {
        console.error('[GPS] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            lat: null,
            lon: null,
            alt: null,
            speed: null,
            fix: 0,
            satellites: 0,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Get GPS status and info
 */
router.get('/status', async (req, res) => {
    try {
        // Check if gpsd is running
        const { stdout: ps } = await execAsync('pgrep -x gpsd || echo ""');
        const gpsdRunning = ps.trim().length > 0;

        // Check if gpspipe is available
        let gpspipeAvailable = false;
        try {
            await execAsync('which gpspipe');
            gpspipeAvailable = true;
        } catch (e) {
            gpspipeAvailable = false;
        }

        res.json({
            gpsd_running: gpsdRunning,
            gpspipe_available: gpspipeAvailable,
            status: gpsdRunning && gpspipeAvailable ? 'ready' : 'not_configured',
            message: !gpsdRunning ? 'GPS daemon not running' :
                     !gpspipeAvailable ? 'gpspipe not installed' :
                     'GPS ready'
        });

    } catch (error) {
        console.error('[GPS] Status check error:', error);
        res.status(500).json({ error: 'Failed to check GPS status' });
    }
});

/**
 * Offline geocoding - search for places
 * This is a simple offline geocoder using a basic database of known locations
 */
router.get('/geocode', async (req, res) => {
    try {
        const query = req.query.q || '';

        if (!query) {
            return res.json({ results: [] });
        }

        // Simple offline geocoding database - major US and world cities
        const offlineDatabase = [
            { name: 'San Francisco, CA', lat: 37.7749, lon: -122.4194, type: 'city' },
            { name: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437, type: 'city' },
            { name: 'New York, NY', lat: 40.7128, lon: -74.0060, type: 'city' },
            { name: 'Chicago, IL', lat: 41.8781, lon: -87.6298, type: 'city' },
            { name: 'Houston, TX', lat: 29.7604, lon: -95.3698, type: 'city' },
            { name: 'Phoenix, AZ', lat: 33.4484, lon: -112.0740, type: 'city' },
            { name: 'Philadelphia, PA', lat: 39.9526, lon: -75.1652, type: 'city' },
            { name: 'San Antonio, TX', lat: 29.4241, lon: -98.4936, type: 'city' },
            { name: 'San Diego, CA', lat: 32.7157, lon: -117.1611, type: 'city' },
            { name: 'Dallas, TX', lat: 32.7767, lon: -96.7970, type: 'city' },
            { name: 'Seattle, WA', lat: 47.6062, lon: -122.3321, type: 'city' },
            { name: 'Denver, CO', lat: 39.7392, lon: -104.9903, type: 'city' },
            { name: 'Miami, FL', lat: 25.7617, lon: -80.1918, type: 'city' },
            { name: 'Atlanta, GA', lat: 33.7490, lon: -84.3880, type: 'city' },
            { name: 'Boston, MA', lat: 42.3601, lon: -71.0589, type: 'city' },
            { name: 'London, UK', lat: 51.5074, lon: -0.1278, type: 'city' },
            { name: 'Paris, France', lat: 48.8566, lon: 2.3522, type: 'city' },
            { name: 'Berlin, Germany', lat: 52.5200, lon: 13.4050, type: 'city' },
            { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503, type: 'city' },
            { name: 'Sydney, Australia', lat: -33.8688, lon: 151.2093, type: 'city' },
        ];

        // Search for matches
        const searchTerm = query.toLowerCase();
        const results = offlineDatabase
            .filter(place => place.name.toLowerCase().includes(searchTerm))
            .slice(0, 10)
            .map(place => ({
                display_name: place.name,
                lat: place.lat,
                lon: place.lon,
                type: place.type
            }));

        res.json({ results });

    } catch (error) {
        console.error('[GPS] Geocoding error:', error);
        res.status(500).json({ error: 'Geocoding failed', results: [] });
    }
});

module.exports = router;

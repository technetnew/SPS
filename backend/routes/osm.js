const express = require('express');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const execAsync = promisify(exec);
const router = express.Router();

// OSM data paths
const OSM_BASE_DIR = path.join(__dirname, '../../osm-data');
const DOWNLOADS_DIR = path.join(OSM_BASE_DIR, 'downloads');
const DATA_DIR = path.join(OSM_BASE_DIR, 'data');
const TILES_DIR = path.join(OSM_BASE_DIR, 'tiles');

// In-memory state for sync jobs
const syncJobs = new Map();

// OSM data presets
const OSM_PRESETS = [
    {
        id: 'california',
        name: 'California, USA',
        url: 'https://download.geofabrik.de/north-america/us/california-latest.osm.pbf',
        size: '2.5 GB',
        diskSpace: '~21 GB',
        importTime: '2-4 hours',
        description: 'Complete map data for California state'
    },
    {
        id: 'texas',
        name: 'Texas, USA',
        url: 'https://download.geofabrik.de/north-america/us/texas-latest.osm.pbf',
        size: '3 GB',
        diskSpace: '~25 GB',
        importTime: '2-5 hours',
        description: 'Complete map data for Texas state'
    },
    {
        id: 'new-york',
        name: 'New York, USA',
        url: 'https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf',
        size: '1.8 GB',
        diskSpace: '~15 GB',
        importTime: '1-3 hours',
        description: 'Complete map data for New York state'
    },
    {
        id: 'us',
        name: 'United States (Complete)',
        url: 'https://download.geofabrik.de/north-america/us-latest.osm.pbf',
        size: '11 GB',
        diskSpace: '~106 GB',
        importTime: '12-24 hours',
        description: 'Complete map data for entire United States'
    },
    {
        id: 'planet',
        name: 'Full Planet (World)',
        url: 'https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf',
        size: '84+ GB',
        diskSpace: '~684 GB',
        importTime: '2-3 days',
        description: 'Complete worldwide map data - requires significant resources'
    }
];

/**
 * GET /api/osm/presets
 * Get list of available OSM data presets
 */
router.get('/presets', (req, res) => {
    res.json(OSM_PRESETS);
});

/**
 * GET /api/osm/status
 * Get current OSM system status
 */
router.get('/status', async (req, res) => {
    try {
        const status = {
            database: { status: 'unknown' },
            tileServer: { status: 'unknown' },
            geocoder: { status: 'unknown' },
            dataFiles: { status: 'unknown' },
            syncJob: null
        };

        // Check database
        try {
            const { stdout } = await execAsync('PGPASSWORD=osm_offline_2025 psql -U osm -d osm -h localhost -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\';" -t');
            const tableCount = parseInt(stdout.trim());
            status.database = {
                status: tableCount > 0 ? 'ready' : 'empty',
                tables: tableCount
            };
        } catch (error) {
            status.database = { status: 'not_configured', error: error.message };
        }

        // Check tile server (port 8081)
        try {
            await axios.get('http://localhost:8081/', { timeout: 2000 });
            status.tileServer = { status: 'online', port: 8081 };
        } catch (error) {
            status.tileServer = { status: 'offline', port: 8081 };
        }

        // Check geocoder (port 7070)
        try {
            await axios.get('http://localhost:7070/', { timeout: 2000 });
            status.geocoder = { status: 'online', port: 7070 };
        } catch (error) {
            status.geocoder = { status: 'offline', port: 7070 };
        }

        // Check for OSM data files
        try {
            const currentFile = path.join(DATA_DIR, 'current.osm.pbf');
            const tilesFile = path.join(TILES_DIR, 'world.mbtiles');

            const dataExists = await fs.access(currentFile).then(() => true).catch(() => false);
            const tilesExist = await fs.access(tilesFile).then(() => true).catch(() => false);

            if (dataExists) {
                const stats = await fs.stat(currentFile);
                status.dataFiles = {
                    status: 'present',
                    osmFile: currentFile,
                    size: (stats.size / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                    tilesGenerated: tilesExist
                };
            } else {
                status.dataFiles = { status: 'not_present' };
            }
        } catch (error) {
            status.dataFiles = { status: 'error', error: error.message };
        }

        // Get active sync job if any
        for (const [jobId, job] of syncJobs.entries()) {
            if (job.status !== 'completed' && job.status !== 'failed') {
                status.syncJob = {
                    id: jobId,
                    preset: job.preset,
                    status: job.status,
                    progress: job.progress,
                    message: job.message
                };
                break;
            }
        }

        res.json(status);
    } catch (error) {
        console.error('[OSM] Status check error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

/**
 * POST /api/osm/sync/start
 * Start a new OSM data sync job
 */
router.post('/sync/start', async (req, res) => {
    try {
        const { presetId, customUrl } = req.body;

        // Find preset or use custom URL
        let preset = OSM_PRESETS.find(p => p.id === presetId);
        let downloadUrl;

        if (customUrl) {
            downloadUrl = customUrl;
            preset = {
                id: 'custom',
                name: 'Custom Extract',
                url: customUrl,
                size: 'Unknown',
                diskSpace: 'Unknown',
                importTime: 'Unknown'
            };
        } else if (preset) {
            downloadUrl = preset.url;
        } else {
            return res.status(400).json({ error: 'Invalid preset or custom URL required' });
        }

        // Check if a job is already running
        for (const job of syncJobs.values()) {
            if (job.status === 'downloading' || job.status === 'importing' || job.status === 'generating_tiles') {
                return res.status(409).json({ error: 'Another sync job is already running', jobId: job.id });
            }
        }

        // Create new job
        const jobId = Date.now().toString();
        const job = {
            id: jobId,
            preset: preset.name,
            downloadUrl,
            status: 'initializing',
            progress: 0,
            message: 'Preparing to download...',
            startedAt: new Date().toISOString(),
            log: []
        };

        syncJobs.set(jobId, job);

        // Start sync process in background
        startSyncProcess(jobId, downloadUrl, preset.id || 'custom');

        res.json({ jobId, status: job.status, message: 'Sync job started' });
    } catch (error) {
        console.error('[OSM] Sync start error:', error);
        res.status(500).json({ error: 'Failed to start sync job' });
    }
});

/**
 * GET /api/osm/sync/:jobId
 * Get status of a specific sync job
 */
router.get('/sync/:jobId', (req, res) => {
    const { jobId } = req.params;
    const job = syncJobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
        id: job.id,
        preset: job.preset,
        status: job.status,
        progress: job.progress,
        message: job.message,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        log: job.log.slice(-50) // Last 50 log entries
    });
});

/**
 * DELETE /api/osm/sync/:jobId
 * Cancel a running sync job
 */
router.delete('/sync/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const job = syncJobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    if (job.process) {
        job.process.kill('SIGTERM');
    }

    job.status = 'cancelled';
    job.message = 'Job cancelled by user';
    job.completedAt = new Date().toISOString();

    res.json({ message: 'Job cancelled', jobId });
});

/**
 * Background sync process
 */
async function startSyncProcess(jobId, downloadUrl, presetId) {
    const job = syncJobs.get(jobId);
    if (!job) return;

    const filename = path.basename(downloadUrl);
    const downloadPath = path.join(DOWNLOADS_DIR, filename);
    const targetPath = path.join(DATA_DIR, 'current.osm.pbf');
    const tilesPath = path.join(TILES_DIR, 'world.mbtiles');

    try {
        // Stage 1: Download
        job.status = 'downloading';
        job.message = 'Downloading OSM data...';
        job.progress = 0;
        job.log.push(`[${new Date().toISOString()}] Starting download from ${downloadUrl}`);

        await downloadFile(downloadUrl, downloadPath, (progress) => {
            job.progress = Math.floor(progress * 30); // Download is 0-30%
            job.message = `Downloading: ${job.progress}%`;
        });

        job.log.push(`[${new Date().toISOString()}] Download complete: ${downloadPath}`);

        // Create symbolic link
        try {
            await fs.unlink(targetPath).catch(() => {});
            await fs.symlink(downloadPath, targetPath);
        } catch (error) {
            job.log.push(`[${new Date().toISOString()}] Warning: Could not create symlink: ${error.message}`);
        }

        // Stage 2: Import to PostgreSQL
        job.status = 'importing';
        job.progress = 30;
        job.message = 'Importing to database...';
        job.log.push(`[${new Date().toISOString()}] Starting osm2pgsql import`);

        await runOsm2pgsql(downloadPath, (message) => {
            job.progress = 30 + Math.floor(Math.random() * 40); // Import is 30-70%
            job.message = `Importing: ${message}`;
            job.log.push(`[${new Date().toISOString()}] ${message}`);
        });

        job.log.push(`[${new Date().toISOString()}] Import complete`);

        // Stage 3: Generate tiles
        job.status = 'generating_tiles';
        job.progress = 70;
        job.message = 'Generating map tiles...';
        job.log.push(`[${new Date().toISOString()}] Starting tile generation`);

        await generateTiles(downloadPath, tilesPath, (message) => {
            job.progress = 70 + Math.floor(Math.random() * 25); // Tiles is 70-95%
            job.message = `Generating tiles: ${message}`;
            job.log.push(`[${new Date().toISOString()}] ${message}`);
        });

        job.log.push(`[${new Date().toISOString()}] Tile generation complete`);

        // Stage 4: Complete
        job.status = 'completed';
        job.progress = 100;
        job.message = 'Sync complete! Restarting services...';
        job.completedAt = new Date().toISOString();
        job.log.push(`[${new Date().toISOString()}] Sync completed successfully`);

        // Restart tile server
        try {
            await execAsync('pm2 restart osm-tiles 2>/dev/null || echo "Tile server not running"');
            job.log.push(`[${new Date().toISOString()}] Tile server restarted`);
        } catch (error) {
            job.log.push(`[${new Date().toISOString()}] Note: Tile server restart failed - start manually`);
        }

    } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        job.message = `Failed: ${error.message}`;
        job.completedAt = new Date().toISOString();
        job.log.push(`[${new Date().toISOString()}] ERROR: ${error.message}`);
        console.error('[OSM] Sync process error:', error);
    }
}

/**
 * Download file with progress tracking
 */
function downloadFile(url, outputPath, onProgress) {
    return new Promise((resolve, reject) => {
        const writer = require('fs').createWriteStream(outputPath);

        axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 300000 // 5 minute timeout
        }).then(response => {
            const totalLength = response.headers['content-length'];
            let downloadedLength = 0;

            response.data.on('data', (chunk) => {
                downloadedLength += chunk.length;
                if (totalLength && onProgress) {
                    onProgress(downloadedLength / totalLength);
                }
            });

            response.data.pipe(writer);

            writer.on('finish', () => resolve());
            writer.on('error', reject);
        }).catch(reject);
    });
}

/**
 * Run osm2pgsql import
 */
function runOsm2pgsql(pbfFile, onProgress) {
    return new Promise((resolve, reject) => {
        const args = [
            '-c', // Create
            '-d', 'osm',
            '-U', 'osm',
            '-H', 'localhost',
            '--slim',
            '-C', '4000',
            '--number-processes', '4',
            '--hstore',
            '--multi-geometry',
            pbfFile
        ];

        const env = { ...process.env, PGPASSWORD: 'osm_offline_2025' };
        const proc = spawn('osm2pgsql', args, { env });

        let output = '';

        proc.stdout.on('data', (data) => {
            output += data.toString();
            const lines = output.split('\n');
            if (lines.length > 0) {
                onProgress(lines[lines.length - 2] || 'Processing...');
            }
        });

        proc.stderr.on('data', (data) => {
            onProgress(data.toString().trim());
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`osm2pgsql exited with code ${code}`));
            }
        });

        proc.on('error', reject);
    });
}

/**
 * Generate tiles with tilemaker
 */
function generateTiles(pbfFile, outputFile, onProgress) {
    return new Promise((resolve, reject) => {
        const args = [
            '--input', pbfFile,
            '--output', outputFile,
            '--verbose'
        ];

        const proc = spawn('tilemaker', args);

        proc.stdout.on('data', (data) => {
            onProgress(data.toString().trim());
        });

        proc.stderr.on('data', (data) => {
            onProgress(data.toString().trim());
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`tilemaker exited with code ${code}`));
            }
        });

        proc.on('error', reject);
    });
}

/**
 * GET /api/osm/search
 * Proxy to local Nominatim/Photon geocoder
 */
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || '';

        if (!query) {
            return res.json({ results: [] });
        }

        // Try local geocoder first (Photon on port 7070)
        try {
            const response = await axios.get(`http://localhost:7070/api`, {
                params: { q: query },
                timeout: 5000
            });

            const results = response.data.features.map(feature => ({
                display_name: feature.properties.name || feature.properties.street || 'Unknown',
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
                type: feature.properties.type || 'place',
                city: feature.properties.city,
                state: feature.properties.state,
                country: feature.properties.country
            }));

            return res.json({ results, source: 'local' });
        } catch (error) {
            // Geocoder not available, return empty
            return res.json({ results: [], source: 'none', error: 'Local geocoder not available' });
        }
    } catch (error) {
        console.error('[OSM] Search error:', error);
        res.status(500).json({ error: 'Search failed', results: [] });
    }
});

/**
 * GET /api/osm/reverse
 * Reverse geocoding - coordinates to address
 */
router.get('/reverse', async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'lat and lon parameters required' });
        }

        // Try local geocoder
        try {
            const response = await axios.get(`http://localhost:7070/reverse`, {
                params: { lat, lon },
                timeout: 5000
            });

            const feature = response.data.features[0];
            if (feature) {
                const result = {
                    display_name: feature.properties.name || 'Unknown location',
                    lat: parseFloat(lat),
                    lon: parseFloat(lon),
                    address: feature.properties
                };

                return res.json(result);
            }
        } catch (error) {
            // Geocoder not available
        }

        res.json({ display_name: `${lat}, ${lon}`, lat: parseFloat(lat), lon: parseFloat(lon) });
    } catch (error) {
        console.error('[OSM] Reverse geocoding error:', error);
        res.status(500).json({ error: 'Reverse geocoding failed' });
    }
});

module.exports = router;

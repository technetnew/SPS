const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { optionalAuth } = require('../middleware/auth');

function getClientHost(req) {
    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = (forwardedHost || req.headers.host || '').toString();
    return hostHeader.split(':')[0] || 'localhost';
}

function sendRunningResponse(req, res, pid) {
    exec('hostname -I', (ipError, ipStdout) => {
        const ipCandidates = ipError ? [] : ipStdout.trim().split(/\s+/).filter(Boolean);
        const primaryIp = ipCandidates[0] || 'localhost';

        res.json({
            running: true,
            port: 8080,
            pid,
            ip: primaryIp,
            ipCandidates,
            clientHost: getClientHost(req)
        });
    });
}

const checkKiwixProcess = (req, res, autoStartOnMissing = false) => {
    exec("pgrep -f 'kiwix-serve'", async (pgError, pgStdout) => {
        if (!pgError && pgStdout?.trim()) {
            const pid = parseInt(pgStdout.trim().split('\n')[0], 10);
            return sendRunningResponse(req, res, pid);
        }

        if (autoStartOnMissing) {
            await autoStartKiwix();
            return res.json({ running: false, autoStarting: true });
        }

        return res.json({ running: false });
    });
};

// Kiwix directories
const KIWIX_DIR = '/var/www/sps/kiwix';
const KIWIX_DATA_DIR = path.join(KIWIX_DIR, 'data');
const KIWIX_LIBRARY_DIR = path.join(KIWIX_DIR, 'library');
const LIBRARY_XML = path.join(KIWIX_LIBRARY_DIR, 'library.xml');

// Auto-start Kiwix helper function
async function autoStartKiwix() {
    try {
        console.log('[Kiwix] Auto-starting Kiwix server...');
        await rebuildLibrary();

        return new Promise((resolve) => {
            // Start Kiwix
            const cmd = `pm2 start kiwix-serve --name kiwix -- --port 8080 --library ${LIBRARY_XML}`;
            exec(cmd, (error) => {
                if (error) {
                    console.error('[Kiwix] Auto-start failed:', error);
                    resolve(false);
                } else {
                    console.log('[Kiwix] Auto-started successfully');
                    exec('pm2 save');
                    resolve(true);
                }
            });
        });
    } catch (error) {
        console.error('[Kiwix] Auto-start error:', error);
        return false;
    }
}

// Get Kiwix server status (with auto-start verification)
router.get('/status', optionalAuth, async (req, res) => {
    try {
        exec('pm2 jlist', async (error, stdout) => {
            if (error) {
                return checkKiwixProcess(req, res, true);
            }

            try {
                const processes = JSON.parse(stdout);
                const kiwix = processes.find(p => p.name === 'kiwix');

                if (kiwix && kiwix.pm2_env.status === 'online') {
                    return sendRunningResponse(req, res, kiwix.pid);
                } else if (kiwix && kiwix.pm2_env.status === 'stopped') {
                    // Kiwix exists but stopped - restart it
                    console.log('[Kiwix] Found stopped Kiwix process, restarting...');
                    exec('pm2 restart kiwix', () => {});
                    return res.json({ running: false, restarting: true });
                } else {
                    return checkKiwixProcess(req, res, true);
                }
            } catch (parseError) {
                console.error('[Kiwix] Failed to parse PM2 status:', parseError);
                return checkKiwixProcess(req, res, true);
            }
        });
    } catch (error) {
        console.error('[Kiwix] Status error:', error);
        return checkKiwixProcess(req, res, true);
    }
});

// Get catalog of available ZIM files (scrape from download.kiwix.org)
router.get('/catalog', optionalAuth, async (req, res) => {
    try {
        const cacheFile = path.join(KIWIX_DIR, 'catalog-cache.json');
        const cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours
        const forceRescan = req.query.force === 'true';

        // Try to read from cache unless force rescan
        if (!forceRescan) {
            try {
                const stats = await fs.stat(cacheFile);
                const age = Date.now() - stats.mtimeMs;

                if (age < cacheMaxAge) {
                    const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
                    return res.json({
                        catalog: cached,
                        cached: true,
                        cacheAge: Math.floor(age / 1000 / 60) // minutes
                    });
                }
            } catch {
                // Cache doesn't exist
            }
        }

        // If force rescan, start background job
        if (forceRescan) {
            // Start scraping in background
            exec('node /var/www/sps/backend/scripts/scrape-kiwix-catalog.js &');

            // Return current cache if available, or empty array
            try {
                const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
                return res.json({
                    catalog: cached,
                    cached: true,
                    scanning: true,
                    message: 'Background scan started'
                });
            } catch {
                return res.json({
                    catalog: [],
                    cached: false,
                    scanning: true,
                    message: 'Background scan started, please refresh in a minute'
                });
            }
        }

        // Normal flow - try to load from cache or scan synchronously
        try {
            const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
            return res.json({ catalog: cached, cached: true });
        } catch {
            // No cache, need to scan - start background job
            exec('node /var/www/sps/backend/scripts/scrape-kiwix-catalog.js &');
            return res.json({
                catalog: [],
                cached: false,
                scanning: true,
                message: 'Scanning Kiwix library, please refresh in a minute'
            });
        }
    } catch (error) {
        console.error('Failed to get catalog:', error);
        res.status(500).json({ error: 'Failed to get catalog' });
    }
});

// Download a ZIM file
router.post('/download', optionalAuth, [
    body('url').isURL(),
    body('filename').trim().notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { url, filename } = req.body;
    const filepath = path.join(KIWIX_DATA_DIR, filename);
    const progressFile = `/tmp/kiwix-progress-${filename}.json`;

    try {
        // Create progress tracking file
        await fs.writeFile(progressFile, JSON.stringify({
            filename,
            url,
            status: 'downloading',
            progress: 0,
            downloaded: 0,
            total: 0,
            startTime: new Date().toISOString()
        }));

        // Enhanced download script with progress tracking and auto-library update
        const downloadScript = `
#!/bin/bash
FILENAME="${filename}"
URL="${url}"
DATA_DIR="${KIWIX_DATA_DIR}"
PROGRESS_FILE="${progressFile}"
LIBRARY_XML="${LIBRARY_XML}"

cd "$DATA_DIR"

# Update progress: downloading
echo '{"filename":"'$FILENAME'","status":"downloading","progress":0,"startTime":"'$(date -Iseconds)'"}' > "$PROGRESS_FILE"

# Download with wget
wget -c --progress=bar:force "$URL" -O "$FILENAME" 2>&1 | while IFS= read -r line; do
    if [[ "$line" =~ ([0-9]+)% ]]; then
        PERCENT="\${BASH_REMATCH[1]}"
        echo '{"filename":"'$FILENAME'","status":"downloading","progress":'$PERCENT'}' > "$PROGRESS_FILE"
    fi
done

# Check if download was successful
if [ -f "$FILENAME" ] && [ -s "$FILENAME" ]; then
    FILE_SIZE=$(stat -f%z "$FILENAME" 2>/dev/null || stat -c%s "$FILENAME")

    # Update progress: completed
    echo '{"filename":"'$FILENAME'","status":"processing","progress":100,"downloaded":'$FILE_SIZE'}' > "$PROGRESS_FILE"

    # Rebuild library
    cd /var/www/sps/backend
    node -e "
        const { exec } = require('child_process');
        const fs = require('fs');

        // Rebuild library.xml
        exec('kiwix-manage $LIBRARY_XML add $DATA_DIR/$FILENAME', (error) => {
            if (error) {
                console.error('Failed to add to library:', error);
                fs.writeFileSync('$PROGRESS_FILE', JSON.stringify({
                    filename: '$FILENAME',
                    status: 'error',
                    error: 'Failed to add to library'
                }));
                process.exit(1);
            }

            // Restart Kiwix to load new content
            exec('pm2 restart kiwix', (restartError) => {
                if (restartError) {
                    console.error('Failed to restart Kiwix:', restartError);
                }

                fs.writeFileSync('$PROGRESS_FILE', JSON.stringify({
                    filename: '$FILENAME',
                    status: 'completed',
                    progress: 100,
                    downloaded: $FILE_SIZE,
                    completedTime: new Date().toISOString()
                }));

                process.exit(0);
            });
        });
    "
else
    echo '{"filename":"'$FILENAME'","status":"error","error":"Download failed or file is empty"}' > "$PROGRESS_FILE"
    exit 1
fi
`;

        const scriptPath = `/tmp/download-${filename}.sh`;
        await fs.writeFile(scriptPath, downloadScript);
        await fs.chmod(scriptPath, 0o755);

        // Start download with PM2
        const processName = `kiwix-dl-${filename.substring(0, 20)}`;
        exec(`pm2 start ${scriptPath} --name "${processName}"`, (error) => {
            if (error) {
                console.error('PM2 start error:', error);
            }
        });

        res.json({
            message: 'Download started in background',
            filename,
            progressFile
        });
    } catch (error) {
        console.error('Failed to start download:', error);
        res.status(500).json({ error: 'Failed to start download' });
    }
});

// Get download progress
router.get('/download/status/:filename', optionalAuth, async (req, res) => {
    const filename = req.params.filename;
    const progressFile = `/tmp/kiwix-progress-${filename}.json`;
    const filepath = path.join(KIWIX_DATA_DIR, filename);

    try {
        const progress = JSON.parse(await fs.readFile(progressFile, 'utf8'));

        let fileStats = null;
        try {
            fileStats = await fs.stat(filepath);
            progress.actualSize = fileStats.size;
        } catch {
            progress.actualSize = 0;
        }

        if (progress.status === 'processing' && fileStats && fileStats.size > 0) {
            progress.status = 'completed';
            progress.downloaded = fileStats.size;
            progress.progress = 100;
        }

        if (progress.status === 'completed' || progress.status === 'error') {
            fs.unlink(progressFile).catch(() => {});
        }

        return res.json(progress);
    } catch (progressErr) {
        try {
            const stats = await fs.stat(filepath);
            return res.json({
                filename,
                status: 'completed',
                progress: 100,
                downloaded: stats.size,
                actualSize: stats.size,
                exists: true
            });
        } catch {
            return res.json({
                filename,
                status: 'not_started',
                progress: 0,
                downloaded: 0,
                exists: false
            });
        }
    }
});

// Get all active downloads
router.get('/downloads', optionalAuth, async (req, res) => {
    try {
        // Get all progress files
        exec('ls /tmp/kiwix-progress-*.json 2>/dev/null', async (error, stdout) => {
            if (error || !stdout.trim()) {
                return res.json({ downloads: [] });
            }

            const progressFiles = stdout.trim().split('\n');
            const downloads = [];

            for (const file of progressFiles) {
                try {
                    const data = await fs.readFile(file, 'utf8');
                    const progress = JSON.parse(data);

                    // Check if file actually exists in data directory
                    const zimPath = path.join(KIWIX_DATA_DIR, progress.filename);
                    let shouldDelete = false;

                    try {
                        const stats = await fs.stat(zimPath);
                        // If file exists and has size, and progress shows processing/100%, mark as complete
                        if (stats.size > 1000 && (progress.status === 'processing' || progress.progress === 100)) {
                            shouldDelete = true;
                        }
                    } catch {
                        // File doesn't exist - check if download is stale (older than 24 hours)
                        if (progress.startTime) {
                            const startTime = new Date(progress.startTime);
                            const ageHours = (Date.now() - startTime.getTime()) / (1000 * 60 * 60);
                            if (ageHours > 24) {
                                shouldDelete = true;
                            }
                        }
                    }

                    // Delete completed, errored, or stale progress files
                    if (progress.status === 'completed' || progress.status === 'error' || shouldDelete) {
                        fs.unlink(file).catch(() => {});
                        continue;
                    }

                    downloads.push(progress);
                } catch {
                    // Skip invalid progress files and try to delete them
                    fs.unlink(file).catch(() => {});
                }
            }

            res.json({ downloads });
        });
    } catch (error) {
        console.error('Failed to get downloads:', error);
        res.status(500).json({ error: 'Failed to get downloads' });
    }
});

// Get library (list of downloaded ZIM files)
router.get('/library', optionalAuth, async (req, res) => {
    try {
        const files = await fs.readdir(KIWIX_DATA_DIR);
        const zimFiles = files.filter(f => f.endsWith('.zim') && !f.endsWith('.part'));
        
        const fileDetails = await Promise.all(
            zimFiles.map(async (file) => {
                try {
                    const stats = await fs.stat(path.join(KIWIX_DATA_DIR, file));
                    return {
                        filename: file,
                        size: stats.size,
                        created: stats.birthtime
                    };
                } catch (error) {
                    return null;
                }
            })
        );

        const validFiles = fileDetails.filter(f => f !== null && f.size > 1000); // Filter out empty/tiny files

        res.json({ files: validFiles });
    } catch (error) {
        console.error('Failed to get library:', error);
        res.status(500).json({ error: 'Failed to get library' });
    }
});

// Delete a ZIM file
router.delete('/library/:filename', optionalAuth, async (req, res) => {
    try {
        const filepath = path.join(KIWIX_DATA_DIR, req.params.filename);
        
        // Security check - make sure it's actually in the data directory
        if (!filepath.startsWith(KIWIX_DATA_DIR)) {
            return res.status(403).json({ error: 'Invalid file path' });
        }

        await fs.unlink(filepath);
        
        // Rebuild library
        await rebuildLibrary();
        
        // Restart Kiwix server
        exec('pm2 restart kiwix', () => {});

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Failed to delete file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Start Kiwix server
router.post('/start', optionalAuth, async (req, res) => {
    try {
        console.log('[Kiwix] Start request received');

        // First check if already running
        exec('pm2 jlist', async (pmError, pmStdout) => {
            if (!pmError) {
                try {
                    const processes = JSON.parse(pmStdout);
                    const kiwix = processes.find(p => p.name === 'kiwix');

                    if (kiwix && kiwix.pm2_env.status === 'online') {
                        console.log('[Kiwix] Already running, skipping start');
                        return res.json({
                            message: 'Kiwix server is already running',
                            alreadyRunning: true
                        });
                    }
                } catch {}
            }

            // Rebuild library first
            console.log('[Kiwix] Rebuilding library...');
            await rebuildLibrary();

            // Delete any existing process (handles crashed/stopped states)
            console.log('[Kiwix] Cleaning up existing processes...');
            exec('pm2 delete kiwix 2>/dev/null; pkill -9 kiwix-serve 2>/dev/null', () => {
                setTimeout(() => {
                    // Start fresh Kiwix server
                    console.log('[Kiwix] Starting Kiwix server...');
                    const cmd = `pm2 start kiwix-serve --name kiwix -- --port 8080 --library ${LIBRARY_XML}`;
                    exec(cmd, (error) => {
                        if (error) {
                            console.error('[Kiwix] Start failed:', error);
                            return res.status(500).json({ error: 'Failed to start server' });
                        }

                        // Save PM2 configuration for auto-start on boot
                        exec('pm2 save', (saveError) => {
                            if (saveError) {
                                console.error('[Kiwix] PM2 save failed:', saveError);
                            }
                        });

                        console.log('[Kiwix] Started successfully');
                        res.json({ message: 'Kiwix server started successfully' });
                    });
                }, 1500);
            });
        });
    } catch (error) {
        console.error('[Kiwix] Start error:', error);
        res.status(500).json({ error: 'Failed to start server' });
    }
});

// Stop Kiwix server
router.post('/stop', optionalAuth, async (req, res) => {
    try {
        exec('pm2 stop kiwix', (error) => {
            if (error) {
                console.error('Failed to stop Kiwix:', error);
                return res.status(500).json({ error: 'Failed to stop server' });
            }
            res.json({ message: 'Kiwix server stopped' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to stop server' });
    }
});

// Kill Kiwix server (force stop and delete from PM2)
router.post('/kill', optionalAuth, async (req, res) => {
    try {
        console.log('[Kiwix] Force killing Kiwix server...');

        // First try to stop gracefully
        exec('pm2 stop kiwix 2>/dev/null', () => {
            // Then delete from PM2
            setTimeout(() => {
                exec('pm2 delete kiwix 2>/dev/null', (deleteError) => {
                    // Kill any remaining kiwix-serve processes
                    exec('pkill -9 kiwix-serve 2>/dev/null', () => {
                        console.log('[Kiwix] Force killed successfully');
                        res.json({ message: 'Kiwix server force killed successfully' });
                    });
                });
            }, 500);
        });
    } catch (error) {
        console.error('[Kiwix] Kill error:', error);
        res.status(500).json({ error: 'Failed to kill server' });
    }
});

// Restart Kiwix server
router.post('/restart', optionalAuth, async (req, res) => {
    try {
        // Rebuild library first
        await rebuildLibrary();

        // Delete existing process
        exec('pm2 delete kiwix 2>/dev/null', () => {
            setTimeout(() => {
                // Start fresh
                const cmd = `pm2 start kiwix-serve --name kiwix -- --port 8080 --library ${LIBRARY_XML}`;
                exec(cmd, (error) => {
                    if (error) {
                        console.error('Failed to restart Kiwix:', error);
                        return res.status(500).json({ error: 'Failed to restart server' });
                    }
                    res.json({ message: 'Kiwix server restarted successfully' });
                });
            }, 1000);
        });
    } catch (error) {
        console.error('Failed to restart Kiwix:', error);
        res.status(500).json({ error: 'Failed to restart server' });
    }
});

// Helper function to rebuild library.xml
async function rebuildLibrary() {
    try {
        const files = await fs.readdir(KIWIX_DATA_DIR);
        const zimFiles = files.filter(f => f.endsWith('.zim') && !f.endsWith('.part'));
        
        // Only include files larger than 1KB
        const validFiles = [];
        for (const file of zimFiles) {
            const stats = await fs.stat(path.join(KIWIX_DATA_DIR, file));
            if (stats.size > 1000) {
                validFiles.push(file);
            }
        }

        if (validFiles.length === 0) {
            // Create empty library
            await fs.writeFile(LIBRARY_XML, '<?xml version="1.0" encoding="UTF-8"?>\n<library version="1.0"/>\n');
            return;
        }

        // Use kiwix-manage to build library
        const zimPaths = validFiles.map(f => path.join(KIWIX_DATA_DIR, f)).join(' ');
        const cmd = `kiwix-manage ${LIBRARY_XML} add ${zimPaths}`;

        return new Promise((resolve, reject) => {
            exec(cmd, (error) => {
                if (error) {
                    console.error('Failed to rebuild library:', error);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    } catch (error) {
        console.error('Failed to rebuild library:', error);
        throw error;
    }
}

module.exports = router;

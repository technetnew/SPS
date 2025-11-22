const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Tile cache directory
const TILE_CACHE_DIR = path.join(__dirname, '../../maps/tiles');

// Ensure cache directory exists
async function ensureCacheDir() {
    try {
        await fs.mkdir(TILE_CACHE_DIR, { recursive: true });
    } catch (error) {
        console.error('[Tiles] Error creating cache directory:', error);
    }
}

ensureCacheDir();

/**
 * Tile proxy with caching
 * GET /tiles/:z/:x/:y.png
 *
 * This endpoint:
 * 1. Checks if tile exists in local cache
 * 2. If yes, serves from cache
 * 3. If no, fetches from OSM, saves to cache, and serves
 * 4. Works offline once tiles are cached
 */
router.get('/:z/:x/:y.png', async (req, res) => {
    const { z, x, y } = req.params;

    // Validate parameters
    const zoom = parseInt(z);
    const tileX = parseInt(x);
    const tileY = parseInt(y);

    if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
        return res.status(400).send('Invalid tile coordinates');
    }

    // Check zoom limits
    if (zoom < 0 || zoom > 19) {
        return res.status(400).send('Invalid zoom level');
    }

    // Construct cache path
    const tilePath = path.join(TILE_CACHE_DIR, `${zoom}`, `${tileX}`);
    const tileFile = path.join(tilePath, `${tileY}.png`);

    try {
        // Check if tile exists in cache
        try {
            const cachedTile = await fs.readFile(tileFile);
            res.set('Content-Type', 'image/png');
            res.set('X-Tile-Source', 'cache');
            return res.send(cachedTile);
        } catch (err) {
            // Tile not in cache, fetch from OSM
        }

        // Fetch from OpenStreetMap
        const osmServers = ['a', 'b', 'c'];
        const server = osmServers[Math.floor(Math.random() * osmServers.length)];
        const tileUrl = `https://${server}.tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

        const response = await axios.get(tileUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'SPS-Offline-Maps/1.0'
            }
        });

        // Save to cache
        await fs.mkdir(tilePath, { recursive: true });
        await fs.writeFile(tileFile, response.data);

        // Send tile
        res.set('Content-Type', 'image/png');
        res.set('X-Tile-Source', 'downloaded');
        res.send(response.data);

    } catch (error) {
        // If offline and tile not cached, return placeholder
        console.error(`[Tiles] Error fetching tile ${zoom}/${tileX}/${tileY}:`, error.message);

        // Return a simple gray placeholder tile
        res.set('Content-Type', 'image/png');
        res.set('X-Tile-Source', 'placeholder');

        // Simple 256x256 gray PNG placeholder
        const placeholderTile = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABV0RVh0Q3JlYXRpb24gVGltZQAyMDI1LTExLTIwmCu4gAAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNui8sowAAAAVSURBVHic7cEBAQAAAIKg/q9uiEAAAADgZwAH8AABsuX8AAAAASUVORK5CYII=',
            'base64'
        );
        res.send(placeholderTile);
    }
});

/**
 * Get cache statistics
 */
router.get('/stats', async (req, res) => {
    try {
        let totalTiles = 0;
        let totalSize = 0;

        async function scanDir(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);

                    if (entry.isDirectory()) {
                        await scanDir(fullPath);
                    } else if (entry.name.endsWith('.png')) {
                        totalTiles++;
                        const stats = await fs.stat(fullPath);
                        totalSize += stats.size;
                    }
                }
            } catch (error) {
                // Ignore errors in subdirectories
            }
        }

        await scanDir(TILE_CACHE_DIR);

        res.json({
            cached_tiles: totalTiles,
            cache_size_mb: (totalSize / 1024 / 1024).toFixed(2),
            cache_location: TILE_CACHE_DIR
        });

    } catch (error) {
        console.error('[Tiles] Error getting cache stats:', error);
        res.status(500).json({ error: 'Failed to get cache stats' });
    }
});

module.exports = router;

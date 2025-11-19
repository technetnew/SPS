const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const execAsync = promisify(exec);
const router = express.Router();

const KIWIX_DATA_DIR = '/var/www/sps/kiwix/data';
const KIWIX_LIBRARY = '/var/www/sps/kiwix/library/library.xml';
const KIWIX_PORT = 8080;

// All routes require authentication
router.use(authenticateToken);

// Get list of installed ZIM files
router.get('/library', async (req, res) => {
    try {
        const files = await fs.readdir(KIWIX_DATA_DIR);
        const zimFiles = files.filter(f => f.endsWith('.zim'));

        const fileDetails = await Promise.all(zimFiles.map(async (filename) => {
            const filepath = path.join(KIWIX_DATA_DIR, filename);
            const stats = await fs.stat(filepath);

            return {
                filename,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            };
        }));

        res.json({ files: fileDetails });
    } catch (error) {
        console.error('Failed to list ZIM files:', error);
        res.status(500).json({ error: 'Failed to list ZIM files' });
    }
});

// Get available ZIM files from Kiwix catalog
router.get('/catalog', async (req, res) => {
    try {
        // Popular ZIM files for offline use
        const catalog = [
            {
                name: 'Wikipedia (English - No Pictures)',
                description: 'English Wikipedia without images - smaller size',
                size: '~50GB',
                url: 'https://download.kiwix.org/zim/wikipedia_en_simple_all_nopic.zim',
                category: 'encyclopedia'
            },
            {
                name: 'Wikipedia (English - Mini)',
                description: 'Top 100,000 articles - great for testing',
                size: '~10GB',
                url: 'https://download.kiwix.org/zim/wikipedia_en_top_mini.zim',
                category: 'encyclopedia'
            },
            {
                name: 'Wiktionary (English)',
                description: 'English dictionary and thesaurus',
                size: '~5GB',
                url: 'https://download.kiwix.org/zim/wiktionary_en_all.zim',
                category: 'reference'
            },
            {
                name: 'WikiHow',
                description: 'How-to guides for everything',
                size: '~8GB',
                url: 'https://download.kiwix.org/zim/wikihow_en_all.zim',
                category: 'howto'
            },
            {
                name: 'Stack Exchange',
                description: 'Programming Q&A archive',
                size: '~60GB',
                url: 'https://download.kiwix.org/zim/stackoverflow.com_en_all.zim',
                category: 'technical'
            },
            {
                name: 'Khan Academy',
                description: 'Educational videos and lessons',
                size: '~30GB',
                url: 'https://download.kiwix.org/zim/khanacademy_en_all.zim',
                category: 'education'
            },
            {
                name: 'Medical Wikipedia',
                description: 'Medicine and health information',
                size: '~3GB',
                url: 'https://download.kiwix.org/zim/wikipedia_en_medicine.zim',
                category: 'medical'
            },
            {
                name: 'Survival Wiki',
                description: 'Wilderness and survival knowledge',
                size: '~500MB',
                url: 'https://download.kiwix.org/zim/survival_en_all.zim',
                category: 'survival'
            }
        ];

        res.json({ catalog });
    } catch (error) {
        console.error('Failed to get catalog:', error);
        res.status(500).json({ error: 'Failed to get catalog' });
    }
});

// Download a ZIM file
router.post('/download', [
    body('url').isURL(),
    body('filename').trim().notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { url, filename } = req.body;
    const filepath = path.join(KIWIX_DATA_DIR, filename);

    try {
        // Start download in background
        const downloadProcess = exec(`wget -c -O "${filepath}" "${url}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('Download error:', error);
            }
        });

        res.json({
            message: 'Download started',
            filename,
            pid: downloadProcess.pid
        });
    } catch (error) {
        console.error('Failed to start download:', error);
        res.status(500).json({ error: 'Failed to start download' });
    }
});

// Get download progress
router.get('/download/status/:filename', async (req, res) => {
    try {
        const filepath = path.join(KIWIX_DATA_DIR, req.params.filename);

        try {
            const stats = await fs.stat(filepath);
            res.json({
                downloaded: stats.size,
                exists: true
            });
        } catch {
            res.json({
                downloaded: 0,
                exists: false
            });
        }
    } catch (error) {
        console.error('Failed to get download status:', error);
        res.status(500).json({ error: 'Failed to get download status' });
    }
});

// Delete a ZIM file
router.delete('/library/:filename', async (req, res) => {
    try {
        const filepath = path.join(KIWIX_DATA_DIR, req.params.filename);

        // Security check - ensure filename doesn't contain path traversal
        if (req.params.filename.includes('..') || req.params.filename.includes('/')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        await fs.unlink(filepath);
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Failed to delete file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Check Kiwix server status
router.get('/status', async (req, res) => {
    try {
        // Try to connect to Kiwix server
        const response = await axios.get(`http://localhost:${KIWIX_PORT}`, { timeout: 2000 });
        res.json({
            running: true,
            port: KIWIX_PORT,
            url: `http://localhost:${KIWIX_PORT}`
        });
    } catch (error) {
        res.json({
            running: false,
            port: KIWIX_PORT
        });
    }
});

// Start Kiwix server
router.post('/start', async (req, res) => {
    try {
        const { stdout, stderr } = await execAsync(`pm2 start kiwix-serve --name kiwix -- --port ${KIWIX_PORT} --library "${KIWIX_LIBRARY}"`);
        res.json({
            message: 'Kiwix server started',
            port: KIWIX_PORT
        });
    } catch (error) {
        // Check if already running
        if (error.message.includes('already')) {
            return res.json({ message: 'Kiwix server already running' });
        }
        console.error('Failed to start Kiwix:', error);
        res.status(500).json({ error: 'Failed to start server' });
    }
});

// Stop Kiwix server
router.post('/stop', async (req, res) => {
    try {
        const { stdout, stderr } = await execAsync('pm2 stop kiwix');
        res.json({ message: 'Kiwix server stopped' });
    } catch (error) {
        console.error('Failed to stop Kiwix:', error);
        res.status(500).json({ error: 'Failed to stop server' });
    }
});

module.exports = router;

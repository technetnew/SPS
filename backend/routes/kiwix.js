const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken } = require('../middleware/auth');

// Kiwix directories
const KIWIX_DIR = '/var/www/sps/kiwix';
const KIWIX_DATA_DIR = path.join(KIWIX_DIR, 'data');
const KIWIX_LIBRARY_DIR = path.join(KIWIX_DIR, 'library');
const LIBRARY_XML = path.join(KIWIX_LIBRARY_DIR, 'library.xml');

// Get Kiwix server status
router.get('/status', authenticateToken, async (req, res) => {
    try {
        exec('pm2 jlist', (error, stdout) => {
            if (error) {
                return res.json({ running: false });
            }

            try {
                const processes = JSON.parse(stdout);
                const kiwix = processes.find(p => p.name === 'kiwix');
                
                if (kiwix && kiwix.pm2_env.status === 'online') {
                    return res.json({
                        running: true,
                        port: 8080,
                        pid: kiwix.pid
                    });
                }
                
                res.json({ running: false });
            } catch {
                res.json({ running: false });
            }
        });
    } catch (error) {
        res.json({ running: false });
    }
});

// Get catalog of available ZIM files
router.get('/catalog', authenticateToken, async (req, res) => {
    try {
        const catalog = [
            {
                name: 'Wikipedia (Simple English)',
                description: 'Simplified English Wikipedia - great for testing',
                size: '~300MB',
                url: 'https://download.kiwix.org/zim/wikipedia_en_simple_all_mini_2024-01.zim',
                category: 'encyclopedia'
            },
            {
                name: 'WikiHow',
                description: 'How-to guides for everything',
                size: '~8GB',
                url: 'https://download.kiwix.org/zim/wikihow_en_all_maxi_2024-01.zim',
                category: 'how-to'
            },
            {
                name: 'Wikipedia (English - No Pictures)',
                description: 'Full English Wikipedia without images',
                size: '~50GB',
                url: 'https://download.kiwix.org/zim/wikipedia_en_all_nopic_2024-01.zim',
                category: 'encyclopedia'
            },
            {
                name: 'Stack Overflow',
                description: 'Programming Q&A archive',
                size: '~60GB',
                url: 'https://download.kiwix.org/zim/stackoverflow.com_en_all_2024-01.zim',
                category: 'technical'
            }
        ];

        res.json({ catalog });
    } catch (error) {
        console.error('Failed to get catalog:', error);
        res.status(500).json({ error: 'Failed to get catalog' });
    }
});

// Download a ZIM file
router.post('/download', authenticateToken, [
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
        // Use wget with proper options and run in background with PM2
        const downloadScript = `
#!/bin/bash
cd ${KIWIX_DATA_DIR}
wget -c -q --show-progress "${url}" -O "${filename}" 2>&1 | tee /tmp/kiwix-download-${filename}.log
`;

        await fs.writeFile(`/tmp/download-${filename}.sh`, downloadScript);
        await fs.chmod(`/tmp/download-${filename}.sh`, 0o755);

        // Start download with PM2 so it runs in background
        exec(`pm2 start /tmp/download-${filename}.sh --name "kiwix-dl-${filename.substring(0, 20)}"`, (error) => {
            if (error) {
                console.error('PM2 start error:', error);
            }
        });

        res.json({
            message: 'Download started in background',
            filename
        });
    } catch (error) {
        console.error('Failed to start download:', error);
        res.status(500).json({ error: 'Failed to start download' });
    }
});

// Get download progress
router.get('/download/status/:filename', authenticateToken, async (req, res) => {
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
        res.status(500).json({ error: 'Failed to check status' });
    }
});

// Get library (list of downloaded ZIM files)
router.get('/library', authenticateToken, async (req, res) => {
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
router.delete('/library/:filename', authenticateToken, async (req, res) => {
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
router.post('/start', authenticateToken, async (req, res) => {
    try {
        // Rebuild library first
        await rebuildLibrary();

        // Check if already running
        exec('pm2 jlist', (error, stdout) => {
            try {
                const processes = JSON.parse(stdout);
                const kiwix = processes.find(p => p.name === 'kiwix');
                
                if (kiwix && kiwix.pm2_env.status === 'online') {
                    return res.json({ message: 'Kiwix server already running' });
                }

                // Start Kiwix server
                const cmd = `pm2 start kiwix-serve --name kiwix -- --port 8080 --library ${LIBRARY_XML}`;
                exec(cmd, (error) => {
                    if (error) {
                        console.error('Failed to start Kiwix:', error);
                        return res.status(500).json({ error: 'Failed to start server' });
                    }
                    res.json({ message: 'Kiwix server started' });
                });
            } catch (parseError) {
                res.status(500).json({ error: 'Failed to check server status' });
            }
        });
    } catch (error) {
        console.error('Failed to start Kiwix:', error);
        res.status(500).json({ error: 'Failed to start server' });
    }
});

// Stop Kiwix server
router.post('/stop', authenticateToken, async (req, res) => {
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

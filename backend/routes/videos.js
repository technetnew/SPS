const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = '/var/www/sps/videos';
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp4|avi|mov|wmv|flv|webm|mkv/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'));
        }
    }
});

// All routes require authentication
router.use(authenticateToken);

// Get all downloads for user (MUST BE BEFORE /:id route)
router.get('/downloads', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM video_downloads WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [req.user.userId]
        );

        res.json({ downloads: result.rows });
    } catch (error) {
        console.error('Downloads fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch downloads' });
    }
});

// Get download status (MUST BE BEFORE /:id route)
router.get('/downloads/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM video_downloads WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Download not found' });
        }

        res.json({ download: result.rows[0] });
    } catch (error) {
        console.error('Download status fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch download status' });
    }
});

// Get all videos for user
router.get('/', [
    query('category').optional().trim(),
    query('search').optional().trim(),
    query('playlist_id').optional().isInt()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { category, search, playlist_id } = req.query;

    try {
        let query = `
            SELECT v.*,
                   array_length(v.tags, 1) as tag_count
            FROM videos v
            WHERE v.user_id = $1 AND v.status = 'active'
        `;
        const params = [req.user.userId];
        let paramCount = 1;

        if (category) {
            paramCount++;
            query += ` AND v.category = $${paramCount}`;
            params.push(category);
        }

        if (search) {
            paramCount++;
            query += ` AND (v.title ILIKE $${paramCount} OR v.description ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (playlist_id) {
            query = `
                SELECT v.*, vpi.position,
                       array_length(v.tags, 1) as tag_count
                FROM videos v
                JOIN video_playlist_items vpi ON v.id = vpi.video_id
                WHERE v.user_id = $1 AND v.status = 'active'
                  AND vpi.playlist_id = $2
                ORDER BY vpi.position
            `;
            params.push(playlist_id);
        } else {
            query += ` ORDER BY v.created_at DESC`;
        }

        const result = await db.query(query, params);

        res.json({
            count: result.rows.length,
            videos: result.rows
        });
    } catch (error) {
        console.error('Videos fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

// Get single video
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM videos WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Increment view count
        await db.query(
            'UPDATE videos SET view_count = view_count + 1, last_viewed = NOW() WHERE id = $1',
            [req.params.id]
        );

        res.json({ video: result.rows[0] });
    } catch (error) {
        console.error('Video fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch video' });
    }
});

// Upload video file
router.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
    }

    const { title, description, category, tags } = req.body;

    try {
        // Get video metadata using ffprobe
        let duration = null;
        let resolution = null;

        try {
            const { stdout } = await execAsync(
                `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${req.file.path}"`
            );
            duration = Math.round(parseFloat(stdout));

            const { stdout: resOut } = await execAsync(
                `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${req.file.path}"`
            );
            resolution = resOut.trim();
        } catch (error) {
            console.error('FFprobe error:', error);
        }

        // Insert video record
        const result = await db.query(
            `INSERT INTO videos
             (user_id, title, description, filename, file_path, file_size, duration,
              format, resolution, category, tags, source_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'upload')
             RETURNING *`,
            [
                req.user.userId,
                title || req.file.originalname,
                description,
                req.file.filename,
                req.file.path,
                req.file.size,
                duration,
                path.extname(req.file.originalname).substring(1),
                resolution,
                category,
                tags ? tags.split(',').map(t => t.trim()) : []
            ]
        );

        res.status(201).json({
            message: 'Video uploaded successfully',
            video: result.rows[0]
        });
    } catch (error) {
        console.error('Video upload error:', error);
        // Clean up file on error
        try {
            await fs.unlink(req.file.path);
        } catch (e) {}
        res.status(500).json({ error: 'Failed to upload video' });
    }
});

// Download video from URL using yt-dlp
router.post('/download', [
    body('url').isURL(),
    body('quality').optional().isIn(['best', '1080p', '720p', '480p', '360p']),
    body('format').optional().isIn(['mp4', 'webm', 'mkv'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { url, quality = 'best', format = 'mp4' } = req.body;

    try {
        // Create download record
        const downloadResult = await db.query(
            `INSERT INTO video_downloads (user_id, url, quality, format, status)
             VALUES ($1, $2, $3, $4, 'pending')
             RETURNING *`,
            [req.user.userId, url, quality, format]
        );

        const downloadId = downloadResult.rows[0].id;

        // Start download in background
        downloadVideo(downloadId, url, quality, format, req.user.userId);

        res.status(202).json({
            message: 'Download started',
            download_id: downloadId,
            status: 'pending'
        });
    } catch (error) {
        console.error('Download initiation error:', error);
        res.status(500).json({ error: 'Failed to start download' });
    }
});

// Update video metadata
router.put('/:id', [
    body('title').optional().trim().isLength({ max: 500 }),
    body('description').optional().trim(),
    body('category').optional().trim(),
    body('tags').optional().isArray()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, category, tags } = req.body;

    try {
        const result = await db.query(
            `UPDATE videos
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 category = COALESCE($3, category),
                 tags = COALESCE($4, tags),
                 updated_at = NOW()
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [title, description, category, tags, req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        res.json({
            message: 'Video updated successfully',
            video: result.rows[0]
        });
    } catch (error) {
        console.error('Video update error:', error);
        res.status(500).json({ error: 'Failed to update video' });
    }
});

// Delete video
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM videos WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = result.rows[0];

        // Delete file
        try {
            await fs.unlink(video.file_path);
            if (video.thumbnail_path) {
                await fs.unlink(video.thumbnail_path);
            }
        } catch (error) {
            console.error('File deletion error:', error);
        }

        // Delete database record
        await db.query(
            'DELETE FROM videos WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        res.json({ message: 'Video deleted successfully' });
    } catch (error) {
        console.error('Video deletion error:', error);
        res.status(500).json({ error: 'Failed to delete video' });
    }
});

// Background download function
async function downloadVideo(downloadId, url, quality, format, userId) {
    try {
        await db.query(
            'UPDATE video_downloads SET status = $1, started_at = NOW() WHERE id = $2',
            ['downloading', downloadId]
        );

        const outputDir = '/var/www/sps/videos';
        const outputTemplate = path.join(outputDir, `video-${downloadId}-%(title)s.%(ext)s`);

        // Build yt-dlp command
        let qualityFormat = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';

        if (quality !== 'best') {
            const height = quality.replace('p', '');
            qualityFormat = `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}][ext=mp4]/best`;
        }

        const command = `yt-dlp -f "${qualityFormat}" --merge-output-format ${format} -o "${outputTemplate}" "${url}"`;

        const { stdout, stderr } = await execAsync(command);

        // Find the downloaded file
        const files = await fs.readdir(outputDir);
        const downloadedFile = files.find(f => f.startsWith(`video-${downloadId}-`));

        if (!downloadedFile) {
            throw new Error('Downloaded file not found');
        }

        const filePath = path.join(outputDir, downloadedFile);
        const stats = await fs.stat(filePath);

        // Get video metadata
        let duration = null;
        let resolution = null;
        let title = downloadedFile.replace(`video-${downloadId}-`, '').replace(path.extname(downloadedFile), '');

        try {
            const { stdout } = await execAsync(
                `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
            );
            duration = Math.round(parseFloat(stdout));

            const { stdout: resOut } = await execAsync(
                `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`
            );
            resolution = resOut.trim();
        } catch (error) {
            console.error('FFprobe error:', error);
        }

        // Insert video record
        const videoResult = await db.query(
            `INSERT INTO videos
             (user_id, title, filename, file_path, file_size, duration, format, resolution,
              source_url, source_type, download_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
             RETURNING *`,
            [userId, title, downloadedFile, filePath, stats.size, duration, format, resolution, url, 'youtube']
        );

        // Update download record
        await db.query(
            `UPDATE video_downloads
             SET status = $1, progress = 100, completed_at = NOW(), video_id = $2
             WHERE id = $3`,
            ['completed', videoResult.rows[0].id, downloadId]
        );

    } catch (error) {
        console.error('Download error:', error);
        await db.query(
            'UPDATE video_downloads SET status = $1, error_message = $2 WHERE id = $3',
            ['failed', error.message, downloadId]
        );
    }
}

// Get playlists
router.get('/playlists/all', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT p.*, COUNT(vpi.video_id) as video_count
             FROM video_playlists p
             LEFT JOIN video_playlist_items vpi ON p.id = vpi.playlist_id
             WHERE p.user_id = $1
             GROUP BY p.id
             ORDER BY p.created_at DESC`,
            [req.user.userId]
        );

        res.json({ playlists: result.rows });
    } catch (error) {
        console.error('Playlists fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch playlists' });
    }
});

// Create playlist
router.post('/playlists', [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    try {
        const result = await db.query(
            'INSERT INTO video_playlists (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
            [req.user.userId, name, description]
        );

        res.status(201).json({
            message: 'Playlist created successfully',
            playlist: result.rows[0]
        });
    } catch (error) {
        console.error('Playlist creation error:', error);
        res.status(500).json({ error: 'Failed to create playlist' });
    }
});

// Add video to playlist
router.post('/playlists/:playlist_id/videos/:video_id', async (req, res) => {
    try {
        // Get next position
        const posResult = await db.query(
            'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM video_playlist_items WHERE playlist_id = $1',
            [req.params.playlist_id]
        );

        await db.query(
            'INSERT INTO video_playlist_items (playlist_id, video_id, position) VALUES ($1, $2, $3)',
            [req.params.playlist_id, req.params.video_id, posResult.rows[0].next_pos]
        );

        res.json({ message: 'Video added to playlist' });
    } catch (error) {
        console.error('Add to playlist error:', error);
        res.status(500).json({ error: 'Failed to add video to playlist' });
    }
});

module.exports = router;

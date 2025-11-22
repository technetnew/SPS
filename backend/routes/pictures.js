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
const PROJECT_ROOT = path.resolve('/var/www/sps');
const STORAGE_ROOT = path.join(PROJECT_ROOT, 'uploads');
const UPLOAD_DIR = path.join(STORAGE_ROOT, 'pictures');
const PUBLIC_PICTURES_PATH = '/uploads/pictures';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.heic']);
const thumbnailInitPromise = ensureThumbnailColumns();

// Configure multer for picture uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = UPLOAD_DIR;
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'picture-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const mimetypeAllowed = file.mimetype?.startsWith('image/');

        if (IMAGE_EXTENSIONS.has(ext) && mimetypeAllowed) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

async function ensureThumbnailColumns() {
    const statements = [
        'ALTER TABLE pictures ADD COLUMN IF NOT EXISTS thumbnail_small VARCHAR(255)',
        'ALTER TABLE pictures ADD COLUMN IF NOT EXISTS thumbnail_medium VARCHAR(255)',
        'ALTER TABLE pictures ADD COLUMN IF NOT EXISTS thumbnail_large VARCHAR(255)'
    ];

    for (const sql of statements) {
        try {
            await db.query(sql);
        } catch (error) {
            console.error('Thumbnail column migration error:', error.message);
        }
    }
}

async function generateThumbnails() {
    return {};
}

async function ensureThumbnailsForRow(row) {
    row.thumbnail_small = row.thumbnail_small || null;
    row.thumbnail_medium = row.thumbnail_medium || null;
    row.thumbnail_large = row.thumbnail_large || null;
    return row;
}

function buildThumbnailUrls(filename, small, medium, large) {
    const fallback = filename ? `${PUBLIC_PICTURES_PATH}/${filename}` : null;
    return {
        small: small ? `${PUBLIC_PICTURES_PATH}/${small}` : fallback,
        medium: medium ? `${PUBLIC_PICTURES_PATH}/${medium}` : fallback,
        large: large ? `${PUBLIC_PICTURES_PATH}/${large}` : fallback
    };
}

function serializePicture(row) {
    return {
        ...row,
        thumbnails: buildThumbnailUrls(row.filename, row.thumbnail_small, row.thumbnail_medium, row.thumbnail_large),
        image_url: `${PUBLIC_PICTURES_PATH}/${row.filename}`
    };
}

function guessMimeType(ext) {
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.bmp':
            return 'image/bmp';
        case '.webp':
            return 'image/webp';
        case '.tiff':
            return 'image/tiff';
        case '.heic':
            return 'image/heic';
        default:
            return 'application/octet-stream';
    }
}

function isGeneratedThumbnail(filename) {
    return ['-small', '-medium', '-large'].some(tag => filename.includes(tag));
}

// All routes require authentication
router.use(authenticateToken);

// Get all pictures for user
router.get('/', [
    query('tag').optional().trim(),
    query('search').optional().trim(),
    query('album_id').optional().isInt(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { tag, search, album_id } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const offset = (page - 1) * limit;

    try {
        const baseSelect = `
            SELECT p.*,
                   COALESCE(
                       (SELECT array_agg(pt.name)
                        FROM picture_tag_relations ptr
                        JOIN picture_tags pt ON ptr.tag_id = pt.id
                        WHERE ptr.picture_id = p.id),
                       ARRAY[]::text[]
                   ) as tags,
                   COALESCE(
                       (SELECT array_agg(pa.name)
                        FROM picture_album_relations par
                        JOIN picture_albums pa ON par.album_id = pa.id
                        WHERE par.picture_id = p.id),
                       ARRAY[]::text[]
                   ) as albums,
                   COALESCE(
                       (SELECT array_agg(pa.id)
                        FROM picture_album_relations par
                        JOIN picture_albums pa ON par.album_id = pa.id
                        WHERE par.picture_id = p.id),
                       ARRAY[]::int[]
                   ) as album_ids
            FROM pictures p
            WHERE p.user_id = $1
        `;

        let query = baseSelect;
        const params = [req.user.userId];
        let paramCount = 1;

        if (tag) {
            paramCount += 1;
            params.push(tag);
            const tagParam = `$${paramCount}`;
            query += ` AND EXISTS (
                SELECT 1 FROM picture_tag_relations ptr
                JOIN picture_tags pt ON ptr.tag_id = pt.id
                WHERE ptr.picture_id = p.id AND pt.name = ${tagParam}
            )`;
        }

        if (album_id) {
            paramCount += 1;
            params.push(album_id);
            const albumParam = `$${paramCount}`;
            query += ` AND EXISTS (
                SELECT 1 FROM picture_album_relations par
                WHERE par.picture_id = p.id AND par.album_id = ${albumParam}
            )`;
        }

        if (search) {
            paramCount += 1;
            params.push(`%${search}%`);
            const searchParam = `$${paramCount}`;
            query += ` AND (
                p.title ILIKE ${searchParam} OR
                p.description ILIKE ${searchParam} OR
                p.location_name ILIKE ${searchParam} OR
                p.original_filename ILIKE ${searchParam} OR
                p.filename ILIKE ${searchParam} OR
                EXISTS (
                    SELECT 1 FROM picture_tag_relations ptr_search
                    JOIN picture_tags pt_search ON ptr_search.tag_id = pt_search.id
                    WHERE ptr_search.picture_id = p.id AND pt_search.name ILIKE ${searchParam}
                ) OR
                EXISTS (
                    SELECT 1 FROM picture_album_relations par_search
                    JOIN picture_albums pa_search ON par_search.album_id = pa_search.id
                    WHERE par_search.picture_id = p.id AND pa_search.name ILIKE ${searchParam}
                )
            )`;
        }

        query += ' ORDER BY p.created_at DESC LIMIT $' + (paramCount + 1) + ' OFFSET $' + (paramCount + 2);
        params.push(limit, offset);

        let countQuery = 'SELECT COUNT(*) FROM pictures p WHERE p.user_id = $1';
        const countParams = [req.user.userId];
        let countParamIdx = 1;

        if (tag) {
            countParamIdx += 1;
            countParams.push(tag);
            countQuery += ` AND EXISTS (
                SELECT 1 FROM picture_tag_relations ptr
                JOIN picture_tags pt ON ptr.tag_id = pt.id
                WHERE ptr.picture_id = p.id AND pt.name = $${countParamIdx}
            )`;
        }

        if (album_id) {
            countParamIdx += 1;
            countParams.push(album_id);
            countQuery += ` AND EXISTS (
                SELECT 1 FROM picture_album_relations par
                WHERE par.picture_id = p.id AND par.album_id = $${countParamIdx}
            )`;
        }

        if (search) {
            countParamIdx += 1;
            countParams.push(`%${search}%`);
            const searchParam = `$${countParamIdx}`;
            countQuery += ` AND (
                p.title ILIKE ${searchParam} OR
                p.description ILIKE ${searchParam} OR
                p.location_name ILIKE ${searchParam} OR
                p.original_filename ILIKE ${searchParam} OR
                p.filename ILIKE ${searchParam} OR
                EXISTS (
                    SELECT 1 FROM picture_tag_relations ptr_search
                    JOIN picture_tags pt_search ON ptr_search.tag_id = pt_search.id
                    WHERE ptr_search.picture_id = p.id AND pt_search.name ILIKE ${searchParam}
                ) OR
                EXISTS (
                    SELECT 1 FROM picture_album_relations par_search
                    JOIN picture_albums pa_search ON par_search.album_id = pa_search.id
                    WHERE par_search.picture_id = p.id AND pa_search.name ILIKE ${searchParam}
                )
            )`;
        }

        const totalResult = await db.query(countQuery, countParams);

        const result = await db.query(query, params);
        const pictures = [];

        for (const row of result.rows) {
            await ensureThumbnailsForRow(row);
            pictures.push(serializePicture(row));
        }

        res.json({
            count: parseInt(totalResult.rows[0]?.count || pictures.length, 10),
            pictures,
            page,
            limit
        });
    } catch (error) {
        console.error('Pictures fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch pictures' });
    }
});

// Get single picture
// Upload picture
router.post('/upload', upload.single('picture'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No picture file provided' });
    }

    const { title, description, location_name, latitude, longitude, tags, taken_at } = req.body;

    try {
        await thumbnailInitPromise;
        const generatedThumbs = {};

        // Get image dimensions using imagemagick/graphicsmagick if available
        let width = null;
        let height = null;

        try {
            const { stdout } = await execAsync(
                `identify -format "%w %h" "${req.file.path}"`
            );
            const [w, h] = stdout.trim().split(' ');
            width = parseInt(w);
            height = parseInt(h);
        } catch (error) {
            console.log('Image dimensions detection skipped (identify not available)');
        }

        // Insert picture record
        const result = await db.query(
            `INSERT INTO pictures
             (user_id, filename, original_filename, file_path, file_size, mime_type,
              width, height, title, description, location_name, latitude, longitude, taken_at,
              thumbnail_small, thumbnail_medium, thumbnail_large)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             RETURNING *`,
            [
                req.user.userId,
                req.file.filename,
                req.file.originalname,
                req.file.path,
                req.file.size,
                req.file.mimetype,
                width,
                height,
                title || req.file.originalname,
                description,
                location_name,
                latitude || null,
                longitude || null,
                taken_at || null,
                generatedThumbs.small || null,
                generatedThumbs.medium || null,
                generatedThumbs.large || null
            ]
        );

        const pictureId = result.rows[0].id;

        // Add tags if provided
        if (tags) {
            const tagArray = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());

            for (const tagName of tagArray) {
                if (!tagName) continue;

                // Insert or get existing tag
                const tagResult = await db.query(
                    `INSERT INTO picture_tags (name) VALUES ($1)
                     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                     RETURNING id`,
                    [tagName]
                );

                // Link tag to picture
                await db.query(
                    `INSERT INTO picture_tag_relations (picture_id, tag_id)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [pictureId, tagResult.rows[0].id]
                );
            }
        }

        const savedRow = await ensureThumbnailsForRow(result.rows[0]);
        res.status(201).json({
            message: 'Picture uploaded successfully',
            picture: serializePicture(savedRow)
        });
    } catch (error) {
        console.error('Picture upload error:', error);
        // Clean up file on error
        try {
            await fs.unlink(req.file.path);
        } catch (e) {}
        res.status(500).json({ error: 'Failed to upload picture' });
    }
});

// Update picture metadata
router.put('/:id', [
    body('title').optional().trim().isLength({ max: 255 }),
    body('description').optional().trim(),
    body('location_name').optional().trim(),
    body('latitude').optional().isFloat(),
    body('longitude').optional().isFloat(),
    body('tags').optional().isArray(),
    body('album_ids').optional().isArray(),
    body('taken_at').optional().isISO8601()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, location_name, latitude, longitude, tags, album_ids, taken_at } = req.body;

    try {
        // Update picture
        const result = await db.query(
            `UPDATE pictures
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 location_name = COALESCE($3, location_name),
                 latitude = COALESCE($4, latitude),
                 longitude = COALESCE($5, longitude),
                 taken_at = COALESCE($6, taken_at),
                 updated_at = NOW()
             WHERE id = $7 AND user_id = $8
             RETURNING *`,
            [title, description, location_name, latitude, longitude, taken_at, req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Picture not found' });
        }

        // Update tags if provided
        if (tags !== undefined) {
            // Remove existing tags
            await db.query('DELETE FROM picture_tag_relations WHERE picture_id = $1', [req.params.id]);

            // Add new tags
            for (const tagName of tags) {
                if (!tagName) continue;

                const tagResult = await db.query(
                    `INSERT INTO picture_tags (name) VALUES ($1)
                     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                     RETURNING id`,
                    [tagName]
                );

                await db.query(
                    `INSERT INTO picture_tag_relations (picture_id, tag_id)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [req.params.id, tagResult.rows[0].id]
                );
            }
        }

        if (album_ids !== undefined) {
            await db.query('DELETE FROM picture_album_relations WHERE picture_id = $1', [req.params.id]);
            const uniqueAlbumIds = [...new Set(album_ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id)))];

            for (const albumId of uniqueAlbumIds) {
                await db.query(
                    `INSERT INTO picture_album_relations (album_id, picture_id)
                     SELECT $1, $2
                     WHERE EXISTS (
                        SELECT 1 FROM picture_albums
                        WHERE id = $1 AND user_id = $3
                     )`,
                    [albumId, req.params.id, req.user.userId]
                );
            }
        }

        const updatedRow = await ensureThumbnailsForRow(result.rows[0]);

        res.json({
            message: 'Picture updated successfully',
            picture: serializePicture(updatedRow)
        });
    } catch (error) {
        console.error('Picture update error:', error);
        res.status(500).json({ error: 'Failed to update picture' });
    }
});

// Delete picture
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM pictures WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Picture not found' });
        }

        const picture = result.rows[0];

        // Delete file
        try {
            await fs.unlink(picture.file_path);
        } catch (error) {
            console.error('File deletion error:', error);
        }

        // Delete database record (tags and album relations will cascade)
        await db.query(
            'DELETE FROM pictures WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        res.json({ message: 'Picture deleted successfully' });
    } catch (error) {
        console.error('Picture deletion error:', error);
        res.status(500).json({ error: 'Failed to delete picture' });
    }
});

// Get all tags
router.get('/tags/all', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT pt.*, COUNT(ptr.picture_id) as picture_count
             FROM picture_tags pt
             LEFT JOIN picture_tag_relations ptr ON pt.id = ptr.tag_id
             GROUP BY pt.id
             ORDER BY pt.name`
        );

        res.json({ tags: result.rows });
    } catch (error) {
        console.error('Tags fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
});

// Get albums
router.get('/albums/all', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT pa.*, COUNT(par.picture_id) as picture_count,
                    cover.filename as cover_filename,
                    cover.thumbnail_small as cover_thumb_small,
                    cover.thumbnail_medium as cover_thumb_medium,
                    cover.thumbnail_large as cover_thumb_large
             FROM picture_albums pa
             LEFT JOIN picture_album_relations par ON pa.id = par.album_id
             LEFT JOIN pictures cover ON cover.id = pa.cover_picture_id
             WHERE pa.user_id = $1
             GROUP BY pa.id, cover.filename, cover.thumbnail_small, cover.thumbnail_medium, cover.thumbnail_large
             ORDER BY pa.created_at DESC`,
            [req.user.userId]
        );

        const albums = result.rows.map(album => ({
            ...album,
            cover_thumbnails: album.cover_filename
                ? buildThumbnailUrls(album.cover_filename, album.cover_thumb_small, album.cover_thumb_medium, album.cover_thumb_large)
                : null
        }));

        res.json({ albums });
    } catch (error) {
        console.error('Albums fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch albums' });
    }
});

// Create album
router.post('/albums', [
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
            'INSERT INTO picture_albums (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
            [req.user.userId, name, description]
        );

        res.status(201).json({
            message: 'Album created successfully',
            album: result.rows[0]
        });
    } catch (error) {
        console.error('Album creation error:', error);
        res.status(500).json({ error: 'Failed to create album' });
    }
});

// Add picture to album
router.post('/albums/:album_id/pictures/:picture_id', async (req, res) => {
    try {
        // Verify album belongs to user
        const albumCheck = await db.query(
            'SELECT id FROM picture_albums WHERE id = $1 AND user_id = $2',
            [req.params.album_id, req.user.userId]
        );

        if (albumCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Album not found' });
        }

        // Verify picture belongs to user
        const pictureCheck = await db.query(
            'SELECT id FROM pictures WHERE id = $1 AND user_id = $2',
            [req.params.picture_id, req.user.userId]
        );

        if (pictureCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Picture not found' });
        }

        await db.query(
            `INSERT INTO picture_album_relations (album_id, picture_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [req.params.album_id, req.params.picture_id]
        );

        res.json({ message: 'Picture added to album' });
    } catch (error) {
        console.error('Add to album error:', error);
        res.status(500).json({ error: 'Failed to add picture to album' });
    }
});

// Remove picture from album
router.delete('/albums/:album_id/pictures/:picture_id', async (req, res) => {
    try {
        await db.query(
            'DELETE FROM picture_album_relations WHERE album_id = $1 AND picture_id = $2',
            [req.params.album_id, req.params.picture_id]
        );

        res.json({ message: 'Picture removed from album' });
    } catch (error) {
        console.error('Remove from album error:', error);
        res.status(500).json({ error: 'Failed to remove picture from album' });
    }
});

// Delete album
router.delete('/albums/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM picture_albums WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Album not found' });
        }

        res.json({ message: 'Album deleted successfully' });
    } catch (error) {
        console.error('Album deletion error:', error);
        res.status(500).json({ error: 'Failed to delete album' });
    }
});

// Get single picture
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT p.*,
                    COALESCE(
                        (SELECT array_agg(pt.name)
                         FROM picture_tag_relations ptr
                         JOIN picture_tags pt ON ptr.tag_id = pt.id
                         WHERE ptr.picture_id = p.id),
                        ARRAY[]::text[]
                    ) as tags,
                    COALESCE(
                        (SELECT array_agg(pa.name)
                         FROM picture_album_relations par
                         JOIN picture_albums pa ON par.album_id = pa.id
                         WHERE par.picture_id = p.id),
                        ARRAY[]::text[]
                    ) as albums,
                    COALESCE(
                        (SELECT array_agg(pa.id)
                         FROM picture_album_relations par
                         JOIN picture_albums pa ON par.album_id = pa.id
                         WHERE par.picture_id = p.id),
                        ARRAY[]::int[]
                    ) as album_ids
             FROM pictures p
             WHERE p.id = $1 AND p.user_id = $2`,
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Picture not found' });
        }

        const row = await ensureThumbnailsForRow(result.rows[0]);
        res.json({ picture: serializePicture(row) });
    } catch (error) {
        console.error('Picture fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch picture' });
    }
});

// Rescan existing files in the pictures directory
router.post('/rescan', async (req, res) => {
    try {
        await thumbnailInitPromise;
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        const files = await fs.readdir(UPLOAD_DIR);
        const added = [];

        for (const filename of files) {
            const ext = path.extname(filename).toLowerCase();
            if (!IMAGE_EXTENSIONS.has(ext) || isGeneratedThumbnail(filename)) continue;

            const filePath = path.join(UPLOAD_DIR, filename);
            const stats = await fs.stat(filePath);
            if (!stats.isFile()) continue;

            const existing = await db.query(
                'SELECT id FROM pictures WHERE user_id = $1 AND filename = $2',
                [req.user.userId, filename]
            );
            if (existing.rows.length > 0) continue;

            let width = null;
            let height = null;
            try {
                const { stdout } = await execAsync(`identify -format "%w %h" "${filePath}"`);
                const parts = stdout.trim().split(' ');
                width = parseInt(parts[0]);
                height = parseInt(parts[1]);
            } catch (error) {
                console.warn('Rescan dimension detection skipped for', filename);
            }

            const thumbs = {};

            const insert = await db.query(
                `INSERT INTO pictures
                 (user_id, filename, original_filename, file_path, file_size, mime_type,
                  width, height, title, description, location_name, latitude, longitude, taken_at,
                  thumbnail_small, thumbnail_medium, thumbnail_large)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                 RETURNING *`,
                [
                    req.user.userId,
                    filename,
                    filename,
                    filePath,
                    stats.size,
                    guessMimeType(ext),
                    width,
                    height,
                    filename,
                    null,
                    null,
                    null,
                    null,
                    null,
                    thumbs.small || null,
                    thumbs.medium || null,
                    thumbs.large || null
                ]
            );

            const savedRow = await ensureThumbnailsForRow(insert.rows[0]);
            added.push(serializePicture(savedRow));
        }

        res.json({
            message: `Rescan complete. Added ${added.length} new picture${added.length === 1 ? '' : 's'}.`,
            added
        });
    } catch (error) {
        console.error('Pictures rescan error:', error);
        res.status(500).json({ error: 'Failed to rescan pictures' });
    }
});

module.exports = router;

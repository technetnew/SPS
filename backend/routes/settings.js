const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

router.use(authenticateToken);

// ============================================
// USER SETTINGS
// ============================================

// Get user settings
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM user_settings WHERE user_id = $1`,
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            // Create default settings
            const defaultSettings = await db.query(
                `INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *`,
                [req.user.userId]
            );
            return res.json({ success: true, data: defaultSettings.rows[0] });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Settings fetch error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});

// Update user settings
router.put('/', async (req, res) => {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure, contact_email } = req.body;

    try {
        // Check if settings exist
        const existing = await db.query(
            'SELECT id FROM user_settings WHERE user_id = $1',
            [req.user.userId]
        );

        if (existing.rows.length === 0) {
            // Insert new
            const result = await db.query(
                `INSERT INTO user_settings
                 (user_id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure, contact_email)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [req.user.userId, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure, contact_email]
            );
            return res.json({ success: true, data: result.rows[0] });
        }

        // Update existing
        const result = await db.query(
            `UPDATE user_settings SET
                smtp_host = COALESCE($1, smtp_host),
                smtp_port = COALESCE($2, smtp_port),
                smtp_user = COALESCE($3, smtp_user),
                smtp_pass = COALESCE($4, smtp_pass),
                smtp_from = COALESCE($5, smtp_from),
                smtp_secure = COALESCE($6, smtp_secure),
                contact_email = COALESCE($7, contact_email),
                updated_at = NOW()
             WHERE user_id = $8
             RETURNING *`,
            [smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure, contact_email, req.user.userId]
        );

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
});

// ============================================
// DOCUMENT CATEGORIES
// ============================================

// Get document categories
router.get('/document-categories', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM document_categories WHERE user_id = $1 OR user_id IS NULL ORDER BY name`,
            [req.user.userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Document categories fetch error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
});

// Add document category
router.post('/document-categories', async (req, res) => {
    const { name, icon } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
    }

    try {
        const result = await db.query(
            `INSERT INTO document_categories (user_id, name, icon) VALUES ($1, $2, $3) RETURNING *`,
            [req.user.userId, name, icon || '📄']
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Document category creation error:', error);
        res.status(500).json({ success: false, error: 'Failed to create category' });
    }
});

// Update document category
router.put('/document-categories/:id', async (req, res) => {
    const { name, icon } = req.body;

    try {
        const result = await db.query(
            `UPDATE document_categories SET name = COALESCE($1, name), icon = COALESCE($2, icon)
             WHERE id = $3 AND user_id = $4 RETURNING *`,
            [name, icon, req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Document category update error:', error);
        res.status(500).json({ success: false, error: 'Failed to update category' });
    }
});

// Delete document category
router.delete('/document-categories/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM document_categories WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        console.error('Document category deletion error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
});

// Test SMTP connection
router.post('/test-smtp', async (req, res) => {
    const nodemailer = require('nodemailer');
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure } = req.body;

    if (!smtp_host || !smtp_user || !smtp_pass) {
        return res.status(400).json({ success: false, error: 'SMTP host, user, and password are required' });
    }

    try {
        const transporter = nodemailer.createTransport({
            host: smtp_host,
            port: parseInt(smtp_port) || 587,
            secure: smtp_secure === true || smtp_secure === 'true' || parseInt(smtp_port) === 465,
            auth: {
                user: smtp_user,
                pass: smtp_pass
            },
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2'
            }
        });

        await transporter.verify();
        res.json({ success: true, message: 'SMTP connection successful' });
    } catch (error) {
        console.error('SMTP test error:', error);
        res.status(500).json({ success: false, error: `SMTP test failed: ${error.message}` });
    }
});

module.exports = router;

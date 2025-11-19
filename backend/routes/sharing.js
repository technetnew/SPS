const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');
const crypto = require('crypto');

// Get all resources shared with the current user
router.get('/shared-with-me', authenticateToken, async (req, res) => {
    try {
        const { resource_type } = req.query;

        const query = resource_type
            ? 'SELECT * FROM get_shared_resources($1, $2)'
            : 'SELECT * FROM get_shared_resources($1, NULL)';

        const values = resource_type ? [req.user.id, resource_type] : [req.user.id];
        const result = await pool.query(query, values);

        res.json({ shared_resources: result.rows });
    } catch (error) {
        console.error('Error fetching shared resources:', error);
        res.status(500).json({ error: 'Failed to fetch shared resources' });
    }
});

// Get all resources the current user has shared with others
router.get('/shared-by-me', authenticateToken, async (req, res) => {
    try {
        const { resource_type } = req.query;

        let query = `
            SELECT
                sa.id,
                sa.resource_type,
                sa.resource_id,
                sa.shared_with_user_id,
                u.username as shared_with_username,
                u.email as shared_with_email,
                sa.permission_level,
                sa.granted_at,
                sa.expires_at,
                sa.is_active
            FROM shared_access sa
            JOIN users u ON u.id = sa.shared_with_user_id
            WHERE sa.owner_id = $1
        `;

        const values = [req.user.id];

        if (resource_type) {
            query += ' AND sa.resource_type = $2';
            values.push(resource_type);
        }

        query += ' ORDER BY sa.granted_at DESC';

        const result = await pool.query(query, values);
        res.json({ shared_resources: result.rows });
    } catch (error) {
        console.error('Error fetching shared by me:', error);
        res.status(500).json({ error: 'Failed to fetch shared resources' });
    }
});

// Get users who have access to a specific resource
router.get('/:resource_type/:resource_id/users', authenticateToken, async (req, res) => {
    try {
        const { resource_type, resource_id } = req.params;

        // Verify user owns this resource
        const ownerCheck = await verifyResourceOwner(req.user.id, resource_type, resource_id);
        if (!ownerCheck) {
            return res.status(403).json({ error: 'You do not own this resource' });
        }

        const query = `
            SELECT
                sa.id,
                sa.shared_with_user_id,
                u.username,
                u.email,
                u.first_name,
                u.last_name,
                sa.permission_level,
                sa.granted_at,
                sa.expires_at
            FROM shared_access sa
            JOIN users u ON u.id = sa.shared_with_user_id
            WHERE sa.owner_id = $1
                AND sa.resource_type = $2
                AND sa.resource_id = $3
                AND sa.is_active = TRUE
            ORDER BY sa.granted_at DESC
        `;

        const result = await pool.query(query, [req.user.id, resource_type, resource_id]);
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Error fetching shared users:', error);
        res.status(500).json({ error: 'Failed to fetch shared users' });
    }
});

// Share a resource with another user
router.post('/share', authenticateToken, async (req, res) => {
    try {
        const {
            shared_with_user_id,
            shared_with_email,
            resource_type,
            resource_id,
            permission_level,
            expires_at
        } = req.body;

        // Validate permission level
        if (!['view', 'edit', 'admin'].includes(permission_level)) {
            return res.status(400).json({ error: 'Invalid permission level' });
        }

        // Verify user owns this resource
        const ownerCheck = await verifyResourceOwner(req.user.id, resource_type, resource_id);
        if (!ownerCheck) {
            return res.status(403).json({ error: 'You do not own this resource' });
        }

        let targetUserId = shared_with_user_id;

        // If email provided, find or invite user
        if (shared_with_email && !shared_with_user_id) {
            const userQuery = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [shared_with_email]
            );

            if (userQuery.rows.length > 0) {
                targetUserId = userQuery.rows[0].id;
            } else {
                // Create invitation for non-existent user
                const invitationToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

                await pool.query(
                    `INSERT INTO sharing_invitations
                    (owner_id, invited_email, resource_type, resource_id, permission_level, invitation_token, expires_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [req.user.id, shared_with_email, resource_type, resource_id, permission_level, invitationToken, expiresAt]
                );

                return res.json({
                    message: 'Invitation sent to email',
                    invitation_sent: true,
                    invitation_token: invitationToken
                });
            }
        }

        if (!targetUserId) {
            return res.status(400).json({ error: 'Must provide either user_id or email' });
        }

        // Cannot share with yourself
        if (targetUserId === req.user.id) {
            return res.status(400).json({ error: 'Cannot share with yourself' });
        }

        // Insert or update shared access
        const query = `
            INSERT INTO shared_access
            (owner_id, shared_with_user_id, resource_type, resource_id, permission_level, expires_at, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            ON CONFLICT (owner_id, shared_with_user_id, resource_type, resource_id)
            DO UPDATE SET
                permission_level = EXCLUDED.permission_level,
                expires_at = EXCLUDED.expires_at,
                is_active = TRUE,
                granted_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const result = await pool.query(query, [
            req.user.id,
            targetUserId,
            resource_type,
            resource_id,
            permission_level,
            expires_at || null
        ]);

        // Log activity
        await pool.query(
            'INSERT INTO sharing_activity (shared_access_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
            [result.rows[0].id, req.user.id, 'granted', `Granted ${permission_level} access`]
        );

        res.json({
            message: 'Resource shared successfully',
            shared_access: result.rows[0]
        });
    } catch (error) {
        console.error('Error sharing resource:', error);
        res.status(500).json({ error: 'Failed to share resource' });
    }
});

// Update sharing permissions
router.put('/share/:share_id', authenticateToken, async (req, res) => {
    try {
        const { share_id } = req.params;
        const { permission_level, expires_at } = req.body;

        // Verify ownership
        const checkQuery = await pool.query(
            'SELECT * FROM shared_access WHERE id = $1 AND owner_id = $2',
            [share_id, req.user.id]
        );

        if (checkQuery.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const query = `
            UPDATE shared_access
            SET permission_level = $1, expires_at = $2
            WHERE id = $3
            RETURNING *
        `;

        const result = await pool.query(query, [permission_level, expires_at || null, share_id]);

        // Log activity
        await pool.query(
            'INSERT INTO sharing_activity (shared_access_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
            [share_id, req.user.id, 'modified', `Updated to ${permission_level} access`]
        );

        res.json({
            message: 'Sharing permissions updated',
            shared_access: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating share:', error);
        res.status(500).json({ error: 'Failed to update sharing permissions' });
    }
});

// Revoke access
router.delete('/share/:share_id', authenticateToken, async (req, res) => {
    try {
        const { share_id } = req.params;

        // Verify ownership
        const checkQuery = await pool.query(
            'SELECT * FROM shared_access WHERE id = $1 AND owner_id = $2',
            [share_id, req.user.id]
        );

        if (checkQuery.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Soft delete - mark as inactive
        await pool.query(
            'UPDATE shared_access SET is_active = FALSE WHERE id = $1',
            [share_id]
        );

        // Log activity
        await pool.query(
            'INSERT INTO sharing_activity (shared_access_id, user_id, action, details) VALUES ($1, $2, $3, $4)',
            [share_id, req.user.id, 'revoked', 'Access revoked']
        );

        res.json({ message: 'Access revoked successfully' });
    } catch (error) {
        console.error('Error revoking access:', error);
        res.status(500).json({ error: 'Failed to revoke access' });
    }
});

// Check if user has access to a resource
router.get('/check-access/:resource_type/:resource_id', authenticateToken, async (req, res) => {
    try {
        const { resource_type, resource_id } = req.params;
        const { required_permission } = req.query;

        const result = await pool.query(
            'SELECT has_resource_access($1, $2, $3, $4) as has_access',
            [req.user.id, resource_type, resource_id, required_permission || 'view']
        );

        res.json({
            has_access: result.rows[0].has_access,
            user_id: req.user.id,
            resource_type,
            resource_id
        });
    } catch (error) {
        console.error('Error checking access:', error);
        res.status(500).json({ error: 'Failed to check access' });
    }
});

// Search users to share with
router.get('/search-users', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json({ users: [] });
        }

        const query = `
            SELECT id, username, email, first_name, last_name
            FROM users
            WHERE id != $1
                AND is_active = TRUE
                AND (
                    username ILIKE $2
                    OR email ILIKE $2
                    OR first_name ILIKE $2
                    OR last_name ILIKE $2
                )
            LIMIT 10
        `;

        const result = await pool.query(query, [req.user.id, `%${q}%`]);
        res.json({ users: result.rows });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// Helper function to verify resource ownership
async function verifyResourceOwner(userId, resourceType, resourceId) {
    let query;

    switch (resourceType) {
        case 'inventory':
            query = 'SELECT id FROM inventory_items WHERE id = $1 AND user_id = $2';
            break;
        case 'plan':
            query = 'SELECT id FROM emergency_plans WHERE id = $1 AND user_id = $2';
            break;
        case 'video':
            query = 'SELECT id FROM videos WHERE id = $1 AND user_id = $2';
            break;
        case 'playlist':
            query = 'SELECT id FROM video_playlists WHERE id = $1 AND user_id = $2';
            break;
        case 'checklist':
            query = 'SELECT id FROM checklists WHERE id = $1 AND user_id = $2';
            break;
        case 'document':
            query = 'SELECT id FROM documents WHERE id = $1 AND user_id = $2';
            break;
        default:
            return false;
    }

    const result = await pool.query(query, [resourceId, userId]);
    return result.rows.length > 0;
}

module.exports = router;

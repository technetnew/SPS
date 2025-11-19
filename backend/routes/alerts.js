const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all alerts for user
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM alerts
       WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    res.json({ alerts: result.rows });
  } catch (error) {
    console.error('Alerts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Mark alert as read
router.put('/:id/read', async (req, res) => {
  try {
    await db.query(
      'UPDATE alerts SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    res.json({ message: 'Alert marked as read' });
  } catch (error) {
    console.error('Alert update error:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Add more alert routes here

module.exports = router;

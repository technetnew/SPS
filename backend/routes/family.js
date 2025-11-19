const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all family members
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM family_members WHERE user_id = $1 ORDER BY created_at',
      [req.user.userId]
    );

    res.json({ family_members: result.rows });
  } catch (error) {
    console.error('Family fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch family members' });
  }
});

// Add more family routes here

module.exports = router;

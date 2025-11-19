const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all available skills
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM skills ORDER BY category, name');
    res.json({ skills: result.rows });
  } catch (error) {
    console.error('Skills fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

// Get user's skills progress
router.get('/my-skills', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT us.*, s.name, s.category, s.description
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = $1
       ORDER BY us.last_practiced DESC`,
      [req.user.userId]
    );

    res.json({ user_skills: result.rows });
  } catch (error) {
    console.error('User skills fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user skills' });
  }
});

// Add more skill routes here

module.exports = router;

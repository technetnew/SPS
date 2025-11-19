const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get all emergency plans
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM emergency_plans
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    res.json({ plans: result.rows });
  } catch (error) {
    console.error('Plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Create new plan
router.post('/', [
  body('plan_type').trim().notEmpty(),
  body('title').trim().notEmpty().isLength({ max: 255 }),
  body('description').optional().trim(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { plan_type, title, description, priority } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO emergency_plans (user_id, plan_type, title, description, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.userId, plan_type, title, description, priority]
    );

    res.status(201).json({
      message: 'Plan created successfully',
      plan: result.rows[0]
    });
  } catch (error) {
    console.error('Plan creation error:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// Add more plan routes here (update, delete, get steps, etc.)

module.exports = router;

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all inventory items for user
router.get('/', [
  query('category_id').optional().isInt(),
  query('search').optional().trim(),
  query('expiring_soon').optional().isBoolean(),
  query('low_stock').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { category_id, search, expiring_soon, low_stock } = req.query;

  try {
    let query = `
      SELECT i.*, c.name as category_name
      FROM inventory_items i
      LEFT JOIN inventory_categories c ON i.category_id = c.id
      WHERE i.user_id = $1
    `;
    const params = [req.user.userId];
    let paramCount = 1;

    if (category_id) {
      paramCount++;
      query += ` AND i.category_id = $${paramCount}`;
      params.push(category_id);
    }

    if (search) {
      paramCount++;
      query += ` AND (i.name ILIKE $${paramCount} OR i.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (expiring_soon === 'true') {
      query += ` AND i.expiration_date IS NOT NULL AND i.expiration_date <= NOW() + INTERVAL '30 days'`;
    }

    if (low_stock === 'true') {
      query += ` AND i.min_quantity IS NOT NULL AND i.quantity <= i.min_quantity`;
    }

    query += ` ORDER BY i.created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      count: result.rows.length,
      items: result.rows
    });
  } catch (error) {
    console.error('Inventory fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Get single inventory item
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.*, c.name as category_name
       FROM inventory_items i
       LEFT JOIN inventory_categories c ON i.category_id = c.id
       WHERE i.id = $1 AND i.user_id = $2`,
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Item fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// Create new inventory item
router.post('/', [
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('category_id').optional().isInt(),
  body('description').optional().trim(),
  body('quantity').isNumeric(),
  body('unit').optional().trim().isLength({ max: 50 }),
  body('location').optional().trim().isLength({ max: 255 }),
  body('purchase_date').optional().isISO8601(),
  body('expiration_date').optional().isISO8601(),
  body('cost').optional().isDecimal(),
  body('min_quantity').optional().isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    name, category_id, description, quantity, unit,
    location, purchase_date, expiration_date, cost, notes, min_quantity
  } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO inventory_items
       (user_id, category_id, name, description, quantity, unit, location,
        purchase_date, expiration_date, cost, notes, min_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [req.user.userId, category_id, name, description, quantity, unit,
       location, purchase_date, expiration_date, cost, notes, min_quantity]
    );

    const item = result.rows[0];

    // Log transaction
    await db.query(
      `INSERT INTO inventory_transactions
       (item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reason)
       VALUES ($1, $2, 'add', $3, 0, $3, 'Initial creation')`,
      [item.id, req.user.userId, quantity]
    );

    res.status(201).json({
      message: 'Item created successfully',
      item
    });
  } catch (error) {
    console.error('Item creation error:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Update inventory item
router.put('/:id', [
  body('name').optional().trim().isLength({ max: 255 }),
  body('category_id').optional().isInt(),
  body('description').optional().trim(),
  body('quantity').optional().isNumeric(),
  body('unit').optional().trim().isLength({ max: 50 }),
  body('location').optional().trim().isLength({ max: 255 }),
  body('expiration_date').optional().isISO8601(),
  body('min_quantity').optional().isNumeric()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Get current item
    const currentItem = await db.query(
      'SELECT * FROM inventory_items WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );

    if (currentItem.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const {
      name, category_id, description, quantity, unit,
      location, expiration_date, cost, notes, min_quantity
    } = req.body;

    const result = await db.query(
      `UPDATE inventory_items
       SET name = COALESCE($1, name),
           category_id = COALESCE($2, category_id),
           description = COALESCE($3, description),
           quantity = COALESCE($4, quantity),
           unit = COALESCE($5, unit),
           location = COALESCE($6, location),
           expiration_date = COALESCE($7, expiration_date),
           cost = COALESCE($8, cost),
           notes = COALESCE($9, notes),
           min_quantity = COALESCE($10, min_quantity),
           updated_at = NOW()
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
      [name, category_id, description, quantity, unit, location,
       expiration_date, cost, notes, min_quantity,
       req.params.id, req.user.userId]
    );

    // Log transaction if quantity changed
    if (quantity && quantity !== currentItem.rows[0].quantity) {
      await db.query(
        `INSERT INTO inventory_transactions
         (item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reason)
         VALUES ($1, $2, 'update', $3, $4, $5, 'Manual update')`,
        [req.params.id, req.user.userId,
         Math.abs(quantity - currentItem.rows[0].quantity),
         currentItem.rows[0].quantity, quantity]
      );
    }

    res.json({
      message: 'Item updated successfully',
      item: result.rows[0]
    });
  } catch (error) {
    console.error('Item update error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete inventory item
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM inventory_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Item deletion error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Get inventory statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await db.query(
      `SELECT
         COUNT(*) as total_items,
         SUM(quantity) as total_quantity,
         COUNT(CASE WHEN expiration_date <= NOW() + INTERVAL '30 days' THEN 1 END) as expiring_soon,
         COUNT(CASE WHEN quantity <= min_quantity AND min_quantity IS NOT NULL THEN 1 END) as low_stock,
         SUM(cost) as total_value
       FROM inventory_items
       WHERE user_id = $1`,
      [req.user.userId]
    );

    res.json({ stats: stats.rows[0] });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get categories
router.get('/categories/all', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM inventory_categories ORDER BY name'
    );

    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;

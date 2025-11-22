const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get storage locations for user
router.get('/locations', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT sl.*,
                    COUNT(ii.id) as item_count
             FROM storage_locations sl
             LEFT JOIN inventory_items ii ON sl.name = ii.location AND ii.user_id = $1
             WHERE sl.user_id = $1
             GROUP BY sl.id
             ORDER BY sl.name`,
            [req.user.userId]
        );
        res.json({ locations: result.rows });
    } catch (error) {
        console.error('Locations fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
});

// Create storage location
router.post('/locations', [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('location_type').optional().isIn(['home', 'vehicle', 'cache', 'bug_out', 'storage_unit'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, location_type, address, is_primary } = req.body;

    try {
        if (is_primary) {
            await db.query(
                'UPDATE storage_locations SET is_primary = FALSE WHERE user_id = $1',
                [req.user.userId]
            );
        }

        const result = await db.query(
            `INSERT INTO storage_locations (user_id, name, description, location_type, address, is_primary)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.userId, name, description, location_type, address, is_primary || false]
        );

        res.status(201).json({
            message: 'Location created successfully',
            location: result.rows[0]
        });
    } catch (error) {
        console.error('Location creation error:', error);
        res.status(500).json({ error: 'Failed to create location' });
    }
});

// Update storage location
router.put('/locations/:id', async (req, res) => {
    const { name, description, location_type, address, is_primary } = req.body;

    try {
        if (is_primary) {
            await db.query(
                'UPDATE storage_locations SET is_primary = FALSE WHERE user_id = $1',
                [req.user.userId]
            );
        }

        const result = await db.query(
            `UPDATE storage_locations SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                location_type = COALESCE($3, location_type),
                address = COALESCE($4, address),
                is_primary = COALESCE($5, is_primary)
             WHERE id = $6 AND user_id = $7
             RETURNING *`,
            [name, description, location_type, address, is_primary, req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }

        res.json({ message: 'Location updated', location: result.rows[0] });
    } catch (error) {
        console.error('Location update error:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

// Delete storage location
router.delete('/locations/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM storage_locations WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Location not found' });
        }

        res.json({ message: 'Location deleted successfully' });
    } catch (error) {
        console.error('Location deletion error:', error);
        res.status(500).json({ error: 'Failed to delete location' });
    }
});

// Barcode lookup
router.get('/barcode/:code', async (req, res) => {
    try {
        // First check if we have this barcode in our inventory
        const existing = await db.query(
            `SELECT * FROM inventory_items WHERE barcode = $1 AND user_id = $2 LIMIT 1`,
            [req.params.code, req.user.userId]
        );

        if (existing.rows.length > 0) {
            return res.json({ found: true, source: 'inventory', item: existing.rows[0] });
        }

        // Check food database
        const foodDb = await db.query(
            `SELECT * FROM food_database WHERE barcode = $1 OR upc = $1 LIMIT 1`,
            [req.params.code]
        );

        if (foodDb.rows.length > 0) {
            return res.json({ found: true, source: 'food_database', item: foodDb.rows[0] });
        }

        res.json({ found: false, barcode: req.params.code });
    } catch (error) {
        console.error('Barcode lookup error:', error);
        res.status(500).json({ error: 'Failed to lookup barcode' });
    }
});

// Get CSV import template headers
router.get('/import/template', (req, res) => {
    const headers = [
        'name', 'category', 'quantity', 'unit', 'location', 'purchase_date',
        'expiration_date', 'cost', 'barcode', 'min_quantity', 'notes'
    ];

    const sampleRow = [
        'First Aid Kit', 'Medical Supplies', '2', 'units', 'Garage', '2024-01-15',
        '2027-01-15', '45.99', '123456789012', '1', 'Standard emergency kit'
    ];

    res.json({
        headers,
        sample_csv: headers.join(',') + '\n' + sampleRow.join(','),
        instructions: {
            name: 'Item name (required)',
            category: 'One of: Food & Water, Medical Supplies, Tools & Equipment, Shelter & Warmth, Communication, Lighting & Power, Clothing, Documents',
            quantity: 'Number (required)',
            unit: 'One of: units, lbs, kg, oz, gallons, liters, boxes, cans, rounds',
            location: 'Storage location name',
            purchase_date: 'YYYY-MM-DD format',
            expiration_date: 'YYYY-MM-DD format',
            cost: 'Price in dollars',
            barcode: 'UPC/EAN barcode',
            min_quantity: 'Low stock alert threshold',
            notes: 'Additional notes'
        }
    });
});

// Bulk import inventory items (CSV)
router.post('/import', [
    body('items').isArray({ min: 1 }),
    body('items.*.name').trim().notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { items } = req.body;
    const results = { success: [], errors: [] };

    // Get category mapping
    const categories = await db.query('SELECT id, name FROM inventory_categories');
    const categoryMap = {};
    categories.rows.forEach(c => {
        categoryMap[c.name.toLowerCase()] = c.id;
    });

    // Get location mapping
    const locations = await db.query(
        'SELECT id, name FROM storage_locations WHERE user_id = $1',
        [req.user.userId]
    );
    const locationMap = {};
    locations.rows.forEach(l => {
        locationMap[l.name.toLowerCase()] = l.id;
    });

    try {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                // Map category name to ID
                let categoryId = null;
                if (item.category) {
                    categoryId = categoryMap[item.category.toLowerCase()] || null;
                }

                // Map location name to ID
                let locationId = null;
                if (item.location) {
                    locationId = locationMap[item.location.toLowerCase()] || null;
                }

                const result = await db.query(
                    `INSERT INTO inventory_items
                     (user_id, category_id, name, quantity, unit, location, purchase_date,
                      expiration_date, cost, barcode, min_quantity, notes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                     RETURNING id, name`,
                    [req.user.userId, categoryId, item.name, item.quantity || 1,
                     item.unit || 'units', item.location || null, item.purchase_date || null,
                     item.expiration_date || null, item.cost || null, item.barcode || null,
                     item.min_quantity || null, item.notes || null]
                );

                // Log transaction
                await db.query(
                    `INSERT INTO inventory_transactions
                     (item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reason)
                     VALUES ($1, $2, 'add', $3, 0, $3, 'CSV Import')`,
                    [result.rows[0].id, req.user.userId, item.quantity || 1]
                );

                results.success.push({ row: i + 1, id: result.rows[0].id, name: result.rows[0].name });
            } catch (err) {
                results.errors.push({ row: i + 1, name: item.name, error: err.message });
            }
        }

        res.json({
            message: `Imported ${results.success.length} items with ${results.errors.length} errors`,
            results
        });
    } catch (error) {
        console.error('Bulk import error:', error);
        res.status(500).json({ error: 'Failed to import items' });
    }
});

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

// Get all categories (must be before /:id route)
router.get('/categories', async (req, res) => {
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

// Get all locations (must be before /:id route)
router.get('/locations', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM storage_locations WHERE user_id = $1 ORDER BY name',
      [req.user.userId]
    );
    res.json({ locations: result.rows });
  } catch (error) {
    console.error('Locations fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
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

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// PANTRY ITEMS
// ============================================

// Get all pantry items
router.get('/items', [
    query('location_id').optional().isInt(),
    query('category').optional().trim(),
    query('status').optional().isIn(['in_stock', 'low', 'out', 'expired', 'consumed']),
    query('expiring_days').optional().isInt(),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { location_id, category, status, expiring_days, search, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    try {
        let queryStr = `
            SELECT pi.*, pl.name as location_name, fd.calories as food_db_calories
            FROM pantry_items pi
            LEFT JOIN pantry_locations pl ON pi.location_id = pl.id
            LEFT JOIN food_database fd ON pi.food_id = fd.id
            WHERE pi.user_id = $1
        `;
        const params = [req.user.userId];
        let paramCount = 1;

        if (location_id) {
            paramCount++;
            queryStr += ` AND pi.location_id = $${paramCount}`;
            params.push(location_id);
        }

        if (category) {
            paramCount++;
            queryStr += ` AND pi.category = $${paramCount}`;
            params.push(category);
        }

        if (status) {
            if (status === 'expired') {
                queryStr += ` AND pi.expiration_date < CURRENT_DATE`;
            } else {
                paramCount++;
                queryStr += ` AND pi.status = $${paramCount}`;
                params.push(status);
            }
        }

        if (expiring_days) {
            paramCount++;
            queryStr += ` AND pi.expiration_date IS NOT NULL AND pi.expiration_date <= CURRENT_DATE + $${paramCount}::INTEGER * INTERVAL '1 day'`;
            params.push(expiring_days);
        }

        if (search) {
            paramCount++;
            queryStr += ` AND (pi.name ILIKE $${paramCount} OR pi.brand ILIKE $${paramCount} OR pi.barcode = $${paramCount - 1 + 1})`;
            params.push(`%${search}%`);
        }

        // Count total
        const countResult = await db.query(
            `SELECT COUNT(*) FROM (${queryStr}) sub`,
            params
        );
        const totalCount = parseInt(countResult.rows[0].count);

        // Get paginated results
        queryStr += ` ORDER BY
            CASE WHEN pi.expiration_date < CURRENT_DATE THEN 0
                 WHEN pi.expiration_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1
                 WHEN pi.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 2
                 ELSE 3 END,
            pi.expiration_date ASC NULLS LAST, pi.name ASC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        params.push(limit, offset);

        const result = await db.query(queryStr, params);

        res.json({
            items: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Pantry fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch pantry items' });
    }
});

// Get pantry item by ID
router.get('/items/:id', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT pi.*, pl.name as location_name, fd.*
             FROM pantry_items pi
             LEFT JOIN pantry_locations pl ON pi.location_id = pl.id
             LEFT JOIN food_database fd ON pi.food_id = fd.id
             WHERE pi.id = $1 AND pi.user_id = $2`,
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ item: result.rows[0] });
    } catch (error) {
        console.error('Pantry item fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch pantry item' });
    }
});

// Create new pantry item
router.post('/items', [
    body('name').trim().notEmpty().isLength({ max: 500 }),
    body('food_id').optional({ nullable: true, checkFalsy: true }).isInt(),
    body('location_id').optional({ nullable: true, checkFalsy: true }).isInt(),
    body('brand').optional().trim(),
    body('barcode').optional().trim(),
    body('quantity').optional().default(1).isNumeric(),
    body('unit').optional().trim(),
    body('servings_per_unit').optional({ nullable: true, checkFalsy: true }).isNumeric(),
    body('calories_per_unit').optional({ nullable: true, checkFalsy: true }).isInt(),
    body('protein_per_unit').optional({ nullable: true, checkFalsy: true }).isNumeric(),
    body('carbs_per_unit').optional({ nullable: true, checkFalsy: true }).isNumeric(),
    body('fat_per_unit').optional({ nullable: true, checkFalsy: true }).isNumeric(),
    body('purchase_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('expiration_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('best_by_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('cost_per_unit').optional({ nullable: true, checkFalsy: true }).isDecimal(),
    body('category').optional().trim(),
    body('allergens').optional(),
    body('notes').optional().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Pantry validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        name, food_id, location_id, brand, barcode, quantity, unit,
        servings_per_unit, calories_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit,
        purchase_date, expiration_date, best_by_date, cost_per_unit, category, allergens, notes
    } = req.body;

    // Helper to convert empty strings to null for database
    const toNullIfEmpty = (val) => (val === '' || val === undefined || val === null) ? null : val;
    const toIntOrNull = (val) => {
        if (val === '' || val === undefined || val === null) return null;
        const parsed = parseInt(val);
        return isNaN(parsed) ? null : parsed;
    };
    const toFloatOrNull = (val) => {
        if (val === '' || val === undefined || val === null) return null;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
    };

    try {
        const cleanCost = toFloatOrNull(cost_per_unit);
        const cleanQuantity = toFloatOrNull(quantity) || 1;
        const total_cost = cleanCost ? cleanCost * cleanQuantity : null;

        const result = await db.query(
            `INSERT INTO pantry_items
             (user_id, food_id, location_id, name, brand, barcode, quantity, unit,
              servings_per_unit, calories_per_unit, protein_per_unit, carbs_per_unit, fat_per_unit,
              purchase_date, expiration_date, best_by_date, cost_per_unit, total_cost, category, allergens, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
             RETURNING *`,
            [req.user.userId, toIntOrNull(food_id), toIntOrNull(location_id), name, toNullIfEmpty(brand), toNullIfEmpty(barcode), cleanQuantity, unit || 'units',
             toFloatOrNull(servings_per_unit) || 1, toIntOrNull(calories_per_unit), toFloatOrNull(protein_per_unit), toFloatOrNull(carbs_per_unit), toFloatOrNull(fat_per_unit),
             toNullIfEmpty(purchase_date), toNullIfEmpty(expiration_date), toNullIfEmpty(best_by_date), cleanCost, total_cost, toNullIfEmpty(category),
             allergens ? JSON.stringify(allergens) : null, toNullIfEmpty(notes)]
        );

        // Log transaction
        await db.query(
            `INSERT INTO pantry_transactions
             (pantry_item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reason)
             VALUES ($1, $2, 'add', $3, 0, $3, 'Initial creation')`,
            [result.rows[0].id, req.user.userId, quantity]
        );

        res.status(201).json({
            message: 'Pantry item created successfully',
            item: result.rows[0]
        });
    } catch (error) {
        console.error('Pantry item creation error:', error);
        res.status(500).json({ error: 'Failed to create pantry item' });
    }
});

// Update pantry item
router.put('/items/:id', async (req, res) => {
    try {
        // Get current item
        const currentItem = await db.query(
            'SELECT * FROM pantry_items WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (currentItem.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const fields = ['name', 'food_id', 'location_id', 'brand', 'barcode', 'quantity', 'unit',
            'servings_per_unit', 'calories_per_unit', 'protein_per_unit', 'carbs_per_unit', 'fat_per_unit',
            'purchase_date', 'expiration_date', 'best_by_date', 'cost_per_unit', 'category', 'allergens',
            'notes', 'status', 'is_opened', 'opened_date'];

        const updates = [];
        const values = [];
        let paramCount = 0;

        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                paramCount++;
                updates.push(`${field} = $${paramCount}`);
                values.push(field === 'allergens' ? JSON.stringify(req.body[field]) : req.body[field]);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Add updated_at (no parameter needed - uses NOW())
        updates.push(`updated_at = NOW()`);

        // Recalculate total_cost if quantity or cost changed
        if (req.body.quantity !== undefined || req.body.cost_per_unit !== undefined) {
            const newQty = req.body.quantity || currentItem.rows[0].quantity;
            const newCost = req.body.cost_per_unit || currentItem.rows[0].cost_per_unit;
            if (newCost) {
                paramCount++;
                updates.push(`total_cost = $${paramCount}`);
                values.push(newQty * newCost);
            }
        }

        // Add id and user_id parameters for WHERE clause
        paramCount++;
        const idParam = paramCount;
        values.push(req.params.id);
        paramCount++;
        const userIdParam = paramCount;
        values.push(req.user.userId);

        const result = await db.query(
            `UPDATE pantry_items SET ${updates.join(', ')}
             WHERE id = $${idParam} AND user_id = $${userIdParam}
             RETURNING *`,
            values
        );

        // Log quantity change
        if (req.body.quantity !== undefined && req.body.quantity !== currentItem.rows[0].quantity) {
            await db.query(
                `INSERT INTO pantry_transactions
                 (pantry_item_id, user_id, transaction_type, quantity, previous_quantity, new_quantity, reason)
                 VALUES ($1, $2, 'adjust', $3, $4, $5, 'Manual adjustment')`,
                [req.params.id, req.user.userId,
                 Math.abs(req.body.quantity - currentItem.rows[0].quantity),
                 currentItem.rows[0].quantity, req.body.quantity]
            );
        }

        res.json({
            message: 'Pantry item updated successfully',
            item: result.rows[0]
        });
    } catch (error) {
        console.error('Pantry item update error:', error);
        res.status(500).json({ error: 'Failed to update pantry item' });
    }
});

// Consume pantry item
router.post('/items/:id/consume', [
    body('quantity').isNumeric().custom(val => val > 0),
    body('family_profile_id').optional().isInt(),
    body('meal_type').optional().isIn(['breakfast', 'lunch', 'dinner', 'snack']),
    body('consumption_date').optional().isISO8601(),
    body('notes').optional().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { quantity, family_profile_id, meal_type, consumption_date, notes } = req.body;

    try {
        // Get current item
        const currentItem = await db.query(
            'SELECT * FROM pantry_items WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (currentItem.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const item = currentItem.rows[0];
        if (quantity > item.quantity) {
            return res.status(400).json({ error: 'Cannot consume more than available quantity' });
        }

        const newQuantity = item.quantity - quantity;
        const newStatus = newQuantity === 0 ? 'consumed' : (newQuantity <= (item.min_quantity || 0) ? 'low' : 'in_stock');

        // Update item
        await db.query(
            `UPDATE pantry_items SET quantity = $1, status = $2, updated_at = NOW()
             WHERE id = $3 AND user_id = $4`,
            [newQuantity, newStatus, req.params.id, req.user.userId]
        );

        // Log transaction
        await db.query(
            `INSERT INTO pantry_transactions
             (pantry_item_id, user_id, family_profile_id, transaction_type, quantity, previous_quantity, new_quantity,
              meal_type, consumption_date, notes)
             VALUES ($1, $2, $3, 'consume', $4, $5, $6, $7, $8, $9)`,
            [req.params.id, req.user.userId, family_profile_id, quantity, item.quantity, newQuantity,
             meal_type, consumption_date || new Date().toISOString().split('T')[0], notes]
        );

        res.json({
            message: 'Consumption recorded successfully',
            previous_quantity: item.quantity,
            consumed: quantity,
            new_quantity: newQuantity,
            status: newStatus
        });
    } catch (error) {
        console.error('Consumption error:', error);
        res.status(500).json({ error: 'Failed to record consumption' });
    }
});

// Delete pantry item
router.delete('/items/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM pantry_items WHERE id = $1 AND user_id = $2 RETURNING id, name',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ message: 'Pantry item deleted successfully', item: result.rows[0] });
    } catch (error) {
        console.error('Pantry item deletion error:', error);
        res.status(500).json({ error: 'Failed to delete pantry item' });
    }
});

// Bulk import pantry items (CSV)
router.post('/items/bulk', [
    body('items').isArray({ min: 1 }),
    body('items.*.name').trim().notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { items } = req.body;
    const results = { success: [], errors: [] };

    try {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                const result = await db.query(
                    `INSERT INTO pantry_items
                     (user_id, name, brand, barcode, quantity, unit, calories_per_unit, protein_per_unit,
                      carbs_per_unit, fat_per_unit, expiration_date, category, notes)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                     RETURNING id, name`,
                    [req.user.userId, item.name, item.brand, item.barcode, item.quantity || 1,
                     item.unit || 'units', item.calories_per_unit, item.protein_per_unit,
                     item.carbs_per_unit, item.fat_per_unit, item.expiration_date, item.category, item.notes]
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

// ============================================
// PANTRY LOCATIONS
// ============================================

// Get all locations
router.get('/locations', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT pl.*,
                    COUNT(pi.id) as item_count,
                    SUM(pi.calories_per_unit * pi.quantity) as total_calories
             FROM pantry_locations pl
             LEFT JOIN pantry_items pi ON pl.id = pi.location_id AND pi.status != 'consumed'
             WHERE pl.user_id = $1
             GROUP BY pl.id
             ORDER BY pl.sort_order, pl.name`,
            [req.user.userId]
        );
        res.json({ locations: result.rows });
    } catch (error) {
        console.error('Locations fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
});

// Create location
router.post('/locations', [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('location_type').optional().isIn(['pantry', 'refrigerator', 'freezer', 'basement', 'garage', 'root_cellar']),
    body('temperature_zone').optional().isIn(['frozen', 'refrigerated', 'cool', 'room_temp'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, location_type, temperature_zone, is_default } = req.body;

    try {
        // If setting as default, unset others
        if (is_default) {
            await db.query(
                'UPDATE pantry_locations SET is_default = FALSE WHERE user_id = $1',
                [req.user.userId]
            );
        }

        const result = await db.query(
            `INSERT INTO pantry_locations (user_id, name, description, location_type, temperature_zone, is_default)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.userId, name, description, location_type, temperature_zone, is_default || false]
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

// Update location
router.put('/locations/:id', async (req, res) => {
    const { name, description, location_type, temperature_zone, is_default, sort_order } = req.body;

    try {
        if (is_default) {
            await db.query(
                'UPDATE pantry_locations SET is_default = FALSE WHERE user_id = $1',
                [req.user.userId]
            );
        }

        const result = await db.query(
            `UPDATE pantry_locations
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 location_type = COALESCE($3, location_type),
                 temperature_zone = COALESCE($4, temperature_zone),
                 is_default = COALESCE($5, is_default),
                 sort_order = COALESCE($6, sort_order)
             WHERE id = $7 AND user_id = $8
             RETURNING *`,
            [name, description, location_type, temperature_zone, is_default, sort_order, req.params.id, req.user.userId]
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

// Delete location
router.delete('/locations/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM pantry_locations WHERE id = $1 AND user_id = $2 RETURNING id',
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

// ============================================
// PANTRY STATISTICS
// ============================================

router.get('/stats', async (req, res) => {
    try {
        const stats = await db.query(
            `SELECT
                COUNT(*) as total_items,
                COALESCE(SUM(quantity), 0) as total_units,
                COALESCE(SUM(calories_per_unit * quantity), 0) as total_calories,
                COALESCE(SUM(protein_per_unit * quantity), 0) as total_protein,
                COALESCE(SUM(carbs_per_unit * quantity), 0) as total_carbs,
                COALESCE(SUM(fat_per_unit * quantity), 0) as total_fat,
                COALESCE(SUM(total_cost), 0) as total_value,
                COUNT(CASE WHEN expiration_date < CURRENT_DATE THEN 1 END) as expired_count,
                COUNT(CASE WHEN expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as expiring_7_days,
                COUNT(CASE WHEN expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' THEN 1 END) as expiring_30_days,
                COUNT(CASE WHEN expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days' THEN 1 END) as expiring_90_days,
                COUNT(CASE WHEN status = 'low' THEN 1 END) as low_stock_count
             FROM pantry_items
             WHERE user_id = $1 AND status != 'consumed'`,
            [req.user.userId]
        );

        // Get days of supply
        const supplyResult = await db.query(
            `SELECT * FROM v_days_of_supply WHERE user_id = $1`,
            [req.user.userId]
        );

        // Get category breakdown
        const categoryBreakdown = await db.query(
            `SELECT * FROM v_pantry_by_category WHERE user_id = $1 ORDER BY total_calories DESC`,
            [req.user.userId]
        );

        res.json({
            stats: stats.rows[0],
            days_of_supply: supplyResult.rows[0] || null,
            by_category: categoryBreakdown.rows
        });
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// ============================================
// FOOD DATABASE SEARCH
// ============================================

router.get('/food-database', [
    query('search').optional().trim(),
    query('category').optional().trim(),
    query('barcode').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    const { search, category, barcode, limit = 50 } = req.query;

    try {
        let queryStr = 'SELECT * FROM food_database WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (barcode) {
            paramCount++;
            queryStr += ` AND (barcode = $${paramCount} OR upc = $${paramCount})`;
            params.push(barcode);
        }

        if (search) {
            paramCount++;
            queryStr += ` AND (name ILIKE $${paramCount} OR brand ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (category) {
            paramCount++;
            queryStr += ` AND category = $${paramCount}`;
            params.push(category);
        }

        paramCount++;
        queryStr += ` ORDER BY name LIMIT $${paramCount}`;
        params.push(limit);

        const result = await db.query(queryStr, params);
        res.json({ foods: result.rows });
    } catch (error) {
        console.error('Food database search error:', error);
        res.status(500).json({ error: 'Failed to search food database' });
    }
});

// Get pantry categories
router.get('/categories', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM pantry_categories ORDER BY sort_order, name'
        );
        res.json({ categories: result.rows });
    } catch (error) {
        console.error('Categories fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Get expiring items
router.get('/expiring', async (req, res) => {
    const days = parseInt(req.query.days) || 30;

    try {
        const result = await db.query(
            `SELECT * FROM v_expiring_items
             WHERE user_id = $1 AND days_until_expiry <= $2
             ORDER BY days_until_expiry ASC`,
            [req.user.userId, days]
        );
        res.json({ items: result.rows });
    } catch (error) {
        console.error('Expiring items fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch expiring items' });
    }
});

// Get transaction history
router.get('/transactions', [
    query('pantry_item_id').optional().isInt(),
    query('family_profile_id').optional().isInt(),
    query('transaction_type').optional().isIn(['add', 'consume', 'adjust', 'expire', 'waste', 'donate']),
    query('start_date').optional().isISO8601(),
    query('end_date').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 500 })
], async (req, res) => {
    const { pantry_item_id, family_profile_id, transaction_type, start_date, end_date, limit = 100 } = req.query;

    try {
        let queryStr = `
            SELECT pt.*, pi.name as item_name, fp.name as family_member_name
            FROM pantry_transactions pt
            LEFT JOIN pantry_items pi ON pt.pantry_item_id = pi.id
            LEFT JOIN family_profiles fp ON pt.family_profile_id = fp.id
            WHERE pt.user_id = $1
        `;
        const params = [req.user.userId];
        let paramCount = 1;

        if (pantry_item_id) {
            paramCount++;
            queryStr += ` AND pt.pantry_item_id = $${paramCount}`;
            params.push(pantry_item_id);
        }

        if (family_profile_id) {
            paramCount++;
            queryStr += ` AND pt.family_profile_id = $${paramCount}`;
            params.push(family_profile_id);
        }

        if (transaction_type) {
            paramCount++;
            queryStr += ` AND pt.transaction_type = $${paramCount}`;
            params.push(transaction_type);
        }

        if (start_date) {
            paramCount++;
            queryStr += ` AND pt.created_at >= $${paramCount}`;
            params.push(start_date);
        }

        if (end_date) {
            paramCount++;
            queryStr += ` AND pt.created_at <= $${paramCount}`;
            params.push(end_date);
        }

        paramCount++;
        queryStr += ` ORDER BY pt.created_at DESC LIMIT $${paramCount}`;
        params.push(limit);

        const result = await db.query(queryStr, params);
        res.json({ transactions: result.rows });
    } catch (error) {
        console.error('Transactions fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

module.exports = router;

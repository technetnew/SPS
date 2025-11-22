/**
 * SPS Garden & Production Module Routes
 * Complete garden management with plant guides, logbooks,
 * environmental data, and production tracking
 */

const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(authenticateToken);

// File upload for CSV imports
const upload = multer({
    dest: '/tmp/garden-imports/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// =====================================================
// GARDENS CRUD
// =====================================================

// Get all gardens for user
router.get('/gardens', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT g.*,
                   COUNT(DISTINCT gp.id) as plant_count,
                   COUNT(DISTINCT gb.id) as bed_count,
                   COALESCE(SUM(gh.weight_grams), 0) as total_harvest_grams
            FROM gardens g
            LEFT JOIN garden_plants gp ON g.id = gp.garden_id
            LEFT JOIN garden_beds gb ON g.id = gb.garden_id
            LEFT JOIN garden_harvests gh ON gp.id = gh.garden_plant_id
            WHERE g.user_id = $1
            GROUP BY g.id
            ORDER BY g.name
        `, [req.user.userId]);

        res.json({ success: true, gardens: result.rows });
    } catch (error) {
        console.error('Get gardens error:', error);
        res.status(500).json({ error: 'Failed to fetch gardens' });
    }
});

// Get single garden with details
router.get('/gardens/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM gardens WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Garden not found' });
        }

        // Get beds
        const beds = await db.query(
            'SELECT * FROM garden_beds WHERE garden_id = $1 ORDER BY name',
            [req.params.id]
        );

        // Get plants
        const plants = await db.query(`
            SELECT gp.*, pg.common_name as guide_name, pg.latin_name
            FROM garden_plants gp
            LEFT JOIN plant_guides pg ON gp.plant_guide_id = pg.id
            WHERE gp.garden_id = $1
            ORDER BY gp.planting_date DESC
        `, [req.params.id]);

        // Get recent logs
        const logs = await db.query(`
            SELECT gl.*, gp.plant_name
            FROM garden_logs gl
            LEFT JOIN garden_plants gp ON gl.garden_plant_id = gp.id
            WHERE gl.garden_id = $1
            ORDER BY gl.entry_date DESC, gl.entry_time DESC
            LIMIT 50
        `, [req.params.id]);

        res.json({
            success: true,
            garden: result.rows[0],
            beds: beds.rows,
            plants: plants.rows,
            logs: logs.rows
        });
    } catch (error) {
        console.error('Get garden error:', error);
        res.status(500).json({ error: 'Failed to fetch garden' });
    }
});

// Create garden
router.post('/gardens', async (req, res) => {
    try {
        const {
            name, description, location_description,
            total_area_sqft, usda_zone, last_frost_date, first_frost_date,
            garden_type, is_covered, irrigation_type, hemisphere, notes
        } = req.body;

        const sqm = total_area_sqft ? total_area_sqft * 0.0929 : null;

        const result = await db.query(`
            INSERT INTO gardens (
                user_id, name, description, location_description,
                total_area_sqft, total_area_sqm, usda_zone,
                last_frost_date, first_frost_date,
                garden_type, is_covered, irrigation_type, hemisphere, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `, [
            req.user.userId, name, description, location_description,
            total_area_sqft, sqm, usda_zone,
            last_frost_date, first_frost_date,
            garden_type, is_covered, irrigation_type, hemisphere || 'northern', notes
        ]);

        res.json({ success: true, garden: result.rows[0] });
    } catch (error) {
        console.error('Create garden error:', error);
        res.status(500).json({ error: 'Failed to create garden' });
    }
});

// Update garden
router.put('/gardens/:id', async (req, res) => {
    try {
        const {
            name, description, location_description,
            total_area_sqft, usda_zone, last_frost_date, first_frost_date,
            garden_type, is_covered, irrigation_type, hemisphere, status, notes
        } = req.body;

        const sqm = total_area_sqft ? total_area_sqft * 0.0929 : null;

        const result = await db.query(`
            UPDATE gardens SET
                name = COALESCE($3, name),
                description = $4,
                location_description = $5,
                total_area_sqft = $6,
                total_area_sqm = $7,
                usda_zone = $8,
                last_frost_date = $9,
                first_frost_date = $10,
                garden_type = $11,
                is_covered = $12,
                irrigation_type = $13,
                hemisphere = $14,
                status = COALESCE($15, status),
                notes = $16
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `, [
            req.params.id, req.user.userId, name, description, location_description,
            total_area_sqft, sqm, usda_zone, last_frost_date, first_frost_date,
            garden_type, is_covered, irrigation_type, hemisphere, status, notes
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Garden not found' });
        }

        res.json({ success: true, garden: result.rows[0] });
    } catch (error) {
        console.error('Update garden error:', error);
        res.status(500).json({ error: 'Failed to update garden' });
    }
});

// Delete garden
router.delete('/gardens/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM gardens WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Garden not found' });
        }

        res.json({ success: true, message: 'Garden deleted' });
    } catch (error) {
        console.error('Delete garden error:', error);
        res.status(500).json({ error: 'Failed to delete garden' });
    }
});

// =====================================================
// GARDEN BEDS CRUD
// =====================================================

// Get beds for a garden
router.get('/gardens/:gardenId/beds', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT gb.*,
                   COUNT(gp.id) as plant_count
            FROM garden_beds gb
            LEFT JOIN garden_plants gp ON gb.id = gp.garden_bed_id
            WHERE gb.garden_id = $1 AND gb.user_id = $2
            GROUP BY gb.id
            ORDER BY gb.name
        `, [req.params.gardenId, req.user.userId]);

        res.json({ success: true, beds: result.rows });
    } catch (error) {
        console.error('Get beds error:', error);
        res.status(500).json({ error: 'Failed to fetch beds' });
    }
});

// Create bed
router.post('/gardens/:gardenId/beds', async (req, res) => {
    try {
        const { name, bed_type, length_ft, width_ft, position_x, position_y, soil_type, notes } = req.body;
        const area = length_ft && width_ft ? length_ft * width_ft : null;

        const result = await db.query(`
            INSERT INTO garden_beds (
                garden_id, user_id, name, bed_type,
                length_ft, width_ft, area_sqft,
                position_x, position_y, soil_type, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            req.params.gardenId, req.user.userId, name, bed_type,
            length_ft, width_ft, area, position_x, position_y, soil_type, notes
        ]);

        res.json({ success: true, bed: result.rows[0] });
    } catch (error) {
        console.error('Create bed error:', error);
        res.status(500).json({ error: 'Failed to create bed' });
    }
});

// Update bed
router.put('/beds/:id', async (req, res) => {
    try {
        const { name, bed_type, length_ft, width_ft, position_x, position_y, soil_type, soil_amendments, notes } = req.body;
        const area = length_ft && width_ft ? length_ft * width_ft : null;

        const result = await db.query(`
            UPDATE garden_beds SET
                name = COALESCE($3, name),
                bed_type = $4,
                length_ft = $5,
                width_ft = $6,
                area_sqft = $7,
                position_x = $8,
                position_y = $9,
                soil_type = $10,
                soil_amendments = $11,
                notes = $12
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `, [req.params.id, req.user.userId, name, bed_type, length_ft, width_ft, area, position_x, position_y, soil_type, soil_amendments, notes]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bed not found' });
        }

        res.json({ success: true, bed: result.rows[0] });
    } catch (error) {
        console.error('Update bed error:', error);
        res.status(500).json({ error: 'Failed to update bed' });
    }
});

// Delete bed
router.delete('/beds/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM garden_beds WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bed not found' });
        }

        res.json({ success: true, message: 'Bed deleted' });
    } catch (error) {
        console.error('Delete bed error:', error);
        res.status(500).json({ error: 'Failed to delete bed' });
    }
});

// =====================================================
// PLANT GUIDES
// =====================================================

// Get all plant guides (builtin + user)
router.get('/plant-guides', async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = `
            SELECT * FROM plant_guides
            WHERE (user_id IS NULL OR user_id = $1)
        `;
        const params = [req.user.userId];
        let paramIndex = 2;

        if (category) {
            query += ` AND category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (search) {
            query += ` AND (common_name ILIKE $${paramIndex} OR latin_name ILIKE $${paramIndex} OR variety_name ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ' ORDER BY source_type DESC, common_name';

        const result = await db.query(query, params);
        res.json({ success: true, guides: result.rows });
    } catch (error) {
        console.error('Get plant guides error:', error);
        res.status(500).json({ error: 'Failed to fetch plant guides' });
    }
});

// Get single plant guide
router.get('/plant-guides/:id', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM plant_guides WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plant guide not found' });
        }

        res.json({ success: true, guide: result.rows[0] });
    } catch (error) {
        console.error('Get plant guide error:', error);
        res.status(500).json({ error: 'Failed to fetch plant guide' });
    }
});

// Create plant guide (user custom)
router.post('/plant-guides', async (req, res) => {
    try {
        const fields = Object.keys(req.body).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
        const values = fields.map(f => req.body[f]);

        const result = await db.query(`
            INSERT INTO plant_guides (user_id, source_type, ${fields.join(', ')})
            VALUES ($1, 'user', ${fields.map((_, i) => `$${i + 2}`).join(', ')})
            RETURNING *
        `, [req.user.userId, ...values]);

        res.json({ success: true, guide: result.rows[0] });
    } catch (error) {
        console.error('Create plant guide error:', error);
        res.status(500).json({ error: 'Failed to create plant guide' });
    }
});

// Clone builtin guide to user
router.post('/plant-guides/:id/clone', async (req, res) => {
    try {
        const original = await db.query(
            'SELECT * FROM plant_guides WHERE id = $1',
            [req.params.id]
        );

        if (original.rows.length === 0) {
            return res.status(404).json({ error: 'Plant guide not found' });
        }

        const guide = original.rows[0];
        delete guide.id;
        delete guide.created_at;
        delete guide.updated_at;
        guide.user_id = req.user.userId;
        guide.source_type = 'user';

        const fields = Object.keys(guide).filter(k => guide[k] !== null);
        const values = fields.map(f => guide[f]);

        const result = await db.query(`
            INSERT INTO plant_guides (${fields.join(', ')})
            VALUES (${fields.map((_, i) => `$${i + 1}`).join(', ')})
            RETURNING *
        `, values);

        res.json({ success: true, guide: result.rows[0] });
    } catch (error) {
        console.error('Clone plant guide error:', error);
        res.status(500).json({ error: 'Failed to clone plant guide' });
    }
});

// Update plant guide (user only)
router.put('/plant-guides/:id', async (req, res) => {
    try {
        // Check ownership
        const check = await db.query(
            'SELECT user_id FROM plant_guides WHERE id = $1',
            [req.params.id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Plant guide not found' });
        }

        if (check.rows[0].user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Cannot modify builtin guide. Clone it first.' });
        }

        const fields = Object.keys(req.body).filter(k =>
            k !== 'id' && k !== 'user_id' && k !== 'source_type' && k !== 'created_at' && k !== 'updated_at'
        );
        const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
        const values = fields.map(f => req.body[f]);

        const result = await db.query(`
            UPDATE plant_guides SET ${sets}
            WHERE id = $1
            RETURNING *
        `, [req.params.id, ...values]);

        res.json({ success: true, guide: result.rows[0] });
    } catch (error) {
        console.error('Update plant guide error:', error);
        res.status(500).json({ error: 'Failed to update plant guide' });
    }
});

// Delete plant guide (user only)
router.delete('/plant-guides/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM plant_guides WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plant guide not found or cannot delete builtin' });
        }

        res.json({ success: true, message: 'Plant guide deleted' });
    } catch (error) {
        console.error('Delete plant guide error:', error);
        res.status(500).json({ error: 'Failed to delete plant guide' });
    }
});

// =====================================================
// GARDEN PLANTS (Plantings)
// =====================================================

// Get plants for a garden
router.get('/gardens/:gardenId/plants', async (req, res) => {
    try {
        const { status, bed_id } = req.query;
        let query = `
            SELECT gp.*,
                   pg.common_name as guide_name, pg.latin_name,
                   pg.days_to_maturity_min, pg.days_to_maturity_max,
                   pg.harvest_indicators, pg.default_yield_per_sqft_grams,
                   gb.name as bed_name,
                   g.name as garden_name
            FROM garden_plants gp
            LEFT JOIN plant_guides pg ON gp.plant_guide_id = pg.id
            LEFT JOIN garden_beds gb ON gp.garden_bed_id = gb.id
            LEFT JOIN gardens g ON gp.garden_id = g.id
            WHERE gp.garden_id = $1 AND gp.user_id = $2
        `;
        const params = [req.params.gardenId, req.user.userId];
        let paramIndex = 3;

        if (status) {
            query += ` AND gp.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (bed_id) {
            query += ` AND gp.garden_bed_id = $${paramIndex}`;
            params.push(bed_id);
            paramIndex++;
        }

        query += ' ORDER BY gp.planting_date DESC';

        const result = await db.query(query, params);
        res.json({ success: true, plants: result.rows });
    } catch (error) {
        console.error('Get plants error:', error);
        res.status(500).json({ error: 'Failed to fetch plants' });
    }
});

// Get all plants for user (across all gardens)
router.get('/plants', async (req, res) => {
    try {
        const { status, garden_id } = req.query;
        let query = `
            SELECT gp.*,
                   pg.common_name as guide_name, pg.latin_name,
                   gb.name as bed_name,
                   g.name as garden_name
            FROM garden_plants gp
            LEFT JOIN plant_guides pg ON gp.plant_guide_id = pg.id
            LEFT JOIN garden_beds gb ON gp.garden_bed_id = gb.id
            LEFT JOIN gardens g ON gp.garden_id = g.id
            WHERE gp.user_id = $1
        `;
        const params = [req.user.userId];
        let paramIndex = 2;

        if (status) {
            query += ` AND gp.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (garden_id) {
            query += ` AND gp.garden_id = $${paramIndex}`;
            params.push(garden_id);
            paramIndex++;
        }

        query += ' ORDER BY gp.planting_date DESC';

        const result = await db.query(query, params);
        res.json({ success: true, plants: result.rows });
    } catch (error) {
        console.error('Get all plants error:', error);
        res.status(500).json({ error: 'Failed to fetch plants' });
    }
});

// Get single plant with logs and harvests
router.get('/plants/:id', async (req, res) => {
    try {
        const plant = await db.query(`
            SELECT gp.*,
                   pg.*, pg.id as guide_id,
                   gb.name as bed_name,
                   g.name as garden_name, g.hemisphere
            FROM garden_plants gp
            LEFT JOIN plant_guides pg ON gp.plant_guide_id = pg.id
            LEFT JOIN garden_beds gb ON gp.garden_bed_id = gb.id
            LEFT JOIN gardens g ON gp.garden_id = g.id
            WHERE gp.id = $1 AND gp.user_id = $2
        `, [req.params.id, req.user.userId]);

        if (plant.rows.length === 0) {
            return res.status(404).json({ error: 'Plant not found' });
        }

        // Get logs
        const logs = await db.query(`
            SELECT * FROM garden_logs
            WHERE garden_plant_id = $1
            ORDER BY entry_date DESC, entry_time DESC
        `, [req.params.id]);

        // Get harvests
        const harvests = await db.query(`
            SELECT * FROM garden_harvests
            WHERE garden_plant_id = $1
            ORDER BY harvest_date DESC
        `, [req.params.id]);

        res.json({
            success: true,
            plant: plant.rows[0],
            logs: logs.rows,
            harvests: harvests.rows
        });
    } catch (error) {
        console.error('Get plant error:', error);
        res.status(500).json({ error: 'Failed to fetch plant' });
    }
});

// Create plant
router.post('/plants', async (req, res) => {
    try {
        const {
            garden_id, garden_bed_id, plant_guide_id,
            plant_name, variety, quantity, area_sqft, row_label,
            seed_start_date, transplant_date, direct_sow_date, planting_date,
            planting_method, seed_source, is_organic, is_heirloom,
            soil_temp_at_planting_c, air_temp_at_planting_c, conditions_at_planting,
            row_cover, mulched, mulch_type, notes
        } = req.body;

        // Calculate expected harvest date if we have guide info
        let expected_harvest = null;
        if (plant_guide_id && planting_date) {
            const guide = await db.query(
                'SELECT days_to_maturity_min, days_to_maturity_max, default_yield_per_sqft_grams FROM plant_guides WHERE id = $1',
                [plant_guide_id]
            );
            if (guide.rows.length > 0 && guide.rows[0].days_to_maturity_max) {
                const avgDays = Math.round((guide.rows[0].days_to_maturity_min + guide.rows[0].days_to_maturity_max) / 2);
                const plantDate = new Date(planting_date);
                plantDate.setDate(plantDate.getDate() + avgDays);
                expected_harvest = plantDate.toISOString().split('T')[0];
            }
        }

        // Calculate expected yield
        let expected_yield = null;
        if (plant_guide_id && area_sqft) {
            const guide = await db.query(
                'SELECT default_yield_per_sqft_grams FROM plant_guides WHERE id = $1',
                [plant_guide_id]
            );
            if (guide.rows.length > 0 && guide.rows[0].default_yield_per_sqft_grams) {
                expected_yield = area_sqft * guide.rows[0].default_yield_per_sqft_grams;
            }
        }

        const result = await db.query(`
            INSERT INTO garden_plants (
                user_id, garden_id, garden_bed_id, plant_guide_id,
                plant_name, variety, quantity, area_sqft, row_label,
                seed_start_date, transplant_date, direct_sow_date, planting_date,
                expected_harvest_date, expected_yield_grams,
                planting_method, seed_source, is_organic, is_heirloom,
                soil_temp_at_planting_c, air_temp_at_planting_c, conditions_at_planting,
                row_cover, mulched, mulch_type, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
            RETURNING *
        `, [
            req.user.userId, garden_id, garden_bed_id, plant_guide_id,
            plant_name, variety, quantity, area_sqft, row_label,
            seed_start_date, transplant_date, direct_sow_date, planting_date,
            expected_harvest, expected_yield,
            planting_method, seed_source, is_organic, is_heirloom,
            soil_temp_at_planting_c, air_temp_at_planting_c, conditions_at_planting,
            row_cover, mulched, mulch_type, notes
        ]);

        res.json({ success: true, plant: result.rows[0] });
    } catch (error) {
        console.error('Create plant error:', error);
        res.status(500).json({ error: 'Failed to create plant' });
    }
});

// Update plant
router.put('/plants/:id', async (req, res) => {
    try {
        const fields = Object.keys(req.body).filter(k =>
            k !== 'id' && k !== 'user_id' && k !== 'created_at' && k !== 'updated_at'
        );
        const sets = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
        const values = fields.map(f => req.body[f]);

        const result = await db.query(`
            UPDATE garden_plants SET ${sets}
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `, [req.params.id, req.user.userId, ...values]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plant not found' });
        }

        res.json({ success: true, plant: result.rows[0] });
    } catch (error) {
        console.error('Update plant error:', error);
        res.status(500).json({ error: 'Failed to update plant' });
    }
});

// Delete plant
router.delete('/plants/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM garden_plants WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Plant not found' });
        }

        res.json({ success: true, message: 'Plant deleted' });
    } catch (error) {
        console.error('Delete plant error:', error);
        res.status(500).json({ error: 'Failed to delete plant' });
    }
});

// =====================================================
// GARDEN LOGS (Logbook)
// =====================================================

// Get logs with filters
router.get('/logs', async (req, res) => {
    try {
        const { garden_id, plant_id, bed_id, action_type, start_date, end_date, limit = 100 } = req.query;

        let query = `
            SELECT gl.*,
                   gp.plant_name, gp.variety,
                   g.name as garden_name,
                   gb.name as bed_name
            FROM garden_logs gl
            LEFT JOIN garden_plants gp ON gl.garden_plant_id = gp.id
            LEFT JOIN gardens g ON gl.garden_id = g.id
            LEFT JOIN garden_beds gb ON gl.garden_bed_id = gb.id
            WHERE gl.user_id = $1
        `;
        const params = [req.user.userId];
        let paramIndex = 2;

        if (garden_id) {
            query += ` AND gl.garden_id = $${paramIndex}`;
            params.push(garden_id);
            paramIndex++;
        }

        if (plant_id) {
            query += ` AND gl.garden_plant_id = $${paramIndex}`;
            params.push(plant_id);
            paramIndex++;
        }

        if (bed_id) {
            query += ` AND gl.garden_bed_id = $${paramIndex}`;
            params.push(bed_id);
            paramIndex++;
        }

        if (action_type) {
            query += ` AND gl.action_type = $${paramIndex}`;
            params.push(action_type);
            paramIndex++;
        }

        if (start_date) {
            query += ` AND gl.entry_date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND gl.entry_date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        query += ` ORDER BY gl.entry_date DESC, gl.entry_time DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);
        res.json({ success: true, logs: result.rows });
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Create log entry
router.post('/logs', async (req, res) => {
    try {
        const {
            garden_id, garden_plant_id, garden_bed_id, plant_guide_id,
            entry_date, entry_time, season,
            weather_summary, temperature_c, temperature_max_c, temperature_min_c,
            soil_temperature_c, humidity_percent, rain_mm, wind_notes, sky_conditions,
            action_type, action_details,
            water_amount_liters, fertilizer_type, fertilizer_amount,
            pest_identified, disease_identified, treatment_applied,
            photo_reference, device_source, notes
        } = req.body;

        // Calculate GDD if we have temps
        let gdd = null;
        if (temperature_max_c && temperature_min_c) {
            // Default base temp 10C, could lookup from plant_guide
            gdd = Math.max(0, ((temperature_max_c + temperature_min_c) / 2) - 10);
        }

        const result = await db.query(`
            INSERT INTO garden_logs (
                user_id, garden_id, garden_plant_id, garden_bed_id, plant_guide_id,
                entry_date, entry_time, season,
                weather_summary, temperature_c, temperature_max_c, temperature_min_c,
                soil_temperature_c, humidity_percent, rain_mm, wind_notes, sky_conditions,
                action_type, action_details,
                water_amount_liters, fertilizer_type, fertilizer_amount,
                pest_identified, disease_identified, treatment_applied,
                photo_reference, device_source, gdd_calculated, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
            RETURNING *
        `, [
            req.user.userId, garden_id, garden_plant_id, garden_bed_id, plant_guide_id,
            entry_date || new Date().toISOString().split('T')[0], entry_time, season,
            weather_summary, temperature_c, temperature_max_c, temperature_min_c,
            soil_temperature_c, humidity_percent, rain_mm, wind_notes, sky_conditions,
            action_type, action_details,
            water_amount_liters, fertilizer_type, fertilizer_amount,
            pest_identified, disease_identified, treatment_applied,
            photo_reference, device_source || 'manual', gdd, notes
        ]);

        // Update plant status if appropriate
        if (garden_plant_id && action_type) {
            const statusMap = {
                'germination': 'growing',
                'flowering': 'flowering',
                'fruiting': 'fruiting',
                'harvested': 'harvested'
            };
            if (statusMap[action_type]) {
                await db.query(
                    'UPDATE garden_plants SET status = $1 WHERE id = $2',
                    [statusMap[action_type], garden_plant_id]
                );

                // Update milestone dates
                if (action_type === 'germination') {
                    await db.query('UPDATE garden_plants SET germination_date = $1 WHERE id = $2', [entry_date, garden_plant_id]);
                } else if (action_type === 'flowering') {
                    await db.query('UPDATE garden_plants SET first_flower_date = $1 WHERE id = $2', [entry_date, garden_plant_id]);
                } else if (action_type === 'fruiting') {
                    await db.query('UPDATE garden_plants SET first_fruit_date = $1 WHERE id = $2', [entry_date, garden_plant_id]);
                }
            }
        }

        res.json({ success: true, log: result.rows[0] });
    } catch (error) {
        console.error('Create log error:', error);
        res.status(500).json({ error: 'Failed to create log entry' });
    }
});

// Update log
router.put('/logs/:id', async (req, res) => {
    try {
        const fields = Object.keys(req.body).filter(k =>
            k !== 'id' && k !== 'user_id' && k !== 'created_at' && k !== 'updated_at'
        );
        const sets = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
        const values = fields.map(f => req.body[f]);

        const result = await db.query(`
            UPDATE garden_logs SET ${sets}
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `, [req.params.id, req.user.userId, ...values]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Log not found' });
        }

        res.json({ success: true, log: result.rows[0] });
    } catch (error) {
        console.error('Update log error:', error);
        res.status(500).json({ error: 'Failed to update log' });
    }
});

// Delete log
router.delete('/logs/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM garden_logs WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Log not found' });
        }

        res.json({ success: true, message: 'Log deleted' });
    } catch (error) {
        console.error('Delete log error:', error);
        res.status(500).json({ error: 'Failed to delete log' });
    }
});

// =====================================================
// HARVESTS
// =====================================================

// Get harvests
router.get('/harvests', async (req, res) => {
    try {
        const { garden_id, plant_id, start_date, end_date, limit = 100 } = req.query;

        let query = `
            SELECT gh.*,
                   gp.plant_name, gp.variety,
                   g.name as garden_name,
                   pg.default_calories_per_100g
            FROM garden_harvests gh
            LEFT JOIN garden_plants gp ON gh.garden_plant_id = gp.id
            LEFT JOIN gardens g ON gh.garden_id = g.id
            LEFT JOIN plant_guides pg ON gh.plant_guide_id = pg.id
            WHERE gh.user_id = $1
        `;
        const params = [req.user.userId];
        let paramIndex = 2;

        if (garden_id) {
            query += ` AND gh.garden_id = $${paramIndex}`;
            params.push(garden_id);
            paramIndex++;
        }

        if (plant_id) {
            query += ` AND gh.garden_plant_id = $${paramIndex}`;
            params.push(plant_id);
            paramIndex++;
        }

        if (start_date) {
            query += ` AND gh.harvest_date >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND gh.harvest_date <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        query += ` ORDER BY gh.harvest_date DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);
        res.json({ success: true, harvests: result.rows });
    } catch (error) {
        console.error('Get harvests error:', error);
        res.status(500).json({ error: 'Failed to fetch harvests' });
    }
});

// Create harvest
router.post('/harvests', async (req, res) => {
    try {
        const {
            garden_plant_id, garden_id, plant_guide_id,
            harvest_date, harvest_time, weight_grams, count, unit,
            quality_rating, quality_notes, destination, storage_location,
            notes
        } = req.body;

        // Calculate calories if we have weight and guide info
        let calories = null;
        if (weight_grams && plant_guide_id) {
            const guide = await db.query(
                'SELECT default_calories_per_100g FROM plant_guides WHERE id = $1',
                [plant_guide_id]
            );
            if (guide.rows.length > 0 && guide.rows[0].default_calories_per_100g) {
                calories = Math.round((weight_grams / 100) * guide.rows[0].default_calories_per_100g);
            }
        }

        const result = await db.query(`
            INSERT INTO garden_harvests (
                user_id, garden_plant_id, garden_id, plant_guide_id,
                harvest_date, harvest_time, weight_grams, count, unit,
                quality_rating, quality_notes, destination, storage_location,
                calories_total, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            req.user.userId, garden_plant_id, garden_id, plant_guide_id,
            harvest_date || new Date().toISOString().split('T')[0], harvest_time,
            weight_grams, count, unit,
            quality_rating, quality_notes, destination, storage_location,
            calories, notes
        ]);

        // Update plant actual harvest date if not set
        if (garden_plant_id) {
            await db.query(`
                UPDATE garden_plants
                SET actual_harvest_date = COALESCE(actual_harvest_date, $1),
                    status = 'harvested'
                WHERE id = $2
            `, [harvest_date, garden_plant_id]);
        }

        res.json({ success: true, harvest: result.rows[0] });
    } catch (error) {
        console.error('Create harvest error:', error);
        res.status(500).json({ error: 'Failed to create harvest' });
    }
});

// Get single harvest
router.get('/harvests/:id', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT gh.*, gp.plant_name, gp.variety, g.name as garden_name
            FROM garden_harvests gh
            LEFT JOIN garden_plants gp ON gh.garden_plant_id = gp.id
            LEFT JOIN gardens g ON gh.garden_id = g.id
            WHERE gh.id = $1 AND gh.user_id = $2
        `, [req.params.id, req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Harvest not found' });
        }

        res.json({ success: true, harvest: result.rows[0] });
    } catch (error) {
        console.error('Get harvest error:', error);
        res.status(500).json({ error: 'Failed to fetch harvest' });
    }
});

// Update harvest
router.put('/harvests/:id', async (req, res) => {
    try {
        const {
            garden_plant_id, garden_id, plant_guide_id,
            harvest_date, harvest_time, weight_grams, count, unit,
            quality_rating, quality_notes, destination, storage_location,
            notes
        } = req.body;

        // Calculate calories if we have weight and guide info
        let calories = null;
        if (weight_grams && plant_guide_id) {
            const guide = await db.query(
                'SELECT default_calories_per_100g FROM plant_guides WHERE id = $1',
                [plant_guide_id]
            );
            if (guide.rows.length > 0 && guide.rows[0].default_calories_per_100g) {
                calories = Math.round((weight_grams / 100) * guide.rows[0].default_calories_per_100g);
            }
        }

        const result = await db.query(`
            UPDATE garden_harvests SET
                garden_plant_id = $1, garden_id = $2, plant_guide_id = $3,
                harvest_date = $4, harvest_time = $5, weight_grams = $6, count = $7, unit = $8,
                quality_rating = $9, quality_notes = $10, destination = $11, storage_location = $12,
                calories_total = $13, notes = $14, updated_at = NOW()
            WHERE id = $15 AND user_id = $16
            RETURNING *
        `, [
            garden_plant_id, garden_id, plant_guide_id,
            harvest_date, harvest_time, weight_grams, count, unit,
            quality_rating, quality_notes, destination, storage_location,
            calories, notes, req.params.id, req.user.userId
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Harvest not found' });
        }

        res.json({ success: true, harvest: result.rows[0] });
    } catch (error) {
        console.error('Update harvest error:', error);
        res.status(500).json({ error: 'Failed to update harvest' });
    }
});

// Delete harvest
router.delete('/harvests/:id', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM garden_harvests WHERE id = $1 AND user_id = $2 RETURNING *',
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Harvest not found' });
        }

        res.json({ success: true, message: 'Harvest deleted' });
    } catch (error) {
        console.error('Delete harvest error:', error);
        res.status(500).json({ error: 'Failed to delete harvest' });
    }
});

// =====================================================
// ENVIRONMENT DATA IMPORT
// =====================================================

// Import environment data from CSV
router.post('/environment/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { garden_id, garden_bed_id } = req.body;

        // Read and parse CSV
        const content = fs.readFileSync(req.file.path, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());

        if (lines.length < 2) {
            return res.status(400).json({ error: 'CSV must have header and at least one data row' });
        }

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const imported = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};

            headers.forEach((h, idx) => {
                row[h] = values[idx] || null;
            });

            // Map common CSV field names
            const timestamp = row.timestamp || row.datetime || row.date || new Date().toISOString();
            const temp = parseFloat(row.temperature) || parseFloat(row.temp) || parseFloat(row.temperature_c) || null;
            const humidity = parseFloat(row.humidity) || parseFloat(row.humidity_percent) || null;
            const rain = parseFloat(row.rainfall) || parseFloat(row.rain) || parseFloat(row.rain_mm) || null;
            const soilTemp = parseFloat(row.soil_temp) || parseFloat(row.soil_temperature) || null;

            if (timestamp) {
                const result = await db.query(`
                    INSERT INTO garden_environment (
                        user_id, garden_id, garden_bed_id,
                        reading_timestamp, temperature_c, humidity_percent,
                        rainfall_mm, soil_temperature_c, device_source
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'csv_import')
                    RETURNING id
                `, [
                    req.user.userId, garden_id, garden_bed_id,
                    timestamp, temp, humidity, rain, soilTemp
                ]);
                imported.push(result.rows[0].id);
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ success: true, imported_count: imported.length });
    } catch (error) {
        console.error('Import environment error:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to import environment data' });
    }
});

// Get environment data
router.get('/environment', async (req, res) => {
    try {
        const { garden_id, start_date, end_date, limit = 500 } = req.query;

        let query = `
            SELECT ge.*, g.name as garden_name
            FROM garden_environment ge
            LEFT JOIN gardens g ON ge.garden_id = g.id
            WHERE ge.user_id = $1
        `;
        const params = [req.user.userId];
        let paramIndex = 2;

        if (garden_id) {
            query += ` AND ge.garden_id = $${paramIndex}`;
            params.push(garden_id);
            paramIndex++;
        }

        if (start_date) {
            query += ` AND ge.reading_timestamp >= $${paramIndex}`;
            params.push(start_date);
            paramIndex++;
        }

        if (end_date) {
            query += ` AND ge.reading_timestamp <= $${paramIndex}`;
            params.push(end_date);
            paramIndex++;
        }

        query += ` ORDER BY ge.reading_timestamp DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit));

        const result = await db.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get environment error:', error);
        res.status(500).json({ error: 'Failed to fetch environment data' });
    }
});

// Add manual environment reading
router.post('/environment', async (req, res) => {
    try {
        const {
            garden_id, garden_bed_id, reading_timestamp,
            temperature_c, temperature_max_c, temperature_min_c,
            soil_temperature_c, humidity_percent, rainfall_mm,
            light_hours, wind_speed_kmh, wind_direction, notes
        } = req.body;

        const result = await db.query(`
            INSERT INTO garden_environment (
                user_id, garden_id, garden_bed_id, reading_timestamp,
                temperature_c, temperature_max_c, temperature_min_c,
                soil_temperature_c, humidity_percent, rainfall_mm,
                light_hours, wind_speed_kmh, wind_direction,
                device_source, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'manual', $14)
            RETURNING *
        `, [
            req.user.userId, garden_id, garden_bed_id,
            reading_timestamp || new Date().toISOString(),
            temperature_c, temperature_max_c, temperature_min_c,
            soil_temperature_c, humidity_percent, rainfall_mm,
            light_hours, wind_speed_kmh, wind_direction, notes
        ]);

        res.json({ success: true, reading: result.rows[0] });
    } catch (error) {
        console.error('Create environment error:', error);
        res.status(500).json({ error: 'Failed to create environment reading' });
    }
});

// =====================================================
// STATISTICS AND CALCULATIONS
// =====================================================

// Get GDD for a plant
router.get('/plants/:id/gdd', async (req, res) => {
    try {
        // Get plant and its base temp
        const plant = await db.query(`
            SELECT gp.*, pg.base_temp_gdd_c
            FROM garden_plants gp
            LEFT JOIN plant_guides pg ON gp.plant_guide_id = pg.id
            WHERE gp.id = $1 AND gp.user_id = $2
        `, [req.params.id, req.user.userId]);

        if (plant.rows.length === 0) {
            return res.status(404).json({ error: 'Plant not found' });
        }

        const baseTemp = plant.rows[0].base_temp_gdd_c || 10;

        // Sum GDD from logs
        const gdd = await db.query(`
            SELECT COALESCE(SUM(
                GREATEST(0, ((COALESCE(temperature_max_c, 0) + COALESCE(temperature_min_c, 0)) / 2) - $2)
            ), 0) as total_gdd
            FROM garden_logs
            WHERE garden_plant_id = $1
            AND temperature_max_c IS NOT NULL
            AND temperature_min_c IS NOT NULL
        `, [req.params.id, baseTemp]);

        res.json({
            success: true,
            plant_id: req.params.id,
            base_temp_c: baseTemp,
            accumulated_gdd: Math.round(parseFloat(gdd.rows[0].total_gdd) * 10) / 10
        });
    } catch (error) {
        console.error('Get GDD error:', error);
        res.status(500).json({ error: 'Failed to calculate GDD' });
    }
});

// Get garden statistics
router.get('/gardens/:id/stats', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        const gardenId = req.params.id;
        const userId = req.user.userId;

        // Verify ownership
        const garden = await db.query(
            'SELECT * FROM gardens WHERE id = $1 AND user_id = $2',
            [gardenId, userId]
        );

        if (garden.rows.length === 0) {
            return res.status(404).json({ error: 'Garden not found' });
        }

        // Plant counts by status
        const plantStats = await db.query(`
            SELECT status, COUNT(*) as count
            FROM garden_plants
            WHERE garden_id = $1
            GROUP BY status
        `, [gardenId]);

        // Total harvests
        let harvestQuery = `
            SELECT
                COALESCE(SUM(weight_grams), 0) as total_grams,
                COALESCE(SUM(calories_total), 0) as total_calories,
                COUNT(*) as harvest_count
            FROM garden_harvests gh
            JOIN garden_plants gp ON gh.garden_plant_id = gp.id
            WHERE gp.garden_id = $1
        `;
        const harvestParams = [gardenId];

        if (start_date) {
            harvestQuery += ' AND gh.harvest_date >= $2';
            harvestParams.push(start_date);
        }
        if (end_date) {
            harvestQuery += ` AND gh.harvest_date <= $${harvestParams.length + 1}`;
            harvestParams.push(end_date);
        }

        const harvestStats = await db.query(harvestQuery, harvestParams);

        // Environment averages
        let envQuery = `
            SELECT
                AVG(temperature_c) as avg_temp,
                MAX(temperature_c) as max_temp,
                MIN(temperature_c) as min_temp,
                AVG(humidity_percent) as avg_humidity,
                SUM(rainfall_mm) as total_rainfall
            FROM garden_environment
            WHERE garden_id = $1
        `;
        const envParams = [gardenId];

        if (start_date) {
            envQuery += ' AND reading_timestamp >= $2';
            envParams.push(start_date);
        }
        if (end_date) {
            envQuery += ` AND reading_timestamp <= $${envParams.length + 1}`;
            envParams.push(end_date);
        }

        const envStats = await db.query(envQuery, envParams);

        // Top producing plants
        const topPlants = await db.query(`
            SELECT gp.plant_name, gp.variety, SUM(gh.weight_grams) as total_harvest
            FROM garden_plants gp
            JOIN garden_harvests gh ON gp.id = gh.garden_plant_id
            WHERE gp.garden_id = $1
            GROUP BY gp.id, gp.plant_name, gp.variety
            ORDER BY total_harvest DESC
            LIMIT 10
        `, [gardenId]);

        res.json({
            success: true,
            stats: {
                garden: garden.rows[0],
                plants: {
                    by_status: plantStats.rows.reduce((acc, r) => { acc[r.status] = parseInt(r.count); return acc; }, {})
                },
                harvests: {
                    total_grams: parseFloat(harvestStats.rows[0].total_grams),
                    total_kg: Math.round(parseFloat(harvestStats.rows[0].total_grams) / 1000 * 10) / 10,
                    total_calories: parseInt(harvestStats.rows[0].total_calories),
                    harvest_count: parseInt(harvestStats.rows[0].harvest_count)
                },
                environment: {
                    avg_temp_c: envStats.rows[0].avg_temp ? Math.round(parseFloat(envStats.rows[0].avg_temp) * 10) / 10 : null,
                    max_temp_c: envStats.rows[0].max_temp ? parseFloat(envStats.rows[0].max_temp) : null,
                    min_temp_c: envStats.rows[0].min_temp ? parseFloat(envStats.rows[0].min_temp) : null,
                    avg_humidity: envStats.rows[0].avg_humidity ? Math.round(parseFloat(envStats.rows[0].avg_humidity)) : null,
                    total_rainfall_mm: envStats.rows[0].total_rainfall ? parseFloat(envStats.rows[0].total_rainfall) : null
                },
                top_plants: topPlants.rows
            }
        });
    } catch (error) {
        console.error('Get garden stats error:', error);
        res.status(500).json({ error: 'Failed to fetch garden stats' });
    }
});

// =====================================================
// PDF EXPORT
// =====================================================

router.get('/export/pdf', async (req, res) => {
    try {
        const { garden_id, start_date, end_date, include_logs, include_environment } = req.query;
        const userId = req.user.userId;

        // Gather all data
        const reportData = await getGardenReportData(userId, {
            garden_id: garden_id ? parseInt(garden_id) : null,
            start_date,
            end_date,
            include_logs: include_logs === 'true',
            include_environment: include_environment === 'true'
        });

        // Send data back - PDF generation happens on frontend with jsPDF
        res.json({ success: true, report: reportData });
    } catch (error) {
        console.error('Export PDF error:', error);
        res.status(500).json({ error: 'Failed to generate report data' });
    }
});

// Helper function to gather all report data
async function getGardenReportData(userId, options = {}) {
    const { garden_id, start_date, end_date, include_logs, include_environment } = options;

    // Gardens
    let gardensQuery = 'SELECT * FROM gardens WHERE user_id = $1';
    const gardensParams = [userId];
    if (garden_id) {
        gardensQuery += ' AND id = $2';
        gardensParams.push(garden_id);
    }
    const gardens = await db.query(gardensQuery, gardensParams);

    // Plants with guide info
    let plantsQuery = `
        SELECT gp.*, pg.common_name as guide_name, pg.latin_name,
               pg.hardiness_zones, pg.sun_requirements, pg.water_requirements,
               pg.harvest_indicators, pg.storage_notes,
               g.name as garden_name, gb.name as bed_name
        FROM garden_plants gp
        LEFT JOIN plant_guides pg ON gp.plant_guide_id = pg.id
        LEFT JOIN gardens g ON gp.garden_id = g.id
        LEFT JOIN garden_beds gb ON gp.garden_bed_id = gb.id
        WHERE gp.user_id = $1
    `;
    const plantsParams = [userId];
    if (garden_id) {
        plantsQuery += ` AND gp.garden_id = $${plantsParams.length + 1}`;
        plantsParams.push(garden_id);
    }
    const plants = await db.query(plantsQuery, plantsParams);

    // Harvests
    let harvestsQuery = `
        SELECT gh.*, gp.plant_name, gp.variety, g.name as garden_name
        FROM garden_harvests gh
        LEFT JOIN garden_plants gp ON gh.garden_plant_id = gp.id
        LEFT JOIN gardens g ON gh.garden_id = g.id
        WHERE gh.user_id = $1
    `;
    const harvestsParams = [userId];
    if (garden_id) {
        harvestsQuery += ` AND gh.garden_id = $${harvestsParams.length + 1}`;
        harvestsParams.push(garden_id);
    }
    if (start_date) {
        harvestsQuery += ` AND gh.harvest_date >= $${harvestsParams.length + 1}`;
        harvestsParams.push(start_date);
    }
    if (end_date) {
        harvestsQuery += ` AND gh.harvest_date <= $${harvestsParams.length + 1}`;
        harvestsParams.push(end_date);
    }
    harvestsQuery += ' ORDER BY gh.harvest_date DESC';
    const harvests = await db.query(harvestsQuery, harvestsParams);

    // Logs (optional)
    let logs = [];
    if (include_logs) {
        let logsQuery = `
            SELECT gl.*, gp.plant_name, g.name as garden_name
            FROM garden_logs gl
            LEFT JOIN garden_plants gp ON gl.garden_plant_id = gp.id
            LEFT JOIN gardens g ON gl.garden_id = g.id
            WHERE gl.user_id = $1
        `;
        const logsParams = [userId];
        if (garden_id) {
            logsQuery += ` AND gl.garden_id = $${logsParams.length + 1}`;
            logsParams.push(garden_id);
        }
        if (start_date) {
            logsQuery += ` AND gl.entry_date >= $${logsParams.length + 1}`;
            logsParams.push(start_date);
        }
        if (end_date) {
            logsQuery += ` AND gl.entry_date <= $${logsParams.length + 1}`;
            logsParams.push(end_date);
        }
        logsQuery += ' ORDER BY gl.entry_date DESC, gl.entry_time DESC LIMIT 500';
        const logsResult = await db.query(logsQuery, logsParams);
        logs = logsResult.rows;
    }

    // Environment summary (optional)
    let environment = null;
    if (include_environment) {
        let envQuery = `
            SELECT
                COUNT(*) as reading_count,
                AVG(temperature_c) as avg_temp,
                MAX(temperature_c) as max_temp,
                MIN(temperature_c) as min_temp,
                AVG(humidity_percent) as avg_humidity,
                SUM(rainfall_mm) as total_rainfall,
                AVG(soil_temperature_c) as avg_soil_temp
            FROM garden_environment
            WHERE user_id = $1
        `;
        const envParams = [userId];
        if (garden_id) {
            envQuery += ` AND garden_id = $${envParams.length + 1}`;
            envParams.push(garden_id);
        }
        if (start_date) {
            envQuery += ` AND reading_timestamp >= $${envParams.length + 1}`;
            envParams.push(start_date);
        }
        if (end_date) {
            envQuery += ` AND reading_timestamp <= $${envParams.length + 1}`;
            envParams.push(end_date);
        }
        const envResult = await db.query(envQuery, envParams);
        environment = envResult.rows[0];
    }

    // Calculate totals
    const totalHarvestGrams = harvests.rows.reduce((sum, h) => sum + (parseFloat(h.weight_grams) || 0), 0);
    const totalCalories = harvests.rows.reduce((sum, h) => sum + (parseInt(h.calories_total) || 0), 0);

    // Production by plant
    const productionByPlant = {};
    harvests.rows.forEach(h => {
        const key = h.plant_name || 'Unknown';
        if (!productionByPlant[key]) {
            productionByPlant[key] = { grams: 0, calories: 0, count: 0 };
        }
        productionByPlant[key].grams += parseFloat(h.weight_grams) || 0;
        productionByPlant[key].calories += parseInt(h.calories_total) || 0;
        productionByPlant[key].count++;
    });

    return {
        generated_at: new Date().toISOString(),
        date_range: { start: start_date || 'All time', end: end_date || 'Present' },
        gardens: gardens.rows,
        plants: plants.rows,
        harvests: harvests.rows,
        logs,
        environment,
        summary: {
            garden_count: gardens.rows.length,
            plant_count: plants.rows.length,
            harvest_count: harvests.rows.length,
            total_harvest_grams: Math.round(totalHarvestGrams),
            total_harvest_kg: Math.round(totalHarvestGrams / 1000 * 10) / 10,
            total_calories: totalCalories,
            production_by_plant: productionByPlant
        }
    };
}

module.exports = router;

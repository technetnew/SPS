const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Configure multer for document uploads
const DOCUMENTS_DIR = '/var/www/sps/uploads/documents';

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
            cb(null, DOCUMENTS_DIR);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `doc-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit for documents
    },
    fileFilter: (req, file, cb) => {
        // Allow common document types
        const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${ext} not allowed`), false);
        }
    }
});

router.use(authenticateToken);

// ============================================
// IMPORTANT: Route order matters in Express!
// Specific routes must come BEFORE parameterized routes
// ============================================

// ============================================
// FAMILY DOCUMENTS (must be before /:id)
// ============================================

// Get all documents
router.get('/documents', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT fd.*, fp.name as member_name
             FROM family_documents fd
             LEFT JOIN family_profiles fp ON fd.family_profile_id = fp.id
             WHERE fd.user_id = $1
             ORDER BY fd.created_at DESC`,
            [req.user.userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Documents fetch error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch documents' });
    }
});

// Create document (with optional file upload)
router.post('/documents', upload.single('file'), async (req, res) => {
    const { name, category, family_profile_id, document_number, notes } = req.body;
    // Handle empty string expiration_date as null
    const expiration_date = req.body.expiration_date && req.body.expiration_date.trim() !== ''
        ? req.body.expiration_date
        : null;

    if (!name || !category) {
        return res.status(400).json({ success: false, error: 'Name and category are required' });
    }

    // Get file info if a file was uploaded
    let file_path = null;
    let file_name = null;
    let file_type = null;
    let file_size = null;
    if (req.file) {
        file_path = `/uploads/documents/${req.file.filename}`;
        file_name = req.file.originalname;
        file_type = req.file.mimetype;
        file_size = req.file.size;
    }

    try {
        const result = await db.query(
            `INSERT INTO family_documents
             (user_id, family_profile_id, name, category, document_number, expiration_date, notes, file_path, file_name, file_type, file_size)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [req.user.userId, family_profile_id || null, name, category, document_number, expiration_date, notes, file_path, file_name, file_type, file_size]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Document creation error:', error);
        // Clean up uploaded file if database insert fails
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (e) {
                console.error('Failed to clean up uploaded file:', e);
            }
        }
        res.status(500).json({ success: false, error: 'Failed to create document' });
    }
});

// Get single document
router.get('/documents/:docId', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT fd.*, fp.name as member_name
             FROM family_documents fd
             LEFT JOIN family_profiles fp ON fd.family_profile_id = fp.id
             WHERE fd.id = $1 AND fd.user_id = $2`,
            [req.params.docId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Document fetch error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch document' });
    }
});

// Update document
router.put('/documents/:docId', async (req, res) => {
    const { name, category, family_profile_id, document_number, expiration_date, notes } = req.body;

    try {
        const result = await db.query(
            `UPDATE family_documents SET
                name = COALESCE($1, name),
                category = COALESCE($2, category),
                family_profile_id = $3,
                document_number = $4,
                expiration_date = $5,
                notes = $6,
                updated_at = NOW()
             WHERE id = $7 AND user_id = $8
             RETURNING *`,
            [name, category, family_profile_id || null, document_number, expiration_date, notes, req.params.docId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Document update error:', error);
        res.status(500).json({ success: false, error: 'Failed to update document' });
    }
});

// Delete document
router.delete('/documents/:docId', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM family_documents WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.docId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        res.json({ success: true, message: 'Document deleted' });
    } catch (error) {
        console.error('Document deletion error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete document' });
    }
});

// ============================================
// EMERGENCY CONTACTS (must be before /:id)
// ============================================

// Get all emergency contacts
router.get('/emergency-contacts', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, user_id, name, relationship,
                    phone_primary as phone, phone_secondary as phone_alt,
                    email, address, radio_callsign, radio_frequency,
                    notes, contact_order as priority, is_ice, created_at, updated_at
             FROM emergency_contacts
             WHERE user_id = $1
             ORDER BY contact_order, name`,
            [req.user.userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Emergency contacts fetch error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch emergency contacts' });
    }
});

// Create emergency contact
router.post('/emergency-contacts', async (req, res) => {
    const { name, relationship, phone, phone_alt, email, address, priority, notes, radio_callsign, radio_frequency, is_ice } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }

    try {
        const result = await db.query(
            `INSERT INTO emergency_contacts
             (user_id, name, relationship, phone_primary, phone_secondary, email, address, contact_order, notes, radio_callsign, radio_frequency, is_ice)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, user_id, name, relationship, phone_primary as phone, phone_secondary as phone_alt,
                       email, address, radio_callsign, radio_frequency, notes, contact_order as priority, is_ice, created_at`,
            [req.user.userId, name, relationship, phone, phone_alt, email, address, priority || 3, notes, radio_callsign, radio_frequency, is_ice || false]
        );

        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Emergency contact creation error:', error);
        res.status(500).json({ success: false, error: 'Failed to create contact' });
    }
});

// Get single emergency contact
router.get('/emergency-contacts/:contactId', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, user_id, name, relationship,
                    phone_primary as phone, phone_secondary as phone_alt,
                    email, address, radio_callsign, radio_frequency,
                    notes, contact_order as priority, is_ice, created_at, updated_at
             FROM emergency_contacts WHERE id = $1 AND user_id = $2`,
            [req.params.contactId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Emergency contact fetch error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch contact' });
    }
});

// Update emergency contact
router.put('/emergency-contacts/:contactId', async (req, res) => {
    const { name, relationship, phone, phone_alt, email, address, priority, notes, radio_callsign, radio_frequency, is_ice } = req.body;

    try {
        const result = await db.query(
            `UPDATE emergency_contacts SET
                name = COALESCE($1, name),
                relationship = $2,
                phone_primary = COALESCE($3, phone_primary),
                phone_secondary = $4,
                email = $5,
                address = $6,
                contact_order = COALESCE($7, contact_order),
                notes = $8,
                radio_callsign = $9,
                radio_frequency = $10,
                is_ice = COALESCE($11, is_ice),
                updated_at = NOW()
             WHERE id = $12 AND user_id = $13
             RETURNING id, user_id, name, relationship, phone_primary as phone, phone_secondary as phone_alt,
                       email, address, radio_callsign, radio_frequency, notes, contact_order as priority, is_ice, created_at`,
            [name, relationship, phone, phone_alt, email, address, priority, notes, radio_callsign, radio_frequency, is_ice, req.params.contactId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Emergency contact update error:', error);
        res.status(500).json({ success: false, error: 'Failed to update contact' });
    }
});

// Delete emergency contact
router.delete('/emergency-contacts/:contactId', async (req, res) => {
    try {
        const result = await db.query(
            'DELETE FROM emergency_contacts WHERE id = $1 AND user_id = $2 RETURNING id',
            [req.params.contactId, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }

        res.json({ success: true, message: 'Contact deleted' });
    } catch (error) {
        console.error('Emergency contact deletion error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete contact' });
    }
});

// ============================================
// FAMILY NUTRITION SUMMARY (must be before /:id)
// ============================================

router.get('/nutrition/summary', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM v_family_nutrition_summary WHERE user_id = $1`,
            [req.user.userId]
        );

        // Calculate totals
        let totals = {
            daily_calorie_target: 0,
            protein_grams_target: 0,
            carbs_grams_target: 0,
            fat_grams_target: 0,
            calories_consumed_today: 0,
            protein_consumed_today: 0,
            carbs_consumed_today: 0,
            fat_consumed_today: 0
        };

        result.rows.forEach(row => {
            totals.daily_calorie_target += parseInt(row.daily_calorie_target) || 0;
            totals.protein_grams_target += parseInt(row.protein_grams_target) || 0;
            totals.carbs_grams_target += parseInt(row.carbs_grams_target) || 0;
            totals.fat_grams_target += parseInt(row.fat_grams_target) || 0;
            totals.calories_consumed_today += parseInt(row.calories_consumed_today) || 0;
            totals.protein_consumed_today += parseInt(row.protein_consumed_today) || 0;
            totals.carbs_consumed_today += parseInt(row.carbs_consumed_today) || 0;
            totals.fat_consumed_today += parseInt(row.fat_consumed_today) || 0;
        });

        res.json({
            members: result.rows,
            totals
        });
    } catch (error) {
        console.error('Nutrition summary error:', error);
        res.status(500).json({ error: 'Failed to fetch nutrition summary' });
    }
});

// Recalculate calorie targets for all profiles (must be before /:id)
router.post('/recalculate-targets', async (req, res) => {
    try {
        const profiles = await db.query(
            'SELECT id FROM family_profiles WHERE user_id = $1 AND is_active = TRUE',
            [req.user.userId]
        );

        for (const profile of profiles.rows) {
            await db.query('SELECT update_family_calorie_targets($1)', [profile.id]);
        }

        res.json({
            success: true,
            message: 'Calorie targets recalculated',
            profiles_updated: profiles.rows.length
        });
    } catch (error) {
        console.error('Recalculation error:', error);
        res.status(500).json({ error: 'Failed to recalculate targets' });
    }
});

// ============================================
// FAMILY PROFILES
// ============================================

// Get all family profiles
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT fp.*,
                    fct.calculated_bmr,
                    fct.calculated_tdee,
                    fct.protein_grams_target,
                    fct.carbs_grams_target,
                    fct.fat_grams_target,
                    fct.fiber_grams_target,
                    EXTRACT(YEAR FROM AGE(CURRENT_DATE, fp.birth_date)) as age
             FROM family_profiles fp
             LEFT JOIN family_calorie_targets fct ON fp.id = fct.family_profile_id
                AND fct.calculation_date = (SELECT MAX(calculation_date) FROM family_calorie_targets WHERE family_profile_id = fp.id)
             WHERE fp.user_id = $1 AND fp.is_active = TRUE
             ORDER BY fp.name`,
            [req.user.userId]
        );

        // Get allergies for each profile
        for (let profile of result.rows) {
            const allergies = await db.query(
                'SELECT * FROM family_allergies WHERE family_profile_id = $1',
                [profile.id]
            );
            profile.allergies = allergies.rows;
        }

        res.json({ profiles: result.rows });
    } catch (error) {
        console.error('Family profiles fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch family profiles' });
    }
});

// Get single profile (MUST be after all specific routes like /documents, /emergency-contacts, etc.)
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT fp.*,
                    fct.calculated_bmr,
                    fct.calculated_tdee,
                    fct.protein_grams_target,
                    fct.carbs_grams_target,
                    fct.fat_grams_target,
                    EXTRACT(YEAR FROM AGE(CURRENT_DATE, fp.birth_date)) as age
             FROM family_profiles fp
             LEFT JOIN family_calorie_targets fct ON fp.id = fct.family_profile_id
                AND fct.calculation_date = CURRENT_DATE
             WHERE fp.id = $1 AND fp.user_id = $2`,
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Get allergies
        const allergies = await db.query(
            'SELECT * FROM family_allergies WHERE family_profile_id = $1',
            [req.params.id]
        );
        result.rows[0].allergies = allergies.rows;

        res.json({ profile: result.rows[0] });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Create family profile
router.post('/', [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('relationship').optional().isIn(['self', 'spouse', 'child', 'parent', 'sibling', 'other']),
    body('birth_date').optional().isISO8601(),
    body('gender').optional().isIn(['male', 'female', 'other']),
    body('height_inches').optional().isNumeric(),
    body('weight_lbs').optional().isNumeric(),
    body('activity_level').optional().isIn(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    body('is_pregnant').optional().isBoolean(),
    body('is_lactating').optional().isBoolean(),
    body('lactation_months').optional().isInt({ min: 0, max: 24 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const {
        name, relationship, birth_date, gender, height_inches, weight_lbs,
        activity_level, is_pregnant, is_lactating, lactation_months, special_diet, photo_url
    } = req.body;

    try {
        const result = await db.query(
            `INSERT INTO family_profiles
             (user_id, name, relationship, birth_date, gender, height_inches, weight_lbs,
              activity_level, is_pregnant, is_lactating, lactation_months, special_diet, photo_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [req.user.userId, name, relationship, birth_date, gender, height_inches, weight_lbs,
             activity_level || 'moderate', is_pregnant || false, is_lactating || false, lactation_months,
             special_diet ? JSON.stringify(special_diet) : null, photo_url]
        );

        // The trigger will auto-calculate calorie targets
        // Fetch with calculated values
        const profile = await db.query(
            `SELECT fp.*,
                    fct.calculated_bmr,
                    fct.calculated_tdee,
                    fct.protein_grams_target,
                    fct.carbs_grams_target,
                    fct.fat_grams_target
             FROM family_profiles fp
             LEFT JOIN family_calorie_targets fct ON fp.id = fct.family_profile_id
                AND fct.calculation_date = CURRENT_DATE
             WHERE fp.id = $1`,
            [result.rows[0].id]
        );

        res.status(201).json({
            success: true,
            message: 'Family profile created successfully',
            profile: profile.rows[0]
        });
    } catch (error) {
        console.error('Profile creation error:', error);
        res.status(500).json({ error: 'Failed to create profile' });
    }
});

// Update family profile
router.put('/:id', async (req, res) => {
    try {
        const current = await db.query(
            'SELECT * FROM family_profiles WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const {
            name, relationship, birth_date, gender, height_inches, weight_lbs,
            activity_level, is_pregnant, is_lactating, lactation_months, special_diet, photo_url, is_active
        } = req.body;

        const result = await db.query(
            `UPDATE family_profiles SET
                name = COALESCE($1, name),
                relationship = COALESCE($2, relationship),
                birth_date = COALESCE($3, birth_date),
                gender = COALESCE($4, gender),
                height_inches = COALESCE($5, height_inches),
                weight_lbs = COALESCE($6, weight_lbs),
                activity_level = COALESCE($7, activity_level),
                is_pregnant = COALESCE($8, is_pregnant),
                is_lactating = COALESCE($9, is_lactating),
                lactation_months = COALESCE($10, lactation_months),
                special_diet = COALESCE($11, special_diet),
                photo_url = COALESCE($12, photo_url),
                is_active = COALESCE($13, is_active),
                updated_at = NOW()
             WHERE id = $14 AND user_id = $15
             RETURNING *`,
            [name, relationship, birth_date, gender, height_inches, weight_lbs,
             activity_level, is_pregnant, is_lactating, lactation_months,
             special_diet ? JSON.stringify(special_diet) : null, photo_url, is_active,
             req.params.id, req.user.userId]
        );

        // Fetch with recalculated values
        const profile = await db.query(
            `SELECT fp.*,
                    fct.calculated_bmr,
                    fct.calculated_tdee,
                    fct.protein_grams_target,
                    fct.carbs_grams_target,
                    fct.fat_grams_target
             FROM family_profiles fp
             LEFT JOIN family_calorie_targets fct ON fp.id = fct.family_profile_id
                AND fct.calculation_date = CURRENT_DATE
             WHERE fp.id = $1`,
            [req.params.id]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            profile: profile.rows[0]
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Delete family profile (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE family_profiles SET is_active = FALSE, updated_at = NOW()
             WHERE id = $1 AND user_id = $2 RETURNING id, name`,
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json({ success: true, message: 'Profile deactivated successfully', profile: result.rows[0] });
    } catch (error) {
        console.error('Profile deletion error:', error);
        res.status(500).json({ error: 'Failed to delete profile' });
    }
});

// ============================================
// ALLERGIES
// ============================================

// Add allergy
router.post('/:id/allergies', [
    body('allergen').trim().notEmpty(),
    body('severity').optional().isIn(['mild', 'moderate', 'severe', 'life_threatening'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    // Verify profile belongs to user
    const profile = await db.query(
        'SELECT id FROM family_profiles WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.userId]
    );

    if (profile.rows.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
    }

    const { allergen, severity, notes, diagnosed_date } = req.body;

    try {
        const result = await db.query(
            `INSERT INTO family_allergies (family_profile_id, allergen, severity, notes, diagnosed_date)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [req.params.id, allergen, severity || 'moderate', notes, diagnosed_date]
        );

        res.status(201).json({
            success: true,
            message: 'Allergy added successfully',
            allergy: result.rows[0]
        });
    } catch (error) {
        console.error('Allergy creation error:', error);
        res.status(500).json({ error: 'Failed to add allergy' });
    }
});

// Remove allergy
router.delete('/:id/allergies/:allergyId', async (req, res) => {
    try {
        // Verify profile belongs to user
        const profile = await db.query(
            'SELECT id FROM family_profiles WHERE id = $1 AND user_id = $2',
            [req.params.id, req.user.userId]
        );

        if (profile.rows.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const result = await db.query(
            'DELETE FROM family_allergies WHERE id = $1 AND family_profile_id = $2 RETURNING id',
            [req.params.allergyId, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Allergy not found' });
        }

        res.json({ success: true, message: 'Allergy removed successfully' });
    } catch (error) {
        console.error('Allergy deletion error:', error);
        res.status(500).json({ error: 'Failed to remove allergy' });
    }
});

module.exports = router;

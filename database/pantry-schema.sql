-- SPS Food Pantry System - Enterprise Schema
-- Includes: USDA nutritional database, family calorie planning, shelf life management,
-- allergy warnings, audit trail, and comprehensive food tracking

-- ============================================
-- AUDIT TRAIL SYSTEM
-- ============================================

-- Main audit log table for all data changes
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- ============================================
-- FAMILY PROFILES WITH USDA CALORIE CALCULATIONS
-- ============================================

-- Enhanced family members for calorie tracking
CREATE TABLE IF NOT EXISTS family_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50), -- 'self', 'spouse', 'child', 'parent', 'other'
    birth_date DATE,
    gender VARCHAR(20), -- 'male', 'female', 'other'
    height_inches DECIMAL(5,2),
    weight_lbs DECIMAL(6,2),
    activity_level VARCHAR(20) DEFAULT 'moderate', -- 'sedentary', 'light', 'moderate', 'active', 'very_active'
    is_pregnant BOOLEAN DEFAULT FALSE,
    is_lactating BOOLEAN DEFAULT FALSE,
    lactation_months INTEGER, -- 0-6 or 7-12 for different calorie needs
    special_diet TEXT, -- JSON array: ['vegetarian', 'vegan', 'keto', 'low-sodium', etc]
    photo_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family allergies and dietary restrictions
CREATE TABLE IF NOT EXISTS family_allergies (
    id SERIAL PRIMARY KEY,
    family_profile_id INTEGER REFERENCES family_profiles(id) ON DELETE CASCADE,
    allergen VARCHAR(100) NOT NULL, -- 'peanuts', 'tree_nuts', 'dairy', 'eggs', 'wheat', 'soy', 'fish', 'shellfish', 'sesame'
    severity VARCHAR(20) DEFAULT 'moderate', -- 'mild', 'moderate', 'severe', 'life_threatening'
    notes TEXT,
    diagnosed_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family daily calorie targets (calculated from USDA formulas)
CREATE TABLE IF NOT EXISTS family_calorie_targets (
    id SERIAL PRIMARY KEY,
    family_profile_id INTEGER REFERENCES family_profiles(id) ON DELETE CASCADE,
    calculated_bmr INTEGER, -- Basal Metabolic Rate
    calculated_tdee INTEGER, -- Total Daily Energy Expenditure
    protein_grams_target INTEGER,
    carbs_grams_target INTEGER,
    fat_grams_target INTEGER,
    fiber_grams_target INTEGER,
    calculation_date DATE DEFAULT CURRENT_DATE,
    calculation_formula VARCHAR(50) DEFAULT 'mifflin_st_jeor', -- 'harris_benedict', 'mifflin_st_jeor', 'katch_mcardle'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_profile_id, calculation_date)
);

CREATE INDEX IF NOT EXISTS idx_family_profiles_user ON family_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_family_allergies_profile ON family_allergies(family_profile_id);
CREATE INDEX IF NOT EXISTS idx_family_allergies_allergen ON family_allergies(allergen);

-- ============================================
-- USDA FOOD NUTRITION DATABASE
-- ============================================

-- Master food database (pre-populated with USDA data)
CREATE TABLE IF NOT EXISTS food_database (
    id SERIAL PRIMARY KEY,
    usda_fdc_id INTEGER UNIQUE, -- USDA FoodData Central ID
    name VARCHAR(500) NOT NULL,
    brand VARCHAR(255),
    category VARCHAR(100),
    serving_size DECIMAL(10,2),
    serving_unit VARCHAR(50),
    serving_description VARCHAR(255),
    -- Macronutrients (per serving)
    calories INTEGER,
    protein_g DECIMAL(10,2),
    carbohydrates_g DECIMAL(10,2),
    fiber_g DECIMAL(10,2),
    sugars_g DECIMAL(10,2),
    fat_g DECIMAL(10,2),
    saturated_fat_g DECIMAL(10,2),
    trans_fat_g DECIMAL(10,2),
    -- Micronutrients (per serving)
    sodium_mg DECIMAL(10,2),
    potassium_mg DECIMAL(10,2),
    calcium_mg DECIMAL(10,2),
    iron_mg DECIMAL(10,2),
    vitamin_a_mcg DECIMAL(10,2),
    vitamin_c_mg DECIMAL(10,2),
    vitamin_d_mcg DECIMAL(10,2),
    vitamin_b12_mcg DECIMAL(10,2),
    -- Allergens (boolean flags)
    contains_peanuts BOOLEAN DEFAULT FALSE,
    contains_tree_nuts BOOLEAN DEFAULT FALSE,
    contains_dairy BOOLEAN DEFAULT FALSE,
    contains_eggs BOOLEAN DEFAULT FALSE,
    contains_wheat BOOLEAN DEFAULT FALSE,
    contains_soy BOOLEAN DEFAULT FALSE,
    contains_fish BOOLEAN DEFAULT FALSE,
    contains_shellfish BOOLEAN DEFAULT FALSE,
    contains_sesame BOOLEAN DEFAULT FALSE,
    -- Metadata
    barcode VARCHAR(50),
    upc VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    source VARCHAR(50) DEFAULT 'usda', -- 'usda', 'user', 'manufacturer'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_food_db_name ON food_database(name);
CREATE INDEX IF NOT EXISTS idx_food_db_category ON food_database(category);
CREATE INDEX IF NOT EXISTS idx_food_db_barcode ON food_database(barcode);
CREATE INDEX IF NOT EXISTS idx_food_db_upc ON food_database(upc);

-- ============================================
-- PANTRY STORAGE SYSTEM
-- ============================================

-- Pantry storage locations
CREATE TABLE IF NOT EXISTS pantry_locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location_type VARCHAR(50), -- 'pantry', 'refrigerator', 'freezer', 'basement', 'garage', 'root_cellar'
    temperature_zone VARCHAR(20), -- 'frozen', 'refrigerated', 'cool', 'room_temp'
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main pantry items table
CREATE TABLE IF NOT EXISTS pantry_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    food_id INTEGER REFERENCES food_database(id), -- Link to nutrition data
    location_id INTEGER REFERENCES pantry_locations(id) ON DELETE SET NULL,
    -- Item details
    name VARCHAR(500) NOT NULL,
    brand VARCHAR(255),
    description TEXT,
    barcode VARCHAR(50),
    -- Quantity tracking
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'units', -- 'units', 'cans', 'boxes', 'lbs', 'oz', 'kg', 'g', 'gallons', 'liters'
    servings_per_unit DECIMAL(10,2) DEFAULT 1,
    -- Nutrition per unit (can override food_database)
    calories_per_unit INTEGER,
    protein_per_unit DECIMAL(10,2),
    carbs_per_unit DECIMAL(10,2),
    fat_per_unit DECIMAL(10,2),
    -- Dates
    purchase_date DATE,
    expiration_date DATE,
    best_by_date DATE,
    opened_date DATE,
    -- Shelf life tracking
    shelf_life_days INTEGER, -- Expected shelf life unopened
    opened_shelf_life_days INTEGER, -- Shelf life after opening
    -- Cost tracking
    cost_per_unit DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    -- Status
    status VARCHAR(20) DEFAULT 'in_stock', -- 'in_stock', 'low', 'out', 'expired', 'consumed'
    is_opened BOOLEAN DEFAULT FALSE,
    -- Allergens (can override food_database)
    allergens TEXT, -- JSON array of allergens
    -- Organization
    category VARCHAR(100),
    subcategory VARCHAR(100),
    tags TEXT, -- JSON array
    notes TEXT,
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pantry_user ON pantry_items(user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_location ON pantry_items(location_id);
CREATE INDEX IF NOT EXISTS idx_pantry_expiration ON pantry_items(expiration_date);
CREATE INDEX IF NOT EXISTS idx_pantry_status ON pantry_items(status);
CREATE INDEX IF NOT EXISTS idx_pantry_category ON pantry_items(category);
CREATE INDEX IF NOT EXISTS idx_pantry_barcode ON pantry_items(barcode);
CREATE INDEX IF NOT EXISTS idx_pantry_food ON pantry_items(food_id);

-- Pantry transactions (consumption, additions, adjustments)
CREATE TABLE IF NOT EXISTS pantry_transactions (
    id SERIAL PRIMARY KEY,
    pantry_item_id INTEGER REFERENCES pantry_items(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    family_profile_id INTEGER REFERENCES family_profiles(id) ON DELETE SET NULL, -- Who consumed it
    transaction_type VARCHAR(20) NOT NULL, -- 'add', 'consume', 'adjust', 'expire', 'waste', 'donate'
    quantity DECIMAL(10,2) NOT NULL,
    previous_quantity DECIMAL(10,2),
    new_quantity DECIMAL(10,2),
    -- Consumption tracking
    meal_type VARCHAR(20), -- 'breakfast', 'lunch', 'dinner', 'snack'
    consumption_date DATE,
    -- Notes
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pantry_trans_item ON pantry_transactions(pantry_item_id);
CREATE INDEX IF NOT EXISTS idx_pantry_trans_user ON pantry_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_trans_family ON pantry_transactions(family_profile_id);
CREATE INDEX IF NOT EXISTS idx_pantry_trans_type ON pantry_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_pantry_trans_date ON pantry_transactions(consumption_date);

-- ============================================
-- MEAL PLANNING
-- ============================================

CREATE TABLE IF NOT EXISTS meal_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL,
    meal_type VARCHAR(20) NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack'
    name VARCHAR(255),
    notes TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, plan_date, meal_type)
);

CREATE TABLE IF NOT EXISTS meal_plan_items (
    id SERIAL PRIMARY KEY,
    meal_plan_id INTEGER REFERENCES meal_plans(id) ON DELETE CASCADE,
    pantry_item_id INTEGER REFERENCES pantry_items(id) ON DELETE SET NULL,
    food_id INTEGER REFERENCES food_database(id), -- For items not in pantry
    family_profile_id INTEGER REFERENCES family_profiles(id) ON DELETE SET NULL, -- Assigned to person
    name VARCHAR(255) NOT NULL,
    servings DECIMAL(10,2) DEFAULT 1,
    calories_planned INTEGER,
    protein_planned DECIMAL(10,2),
    carbs_planned DECIMAL(10,2),
    fat_planned DECIMAL(10,2),
    is_consumed BOOLEAN DEFAULT FALSE,
    consumed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meal_plans_user ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_date ON meal_plans(plan_date);

-- ============================================
-- SHOPPING & RESTOCK
-- ============================================

CREATE TABLE IF NOT EXISTS pantry_shopping_list (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    food_id INTEGER REFERENCES food_database(id),
    pantry_item_id INTEGER REFERENCES pantry_items(id) ON DELETE SET NULL, -- If restocking existing
    name VARCHAR(500) NOT NULL,
    brand VARCHAR(255),
    quantity DECIMAL(10,2) DEFAULT 1,
    unit VARCHAR(50),
    estimated_cost DECIMAL(10,2),
    category VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    store VARCHAR(255),
    aisle VARCHAR(100),
    is_purchased BOOLEAN DEFAULT FALSE,
    purchased_date DATE,
    actual_cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pantry_shopping_user ON pantry_shopping_list(user_id);
CREATE INDEX IF NOT EXISTS idx_pantry_shopping_purchased ON pantry_shopping_list(is_purchased);

-- Restock rules (automatic shopping list generation)
CREATE TABLE IF NOT EXISTS pantry_restock_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    food_id INTEGER REFERENCES food_database(id),
    item_name VARCHAR(500) NOT NULL,
    min_quantity DECIMAL(10,2) NOT NULL,
    target_quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50),
    auto_add_to_list BOOLEAN DEFAULT TRUE,
    preferred_brand VARCHAR(255),
    preferred_store VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PANTRY CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS pantry_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    parent_id INTEGER REFERENCES pantry_categories(id),
    sort_order INTEGER DEFAULT 0,
    color VARCHAR(20),
    default_shelf_life_days INTEGER,
    default_unit VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default pantry categories
INSERT INTO pantry_categories (name, description, icon, sort_order, default_shelf_life_days, default_unit) VALUES
('Grains & Cereals', 'Rice, pasta, oats, flour, bread', '🌾', 1, 365, 'lbs'),
('Canned Goods', 'Canned vegetables, fruits, meats, soups', '🥫', 2, 730, 'cans'),
('Proteins', 'Meat, poultry, fish, eggs, tofu', '🥩', 3, 7, 'lbs'),
('Dairy', 'Milk, cheese, yogurt, butter', '🥛', 4, 14, 'units'),
('Fruits & Vegetables', 'Fresh and frozen produce', '🥬', 5, 7, 'lbs'),
('Snacks', 'Chips, crackers, nuts, dried fruit', '🍿', 6, 180, 'bags'),
('Beverages', 'Water, juice, coffee, tea', '🥤', 7, 365, 'units'),
('Condiments & Sauces', 'Ketchup, mustard, oils, spices', '🧂', 8, 365, 'bottles'),
('Baking Supplies', 'Sugar, flour, baking soda, yeast', '🧁', 9, 730, 'lbs'),
('Baby Food', 'Formula, baby food, snacks', '🍼', 10, 180, 'units'),
('Pet Food', 'Dog food, cat food, treats', '🐕', 11, 365, 'lbs'),
('Frozen Foods', 'Frozen meals, vegetables, meats', '🧊', 12, 180, 'units'),
('Emergency Rations', 'MREs, freeze-dried, long-term storage', '🆘', 13, 1825, 'units')
ON CONFLICT DO NOTHING;

-- ============================================
-- REPORTING VIEWS
-- ============================================

-- View: Expiring items summary
CREATE OR REPLACE VIEW v_expiring_items AS
SELECT
    pi.id,
    pi.user_id,
    pi.name,
    pi.quantity,
    pi.unit,
    pi.expiration_date,
    pi.location_id,
    pl.name as location_name,
    CASE
        WHEN pi.expiration_date < CURRENT_DATE THEN 'expired'
        WHEN pi.expiration_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'expires_this_week'
        WHEN pi.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'expires_this_month'
        ELSE 'ok'
    END as expiry_status,
    pi.expiration_date - CURRENT_DATE as days_until_expiry
FROM pantry_items pi
LEFT JOIN pantry_locations pl ON pi.location_id = pl.id
WHERE pi.status != 'consumed' AND pi.quantity > 0;

-- View: Family daily nutrition summary
CREATE OR REPLACE VIEW v_family_nutrition_summary AS
SELECT
    fp.id as family_profile_id,
    fp.user_id,
    fp.name,
    fct.calculated_tdee as daily_calorie_target,
    fct.protein_grams_target,
    fct.carbs_grams_target,
    fct.fat_grams_target,
    COALESCE(consumed.total_calories, 0) as calories_consumed_today,
    COALESCE(consumed.total_protein, 0) as protein_consumed_today,
    COALESCE(consumed.total_carbs, 0) as carbs_consumed_today,
    COALESCE(consumed.total_fat, 0) as fat_consumed_today
FROM family_profiles fp
LEFT JOIN family_calorie_targets fct ON fp.id = fct.family_profile_id
    AND fct.calculation_date = CURRENT_DATE
LEFT JOIN (
    SELECT
        pt.family_profile_id,
        SUM(pi.calories_per_unit * pt.quantity) as total_calories,
        SUM(pi.protein_per_unit * pt.quantity) as total_protein,
        SUM(pi.carbs_per_unit * pt.quantity) as total_carbs,
        SUM(pi.fat_per_unit * pt.quantity) as total_fat
    FROM pantry_transactions pt
    JOIN pantry_items pi ON pt.pantry_item_id = pi.id
    WHERE pt.transaction_type = 'consume'
        AND pt.consumption_date = CURRENT_DATE
    GROUP BY pt.family_profile_id
) consumed ON fp.id = consumed.family_profile_id
WHERE fp.is_active = TRUE;

-- View: Pantry summary by category
CREATE OR REPLACE VIEW v_pantry_by_category AS
SELECT
    pi.user_id,
    COALESCE(pi.category, 'Uncategorized') as category,
    COUNT(*) as item_count,
    SUM(pi.quantity) as total_quantity,
    SUM(pi.calories_per_unit * pi.quantity) as total_calories,
    SUM(pi.total_cost) as total_value,
    COUNT(CASE WHEN pi.expiration_date < CURRENT_DATE THEN 1 END) as expired_count,
    COUNT(CASE WHEN pi.expiration_date <= CURRENT_DATE + INTERVAL '30 days' AND pi.expiration_date >= CURRENT_DATE THEN 1 END) as expiring_soon_count
FROM pantry_items pi
WHERE pi.status != 'consumed' AND pi.quantity > 0
GROUP BY pi.user_id, COALESCE(pi.category, 'Uncategorized');

-- View: Days of food supply by family
CREATE OR REPLACE VIEW v_days_of_supply AS
SELECT
    pi.user_id,
    SUM(pi.calories_per_unit * pi.quantity) as total_calories_available,
    (SELECT SUM(fct.calculated_tdee)
     FROM family_profiles fp
     JOIN family_calorie_targets fct ON fp.id = fct.family_profile_id
     WHERE fp.user_id = pi.user_id AND fp.is_active = TRUE
     AND fct.calculation_date = (SELECT MAX(calculation_date) FROM family_calorie_targets WHERE family_profile_id = fp.id)
    ) as family_daily_calories,
    CASE
        WHEN (SELECT SUM(fct.calculated_tdee)
              FROM family_profiles fp
              JOIN family_calorie_targets fct ON fp.id = fct.family_profile_id
              WHERE fp.user_id = pi.user_id AND fp.is_active = TRUE) > 0
        THEN FLOOR(SUM(pi.calories_per_unit * pi.quantity) /
             (SELECT SUM(fct.calculated_tdee)
              FROM family_profiles fp
              JOIN family_calorie_targets fct ON fp.id = fct.family_profile_id
              WHERE fp.user_id = pi.user_id AND fp.is_active = TRUE
              AND fct.calculation_date = (SELECT MAX(calculation_date) FROM family_calorie_targets WHERE family_profile_id = fp.id)))
        ELSE NULL
    END as estimated_days_supply
FROM pantry_items pi
WHERE pi.status != 'consumed' AND pi.quantity > 0
GROUP BY pi.user_id;

-- ============================================
-- AUDIT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    audit_user_id INTEGER;
    old_data JSONB;
    new_data JSONB;
BEGIN
    -- Try to get user_id from the record or from session
    IF TG_OP = 'DELETE' THEN
        old_data = to_jsonb(OLD);
        IF OLD.user_id IS NOT NULL THEN
            audit_user_id = OLD.user_id;
        END IF;
        INSERT INTO audit_log (user_id, table_name, record_id, action, old_values, new_values)
        VALUES (audit_user_id, TG_TABLE_NAME, OLD.id, TG_OP, old_data, NULL);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        old_data = to_jsonb(OLD);
        new_data = to_jsonb(NEW);
        IF NEW.user_id IS NOT NULL THEN
            audit_user_id = NEW.user_id;
        END IF;
        INSERT INTO audit_log (user_id, table_name, record_id, action, old_values, new_values)
        VALUES (audit_user_id, TG_TABLE_NAME, NEW.id, TG_OP, old_data, new_data);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        new_data = to_jsonb(NEW);
        IF NEW.user_id IS NOT NULL THEN
            audit_user_id = NEW.user_id;
        END IF;
        INSERT INTO audit_log (user_id, table_name, record_id, action, old_values, new_values)
        VALUES (audit_user_id, TG_TABLE_NAME, NEW.id, TG_OP, NULL, new_data);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to key tables
DROP TRIGGER IF EXISTS audit_pantry_items ON pantry_items;
CREATE TRIGGER audit_pantry_items
    AFTER INSERT OR UPDATE OR DELETE ON pantry_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_pantry_transactions ON pantry_transactions;
CREATE TRIGGER audit_pantry_transactions
    AFTER INSERT OR UPDATE OR DELETE ON pantry_transactions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_family_profiles ON family_profiles;
CREATE TRIGGER audit_family_profiles
    AFTER INSERT OR UPDATE OR DELETE ON family_profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_inventory_items ON inventory_items;
CREATE TRIGGER audit_inventory_items
    AFTER INSERT OR UPDATE OR DELETE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS audit_medications ON medications;
CREATE TRIGGER audit_medications
    AFTER INSERT OR UPDATE OR DELETE ON medications
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate BMR using Mifflin-St Jeor Equation
CREATE OR REPLACE FUNCTION calculate_bmr(
    weight_lbs DECIMAL,
    height_inches DECIMAL,
    age_years INTEGER,
    gender VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    weight_kg DECIMAL;
    height_cm DECIMAL;
    bmr DECIMAL;
BEGIN
    weight_kg := weight_lbs * 0.453592;
    height_cm := height_inches * 2.54;

    IF gender = 'male' THEN
        bmr := (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) + 5;
    ELSE
        bmr := (10 * weight_kg) + (6.25 * height_cm) - (5 * age_years) - 161;
    END IF;

    RETURN ROUND(bmr);
END;
$$ LANGUAGE plpgsql;

-- Calculate TDEE from BMR and activity level
CREATE OR REPLACE FUNCTION calculate_tdee(
    bmr INTEGER,
    activity_level VARCHAR,
    is_pregnant BOOLEAN DEFAULT FALSE,
    is_lactating BOOLEAN DEFAULT FALSE,
    lactation_months INTEGER DEFAULT 0
) RETURNS INTEGER AS $$
DECLARE
    activity_multiplier DECIMAL;
    tdee DECIMAL;
BEGIN
    CASE activity_level
        WHEN 'sedentary' THEN activity_multiplier := 1.2;
        WHEN 'light' THEN activity_multiplier := 1.375;
        WHEN 'moderate' THEN activity_multiplier := 1.55;
        WHEN 'active' THEN activity_multiplier := 1.725;
        WHEN 'very_active' THEN activity_multiplier := 1.9;
        ELSE activity_multiplier := 1.55;
    END CASE;

    tdee := bmr * activity_multiplier;

    -- Add calories for pregnancy/lactation per USDA guidelines
    IF is_pregnant THEN
        tdee := tdee + 300; -- 2nd/3rd trimester average
    END IF;

    IF is_lactating THEN
        IF lactation_months <= 6 THEN
            tdee := tdee + 500;
        ELSE
            tdee := tdee + 400;
        END IF;
    END IF;

    RETURN ROUND(tdee);
END;
$$ LANGUAGE plpgsql;

-- Function to update family calorie targets
CREATE OR REPLACE FUNCTION update_family_calorie_targets(p_family_profile_id INTEGER)
RETURNS VOID AS $$
DECLARE
    profile RECORD;
    age_years INTEGER;
    bmr INTEGER;
    tdee INTEGER;
    protein_target INTEGER;
    carbs_target INTEGER;
    fat_target INTEGER;
BEGIN
    SELECT * INTO profile FROM family_profiles WHERE id = p_family_profile_id;

    IF profile IS NULL THEN
        RETURN;
    END IF;

    -- Calculate age
    age_years := EXTRACT(YEAR FROM AGE(CURRENT_DATE, profile.birth_date));

    -- Calculate BMR
    bmr := calculate_bmr(profile.weight_lbs, profile.height_inches, age_years, profile.gender);

    -- Calculate TDEE
    tdee := calculate_tdee(bmr, profile.activity_level, profile.is_pregnant, profile.is_lactating, profile.lactation_months);

    -- Calculate macros (standard 30/40/30 split: protein/carbs/fat)
    protein_target := ROUND(tdee * 0.30 / 4); -- 4 cal per gram protein
    carbs_target := ROUND(tdee * 0.40 / 4); -- 4 cal per gram carbs
    fat_target := ROUND(tdee * 0.30 / 9); -- 9 cal per gram fat

    -- Insert or update calorie targets
    INSERT INTO family_calorie_targets (
        family_profile_id,
        calculated_bmr,
        calculated_tdee,
        protein_grams_target,
        carbs_grams_target,
        fat_grams_target,
        fiber_grams_target,
        calculation_date
    ) VALUES (
        p_family_profile_id,
        bmr,
        tdee,
        protein_target,
        carbs_target,
        fat_target,
        28, -- Standard fiber recommendation
        CURRENT_DATE
    )
    ON CONFLICT (family_profile_id, calculation_date)
    DO UPDATE SET
        calculated_bmr = EXCLUDED.calculated_bmr,
        calculated_tdee = EXCLUDED.calculated_tdee,
        protein_grams_target = EXCLUDED.protein_grams_target,
        carbs_grams_target = EXCLUDED.carbs_grams_target,
        fat_grams_target = EXCLUDED.fat_grams_target;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate calories when profile is updated
CREATE OR REPLACE FUNCTION family_profile_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_family_calorie_targets(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_family_profile_calc ON family_profiles;
CREATE TRIGGER trg_family_profile_calc
    AFTER INSERT OR UPDATE ON family_profiles
    FOR EACH ROW EXECUTE FUNCTION family_profile_update_trigger();

-- ============================================
-- SAMPLE FOOD DATABASE ENTRIES
-- ============================================

INSERT INTO food_database (name, category, serving_size, serving_unit, serving_description, calories, protein_g, carbohydrates_g, fiber_g, fat_g, sodium_mg, contains_wheat) VALUES
('White Rice, long grain, dry', 'Grains & Cereals', 45, 'g', '1/4 cup dry', 160, 3, 36, 0.5, 0.3, 0, FALSE),
('Brown Rice, long grain, dry', 'Grains & Cereals', 45, 'g', '1/4 cup dry', 150, 3, 32, 2, 1.5, 0, FALSE),
('Pasta, spaghetti, dry', 'Grains & Cereals', 56, 'g', '2 oz dry', 200, 7, 42, 2, 1, 0, TRUE),
('Oatmeal, rolled oats, dry', 'Grains & Cereals', 40, 'g', '1/2 cup dry', 150, 5, 27, 4, 3, 0, FALSE),
('All-Purpose Flour', 'Baking Supplies', 30, 'g', '1/4 cup', 110, 3, 23, 1, 0.3, 0, TRUE),
('Canned Black Beans', 'Canned Goods', 130, 'g', '1/2 cup drained', 110, 7, 20, 8, 0.5, 400, FALSE),
('Canned Diced Tomatoes', 'Canned Goods', 121, 'g', '1/2 cup', 25, 1, 5, 1, 0, 220, FALSE),
('Canned Tuna in Water', 'Canned Goods', 85, 'g', '1 can drained', 100, 22, 0, 0, 1, 250, FALSE),
('Canned Chicken Breast', 'Canned Goods', 85, 'g', '1/2 can', 90, 15, 0, 0, 3, 270, FALSE),
('Peanut Butter', 'Snacks', 32, 'g', '2 tbsp', 190, 7, 7, 2, 16, 140, FALSE),
('Honey', 'Condiments & Sauces', 21, 'g', '1 tbsp', 60, 0, 17, 0, 0, 0, FALSE),
('Olive Oil', 'Condiments & Sauces', 14, 'g', '1 tbsp', 120, 0, 0, 0, 14, 0, FALSE),
('Powdered Milk, nonfat', 'Dairy', 23, 'g', '1/3 cup powder', 80, 8, 12, 0, 0, 125, FALSE),
('Beef Jerky', 'Snacks', 28, 'g', '1 oz', 80, 13, 3, 0, 1, 590, FALSE),
('Freeze-dried Fruit, mixed', 'Snacks', 34, 'g', '1 cup', 130, 1, 31, 3, 0.5, 5, FALSE),
('Mountain House Beef Stew', 'Emergency Rations', 74, 'g', '1 pouch prepared', 220, 11, 26, 2, 8, 930, TRUE),
('MRE Entree, average', 'Emergency Rations', 227, 'g', '1 entree', 300, 15, 40, 3, 10, 1200, TRUE)
ON CONFLICT DO NOTHING;

-- Update food_database with allergen info for peanut butter
UPDATE food_database SET contains_peanuts = TRUE WHERE name LIKE '%Peanut Butter%';

COMMENT ON TABLE pantry_items IS 'Main food pantry inventory with nutrition and expiration tracking';
COMMENT ON TABLE family_profiles IS 'Family member profiles for calorie and nutrition planning';
COMMENT ON TABLE food_database IS 'USDA nutrition database for food items';
COMMENT ON TABLE audit_log IS 'Complete audit trail for all data changes';

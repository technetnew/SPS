-- SPS Upgrade Schema - Extended Modules
-- This extends the existing schema without replacing it
-- Run AFTER the original schema.sql

-- ============================================
-- INVENTORY ENHANCEMENTS
-- ============================================

-- Storage Locations (multi-location support)
CREATE TABLE IF NOT EXISTS storage_locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location_type VARCHAR(50), -- 'home', 'vehicle', 'cache', 'bug_out', 'storage_unit'
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    capacity_notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extended Inventory Item Details
CREATE TABLE IF NOT EXISTS inventory_nutrition (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
    calories_per_serving INTEGER,
    servings_per_container DECIMAL(10, 2),
    protein_grams DECIMAL(10, 2),
    carbs_grams DECIMAL(10, 2),
    fat_grams DECIMAL(10, 2),
    sodium_mg DECIMAL(10, 2),
    shelf_life_days INTEGER,
    storage_temp_min INTEGER,
    storage_temp_max INTEGER,
    UNIQUE(item_id)
);

-- Par Levels and Shopping Lists
CREATE TABLE IF NOT EXISTS par_levels (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES inventory_categories(id),
    item_name VARCHAR(255) NOT NULL,
    target_quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shopping List Items (generated from par levels vs inventory)
CREATE TABLE IF NOT EXISTS shopping_list (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    par_level_id INTEGER REFERENCES par_levels(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity_needed DECIMAL(10, 2),
    unit VARCHAR(50),
    estimated_cost DECIMAL(10, 2),
    store_name VARCHAR(255),
    is_purchased BOOLEAN DEFAULT FALSE,
    purchased_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ammo Inventory
CREATE TABLE IF NOT EXISTS ammo_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES storage_locations(id),
    caliber VARCHAR(50) NOT NULL,
    brand VARCHAR(100),
    grain INTEGER,
    bullet_type VARCHAR(50), -- 'FMJ', 'HP', 'SP', 'Buckshot', 'Slug'
    quantity INTEGER NOT NULL DEFAULT 0,
    cost_per_round DECIMAL(10, 4),
    purchase_date DATE,
    lot_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Water Storage Log
CREATE TABLE IF NOT EXISTS water_storage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES storage_locations(id),
    container_type VARCHAR(100), -- 'barrel', 'jug', 'tank', 'bladder'
    container_size_gallons DECIMAL(10, 2),
    quantity INTEGER DEFAULT 1,
    total_gallons DECIMAL(10, 2) GENERATED ALWAYS AS (container_size_gallons * quantity) STORED,
    fill_date DATE,
    treatment_method VARCHAR(100), -- 'bleach', 'tablets', 'filter', 'none'
    rotation_due DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Canning Production Log
CREATE TABLE IF NOT EXISTS canning_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    batch_date DATE NOT NULL,
    quantity_jars INTEGER,
    jar_size VARCHAR(50), -- 'pint', 'quart', 'half-pint'
    processing_method VARCHAR(50), -- 'water_bath', 'pressure_canner'
    processing_time_minutes INTEGER,
    pressure_psi INTEGER,
    recipe_source TEXT,
    expiration_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ENERGY & POWER MODULE
-- ============================================

CREATE TABLE IF NOT EXISTS power_equipment (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    equipment_type VARCHAR(50) NOT NULL, -- 'generator', 'solar_panel', 'battery', 'inverter', 'charger'
    brand VARCHAR(100),
    model VARCHAR(100),
    watts_rated INTEGER,
    watts_surge INTEGER,
    voltage INTEGER,
    amp_hours DECIMAL(10, 2), -- for batteries
    fuel_type VARCHAR(50), -- 'gasoline', 'propane', 'diesel', 'solar', 'n/a'
    fuel_capacity_gallons DECIMAL(10, 2),
    runtime_hours_50_load DECIMAL(10, 2),
    purchase_date DATE,
    last_maintenance DATE,
    next_maintenance DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS power_loads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    watts_running INTEGER NOT NULL,
    watts_startup INTEGER,
    hours_per_day DECIMAL(5, 2),
    priority VARCHAR(20), -- 'critical', 'important', 'nice_to_have'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fuel_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    fuel_type VARCHAR(50) NOT NULL,
    quantity_gallons DECIMAL(10, 2) NOT NULL,
    location_id INTEGER REFERENCES storage_locations(id),
    container_type VARCHAR(100),
    purchase_date DATE,
    stabilizer_added BOOLEAN DEFAULT FALSE,
    stabilizer_brand VARCHAR(100),
    expiration_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MEDICAL MODULE
-- ============================================

CREATE TABLE IF NOT EXISTS medications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    family_member_id INTEGER REFERENCES family_members(id),
    medication_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    dosage VARCHAR(100),
    form VARCHAR(50), -- 'tablet', 'capsule', 'liquid', 'injection', 'cream'
    quantity INTEGER,
    prescriber VARCHAR(255),
    pharmacy VARCHAR(255),
    rx_number VARCHAR(100),
    purchase_date DATE,
    expiration_date DATE,
    refills_remaining INTEGER,
    is_critical BOOLEAN DEFAULT FALSE,
    alternatives TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_conditions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    family_member_id INTEGER REFERENCES family_members(id),
    condition_name VARCHAR(255) NOT NULL,
    diagnosis_date DATE,
    severity VARCHAR(20), -- 'mild', 'moderate', 'severe'
    treatment_plan TEXT,
    emergency_protocol TEXT,
    triggers TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS first_aid_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES storage_locations(id),
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- 'bandages', 'medications', 'tools', 'ppe', 'splints'
    quantity INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(50),
    expiration_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- COMMUNICATIONS MODULE
-- ============================================

CREATE TABLE IF NOT EXISTS communication_devices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_type VARCHAR(50), -- 'ham_radio', 'cb_radio', 'frs', 'gmrs', 'satellite', 'phone'
    brand VARCHAR(100),
    model VARCHAR(100),
    callsign VARCHAR(50),
    frequencies TEXT, -- JSON array of frequencies
    battery_type VARCHAR(100),
    last_tested DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    phone_primary VARCHAR(50),
    phone_secondary VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    radio_callsign VARCHAR(50),
    radio_frequency VARCHAR(50),
    notes TEXT,
    contact_order INTEGER,
    is_ice BOOLEAN DEFAULT FALSE, -- In Case of Emergency
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lan_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id),
    message_type VARCHAR(50) DEFAULT 'direct', -- 'direct', 'broadcast', 'bulletin'
    subject VARCHAR(255),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    is_urgent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bulletin_board (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50), -- 'announcement', 'trade', 'request', 'info', 'alert'
    is_pinned BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- KNOWLEDGE & PDF LIBRARY
-- ============================================

CREATE TABLE IF NOT EXISTS pdf_library (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    description TEXT,
    category VARCHAR(100),
    tags TEXT, -- comma-separated
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes INTEGER,
    page_count INTEGER,
    is_public BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_paths (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    difficulty VARCHAR(20),
    estimated_hours INTEGER,
    prerequisites TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_path_items (
    id SERIAL PRIMARY KEY,
    path_id INTEGER REFERENCES learning_paths(id) ON DELETE CASCADE,
    item_order INTEGER NOT NULL,
    item_type VARCHAR(50), -- 'pdf', 'video', 'skill', 'checklist', 'external_link'
    item_id INTEGER, -- reference to the actual item
    title VARCHAR(255),
    description TEXT,
    duration_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS user_learning_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    path_id INTEGER REFERENCES learning_paths(id) ON DELETE CASCADE,
    current_item_id INTEGER REFERENCES learning_path_items(id),
    percent_complete DECIMAL(5, 2) DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP,
    completed_at TIMESTAMP,
    UNIQUE(user_id, path_id)
);

-- ============================================
-- PLANT & FORAGING DATABASE
-- ============================================

CREATE TABLE IF NOT EXISTS plants (
    id SERIAL PRIMARY KEY,
    common_name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255),
    family VARCHAR(100),
    region TEXT, -- JSON array of regions
    habitat TEXT,
    season TEXT, -- JSON: {"spring": true, "summer": true, "fall": false, "winter": false}
    edible_parts TEXT, -- JSON array
    preparation_methods TEXT,
    nutritional_info TEXT,
    medicinal_uses TEXT,
    warnings TEXT,
    look_alikes TEXT,
    image_urls TEXT, -- JSON array
    difficulty VARCHAR(20), -- 'easy', 'moderate', 'expert_only'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- COMMUNITY & BARTER MODULE
-- ============================================

CREATE TABLE IF NOT EXISTS barter_listings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    listing_type VARCHAR(20), -- 'offer', 'want', 'trade'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    quantity VARCHAR(100),
    trade_for TEXT,
    location_general VARCHAR(255), -- general area, not exact
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resource_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(50), -- 'need', 'offer_help', 'info'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    urgency VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    is_fulfilled BOOLEAN DEFAULT FALSE,
    fulfilled_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fulfilled_at TIMESTAMP
);

-- ============================================
-- SYSTEM & SYNC
-- ============================================

CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255),
    sync_type VARCHAR(50), -- 'full', 'incremental', 'push', 'pull'
    tables_synced TEXT, -- JSON array
    records_synced INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20), -- 'pending', 'in_progress', 'completed', 'failed'
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, setting_key)
);

CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    details TEXT, -- JSON
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EXTENDED CHECKLIST TEMPLATES
-- ============================================

-- Pre-populate with useful checklist templates
INSERT INTO checklists (user_id, name, description, checklist_type, is_template) VALUES
(NULL, '72-Hour Emergency Kit', 'Basic supplies for 72 hours of self-sufficiency', 'emergency_kit', true),
(NULL, 'Bug Out Bag (BOB)', 'Portable emergency bag for evacuation', 'bug_out_bag', true),
(NULL, 'Vehicle Emergency Kit', 'Supplies to keep in your vehicle', 'vehicle', true),
(NULL, 'First Week Prep - Beginner', 'Essential first steps for new preppers', 'beginner', true),
(NULL, 'Power Outage Preparation', 'Checklist for extended power outages', 'power_outage', true),
(NULL, 'Hurricane Preparation', 'Pre-hurricane checklist', 'hurricane', true),
(NULL, 'Winter Storm Preparation', 'Cold weather emergency prep', 'winter_storm', true),
(NULL, 'Home Canning Safety', 'Safety checklist for home canning', 'canning', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- INDEXES FOR NEW TABLES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_storage_locations_user ON storage_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_ammo_user ON ammo_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_ammo_caliber ON ammo_inventory(caliber);
CREATE INDEX IF NOT EXISTS idx_water_user ON water_storage(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_expiry ON medications(expiration_date);
CREATE INDEX IF NOT EXISTS idx_fuel_user ON fuel_log(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON lan_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_pdf_category ON pdf_library(category);
CREATE INDEX IF NOT EXISTS idx_plants_name ON plants(common_name);
CREATE INDEX IF NOT EXISTS idx_barter_active ON barter_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_time ON activity_log(created_at);

-- ============================================
-- ADD COLUMNS TO EXISTING TABLES (safe to re-run)
-- ============================================

-- Add location_id to inventory_items if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='inventory_items' AND column_name='location_id') THEN
        ALTER TABLE inventory_items ADD COLUMN location_id INTEGER REFERENCES storage_locations(id);
    END IF;
END $$;

-- Add calories_total to inventory_items if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='inventory_items' AND column_name='calories_total') THEN
        ALTER TABLE inventory_items ADD COLUMN calories_total INTEGER;
    END IF;
END $$;

-- Add condition field to inventory_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='inventory_items' AND column_name='condition') THEN
        ALTER TABLE inventory_items ADD COLUMN condition VARCHAR(50) DEFAULT 'good';
    END IF;
END $$;

COMMENT ON TABLE storage_locations IS 'Multiple storage locations for inventory';
COMMENT ON TABLE power_equipment IS 'Generators, solar panels, batteries, inverters';
COMMENT ON TABLE power_loads IS 'Electrical devices and their power consumption';
COMMENT ON TABLE medications IS 'Prescription and OTC medication tracking';
COMMENT ON TABLE lan_messages IS 'Local network messaging system';
COMMENT ON TABLE plants IS 'Edible and medicinal plant database';

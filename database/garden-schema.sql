-- =====================================================
-- SPS Garden & Production Module Database Schema
-- Complete garden management with plant knowledge DB,
-- logbooks, environmental data, and production tracking
-- =====================================================

-- =====================================================
-- 1. PLANT KNOWLEDGE DATABASE (Plant Guides)
-- =====================================================

-- Plant guides: rich knowledge records for growing information
CREATE TABLE IF NOT EXISTS plant_guides (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- NULL for built-in defaults

    -- Basic identification
    common_name VARCHAR(255) NOT NULL,
    latin_name VARCHAR(255),
    variety_name VARCHAR(255),  -- Specific cultivars
    category VARCHAR(100),  -- vegetable, fruit, herb, grain, legume, tree, shrub, flower

    -- Growing requirements
    hardiness_zones VARCHAR(50),  -- e.g., "5-9"
    sun_requirements VARCHAR(100),  -- full sun, partial sun, partial shade, full shade
    water_requirements VARCHAR(100),  -- low, medium, high
    water_notes TEXT,
    soil_type VARCHAR(100),  -- loam, sandy, clay, silty, peaty, chalky
    soil_ph_range VARCHAR(50),  -- e.g., "6.0-7.0"

    -- Spacing and planting
    planting_depth_cm NUMERIC(5,2),
    row_spacing_cm NUMERIC(6,2),
    plant_spacing_cm NUMERIC(6,2),

    -- Timing
    days_to_germination_min INTEGER,
    days_to_germination_max INTEGER,
    days_to_maturity_min INTEGER,
    days_to_maturity_max INTEGER,

    -- Frost and temperature
    frost_tolerance VARCHAR(50),  -- none, light (-2C), moderate (-4C), hard (-8C+)
    min_soil_temp_c NUMERIC(4,1),  -- Minimum soil temp for planting
    optimal_temp_min_c NUMERIC(4,1),
    optimal_temp_max_c NUMERIC(4,1),
    base_temp_gdd_c NUMERIC(4,1) DEFAULT 10,  -- Base temp for Growing Degree Days calculation

    -- Planting methods and timing
    planting_window_notes TEXT,  -- spring/fall planting, succession notes
    sowing_method VARCHAR(100),  -- direct sow, transplant, indoor start
    indoor_start_offset_days INTEGER,  -- Days before last frost to start indoors
    transplant_after_frost BOOLEAN DEFAULT true,

    -- Companion planting
    companion_plants TEXT,
    bad_companions TEXT,

    -- Pest and disease management
    pests_common TEXT,
    diseases_common TEXT,
    organic_treatments TEXT,

    -- Care requirements
    fertilizer_needs TEXT,
    pruning_training_notes TEXT,
    mulching_notes TEXT,
    support_requirements TEXT,  -- staking, trellising, caging

    -- Harvest and storage
    harvest_indicators TEXT,  -- How to know when to harvest
    harvest_method TEXT,
    storage_temp_c NUMERIC(4,1),
    storage_humidity_percent INTEGER,
    storage_duration_days INTEGER,
    storage_notes TEXT,

    -- Seed saving
    saving_seed_notes TEXT,
    pollination_type VARCHAR(50),  -- self, insect, wind, hand
    isolation_distance_m INTEGER,
    seed_viability_years INTEGER,

    -- Nutritional defaults (for yield calculations)
    default_calories_per_100g INTEGER,
    default_yield_per_sqft_grams NUMERIC(8,2),
    default_protein_per_100g NUMERIC(5,2),
    default_carbs_per_100g NUMERIC(5,2),
    default_fat_per_100g NUMERIC(5,2),
    default_fiber_per_100g NUMERIC(5,2),

    -- User notes and meta
    notes_user TEXT,
    image_url TEXT,
    source_type VARCHAR(20) DEFAULT 'user',  -- 'builtin' or 'user'

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_plant_guides_user ON plant_guides(user_id);
CREATE INDEX idx_plant_guides_common_name ON plant_guides(common_name);
CREATE INDEX idx_plant_guides_category ON plant_guides(category);
CREATE INDEX idx_plant_guides_source ON plant_guides(source_type);

-- =====================================================
-- 2. GARDENS (Physical garden plots/areas)
-- =====================================================

CREATE TABLE IF NOT EXISTS gardens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    description TEXT,
    location_description TEXT,  -- Physical location notes

    -- Area measurements
    total_area_sqft NUMERIC(10,2),
    total_area_sqm NUMERIC(10,2),

    -- Climate settings for this garden
    usda_zone VARCHAR(10),
    last_frost_date DATE,  -- Average last frost date
    first_frost_date DATE,  -- Average first frost date
    climate_notes TEXT,
    hemisphere VARCHAR(10) DEFAULT 'northern',  -- northern or southern

    -- Garden type
    garden_type VARCHAR(100),  -- raised beds, in-ground, container, greenhouse, hydroponic
    is_covered BOOLEAN DEFAULT false,  -- Greenhouse, hoop house, etc.
    irrigation_type VARCHAR(100),  -- drip, sprinkler, hand watering, none

    -- Status
    status VARCHAR(50) DEFAULT 'active',  -- active, fallow, planned

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gardens_user ON gardens(user_id);
CREATE INDEX idx_gardens_status ON gardens(status);

-- =====================================================
-- 3. GARDEN BEDS (Subdivisions within gardens)
-- =====================================================

CREATE TABLE IF NOT EXISTS garden_beds (
    id SERIAL PRIMARY KEY,
    garden_id INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    bed_type VARCHAR(100),  -- raised bed, row, container, section

    -- Dimensions
    length_ft NUMERIC(6,2),
    width_ft NUMERIC(6,2),
    area_sqft NUMERIC(8,2),

    -- Position (for garden mapping)
    position_x INTEGER,
    position_y INTEGER,

    -- Soil info for this specific bed
    soil_type VARCHAR(100),
    soil_amendments TEXT,
    last_amended_date DATE,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_garden_beds_garden ON garden_beds(garden_id);
CREATE INDEX idx_garden_beds_user ON garden_beds(user_id);

-- =====================================================
-- 4. GARDEN PLANTS (Individual plantings)
-- =====================================================

CREATE TABLE IF NOT EXISTS garden_plants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    garden_id INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
    garden_bed_id INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL,
    plant_guide_id INTEGER REFERENCES plant_guides(id) ON DELETE SET NULL,

    -- Plant identification (can override plant_guide values)
    plant_name VARCHAR(255) NOT NULL,
    variety VARCHAR(255),

    -- Planting details
    quantity INTEGER DEFAULT 1,
    area_sqft NUMERIC(8,2),
    row_label VARCHAR(50),

    -- Dates
    seed_start_date DATE,  -- Indoor start date if applicable
    transplant_date DATE,
    direct_sow_date DATE,
    planting_date DATE NOT NULL,  -- The main planting date
    expected_harvest_date DATE,
    actual_harvest_date DATE,

    -- Growing conditions at planting
    planting_method VARCHAR(100),  -- direct sow, transplant, cutting, division
    seed_source VARCHAR(255),
    is_organic BOOLEAN DEFAULT false,
    is_heirloom BOOLEAN DEFAULT false,

    -- Environment at planting
    soil_temp_at_planting_c NUMERIC(4,1),
    air_temp_at_planting_c NUMERIC(4,1),
    conditions_at_planting TEXT,  -- sunny, cloudy, rainy

    -- Protection
    row_cover BOOLEAN DEFAULT false,
    mulched BOOLEAN DEFAULT false,
    mulch_type VARCHAR(100),

    -- Status tracking
    status VARCHAR(50) DEFAULT 'planted',  -- planted, growing, flowering, fruiting, harvested, failed, removed
    germination_date DATE,
    first_flower_date DATE,
    first_fruit_date DATE,

    -- Yield tracking (calculated/updated from harvests)
    total_harvested_grams NUMERIC(10,2) DEFAULT 0,
    total_harvested_count INTEGER DEFAULT 0,

    -- Expected yield (from plant_guide or manual)
    expected_yield_grams NUMERIC(10,2),

    -- GDD tracking
    accumulated_gdd NUMERIC(8,2) DEFAULT 0,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_garden_plants_user ON garden_plants(user_id);
CREATE INDEX idx_garden_plants_garden ON garden_plants(garden_id);
CREATE INDEX idx_garden_plants_bed ON garden_plants(garden_bed_id);
CREATE INDEX idx_garden_plants_guide ON garden_plants(plant_guide_id);
CREATE INDEX idx_garden_plants_status ON garden_plants(status);
CREATE INDEX idx_garden_plants_planting_date ON garden_plants(planting_date);

-- =====================================================
-- 5. HARVESTS (Harvest records linked to plantings)
-- =====================================================

CREATE TABLE IF NOT EXISTS garden_harvests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    garden_plant_id INTEGER REFERENCES garden_plants(id) ON DELETE SET NULL,
    garden_id INTEGER REFERENCES gardens(id) ON DELETE SET NULL,
    plant_guide_id INTEGER REFERENCES plant_guides(id) ON DELETE SET NULL,

    -- Harvest details
    harvest_date DATE NOT NULL,
    harvest_time TIME,

    -- Quantity
    weight_grams NUMERIC(10,2),
    count INTEGER,  -- For items counted (tomatoes, peppers, etc.)
    unit VARCHAR(50),  -- lbs, kg, count, bunches

    -- Quality
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    quality_notes TEXT,

    -- Processing/destination
    destination VARCHAR(100),  -- fresh use, storage, canning, freezing, drying, selling, sharing
    storage_location VARCHAR(255),

    -- Nutritional calculation (from plant_guide or override)
    calories_total INTEGER,

    -- Linked to pantry
    pantry_item_id INTEGER,  -- If preserved and added to pantry

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_garden_harvests_user ON garden_harvests(user_id);
CREATE INDEX idx_garden_harvests_plant ON garden_harvests(garden_plant_id);
CREATE INDEX idx_garden_harvests_garden ON garden_harvests(garden_id);
CREATE INDEX idx_garden_harvests_date ON garden_harvests(harvest_date);

-- =====================================================
-- 6. GARDEN LOGS (Logbook for garden and plants)
-- =====================================================

CREATE TABLE IF NOT EXISTS garden_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    garden_id INTEGER REFERENCES gardens(id) ON DELETE SET NULL,
    garden_plant_id INTEGER REFERENCES garden_plants(id) ON DELETE SET NULL,
    garden_bed_id INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL,
    plant_guide_id INTEGER REFERENCES plant_guides(id) ON DELETE SET NULL,

    -- Entry timing
    entry_date DATE NOT NULL,
    entry_time TIME,
    season VARCHAR(50),  -- spring 2026, summer 2026, fall 2026, winter 2026-27

    -- Weather and environment
    weather_summary TEXT,  -- cool and rainy, hot and dry, etc.
    temperature_c NUMERIC(4,1),
    temperature_max_c NUMERIC(4,1),
    temperature_min_c NUMERIC(4,1),
    soil_temperature_c NUMERIC(4,1),
    humidity_percent NUMERIC(4,1),
    rain_mm NUMERIC(6,2),
    wind_notes TEXT,
    sky_conditions VARCHAR(100),  -- sunny, partly cloudy, overcast, rainy, snowy

    -- Action/entry type
    action_type VARCHAR(50) NOT NULL,  -- planted, fertilized, watered, pruned, harvested, pest_issue, disease_issue, germination, flowering, fruiting, environment, note, photo, observation
    action_details TEXT,

    -- Specific action data
    water_amount_liters NUMERIC(8,2),
    fertilizer_type VARCHAR(255),
    fertilizer_amount TEXT,
    pest_identified VARCHAR(255),
    disease_identified VARCHAR(255),
    treatment_applied TEXT,

    -- Photo/media
    photo_reference TEXT,  -- Path or ID for photo storage

    -- Data source
    device_source VARCHAR(50) DEFAULT 'manual',  -- manual, imported, sensor, weather_station

    -- GDD calculation for this day (if temperature data available)
    gdd_calculated NUMERIC(6,2),

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_garden_logs_user ON garden_logs(user_id);
CREATE INDEX idx_garden_logs_garden ON garden_logs(garden_id);
CREATE INDEX idx_garden_logs_plant ON garden_logs(garden_plant_id);
CREATE INDEX idx_garden_logs_bed ON garden_logs(garden_bed_id);
CREATE INDEX idx_garden_logs_date ON garden_logs(entry_date);
CREATE INDEX idx_garden_logs_action ON garden_logs(action_type);
CREATE INDEX idx_garden_logs_device ON garden_logs(device_source);

-- =====================================================
-- 7. ENVIRONMENT DATA (Bulk environmental readings)
-- =====================================================

CREATE TABLE IF NOT EXISTS garden_environment (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    garden_id INTEGER REFERENCES gardens(id) ON DELETE SET NULL,
    garden_bed_id INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL,

    -- Timestamp
    reading_timestamp TIMESTAMP NOT NULL,
    reading_date DATE GENERATED ALWAYS AS (reading_timestamp::date) STORED,

    -- Temperature
    temperature_c NUMERIC(5,2),
    temperature_max_c NUMERIC(5,2),
    temperature_min_c NUMERIC(5,2),
    soil_temperature_c NUMERIC(5,2),
    soil_temperature_depth_cm INTEGER,

    -- Moisture
    humidity_percent NUMERIC(5,2),
    soil_moisture_percent NUMERIC(5,2),
    rainfall_mm NUMERIC(8,2),

    -- Light
    light_hours NUMERIC(4,2),
    uv_index NUMERIC(4,2),

    -- Wind
    wind_speed_kmh NUMERIC(5,2),
    wind_direction VARCHAR(10),

    -- Pressure
    barometric_pressure_hpa NUMERIC(6,2),

    -- Source
    device_source VARCHAR(100) DEFAULT 'manual',  -- manual, sensor, csv_import, weather_station
    device_id VARCHAR(255),  -- Identifier for the sensor/device

    -- GDD calculation
    gdd_calculated NUMERIC(6,2),

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_garden_env_user ON garden_environment(user_id);
CREATE INDEX idx_garden_env_garden ON garden_environment(garden_id);
CREATE INDEX idx_garden_env_timestamp ON garden_environment(reading_timestamp);
CREATE INDEX idx_garden_env_date ON garden_environment(reading_date);
CREATE INDEX idx_garden_env_device ON garden_environment(device_source);

-- =====================================================
-- 8. GARDEN TASKS (Planning and scheduling)
-- =====================================================

CREATE TABLE IF NOT EXISTS garden_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    garden_id INTEGER REFERENCES gardens(id) ON DELETE SET NULL,
    garden_plant_id INTEGER REFERENCES garden_plants(id) ON DELETE SET NULL,
    garden_bed_id INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL,

    -- Task details
    task_type VARCHAR(100) NOT NULL,  -- water, fertilize, prune, harvest, plant, transplant, pest_control, weed, mulch, other
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Scheduling
    due_date DATE,
    due_time TIME,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(100),  -- daily, weekly, biweekly, monthly
    recurrence_end_date DATE,

    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- pending, completed, skipped, overdue
    completed_date TIMESTAMP,

    -- Priority
    priority VARCHAR(20) DEFAULT 'medium',  -- low, medium, high, urgent

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_garden_tasks_user ON garden_tasks(user_id);
CREATE INDEX idx_garden_tasks_garden ON garden_tasks(garden_id);
CREATE INDEX idx_garden_tasks_due ON garden_tasks(due_date);
CREATE INDEX idx_garden_tasks_status ON garden_tasks(status);

-- =====================================================
-- 9. CROPS (Crop types for yield/calorie tracking)
-- This supplements plant_guides for production calculations
-- =====================================================

CREATE TABLE IF NOT EXISTS crops (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- NULL for system defaults
    plant_guide_id INTEGER REFERENCES plant_guides(id) ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),  -- vegetable, fruit, grain, legume, herb

    -- Yield data
    avg_yield_per_sqft_grams NUMERIC(8,2),
    avg_yield_per_plant_grams NUMERIC(8,2),

    -- Nutritional data
    calories_per_100g INTEGER,
    protein_per_100g NUMERIC(5,2),
    carbs_per_100g NUMERIC(5,2),
    fat_per_100g NUMERIC(5,2),
    fiber_per_100g NUMERIC(5,2),

    -- Growing info
    days_to_maturity INTEGER,
    seasons_per_year INTEGER DEFAULT 1,

    -- Preservation
    can_store_fresh BOOLEAN DEFAULT true,
    can_freeze BOOLEAN DEFAULT false,
    can_can BOOLEAN DEFAULT false,
    can_dry BOOLEAN DEFAULT false,

    source_type VARCHAR(20) DEFAULT 'user',  -- 'builtin' or 'user'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crops_user ON crops(user_id);
CREATE INDEX idx_crops_plant_guide ON crops(plant_guide_id);
CREATE INDEX idx_crops_category ON crops(category);

-- =====================================================
-- 10. SEED INVENTORY (Track saved and purchased seeds)
-- =====================================================

CREATE TABLE IF NOT EXISTS seed_inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plant_guide_id INTEGER REFERENCES plant_guides(id) ON DELETE SET NULL,

    -- Seed identification
    plant_name VARCHAR(255) NOT NULL,
    variety VARCHAR(255),
    source VARCHAR(255),  -- Where acquired: saved, purchased vendor name, traded

    -- Quantity
    quantity_seeds INTEGER,
    quantity_weight_grams NUMERIC(8,2),
    packet_count INTEGER,

    -- Dates
    harvest_year INTEGER,
    purchase_date DATE,
    expiration_date DATE,

    -- Quality
    germination_rate_percent INTEGER,
    test_date DATE,

    -- Storage
    storage_location VARCHAR(255),
    storage_conditions TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'available',  -- available, low, depleted, expired

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_seed_inv_user ON seed_inventory(user_id);
CREATE INDEX idx_seed_inv_guide ON seed_inventory(plant_guide_id);
CREATE INDEX idx_seed_inv_status ON seed_inventory(status);

-- =====================================================
-- 11. CLIMATE SETTINGS (Per-user climate configuration)
-- =====================================================

CREATE TABLE IF NOT EXISTS climate_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Location
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    elevation_m INTEGER,

    -- Climate zone
    usda_zone VARCHAR(10),
    koppen_climate VARCHAR(10),

    -- Frost dates (averages)
    avg_last_frost_date DATE,
    avg_first_frost_date DATE,

    -- Growing season
    growing_season_days INTEGER,
    frost_free_days INTEGER,

    -- Temperature averages
    avg_summer_high_c NUMERIC(4,1),
    avg_winter_low_c NUMERIC(4,1),

    -- Precipitation
    avg_annual_rainfall_mm INTEGER,

    -- Hemisphere
    hemisphere VARCHAR(10) DEFAULT 'northern',

    -- Display preferences
    temp_unit VARCHAR(10) DEFAULT 'celsius',  -- celsius or fahrenheit
    distance_unit VARCHAR(10) DEFAULT 'metric',  -- metric or imperial

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 12. INSERT DEFAULT PLANT GUIDES (Builtin entries)
-- =====================================================

-- Common vegetables with complete growing information
INSERT INTO plant_guides (
    user_id, common_name, latin_name, category, source_type,
    hardiness_zones, sun_requirements, water_requirements,
    soil_type, soil_ph_range,
    planting_depth_cm, row_spacing_cm, plant_spacing_cm,
    days_to_germination_min, days_to_germination_max,
    days_to_maturity_min, days_to_maturity_max,
    frost_tolerance, min_soil_temp_c, optimal_temp_min_c, optimal_temp_max_c,
    base_temp_gdd_c, sowing_method, indoor_start_offset_days, transplant_after_frost,
    companion_plants, bad_companions, pests_common, diseases_common,
    harvest_indicators, storage_notes,
    default_calories_per_100g, default_yield_per_sqft_grams
) VALUES
-- Tomato
(NULL, 'Tomato', 'Solanum lycopersicum', 'vegetable', 'builtin',
 '3-11', 'full sun', 'medium',
 'loam', '6.0-6.8',
 0.6, 90, 60,
 5, 10, 60, 90,
 'none', 15, 21, 29,
 10, 'transplant', 42, true,
 'Basil, Carrots, Parsley, Marigolds', 'Brassicas, Fennel, Corn',
 'Tomato hornworm, Aphids, Whiteflies', 'Blight, Fusarium wilt, Blossom end rot',
 'Deep red color, slight give when pressed, easily detaches from vine', 'Store at room temp until ripe, then refrigerate. Best within 1-2 weeks.',
 18, 500),

-- Potato
(NULL, 'Potato', 'Solanum tuberosum', 'vegetable', 'builtin',
 '3-10', 'full sun', 'medium',
 'loam', '5.0-6.0',
 10, 75, 30,
 14, 21, 70, 120,
 'light', 7, 15, 20,
 7, 'direct sow', NULL, false,
 'Beans, Corn, Cabbage, Horseradish', 'Tomatoes, Squash, Sunflowers',
 'Colorado potato beetle, Aphids, Wireworms', 'Late blight, Scab, Blackleg',
 'Foliage dies back, skin sets firm', 'Cure 1-2 weeks in dark at 7-15C. Store at 4-7C, 85% humidity for months.',
 77, 1000),

-- Carrot
(NULL, 'Carrot', 'Daucus carota', 'vegetable', 'builtin',
 '3-10', 'full sun', 'medium',
 'sandy loam', '6.0-6.8',
 0.6, 30, 5,
 10, 21, 60, 80,
 'moderate', 7, 15, 21,
 4.4, 'direct sow', NULL, false,
 'Onions, Leeks, Lettuce, Tomatoes', 'Dill, Parsnips',
 'Carrot rust fly, Aphids, Wireworms', 'Leaf blight, Root rot',
 'Shoulders 1-2cm diameter visible at soil surface, bright color', 'Remove tops. Store at 0-4C, 95% humidity for 4-6 months.',
 41, 600),

-- Lettuce
(NULL, 'Lettuce', 'Lactuca sativa', 'vegetable', 'builtin',
 '4-9', 'partial sun', 'medium',
 'loam', '6.0-7.0',
 0.3, 30, 20,
 4, 10, 45, 80,
 'light', 4, 15, 21,
 4.4, 'direct sow', 21, false,
 'Carrots, Radishes, Strawberries, Chives', 'Celery, Parsley',
 'Aphids, Slugs, Cutworms', 'Downy mildew, Bottom rot, Tip burn',
 'Leaves full size, head firm (head types), before bolting', 'Refrigerate in plastic bag. Best within 1 week.',
 15, 400),

-- Beans (Green)
(NULL, 'Green Bean', 'Phaseolus vulgaris', 'legume', 'builtin',
 '3-10', 'full sun', 'medium',
 'loam', '6.0-7.0',
 2.5, 45, 10,
 7, 14, 50, 65,
 'none', 15, 18, 27,
 10, 'direct sow', NULL, true,
 'Corn, Squash, Carrots, Celery', 'Onions, Garlic, Fennel',
 'Mexican bean beetle, Aphids, Spider mites', 'Bean rust, Bacterial blight, Mosaic virus',
 'Pods snap easily, seeds not bulging', 'Refrigerate in plastic bag. Best within 1 week. Blanch and freeze for long storage.',
 31, 300),

-- Zucchini
(NULL, 'Zucchini', 'Cucurbita pepo', 'vegetable', 'builtin',
 '3-11', 'full sun', 'high',
 'loam', '6.0-7.5',
 2.5, 120, 90,
 5, 10, 45, 60,
 'none', 18, 21, 29,
 10, 'direct sow', 21, true,
 'Corn, Beans, Radishes, Marigolds', 'Potatoes',
 'Squash bug, Cucumber beetle, Vine borer', 'Powdery mildew, Blossom end rot',
 '15-20cm long, glossy skin, easily pierced with fingernail', 'Refrigerate up to 1 week. Best fresh.',
 17, 800),

-- Pepper (Bell)
(NULL, 'Bell Pepper', 'Capsicum annuum', 'vegetable', 'builtin',
 '4-11', 'full sun', 'medium',
 'loam', '6.0-6.8',
 0.6, 60, 45,
 7, 14, 60, 90,
 'none', 18, 21, 29,
 10, 'transplant', 56, true,
 'Tomatoes, Basil, Carrots, Onions', 'Fennel, Brassicas',
 'Aphids, Pepper weevil, Spider mites', 'Bacterial spot, Anthracnose, Blossom end rot',
 'Full size, firm, desired color achieved', 'Refrigerate up to 2 weeks. Can freeze chopped.',
 20, 350),

-- Cucumber
(NULL, 'Cucumber', 'Cucumis sativus', 'vegetable', 'builtin',
 '4-11', 'full sun', 'high',
 'loam', '6.0-7.0',
 2.5, 120, 30,
 5, 10, 50, 70,
 'none', 18, 21, 29,
 15.5, 'direct sow', 21, true,
 'Beans, Corn, Peas, Radishes, Sunflowers', 'Potatoes, Aromatic herbs',
 'Cucumber beetle, Aphids, Spider mites', 'Powdery mildew, Bacterial wilt, Mosaic virus',
 'Dark green color, firm, appropriate size for variety', 'Refrigerate up to 1 week. Best fresh.',
 15, 450),

-- Onion
(NULL, 'Onion', 'Allium cepa', 'vegetable', 'builtin',
 '3-9', 'full sun', 'medium',
 'loam', '6.0-7.0',
 1.3, 30, 10,
 7, 14, 90, 150,
 'hard', 10, 13, 24,
 4.4, 'transplant', 56, false,
 'Carrots, Lettuce, Beets, Tomatoes', 'Beans, Peas, Asparagus',
 'Onion thrips, Onion maggot', 'Downy mildew, Botrytis, Pink root',
 'Tops fall over and brown, bulb fully formed', 'Cure 2-3 weeks. Store at 0-4C, 65% humidity for months.',
 40, 500),

-- Garlic
(NULL, 'Garlic', 'Allium sativum', 'vegetable', 'builtin',
 '3-8', 'full sun', 'low',
 'loam', '6.0-7.0',
 5, 30, 15,
 7, 14, 180, 240,
 'hard', 0, 13, 24,
 0, 'direct sow', NULL, false,
 'Tomatoes, Peppers, Spinach, Carrots', 'Beans, Peas, Asparagus',
 'Onion thrips, Nematodes', 'White rot, Rust, Fusarium',
 'Lower leaves yellow/brown, scapes removed (hardneck)', 'Cure 2-4 weeks. Store at room temp or 0C, low humidity for 6+ months.',
 149, 300),

-- Spinach
(NULL, 'Spinach', 'Spinacia oleracea', 'vegetable', 'builtin',
 '3-9', 'partial sun', 'medium',
 'loam', '6.5-7.5',
 1.3, 30, 10,
 5, 14, 40, 50,
 'hard', 5, 10, 21,
 2.2, 'direct sow', NULL, false,
 'Strawberries, Peas, Beans, Cabbage', 'None significant',
 'Aphids, Leafminers, Slugs', 'Downy mildew, Fusarium wilt',
 'Leaves full size before bolting', 'Refrigerate in plastic bag. Best within 1 week. Blanch and freeze.',
 23, 350),

-- Kale
(NULL, 'Kale', 'Brassica oleracea var. sabellica', 'vegetable', 'builtin',
 '7-9', 'full sun', 'medium',
 'loam', '6.0-7.5',
 1.3, 45, 30,
 5, 10, 55, 75,
 'hard', 5, 15, 21,
 4.4, 'direct sow', 21, false,
 'Beets, Celery, Onions, Potatoes', 'Tomatoes, Strawberries, Beans',
 'Cabbage worms, Aphids, Flea beetles', 'Black rot, Clubroot, Downy mildew',
 'Leaves full size, firm texture', 'Refrigerate up to 2 weeks. Flavor improves after frost. Freezes well.',
 49, 400),

-- Broccoli
(NULL, 'Broccoli', 'Brassica oleracea var. italica', 'vegetable', 'builtin',
 '3-10', 'full sun', 'medium',
 'loam', '6.0-7.0',
 1.3, 60, 45,
 5, 10, 55, 80,
 'moderate', 10, 15, 21,
 4.4, 'transplant', 35, false,
 'Beets, Celery, Onions, Potatoes', 'Tomatoes, Strawberries, Beans',
 'Cabbage worms, Aphids, Flea beetles', 'Black rot, Clubroot, Downy mildew',
 'Head tight and firm, before flowers open', 'Refrigerate up to 2 weeks. Blanch and freeze for long storage.',
 34, 350),

-- Cabbage
(NULL, 'Cabbage', 'Brassica oleracea var. capitata', 'vegetable', 'builtin',
 '1-10', 'full sun', 'medium',
 'loam', '6.0-7.5',
 1.3, 60, 45,
 5, 10, 70, 120,
 'moderate', 10, 15, 21,
 4.4, 'transplant', 35, false,
 'Beets, Celery, Onions, Potatoes, Dill', 'Tomatoes, Strawberries, Beans',
 'Cabbage worms, Aphids, Flea beetles, Slugs', 'Black rot, Clubroot, Yellows',
 'Head firm and solid when squeezed', 'Store at 0-4C, 95% humidity for months. Can make sauerkraut.',
 25, 700),

-- Peas
(NULL, 'Pea', 'Pisum sativum', 'legume', 'builtin',
 '3-11', 'full sun', 'medium',
 'loam', '6.0-7.5',
 2.5, 45, 5,
 7, 14, 55, 70,
 'moderate', 4, 13, 18,
 4.4, 'direct sow', NULL, false,
 'Carrots, Corn, Cucumbers, Beans, Turnips', 'Onions, Garlic',
 'Pea aphids, Pea weevil, Thrips', 'Powdery mildew, Fusarium wilt, Root rot',
 'Pods plump (shelling) or flat and young (snap)', 'Refrigerate up to 1 week. Best fresh or frozen immediately.',
 81, 250),

-- Corn (Sweet)
(NULL, 'Sweet Corn', 'Zea mays', 'grain', 'builtin',
 '4-11', 'full sun', 'high',
 'loam', '6.0-6.8',
 5, 75, 30,
 7, 14, 60, 100,
 'none', 15, 21, 29,
 10, 'direct sow', NULL, true,
 'Beans, Squash, Cucumbers, Melons', 'Tomatoes',
 'Corn earworm, European corn borer, Aphids', 'Corn smut, Rust, Stewart wilt',
 'Silks brown and dry, kernels milky when pierced', 'Best eaten immediately. Refrigerate up to 3 days.',
 86, 300),

-- Squash (Butternut)
(NULL, 'Butternut Squash', 'Cucurbita moschata', 'vegetable', 'builtin',
 '3-11', 'full sun', 'medium',
 'loam', '6.0-6.8',
 2.5, 180, 120,
 7, 14, 85, 110,
 'none', 18, 21, 29,
 15.5, 'direct sow', 21, true,
 'Corn, Beans, Radishes, Marigolds', 'Potatoes',
 'Squash bug, Cucumber beetle, Vine borer', 'Powdery mildew, Bacterial wilt',
 'Skin hard, cannot pierce with fingernail, stem dry', 'Cure 1-2 weeks in sun. Store at 10-15C for months.',
 45, 600),

-- Beet
(NULL, 'Beet', 'Beta vulgaris', 'vegetable', 'builtin',
 '2-11', 'full sun', 'medium',
 'loam', '6.0-7.5',
 1.3, 30, 10,
 5, 14, 50, 70,
 'moderate', 10, 15, 21,
 4.4, 'direct sow', NULL, false,
 'Onions, Cabbage, Lettuce, Garlic', 'Pole beans, Field mustard',
 'Leafminers, Aphids, Flea beetles', 'Cercospora leaf spot, Scab',
 'Roots 5-7cm diameter, shoulders visible above soil', 'Remove tops. Store at 0-4C, 95% humidity for months.',
 43, 500),

-- Radish
(NULL, 'Radish', 'Raphanus sativus', 'vegetable', 'builtin',
 '2-11', 'full sun', 'medium',
 'sandy loam', '6.0-7.0',
 1.3, 15, 3,
 3, 7, 22, 30,
 'light', 4, 10, 18,
 4.4, 'direct sow', NULL, false,
 'Carrots, Lettuce, Peas, Cucumbers', 'Hyssop',
 'Flea beetles, Root maggots', 'Clubroot, Black root',
 'Roots 2-4cm diameter, before becoming pithy', 'Refrigerate up to 2 weeks.',
 16, 400)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 13. VIEWS FOR REPORTING
-- =====================================================

-- Garden production summary view
CREATE OR REPLACE VIEW garden_production_summary AS
SELECT
    g.user_id,
    g.id as garden_id,
    g.name as garden_name,
    COUNT(DISTINCT gp.id) as plant_count,
    SUM(gh.weight_grams) as total_harvest_grams,
    SUM(gh.calories_total) as total_calories,
    COUNT(DISTINCT gh.id) as harvest_count,
    MIN(gp.planting_date) as first_planting,
    MAX(gh.harvest_date) as last_harvest
FROM gardens g
LEFT JOIN garden_plants gp ON g.id = gp.garden_id
LEFT JOIN garden_harvests gh ON gp.id = gh.garden_plant_id
GROUP BY g.user_id, g.id, g.name;

-- Plant performance view
CREATE OR REPLACE VIEW plant_performance AS
SELECT
    gp.user_id,
    gp.id as garden_plant_id,
    gp.plant_name,
    gp.variety,
    g.name as garden_name,
    gp.area_sqft,
    gp.planting_date,
    gp.expected_harvest_date,
    gp.actual_harvest_date,
    gp.expected_yield_grams,
    gp.total_harvested_grams,
    gp.accumulated_gdd,
    gp.status,
    CASE
        WHEN gp.expected_yield_grams > 0
        THEN ROUND((gp.total_harvested_grams / gp.expected_yield_grams * 100)::numeric, 1)
        ELSE NULL
    END as yield_percentage
FROM garden_plants gp
JOIN gardens g ON gp.garden_id = g.id;

-- =====================================================
-- 14. FUNCTIONS FOR GDD CALCULATION
-- =====================================================

-- Function to calculate GDD for a single day
CREATE OR REPLACE FUNCTION calculate_gdd(
    temp_max NUMERIC,
    temp_min NUMERIC,
    base_temp NUMERIC DEFAULT 10
) RETURNS NUMERIC AS $$
BEGIN
    RETURN GREATEST(0, ((COALESCE(temp_max, 0) + COALESCE(temp_min, 0)) / 2) - base_temp);
END;
$$ LANGUAGE plpgsql;

-- Function to get accumulated GDD for a plant
CREATE OR REPLACE FUNCTION get_accumulated_gdd(
    p_garden_plant_id INTEGER,
    p_base_temp NUMERIC DEFAULT 10
) RETURNS NUMERIC AS $$
DECLARE
    total_gdd NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(calculate_gdd(temperature_max_c, temperature_min_c, p_base_temp)), 0)
    INTO total_gdd
    FROM garden_logs
    WHERE garden_plant_id = p_garden_plant_id
    AND temperature_max_c IS NOT NULL
    AND temperature_min_c IS NOT NULL;

    RETURN total_gdd;
END;
$$ LANGUAGE plpgsql;

-- Function to determine season from date and hemisphere
CREATE OR REPLACE FUNCTION get_season(
    p_date DATE,
    p_hemisphere VARCHAR DEFAULT 'northern'
) RETURNS VARCHAR AS $$
DECLARE
    month_num INTEGER;
BEGIN
    month_num := EXTRACT(MONTH FROM p_date);

    IF p_hemisphere = 'northern' THEN
        CASE
            WHEN month_num IN (3, 4, 5) THEN RETURN 'spring ' || EXTRACT(YEAR FROM p_date);
            WHEN month_num IN (6, 7, 8) THEN RETURN 'summer ' || EXTRACT(YEAR FROM p_date);
            WHEN month_num IN (9, 10, 11) THEN RETURN 'fall ' || EXTRACT(YEAR FROM p_date);
            ELSE RETURN 'winter ' || EXTRACT(YEAR FROM p_date) - CASE WHEN month_num = 12 THEN 0 ELSE 1 END || '-' || EXTRACT(YEAR FROM p_date);
        END CASE;
    ELSE
        CASE
            WHEN month_num IN (9, 10, 11) THEN RETURN 'spring ' || EXTRACT(YEAR FROM p_date);
            WHEN month_num IN (12, 1, 2) THEN RETURN 'summer ' || EXTRACT(YEAR FROM p_date);
            WHEN month_num IN (3, 4, 5) THEN RETURN 'fall ' || EXTRACT(YEAR FROM p_date);
            ELSE RETURN 'winter ' || EXTRACT(YEAR FROM p_date);
        END CASE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
DO $$
BEGIN
    -- Only create triggers if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_plant_guides_updated_at') THEN
        CREATE TRIGGER update_plant_guides_updated_at BEFORE UPDATE ON plant_guides FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_gardens_updated_at') THEN
        CREATE TRIGGER update_gardens_updated_at BEFORE UPDATE ON gardens FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_garden_beds_updated_at') THEN
        CREATE TRIGGER update_garden_beds_updated_at BEFORE UPDATE ON garden_beds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_garden_plants_updated_at') THEN
        CREATE TRIGGER update_garden_plants_updated_at BEFORE UPDATE ON garden_plants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_garden_logs_updated_at') THEN
        CREATE TRIGGER update_garden_logs_updated_at BEFORE UPDATE ON garden_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_garden_tasks_updated_at') THEN
        CREATE TRIGGER update_garden_tasks_updated_at BEFORE UPDATE ON garden_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_crops_updated_at') THEN
        CREATE TRIGGER update_crops_updated_at BEFORE UPDATE ON crops FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_seed_inventory_updated_at') THEN
        CREATE TRIGGER update_seed_inventory_updated_at BEFORE UPDATE ON seed_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_climate_settings_updated_at') THEN
        CREATE TRIGGER update_climate_settings_updated_at BEFORE UPDATE ON climate_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- Trigger to update garden_plants total harvested when harvest is added
CREATE OR REPLACE FUNCTION update_plant_harvest_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE garden_plants
        SET total_harvested_grams = total_harvested_grams + COALESCE(NEW.weight_grams, 0),
            total_harvested_count = total_harvested_count + COALESCE(NEW.count, 0)
        WHERE id = NEW.garden_plant_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE garden_plants
        SET total_harvested_grams = total_harvested_grams - COALESCE(OLD.weight_grams, 0),
            total_harvested_count = total_harvested_count - COALESCE(OLD.count, 0)
        WHERE id = OLD.garden_plant_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE garden_plants
        SET total_harvested_grams = total_harvested_grams - COALESCE(OLD.weight_grams, 0) + COALESCE(NEW.weight_grams, 0),
            total_harvested_count = total_harvested_count - COALESCE(OLD.count, 0) + COALESCE(NEW.count, 0)
        WHERE id = NEW.garden_plant_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_harvest_totals ON garden_harvests;
CREATE TRIGGER update_harvest_totals
AFTER INSERT OR UPDATE OR DELETE ON garden_harvests
FOR EACH ROW EXECUTE FUNCTION update_plant_harvest_totals();

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sps_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sps_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sps_user;

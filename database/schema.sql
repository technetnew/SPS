-- SPS (Survival Preparedness System) Database Schema
-- Database: PostgreSQL (recommended) or MySQL

-- Users and Authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE
);

-- User Sessions for JWT/Session Management
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Inventory Categories
CREATE TABLE inventory_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    parent_category_id INTEGER REFERENCES inventory_categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Items
CREATE TABLE inventory_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES inventory_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unit VARCHAR(50), -- lbs, gallons, units, etc.
    location VARCHAR(255), -- where stored
    purchase_date DATE,
    expiration_date DATE,
    cost DECIMAL(10, 2),
    notes TEXT,
    image_url VARCHAR(500),
    barcode VARCHAR(100),
    min_quantity DECIMAL(10, 2), -- alert threshold
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Transactions (track additions/removals)
CREATE TABLE inventory_transactions (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    transaction_type VARCHAR(20) NOT NULL, -- 'add', 'remove', 'use', 'expire'
    quantity DECIMAL(10, 2) NOT NULL,
    previous_quantity DECIMAL(10, 2),
    new_quantity DECIMAL(10, 2),
    reason TEXT,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency Plans
CREATE TABLE emergency_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL, -- earthquake, fire, flood, evacuation, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20), -- low, medium, high, critical
    status VARCHAR(20) DEFAULT 'draft', -- draft, active, archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plan Steps/Actions
CREATE TABLE plan_steps (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER REFERENCES emergency_plans(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assigned_to INTEGER REFERENCES users(id),
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Family/Group Members
CREATE TABLE family_members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(50), -- spouse, child, parent, friend, etc.
    age INTEGER,
    phone VARCHAR(20),
    email VARCHAR(255),
    medical_conditions TEXT,
    allergies TEXT,
    medications TEXT,
    special_needs TEXT,
    photo_url VARCHAR(500),
    is_primary_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Meeting Points/Locations
CREATE TABLE meeting_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_type VARCHAR(50), -- home, evacuation, shelter, rally_point
    notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills and Training
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- first_aid, shelter, fire, water, food, navigation, etc.
    description TEXT,
    difficulty_level VARCHAR(20), -- beginner, intermediate, advanced
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Skills Progress
CREATE TABLE user_skills (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level VARCHAR(20), -- learning, practicing, proficient, expert
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_practiced TIMESTAMP,
    notes TEXT,
    certification_url VARCHAR(500),
    UNIQUE(user_id, skill_id)
);

-- Alerts and Notifications
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- low_inventory, expiration, training_reminder, weather, etc.
    severity VARCHAR(20), -- info, warning, critical
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Documents and Resources
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50), -- id, insurance, deed, will, medical, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url VARCHAR(500),
    file_size INTEGER, -- bytes
    file_type VARCHAR(50),
    is_encrypted BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Checklists
CREATE TABLE checklists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    checklist_type VARCHAR(50), -- bug_out_bag, 72_hour_kit, vehicle, etc.
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Checklist Items
CREATE TABLE checklist_items (
    id SERIAL PRIMARY KEY,
    checklist_id INTEGER REFERENCES checklists(id) ON DELETE CASCADE,
    item_order INTEGER NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity_needed DECIMAL(10, 2),
    unit VARCHAR(50),
    is_checked BOOLEAN DEFAULT FALSE,
    inventory_item_id INTEGER REFERENCES inventory_items(id), -- link to actual inventory
    checked_at TIMESTAMP,
    notes TEXT
);

-- Shared Access (for family members/groups)
CREATE TABLE shared_access (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    shared_with_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50), -- inventory, plan, document, etc.
    resource_id INTEGER NOT NULL,
    permission_level VARCHAR(20), -- view, edit, admin
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_inventory_user ON inventory_items(user_id);
CREATE INDEX idx_inventory_category ON inventory_items(category_id);
CREATE INDEX idx_inventory_expiration ON inventory_items(expiration_date);
CREATE INDEX idx_plans_user ON emergency_plans(user_id);
CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_unread ON alerts(user_id, is_read);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_sessions_user ON user_sessions(user_id);

-- Sample Data for Categories
INSERT INTO inventory_categories (name, description, icon, parent_category_id) VALUES
('Food & Water', 'Food supplies and water storage', '🍽️', NULL),
('Medical Supplies', 'First aid and medical equipment', '⚕️', NULL),
('Tools & Equipment', 'Survival tools and equipment', '🔧', NULL),
('Shelter & Warmth', 'Tents, sleeping bags, blankets', '⛺', NULL),
('Communication', 'Radios, phones, signaling devices', '📡', NULL),
('Lighting & Power', 'Flashlights, batteries, generators', '💡', NULL),
('Clothing', 'Emergency clothing and protective gear', '👕', NULL),
('Documents', 'Important documents and copies', '📄', NULL);

-- Sample Skills
INSERT INTO skills (name, category, description, difficulty_level) VALUES
('CPR & First Aid', 'first_aid', 'Cardiopulmonary resuscitation and basic first aid', 'beginner'),
('Fire Building', 'fire', 'Starting and maintaining fires in various conditions', 'beginner'),
('Water Purification', 'water', 'Methods to purify and treat water', 'beginner'),
('Shelter Construction', 'shelter', 'Building emergency shelters from natural materials', 'intermediate'),
('Navigation', 'navigation', 'Using map, compass, and natural landmarks', 'intermediate'),
('Food Foraging', 'food', 'Identifying edible plants and safe foraging', 'advanced'),
('Wound Treatment', 'first_aid', 'Advanced wound care and trauma response', 'advanced');

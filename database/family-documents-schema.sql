-- Family Documents and Emergency Contacts Schema
-- Run this to add document management and emergency contact features

-- Family Documents Table
CREATE TABLE IF NOT EXISTS family_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_profile_id INTEGER REFERENCES family_profiles(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'other', -- identification, medical, financial, legal, emergency, other
    document_number VARCHAR(100),
    expiration_date DATE,
    file_path TEXT,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for family_documents
CREATE INDEX IF NOT EXISTS idx_family_documents_user_id ON family_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_family_documents_category ON family_documents(category);
CREATE INDEX IF NOT EXISTS idx_family_documents_family_profile_id ON family_documents(family_profile_id);
CREATE INDEX IF NOT EXISTS idx_family_documents_expiration ON family_documents(expiration_date);

-- Add missing columns to emergency_contacts if they exist with different names
-- First check if the table exists and has different column structure
DO $$
BEGIN
    -- Add phone column if not exists (maps to phone_primary)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'emergency_contacts' AND column_name = 'phone') THEN
        -- Check if phone_primary exists
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'emergency_contacts' AND column_name = 'phone_primary') THEN
            ALTER TABLE emergency_contacts RENAME COLUMN phone_primary TO phone;
        ELSE
            ALTER TABLE emergency_contacts ADD COLUMN phone VARCHAR(50);
        END IF;
    END IF;

    -- Add phone_alt column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'emergency_contacts' AND column_name = 'phone_alt') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'emergency_contacts' AND column_name = 'phone_secondary') THEN
            ALTER TABLE emergency_contacts RENAME COLUMN phone_secondary TO phone_alt;
        ELSE
            ALTER TABLE emergency_contacts ADD COLUMN phone_alt VARCHAR(50);
        END IF;
    END IF;

    -- Add priority column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'emergency_contacts' AND column_name = 'priority') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'emergency_contacts' AND column_name = 'contact_order') THEN
            ALTER TABLE emergency_contacts RENAME COLUMN contact_order TO priority;
        ELSE
            ALTER TABLE emergency_contacts ADD COLUMN priority INTEGER DEFAULT 3;
        END IF;
    END IF;

    -- Add updated_at column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'emergency_contacts' AND column_name = 'updated_at') THEN
        ALTER TABLE emergency_contacts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create indexes for emergency_contacts
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user_id ON emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_priority ON emergency_contacts(priority);

-- Add medical fields to family_profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'family_profiles' AND column_name = 'blood_type') THEN
        ALTER TABLE family_profiles ADD COLUMN blood_type VARCHAR(10);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'family_profiles' AND column_name = 'allergies') THEN
        ALTER TABLE family_profiles ADD COLUMN allergies TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'family_profiles' AND column_name = 'medications') THEN
        ALTER TABLE family_profiles ADD COLUMN medications TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'family_profiles' AND column_name = 'medical_conditions') THEN
        ALTER TABLE family_profiles ADD COLUMN medical_conditions TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'family_profiles' AND column_name = 'notes') THEN
        ALTER TABLE family_profiles ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON family_documents TO sps_user;
GRANT USAGE, SELECT ON SEQUENCE family_documents_id_seq TO sps_user;

COMMENT ON TABLE family_documents IS 'Stores family document metadata and file references';
COMMENT ON COLUMN family_documents.category IS 'Document category: identification, medical, financial, legal, emergency, other';

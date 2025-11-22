-- Pictures Management Schema
-- Allows users to manage their photo library with metadata, organization, and classification

-- Pictures table
CREATE TABLE IF NOT EXISTS pictures (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER, -- bytes
    mime_type VARCHAR(50),
    thumbnail_small VARCHAR(255),
    thumbnail_medium VARCHAR(255),
    thumbnail_large VARCHAR(255),
    width INTEGER,
    height INTEGER,
    title VARCHAR(255),
    description TEXT,
    taken_at TIMESTAMP,
    location_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    camera_make VARCHAR(100),
    camera_model VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Picture Tags/Categories
CREATE TABLE IF NOT EXISTS picture_tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7), -- hex color code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Picture to Tag relationship (many-to-many)
CREATE TABLE IF NOT EXISTS picture_tag_relations (
    picture_id INTEGER REFERENCES pictures(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES picture_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (picture_id, tag_id)
);

-- Picture Albums/Collections
CREATE TABLE IF NOT EXISTS picture_albums (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cover_picture_id INTEGER REFERENCES pictures(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Album to Picture relationship (many-to-many)
CREATE TABLE IF NOT EXISTS picture_album_relations (
    album_id INTEGER REFERENCES picture_albums(id) ON DELETE CASCADE,
    picture_id INTEGER REFERENCES pictures(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (album_id, picture_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pictures_user ON pictures(user_id);
CREATE INDEX IF NOT EXISTS idx_pictures_taken_at ON pictures(taken_at);
CREATE INDEX IF NOT EXISTS idx_picture_albums_user ON picture_albums(user_id);
CREATE INDEX IF NOT EXISTS idx_picture_tag_relations_picture ON picture_tag_relations(picture_id);
CREATE INDEX IF NOT EXISTS idx_picture_tag_relations_tag ON picture_tag_relations(tag_id);
CREATE INDEX IF NOT EXISTS idx_picture_album_relations_album ON picture_album_relations(album_id);
CREATE INDEX IF NOT EXISTS idx_picture_album_relations_picture ON picture_album_relations(picture_id);

-- Sample tags
INSERT INTO picture_tags (name, color) VALUES
('Family', '#FF6B6B'),
('Nature', '#4ECDC4'),
('Emergency', '#FFE66D'),
('Inventory', '#95E1D3'),
('Shelter', '#F38181'),
('Food Storage', '#AA96DA'),
('Events', '#FCBAD3'),
('Training', '#A8E6CF')
ON CONFLICT (name) DO NOTHING;

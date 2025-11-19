-- Video Management Tables for SPS

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    filename VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT, -- in bytes
    duration INTEGER, -- in seconds
    format VARCHAR(50), -- mp4, webm, etc.
    resolution VARCHAR(20), -- 1080p, 720p, etc.
    thumbnail_path VARCHAR(1000),
    source_url VARCHAR(2000), -- if downloaded from URL
    source_type VARCHAR(50), -- youtube, vimeo, upload, etc.
    download_date TIMESTAMP,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_viewed TIMESTAMP,
    view_count INTEGER DEFAULT 0,
    category VARCHAR(100),
    tags TEXT[], -- array of tags
    metadata JSONB, -- flexible metadata storage
    status VARCHAR(50) DEFAULT 'active', -- active, processing, failed, deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video playlists
CREATE TABLE IF NOT EXISTS video_playlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video playlist items
CREATE TABLE IF NOT EXISTS video_playlist_items (
    id SERIAL PRIMARY KEY,
    playlist_id INTEGER REFERENCES video_playlists(id) ON DELETE CASCADE,
    video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(playlist_id, video_id)
);

-- Video downloads queue (for yt-dlp)
CREATE TABLE IF NOT EXISTS video_downloads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    url VARCHAR(2000) NOT NULL,
    title VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending', -- pending, downloading, completed, failed
    progress INTEGER DEFAULT 0, -- 0-100
    error_message TEXT,
    video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL,
    quality VARCHAR(50), -- best, 1080p, 720p, etc.
    format VARCHAR(50), -- mp4, webm, etc.
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Video notes/annotations
CREATE TABLE IF NOT EXISTS video_notes (
    id SERIAL PRIMARY KEY,
    video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    timestamp INTEGER NOT NULL, -- seconds in video
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_videos_user ON videos(user_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_category ON videos(category);
CREATE INDEX idx_videos_tags ON videos USING GIN(tags);
CREATE INDEX idx_video_playlists_user ON video_playlists(user_id);
CREATE INDEX idx_video_downloads_user ON video_downloads(user_id);
CREATE INDEX idx_video_downloads_status ON video_downloads(status);
CREATE INDEX idx_video_notes_video ON video_notes(video_id);

-- Sample categories
INSERT INTO video_playlists (user_id, name, description, is_public)
SELECT 1, 'Survival Skills', 'Essential survival technique videos', false
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
ON CONFLICT DO NOTHING;

INSERT INTO video_playlists (user_id, name, description, is_public)
SELECT 1, 'First Aid Training', 'Medical emergency response videos', false
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
ON CONFLICT DO NOTHING;

INSERT INTO video_playlists (user_id, name, description, is_public)
SELECT 1, 'Food Preparation', 'Food storage and preservation techniques', false
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1)
ON CONFLICT DO NOTHING;

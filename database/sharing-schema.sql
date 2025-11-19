-- Enhanced Sharing System for SPS
-- Allows users to share resources with other users

-- Drop existing table if you want to recreate
-- DROP TABLE IF EXISTS shared_access CASCADE;

-- Enhanced shared access table
CREATE TABLE IF NOT EXISTS shared_access (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    shared_with_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL, -- inventory, plan, document, video, playlist, checklist
    resource_id INTEGER NOT NULL,
    permission_level VARCHAR(20) NOT NULL, -- view, edit, admin
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(owner_id, shared_with_user_id, resource_type, resource_id)
);

-- Sharing invitations (for pending shares)
CREATE TABLE IF NOT EXISTS sharing_invitations (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    invited_email VARCHAR(255) NOT NULL,
    invited_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER NOT NULL,
    permission_level VARCHAR(20) NOT NULL,
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected, expired
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP
);

-- Sharing activity log
CREATE TABLE IF NOT EXISTS sharing_activity (
    id SERIAL PRIMARY KEY,
    shared_access_id INTEGER REFERENCES shared_access(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- granted, revoked, accessed, modified
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_access_owner ON shared_access(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_shared_with ON shared_access(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_resource ON shared_access(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_active ON shared_access(is_active);
CREATE INDEX IF NOT EXISTS idx_sharing_invitations_token ON sharing_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_sharing_invitations_email ON sharing_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_sharing_activity_shared_access ON sharing_activity(shared_access_id);

-- Helper function to check if user has access to a resource
CREATE OR REPLACE FUNCTION has_resource_access(
    p_user_id INTEGER,
    p_resource_type VARCHAR,
    p_resource_id INTEGER,
    p_required_permission VARCHAR DEFAULT 'view'
) RETURNS BOOLEAN AS $$
DECLARE
    v_is_owner BOOLEAN;
    v_has_shared_access BOOLEAN;
BEGIN
    -- Check if user is the owner based on resource type
    CASE p_resource_type
        WHEN 'inventory' THEN
            SELECT EXISTS(SELECT 1 FROM inventory_items WHERE id = p_resource_id AND user_id = p_user_id) INTO v_is_owner;
        WHEN 'plan' THEN
            SELECT EXISTS(SELECT 1 FROM emergency_plans WHERE id = p_resource_id AND user_id = p_user_id) INTO v_is_owner;
        WHEN 'video' THEN
            SELECT EXISTS(SELECT 1 FROM videos WHERE id = p_resource_id AND user_id = p_user_id) INTO v_is_owner;
        WHEN 'playlist' THEN
            SELECT EXISTS(SELECT 1 FROM video_playlists WHERE id = p_resource_id AND user_id = p_user_id) INTO v_is_owner;
        WHEN 'checklist' THEN
            SELECT EXISTS(SELECT 1 FROM checklists WHERE id = p_resource_id AND user_id = p_user_id) INTO v_is_owner;
        WHEN 'document' THEN
            SELECT EXISTS(SELECT 1 FROM documents WHERE id = p_resource_id AND user_id = p_user_id) INTO v_is_owner;
        ELSE
            v_is_owner := FALSE;
    END CASE;

    -- If owner, return true
    IF v_is_owner THEN
        RETURN TRUE;
    END IF;

    -- Check shared access
    SELECT EXISTS(
        SELECT 1 FROM shared_access
        WHERE shared_with_user_id = p_user_id
            AND resource_type = p_resource_type
            AND resource_id = p_resource_id
            AND is_active = TRUE
            AND (expires_at IS NULL OR expires_at > NOW())
            AND CASE p_required_permission
                WHEN 'admin' THEN permission_level = 'admin'
                WHEN 'edit' THEN permission_level IN ('edit', 'admin')
                WHEN 'view' THEN permission_level IN ('view', 'edit', 'admin')
                ELSE FALSE
            END
    ) INTO v_has_shared_access;

    RETURN v_has_shared_access;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get all shared resources for a user
CREATE OR REPLACE FUNCTION get_shared_resources(p_user_id INTEGER, p_resource_type VARCHAR DEFAULT NULL)
RETURNS TABLE (
    resource_type VARCHAR,
    resource_id INTEGER,
    owner_id INTEGER,
    owner_username VARCHAR,
    permission_level VARCHAR,
    granted_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sa.resource_type,
        sa.resource_id,
        sa.owner_id,
        u.username AS owner_username,
        sa.permission_level,
        sa.granted_at
    FROM shared_access sa
    JOIN users u ON u.id = sa.owner_id
    WHERE sa.shared_with_user_id = p_user_id
        AND sa.is_active = TRUE
        AND (sa.expires_at IS NULL OR sa.expires_at > NOW())
        AND (p_resource_type IS NULL OR sa.resource_type = p_resource_type)
    ORDER BY sa.granted_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE shared_access IS 'Tracks which users have access to which resources';
COMMENT ON TABLE sharing_invitations IS 'Pending invitations to share resources';
COMMENT ON TABLE sharing_activity IS 'Audit log of sharing-related actions';
COMMENT ON FUNCTION has_resource_access IS 'Check if a user has specific permission level for a resource';
COMMENT ON FUNCTION get_shared_resources IS 'Get all resources shared with a specific user';

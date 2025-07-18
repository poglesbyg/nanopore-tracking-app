-- File Storage Database Schema
-- Python microservices migration

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS file_db;

-- Use the database
\c file_db;

-- Create stored files table
CREATE TABLE IF NOT EXISTS stored_files (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    
    -- File metadata
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256
    status VARCHAR(20) DEFAULT 'stored',
    
    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    access_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE
);

-- Create file access logs table
CREATE TABLE IF NOT EXISTS file_access_logs (
    id VARCHAR(36) PRIMARY KEY,
    file_id VARCHAR(36) NOT NULL REFERENCES stored_files(id) ON DELETE CASCADE,
    user_id VARCHAR(36),
    access_type VARCHAR(50) NOT NULL, -- download, view, delete
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create file shares table
CREATE TABLE IF NOT EXISTS file_shares (
    id VARCHAR(36) PRIMARY KEY,
    file_id VARCHAR(36) NOT NULL REFERENCES stored_files(id) ON DELETE CASCADE,
    shared_by VARCHAR(36) NOT NULL,
    shared_with VARCHAR(36),
    share_token VARCHAR(255) UNIQUE,
    permissions VARCHAR(50) DEFAULT 'read', -- read, write, delete
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create file versions table
CREATE TABLE IF NOT EXISTS file_versions (
    id VARCHAR(36) PRIMARY KEY,
    file_id VARCHAR(36) NOT NULL REFERENCES stored_files(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stored_files_user_id ON stored_files(user_id);
CREATE INDEX IF NOT EXISTS idx_stored_files_file_hash ON stored_files(file_hash);
CREATE INDEX IF NOT EXISTS idx_stored_files_mime_type ON stored_files(mime_type);
CREATE INDEX IF NOT EXISTS idx_stored_files_status ON stored_files(status);
CREATE INDEX IF NOT EXISTS idx_stored_files_created_at ON stored_files(created_at);
CREATE INDEX IF NOT EXISTS idx_stored_files_is_public ON stored_files(is_public);

CREATE INDEX IF NOT EXISTS idx_file_access_logs_file_id ON file_access_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_user_id ON file_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_access_type ON file_access_logs(access_type);
CREATE INDEX IF NOT EXISTS idx_file_access_logs_created_at ON file_access_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_by ON file_shares(shared_by);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_with ON file_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_file_shares_share_token ON file_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_file_shares_expires_at ON file_shares(expires_at);

CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_version_number ON file_versions(version_number);
CREATE INDEX IF NOT EXISTS idx_file_versions_created_by ON file_versions(created_by);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stored_files_updated_at 
    BEFORE UPDATE ON stored_files 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample files for testing
INSERT INTO stored_files (
    id, user_id, original_filename, stored_filename, file_path,
    file_size, mime_type, file_hash, status
) VALUES 
(
    'file-001', 
    'user-001', 
    'sample_data.pdf', 
    'file-001_sample_data.pdf', 
    '/app/uploads/user-001/file-001_sample_data.pdf',
    1024000, 
    'application/pdf', 
    'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890', 
    'stored'
),
(
    'file-002', 
    'user-001', 
    'results.csv', 
    'file-002_results.csv', 
    '/app/uploads/user-001/file-002_results.csv',
    512000, 
    'text/csv', 
    'b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1', 
    'stored'
) ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres; 
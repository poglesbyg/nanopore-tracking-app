-- Audit Database Schema
-- Python microservices migration

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS audit_db;

-- Use the database
\c audit_db;

-- Create audit events table
CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(36) PRIMARY KEY,
    
    -- Event identification
    event_type VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    level VARCHAR(20) DEFAULT 'info',
    
    -- User context
    user_id VARCHAR(36),
    user_role VARCHAR(50),
    
    -- Request context
    resource_id VARCHAR(36),
    resource_type VARCHAR(100),
    
    -- Event details
    description TEXT NOT NULL,
    details TEXT, -- JSON string
    
    -- Network context
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    
    -- Outcome
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create audit statistics table
CREATE TABLE IF NOT EXISTS audit_statistics (
    id VARCHAR(36) PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    date_bucket DATE NOT NULL,
    
    -- Counts
    total_events INTEGER DEFAULT 0,
    successful_events INTEGER DEFAULT 0,
    failed_events INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_response_time INTEGER,
    min_response_time INTEGER,
    max_response_time INTEGER,
    
    -- User metrics
    unique_users INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create compliance reports table
CREATE TABLE IF NOT EXISTS compliance_reports (
    id VARCHAR(36) PRIMARY KEY,
    report_type VARCHAR(100) NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    
    -- Report content
    report_data JSONB NOT NULL,
    summary TEXT,
    
    -- Generation info
    generated_by VARCHAR(36),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Status
    status VARCHAR(50) DEFAULT 'generated',
    file_path VARCHAR(500)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_events_service_name ON audit_events(service_name);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_level ON audit_events(level);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource_id ON audit_events(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource_type ON audit_events(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_success ON audit_events(success);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_events_service_action ON audit_events(service_name, action);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_created ON audit_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_type_created ON audit_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_statistics_service_name ON audit_statistics(service_name);
CREATE INDEX IF NOT EXISTS idx_audit_statistics_event_type ON audit_statistics(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_statistics_date_bucket ON audit_statistics(date_bucket);
CREATE INDEX IF NOT EXISTS idx_audit_statistics_service_date ON audit_statistics(service_name, date_bucket);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_report_type ON compliance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_start_date ON compliance_reports(start_date);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_end_date ON compliance_reports(end_date);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_generated_by ON compliance_reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_status ON compliance_reports(status);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_audit_statistics_updated_at 
    BEFORE UPDATE ON audit_statistics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample audit events for testing
INSERT INTO audit_events (
    id, event_type, service_name, action, level, user_id, user_role,
    resource_id, resource_type, description, success
) VALUES 
(
    'audit-001', 
    'user_action', 
    'authentication', 
    'login', 
    'info', 
    'user-001', 
    'user',
    NULL, 
    NULL, 
    'User logged in successfully', 
    TRUE
),
(
    'audit-002', 
    'system_event', 
    'sample-management', 
    'sample_created', 
    'info', 
    'user-001', 
    'user',
    'sample-001', 
    'sample', 
    'New sample created', 
    TRUE
),
(
    'audit-003', 
    'user_action', 
    'file-storage', 
    'file_upload', 
    'info', 
    'user-001', 
    'user',
    'file-001', 
    'file', 
    'File uploaded successfully', 
    TRUE
) ON CONFLICT (id) DO NOTHING;

-- Insert sample statistics
INSERT INTO audit_statistics (
    id, service_name, event_type, action, date_bucket,
    total_events, successful_events, failed_events, avg_response_time, unique_users
) VALUES 
(
    'stat-001', 
    'authentication', 
    'user_action', 
    'login', 
    CURRENT_DATE,
    50, 
    48, 
    2, 
    150, 
    25
),
(
    'stat-002', 
    'sample-management', 
    'system_event', 
    'sample_created', 
    CURRENT_DATE,
    20, 
    20, 
    0, 
    200, 
    15
) ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres; 
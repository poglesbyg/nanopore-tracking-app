-- Sample Management Database Schema
-- Python microservices migration

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS sample_db;

-- Use the database
\c sample_db;

-- Create samples table
CREATE TABLE IF NOT EXISTS samples (
    id VARCHAR(36) PRIMARY KEY,
    sample_name VARCHAR(255) NOT NULL,
    submitter_name VARCHAR(255) NOT NULL,
    submitter_email VARCHAR(255) NOT NULL,
    
    -- Sample details
    sample_type VARCHAR(100),
    concentration DECIMAL(10, 4),
    volume DECIMAL(10, 4),
    lab_name VARCHAR(255),
    organization VARCHAR(255),
    
    -- Workflow tracking
    status VARCHAR(50) DEFAULT 'submitted',
    priority VARCHAR(20) DEFAULT 'normal',
    workflow_step INTEGER DEFAULT 1,
    assigned_to VARCHAR(36),
    
    -- Processing details
    flow_cell_type VARCHAR(100),
    sequencing_kit VARCHAR(100),
    expected_yield DECIMAL(10, 4),
    
    -- Quality control
    qc_status VARCHAR(50) DEFAULT 'pending',
    qc_notes TEXT,
    
    -- Metadata
    metadata JSONB,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create workflow history table
CREATE TABLE IF NOT EXISTS workflow_history (
    id VARCHAR(36) PRIMARY KEY,
    sample_id VARCHAR(36) NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    from_step INTEGER,
    to_step INTEGER NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(36),
    notes TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create sample assignments table
CREATE TABLE IF NOT EXISTS sample_assignments (
    id VARCHAR(36) PRIMARY KEY,
    sample_id VARCHAR(36) NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    assigned_to VARCHAR(36) NOT NULL,
    assigned_by VARCHAR(36) NOT NULL,
    assignment_type VARCHAR(50) DEFAULT 'processing',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
CREATE INDEX IF NOT EXISTS idx_samples_priority ON samples(priority);
CREATE INDEX IF NOT EXISTS idx_samples_workflow_step ON samples(workflow_step);
CREATE INDEX IF NOT EXISTS idx_samples_assigned_to ON samples(assigned_to);
CREATE INDEX IF NOT EXISTS idx_samples_created_at ON samples(created_at);
CREATE INDEX IF NOT EXISTS idx_samples_submitter_email ON samples(submitter_email);

CREATE INDEX IF NOT EXISTS idx_workflow_history_sample_id ON workflow_history(sample_id);
CREATE INDEX IF NOT EXISTS idx_workflow_history_created_at ON workflow_history(created_at);

CREATE INDEX IF NOT EXISTS idx_sample_assignments_sample_id ON sample_assignments(sample_id);
CREATE INDEX IF NOT EXISTS idx_sample_assignments_assigned_to ON sample_assignments(assigned_to);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_samples_updated_at 
    BEFORE UPDATE ON samples 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO samples (
    id, sample_name, submitter_name, submitter_email, 
    sample_type, concentration, volume, lab_name, organization,
    status, priority, workflow_step
) VALUES 
(
    'sample-001', 'Test Sample 1', 'John Doe', 'john.doe@example.com',
    'DNA', 50.0, 100.0, 'Research Lab', 'University',
    'submitted', 'normal', 1
),
(
    'sample-002', 'Test Sample 2', 'Jane Smith', 'jane.smith@example.com',
    'RNA', 75.0, 50.0, 'Clinical Lab', 'Hospital',
    'processing', 'high', 3
) ON CONFLICT (id) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres; 
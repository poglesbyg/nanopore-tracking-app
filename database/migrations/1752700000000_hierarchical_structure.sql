-- Migration: Hierarchical structure (Projects -> Submissions -> Samples)
-- Created: 2025-08-01

-- Create Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_name VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    chart_prefix VARCHAR(10) DEFAULT 'PROJ' CHECK (chart_prefix IN ('HTSF', 'NANO', 'SEQ', 'PROJ')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    submitter_name VARCHAR(255) NOT NULL,
    submitter_email VARCHAR(255) NOT NULL,
    submission_type VARCHAR(50) DEFAULT 'manual' CHECK (submission_type IN ('manual', 'pdf', 'csv', 'batch')),
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'processing', 'completed', 'archived')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- PDF/File processing metadata
    original_filename VARCHAR(255),
    file_size_bytes INTEGER,
    processing_notes TEXT,
    
    -- Workflow tracking
    submitted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Modify existing nanopore_samples table to reference submissions
-- First, add submission_id column
ALTER TABLE nanopore_samples 
ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_email);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_project_id ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitter ON submissions(submitter_email);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);

CREATE INDEX IF NOT EXISTS idx_nanopore_samples_submission_id ON nanopore_samples(submission_id);

-- Insert default project for existing data
INSERT INTO projects (id, name, description, owner_name, owner_email, status)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'Default Project',
    'Default project for migrated samples',
    'System Admin',
    'admin@system.local',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Insert default submission for existing data
INSERT INTO submissions (id, project_id, name, submitter_name, submitter_email, submission_type, status, submitted_at)
VALUES (
    '00000000-0000-0000-0000-000000000002'::UUID,
    '00000000-0000-0000-0000-000000000001'::UUID,
    'Migrated Samples',
    'System Migration',
    'migration@system.local',
    'manual',
    'submitted',
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Update existing samples to reference the default submission
UPDATE nanopore_samples 
SET submission_id = '00000000-0000-0000-0000-000000000002'::UUID
WHERE submission_id IS NULL;

-- Make submission_id NOT NULL after migration
ALTER TABLE nanopore_samples 
ALTER COLUMN submission_id SET NOT NULL;

-- Create view for hierarchical data access
CREATE OR REPLACE VIEW sample_hierarchy AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.status as project_status,
    s.id as submission_id,
    s.name as submission_name,
    s.status as submission_status,
    s.submission_type,
    s.submitted_at,
    ns.id as sample_id,
    ns.sample_name,
    ns.status as sample_status,
    ns.priority as sample_priority,
    ns.sample_type,
    ns.lab_name,
    ns.chart_field,
    ns.submitter_name,
    ns.submitter_email,
    ns.created_at as sample_created_at
FROM projects p
JOIN submissions s ON p.id = s.project_id
JOIN nanopore_samples ns ON s.id = ns.submission_id
ORDER BY p.created_at DESC, s.created_at DESC, ns.created_at DESC;
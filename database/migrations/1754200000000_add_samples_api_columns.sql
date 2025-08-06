-- Migration: Add missing columns for samples API compatibility
-- The samples API expects specific columns that weren't in the original simplified schema

-- Add missing columns that the samples API expects
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS sample_id VARCHAR(100);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS submitter_name VARCHAR(255);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS submitter_email VARCHAR(255);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS lab_name VARCHAR(255);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS chart_field VARCHAR(100);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS concentration DECIMAL(10,3);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS concentration_unit VARCHAR(20);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS volume DECIMAL(10,2);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS volume_unit VARCHAR(20);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(50);
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS flow_cell_count INTEGER DEFAULT 1;
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE nanopore_samples ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Make sample_number nullable to avoid NOT NULL constraint issues
ALTER TABLE nanopore_samples ALTER COLUMN sample_number DROP NOT NULL;

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_samples_sample_id ON nanopore_samples(sample_id);
CREATE INDEX IF NOT EXISTS idx_samples_submitter_email ON nanopore_samples(submitter_email);
CREATE INDEX IF NOT EXISTS idx_samples_workflow_stage ON nanopore_samples(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_samples_priority ON nanopore_samples(priority);
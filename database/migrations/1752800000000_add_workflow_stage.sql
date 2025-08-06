-- Add workflow_stage column to nanopore_samples table
-- Migration: Add workflow stage tracking for 8-step nanopore processing workflow

ALTER TABLE nanopore_samples 
ADD COLUMN workflow_stage VARCHAR(50) NOT NULL DEFAULT 'sample_qc';

-- Add constraint to ensure valid workflow stages
ALTER TABLE nanopore_samples 
ADD CONSTRAINT chk_workflow_stage 
CHECK (workflow_stage IN ('sample_qc', 'library_prep', 'library_qc', 'sequencing_setup', 'sequencing_run', 'basecalling', 'quality_assessment', 'data_delivery'));

-- Create index for workflow stage queries
CREATE INDEX idx_nanopore_samples_workflow_stage ON nanopore_samples(workflow_stage);

-- Create index for priority-based querying
CREATE INDEX idx_nanopore_samples_priority_status ON nanopore_samples(priority, status, submitted_at);
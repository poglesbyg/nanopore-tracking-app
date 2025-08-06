-- Migration: Add missing columns to nanopore_samples table
-- Add submitted_at and created_by columns that are expected by the repository code

-- Add submitted_at column (timestamp when sample was submitted)
ALTER TABLE nanopore_samples 
ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW();

-- Add created_by column (reference to user who created the sample)
ALTER TABLE nanopore_samples 
ADD COLUMN created_by UUID REFERENCES users(id);

-- Update existing records to have submitted_at based on created_at
UPDATE nanopore_samples 
SET submitted_at = created_at 
WHERE submitted_at IS NULL;

-- Make submitted_at NOT NULL after updating existing records
ALTER TABLE nanopore_samples 
ALTER COLUMN submitted_at SET NOT NULL;

-- Add indexes for performance
CREATE INDEX idx_samples_submitted_at ON nanopore_samples(submitted_at);
CREATE INDEX idx_samples_created_by ON nanopore_samples(created_by);
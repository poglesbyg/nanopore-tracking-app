-- Migration: Add 'distributed' status to nanopore samples
-- Date: 2025-01-18
-- Description: Adds 'distributed' as a new sample status to track when samples have been delivered to customers

-- First, drop the existing constraint
ALTER TABLE nanopore_samples 
DROP CONSTRAINT IF EXISTS valid_status;

-- Add the new constraint with 'distributed' included
ALTER TABLE nanopore_samples 
ADD CONSTRAINT valid_status 
CHECK (status IN ('submitted', 'prep', 'sequencing', 'analysis', 'completed', 'distributed', 'archived'));

-- Update the comment on the status column to document the new status
COMMENT ON COLUMN nanopore_samples.status IS 'Sample processing status: submitted (initial submission), prep (library preparation), sequencing (active sequencing), analysis (data analysis), completed (processing finished), distributed (delivered to customer), archived (long-term storage)';

-- Create index for the new status value if samples are using it
CREATE INDEX IF NOT EXISTS idx_nanopore_samples_distributed 
ON nanopore_samples(status) 
WHERE status = 'distributed';

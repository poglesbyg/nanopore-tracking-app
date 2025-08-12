-- Migration: Add sample_number column to nanopore_samples
-- This column tracks the order of samples within a submission

-- Add sample_number column if it doesn't exist
ALTER TABLE nanopore_samples 
ADD COLUMN IF NOT EXISTS sample_number INTEGER;

-- Update existing samples with sequential numbers per submission
WITH numbered_samples AS (
  SELECT 
    id,
    submission_id,
    ROW_NUMBER() OVER (PARTITION BY submission_id ORDER BY created_at) as seq_num
  FROM nanopore_samples
  WHERE submission_id IS NOT NULL
)
UPDATE nanopore_samples ns
SET sample_number = ns_numbered.seq_num
FROM numbered_samples ns_numbered
WHERE ns.id = ns_numbered.id;

-- Set default value for samples without submission
UPDATE nanopore_samples 
SET sample_number = 1 
WHERE sample_number IS NULL;

-- Create index for faster ordering
CREATE INDEX IF NOT EXISTS idx_nanopore_samples_submission_sample_num 
ON nanopore_samples(submission_id, sample_number);

-- Comment for documentation
COMMENT ON COLUMN nanopore_samples.sample_number IS 'Sequential number of the sample within its submission';

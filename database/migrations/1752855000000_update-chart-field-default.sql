-- Migration: Update chart field default value
-- Updates the default value for chart_field to 'TBD' instead of empty string

ALTER TABLE nanopore_samples 
ALTER COLUMN chart_field SET DEFAULT 'TBD';

-- Update any existing empty values to 'TBD'
UPDATE nanopore_samples 
SET chart_field = 'TBD' 
WHERE chart_field = '';

-- Comment for documentation
COMMENT ON COLUMN nanopore_samples.chart_field IS 'Chart field identifier required for intake validation (default: TBD)'; 
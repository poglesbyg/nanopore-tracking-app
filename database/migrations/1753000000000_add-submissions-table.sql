-- Migration: Add Submissions Table for Hierarchical Structure
-- Each PDF submission contains multiple samples

-- Create submissions table
CREATE TABLE nanopore_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Submission Information
    submission_number VARCHAR(100) UNIQUE NOT NULL DEFAULT ('SUBM-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MISS-') || substr(gen_random_uuid()::text, 1, 8)),
    pdf_filename VARCHAR(255) NOT NULL,
    
    -- Submitter Information (shared across all samples in submission)
    submitter_name VARCHAR(255) NOT NULL,
    submitter_email VARCHAR(255) NOT NULL,
    lab_name VARCHAR(255),
    department VARCHAR(255),
    billing_account VARCHAR(100), -- Chart field/billing info
    
    -- Submission Details
    submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id VARCHAR(100), -- iLab Service Project ID
    project_name VARCHAR(255),
    
    -- Processing Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    sample_count INTEGER DEFAULT 0,
    samples_completed INTEGER DEFAULT 0,
    
    -- Metadata
    pdf_metadata JSONB, -- Store raw PDF metadata
    extracted_data JSONB, -- Store all extracted data from PDF
    extraction_method VARCHAR(50), -- 'llm', 'pattern', 'hybrid', 'rag'
    extraction_confidence DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Special Instructions (applies to all samples)
    special_instructions TEXT,
    priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- User tracking
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_submission_status CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Add submission_id to nanopore_samples table
ALTER TABLE nanopore_samples 
ADD COLUMN submission_id UUID REFERENCES nanopore_submissions(id) ON DELETE CASCADE;

-- Add sample_number within submission
ALTER TABLE nanopore_samples
ADD COLUMN sample_number INTEGER;

-- Add unique constraint for sample numbering within a submission
ALTER TABLE nanopore_samples
ADD CONSTRAINT unique_sample_number_per_submission 
UNIQUE(submission_id, sample_number);

-- Create indexes for performance
CREATE INDEX idx_nanopore_submissions_status ON nanopore_submissions(status);
CREATE INDEX idx_nanopore_submissions_created_by ON nanopore_submissions(created_by);
CREATE INDEX idx_nanopore_submissions_submission_date ON nanopore_submissions(submission_date);
CREATE INDEX idx_nanopore_samples_submission_id ON nanopore_samples(submission_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER set_timestamp_nanopore_submissions
    BEFORE UPDATE ON nanopore_submissions
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Function to update submission sample counts
CREATE OR REPLACE FUNCTION update_submission_sample_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'DELETE' THEN
        UPDATE nanopore_submissions
        SET 
            sample_count = (
                SELECT COUNT(*) 
                FROM nanopore_samples 
                WHERE submission_id = COALESCE(NEW.submission_id, OLD.submission_id)
            ),
            samples_completed = (
                SELECT COUNT(*) 
                FROM nanopore_samples 
                WHERE submission_id = COALESCE(NEW.submission_id, OLD.submission_id)
                AND status = 'completed'
            ),
            updated_at = NOW()
        WHERE id = COALESCE(NEW.submission_id, OLD.submission_id);
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        UPDATE nanopore_submissions
        SET 
            samples_completed = (
                SELECT COUNT(*) 
                FROM nanopore_samples 
                WHERE submission_id = NEW.submission_id
                AND status = 'completed'
            ),
            updated_at = NOW()
        WHERE id = NEW.submission_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain submission sample counts
CREATE TRIGGER update_submission_counts
AFTER INSERT OR UPDATE OR DELETE ON nanopore_samples
FOR EACH ROW
EXECUTE PROCEDURE update_submission_sample_count();

-- Function to update submission status based on sample statuses
CREATE OR REPLACE FUNCTION update_submission_status()
RETURNS TRIGGER AS $$
DECLARE
    all_completed BOOLEAN;
    any_failed BOOLEAN;
BEGIN
    -- Only update if sample status changed
    IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Check if all samples are completed
    SELECT 
        COUNT(*) = COUNT(CASE WHEN status = 'completed' THEN 1 END),
        COUNT(CASE WHEN status = 'failed' THEN 1 END) > 0
    INTO all_completed, any_failed
    FROM nanopore_samples
    WHERE submission_id = NEW.submission_id;
    
    -- Update submission status
    UPDATE nanopore_submissions
    SET 
        status = CASE
            WHEN any_failed THEN 'failed'
            WHEN all_completed THEN 'completed'
            ELSE 'processing'
        END,
        updated_at = NOW()
    WHERE id = NEW.submission_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update submission status
CREATE TRIGGER update_submission_status_trigger
AFTER UPDATE OF status ON nanopore_samples
FOR EACH ROW
EXECUTE PROCEDURE update_submission_status();

-- Comments for documentation
COMMENT ON TABLE nanopore_submissions IS 'Submission records for batches of Nanopore sequencing samples from a single PDF';
COMMENT ON COLUMN nanopore_submissions.submission_number IS 'Unique submission identifier, auto-generated';
COMMENT ON COLUMN nanopore_submissions.sample_count IS 'Total number of samples in this submission';
COMMENT ON COLUMN nanopore_submissions.samples_completed IS 'Number of completed samples in this submission';
COMMENT ON COLUMN nanopore_submissions.extracted_data IS 'JSON storage of all data extracted from the PDF';
COMMENT ON COLUMN nanopore_samples.submission_id IS 'Reference to the parent submission';
COMMENT ON COLUMN nanopore_samples.sample_number IS 'Sample number within the submission (1, 2, 3, etc.)';

-- Migration script to create submissions for existing samples
-- This groups existing samples by submitter and date
DO $$
DECLARE
    sample_group RECORD;
    new_submission_id UUID;
BEGIN
    -- Group existing samples by submitter and date
    FOR sample_group IN 
        SELECT 
            submitter_name,
            submitter_email,
            lab_name,
            DATE(submitted_at) as submission_date,
            created_by,
            chart_field,
            priority,
            ARRAY_AGG(id ORDER BY created_at) as sample_ids
        FROM nanopore_samples
        WHERE submission_id IS NULL
        GROUP BY submitter_name, submitter_email, lab_name, DATE(submitted_at), created_by, chart_field, priority
    LOOP
        -- Create a submission for each group
        INSERT INTO nanopore_submissions (
            submitter_name,
            submitter_email,
            lab_name,
            submission_date,
            created_by,
            billing_account,
            priority,
            status,
            pdf_filename,
            sample_count
        ) VALUES (
            sample_group.submitter_name,
            sample_group.submitter_email,
            sample_group.lab_name,
            sample_group.submission_date,
            sample_group.created_by,
            sample_group.chart_field,
            sample_group.priority,
            'completed', -- Assume existing samples are from completed submissions
            'legacy-import.pdf', -- Placeholder for existing samples
            array_length(sample_group.sample_ids, 1)
        ) RETURNING id INTO new_submission_id;
        
        -- Update samples to link to the new submission
        FOR i IN 1..array_length(sample_group.sample_ids, 1) LOOP
            UPDATE nanopore_samples
            SET 
                submission_id = new_submission_id,
                sample_number = i
            WHERE id = sample_group.sample_ids[i];
        END LOOP;
    END LOOP;
END $$; 
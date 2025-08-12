-- Migration: Fix submissions table name mismatch
-- Creates a view to map nanopore_submissions to submissions table

-- Drop the view if it already exists
DROP VIEW IF EXISTS nanopore_submissions CASCADE;

-- Create a view that maps nanopore_submissions to submissions
CREATE VIEW nanopore_submissions AS
SELECT 
    id,
    name AS submission_number,  -- Map name to submission_number
    created_at AS submission_date,  -- Map created_at to submission_date
    submitter_name,
    submitter_email,
    status,
    description AS notes,
    submission_type,
    original_filename AS pdf_filename,
    file_size_bytes,
    0 AS sample_count,  -- Default sample count
    priority,
    processing_notes,
    submitted_at,
    completed_at,
    created_at,
    updated_at
FROM submissions;

-- Create INSTEAD OF triggers to handle INSERT, UPDATE, DELETE operations on the view
-- This allows the application to write to nanopore_submissions as if it were a real table

-- INSERT trigger
CREATE OR REPLACE FUNCTION insert_nanopore_submission()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO submissions (
        id,
        project_id,
        name,
        description,
        submitter_name,
        submitter_email,
        submission_type,
        status,
        priority,
        original_filename,
        file_size_bytes,
        processing_notes,
        submitted_at,
        completed_at,
        created_at,
        updated_at
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        null,  -- project_id will need to be handled separately
        COALESCE(NEW.submission_number, 'SUBM-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MISS')),
        NEW.notes,
        NEW.submitter_name,
        NEW.submitter_email,
        COALESCE(NEW.submission_type, 'manual'),
        COALESCE(NEW.status, 'draft'),
        COALESCE(NEW.priority, 'normal'),
        NEW.pdf_filename,
        NEW.file_size_bytes,
        NEW.processing_notes,
        COALESCE(NEW.submitted_at, CURRENT_TIMESTAMP),
        NEW.completed_at,
        COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
        COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
    )
    RETURNING 
        id,
        name AS submission_number,
        created_at AS submission_date,
        submitter_name,
        submitter_email,
        status,
        description AS notes,
        submission_type,
        original_filename AS pdf_filename,
        file_size_bytes,
        0 AS sample_count,
        priority,
        processing_notes,
        submitted_at,
        completed_at,
        created_at,
        updated_at
    INTO NEW;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insert_nanopore_submission_trigger
INSTEAD OF INSERT ON nanopore_submissions
FOR EACH ROW
EXECUTE FUNCTION insert_nanopore_submission();

-- UPDATE trigger
CREATE OR REPLACE FUNCTION update_nanopore_submission()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE submissions SET
        name = COALESCE(NEW.submission_number, name),
        description = NEW.notes,
        submitter_name = COALESCE(NEW.submitter_name, submitter_name),
        submitter_email = COALESCE(NEW.submitter_email, submitter_email),
        submission_type = COALESCE(NEW.submission_type, submission_type),
        status = COALESCE(NEW.status, status),
        priority = COALESCE(NEW.priority, priority),
        original_filename = NEW.pdf_filename,
        file_size_bytes = NEW.file_size_bytes,
        processing_notes = NEW.processing_notes,
        submitted_at = COALESCE(NEW.submitted_at, submitted_at),
        completed_at = NEW.completed_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_nanopore_submission_trigger
INSTEAD OF UPDATE ON nanopore_submissions
FOR EACH ROW
EXECUTE FUNCTION update_nanopore_submission();

-- DELETE trigger
CREATE OR REPLACE FUNCTION delete_nanopore_submission()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM submissions WHERE id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delete_nanopore_submission_trigger
INSTEAD OF DELETE ON nanopore_submissions
FOR EACH ROW
EXECUTE FUNCTION delete_nanopore_submission();

-- Comment for documentation
COMMENT ON VIEW nanopore_submissions IS 'Compatibility view that maps nanopore_submissions to submissions table for backward compatibility';

#!/bin/bash

# Script to fix the submissions table issue in OpenShift
# This version handles the case where nanopore_submissions already exists as a table

echo "=================================================="
echo "Fixing Submissions Display Issue (v2)"
echo "=================================================="

# Login to OpenShift if not already logged in
if ! oc whoami &> /dev/null; then
    echo "Please log in to OpenShift first:"
    oc login
fi

# Set the project
PROJECT_NAME="dept-barc"
echo "Switching to project: $PROJECT_NAME"
oc project $PROJECT_NAME

# Get the PostgreSQL pod
DB_POD=$(oc get pods -l app=postgresql -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$DB_POD" ]; then
    echo "Error: PostgreSQL pod not found in project $PROJECT_NAME"
    echo "Looking for database pods..."
    oc get pods | grep -E "(postgres|db|database)"
    exit 1
fi

echo "Found PostgreSQL pod: $DB_POD"
echo ""

# First, check what we're dealing with
echo "Checking current database structure..."
echo ""

# Check if nanopore_submissions exists and what type it is
IS_TABLE=$(oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nanopore_submissions';" 2>/dev/null | tr -d ' ')
IS_VIEW=$(oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM pg_views WHERE schemaname = 'public' AND viewname = 'nanopore_submissions';" 2>/dev/null | tr -d ' ')
HAS_SUBMISSIONS=$(oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submissions';" 2>/dev/null | tr -d ' ')

echo "Database structure analysis:"
echo "- nanopore_submissions is a table: $IS_TABLE"
echo "- nanopore_submissions is a view: $IS_VIEW"
echo "- submissions table exists: $HAS_SUBMISSIONS"
echo ""

# Since nanopore_submissions exists as a table, we need to ensure:
# 1. The submissions table also exists (for compatibility)
# 2. Data is synchronized between them
# 3. The API can work with the existing structure

# Create the fix SQL based on what exists
cat > /tmp/fix_submissions_v2.sql << 'EOF'
-- Fix for OpenShift where nanopore_submissions already exists as a table

-- First, ensure the submissions table exists if it doesn't
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    submitter_name VARCHAR(255) NOT NULL,
    submitter_email VARCHAR(255) NOT NULL,
    submission_type VARCHAR(50) DEFAULT 'manual',
    status VARCHAR(50) DEFAULT 'draft',
    priority VARCHAR(20) DEFAULT 'normal',
    original_filename VARCHAR(255),
    file_size_bytes INTEGER,
    processing_notes TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_submissions_project_id ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

-- Now, sync data from nanopore_submissions to submissions (if nanopore_submissions has data)
-- First check if we need to migrate data
DO $$
DECLARE
    ns_count INTEGER;
    s_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO ns_count FROM nanopore_submissions;
    SELECT COUNT(*) INTO s_count FROM submissions;
    
    -- Only migrate if nanopore_submissions has data and submissions is empty
    IF ns_count > 0 AND s_count = 0 THEN
        RAISE NOTICE 'Migrating % records from nanopore_submissions to submissions', ns_count;
        
        INSERT INTO submissions (
            id,
            name,
            description,
            submitter_name,
            submitter_email,
            submission_type,
            status,
            priority,
            original_filename,
            file_size_bytes,
            submitted_at,
            completed_at,
            created_at,
            updated_at
        )
        SELECT 
            id,
            COALESCE(submission_number, 'SUBM-' || id::text),
            notes,
            COALESCE(submitter_name, 'Unknown'),
            COALESCE(submitter_email, 'unknown@example.com'),
            'manual',
            COALESCE(status, 'draft'),
            COALESCE(priority, 'normal'),
            pdf_filename,
            file_size_bytes,
            COALESCE(submitted_at, submission_date),
            completed_at,
            COALESCE(created_at, CURRENT_TIMESTAMP),
            COALESCE(updated_at, CURRENT_TIMESTAMP)
        FROM nanopore_submissions
        ON CONFLICT (id) DO NOTHING;
    END IF;
END$$;

-- Add sample_number column to nanopore_samples if it doesn't exist
ALTER TABLE nanopore_samples 
ADD COLUMN IF NOT EXISTS sample_number INTEGER;

-- Update sample numbers if they're null
WITH numbered_samples AS (
  SELECT 
    id,
    submission_id,
    ROW_NUMBER() OVER (PARTITION BY submission_id ORDER BY created_at) as seq_num
  FROM nanopore_samples
  WHERE submission_id IS NOT NULL AND sample_number IS NULL
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

-- Verify the fix
DO $$
DECLARE
    sample_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO sample_count FROM nanopore_samples WHERE submission_id IS NOT NULL;
    RAISE NOTICE 'Found % samples linked to submissions', sample_count;
END$$;

EOF

echo "Applying fix to database..."
oc cp /tmp/fix_submissions_v2.sql $DB_POD:/tmp/fix_submissions_v2.sql
oc exec $DB_POD -- psql -U postgres -d nanopore_db -f /tmp/fix_submissions_v2.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database fix applied successfully!"
    
    # Verify the results
    echo ""
    echo "Verification:"
    echo "-------------"
    
    echo "Nanopore submissions count:"
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_submissions;" 2>/dev/null
    
    echo "Submissions count:"
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM submissions;" 2>/dev/null
    
    echo "Samples with submission_id:"
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_samples WHERE submission_id IS NOT NULL;" 2>/dev/null
    
    echo ""
    echo "Sample data (showing submissions with samples):"
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "SELECT ns.id, LEFT(ns.submission_number, 30) as submission, COUNT(s.id) as samples FROM nanopore_submissions ns LEFT JOIN nanopore_samples s ON s.submission_id = ns.id GROUP BY ns.id, ns.submission_number HAVING COUNT(s.id) > 0 LIMIT 5;" 2>/dev/null
    
    # Clean up
    echo ""
    echo "Cleaning up temporary files..."
    oc exec $DB_POD -- rm /tmp/fix_submissions_v2.sql
    rm /tmp/fix_submissions_v2.sql
    
    echo ""
    echo "=================================================="
    echo "Fix Complete!"
    echo "=================================================="
    echo ""
    echo "The database has been fixed to ensure compatibility."
    echo ""
    echo "Next steps:"
    echo "1. Restart the frontend pods to clear any caches:"
    echo "   oc rollout restart deployment/nanopore-frontend"
    echo ""
    echo "2. If issues persist, run the diagnostic script:"
    echo "   ./scripts/diagnose-openshift-db.sh"
    echo ""
else
    echo ""
    echo "❌ Fix failed!"
    echo "Please run the diagnostic script to understand the issue:"
    echo "   ./scripts/diagnose-openshift-db.sh"
    exit 1
fi

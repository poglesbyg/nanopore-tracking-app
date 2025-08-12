#!/bin/bash

# Script to migrate data from submissions to nanopore_submissions table
# and ensure samples are properly linked

echo "=================================================="
echo "Data Migration Fix for OpenShift"
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

# First, let's check the current state
echo "Current database state:"
echo "-----------------------"
echo "Submissions table count:"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM submissions;" 2>/dev/null

echo "Nanopore_submissions table count:"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_submissions;" 2>/dev/null

echo "Nanopore_samples count:"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_samples;" 2>/dev/null

echo ""
echo "Sample submissions data:"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "SELECT id, name, status FROM submissions LIMIT 5;" 2>/dev/null

# Create the migration SQL
cat > /tmp/migrate_data.sql << 'EOF'
-- Migration script to sync data between tables

BEGIN;

-- First, let's see what we're working with
DO $$
DECLARE
    s_count INTEGER;
    ns_count INTEGER;
    samples_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO s_count FROM submissions;
    SELECT COUNT(*) INTO ns_count FROM nanopore_submissions;
    SELECT COUNT(*) INTO samples_count FROM nanopore_samples;
    
    RAISE NOTICE 'Submissions: %, Nanopore_submissions: %, Samples: %', s_count, ns_count, samples_count;
END$$;

-- Migrate data from submissions to nanopore_submissions if needed
INSERT INTO nanopore_submissions (
    id,
    submission_number,
    submission_date,
    submitter_name,
    submitter_email,
    priority,
    status,
    notes,
    sample_count,
    pdf_filename,
    file_size_bytes,
    submitted_at,
    completed_at,
    created_at,
    updated_at
)
SELECT 
    s.id,
    COALESCE(s.name, 'SUBM-' || s.id::text),
    COALESCE(s.submitted_at, s.created_at),
    COALESCE(s.submitter_name, 'Unknown'),
    COALESCE(s.submitter_email, 'unknown@example.com'),
    COALESCE(s.priority, 'normal'),
    COALESCE(s.status, 'draft'),
    s.description,
    0, -- Will update this after counting samples
    s.original_filename,
    s.file_size_bytes,
    s.submitted_at,
    NULL, -- completed_at
    COALESCE(s.created_at, CURRENT_TIMESTAMP),
    COALESCE(s.updated_at, CURRENT_TIMESTAMP)
FROM submissions s
WHERE NOT EXISTS (
    SELECT 1 FROM nanopore_submissions ns WHERE ns.id = s.id
);

-- Update sample counts
UPDATE nanopore_submissions ns
SET sample_count = (
    SELECT COUNT(*) 
    FROM nanopore_samples s 
    WHERE s.submission_id = ns.id
);

-- Let's also check if there are any orphaned samples and try to link them
-- This is a safety check - samples should already have submission_id
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count 
    FROM nanopore_samples 
    WHERE submission_id IS NULL;
    
    IF orphan_count > 0 THEN
        RAISE NOTICE 'Found % orphaned samples', orphan_count;
    END IF;
END$$;

-- Final verification
DO $$
DECLARE
    final_ns_count INTEGER;
    final_s_count INTEGER;
    linked_samples INTEGER;
BEGIN
    SELECT COUNT(*) INTO final_ns_count FROM nanopore_submissions;
    SELECT COUNT(*) INTO final_s_count FROM submissions;
    SELECT COUNT(*) INTO linked_samples FROM nanopore_samples WHERE submission_id IS NOT NULL;
    
    RAISE NOTICE 'Migration complete:';
    RAISE NOTICE 'Nanopore_submissions: %', final_ns_count;
    RAISE NOTICE 'Submissions: %', final_s_count;
    RAISE NOTICE 'Linked samples: %', linked_samples;
END$$;

COMMIT;

-- Show the migrated data
SELECT 
    ns.id,
    LEFT(ns.submission_number, 30) as submission,
    ns.status,
    ns.priority,
    ns.sample_count
FROM nanopore_submissions ns
LIMIT 10;
EOF

echo ""
echo "Applying data migration..."
oc cp /tmp/migrate_data.sql $DB_POD:/tmp/migrate_data.sql
oc exec $DB_POD -- psql -U postgres -d nanopore_db -f /tmp/migrate_data.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Data migration completed successfully!"
    
    # Verify the results
    echo ""
    echo "Final verification:"
    echo "-------------------"
    
    echo "Nanopore_submissions count:"
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_submissions;" 2>/dev/null
    
    echo "Submissions with samples:"
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "SELECT ns.id, LEFT(ns.submission_number, 30) as submission, COUNT(s.id) as samples FROM nanopore_submissions ns LEFT JOIN nanopore_samples s ON s.submission_id = ns.id GROUP BY ns.id, ns.submission_number LIMIT 5;" 2>/dev/null
    
    # Clean up
    echo ""
    echo "Cleaning up temporary files..."
    oc exec $DB_POD -- rm /tmp/migrate_data.sql
    rm /tmp/migrate_data.sql
    
    echo ""
    echo "=================================================="
    echo "Migration Complete!"
    echo "=================================================="
    echo ""
    echo "Data has been migrated from submissions to nanopore_submissions."
    echo ""
    echo "Next steps:"
    echo "1. Find the correct deployment name:"
    echo "   oc get deployments"
    echo ""
    echo "2. Restart the frontend deployment (use the actual name from step 1):"
    echo "   oc rollout restart deployment/<actual-deployment-name>"
    echo ""
    echo "3. If you need to check pods:"
    echo "   oc get pods"
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    echo "Please check the error messages above."
    exit 1
fi

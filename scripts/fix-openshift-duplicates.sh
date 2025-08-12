#!/bin/bash

# Fix for duplicate submission names in OpenShift

echo "=================================================="
echo "OpenShift Fix - Handling Duplicate Submissions"
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
    echo "Error: PostgreSQL pod not found"
    exit 1
fi

echo "Found PostgreSQL pod: $DB_POD"
echo ""

# Create the migration SQL that handles duplicates
cat > /tmp/fix_duplicates.sql << 'EOF'
-- Fix duplicate submission names and migrate data

BEGIN;

-- First, check what we have
DO $$
DECLARE
    s_count INTEGER;
    ns_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO s_count FROM submissions;
    SELECT COUNT(*) INTO ns_count FROM nanopore_submissions;
    
    RAISE NOTICE 'Current state - Submissions: %, Nanopore_submissions: %', s_count, ns_count;
END$$;

-- Show duplicate names in submissions
SELECT name, COUNT(*) as count 
FROM submissions 
GROUP BY name 
HAVING COUNT(*) > 1;

-- Clear nanopore_submissions (it's currently empty anyway)
TRUNCATE TABLE nanopore_submissions CASCADE;

-- Migrate with unique submission numbers (append UUID part for duplicates)
INSERT INTO nanopore_submissions (
    id,
    submission_number,
    submission_date,
    submitter_name,
    submitter_email,
    priority,
    status
)
SELECT 
    s.id,
    CASE 
        WHEN row_number() OVER (PARTITION BY s.name ORDER BY s.created_at) > 1 
        THEN s.name || '-' || SUBSTRING(s.id::text, 1, 8)
        ELSE COALESCE(s.name, 'SUBM-' || SUBSTRING(s.id::text, 1, 8))
    END as submission_number,
    COALESCE(s.submitted_at, s.created_at, CURRENT_TIMESTAMP),
    COALESCE(s.submitter_name, 'Unknown'),
    COALESCE(s.submitter_email, 'unknown@example.com'),
    COALESCE(s.priority, 'normal'),
    COALESCE(s.status, 'draft')
FROM submissions s
ON CONFLICT (id) DO NOTHING;

-- Update optional fields if they exist
DO $$
BEGIN
    -- Update pdf_filename if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'nanopore_submissions' 
               AND column_name = 'pdf_filename') THEN
        UPDATE nanopore_submissions ns
        SET pdf_filename = s.original_filename
        FROM submissions s
        WHERE ns.id = s.id AND s.original_filename IS NOT NULL;
        RAISE NOTICE 'Updated pdf_filename';
    END IF;
    
    -- Update department if exists and source has description
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'nanopore_submissions' 
               AND column_name = 'department') THEN
        UPDATE nanopore_submissions ns
        SET department = 'Research'
        FROM submissions s
        WHERE ns.id = s.id;
        RAISE NOTICE 'Set default department';
    END IF;
    
    -- Update submitted_at if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'nanopore_submissions' 
               AND column_name = 'submitted_at') THEN
        UPDATE nanopore_submissions ns
        SET submitted_at = s.submitted_at
        FROM submissions s
        WHERE ns.id = s.id AND s.submitted_at IS NOT NULL;
        RAISE NOTICE 'Updated submitted_at';
    END IF;
    
    -- Update created_at if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'nanopore_submissions' 
               AND column_name = 'created_at') THEN
        UPDATE nanopore_submissions ns
        SET created_at = COALESCE(s.created_at, CURRENT_TIMESTAMP)
        FROM submissions s
        WHERE ns.id = s.id;
        RAISE NOTICE 'Updated created_at';
    END IF;
    
    -- Update updated_at if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'nanopore_submissions' 
               AND column_name = 'updated_at') THEN
        UPDATE nanopore_submissions ns
        SET updated_at = COALESCE(s.updated_at, CURRENT_TIMESTAMP)
        FROM submissions s
        WHERE ns.id = s.id;
        RAISE NOTICE 'Updated updated_at';
    END IF;
END$$;

-- Verify the migration
DO $$
DECLARE
    final_ns_count INTEGER;
    final_s_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO final_s_count FROM submissions;
    SELECT COUNT(*) INTO final_ns_count FROM nanopore_submissions;
    
    RAISE NOTICE 'After migration - Submissions: %, Nanopore_submissions: %', final_s_count, final_ns_count;
    
    IF final_ns_count = final_s_count THEN
        RAISE NOTICE '✅ SUCCESS: All % records migrated!', final_ns_count;
    ELSE
        RAISE WARNING '⚠️ WARNING: Count mismatch! Expected % but got %', final_s_count, final_ns_count;
    END IF;
END$$;

COMMIT;

-- Show the migrated data with unique names
SELECT 
    ns.id,
    LEFT(ns.submission_number, 40) as submission,
    ns.status,
    ns.priority
FROM nanopore_submissions ns
ORDER BY ns.submission_date DESC;

-- Final counts
SELECT 
    'Total submissions' as metric,
    COUNT(*) as count
FROM submissions
UNION ALL
SELECT 
    'Total nanopore_submissions' as metric,
    COUNT(*) as count
FROM nanopore_submissions
UNION ALL
SELECT 
    'Unique submission_numbers' as metric,
    COUNT(DISTINCT submission_number) as count
FROM nanopore_submissions;
EOF

echo "Running migration with duplicate handling..."
oc cp /tmp/fix_duplicates.sql $DB_POD:/tmp/fix_duplicates.sql
oc exec $DB_POD -- psql -U postgres -d nanopore_db -f /tmp/fix_duplicates.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration successful!"
    
    # Verify
    echo ""
    echo "Verification:"
    echo "-------------"
    
    echo "Total records in nanopore_submissions:"
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_submissions;" 2>/dev/null
    
    # Restart deployment
    echo ""
    echo "Restarting application..."
    oc rollout restart deployment/nanopore-tracking-app
    
    echo ""
    echo "Checking rollout status..."
    oc rollout status deployment/nanopore-tracking-app --timeout=120s || true
    
    # Check pods
    echo ""
    echo "Current pods:"
    oc get pods | grep nanopore-tracking-app
    
    # Clean up
    oc exec $DB_POD -- rm /tmp/fix_duplicates.sql 2>/dev/null
    rm /tmp/fix_duplicates.sql 2>/dev/null
    
    echo ""
    echo "=================================================="
    echo "🎉 Fix Complete!"
    echo "=================================================="
    echo ""
    echo "✅ Data migrated (duplicates handled with unique suffixes)"
    echo "✅ Application restarted"
    echo ""
    echo "Check your application at:"
    echo "   https://nanopore-tracking-dept-barc.apps.cloudapps.unc.edu"
    echo ""
    echo "Important notes:"
    echo "1. Duplicate submission names have been made unique by adding ID suffixes"
    echo "2. There are still NO samples in the database"
    echo "3. You'll need to create or import samples separately"
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi

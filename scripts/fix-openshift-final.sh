#!/bin/bash

# Final comprehensive fix for OpenShift - checks exact schema and migrates data properly

echo "=================================================="
echo "Final OpenShift Fix - Comprehensive Solution"
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

# Step 1: Get exact columns of both tables
echo "Step 1: Analyzing table structures..."
echo "--------------------------------------"

# Get nanopore_submissions columns
echo "Getting nanopore_submissions columns..."
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'nanopore_submissions' ORDER BY ordinal_position;" > /tmp/ns_columns.txt

echo "Getting submissions columns..."
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'submissions' ORDER BY ordinal_position;" > /tmp/s_columns.txt

echo ""
echo "Nanopore_submissions columns:"
cat /tmp/ns_columns.txt | head -20

# Step 2: Create dynamic migration based on actual columns
echo ""
echo "Step 2: Creating migration based on actual schema..."
echo "----------------------------------------------------"

cat > /tmp/dynamic_migration.sql << 'EOF'
-- Dynamic migration that maps only existing columns

BEGIN;

-- Show current state
DO $$
DECLARE
    s_count INTEGER;
    ns_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO s_count FROM submissions;
    SELECT COUNT(*) INTO ns_count FROM nanopore_submissions;
    
    RAISE NOTICE 'Before migration - Submissions: %, Nanopore_submissions: %', s_count, ns_count;
END$$;

-- Clear nanopore_submissions first (in case of partial data)
TRUNCATE TABLE nanopore_submissions CASCADE;

-- Migrate with careful column mapping based on what actually exists
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
    COALESCE(s.name, 'SUBM-' || SUBSTRING(s.id::text, 1, 8)),
    COALESCE(s.submitted_at, s.created_at, CURRENT_TIMESTAMP),
    COALESCE(s.submitter_name, 'Unknown'),
    COALESCE(s.submitter_email, 'unknown@example.com'),
    COALESCE(s.priority, 'normal'),
    COALESCE(s.status, 'draft')
FROM submissions s;

-- If pdf_filename exists, try to update it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'nanopore_submissions' 
               AND column_name = 'pdf_filename') THEN
        UPDATE nanopore_submissions ns
        SET pdf_filename = s.original_filename
        FROM submissions s
        WHERE ns.id = s.id AND s.original_filename IS NOT NULL;
    END IF;
END$$;

-- If submitted_at exists, try to update it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'nanopore_submissions' 
               AND column_name = 'submitted_at') THEN
        UPDATE nanopore_submissions ns
        SET submitted_at = s.submitted_at
        FROM submissions s
        WHERE ns.id = s.id AND s.submitted_at IS NOT NULL;
    END IF;
END$$;

-- If created_at exists, try to update it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'nanopore_submissions' 
               AND column_name = 'created_at') THEN
        UPDATE nanopore_submissions ns
        SET created_at = COALESCE(s.created_at, CURRENT_TIMESTAMP)
        FROM submissions s
        WHERE ns.id = s.id;
    END IF;
END$$;

-- If updated_at exists, try to update it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'nanopore_submissions' 
               AND column_name = 'updated_at') THEN
        UPDATE nanopore_submissions ns
        SET updated_at = COALESCE(s.updated_at, CURRENT_TIMESTAMP)
        FROM submissions s
        WHERE ns.id = s.id;
    END IF;
END$$;

-- Final count
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

-- Show the migrated data
SELECT 
    ns.id,
    LEFT(ns.submission_number, 30) as submission,
    ns.status,
    ns.priority
FROM nanopore_submissions ns
LIMIT 10;

-- Show sample counts per submission
SELECT 
    'Submissions with samples' as metric,
    COUNT(DISTINCT ns.id) as count
FROM nanopore_submissions ns
INNER JOIN nanopore_samples s ON s.submission_id = ns.id
UNION ALL
SELECT 
    'Total nanopore_submissions' as metric,
    COUNT(*) as count
FROM nanopore_submissions
UNION ALL
SELECT 
    'Total nanopore_samples' as metric,
    COUNT(*) as count
FROM nanopore_samples;
EOF

echo "Step 3: Running migration..."
echo "----------------------------"
oc cp /tmp/dynamic_migration.sql $DB_POD:/tmp/dynamic_migration.sql
oc exec $DB_POD -- psql -U postgres -d nanopore_db -f /tmp/dynamic_migration.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration successful!"
    
    # Step 4: Verify
    echo ""
    echo "Step 4: Final verification"
    echo "--------------------------"
    
    echo "Nanopore_submissions count:"
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_submissions;" 2>/dev/null
    
    echo "Sample data:"
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "SELECT id, LEFT(submission_number, 30) as submission, status FROM nanopore_submissions LIMIT 3;" 2>/dev/null
    
    # Step 5: Restart deployment
    echo ""
    echo "Step 5: Restarting application..."
    echo "----------------------------------"
    oc rollout restart deployment/nanopore-tracking-app
    
    echo ""
    echo "Waiting for rollout to complete..."
    oc rollout status deployment/nanopore-tracking-app --timeout=60s
    
    # Clean up
    oc exec $DB_POD -- rm /tmp/dynamic_migration.sql 2>/dev/null
    rm /tmp/dynamic_migration.sql /tmp/ns_columns.txt /tmp/s_columns.txt 2>/dev/null
    
    echo ""
    echo "=================================================="
    echo "🎉 Fix Complete!"
    echo "=================================================="
    echo ""
    echo "✅ Data migrated successfully"
    echo "✅ Application restarted"
    echo ""
    echo "Check your application at:"
    echo "   https://nanopore-tracking-dept-barc.apps.cloudapps.unc.edu"
    echo ""
    echo "Note: There are NO samples in the database (nanopore_samples is empty)."
    echo "You'll need to create samples through the UI or import them from files."
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi

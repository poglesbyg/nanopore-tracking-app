#!/bin/bash

# Script to find where sample data might be and import it

echo "=================================================="
echo "Sample Data Investigation and Import"
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
    exit 1
fi

echo "Found PostgreSQL pod: $DB_POD"
echo ""

echo "1. Checking all tables that might contain sample data:"
echo "-------------------------------------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%sample%' ORDER BY table_name;" 2>/dev/null

echo ""
echo "2. Checking sample_hierarchy view:"
echo "-----------------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "SELECT COUNT(*) as total_records FROM sample_hierarchy;" 2>/dev/null

echo ""
echo "3. Sample data from sample_hierarchy (if exists):"
echo "--------------------------------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "SELECT * FROM sample_hierarchy LIMIT 5;" 2>/dev/null

echo ""
echo "4. Structure of sample_hierarchy:"
echo "----------------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "\d sample_hierarchy" 2>&1 | head -30

echo ""
echo "5. Check if we need to import sample data:"
echo "-------------------------------------------"

# Create import script
cat > /tmp/import_samples.sql << 'EOF'
-- Check and import sample data if needed

BEGIN;

-- First, check what we have
DO $$
DECLARE
    hierarchy_count INTEGER;
    samples_count INTEGER;
    has_sample_hierarchy BOOLEAN;
BEGIN
    -- Check if sample_hierarchy exists and has data
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'sample_hierarchy'
    ) INTO has_sample_hierarchy;
    
    IF has_sample_hierarchy THEN
        SELECT COUNT(*) INTO hierarchy_count FROM sample_hierarchy;
        RAISE NOTICE 'sample_hierarchy has % records', hierarchy_count;
        
        -- If sample_hierarchy has data but nanopore_samples doesn't, we might need to import
        SELECT COUNT(*) INTO samples_count FROM nanopore_samples;
        
        IF hierarchy_count > 0 AND samples_count = 0 THEN
            RAISE NOTICE 'Need to import % samples from sample_hierarchy', hierarchy_count;
            
            -- Import samples from sample_hierarchy
            INSERT INTO nanopore_samples (
                id,
                submission_id,
                sample_name,
                sample_number,
                sample_type,
                submitter_name,
                submitter_email,
                lab_name,
                status,
                priority,
                concentration,
                volume,
                created_at,
                updated_at
            )
            SELECT 
                COALESCE(sample_id, gen_random_uuid()),
                submission_id,
                sample_name,
                ROW_NUMBER() OVER (PARTITION BY submission_id ORDER BY sample_name),
                COALESCE(sample_type, 'DNA'),
                submitter_name,
                submitter_email,
                lab_name,
                COALESCE(sample_status, 'submitted'),
                COALESCE(sample_priority, 'normal'),
                concentration::numeric(10,3),
                volume::numeric(10,2),
                COALESCE(sample_created_at, CURRENT_TIMESTAMP),
                COALESCE(sample_updated_at, CURRENT_TIMESTAMP)
            FROM sample_hierarchy
            WHERE sample_id IS NOT NULL
            ON CONFLICT (id) DO NOTHING;
            
            GET DIAGNOSTICS samples_count = ROW_COUNT;
            RAISE NOTICE 'Imported % samples', samples_count;
        ELSE
            RAISE NOTICE 'No import needed. Samples already exist or no data in hierarchy.';
        END IF;
    ELSE
        RAISE NOTICE 'sample_hierarchy view does not exist';
    END IF;
END$$;

-- Verify the import
SELECT 
    'Total samples' as metric,
    COUNT(*) as count
FROM nanopore_samples
UNION ALL
SELECT 
    'Samples with submission_id' as metric,
    COUNT(*) as count
FROM nanopore_samples
WHERE submission_id IS NOT NULL
UNION ALL
SELECT 
    'Unique submissions with samples' as metric,
    COUNT(DISTINCT submission_id) as count
FROM nanopore_samples
WHERE submission_id IS NOT NULL;

-- Show sample of imported data
SELECT 
    s.id,
    s.sample_name,
    s.submission_id,
    ns.submission_number
FROM nanopore_samples s
LEFT JOIN nanopore_submissions ns ON ns.id = s.submission_id
LIMIT 5;

COMMIT;
EOF

echo ""
echo "Attempting to import sample data..."
oc cp /tmp/import_samples.sql $DB_POD:/tmp/import_samples.sql
oc exec $DB_POD -- psql -U postgres -d nanopore_db -f /tmp/import_samples.sql

echo ""
echo "6. Final sample count verification:"
echo "------------------------------------"
echo "Total samples in nanopore_samples:"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_samples;" 2>/dev/null

echo ""
echo "Submissions with samples:"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "SELECT ns.submission_number, COUNT(s.id) as sample_count FROM nanopore_submissions ns LEFT JOIN nanopore_samples s ON s.submission_id = ns.id GROUP BY ns.submission_number HAVING COUNT(s.id) > 0;" 2>/dev/null

# Clean up
oc exec $DB_POD -- rm /tmp/import_samples.sql 2>/dev/null
rm /tmp/import_samples.sql 2>/dev/null

echo ""
echo "=================================================="
echo "Investigation Complete"
echo "=================================================="
echo ""
echo "If samples were found and imported, restart your application deployment."
echo "To find deployment names, run: ./scripts/check-openshift-deployments.sh"

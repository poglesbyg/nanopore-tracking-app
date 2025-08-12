#!/bin/bash

# Script to diagnose the actual database structure in OpenShift
echo "=================================================="
echo "OpenShift Database Diagnostic"
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

echo "1. Checking what tables exist:"
echo "-------------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND (table_name LIKE '%submission%' OR table_name LIKE '%sample%' OR table_name = 'projects') ORDER BY table_name;"

echo ""
echo "2. Structure of nanopore_submissions table:"
echo "--------------------------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "\d nanopore_submissions" 2>&1 | head -30

echo ""
echo "3. Structure of submissions table (if exists):"
echo "-----------------------------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "\d submissions" 2>&1 | head -30

echo ""
echo "4. Structure of nanopore_samples table:"
echo "----------------------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "\d nanopore_samples" 2>&1 | head -20

echo ""
echo "5. Count of records in each table:"
echo "-----------------------------------"
echo "nanopore_submissions:"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_submissions;" 2>&1

echo "submissions (if exists):"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM submissions;" 2>&1 | head -2

echo "nanopore_samples:"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_samples;" 2>&1

echo ""
echo "6. Sample data relationships:"
echo "------------------------------"
echo "Samples with submission_id:"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_samples WHERE submission_id IS NOT NULL;" 2>&1

echo ""
echo "7. Check if views exist:"
echo "-------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE '%submission%';" 2>&1

echo ""
echo "8. Sample of submission data with samples:"
echo "-------------------------------------------"
oc exec $DB_POD -- psql -U postgres -d nanopore_db -c "SELECT ns.id, ns.submission_number, COUNT(s.id) as sample_count FROM nanopore_submissions ns LEFT JOIN nanopore_samples s ON s.submission_id = ns.id GROUP BY ns.id, ns.submission_number LIMIT 5;" 2>&1

echo ""
echo "=================================================="
echo "Diagnostic Complete"
echo "=================================================="

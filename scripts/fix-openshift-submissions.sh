#!/bin/bash

# Script to fix the submissions table name mismatch in OpenShift deployment
# This creates a view that maps nanopore_submissions to submissions table

echo "=================================================="
echo "Fixing Submissions Table Name Mismatch"
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

# Copy the migration file to the pod
echo "Copying migration file to pod..."
oc cp database/migrations/1755000000000_fix_submissions_table_name.sql $DB_POD:/tmp/fix_submissions.sql

# Execute the migration
echo "Executing migration..."
oc exec $DB_POD -- psql -U postgres -d nanopore_db -f /tmp/fix_submissions.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    
    # Verify the view was created
    echo ""
    echo "Verifying the view..."
    oc exec $DB_POD -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_submissions;" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ View nanopore_submissions is working correctly!"
    else
        echo "⚠️ Warning: Could not verify the view"
    fi
    
    # Clean up
    echo "Cleaning up temporary files..."
    oc exec $DB_POD -- rm /tmp/fix_submissions.sql
    
    echo ""
    echo "=================================================="
    echo "Migration Complete!"
    echo "=================================================="
    echo ""
    echo "The nanopore_submissions view has been created."
    echo "The application should now be able to display samples in submissions."
    echo ""
    echo "Next steps:"
    echo "1. Restart the frontend pods to clear any caches:"
    echo "   oc rollout restart deployment/nanopore-frontend"
    echo ""
else
    echo "❌ Migration failed!"
    echo "Please check the error messages above."
    exit 1
fi

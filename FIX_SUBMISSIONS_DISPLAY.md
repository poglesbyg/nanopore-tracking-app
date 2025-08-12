# Fix for Submissions Not Displaying Samples in OpenShift

## Problem Identified
The OpenShift deployment wasn't displaying samples within submissions because of a table name mismatch:
- The application code expects a table named `nanopore_submissions`
- The database only has a table named `submissions`
- This caused the API endpoint `/api/submissions/get-all` to fail when trying to fetch submissions with their samples

## Solution Implemented
Created a database view that maps `nanopore_submissions` to the existing `submissions` table, allowing the application to work without modifying all the code references.

### What the Fix Does:
1. Creates a view `nanopore_submissions` that reads from the `submissions` table
2. Maps column names appropriately (e.g., `name` → `submission_number`, `created_at` → `submission_date`)
3. Implements triggers for INSERT, UPDATE, and DELETE operations so the view behaves like a real table
4. Maintains backward compatibility with existing code

## How to Apply the Fix

### For Local Development (Already Applied)
The fix has already been applied to your local database. You can verify it's working:
```bash
# Check if the view exists and returns data
PGPASSWORD=postgres psql -h localhost -p 5436 -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_submissions;"
```

### For OpenShift Deployment

#### Option 1: Automated Script (Recommended)
Run the provided script that will handle everything:
```bash
./scripts/fix-openshift-submissions.sh
```

This script will:
1. Connect to your OpenShift project
2. Find the PostgreSQL pod
3. Apply the migration
4. Verify the fix
5. Provide instructions for restarting the frontend

#### Option 2: Manual Steps
If the script doesn't work or you prefer manual control:

1. **Login to OpenShift:**
```bash
oc login
oc project dept-barc
```

2. **Find the PostgreSQL pod:**
```bash
oc get pods | grep postgres
```

3. **Copy the migration file to the pod:**
```bash
oc cp database/migrations/1755000000000_fix_submissions_table_name.sql <POD_NAME>:/tmp/fix_submissions.sql
```

4. **Execute the migration:**
```bash
oc exec <POD_NAME> -- psql -U postgres -d nanopore_db -f /tmp/fix_submissions.sql
```

5. **Verify the fix:**
```bash
oc exec <POD_NAME> -- psql -U postgres -d nanopore_db -t -c "SELECT COUNT(*) FROM nanopore_submissions;"
```

6. **Restart the frontend to clear any caches:**
```bash
oc rollout restart deployment/nanopore-frontend
```

## Testing the Fix

After applying the fix:

1. **Visit the application:** Navigate to your OpenShift deployment URL
2. **Check submissions:** Go to the submissions or projects view
3. **Verify samples:** Samples should now be visible within submissions that have them

## Files Changed/Created

1. **Created migration:** `database/migrations/1755000000000_fix_submissions_table_name.sql`
   - Creates the view and triggers for compatibility

2. **Created fix script:** `scripts/fix-openshift-submissions.sh`
   - Automated script to apply the fix to OpenShift

3. **Created documentation:** `FIX_SUBMISSIONS_DISPLAY.md` (this file)
   - Instructions and explanation of the fix

## Technical Details

The view handles the following column mappings:
- `submissions.name` → `nanopore_submissions.submission_number`
- `submissions.created_at` → `nanopore_submissions.submission_date`
- `submissions.description` → `nanopore_submissions.notes`
- `submissions.original_filename` → `nanopore_submissions.pdf_filename`

The INSTEAD OF triggers ensure that:
- INSERTs to the view create records in the `submissions` table
- UPDATEs to the view modify the `submissions` table
- DELETEs from the view remove records from the `submissions` table

## Rollback (If Needed)

If you need to rollback this change:
```sql
-- Remove the view and triggers
DROP VIEW IF EXISTS nanopore_submissions CASCADE;
```

## Long-term Solution

While this view provides immediate compatibility, consider these long-term improvements:
1. Standardize on a single table name throughout the codebase
2. Update all references to use consistent naming
3. Consolidate duplicate migration files
4. Add integration tests to catch such issues early

## Support

If you encounter any issues:
1. Check the PostgreSQL logs: `oc logs <postgres-pod-name>`
2. Verify the view exists: `oc exec <postgres-pod> -- psql -U postgres -d nanopore_db -c "\dv"`
3. Check for any error messages in the frontend logs: `oc logs <frontend-pod-name>`

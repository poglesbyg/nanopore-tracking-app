# OpenShift Database Fix - Submissions Display Issue

## Problem Analysis
The OpenShift deployment has a different database structure than your local environment:
- **OpenShift**: Has `nanopore_submissions` as an actual **table**
- **Local**: Has `submissions` table with a view named `nanopore_submissions`

When the first fix script ran, it failed because:
1. It tried to create a view named `nanopore_submissions`, but a table with that name already exists
2. The `submissions` table was missing the `processing_notes` column
3. INSTEAD OF triggers can't be created on tables (only on views)

## Solution
I've created two new scripts to handle this situation:

### 1. Diagnostic Script
**File:** `scripts/diagnose-openshift-db.sh`

This script will help you understand the actual database structure in OpenShift:
```bash
./scripts/diagnose-openshift-db.sh
```

It will show you:
- What tables exist (submissions, nanopore_submissions, etc.)
- The structure of each table
- Record counts
- Data relationships between tables
- Sample data

### 2. Fix Script v2
**File:** `scripts/fix-openshift-submissions-v2.sh`

This updated fix script handles the case where `nanopore_submissions` already exists as a table:
```bash
./scripts/fix-openshift-submissions-v2.sh
```

What this script does:
1. **Checks the current database structure** to understand what tables/views exist
2. **Creates the `submissions` table if needed** for API compatibility
3. **Syncs data between tables** if necessary
4. **Adds the `sample_number` column** to `nanopore_samples` if missing
5. **Verifies the fix** by showing sample counts and relationships

## Steps to Fix OpenShift

### Step 1: Run Diagnostics (Optional but Recommended)
First, understand what's in your database:
```bash
./scripts/diagnose-openshift-db.sh
```

This will help you see the current state before applying fixes.

### Step 2: Apply the Fix
Run the new fix script:
```bash
./scripts/fix-openshift-submissions-v2.sh
```

### Step 3: Restart the Frontend
Clear any cached data:
```bash
oc rollout restart deployment/nanopore-frontend
```

### Step 4: Verify
1. Check the application in your browser
2. Navigate to the submissions or projects view
3. Verify that samples are now visible within submissions

## What the Fix Does

The v2 fix script is designed to handle multiple scenarios:

1. **If `nanopore_submissions` is a table**: 
   - Creates `submissions` table for compatibility
   - Syncs data between the tables
   - Ensures both can work together

2. **If `submissions` doesn't exist**:
   - Creates it with the proper structure
   - Migrates data from `nanopore_submissions` if needed

3. **For `nanopore_samples`**:
   - Adds `sample_number` column if missing
   - Updates existing samples with sequential numbers
   - Creates indexes for performance

## Troubleshooting

If the fix doesn't work:

1. **Run diagnostics** to understand the issue:
   ```bash
   ./scripts/diagnose-openshift-db.sh
   ```

2. **Check pod logs**:
   ```bash
   oc logs deployment/nanopore-frontend
   ```

3. **Check database directly**:
   ```bash
   oc exec <postgres-pod> -- psql -U postgres -d nanopore_db
   ```

4. **Verify API endpoints**:
   ```bash
   # Get the route
   oc get route nanopore-frontend -o jsonpath='{.spec.host}'
   
   # Test the API
   curl https://<route-host>/api/submissions/get-all
   ```

## Technical Details

### Database Structure Differences
- **Local Environment**: Uses `submissions` table with a compatibility view
- **OpenShift Environment**: Uses `nanopore_submissions` table directly
- **Fix**: Ensures both tables exist and are synchronized

### API Compatibility
The API code references `nanopore_submissions`, so:
- In local: A view maps to `submissions` table
- In OpenShift: The actual `nanopore_submissions` table is used
- The fix ensures both environments work with the same code

## Files Created
- `scripts/diagnose-openshift-db.sh` - Diagnostic tool for database analysis
- `scripts/fix-openshift-submissions-v2.sh` - Updated fix script for OpenShift
- `OPENSHIFT_DB_FIX.md` - This documentation file

## Next Steps
1. Run the diagnostic script to understand your database
2. Apply the v2 fix script
3. Restart the frontend deployment
4. Test the application

If you continue to have issues, please share the output from the diagnostic script so we can further troubleshoot.

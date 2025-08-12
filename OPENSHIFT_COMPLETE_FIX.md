# Complete OpenShift Fix - Submissions and Samples Display

## Problem Summary
Based on the diagnostic output, the issue is:
1. **Data is in the wrong table**: `submissions` has 11 records, but `nanopore_submissions` is empty
2. **No samples exist**: `nanopore_samples` table is completely empty (0 records)
3. **No linked data**: No samples are linked to any submissions
4. **Wrong deployment name**: `nanopore-frontend` doesn't exist

## Solution: Three-Step Fix Process

### Step 1: Find the Correct Deployment Names
```bash
./scripts/check-openshift-deployments.sh
```
This will show you all deployments, services, and routes in your OpenShift project.

### Step 2: Migrate Data to Correct Tables
```bash
./scripts/fix-openshift-data-migration.sh
```
This script will:
- Copy data from `submissions` → `nanopore_submissions`
- Preserve all existing records
- Set up proper relationships

### Step 3: Import Sample Data (if it exists elsewhere)
```bash
./scripts/find-and-import-samples.sh
```
This script will:
- Check if samples exist in `sample_hierarchy` view or other tables
- Import any found samples into `nanopore_samples`
- Link samples to their submissions

### Step 4: Restart the Application
After running the above scripts, you'll know the correct deployment name. Restart it:
```bash
# Replace <deployment-name> with the actual name from Step 1
oc rollout restart deployment/<deployment-name>
```

## Scripts Created

### 1. `check-openshift-deployments.sh`
- Lists all deployments, services, and routes
- Helps find the correct deployment names
- Shows how to restart deployments

### 2. `fix-openshift-data-migration.sh`
- Migrates data from `submissions` to `nanopore_submissions`
- Ensures both tables are synchronized
- Updates sample counts

### 3. `find-and-import-samples.sh`
- Searches for sample data in all tables
- Checks `sample_hierarchy` view
- Imports samples if found

## Understanding the Issue

### Database Structure in OpenShift
```
Tables that exist:
- nanopore_submissions (empty - 0 records) ← API expects data here
- submissions (has data - 11 records) ← Data is actually here
- nanopore_samples (empty - 0 records) ← No samples to display
- projects (has data)
- sample_hierarchy (view - might have sample data)
```

### Why This Happened
The OpenShift environment has both `submissions` and `nanopore_submissions` tables, but:
- Data was inserted into `submissions` table
- The API reads from `nanopore_submissions` table
- No samples were ever created or imported

## Quick Fix Commands

Run these in order:
```bash
# 1. Check what deployments exist
./scripts/check-openshift-deployments.sh

# 2. Migrate the submission data
./scripts/fix-openshift-data-migration.sh

# 3. Import samples if they exist
./scripts/find-and-import-samples.sh

# 4. Restart the deployment (use actual name from step 1)
oc rollout restart deployment/<actual-deployment-name>
```

## Verification

After running the fixes, verify success:
```bash
# Check if data was migrated
oc exec <postgres-pod> -- psql -U postgres -d nanopore_db -c "SELECT COUNT(*) FROM nanopore_submissions;"

# Check if samples exist
oc exec <postgres-pod> -- psql -U postgres -d nanopore_db -c "SELECT COUNT(*) FROM nanopore_samples;"

# Check relationships
oc exec <postgres-pod> -- psql -U postgres -d nanopore_db -c "SELECT ns.submission_number, COUNT(s.id) FROM nanopore_submissions ns LEFT JOIN nanopore_samples s ON s.submission_id = ns.id GROUP BY ns.submission_number;"
```

## Troubleshooting

### If no deployments are found:
```bash
# Check all resources
oc get all

# Check if you're in the right project
oc project

# List all projects
oc projects
```

### If data migration fails:
```bash
# Run diagnostics again
./scripts/diagnose-openshift-db.sh

# Check PostgreSQL logs
oc logs <postgres-pod>
```

### If samples are still not showing:
1. The `nanopore_samples` table might genuinely be empty
2. Check if samples exist in CSV/PDF files that need importing
3. You may need to manually create test samples or import from files

## Long-term Solution

To prevent this in the future:
1. Standardize on one table name (`nanopore_submissions`)
2. Ensure migrations run in the correct order
3. Add data validation checks in deployment scripts
4. Create integration tests for data relationships

## Support

If issues persist after running all scripts:
1. Share the output from `./scripts/diagnose-openshift-db.sh`
2. Share the output from `./scripts/check-openshift-deployments.sh`
3. Check application logs: `oc logs <your-app-pod>`

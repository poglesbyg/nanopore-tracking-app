# Deployment Script Update Summary

## Overview
The deployment script has been updated to support deploying both the main Node.js application and the new Python submission service to OpenShift.

## Key Changes Made

### 1. Updated `scripts/deploy-openshift.sh`
- Added support for deploying the Python submission service
- Added new command-line options:
  - `--submission-only` - Deploy only the submission service
  - `--main-only` - Deploy only the main application
  - `--status` - Show deployment status for both services
  - `--rollback [main|submission]` - Rollback specific service or all
- Added Docker prerequisite check
- Added submission service deployment function that:
  - Builds Docker image locally
  - Pushes to OpenShift registry
  - Deploys using OpenShift configurations

### 2. Updated Configuration Files
- **`deployment/openshift/configmap.yaml`**:
  - Added `submission-service-url: "http://submission-service:8000"`
- **`deployment/openshift/deployment.yaml`**:
  - Added `SUBMISSION_SERVICE_URL` environment variable

### 3. Created Documentation
- **`DEPLOYMENT_WITH_SUBMISSION_SERVICE.md`** - Comprehensive deployment guide

## Usage Examples

```bash
# Deploy both services
./scripts/deploy-openshift.sh

# Deploy only submission service
./scripts/deploy-openshift.sh --submission-only

# Check status
./scripts/deploy-openshift.sh --status

# Rollback submission service
./scripts/deploy-openshift.sh --rollback submission
```

## Benefits
- Single script manages both services
- Consistent deployment process
- Better error handling and status reporting
- Support for individual service deployments
- Integrated health checks for both services

## Next Steps
1. Test the deployment script with both services
2. Monitor memory usage improvements
3. Verify inter-service communication
4. Update CI/CD pipelines if needed 
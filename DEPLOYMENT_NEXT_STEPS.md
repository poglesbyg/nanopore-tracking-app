# 🚀 Deployment Next Steps

You're almost ready to deploy! Here's exactly what you need to do:

## Step 1: Verify Pre-deployment Status
```bash
./scripts/pre-deployment-check.sh
```
This script will check:
- ✅ OpenShift login status
- ✅ Resource availability
- ✅ Existing deployments
- ✅ Database connectivity
- ✅ Secret configuration

## Step 2: Generate and Update Secrets
```bash
# Generate secure secrets
./scripts/generate-secrets.sh

# This will:
# - Generate secure JWT secret (32 chars)
# - Generate admin password
# - Generate session secret
# - Help you configure database connection
```

The script will output a command to update your secrets. It will look like:
```bash
oc create secret generic nanopore-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=JWT_SECRET="..." \
  --from-literal=ADMIN_PASSWORD="..." \
  --from-literal=SESSION_SECRET="..." \
  --dry-run=client -o yaml | oc apply -f -
```

## Step 3: Deploy to OpenShift

Based on your resource availability, choose one:

### Option A: Minimal Deployment (Limited Resources)
```bash
oc apply -f deployment/openshift/production/minimal-resource-deployment.yaml
```
- Uses only 192Mi memory, 150m CPU
- Single replica
- Disables AI features

### Option B: Full Production Deployment (Recommended)
```bash
oc apply -f deployment/openshift/production/nanopore-production.yaml
```
- Uses 1Gi memory, 500m CPU
- 2-5 replicas with auto-scaling
- Full features enabled

## Step 4: Verify Deployment
```bash
# Check deployment status
oc rollout status deployment/nanopore-app -n dept-barc

# Check pods
oc get pods -l app=nanopore-tracking

# Check logs
oc logs -l app=nanopore-tracking --tail=50

# Get the route URL
oc get route nanopore-app -o jsonpath='{.spec.host}'
```

## Step 5: Test the Application
```bash
# Get the application URL
APP_URL=$(oc get route nanopore-app -o jsonpath='https://{.spec.host}')

# Test health endpoint
curl $APP_URL/health

# Open in browser
echo "Application URL: $APP_URL"
```

## 🆘 Troubleshooting

### If deployment fails:
```bash
# Check events
oc get events --sort-by='.lastTimestamp' | head -20

# Check pod details
oc describe pod -l app=nanopore-tracking

# Check logs
oc logs -l app=nanopore-tracking --previous
```

### If you need to rollback:
```bash
# Quick rollback
oc rollout undo deployment/nanopore-app

# Or delete and redeploy
oc delete -f deployment/openshift/production/nanopore-production.yaml
```

## 📋 Quick Commands Reference

```bash
# Check everything
./scripts/pre-deployment-check.sh

# Generate secrets
./scripts/generate-secrets.sh

# Deploy (choose based on resources)
oc apply -f deployment/openshift/production/minimal-resource-deployment.yaml
# OR
oc apply -f deployment/openshift/production/nanopore-production.yaml

# Monitor deployment
oc get pods -w -l app=nanopore-tracking
```

## ✅ Success Criteria

Your deployment is successful when:
1. All pods are in `Running` state
2. Health check returns 200 OK
3. Route is accessible via HTTPS
4. No error logs in pod output

---

**Need help?** Check the [documentation](https://nanopore-tracking-app.readthedocs.io/) or review `PRODUCTION_CHECKLIST.md` 
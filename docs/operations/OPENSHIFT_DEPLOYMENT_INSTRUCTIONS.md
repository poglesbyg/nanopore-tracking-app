# OpenShift Deployment Instructions - Nanopore Tracking App

## 🚨 Current Environment Status

Your OpenShift environment (`dept-barc` project) has **severe resource constraints**:
- **Available Pods**: 6/20 (14 used)
- **Available Services**: 7/20 (13 used)  
- **Available Memory**: ~256Mi/4Gi
- **Available CPU**: 200m/4000m

## 📋 Pre-Deployment Checklist

✅ OpenShift CLI installed (`oc`)  
✅ Logged in to cluster: `https://api.cloudapps.unc.edu:6443`  
✅ Access to project: `dept-barc`  
✅ Existing images available: `nanopore-tracking-app:latest`

## 🚀 Deployment Options

### Option 1: Minimal Deployment (Recommended)
**Best for your current constraints**

#### Step 1: Deploy the Application
```bash
# Deploy using the minimal resource configuration
oc apply -f deployment/openshift/minimal-resource-deployment.yaml
```

#### Step 2: Verify Deployment
```bash
# Check pod status
oc get pods -l app=nanopore-app-minimal

# Check logs if needed
oc logs -l app=nanopore-app-minimal

# Get the route URL
oc get route nanopore-app-minimal
```

#### Step 3: Access the Application
The application will be available at:
```
https://nanopore-minimal-dept-barc.apps.cloudapps.unc.edu
```

### Option 2: Use Deployment Script
```bash
# Run the automated deployment script
./deployment/scripts/deploy-minimal-resources.sh

# Check status
./deployment/scripts/deploy-minimal-resources.sh status

# View logs
./deployment/scripts/deploy-minimal-resources.sh logs
```

## 🔧 Configuration Details

### Resource Allocation
- **Memory**: 192Mi limit (128Mi request)
- **CPU**: 150m limit (100m request)
- **Replicas**: 1 (no autoscaling)

### Disabled Features (due to constraints)
- ❌ AI Processing
- ❌ MCP Servers
- ❌ Memory Monitoring
- ❌ Multiple replicas

### Database Connection
The deployment uses the existing PostgreSQL instance:
```yaml
DATABASE_URL: "postgresql://postgres:postgres@postgresql:5432/nanopore_db"
```

## 🛠️ Troubleshooting

### If deployment fails due to resources:
```bash
# Check current resource usage
oc describe quota

# Scale down other deployments if needed
oc scale deployment nanopore-frontend --replicas=0
oc scale deployment nanopore-frontend-final --replicas=0
```

### If pod crashes due to memory:
1. Check logs: `oc logs -l app=nanopore-app-minimal`
2. Further reduce memory in ConfigMap:
   ```yaml
   NODE_OPTIONS: "--max-old-space-size=96"
   ```

### If route doesn't work:
```bash
# Check route status
oc describe route nanopore-app-minimal

# Test from within cluster
oc exec -it <pod-name> -- curl http://localhost:3001/health
```

## 📊 Monitoring

### Resource Usage
```bash
# Monitor pod resources
oc top pod -l app=nanopore-app-minimal

# Watch pod status
oc get pods -l app=nanopore-app-minimal -w
```

### Application Health
```bash
# Check health endpoint
curl https://nanopore-minimal-dept-barc.apps.cloudapps.unc.edu/health
```

## 🧹 Cleanup

To remove the deployment:
```bash
# Using kubectl
oc delete -f deployment/openshift/minimal-resource-deployment.yaml

# Or using script
./deployment/scripts/deploy-minimal-resources.sh delete
```

## 🚦 Next Steps

1. **Monitor the deployment** closely for the first 24 hours
2. **Consider requesting quota increase** for production use
3. **Enable features gradually** as resources become available
4. **Set up alerts** for resource usage

## ⚠️ Important Notes

1. This is a **minimal deployment** suitable for testing/development
2. **Performance will be limited** due to resource constraints
3. **No redundancy** - single pod failure means downtime
4. Consider **cleaning up unused deployments** to free resources
5. For production, request at least 4Gi memory and 2 CPU cores

## 📞 Support

If you encounter issues:
1. Check pod logs: `oc logs -l app=nanopore-app-minimal`
2. Review events: `oc get events --sort-by='.lastTimestamp'`
3. Check quotas: `oc describe quota`
4. Contact platform team for quota increases 
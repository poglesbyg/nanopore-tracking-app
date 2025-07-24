# MCP-Enhanced Nanopore Tracking Application - OpenShift Deployment Guide

This guide provides comprehensive instructions for deploying the MCP-enhanced nanopore tracking application to OpenShift.

## 🏗️ Architecture Overview

The deployment consists of the following components:

### Core Application Stack
- **Main Application**: React/Astro frontend with tRPC backend
- **PostgreSQL Database**: Primary data storage
- **MCP Sample Management Server**: Workflow optimization tools
- **MCP Nanopore Domain Server**: Domain expertise and protocol recommendations
- **Ollama Service**: Optional AI processing (for enhanced features)

### Infrastructure Components
- **Namespace**: `nanopore-mcp`
- **Persistent Storage**: Database and file uploads
- **Network Policies**: Security isolation
- **Horizontal Pod Autoscaling**: Automatic scaling based on load
- **Monitoring**: Prometheus integration
- **Routes**: External access with TLS termination

## 📋 Prerequisites

### 1. OpenShift Access
- OpenShift CLI (`oc`) installed and configured
- Access to an OpenShift cluster with sufficient resources
- Cluster admin privileges or appropriate project permissions

### 2. Resource Requirements

#### Minimum Resources
- **CPU**: 4 cores total
- **Memory**: 8GB total
- **Storage**: 50GB persistent storage

#### Recommended Resources
- **CPU**: 8 cores total
- **Memory**: 16GB total
- **Storage**: 100GB persistent storage

### 3. Cluster Requirements
- OpenShift 4.10+ or compatible Kubernetes cluster
- Persistent Volume support (ReadWriteOnce and ReadWriteMany)
- LoadBalancer or Route support for external access
- Optional: Prometheus Operator for monitoring

## 🚀 Quick Deployment

### Automated Deployment (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd nanopore-tracking-app

# Login to OpenShift
oc login <your-openshift-cluster>

# Deploy the application
./deployment/scripts/deploy-mcp-enhanced.sh
```

### Manual Deployment

```bash
# Apply ConfigMaps first
oc apply -f deployment/openshift/mcp-configmaps.yaml

# Apply main deployment
oc apply -f deployment/openshift/mcp-enhanced-deployment.yaml

# Wait for deployment to complete
oc rollout status deployment/nanopore-app -n nanopore-mcp
```

## 📁 Deployment Files Structure

```
deployment/
├── openshift/
│   ├── mcp-enhanced-deployment.yaml    # Main deployment configuration
│   ├── mcp-configmaps.yaml            # Application code and configuration
│   └── ...                            # Additional configurations
└── scripts/
    └── deploy-mcp-enhanced.sh          # Automated deployment script
```

## 🔧 Configuration

### Environment Variables

The application supports the following key environment variables:

#### MCP Configuration
```yaml
MCP_ENABLED: "true"
MCP_SAMPLE_MANAGEMENT_URL: "http://mcp-sample-management:3010"
MCP_NANOPORE_DOMAIN_URL: "http://mcp-nanopore-domain:3011"
MCP_TIMEOUT: "30000"
MCP_RETRY_ATTEMPTS: "3"
```

#### Database Configuration
```yaml
DATABASE_URL: "postgresql://nanopore_user:nanopore_pass@postgresql:5432/nanopore_db"
```

#### AI Processing Configuration
```yaml
AI_PROCESSING_ENABLED: "true"
OLLAMA_BASE_URL: "http://ollama-service:11434"
PDF_PROCESSING_ENABLED: "true"
```

#### Memory Management
```yaml
MEMORY_MONITORING_ENABLED: "true"
MEMORY_THRESHOLD_MB: "200"
HEAP_MONITORING_ENABLED: "true"
```

### Customizing the Deployment

#### 1. Resource Limits
Edit resource requests and limits in `mcp-enhanced-deployment.yaml`:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "500m"
```

#### 2. Scaling Configuration
Modify HPA settings for automatic scaling:

```yaml
minReplicas: 3
maxReplicas: 10
metrics:
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 70
```

#### 3. Storage Configuration
Adjust persistent volume claims:

```yaml
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

## 🔍 Verification and Monitoring

### Check Deployment Status

```bash
# Check all pods
oc get pods -n nanopore-mcp

# Check services
oc get services -n nanopore-mcp

# Check routes
oc get routes -n nanopore-mcp

# Check deployment status
./deployment/scripts/deploy-mcp-enhanced.sh status
```

### View Logs

```bash
# View all logs
./deployment/scripts/deploy-mcp-enhanced.sh logs all

# View specific component logs
./deployment/scripts/deploy-mcp-enhanced.sh logs app
./deployment/scripts/deploy-mcp-enhanced.sh logs mcp-sample
./deployment/scripts/deploy-mcp-enhanced.sh logs mcp-domain
./deployment/scripts/deploy-mcp-enhanced.sh logs db
```

### Health Checks

Each component includes health check endpoints:

- **Main Application**: `GET /health`
- **MCP Servers**: `GET /health`
- **PostgreSQL**: Built-in readiness/liveness probes

### Performance Monitoring

The deployment includes Prometheus integration:

```bash
# Check ServiceMonitor
oc get servicemonitor -n nanopore-mcp

# View metrics endpoints
curl http://<pod-ip>:3001/metrics
curl http://<mcp-pod-ip>:3010/metrics
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Pod Startup Issues

```bash
# Check pod events
oc describe pod <pod-name> -n nanopore-mcp

# Check pod logs
oc logs <pod-name> -n nanopore-mcp
```

#### 2. Database Connection Issues

```bash
# Check PostgreSQL pod
oc logs deployment/postgresql -n nanopore-mcp

# Test database connectivity
oc exec -it deployment/postgresql -n nanopore-mcp -- psql -U nanopore_user -d nanopore_db -c "SELECT 1;"
```

#### 3. MCP Server Communication Issues

```bash
# Check MCP server logs
oc logs deployment/mcp-sample-management -n nanopore-mcp
oc logs deployment/mcp-nanopore-domain -n nanopore-mcp

# Test MCP server connectivity
oc exec -it deployment/nanopore-app -n nanopore-mcp -- curl http://mcp-sample-management:3010/health
```

#### 4. Memory Issues

The application includes memory monitoring. Check logs for memory warnings:

```bash
# Look for memory warnings in application logs
oc logs deployment/nanopore-app -n nanopore-mcp | grep -i memory
```

### Resource Constraints

If experiencing resource constraints:

1. **Scale down non-essential components**:
   ```bash
   oc scale deployment/ollama-service --replicas=0 -n nanopore-mcp
   ```

2. **Adjust resource limits**:
   Edit deployment YAML and reduce resource requests

3. **Use node selectors** for better resource allocation:
   ```yaml
   nodeSelector:
     node-type: compute-optimized
   ```

## 🔒 Security Considerations

### Network Policies

The deployment includes network policies that:
- Isolate the namespace from other applications
- Allow only necessary inter-pod communication
- Permit external access only to the main application

### Secrets Management

Sensitive data is stored in Kubernetes secrets:
- Database credentials
- JWT secrets
- Admin passwords

### Pod Security

Pods run with:
- Non-root user contexts where possible
- Read-only root filesystems
- Security context constraints

## 📈 Scaling and Performance

### Horizontal Scaling

The deployment supports automatic scaling:

```yaml
# Application scaling
minReplicas: 3
maxReplicas: 10

# MCP server scaling
minReplicas: 2
maxReplicas: 6
```

### Vertical Scaling

Adjust resource limits based on usage patterns:

```bash
# Monitor resource usage
oc top pods -n nanopore-mcp
oc top nodes
```

### Performance Tuning

1. **Database optimization**:
   - Tune PostgreSQL configuration
   - Add database connection pooling
   - Optimize queries

2. **Application optimization**:
   - Enable caching
   - Optimize bundle sizes
   - Use CDN for static assets

3. **MCP server optimization**:
   - Implement response caching
   - Optimize AI model inference
   - Use connection pooling

## 🔄 Updates and Maintenance

### Rolling Updates

The deployment supports zero-downtime updates:

```bash
# Update application image
oc set image deployment/nanopore-app nanopore-app=new-image:tag -n nanopore-mcp

# Check rollout status
oc rollout status deployment/nanopore-app -n nanopore-mcp
```

### Database Migrations

Handle database schema changes:

```bash
# Run migration job
oc create job db-migration --from=cronjob/migration-job -n nanopore-mcp
```

### Backup and Recovery

Regular backup procedures:

1. **Database backups**:
   ```bash
   oc exec deployment/postgresql -n nanopore-mcp -- pg_dump -U nanopore_user nanopore_db > backup.sql
   ```

2. **Persistent volume snapshots**:
   Use your cluster's volume snapshot capabilities

3. **Configuration backups**:
   ```bash
   oc get all,configmap,secret,pvc -n nanopore-mcp -o yaml > backup-config.yaml
   ```

## 🧹 Cleanup

### Remove Deployment

```bash
# Using the deployment script
./deployment/scripts/deploy-mcp-enhanced.sh cleanup

# Manual cleanup
oc delete namespace nanopore-mcp
```

## 📞 Support and Troubleshooting

### Getting Help

1. **Check logs** first using the deployment script
2. **Review resource usage** with `oc top`
3. **Examine events** with `oc get events`
4. **Test connectivity** between components

### Performance Monitoring

Monitor key metrics:
- Response times
- Memory usage
- CPU utilization
- Database connection counts
- MCP server request rates

### Common Solutions

| Issue | Solution |
|-------|----------|
| High memory usage | Check for memory leaks, adjust limits |
| Slow response times | Scale up replicas, optimize queries |
| Database connection errors | Check connection limits, restart pods |
| MCP server timeouts | Check network policies, increase timeouts |
| Storage issues | Check PVC status, expand volumes |

## 🎯 Next Steps

After successful deployment:

1. **Configure monitoring** and alerting
2. **Set up CI/CD pipelines** for automated deployments
3. **Implement backup strategies**
4. **Tune performance** based on usage patterns
5. **Set up log aggregation** for better observability

## 📚 Additional Resources

- [OpenShift Documentation](https://docs.openshift.com/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Nanopore Sequencing Protocols](https://nanoporetech.com/protocols)

---

**Note**: This deployment guide assumes a production-ready OpenShift cluster. For development environments, consider using lighter resource allocations and simplified configurations. 
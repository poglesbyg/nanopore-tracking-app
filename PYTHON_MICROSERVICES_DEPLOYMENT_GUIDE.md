# Python Microservices Deployment Guide

## 🎯 Overview

This guide covers the complete deployment of the Nanopore Tracking Application's Python microservices architecture. The migration from monolithic to microservices provides improved scalability, maintainability, and performance.

## 📋 Prerequisites

### Required Tools
- **OpenShift CLI (oc)** - Version 4.10+
- **Docker** - For building images
- **Git** - For source code management
- **curl** - For health checks

### Required Access
- OpenShift cluster with admin permissions
- Docker registry access (optional for custom images)
- Sufficient cluster resources (see Resource Requirements)

## 🏗️ Architecture Overview

### Services Deployed
1. **Python API Gateway** (Port 8000) - Central routing and authentication
2. **Sample Management Service** (Port 8001) - Sample CRUD operations
3. **AI Processing Service** (Port 8002) - PDF/LLM processing
4. **Authentication Service** (Port 8003) - User management and JWT
5. **File Storage Service** (Port 8004) - File upload/download
6. **Audit Service** (Port 8005) - Activity logging
7. **Submission Service** (Port 8006) - CSV/PDF processing

### Supporting Services
- **PostgreSQL Databases** (5 separate databases)
- **Ollama** - Local LLM processing
- **Redis** - Caching and session storage

## 🚀 Quick Start Deployment

### 1. Automatic Production Deployment

```bash
# Navigate to project directory
cd nanopore-tracking-app

# Run the production deployment script
./deployment/scripts/deploy-python-production.sh
```

This script will:
- ✅ Validate prerequisites
- ✅ Create production namespace
- ✅ Generate secure secrets
- ✅ Deploy all databases
- ✅ Deploy all microservices
- ✅ Deploy supporting services
- ✅ Run health checks

### 2. Manual Step-by-Step Deployment

If you prefer manual control or need to customize the deployment:

#### Step 1: Create Namespace
```bash
oc create namespace nanopore-prod
oc project nanopore-prod
```

#### Step 2: Create Secrets
```bash
# Generate secure passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)

# Create secrets
oc create secret generic postgres-secret --from-literal=password="$POSTGRES_PASSWORD"
oc create secret generic jwt-secret --from-literal=secret="$JWT_SECRET"
```

#### Step 3: Deploy Databases
```bash
# Apply database configurations
oc apply -f deployment/openshift/databases/
```

#### Step 4: Deploy Services
```bash
# Apply service configurations
oc apply -f deployment/openshift/services/
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NAMESPACE` | OpenShift namespace | `nanopore-prod` |
| `DOCKER_REGISTRY` | Docker registry URL | `docker.io` |
| `IMAGE_TAG` | Image tag to deploy | `latest` |
| `POSTGRES_PASSWORD` | Database password | Auto-generated |
| `JWT_SECRET` | JWT signing secret | Auto-generated |
| `OPENAI_API_KEY` | OpenAI API key (optional) | None |

### Resource Requirements

#### Minimum Requirements
- **CPU**: 4 cores
- **Memory**: 8GB RAM
- **Storage**: 50GB persistent storage

#### Recommended for Production
- **CPU**: 8 cores
- **Memory**: 16GB RAM
- **Storage**: 100GB persistent storage

### Service Resource Allocation

| Service | CPU Request | Memory Request | CPU Limit | Memory Limit |
|---------|-------------|----------------|-----------|--------------|
| Python Gateway | 100m | 128Mi | 200m | 256Mi |
| Sample Service | 100m | 128Mi | 200m | 256Mi |
| AI Service | 100m | 128Mi | 200m | 256Mi |
| Auth Service | 100m | 128Mi | 200m | 256Mi |
| File Service | 100m | 128Mi | 200m | 256Mi |
| Audit Service | 100m | 128Mi | 200m | 256Mi |
| Submission Service | 100m | 128Mi | 200m | 256Mi |
| PostgreSQL (each) | 250m | 256Mi | 500m | 512Mi |
| Ollama | 500m | 1Gi | 1000m | 2Gi |
| Redis | 50m | 64Mi | 100m | 128Mi |

## 🔍 Monitoring and Health Checks

### Health Endpoints

Each service provides a health endpoint:
- **Gateway**: `https://{gateway-url}/health`
- **Individual Services**: `http://{service}:{port}/health`

### Monitoring Commands

```bash
# Check all pods
oc get pods -n nanopore-prod

# Check services
oc get services -n nanopore-prod

# Check routes
oc get routes -n nanopore-prod

# View logs
oc logs -f deployment/python-gateway -n nanopore-prod

# Check resource usage
oc top pods -n nanopore-prod
```

### Health Check Script

```bash
# Test all service health endpoints
./scripts/test-services-health.sh nanopore-prod
```

## 🔐 Security Configuration

### Authentication
- **Default Admin User**: `admin@nanopore.local`
- **Default Password**: `admin123`
- **JWT Token Expiry**: 24 hours
- **Refresh Token Expiry**: 7 days

### Database Security
- Passwords are auto-generated and stored in OpenShift secrets
- Database access is restricted to service networks
- SSL/TLS encryption for all connections

### Network Security
- Services communicate over internal cluster network
- External access only through the API Gateway
- TLS termination at the route level

## 📊 Performance Optimization

### Database Optimization
- Separate databases for each service
- Proper indexing for query performance
- Connection pooling enabled
- Prepared statements for security

### Caching Strategy
- Redis for session storage
- API response caching
- Database query result caching

### Scaling Configuration
- Horizontal Pod Autoscaler (HPA) ready
- Vertical Pod Autoscaler (VPA) compatible
- Load balancing across multiple replicas

## 🔄 Migration from Monolithic

### Frontend Configuration

To switch the frontend to use the Python microservices:

```typescript
// Set environment variable
USE_PYTHON_API=true
PYTHON_API_URL=https://your-gateway-url

// Or programmatically
import { setUsePythonApi } from './lib/api-config'
setUsePythonApi(true)
```

### Gradual Migration Strategy

1. **Phase 1**: Deploy Python services alongside monolithic app
2. **Phase 2**: Switch specific features to use Python services
3. **Phase 3**: Migrate all functionality to Python services
4. **Phase 4**: Decommission monolithic app

## 🚨 Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check pod logs
oc logs -f deployment/{service-name} -n nanopore-prod

# Check events
oc get events -n nanopore-prod --sort-by='.lastTimestamp'
```

#### Database Connection Issues
```bash
# Test database connectivity
oc exec -it deployment/sample-service -n nanopore-prod -- python -c "
import asyncpg
import asyncio
async def test():
    conn = await asyncpg.connect('postgresql://postgres:password@sample-db:5432/sample_db')
    print(await conn.fetchval('SELECT 1'))
asyncio.run(test())
"
```

#### Performance Issues
```bash
# Check resource usage
oc top pods -n nanopore-prod

# Check service metrics
curl -s https://gateway-url/metrics
```

### Recovery Procedures

#### Database Recovery
```bash
# Restore from backup
oc apply -f deployment/openshift/backups/restore-job.yaml
```

#### Service Recovery
```bash
# Restart specific service
oc rollout restart deployment/{service-name} -n nanopore-prod

# Scale service
oc scale deployment/{service-name} --replicas=2 -n nanopore-prod
```

## 📈 Scaling Guidelines

### Horizontal Scaling
```bash
# Scale API Gateway for high traffic
oc scale deployment/python-gateway --replicas=3 -n nanopore-prod

# Scale compute-intensive services
oc scale deployment/ai-service --replicas=2 -n nanopore-prod
```

### Vertical Scaling
```bash
# Increase resource limits
oc patch deployment/python-gateway -n nanopore-prod -p '
{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "gateway",
          "resources": {
            "limits": {"memory": "512Mi", "cpu": "500m"}
          }
        }]
      }
    }
  }
}'
```

## 🔧 Maintenance

### Regular Maintenance Tasks

#### Weekly
- Check service logs for errors
- Monitor resource usage
- Review security alerts

#### Monthly
- Update container images
- Review and rotate secrets
- Performance optimization review

#### Quarterly
- Backup verification
- Disaster recovery testing
- Security audit

### Backup Strategy
```bash
# Database backups
oc create job backup-databases --from=cronjob/database-backup -n nanopore-prod

# Configuration backups
oc get all -n nanopore-prod -o yaml > nanopore-prod-backup.yaml
```

## 📞 Support

### Log Collection
```bash
# Collect all logs
mkdir -p logs
for service in python-gateway sample-service ai-service auth-service file-service audit-service submission-service; do
    oc logs deployment/$service -n nanopore-prod > logs/$service.log
done
```

### Debug Information
```bash
# Generate debug report
./scripts/generate-debug-report.sh nanopore-prod
```

## 🎉 Success Metrics

### Performance Benchmarks
- **API Response Time**: < 200ms (95th percentile)
- **Database Query Time**: < 50ms (average)
- **File Upload Speed**: > 10MB/s
- **Concurrent Users**: 100+ simultaneous users

### Reliability Metrics
- **Service Uptime**: 99.9%
- **Data Consistency**: 100%
- **Error Rate**: < 0.1%
- **Recovery Time**: < 5 minutes

## 📚 Additional Resources

- [OpenShift Documentation](https://docs.openshift.com/)
- [Python Microservices Best Practices](https://microservices.io/patterns/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Maintainer**: Nanopore Tracking Team 
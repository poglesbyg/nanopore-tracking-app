# MCP-Enhanced Nanopore Tracking Application - Deployment

This directory contains all deployment configurations and scripts for the MCP-enhanced nanopore tracking application.

## 🚀 Quick Start

### Prerequisites
- OpenShift CLI (`oc`) installed and configured
- Access to an OpenShift cluster
- Minimum resources: 4 CPU cores, 8GB RAM, 50GB storage

### Deploy to OpenShift

```bash
# 1. Login to your OpenShift cluster
oc login <your-cluster-url>

# 2. Validate deployment configuration (optional but recommended)
./deployment/scripts/validate-deployment.sh

# 3. Deploy the application
./deployment/scripts/deploy-mcp-enhanced.sh

# 4. Check deployment status
./deployment/scripts/deploy-mcp-enhanced.sh status

# 5. View application logs
./deployment/scripts/deploy-mcp-enhanced.sh logs all
```

### Access the Application

After successful deployment, the application will be available at:
- **External Route**: `https://nanopore-mcp.apps.your-cluster.com`
- **Port Forward**: `oc port-forward service/nanopore-app 3001:3001 -n nanopore-mcp`

## 📁 Directory Structure

```
deployment/
├── openshift/                          # OpenShift deployment configurations
│   ├── mcp-enhanced-deployment.yaml    # Main deployment with all services
│   ├── mcp-configmaps.yaml            # MCP server code and configurations
│   └── ...                            # Legacy deployment files
├── scripts/                           # Deployment automation scripts
│   ├── deploy-mcp-enhanced.sh         # Main deployment script
│   ├── validate-deployment.sh         # Pre-deployment validation
│   └── ...                           # Additional utility scripts
├── OPENSHIFT_DEPLOYMENT_GUIDE.md     # Comprehensive deployment guide
└── README.md                         # This file
```

## 🏗️ Architecture

The deployment includes:

### Core Services
- **Main Application** (3 replicas): React/Astro frontend with tRPC backend
- **PostgreSQL Database** (1 replica): Primary data storage
- **MCP Sample Management Server** (2 replicas): Workflow optimization
- **MCP Nanopore Domain Server** (2 replicas): Domain expertise
- **Ollama Service** (1 replica, optional): AI processing

### Infrastructure
- **Namespace**: `nanopore-mcp`
- **Persistent Storage**: Database, uploads, AI models
- **Auto-scaling**: HPA for application and MCP servers
- **Monitoring**: Prometheus integration
- **Security**: Network policies, secrets, RBAC

## 🔧 Configuration

### Key Environment Variables
```yaml
# MCP Configuration
MCP_ENABLED: "true"
MCP_SAMPLE_MANAGEMENT_URL: "http://mcp-sample-management:3010"
MCP_NANOPORE_DOMAIN_URL: "http://mcp-nanopore-domain:3011"

# Database
DATABASE_URL: "postgresql://nanopore_user:nanopore_pass@postgresql:5432/nanopore_db"

# AI Processing
AI_PROCESSING_ENABLED: "true"
OLLAMA_BASE_URL: "http://ollama-service:11434"
```

### Resource Requirements
| Component | CPU Request | Memory Request | Storage |
|-----------|-------------|----------------|---------|
| Main App | 250m × 3 | 512Mi × 3 | - |
| PostgreSQL | 250m | 256Mi | 10Gi |
| MCP Servers | 100m × 4 | 128Mi × 4 | - |
| Ollama | 1000m | 2Gi | 20Gi |
| **Total** | **2.15 cores** | **4.3GB** | **30Gi** |

## 🛠️ Management Commands

### Deployment Management
```bash
# Deploy application
./deployment/scripts/deploy-mcp-enhanced.sh deploy

# Check status
./deployment/scripts/deploy-mcp-enhanced.sh status

# View logs
./deployment/scripts/deploy-mcp-enhanced.sh logs [component]

# Clean up
./deployment/scripts/deploy-mcp-enhanced.sh cleanup
```

### Validation
```bash
# Validate configuration before deployment
./deployment/scripts/validate-deployment.sh

# Check specific aspects
./deployment/scripts/validate-deployment.sh help
```

### Manual Operations
```bash
# Scale application
oc scale deployment/nanopore-app --replicas=5 -n nanopore-mcp

# Update image
oc set image deployment/nanopore-app nanopore-app=new-image:tag -n nanopore-mcp

# Check resource usage
oc top pods -n nanopore-mcp
```

## 🔍 Monitoring and Troubleshooting

### Health Checks
- **Application**: `GET /health`
- **MCP Servers**: `GET /health`
- **Database**: Built-in PostgreSQL probes

### Common Issues
| Issue | Solution |
|-------|----------|
| Pods not starting | Check resource limits and node capacity |
| Database connection errors | Verify PostgreSQL pod status |
| MCP server timeouts | Check network policies and service connectivity |
| High memory usage | Monitor memory leak warnings in logs |

### Debugging Commands
```bash
# Check pod events
oc describe pod <pod-name> -n nanopore-mcp

# View detailed logs
oc logs -f deployment/<deployment-name> -n nanopore-mcp

# Test connectivity
oc exec -it deployment/nanopore-app -n nanopore-mcp -- curl http://mcp-sample-management:3010/health

# Check resource usage
oc top pods -n nanopore-mcp
oc top nodes
```

## 🔒 Security

### Network Security
- Namespace isolation with NetworkPolicies
- Internal-only communication between services
- TLS termination at route level

### Data Security
- Secrets for sensitive configuration
- Database credentials encrypted
- Non-root container execution where possible

### Access Control
- RBAC for service accounts
- Pod security standards compliance
- Resource quotas and limits

## 📈 Scaling

### Automatic Scaling
- **Application**: 3-10 replicas based on CPU/memory
- **MCP Servers**: 2-6 replicas based on CPU usage
- **Database**: Manual scaling only

### Performance Tuning
```bash
# Adjust HPA settings
oc edit hpa nanopore-app-hpa -n nanopore-mcp

# Update resource limits
oc edit deployment nanopore-app -n nanopore-mcp
```

## 🧹 Cleanup

### Remove Deployment
```bash
# Complete cleanup
./deployment/scripts/deploy-mcp-enhanced.sh cleanup

# Manual cleanup
oc delete namespace nanopore-mcp
```

### Backup Before Cleanup
```bash
# Backup database
oc exec deployment/postgresql -n nanopore-mcp -- pg_dump -U nanopore_user nanopore_db > backup.sql

# Backup configuration
oc get all,configmap,secret,pvc -n nanopore-mcp -o yaml > backup-config.yaml
```

## 📚 Documentation

- **[Complete Deployment Guide](OPENSHIFT_DEPLOYMENT_GUIDE.md)**: Comprehensive deployment documentation
- **[MCP Integration Guide](../docs/MCP_INTEGRATION.md)**: MCP server integration details
- **[Troubleshooting Guide](../docs/TROUBLESHOOTING.md)**: Common issues and solutions

## 🆘 Support

For deployment issues:

1. **Validate configuration**: `./deployment/scripts/validate-deployment.sh`
2. **Check logs**: `./deployment/scripts/deploy-mcp-enhanced.sh logs all`
3. **Review resource usage**: `oc top pods -n nanopore-mcp`
4. **Check events**: `oc get events -n nanopore-mcp --sort-by='.lastTimestamp'`

## 🎯 Next Steps

After successful deployment:

1. **Configure monitoring and alerting**
2. **Set up CI/CD pipelines**
3. **Implement backup strategies**
4. **Tune performance based on usage**
5. **Configure log aggregation**

---

**Note**: This deployment is designed for production use. For development environments, consider using the simplified configurations in the `development/` directory. 
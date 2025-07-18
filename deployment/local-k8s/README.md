# Local Kubernetes Development Setup

This directory contains Kubernetes manifests and scripts for running the nanopore tracking application locally using OrbStack.

## Prerequisites

- [OrbStack](https://orbstack.dev/) installed and running
- Docker available through OrbStack
- kubectl configured to use the `orbstack` context

## Quick Start

1. **Switch to OrbStack context:**
   ```bash
   kubectl config use-context orbstack
   ```

2. **Deploy the application:**
   ```bash
   ./scripts/local-k8s-deploy.sh deploy
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000/nanopore
   - Submission Service API: http://localhost:8000/api/v1/health
   - Sample Management API: http://localhost:3002/api/v1/samples

## Available Commands

The `scripts/local-k8s-deploy.sh` script provides several commands:

- `build` - Build Docker images only
- `deploy` - Build images and deploy to Kubernetes (default)
- `status` - Show deployment status
- `test` - Test service endpoints
- `port-forward` - Setup port forwarding only
- `cleanup` - Remove all resources

## Architecture

The local deployment includes:

### Services
- **PostgreSQL Database** - Persistent storage for application data
- **Frontend** - Astro-based React application
- **Submission Service** - Python FastAPI service for PDF processing
- **Sample Management** - Mock service providing sample data API

### Networking
- All services run in the `nanopore-local` namespace
- Port forwarding provides local access:
  - Frontend: 3000 → 3000
  - Submission Service: 8000 → 8000
  - Sample Management: 3002 → 3002

## Development Workflow

1. **Make changes to your code**
2. **Rebuild and redeploy:**
   ```bash
   ./scripts/local-k8s-deploy.sh deploy
   ```
3. **Test your changes:**
   ```bash
   ./scripts/local-k8s-deploy.sh test
   ```

## Troubleshooting

### Check pod status
```bash
kubectl get pods -n nanopore-local
```

### View logs
```bash
kubectl logs -n nanopore-local deployment/nanopore-frontend
kubectl logs -n nanopore-local deployment/submission-service
kubectl logs -n nanopore-local deployment/sample-management
```

### Port forwarding issues
If port forwarding stops working, restart it:
```bash
./scripts/local-k8s-deploy.sh port-forward
```

### Clean slate
To start fresh:
```bash
./scripts/local-k8s-deploy.sh cleanup
./scripts/local-k8s-deploy.sh deploy
```

## Configuration

### Environment Variables
Services are configured through environment variables in their respective YAML files:

- `frontend.yaml` - Frontend service configuration
- `submission-service.yaml` - Submission service configuration
- `sample-management.yaml` - Sample management service configuration
- `postgresql.yaml` - Database configuration

### Service URLs
Services communicate using Kubernetes DNS:
- Database: `postgres:5432`
- Sample Management: `sample-management:3002`
- Submission Service: `submission-service:8000`

## Files

- `postgresql.yaml` - PostgreSQL database deployment
- `frontend.yaml` - Frontend service deployment
- `submission-service.yaml` - Submission service deployment
- `sample-management.yaml` - Mock sample management service
- `ingress.yaml` - Ingress configuration (optional)

## Notes

- The sample management service is a lightweight mock service that provides sample data for development
- The submission service includes PDF processing capabilities
- All services include health checks and proper resource limits
- The deployment uses `imagePullPolicy: Never` to use locally built images 
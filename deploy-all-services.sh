#!/bin/bash

# Full Microservices Deployment Script for Nanopore Tracking Application
# Deploys all services to OpenShift

set -e

# Configuration
NAMESPACE="dept-barc"
REGISTRY_URL="default-route-openshift-image-registry.apps.cloudapps.unc.edu"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if oc is installed
    if ! command -v oc &> /dev/null; then
        error "OpenShift CLI (oc) not found. Please install it first."
        exit 1
    fi
    
    # Check if logged in to OpenShift
    if ! oc whoami &> /dev/null; then
        error "Not logged in to OpenShift. Please run 'oc login' first."
        exit 1
    fi
    
    # Check if docker is available
    if ! command -v docker &> /dev/null; then
        error "Docker not found. Please install Docker first."
        exit 1
    fi
    
    # Switch to correct namespace
    oc project "$NAMESPACE" || {
        error "Cannot switch to namespace $NAMESPACE"
        exit 1
    }
    
    success "Prerequisites validated"
}

# Login to OpenShift registry
login_to_registry() {
    log "Logging in to OpenShift registry..."
    
    # Get token
    TOKEN=$(oc whoami -t)
    
    # Login to registry
    echo "$TOKEN" | docker login -u "$(oc whoami)" --password-stdin "$REGISTRY_URL" || {
        warn "Could not login to registry. Trying alternative method..."
        # Try with podman if available
        if command -v podman &> /dev/null; then
            echo "$TOKEN" | podman login -u "$(oc whoami)" --password-stdin "$REGISTRY_URL"
        else
            error "Failed to login to registry"
            exit 1
        fi
    }
    
    success "Logged in to registry"
}

# Deploy frontend service
deploy_frontend() {
    log "Deploying frontend service..."
    
    # Build the image
    log "Building frontend image..."
    docker build -t nanopore-frontend:latest . || {
        error "Failed to build frontend image"
        return 1
    }
    
    # Tag for OpenShift
    docker tag nanopore-frontend:latest "$REGISTRY_URL/$NAMESPACE/nanopore-frontend:latest"
    
    # Push to registry
    log "Pushing frontend image..."
    docker push "$REGISTRY_URL/$NAMESPACE/nanopore-frontend:latest" || {
        error "Failed to push frontend image"
        return 1
    }
    
    # Update deployment
    oc set image deployment/nanopore-app-minimal nanopore-app-minimal="$REGISTRY_URL/$NAMESPACE/nanopore-frontend:latest" -n "$NAMESPACE" || {
        warn "Could not update existing deployment, creating new one..."
        # Create new deployment if needed
        oc apply -f deployment/openshift/production/frontend-deployment.yaml
    }
    
    success "Frontend deployed"
}

# Deploy Python microservices
deploy_python_service() {
    local service_name=$1
    local service_dir=$2
    local port=${3:-8000}
    
    log "Deploying $service_name..."
    
    if [ ! -d "$service_dir" ]; then
        warn "$service_dir not found, skipping $service_name"
        return 0
    fi
    
    # Build the image
    log "Building $service_name image..."
    cd "$service_dir"
    
    if [ -f "Dockerfile" ]; then
        docker build -t "$service_name:latest" . || {
            error "Failed to build $service_name image"
            cd - > /dev/null
            return 1
        }
    else
        warn "No Dockerfile found for $service_name, skipping..."
        cd - > /dev/null
        return 0
    fi
    
    # Tag for OpenShift
    docker tag "$service_name:latest" "$REGISTRY_URL/$NAMESPACE/$service_name:latest"
    
    # Push to registry
    log "Pushing $service_name image..."
    docker push "$REGISTRY_URL/$NAMESPACE/$service_name:latest" || {
        error "Failed to push $service_name image"
        cd - > /dev/null
        return 1
    }
    
    # Check if deployment exists
    if oc get deployment "$service_name" -n "$NAMESPACE" &> /dev/null; then
        # Update existing deployment
        oc set image deployment/"$service_name" "$service_name=$REGISTRY_URL/$NAMESPACE/$service_name:latest" -n "$NAMESPACE"
    else
        # Create new deployment
        cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $service_name
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: $service_name
  template:
    metadata:
      labels:
        app: $service_name
    spec:
      containers:
      - name: $service_name
        image: $REGISTRY_URL/$NAMESPACE/$service_name:latest
        ports:
        - containerPort: $port
        env:
        - name: PORT
          value: "$port"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: $service_name
  namespace: $NAMESPACE
spec:
  selector:
    app: $service_name
  ports:
  - port: $port
    targetPort: $port
EOF
    fi
    
    cd - > /dev/null
    success "$service_name deployed"
}

# Main deployment function
main() {
    log "Starting full deployment of Nanopore Tracking Application..."
    
    # Check prerequisites
    check_prerequisites
    
    # Login to registry
    login_to_registry
    
    # Deploy frontend
    deploy_frontend
    
    # Deploy Python microservices
    deploy_python_service "submission-service" "services/submission-service" 8000
    deploy_python_service "python-sample-management" "services/python-sample-management" 8001
    deploy_python_service "python-ai-processing" "services/python-ai-processing" 8002
    deploy_python_service "python-authentication" "services/python-authentication" 8003
    deploy_python_service "python-file-storage" "services/python-file-storage" 8004
    deploy_python_service "python-audit" "services/python-audit" 8005
    deploy_python_service "python-gateway" "services/python-gateway" 8000
    
    # Check deployment status
    log "Checking deployment status..."
    oc get deployments -n "$NAMESPACE"
    
    # Check pods
    log "Checking pod status..."
    oc get pods -n "$NAMESPACE" | grep -E "(Running|Pending|Error)"
    
    # Show routes
    log "Available routes:"
    oc get routes -n "$NAMESPACE" --no-headers | awk '{print "- " $2}'
    
    success "Full deployment completed!"
    
    # Show main URLs
    echo ""
    log "Main application URLs:"
    echo "🌐 Frontend: https://nanopore-minimal-dept-barc.apps.cloudapps.unc.edu"
    echo "🔌 API Gateway: https://nanopore-api-dept-barc.apps.cloudapps.unc.edu"
    echo "📄 Submission Service: https://submission-service-dept-barc.apps.cloudapps.unc.edu"
}

# Run main function
main 
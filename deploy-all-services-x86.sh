#!/bin/bash

# Full Microservices Deployment Script for x86_64 OpenShift
# Builds images for the correct platform architecture

set -e

# Configuration
NAMESPACE="dept-barc"
REGISTRY_URL="default-route-openshift-image-registry.apps.cloudapps.unc.edu"
PLATFORM="linux/amd64"  # Force x86_64 architecture

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

# Check if we're already logged in to registry
check_registry_login() {
    log "Checking registry login status..."
    if docker pull "$REGISTRY_URL/dept-barc/test:latest" &> /dev/null; then
        success "Already logged in to registry"
        return 0
    else
        return 1
    fi
}

# Login to OpenShift registry
login_to_registry() {
    if check_registry_login; then
        return 0
    fi
    
    log "Logging in to OpenShift registry..."
    TOKEN=$(oc whoami -t)
    echo "$TOKEN" | docker login -u "$(oc whoami)" --password-stdin "$REGISTRY_URL"
    success "Logged in to registry"
}

# Update frontend service
update_frontend() {
    log "Building and deploying frontend for x86_64..."
    
    # Build the image for x86_64
    log "Building frontend image for platform $PLATFORM..."
    docker build --platform="$PLATFORM" -t nanopore-frontend:latest . || {
        error "Failed to build frontend image"
        return 1
    }
    
    # Tag for OpenShift
    docker tag nanopore-frontend:latest "$REGISTRY_URL/$NAMESPACE/nanopore-frontend:latest"
    
    # Push to registry
    log "Pushing frontend image..."
    docker push "$REGISTRY_URL/$NAMESPACE/nanopore-frontend:latest"
    
    # Restart the deployment to pull new image
    oc rollout restart deployment/nanopore-frontend -n "$NAMESPACE"
    
    success "Frontend updated"
}

# Update Python microservices
update_python_service() {
    local service_name=$1
    local service_dir=$2
    
    log "Updating $service_name for x86_64..."
    
    if [ ! -d "$service_dir" ]; then
        warn "$service_dir not found, skipping $service_name"
        return 0
    fi
    
    # Build the image for x86_64
    cd "$service_dir"
    
    if [ -f "Dockerfile" ]; then
        docker build --platform="$PLATFORM" -t "$service_name:latest" . || {
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
    docker push "$REGISTRY_URL/$NAMESPACE/$service_name:latest"
    
    # Restart the deployment if it exists
    if oc get deployment "$service_name" -n "$NAMESPACE" &> /dev/null; then
        oc rollout restart deployment/"$service_name" -n "$NAMESPACE"
        success "$service_name updated"
    fi
    
    cd - > /dev/null
}

# Main function
main() {
    log "Starting platform-specific deployment for x86_64 architecture..."
    
    # Login to registry
    login_to_registry
    
    # Update services that are failing
    update_frontend
    update_python_service "submission-service" "services/submission-service"
    update_python_service "python-sample-management" "services/python-sample-management"
    update_python_service "python-ai-processing" "services/python-ai-processing"
    update_python_service "python-authentication" "services/python-authentication"
    
    # Wait for rollouts
    log "Waiting for deployments to stabilize..."
    sleep 10
    
    # Check status
    log "Checking deployment status..."
    oc get pods | grep -E "(python-|nanopore-frontend|submission-service)"
    
    success "Platform-specific updates completed!"
}

# Run main function
main 
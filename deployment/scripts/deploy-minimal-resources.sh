#!/bin/bash

# Minimal Resource Deployment Script for Constrained OpenShift Environment
# This script deploys with minimal resources (200Mi memory, 150m CPU)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT="dept-barc"
APP_NAME="nanopore-app-minimal"

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v oc &> /dev/null; then
        print_error "OpenShift CLI (oc) not found. Please install it first."
        exit 1
    fi
    
    if ! oc whoami &> /dev/null; then
        print_error "Not logged in to OpenShift. Please run 'oc login' first."
        exit 1
    fi
    
    print_status "Logged in as: $(oc whoami)"
    print_status "Current project: $(oc project -q)"
    
    if [ "$(oc project -q)" != "$PROJECT" ]; then
        print_warning "Switching to project $PROJECT..."
        oc project $PROJECT || {
            print_error "Failed to switch to project $PROJECT"
            exit 1
        }
    fi
}

# Check resource availability
check_resources() {
    print_status "Checking resource availability..."
    
    local pods_used=$(oc get resourcequota default-quota -o jsonpath='{.status.used.pods}' 2>/dev/null || echo "0")
    local pods_hard=$(oc get resourcequota default-quota -o jsonpath='{.status.hard.pods}' 2>/dev/null || echo "20")
    local services_used=$(oc get resourcequota default-quota -o jsonpath='{.status.used.services}' 2>/dev/null || echo "0")
    local services_hard=$(oc get resourcequota default-quota -o jsonpath='{.status.hard.services}' 2>/dev/null || echo "20")
    
    local pods_available=$((pods_hard - pods_used))
    local services_available=$((services_hard - services_used))
    
    print_status "Pods available: $pods_available/$pods_hard"
    print_status "Services available: $services_available/$services_hard"
    
    if [ "$pods_available" -lt 1 ]; then
        print_error "Not enough pod quota available (need at least 1)"
        exit 1
    fi
    
    if [ "$services_available" -lt 1 ]; then
        print_error "Not enough service quota available (need at least 1)"
        exit 1
    fi
    
    # Check memory availability
    local mem_used=$(oc get resourcequota compute-resources -o jsonpath='{.status.used.limits\.memory}' 2>/dev/null || echo "0")
    local mem_hard=$(oc get resourcequota compute-resources -o jsonpath='{.status.hard.limits\.memory}' 2>/dev/null || echo "4Gi")
    
    print_status "Memory quota: $mem_used / $mem_hard"
    print_warning "This deployment requires ~200Mi memory"
}

# Build and push image
build_image() {
    print_status "Building application image..."
    
    # Check if we can use existing image
    if oc get is nanopore-frontend &> /dev/null; then
        print_status "Using existing nanopore-frontend image"
        return 0
    fi
    
    # Otherwise, we need to build
    print_warning "No existing image found. Creating build configuration..."
    
    # Create build config for frontend
    cat <<EOF | oc apply -f -
apiVersion: build.openshift.io/v1
kind: BuildConfig
metadata:
  name: nanopore-frontend-minimal
  namespace: $PROJECT
spec:
  source:
    type: Git
    git:
      uri: https://github.com/yourusername/nanopore-tracking-app.git
      ref: main
    contextDir: /
  strategy:
    type: Docker
    dockerStrategy:
      dockerfilePath: Dockerfile
  output:
    to:
      kind: ImageStreamTag
      name: nanopore-frontend:minimal
EOF
    
    # Start build
    print_status "Starting build..."
    oc start-build nanopore-frontend-minimal --follow || {
        print_error "Build failed"
        exit 1
    }
}

# Deploy application
deploy_app() {
    print_status "Deploying application with minimal resources..."
    
    # Apply the minimal deployment configuration
    oc apply -f deployment/openshift/minimal-resource-deployment.yaml
    
    print_status "Waiting for deployment to complete..."
    oc rollout status deployment/$APP_NAME --timeout=300s || {
        print_error "Deployment failed to complete"
        print_status "Checking pod logs..."
        oc logs -l app=$APP_NAME --tail=50
        exit 1
    }
    
    print_success "Deployment completed successfully!"
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Check pod status
    local pod_status=$(oc get pods -l app=$APP_NAME -o jsonpath='{.items[0].status.phase}' 2>/dev/null)
    if [ "$pod_status" = "Running" ]; then
        print_success "Pod is running"
    else
        print_error "Pod is not running (status: $pod_status)"
        return 1
    fi
    
    # Check service
    if oc get service $APP_NAME &> /dev/null; then
        print_success "Service is created"
    else
        print_error "Service not found"
        return 1
    fi
    
    # Check route
    local route_host=$(oc get route $APP_NAME -o jsonpath='{.spec.host}' 2>/dev/null)
    if [ -n "$route_host" ]; then
        print_success "Route created: https://$route_host"
        
        # Test the route
        print_status "Testing application health..."
        local health_status=$(curl -s -o /dev/null -w "%{http_code}" "https://$route_host/health" 2>/dev/null || echo "000")
        if [ "$health_status" = "200" ]; then
            print_success "Application is healthy!"
        else
            print_warning "Health check returned status: $health_status"
        fi
    else
        print_error "Route not found"
        return 1
    fi
}

# Show resource usage
show_usage() {
    print_status "Current resource usage:"
    echo
    oc top pod -l app=$APP_NAME 2>/dev/null || print_warning "Metrics not available yet"
    echo
    print_status "Pod details:"
    oc get pods -l app=$APP_NAME
    echo
    print_status "To view logs:"
    echo "  oc logs -f -l app=$APP_NAME"
    echo
    print_status "To access the application:"
    local route_host=$(oc get route $APP_NAME -o jsonpath='{.spec.host}' 2>/dev/null)
    echo "  https://$route_host"
}

# Main execution
main() {
    print_status "Starting minimal resource deployment..."
    echo
    
    check_prerequisites
    check_resources
    
    # Ask for confirmation
    echo
    print_warning "This will deploy with minimal resources (192Mi memory, 150m CPU)"
    print_warning "Some features will be disabled (AI processing, MCP servers)"
    echo
    read -p "Continue with deployment? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled"
        exit 0
    fi
    
    deploy_app
    verify_deployment
    show_usage
    
    print_success "Deployment complete!"
    print_warning "Note: This is a minimal deployment. Monitor resource usage closely."
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "status")
        show_usage
        ;;
    "logs")
        oc logs -f -l app=$APP_NAME
        ;;
    "delete")
        print_warning "Deleting minimal deployment..."
        oc delete -f deployment/openshift/minimal-resource-deployment.yaml
        print_success "Deployment deleted"
        ;;
    *)
        echo "Usage: $0 [deploy|status|logs|delete]"
        exit 1
        ;;
esac 
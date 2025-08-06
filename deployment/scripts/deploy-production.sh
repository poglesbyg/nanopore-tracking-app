#!/bin/bash

# OpenShift Production Deployment Script for Nanopore Tracking Application
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="dept-barc"
APP_NAME="nanopore-tracking"
IMAGE_NAME="nanopore-tracking"
BUILD_CONFIG_NAME="nanopore-tracking-build"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if logged into OpenShift
check_oc_login() {
    if ! oc whoami &>/dev/null; then
        log_error "Not logged into OpenShift. Please run 'oc login' first."
        exit 1
    fi
    
    local current_project=$(oc project --short 2>/dev/null || echo "")
    if [[ "$current_project" != "$PROJECT_NAME" ]]; then
        log_info "Switching to project: $PROJECT_NAME"
        if ! oc project "$PROJECT_NAME" &>/dev/null; then
            log_error "Failed to switch to project $PROJECT_NAME. Please ensure you have access."
            exit 1
        fi
    fi
    
    log_success "Logged into OpenShift as $(oc whoami) in project $PROJECT_NAME"
}

# Create build configuration
create_build_config() {
    log_info "Creating build configuration..."
    
    cat <<EOF | oc apply -f -
apiVersion: build.openshift.io/v1
kind: BuildConfig
metadata:
  name: $BUILD_CONFIG_NAME
  labels:
    app: $APP_NAME
    env: production
spec:
  source:
    type: Binary
    binary: {}
  strategy:
    type: Docker
    dockerStrategy:
      dockerfilePath: Dockerfile.production
  output:
    to:
      kind: ImageStreamTag
      name: $IMAGE_NAME:latest
  triggers: []
EOF

    log_success "Build configuration created"
}

# Create image stream
create_image_stream() {
    log_info "Creating image stream..."
    
    cat <<EOF | oc apply -f -
apiVersion: image.openshift.io/v1
kind: ImageStream
metadata:
  name: $IMAGE_NAME
  labels:
    app: $APP_NAME
    env: production
spec:
  lookupPolicy:
    local: false
EOF

    log_success "Image stream created"
}

# Build application
build_application() {
    log_info "Starting application build..."
    
    # Create a temporary directory and copy source
    local temp_dir=$(mktemp -d)
    local script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    local project_root="$script_dir/../.."
    
    log_info "Copying source code to temporary directory: $temp_dir"
    cp -r "$project_root"/* "$temp_dir/" 2>/dev/null || true
    
    # Remove node_modules and other build artifacts
    rm -rf "$temp_dir/node_modules" "$temp_dir/dist" "$temp_dir/.astro" 2>/dev/null || true
    
    # Start the build
    log_info "Starting binary build..."
    oc start-build "$BUILD_CONFIG_NAME" --from-dir="$temp_dir" --follow --wait
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log_success "Application build completed"
}

# Deploy application
deploy_application() {
    log_info "Deploying application to production..."
    
    # Apply the production configuration
    local config_file="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )/../openshift/production/nanopore-production-complete.yaml"
    
    if [[ ! -f "$config_file" ]]; then
        log_error "Production configuration file not found: $config_file"
        exit 1
    fi
    
    log_info "Applying production configuration..."
    oc apply -f "$config_file"
    
    log_success "Production configuration applied"
}

# Wait for deployment
wait_for_deployment() {
    log_info "Waiting for deployment to complete..."
    
    # Wait for the deployment to be ready
    if oc rollout status deployment/"$APP_NAME-app" --timeout=300s; then
        log_success "Deployment completed successfully"
    else
        log_error "Deployment failed or timed out"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Get a running pod
    local pod_name=$(oc get pods -l app=$APP_NAME -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [[ -z "$pod_name" ]]; then
        log_warning "No running pods found, skipping migrations"
        return
    fi
    
    log_info "Running migrations in pod: $pod_name"
    oc exec "$pod_name" -- node scripts/setup-database.js || {
        log_warning "Migration failed, but continuing deployment"
    }
    
    log_success "Database migrations completed"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if pods are running
    local running_pods=$(oc get pods -l app=$APP_NAME --field-selector=status.phase=Running -o name | wc -l)
    if [[ $running_pods -gt 0 ]]; then
        log_success "$running_pods pod(s) running successfully"
    else
        log_error "No pods are running"
        return 1
    fi
    
    # Check service
    if oc get service "$APP_NAME-service" &>/dev/null; then
        log_success "Service is configured"
    else
        log_error "Service not found"
        return 1
    fi
    
    # Check route
    local route_url=$(oc get route "$APP_NAME-route" -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
    if [[ -n "$route_url" ]]; then
        log_success "Route configured: https://$route_url"
        
        # Test the health endpoint
        log_info "Testing health endpoint..."
        if curl -s -k "https://$route_url/health" >/dev/null; then
            log_success "Application is responding to health checks"
        else
            log_warning "Health check failed, but deployment may still be starting"
        fi
    else
        log_error "Route not found"
        return 1
    fi
}

# Show deployment status
show_status() {
    log_info "=== Deployment Status ==="
    echo ""
    
    log_info "Pods:"
    oc get pods -l app=$APP_NAME -o wide
    echo ""
    
    log_info "Services:"
    oc get services -l app=$APP_NAME
    echo ""
    
    log_info "Routes:"
    oc get routes -l app=$APP_NAME
    echo ""
    
    log_info "Deployment:"
    oc get deployment -l app=$APP_NAME
    echo ""
    
    local route_url=$(oc get route "$APP_NAME-route" -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
    if [[ -n "$route_url" ]]; then
        log_success "🚀 Application deployed successfully!"
        log_success "🌐 URL: https://$route_url"
    fi
}

# Main deployment function
main() {
    log_info "🚀 Starting OpenShift Production Deployment"
    log_info "Project: $PROJECT_NAME"
    log_info "Application: $APP_NAME"
    echo ""
    
    # Confirm deployment
    read -p "Are you sure you want to deploy to PRODUCTION? Type 'DEPLOY' to confirm: " confirmation
    if [[ "$confirmation" != "DEPLOY" ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
    
    echo ""
    log_info "Starting deployment process..."
    
    # Execute deployment steps
    check_oc_login
    create_image_stream
    create_build_config
    build_application
    deploy_application
    wait_for_deployment
    run_migrations
    verify_deployment
    show_status
    
    log_success "🎉 Production deployment completed successfully!"
}

# Run main function
main "$@"
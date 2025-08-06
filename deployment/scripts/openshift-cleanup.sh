#!/bin/bash

# OpenShift Nanopore Tracking Application - Complete Cleanup Script
# This script will remove all nanopore-related resources from OpenShift
# Use with caution - this will destroy all deployed resources!

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Get current project
CURRENT_PROJECT=$(oc project --short 2>/dev/null || echo "")

if [[ -z "$CURRENT_PROJECT" ]]; then
    log_error "Not logged into OpenShift or no project selected"
    exit 1
fi

log_info "Current OpenShift project: $CURRENT_PROJECT"

# Confirm cleanup
echo ""
echo -e "${RED}⚠️  WARNING: This will permanently delete ALL nanopore-related resources!${NC}"
echo -e "${RED}⚠️  This action cannot be undone!${NC}"
echo ""
echo "Resources to be deleted in project '$CURRENT_PROJECT':"
echo "  - All deployments related to nanopore tracking"
echo "  - All services and routes"
echo "  - All configmaps and secrets"
echo "  - All build configs and image streams"
echo "  - All persistent volume claims"
echo ""

read -p "Are you sure you want to proceed? Type 'DELETE' to confirm: " confirmation

if [[ "$confirmation" != "DELETE" ]]; then
    log_info "Cleanup cancelled by user"
    exit 0
fi

echo ""
log_info "Starting cleanup process..."

# Function to safely delete resources
safe_delete() {
    local resource_type=$1
    local resource_name=$2
    local namespace=${3:-$CURRENT_PROJECT}
    
    if oc get "$resource_type" "$resource_name" -n "$namespace" >/dev/null 2>&1; then
        log_info "Deleting $resource_type/$resource_name"
        oc delete "$resource_type" "$resource_name" -n "$namespace" --ignore-not-found=true
        log_success "Deleted $resource_type/$resource_name"
    else
        log_warning "$resource_type/$resource_name not found, skipping"
    fi
}

# Function to delete resources by label
delete_by_label() {
    local resource_type=$1
    local label_selector=$2
    local namespace=${3:-$CURRENT_PROJECT}
    
    log_info "Deleting $resource_type with label: $label_selector"
    oc delete "$resource_type" -l "$label_selector" -n "$namespace" --ignore-not-found=true
}

# 1. Delete Routes
log_info "=== Cleaning up Routes ==="
NANOPORE_ROUTES=(
    "ai-processing-route"
    "ai-service-optimized-route"
    "ai-service-route"
    "nanopore-api"
    "nanopore-app-minimal"
    "python-ai-processing-route"
    "python-authentication-route"
    "python-sample-management-route"
    "sample-service-optimized-route"
    "sample-service-route"
    "submission-service-route"
    "service-mesh-route"
    "jaeger-ui-route"
)

for route in "${NANOPORE_ROUTES[@]}"; do
    safe_delete "route" "$route"
done

# 2. Delete Services
log_info "=== Cleaning up Services ==="
NANOPORE_SERVICES=(
    "ai-processing"
    "nanopore-app-minimal"
    "python-ai-processing"
    "python-audit"
    "python-authentication"
    "python-file-storage"
    "python-gateway"
    "python-sample-management"
    "sample-service-optimized"
    "submission-service"
    "postgresql"
    "redis"
)

for service in "${NANOPORE_SERVICES[@]}"; do
    safe_delete "service" "$service"
done

# 3. Delete Deployments
log_info "=== Cleaning up Deployments ==="
NANOPORE_DEPLOYMENTS=(
    "ai-service-optimized"
    "nanopore-app-minimal"
    "nanopore-frontend"
    "postgresql"
    "prometheus-minimal"
    "python-ai-processing"
    "python-audit"
    "python-authentication"
    "python-file-storage"
    "python-gateway"
    "python-sample-management"
    "redis"
    "sample-service-optimized"
    "submission-service"
)

for deployment in "${NANOPORE_DEPLOYMENTS[@]}"; do
    safe_delete "deployment" "$deployment"
done

# 4. Delete ConfigMaps
log_info "=== Cleaning up ConfigMaps ==="
NANOPORE_CONFIGMAPS=(
    "cors-config"
    "frontend-html"
    "microservices-config"
    "microservices-config-optimized"
    "minimal-service-mesh-config"
    "nanopore-config"
    "nanopore-minimal-config"
    "prometheus-minimal-config"
    "sequencing-consultant-config"
    "service-hosts"
    "service-mesh-dashboard"
    "service-mesh-integration"
    "service-mesh-scripts"
)

for configmap in "${NANOPORE_CONFIGMAPS[@]}"; do
    safe_delete "configmap" "$configmap"
done

# 5. Delete Secrets
log_info "=== Cleaning up Secrets ==="
NANOPORE_SECRETS=(
    "microservices-secrets"
    "nanopore-secrets"
    "python-jwt-secret"
    "python-postgres-secret"
    "sequencing-consultant-secrets"
    "service-mesh-tls-certs"
    "tracseq-db-secrets"
)

for secret in "${NANOPORE_SECRETS[@]}"; do
    safe_delete "secret" "$secret"
done

# 6. Delete Build Configs
log_info "=== Cleaning up Build Configs ==="
NANOPORE_BUILDCONFIGS=(
    "ai-processing"
    "nanopore-tracking-app"
    "python-gateway"
    "python-sample-management"
    "submission-service"
    "sequencing-consultant-web"
    "tracseq-batch-export-build"
    "tracseq-batch-export-docker"
    "tracseq-python-builder"
)

for buildconfig in "${NANOPORE_BUILDCONFIGS[@]}"; do
    safe_delete "buildconfig" "$buildconfig"
done

# 7. Delete Image Streams
log_info "=== Cleaning up Image Streams ==="
NANOPORE_IMAGESTREAMS=(
    "ai-processing"
    "nanopore-frontend"
    "nanopore-frontend-full"
    "nanopore-tracking-app"
    "nanopore-ultra-minimal"
    "python-ai-processing"
    "python-ai-processingatest"
    "python-audit"
    "python-authentication"
    "python-authenticationatest"
    "python-file-storage"
    "python-gateway"
    "python-sample-management"
    "python-sample-managementatest"
    "sequencing-consultant-web"
    "submission-service"
    "tracseq-batch-export"
    "tracseq-python-builder"
)

for imagestream in "${NANOPORE_IMAGESTREAMS[@]}"; do
    safe_delete "imagestream" "$imagestream"
done

# 8. Delete any remaining builds
log_info "=== Cleaning up Builds ==="
oc delete builds --all --ignore-not-found=true

# 9. Delete Service Accounts (be careful with this)
log_info "=== Cleaning up Service Accounts ==="
NANOPORE_SERVICEACCOUNTS=(
    "nanopore-tracking-sa"
    "prometheus"
)

for sa in "${NANOPORE_SERVICEACCOUNTS[@]}"; do
    safe_delete "serviceaccount" "$sa"
done

# 10. Delete any PVCs
log_info "=== Cleaning up Persistent Volume Claims ==="
NANOPORE_PVCS=(
    "postgresql-data"
    "redis-data"
    "nanopore-storage"
)

for pvc in "${NANOPORE_PVCS[@]}"; do
    safe_delete "pvc" "$pvc"
done

# 11. Delete any remaining pods (they should be gone with deployments)
log_info "=== Cleaning up any remaining Pods ==="
oc delete pods -l app=nanopore --ignore-not-found=true
oc delete pods -l component=microservice --ignore-not-found=true
oc delete pods -l component=api-gateway --ignore-not-found=true

# 12. Clean up any HPA, NetworkPolicies, etc.
log_info "=== Cleaning up HPA and Network Policies ==="
oc delete hpa --all --ignore-not-found=true
oc delete networkpolicy -l app=nanopore --ignore-not-found=true

# 13. Wait for cleanup to complete
log_info "=== Waiting for cleanup to complete ==="
sleep 10

# 14. Verify cleanup
log_info "=== Verifying cleanup ==="
echo ""
log_info "Checking for remaining nanopore-related resources..."

# Check for any remaining resources
REMAINING_RESOURCES=0

# Check deployments
if oc get deployments 2>/dev/null | grep -E "(nanopore|python-|ai-|submission|sample-service)" >/dev/null 2>&1; then
    log_warning "Some deployments may still exist"
    oc get deployments | grep -E "(nanopore|python-|ai-|submission|sample-service)" || true
    ((REMAINING_RESOURCES++))
fi

# Check services
if oc get services 2>/dev/null | grep -E "(nanopore|python-|ai-|submission|sample-service)" >/dev/null 2>&1; then
    log_warning "Some services may still exist"
    oc get services | grep -E "(nanopore|python-|ai-|submission|sample-service)" || true
    ((REMAINING_RESOURCES++))
fi

# Check routes
if oc get routes 2>/dev/null | grep -E "(nanopore|python-|ai-|submission|sample-service)" >/dev/null 2>&1; then
    log_warning "Some routes may still exist"
    oc get routes | grep -E "(nanopore|python-|ai-|submission|sample-service)" || true
    ((REMAINING_RESOURCES++))
fi

# Final status
echo ""
if [[ $REMAINING_RESOURCES -eq 0 ]]; then
    log_success "✅ Cleanup completed successfully!"
    log_success "All nanopore-related resources have been removed from project '$CURRENT_PROJECT'"
else
    log_warning "⚠️  Cleanup mostly completed, but some resources may still exist"
    log_info "You may need to manually delete any remaining resources"
    log_info "Run 'oc get all' to see what remains"
fi

echo ""
log_info "Cleanup script finished"
log_info "OpenShift project '$CURRENT_PROJECT' is now clean and ready for fresh deployment"
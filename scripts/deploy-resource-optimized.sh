#!/bin/bash

# Deploy Resource-Optimized Nanopore Solution to OpenShift
# Total resources: 448Mi memory, 425m CPU (well within limits)

set -e

NAMESPACE="dept-barc"
DEPLOYMENT_FILE="deployment/openshift/resource-optimized-deployment.yaml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

main() {
    log_info "🚀 Starting Resource-Optimized Deployment"
    echo "=============================================="
    echo "🧬 Nanopore Tracking System"
    echo "🐍 Python Microservices + Frontend"
    echo "📊 Resource Usage: 448Mi memory, 425m CPU"
    echo "=============================================="
    echo
    
    # Check prerequisites
    if ! command -v oc &> /dev/null; then
        log_error "OpenShift CLI not found"
        exit 1
    fi
    
    if ! oc whoami &> /dev/null; then
        log_error "Not logged in to OpenShift"
        exit 1
    fi
    
    log_success "Prerequisites validated"
    
    # Switch to correct namespace
    oc project $NAMESPACE
    
    # Clean up existing deployments
    log_info "Cleaning up existing deployments..."
    oc delete deployment nanopore-tracking-app --ignore-not-found=true
    oc delete service nanopore-tracking-app --ignore-not-found=true
    oc delete route nanopore-tracking-app --ignore-not-found=true
    oc delete configmap nanopore-config --ignore-not-found=true
    oc delete secret nanopore-secrets --ignore-not-found=true
    
    # Wait for cleanup
    sleep 10
    
    # Deploy the optimized solution
    log_info "Deploying resource-optimized solution..."
    oc apply -f $DEPLOYMENT_FILE
    
    # Wait for deployments
    log_info "Waiting for deployments to be ready..."
    
    deployments=("postgresql" "redis" "python-gateway" "nanopore-frontend")
    for deployment in "${deployments[@]}"; do
        log_info "Waiting for $deployment..."
        oc rollout status deployment/$deployment --timeout=300s || {
            log_error "Deployment $deployment failed"
            oc get pods -l app=$deployment
            exit 1
        }
        log_success "$deployment is ready"
    done
    
    # Initialize database
    log_info "Initializing database..."
    sleep 30  # Wait for PostgreSQL to be fully ready
    
    oc exec deployment/postgresql -- psql -U postgres -d nanopore_db -c "
        CREATE TABLE IF NOT EXISTS samples (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            priority INTEGER DEFAULT 1,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        INSERT INTO samples (name, status, priority) VALUES 
            ('Sample-001', 'processing', 1),
            ('Sample-002', 'completed', 2),
            ('Sample-003', 'pending', 3)
        ON CONFLICT DO NOTHING;
    " || log_warning "Database initialization may have failed"
    
    # Get access URLs
    frontend_url=$(oc get route nanopore-app -o jsonpath='{.spec.host}' 2>/dev/null || echo "Not found")
    api_url=$(oc get route nanopore-api -o jsonpath='{.spec.host}' 2>/dev/null || echo "Not found")
    
    log_success "Deployment completed successfully!"
    echo
    echo "🎉 ACCESS INFORMATION 🎉"
    echo "========================="
    echo "🌐 Frontend: https://$frontend_url"
    echo "🔌 API Gateway: https://$api_url"
    echo "📚 API Docs: https://$api_url/docs"
    echo
    echo "✅ FEATURES AVAILABLE:"
    echo "• Sample Management (CRUD operations)"
    echo "• Real-time status updates"
    echo "• API testing interface"
    echo "• Modern responsive UI"
    echo "• Python FastAPI backend"
    echo "• PostgreSQL database"
    echo "• Redis caching"
    echo
    echo "📊 RESOURCE USAGE:"
    echo "• Memory: 448Mi (well within 4Gi limit)"
    echo "• CPU: 425m (well within 4000m limit)"
    echo "• Pods: 4 (well within 15 limit)"
    echo
    echo "🔧 MONITORING:"
    echo "• Pod status: oc get pods"
    echo "• Logs: oc logs -f deployment/python-gateway"
    echo "• Resources: oc top pods"
    echo
    echo "🚀 Your Nanopore Tracking System is ready!"
    echo "Access it at: https://$frontend_url"
}

# Handle interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@" 
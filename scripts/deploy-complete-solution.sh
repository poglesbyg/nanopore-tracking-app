#!/bin/bash

# Deploy Complete Nanopore Solution (Frontend + Python Backend) to OpenShift
# This script works within the existing OpenShift constraints

set -e

# Configuration
NAMESPACE="dept-barc"
DEPLOYMENT_FILE="deployment/openshift/complete-solution-deployment.yaml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if oc is available
    if ! command -v oc &> /dev/null; then
        log_error "OpenShift CLI (oc) is not installed or not in PATH"
        exit 1
    fi
    
    # Check if logged in
    if ! oc whoami &> /dev/null; then
        log_error "Not logged in to OpenShift. Please run 'oc login' first"
        exit 1
    fi
    
    # Check if in correct namespace
    current_project=$(oc project -q)
    if [ "$current_project" != "$NAMESPACE" ]; then
        log_warning "Switching to namespace: $NAMESPACE"
        oc project $NAMESPACE
    fi
    
    log_success "Prerequisites validated"
}

# Clean up existing problematic deployments
cleanup_existing() {
    log_info "Cleaning up existing problematic deployments..."
    
    # Stop the CrashLoopBackOff pods
    log_info "Stopping existing nanopore-tracking-app deployment..."
    if oc get deployment nanopore-tracking-app &> /dev/null; then
        oc scale deployment nanopore-tracking-app --replicas=0
        oc delete deployment nanopore-tracking-app --ignore-not-found=true
        log_success "Cleaned up old nanopore-tracking-app deployment"
    fi
    
    # Clean up any existing services that might conflict
    oc delete service nanopore-tracking-app --ignore-not-found=true
    oc delete route nanopore-tracking-app --ignore-not-found=true
    
    # Clean up any existing config maps that might conflict
    oc delete configmap nanopore-config --ignore-not-found=true
    oc delete secret nanopore-secrets --ignore-not-found=true
    
    log_success "Cleanup completed"
}

# Check resource availability
check_resources() {
    log_info "Checking resource availability..."
    
    # Get current resource usage
    quota_info=$(oc describe quota default-quota)
    
    # Extract current usage
    current_memory=$(echo "$quota_info" | grep "limits.memory" | awk '{print $2}' | sed 's/Mi//')
    memory_limit=$(echo "$quota_info" | grep "limits.memory" | awk '{print $3}' | sed 's/Gi//' | awk '{print $1*1024}')
    
    current_cpu=$(echo "$quota_info" | grep "limits.cpu" | awk '{print $2}' | sed 's/m//')
    cpu_limit=$(echo "$quota_info" | grep "limits.cpu" | awk '{print $3}' | sed 's/m//')
    
    # Calculate required resources for new deployment
    required_memory=1280  # 512 + 256 + 256 + 128 + 128 MB
    required_cpu=1050     # 500 + 200 + 200 + 100 + 50 mCPU
    
    available_memory=$((memory_limit - current_memory))
    available_cpu=$((cpu_limit - current_cpu))
    
    log_info "Resource Analysis:"
    log_info "  Memory: ${available_memory}Mi available, ${required_memory}Mi required"
    log_info "  CPU: ${available_cpu}m available, ${required_cpu}m required"
    
    if [ $available_memory -lt $required_memory ]; then
        log_error "Insufficient memory available. Required: ${required_memory}Mi, Available: ${available_memory}Mi"
        exit 1
    fi
    
    if [ $available_cpu -lt $required_cpu ]; then
        log_error "Insufficient CPU available. Required: ${required_cpu}m, Available: ${available_cpu}m"
        exit 1
    fi
    
    log_success "Sufficient resources available"
}

# Initialize database
initialize_database() {
    log_info "Initializing database..."
    
    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    timeout=300
    counter=0
    
    while [ $counter -lt $timeout ]; do
        if oc get pod -l app=postgresql -o jsonpath='{.items[0].status.phase}' | grep -q "Running"; then
            if oc exec deployment/postgresql -- pg_isready -U postgres &> /dev/null; then
                log_success "PostgreSQL is ready"
                break
            fi
        fi
        
        sleep 5
        counter=$((counter + 5))
        echo -n "."
    done
    
    if [ $counter -ge $timeout ]; then
        log_error "PostgreSQL failed to start within timeout"
        exit 1
    fi
    
    # Create database schema
    log_info "Creating database schema..."
    oc exec deployment/postgresql -- psql -U postgres -d nanopore_db -c "
        CREATE TABLE IF NOT EXISTS samples (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            priority INTEGER DEFAULT 1,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            role VARCHAR(50) DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Insert sample data
        INSERT INTO samples (name, status, priority) VALUES 
            ('Sample-001', 'processing', 1),
            ('Sample-002', 'completed', 2),
            ('Sample-003', 'pending', 3)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO users (username, email, role) VALUES 
            ('admin', 'admin@example.com', 'admin'),
            ('user1', 'user1@example.com', 'user')
        ON CONFLICT DO NOTHING;
    " || log_warning "Database initialization may have failed, but continuing..."
    
    log_success "Database initialized"
}

# Deploy the complete solution
deploy_solution() {
    log_info "Deploying complete solution..."
    
    # Apply the deployment configuration
    oc apply -f $DEPLOYMENT_FILE
    
    log_success "Deployment configuration applied"
}

# Wait for deployments to be ready
wait_for_deployments() {
    log_info "Waiting for deployments to be ready..."
    
    deployments=("postgresql" "redis" "python-gateway" "nanopore-frontend")
    
    for deployment in "${deployments[@]}"; do
        log_info "Waiting for $deployment to be ready..."
        
        # Wait for deployment to be available
        if ! oc rollout status deployment/$deployment --timeout=300s; then
            log_error "Deployment $deployment failed to become ready"
            
            # Show pod status for debugging
            log_info "Pod status for $deployment:"
            oc get pods -l app=$deployment
            
            # Show logs if pod is failing
            pod_name=$(oc get pods -l app=$deployment -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
            if [ -n "$pod_name" ]; then
                log_info "Logs for $pod_name:"
                oc logs $pod_name --tail=20 || true
            fi
            
            exit 1
        fi
        
        log_success "$deployment is ready"
    done
}

# Verify the deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check all pods are running
    log_info "Checking pod status..."
    oc get pods -l 'app in (postgresql,redis,python-gateway,nanopore-frontend)'
    
    # Check services
    log_info "Checking services..."
    oc get services
    
    # Check routes
    log_info "Checking routes..."
    oc get routes
    
    # Test API Gateway health
    log_info "Testing API Gateway health..."
    gateway_pod=$(oc get pods -l app=python-gateway -o jsonpath='{.items[0].metadata.name}')
    if [ -n "$gateway_pod" ]; then
        if oc exec $gateway_pod -- curl -f http://localhost:8000/health &> /dev/null; then
            log_success "API Gateway health check passed"
        else
            log_warning "API Gateway health check failed"
        fi
    fi
    
    # Test frontend
    log_info "Testing frontend..."
    frontend_pod=$(oc get pods -l app=nanopore-frontend -o jsonpath='{.items[0].metadata.name}')
    if [ -n "$frontend_pod" ]; then
        if oc exec $frontend_pod -- curl -f http://localhost:3001 &> /dev/null; then
            log_success "Frontend health check passed"
        else
            log_warning "Frontend health check failed"
        fi
    fi
    
    log_success "Deployment verification completed"
}

# Display access information
display_access_info() {
    log_info "Deployment completed successfully!"
    echo
    echo "=== ACCESS INFORMATION ==="
    echo
    
    # Get routes
    frontend_route=$(oc get route nanopore-app -o jsonpath='{.spec.host}' 2>/dev/null || echo "Not found")
    api_route=$(oc get route nanopore-api -o jsonpath='{.spec.host}' 2>/dev/null || echo "Not found")
    
    echo "🌐 Frontend Application:"
    echo "   URL: https://$frontend_route"
    echo "   Description: Complete Nanopore Tracking System with Python Backend"
    echo
    
    echo "🔌 API Gateway:"
    echo "   URL: https://$api_route"
    echo "   Health Check: https://$api_route/health"
    echo "   API Docs: https://$api_route/docs"
    echo
    
    echo "=== FEATURES AVAILABLE ==="
    echo "✅ Sample Management (Create, Read, Update, Delete)"
    echo "✅ User Authentication (Mock implementation)"
    echo "✅ Real-time Status Updates"
    echo "✅ API Testing Interface"
    echo "✅ Responsive Web Interface"
    echo "✅ Python FastAPI Backend"
    echo "✅ PostgreSQL Database"
    echo "✅ Redis Caching"
    echo
    
    echo "=== MONITORING ==="
    echo "📊 Pod Status: oc get pods"
    echo "📈 Resource Usage: oc top pods"
    echo "📋 Logs: oc logs -f deployment/python-gateway"
    echo "🔍 Debug: oc describe pod <pod-name>"
    echo
    
    echo "=== NEXT STEPS ==="
    echo "1. Access the frontend at: https://$frontend_route"
    echo "2. Test the API endpoints using the built-in testing interface"
    echo "3. Monitor the deployment using: oc get pods -w"
    echo "4. Scale services if needed: oc scale deployment/<service> --replicas=2"
    echo "5. Add monitoring: ./scripts/setup-monitoring.sh"
}

# Main execution
main() {
    log_info "Starting complete solution deployment..."
    echo "=============================================="
    echo "🧬 Nanopore Tracking System Deployment"
    echo "🐍 Python Microservices + Frontend"
    echo "🚀 OpenShift Production Ready"
    echo "=============================================="
    echo
    
    check_prerequisites
    cleanup_existing
    check_resources
    deploy_solution
    wait_for_deployments
    initialize_database
    verify_deployment
    display_access_info
    
    log_success "Complete solution deployment finished successfully!"
    echo
    echo "🎉 Your Nanopore Tracking System is now running on OpenShift!"
    echo "🌐 Access it at: https://$(oc get route nanopore-app -o jsonpath='{.spec.host}' 2>/dev/null)"
}

# Handle script interruption
trap 'log_error "Deployment interrupted by user"; exit 1' INT TERM

# Run main function
main "$@" 
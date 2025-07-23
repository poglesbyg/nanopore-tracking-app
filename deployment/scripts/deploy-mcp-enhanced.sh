#!/bin/bash

# MCP-Enhanced Nanopore Tracking Application Deployment Script
# This script deploys the complete MCP-enhanced application to OpenShift

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="nanopore-mcp"
DEPLOYMENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENSHIFT_DIR="${DEPLOYMENT_DIR}/openshift"

# Function to print colored output
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for deployment to be ready
wait_for_deployment() {
    local deployment_name=$1
    local timeout=${2:-300}
    
    print_status "Waiting for deployment ${deployment_name} to be ready..."
    
    if oc rollout status deployment/${deployment_name} -n ${NAMESPACE} --timeout=${timeout}s; then
        print_success "Deployment ${deployment_name} is ready"
        return 0
    else
        print_error "Deployment ${deployment_name} failed to become ready within ${timeout} seconds"
        return 1
    fi
}

# Function to check deployment health
check_deployment_health() {
    local deployment_name=$1
    
    print_status "Checking health of deployment ${deployment_name}..."
    
    local ready_replicas=$(oc get deployment ${deployment_name} -n ${NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired_replicas=$(oc get deployment ${deployment_name} -n ${NAMESPACE} -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    
    if [ "${ready_replicas}" = "${desired_replicas}" ] && [ "${ready_replicas}" != "0" ]; then
        print_success "Deployment ${deployment_name} is healthy (${ready_replicas}/${desired_replicas} replicas ready)"
        return 0
    else
        print_warning "Deployment ${deployment_name} is not fully healthy (${ready_replicas}/${desired_replicas} replicas ready)"
        return 1
    fi
}

# Function to create or update database schema
setup_database() {
    print_status "Setting up database schema..."
    
    # Wait for PostgreSQL to be ready
    wait_for_deployment "postgresql"
    
    # Create database schema (this would typically be done via migration scripts)
    print_status "Database schema setup would be handled by application migrations"
    
    print_success "Database setup completed"
}

# Function to deploy MCP servers
deploy_mcp_servers() {
    print_status "Deploying MCP servers..."
    
    # Deploy Sample Management MCP Server
    if wait_for_deployment "mcp-sample-management"; then
        print_success "Sample Management MCP Server deployed successfully"
    else
        print_error "Failed to deploy Sample Management MCP Server"
        return 1
    fi
    
    # Deploy Nanopore Domain MCP Server
    if wait_for_deployment "mcp-nanopore-domain"; then
        print_success "Nanopore Domain MCP Server deployed successfully"
    else
        print_error "Failed to deploy Nanopore Domain MCP Server"
        return 1
    fi
    
    print_success "All MCP servers deployed successfully"
}

# Function to deploy main application
deploy_main_app() {
    print_status "Deploying main application..."
    
    if wait_for_deployment "nanopore-app"; then
        print_success "Main application deployed successfully"
    else
        print_error "Failed to deploy main application"
        return 1
    fi
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    local all_healthy=true
    
    # Check all deployments
    local deployments=("postgresql" "mcp-sample-management" "mcp-nanopore-domain" "nanopore-app")
    
    for deployment in "${deployments[@]}"; do
        if ! check_deployment_health "$deployment"; then
            all_healthy=false
        fi
    done
    
    # Check services
    print_status "Checking services..."
    local services=$(oc get services -n ${NAMESPACE} --no-headers | wc -l)
    print_status "Found ${services} services in namespace ${NAMESPACE}"
    
    # Check routes
    print_status "Checking routes..."
    local routes=$(oc get routes -n ${NAMESPACE} --no-headers 2>/dev/null | wc -l || echo "0")
    if [ "${routes}" -gt "0" ]; then
        print_success "Found ${routes} routes"
        oc get routes -n ${NAMESPACE}
    else
        print_warning "No routes found"
    fi
    
    if [ "$all_healthy" = true ]; then
        print_success "All deployments are healthy"
        return 0
    else
        print_error "Some deployments are not healthy"
        return 1
    fi
}

# Function to show deployment status
show_status() {
    print_status "Current deployment status:"
    echo
    
    print_status "Pods:"
    oc get pods -n ${NAMESPACE} -o wide
    echo
    
    print_status "Services:"
    oc get services -n ${NAMESPACE}
    echo
    
    print_status "Routes:"
    oc get routes -n ${NAMESPACE} 2>/dev/null || echo "No routes found"
    echo
    
    print_status "Persistent Volume Claims:"
    oc get pvc -n ${NAMESPACE}
    echo
}

# Function to cleanup deployment
cleanup() {
    print_warning "Cleaning up deployment..."
    
    if oc get namespace ${NAMESPACE} >/dev/null 2>&1; then
        print_status "Deleting namespace ${NAMESPACE}..."
        oc delete namespace ${NAMESPACE}
        
        # Wait for namespace to be deleted
        while oc get namespace ${NAMESPACE} >/dev/null 2>&1; do
            print_status "Waiting for namespace to be deleted..."
            sleep 5
        done
        
        print_success "Namespace ${NAMESPACE} deleted successfully"
    else
        print_warning "Namespace ${NAMESPACE} does not exist"
    fi
}

# Function to show logs
show_logs() {
    local component=${1:-"all"}
    
    case $component in
        "app"|"nanopore-app")
            print_status "Showing logs for main application..."
            oc logs -f deployment/nanopore-app -n ${NAMESPACE}
            ;;
        "mcp-sample"|"sample-management")
            print_status "Showing logs for Sample Management MCP Server..."
            oc logs -f deployment/mcp-sample-management -n ${NAMESPACE}
            ;;
        "mcp-domain"|"nanopore-domain")
            print_status "Showing logs for Nanopore Domain MCP Server..."
            oc logs -f deployment/mcp-nanopore-domain -n ${NAMESPACE}
            ;;
        "db"|"postgresql")
            print_status "Showing logs for PostgreSQL..."
            oc logs -f deployment/postgresql -n ${NAMESPACE}
            ;;
        "all")
            print_status "Showing logs for all components..."
            oc logs -f deployment/nanopore-app -n ${NAMESPACE} &
            oc logs -f deployment/mcp-sample-management -n ${NAMESPACE} &
            oc logs -f deployment/mcp-nanopore-domain -n ${NAMESPACE} &
            wait
            ;;
        *)
            print_error "Unknown component: $component"
            print_status "Available components: app, mcp-sample, mcp-domain, db, all"
            exit 1
            ;;
    esac
}

# Main deployment function
deploy() {
    print_status "Starting MCP-Enhanced Nanopore Tracking Application deployment..."
    
    # Check prerequisites
    if ! command_exists oc; then
        print_error "OpenShift CLI (oc) is not installed or not in PATH"
        exit 1
    fi
    
    # Check if logged in to OpenShift
    if ! oc whoami >/dev/null 2>&1; then
        print_error "Not logged in to OpenShift. Please run 'oc login' first."
        exit 1
    fi
    
    print_status "Deploying to OpenShift cluster: $(oc whoami --show-server)"
    print_status "Logged in as: $(oc whoami)"
    
    # Apply ConfigMaps first
    print_status "Applying ConfigMaps..."
    if [ -f "${OPENSHIFT_DIR}/mcp-configmaps.yaml" ]; then
        oc apply -f "${OPENSHIFT_DIR}/mcp-configmaps.yaml"
        print_success "ConfigMaps applied"
    else
        print_error "ConfigMaps file not found: ${OPENSHIFT_DIR}/mcp-configmaps.yaml"
        exit 1
    fi
    
    # Apply main deployment
    print_status "Applying main deployment configuration..."
    if [ -f "${OPENSHIFT_DIR}/mcp-enhanced-deployment.yaml" ]; then
        oc apply -f "${OPENSHIFT_DIR}/mcp-enhanced-deployment.yaml"
        print_success "Main deployment configuration applied"
    else
        print_error "Main deployment file not found: ${OPENSHIFT_DIR}/mcp-enhanced-deployment.yaml"
        exit 1
    fi
    
    # Wait for namespace to be created
    print_status "Waiting for namespace to be ready..."
    while ! oc get namespace ${NAMESPACE} >/dev/null 2>&1; do
        sleep 2
    done
    print_success "Namespace ${NAMESPACE} is ready"
    
    # Setup database
    setup_database
    
    # Deploy MCP servers
    deploy_mcp_servers
    
    # Deploy main application
    deploy_main_app
    
    # Verify deployment
    if verify_deployment; then
        print_success "Deployment completed successfully!"
        echo
        show_status
        
        # Show access information
        local route_host=$(oc get route nanopore-app-route -n ${NAMESPACE} -o jsonpath='{.spec.host}' 2>/dev/null || echo "No route found")
        if [ "$route_host" != "No route found" ]; then
            print_success "Application is accessible at: https://${route_host}"
        else
            print_warning "No external route found. Use port-forwarding to access the application:"
            print_status "oc port-forward service/nanopore-app 3001:3001 -n ${NAMESPACE}"
        fi
    else
        print_error "Deployment verification failed"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "MCP-Enhanced Nanopore Tracking Application Deployment Script"
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  deploy      Deploy the application (default)"
    echo "  status      Show current deployment status"
    echo "  cleanup     Remove the deployment"
    echo "  logs [COMPONENT]  Show logs for a component (app, mcp-sample, mcp-domain, db, all)"
    echo "  help        Show this help message"
    echo
    echo "Examples:"
    echo "  $0 deploy           # Deploy the application"
    echo "  $0 status           # Show deployment status"
    echo "  $0 logs app         # Show application logs"
    echo "  $0 logs all         # Show all logs"
    echo "  $0 cleanup          # Remove the deployment"
    echo
}

# Main script logic
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "status")
        show_status
        ;;
    "cleanup")
        cleanup
        ;;
    "logs")
        show_logs "${2:-all}"
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac 
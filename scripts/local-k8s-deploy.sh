#!/bin/bash

# Local Kubernetes deployment script for nanopore tracking app

set -e

NAMESPACE="nanopore-local"

# Function to print colored output
print_status() {
    echo -e "\033[1;32m[INFO]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
}

# Function to check if we're using the correct context
check_context() {
    local current_context=$(kubectl config current-context)
    if [[ "$current_context" != "orbstack" ]]; then
        print_warning "Current context is '$current_context', not 'orbstack'"
        read -p "Do you want to switch to 'orbstack' context? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kubectl config use-context orbstack
        else
            print_error "Please switch to 'orbstack' context manually"
            exit 1
        fi
    fi
}

# Function to build Docker images
build_images() {
    print_status "Building Docker images..."
    
    # Build frontend image (from root directory)
    print_status "Building frontend image..."
    docker build -t nanopore-frontend:local .
    
    # Build submission service image
    print_status "Building submission service image..."
    cd services/submission-service
    docker build -t submission-service:local .
    cd ../..
    
    print_status "Docker images built successfully"
}

# Function to deploy to Kubernetes
deploy() {
    print_status "Deploying to Kubernetes..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy services
    kubectl apply -f deployment/local-k8s/namespace.yaml
    kubectl apply -f deployment/local-k8s/postgresql.yaml
    kubectl apply -f deployment/local-k8s/submission-service.yaml
    kubectl apply -f deployment/local-k8s/frontend.yaml
    
    print_status "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=120s
    kubectl wait --for=condition=ready pod -l app=submission-service -n $NAMESPACE --timeout=120s
    kubectl wait --for=condition=ready pod -l app=nanopore-frontend -n $NAMESPACE --timeout=120s
    
    print_status "All pods are ready"
}

# Function to setup port forwarding
setup_port_forwarding() {
    print_status "Setting up port forwarding..."
    
    # Kill existing port forwarding processes
    pkill -f "port-forward.*nanopore-local" 2>/dev/null || true
    
    # Start port forwarding
    kubectl port-forward -n $NAMESPACE svc/nanopore-frontend 3001:3001 &
    kubectl port-forward -n $NAMESPACE svc/submission-service 8000:8000 &
    
    sleep 3
    
    print_status "Port forwarding setup complete"
    print_status "Frontend Dashboard: http://localhost:3001/"
    print_status "Frontend Submissions: http://localhost:3001/submissions"
    print_status "Submission Service: http://localhost:8000/api/v1/health"
    print_status "PDF Processing: http://localhost:8000/api/v1/process-pdf"
    print_status "API Documentation: http://localhost:8000/docs"
}

# Function to test services
test_services() {
    print_status "Testing services..."
    
    # Test submission service
    if curl -s http://localhost:8000/api/v1/health > /dev/null; then
        print_status "✓ Submission service is healthy"
    else
        print_error "✗ Submission service is not responding"
    fi
    
    # Test frontend dashboard
    if curl -s -I http://localhost:3001/ | grep -q "200\|HTTP"; then
        print_status "✓ Frontend dashboard is responding"
    else
        print_error "✗ Frontend dashboard is not responding"
    fi
    
    # Test frontend submissions page
    if curl -s -I http://localhost:3001/submissions | grep -q "200\|HTTP"; then
        print_status "✓ Frontend submissions page is responding"
    else
        print_error "✗ Frontend submissions page is not responding"
    fi
}

# Function to show status
show_status() {
    print_status "Deployment Status:"
    kubectl get pods -n $NAMESPACE
    echo
    print_status "Services:"
    kubectl get svc -n $NAMESPACE
    echo
    print_status "Port Forwarding:"
    ps aux | grep port-forward | grep -v grep || echo "No port forwarding processes found"
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Kill port forwarding processes
    pkill -f "port-forward.*nanopore-local" 2>/dev/null || true
    
    # Delete namespace (this will delete all resources)
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    
    print_status "Cleanup complete"
}

# Main script logic
case "${1:-deploy}" in
    "build")
        check_kubectl
        check_context
        build_images
        ;;
    "deploy")
        check_kubectl
        check_context
        build_images
        deploy
        setup_port_forwarding
        test_services
        ;;
    "status")
        check_kubectl
        show_status
        ;;
    "test")
        test_services
        ;;
    "port-forward")
        check_kubectl
        setup_port_forwarding
        ;;
    "cleanup")
        check_kubectl
        cleanup
        ;;
    *)
        echo "Usage: $0 {build|deploy|status|test|port-forward|cleanup}"
        echo "  build        - Build Docker images only"
        echo "  deploy       - Build images and deploy to Kubernetes (default)"
        echo "  status       - Show deployment status"
        echo "  test         - Test service endpoints"
        echo "  port-forward - Setup port forwarding only"
        echo "  cleanup      - Remove all resources"
        exit 1
        ;;
esac 
#!/bin/bash

# DNS Resolution Fix Script for OpenShift
# This script diagnoses and fixes common DNS resolution issues

set -e

echo "🔍 Diagnosing DNS Resolution Issues..."

# Function to check DNS resolution
check_dns_resolution() {
    local service_name=$1
    local namespace=${2:-$(kubectl config view --minify -o jsonpath='{..namespace}')}
    
    echo "Checking DNS resolution for $service_name in namespace $namespace..."
    
    # Get a running pod to test from
    local test_pod=$(kubectl get pods -l app=nanopore-tracking-app -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$test_pod" ]; then
        echo "❌ No running pods found to test DNS resolution"
        return 1
    fi
    
    echo "Testing DNS resolution from pod: $test_pod"
    
    # Test different DNS formats
    local dns_formats=(
        "$service_name"
        "$service_name.$namespace"
        "$service_name.$namespace.svc"
        "$service_name.$namespace.svc.cluster.local"
    )
    
    for dns_format in "${dns_formats[@]}"; do
        echo "Testing: $dns_format"
        if kubectl exec $test_pod -- nslookup $dns_format 2>/dev/null; then
            echo "✅ DNS resolution successful for: $dns_format"
            return 0
        else
            echo "❌ DNS resolution failed for: $dns_format"
        fi
    done
    
    return 1
}

# Function to fix DNS configuration
fix_dns_config() {
    echo "🔧 Applying DNS configuration fixes..."
    
    # Update main application deployment with proper DNS config
    kubectl patch deployment nanopore-tracking-app -p '{
        "spec": {
            "template": {
                "spec": {
                    "dnsPolicy": "ClusterFirst",
                    "dnsConfig": {
                        "options": [
                            {"name": "ndots", "value": "2"},
                            {"name": "edns0"}
                        ]
                    }
                }
            }
        }
    }'
    
    # Update submission service deployment with proper DNS config
    kubectl patch deployment submission-service -p '{
        "spec": {
            "template": {
                "spec": {
                    "dnsPolicy": "ClusterFirst",
                    "dnsConfig": {
                        "options": [
                            {"name": "ndots", "value": "2"},
                            {"name": "edns0"}
                        ]
                    }
                }
            }
        }
    }'
    
    echo "✅ DNS configuration applied to deployments"
}

# Function to verify service configuration
verify_service_config() {
    echo "🔍 Verifying service configuration..."
    
    # Check if submission service exists
    if ! kubectl get service submission-service >/dev/null 2>&1; then
        echo "❌ submission-service not found"
        return 1
    fi
    
    # Get service details
    local service_ip=$(kubectl get service submission-service -o jsonpath='{.spec.clusterIP}')
    local service_port=$(kubectl get service submission-service -o jsonpath='{.spec.ports[0].port}')
    
    echo "Service IP: $service_ip"
    echo "Service Port: $service_port"
    
    # Check if service has endpoints
    local endpoints=$(kubectl get endpoints submission-service -o jsonpath='{.subsets[0].addresses[*].ip}')
    if [ -z "$endpoints" ]; then
        echo "❌ No endpoints found for submission-service"
        return 1
    fi
    
    echo "Service endpoints: $endpoints"
    echo "✅ Service configuration verified"
    return 0
}

# Function to test service connectivity
test_service_connectivity() {
    echo "🔍 Testing service connectivity..."
    
    local service_ip=$(kubectl get service submission-service -o jsonpath='{.spec.clusterIP}')
    local test_pod=$(kubectl get pods -l app=nanopore-tracking-app -o jsonpath='{.items[0].metadata.name}')
    
    if [ -z "$test_pod" ]; then
        echo "❌ No running pods found to test connectivity"
        return 1
    fi
    
    # Test direct IP connection
    echo "Testing direct IP connection to $service_ip:8000..."
    if kubectl exec $test_pod -- timeout 5 sh -c "echo > /dev/tcp/$service_ip/8000" 2>/dev/null; then
        echo "✅ Direct IP connection successful"
    else
        echo "❌ Direct IP connection failed"
    fi
    
    # Test service name connection
    echo "Testing service name connection..."
    if kubectl exec $test_pod -- timeout 5 sh -c "echo > /dev/tcp/submission-service/8000" 2>/dev/null; then
        echo "✅ Service name connection successful"
    else
        echo "❌ Service name connection failed"
    fi
}

# Function to restart DNS components
restart_dns_components() {
    echo "🔄 Restarting DNS components..."
    
    # Restart CoreDNS pods (if accessible)
    if kubectl get pods -n kube-system -l k8s-app=kube-dns >/dev/null 2>&1; then
        kubectl delete pods -n kube-system -l k8s-app=kube-dns
        echo "✅ CoreDNS pods restarted"
    else
        echo "ℹ️  CoreDNS pods not accessible (normal in managed clusters)"
    fi
    
    # Restart application pods to pick up new DNS config
    kubectl rollout restart deployment/nanopore-tracking-app
    kubectl rollout restart deployment/submission-service
    
    echo "✅ Application deployments restarted"
}

# Main execution
main() {
    echo "🚀 Starting DNS Resolution Fix Process..."
    
    # Check current status
    echo "Current namespace: $(kubectl config view --minify -o jsonpath='{..namespace}')"
    
    # Verify service configuration
    if ! verify_service_config; then
        echo "❌ Service configuration issues found"
        exit 1
    fi
    
    # Test current DNS resolution
    if check_dns_resolution "submission-service"; then
        echo "✅ DNS resolution is working correctly"
        test_service_connectivity
        exit 0
    fi
    
    # Apply fixes
    fix_dns_config
    
    # Restart components
    restart_dns_components
    
    # Wait for rollout to complete
    echo "⏳ Waiting for deployments to restart..."
    kubectl rollout status deployment/nanopore-tracking-app --timeout=300s
    kubectl rollout status deployment/submission-service --timeout=300s
    
    # Test again
    sleep 30
    if check_dns_resolution "submission-service"; then
        echo "✅ DNS resolution fixed successfully!"
        test_service_connectivity
    else
        echo "❌ DNS resolution still failing. Manual intervention required."
        echo "Please check:"
        echo "1. Network policies"
        echo "2. Service mesh configuration"
        echo "3. OpenShift DNS operator status"
        exit 1
    fi
}

# Run main function
main "$@" 
#!/bin/bash

# MCP-Enhanced Nanopore Tracking Application - Deployment Validation Script
# This script validates the deployment configuration before applying to OpenShift

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
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

# Function to validate YAML syntax
validate_yaml() {
    local file=$1
    
    if [ ! -f "$file" ]; then
        print_error "File not found: $file"
        return 1
    fi
    
    print_status "Validating YAML syntax: $(basename $file)"
    
    if command_exists yq; then
        if yq eval '.' "$file" >/dev/null 2>&1; then
            print_success "YAML syntax is valid"
            return 0
        else
            print_error "YAML syntax is invalid"
            return 1
        fi
    elif command_exists python3; then
        if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
            print_success "YAML syntax is valid"
            return 0
        else
            print_error "YAML syntax is invalid"
            return 1
        fi
    else
        print_warning "No YAML validator found (yq or python3). Skipping syntax validation."
        return 0
    fi
}

# Function to validate Kubernetes resources
validate_k8s_resources() {
    local file=$1
    
    print_status "Validating Kubernetes resources: $(basename $file)"
    
    if command_exists oc; then
        if oc apply --dry-run=client -f "$file" >/dev/null 2>&1; then
            print_success "Kubernetes resources are valid"
            return 0
        else
            print_error "Kubernetes resources validation failed"
            oc apply --dry-run=client -f "$file" 2>&1 | head -10
            return 1
        fi
    else
        print_warning "OpenShift CLI (oc) not found. Skipping Kubernetes validation."
        return 0
    fi
}

# Function to check resource requirements
validate_resource_requirements() {
    local file=$1
    
    print_status "Checking resource requirements: $(basename $file)"
    
    local total_cpu_requests=0
    local total_memory_requests=0
    local total_storage_requests=0
    
    # Extract resource requests (simplified parsing)
    if command_exists yq; then
        # CPU requests
        local cpu_requests=$(yq eval '.spec.template.spec.containers[].resources.requests.cpu // "0"' "$file" 2>/dev/null | grep -v "null" | sed 's/m$//' | awk '{sum += $1} END {print sum}')
        total_cpu_requests=${cpu_requests:-0}
        
        # Memory requests
        local memory_requests=$(yq eval '.spec.template.spec.containers[].resources.requests.memory // "0"' "$file" 2>/dev/null | grep -v "null" | sed 's/Mi$//' | awk '{sum += $1} END {print sum}')
        total_memory_requests=${memory_requests:-0}
        
        # Storage requests
        local storage_requests=$(yq eval '.spec.resources.requests.storage // "0"' "$file" 2>/dev/null | grep -v "null" | sed 's/Gi$//' | awk '{sum += $1} END {print sum}')
        total_storage_requests=${storage_requests:-0}
    fi
    
    print_status "Estimated resource requirements:"
    print_status "  CPU: ${total_cpu_requests}m"
    print_status "  Memory: ${total_memory_requests}Mi"
    print_status "  Storage: ${total_storage_requests}Gi"
    
    # Check against minimum requirements
    if [ "$total_cpu_requests" -gt 4000 ]; then
        print_warning "CPU requests (${total_cpu_requests}m) exceed recommended minimum (4000m)"
    fi
    
    if [ "$total_memory_requests" -gt 8192 ]; then
        print_warning "Memory requests (${total_memory_requests}Mi) exceed recommended minimum (8192Mi)"
    fi
    
    if [ "$total_storage_requests" -gt 50 ]; then
        print_warning "Storage requests (${total_storage_requests}Gi) exceed recommended minimum (50Gi)"
    fi
    
    print_success "Resource requirements check completed"
}

# Function to validate MCP server configuration
validate_mcp_configuration() {
    print_status "Validating MCP server configuration..."
    
    local configmap_file="${OPENSHIFT_DIR}/mcp-configmaps.yaml"
    
    if [ ! -f "$configmap_file" ]; then
        print_error "MCP ConfigMaps file not found: $configmap_file"
        return 1
    fi
    
    # Check for required MCP server code
    local required_files=("package.json" "tsconfig.json" "index.ts")
    
    for server in "mcp-sample-management-code" "mcp-nanopore-domain-code"; do
        print_status "Checking $server configuration..."
        
        for file in "${required_files[@]}"; do
            if grep -q "^  $file:" "$configmap_file"; then
                print_success "Found $file in $server"
            else
                print_error "Missing $file in $server"
                return 1
            fi
        done
    done
    
    print_success "MCP server configuration is valid"
}

# Function to validate network configuration
validate_network_configuration() {
    local file=$1
    
    print_status "Validating network configuration..."
    
    # Check for required services
    local required_services=("postgresql" "mcp-sample-management" "mcp-nanopore-domain" "nanopore-app")
    
    for service in "${required_services[@]}"; do
        if grep -q "name: $service" "$file"; then
            print_success "Found service: $service"
        else
            print_error "Missing service: $service"
            return 1
        fi
    done
    
    # Check for routes
    if grep -q "kind: Route" "$file"; then
        print_success "Found external route configuration"
    else
        print_warning "No external routes found. Application will only be accessible internally."
    fi
    
    # Check for network policies
    if grep -q "kind: NetworkPolicy" "$file"; then
        print_success "Found network policy configuration"
    else
        print_warning "No network policies found. Consider adding for security."
    fi
    
    print_success "Network configuration validation completed"
}

# Function to validate security configuration
validate_security_configuration() {
    local file=$1
    
    print_status "Validating security configuration..."
    
    # Check for secrets
    if grep -q "kind: Secret" "$file"; then
        print_success "Found secret configuration"
    else
        print_error "No secrets found. Database credentials and other sensitive data should be in secrets."
        return 1
    fi
    
    # Check for security contexts
    if grep -q "securityContext" "$file"; then
        print_success "Found security context configuration"
    else
        print_warning "No security contexts found. Consider adding for better security."
    fi
    
    # Check for resource limits
    if grep -q "limits:" "$file"; then
        print_success "Found resource limits"
    else
        print_warning "No resource limits found. Consider adding to prevent resource exhaustion."
    fi
    
    print_success "Security configuration validation completed"
}

# Function to validate persistence configuration
validate_persistence_configuration() {
    local file=$1
    
    print_status "Validating persistence configuration..."
    
    # Check for PVCs
    if grep -q "kind: PersistentVolumeClaim" "$file"; then
        print_success "Found persistent volume claims"
    else
        print_error "No persistent volume claims found. Database and uploads need persistent storage."
        return 1
    fi
    
    # Check for volume mounts
    if grep -q "volumeMounts:" "$file"; then
        print_success "Found volume mounts"
    else
        print_error "No volume mounts found. Persistent volumes need to be mounted."
        return 1
    fi
    
    print_success "Persistence configuration validation completed"
}

# Function to validate monitoring configuration
validate_monitoring_configuration() {
    local file=$1
    
    print_status "Validating monitoring configuration..."
    
    # Check for ServiceMonitor
    if grep -q "kind: ServiceMonitor" "$file"; then
        print_success "Found ServiceMonitor for Prometheus integration"
    else
        print_warning "No ServiceMonitor found. Monitoring may not work properly."
    fi
    
    # Check for health check endpoints
    if grep -q "readinessProbe:" "$file" && grep -q "livenessProbe:" "$file"; then
        print_success "Found health check probes"
    else
        print_warning "Missing health check probes. Consider adding for better reliability."
    fi
    
    print_success "Monitoring configuration validation completed"
}

# Function to validate autoscaling configuration
validate_autoscaling_configuration() {
    local file=$1
    
    print_status "Validating autoscaling configuration..."
    
    # Check for HPA
    if grep -q "kind: HorizontalPodAutoscaler" "$file"; then
        print_success "Found HorizontalPodAutoscaler configuration"
    else
        print_warning "No HPA found. Application will not scale automatically."
    fi
    
    # Check for PDB
    if grep -q "kind: PodDisruptionBudget" "$file"; then
        print_success "Found PodDisruptionBudget configuration"
    else
        print_warning "No PDB found. Consider adding for better availability during updates."
    fi
    
    print_success "Autoscaling configuration validation completed"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local all_good=true
    
    # Check for required commands
    local required_commands=("oc")
    local optional_commands=("yq" "python3")
    
    for cmd in "${required_commands[@]}"; do
        if command_exists "$cmd"; then
            print_success "$cmd is available"
        else
            print_error "$cmd is required but not found"
            all_good=false
        fi
    done
    
    for cmd in "${optional_commands[@]}"; do
        if command_exists "$cmd"; then
            print_success "$cmd is available"
        else
            print_warning "$cmd is recommended but not found"
        fi
    done
    
    # Check OpenShift connection
    if command_exists oc; then
        if oc whoami >/dev/null 2>&1; then
            print_success "Connected to OpenShift cluster: $(oc whoami --show-server)"
            print_status "Logged in as: $(oc whoami)"
        else
            print_warning "Not logged in to OpenShift. Some validations will be skipped."
        fi
    fi
    
    if [ "$all_good" = true ]; then
        print_success "Prerequisites check passed"
        return 0
    else
        print_error "Prerequisites check failed"
        return 1
    fi
}

# Function to generate validation report
generate_report() {
    local validation_results=("$@")
    local passed=0
    local failed=0
    local warnings=0
    
    print_status "Validation Report:"
    echo "===================="
    
    for result in "${validation_results[@]}"; do
        case $result in
            "PASS:"*)
                echo -e "${GREEN}✓${NC} ${result#PASS:}"
                ((passed++))
                ;;
            "FAIL:"*)
                echo -e "${RED}✗${NC} ${result#FAIL:}"
                ((failed++))
                ;;
            "WARN:"*)
                echo -e "${YELLOW}⚠${NC} ${result#WARN:}"
                ((warnings++))
                ;;
        esac
    done
    
    echo "===================="
    print_status "Summary: $passed passed, $failed failed, $warnings warnings"
    
    if [ $failed -eq 0 ]; then
        print_success "Validation completed successfully!"
        if [ $warnings -gt 0 ]; then
            print_warning "There are $warnings warnings. Review them before deployment."
        fi
        return 0
    else
        print_error "Validation failed with $failed errors. Fix them before deployment."
        return 1
    fi
}

# Main validation function
validate_deployment() {
    print_status "Starting deployment validation..."
    
    local validation_results=()
    local main_deployment="${OPENSHIFT_DIR}/mcp-enhanced-deployment.yaml"
    local configmaps="${OPENSHIFT_DIR}/mcp-configmaps.yaml"
    
    # Check if files exist
    if [ ! -f "$main_deployment" ]; then
        print_error "Main deployment file not found: $main_deployment"
        exit 1
    fi
    
    if [ ! -f "$configmaps" ]; then
        print_error "ConfigMaps file not found: $configmaps"
        exit 1
    fi
    
    # Run validations
    if check_prerequisites; then
        validation_results+=("PASS: Prerequisites check")
    else
        validation_results+=("FAIL: Prerequisites check")
    fi
    
    if validate_yaml "$main_deployment"; then
        validation_results+=("PASS: Main deployment YAML syntax")
    else
        validation_results+=("FAIL: Main deployment YAML syntax")
    fi
    
    if validate_yaml "$configmaps"; then
        validation_results+=("PASS: ConfigMaps YAML syntax")
    else
        validation_results+=("FAIL: ConfigMaps YAML syntax")
    fi
    
    if validate_k8s_resources "$main_deployment"; then
        validation_results+=("PASS: Kubernetes resources validation")
    else
        validation_results+=("FAIL: Kubernetes resources validation")
    fi
    
    if validate_mcp_configuration; then
        validation_results+=("PASS: MCP server configuration")
    else
        validation_results+=("FAIL: MCP server configuration")
    fi
    
    if validate_network_configuration "$main_deployment"; then
        validation_results+=("PASS: Network configuration")
    else
        validation_results+=("FAIL: Network configuration")
    fi
    
    if validate_security_configuration "$main_deployment"; then
        validation_results+=("PASS: Security configuration")
    else
        validation_results+=("FAIL: Security configuration")
    fi
    
    if validate_persistence_configuration "$main_deployment"; then
        validation_results+=("PASS: Persistence configuration")
    else
        validation_results+=("FAIL: Persistence configuration")
    fi
    
    if validate_monitoring_configuration "$main_deployment"; then
        validation_results+=("PASS: Monitoring configuration")
    else
        validation_results+=("WARN: Monitoring configuration has issues")
    fi
    
    if validate_autoscaling_configuration "$main_deployment"; then
        validation_results+=("PASS: Autoscaling configuration")
    else
        validation_results+=("WARN: Autoscaling configuration has issues")
    fi
    
    validate_resource_requirements "$main_deployment"
    validation_results+=("PASS: Resource requirements check")
    
    # Generate final report
    generate_report "${validation_results[@]}"
}

# Function to show help
show_help() {
    echo "MCP-Enhanced Nanopore Tracking Application - Deployment Validation Script"
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  validate    Validate deployment configuration (default)"
    echo "  help        Show this help message"
    echo
    echo "This script validates:"
    echo "  • YAML syntax"
    echo "  • Kubernetes resource definitions"
    echo "  • MCP server configuration"
    echo "  • Network configuration"
    echo "  • Security settings"
    echo "  • Persistence configuration"
    echo "  • Monitoring setup"
    echo "  • Autoscaling configuration"
    echo "  • Resource requirements"
    echo
}

# Main script logic
case "${1:-validate}" in
    "validate")
        validate_deployment
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
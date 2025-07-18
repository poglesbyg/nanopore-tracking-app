#!/bin/bash

# Performance Optimization and Resource Monitoring Script
# Monitors system resources and provides optimization recommendations

set -euo pipefail

# Configuration
NAMESPACE="dept-barc"
OPTIMIZATION_DURATION=${OPTIMIZATION_DURATION:-600}  # 10 minutes
SAMPLE_INTERVAL=${SAMPLE_INTERVAL:-15}               # 15 seconds
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="${SCRIPT_DIR}/../reports/performance"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
PERFORMANCE_REPORT="${REPORTS_DIR}/performance-${TIMESTAMP}.json"

# Performance thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
RESPONSE_TIME_THRESHOLD=2000  # milliseconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[PERF-OPT]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PERF-OPT]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[PERF-OPT]${NC} $1"
}

log_error() {
    echo -e "${RED}[PERF-OPT]${NC} $1"
}

# Function to create reports directory
create_reports_dir() {
    mkdir -p "$REPORTS_DIR"
    log_info "Created performance reports directory: $REPORTS_DIR"
}

# Function to get resource usage for a deployment
get_resource_usage() {
    local deployment=$1
    local namespace=$2
    
    # Get pod metrics
    local pod_name=$(oc get pods -l app="$deployment" -n "$namespace" --no-headers | grep Running | head -1 | awk '{print $1}')
    
    if [[ -z "$pod_name" ]]; then
        echo "null"
        return
    fi
    
    # Get CPU and memory usage
    local metrics=$(oc adm top pod "$pod_name" -n "$namespace" --no-headers 2>/dev/null || echo "0m 0Mi")
    local cpu=$(echo "$metrics" | awk '{print $2}' | sed 's/m$//')
    local memory=$(echo "$metrics" | awk '{print $3}' | sed 's/Mi$//')
    
    # Get resource limits
    local limits=$(oc get pod "$pod_name" -n "$namespace" -o jsonpath='{.spec.containers[0].resources.limits}' 2>/dev/null || echo '{}')
    local cpu_limit=$(echo "$limits" | jq -r '.cpu // "500m"' | sed 's/m$//')
    local memory_limit=$(echo "$limits" | jq -r '.memory // "512Mi"' | sed 's/Mi$//')
    
    # Calculate usage percentages
    local cpu_percentage=0
    local memory_percentage=0
    
    [[ $cpu_limit -gt 0 ]] && cpu_percentage=$((cpu * 100 / cpu_limit))
    [[ $memory_limit -gt 0 ]] && memory_percentage=$((memory * 100 / memory_limit))
    
    cat << EOF
{
  "pod_name": "$pod_name",
  "cpu_usage": $cpu,
  "memory_usage": $memory,
  "cpu_limit": $cpu_limit,
  "memory_limit": $memory_limit,
  "cpu_percentage": $cpu_percentage,
  "memory_percentage": $memory_percentage
}
EOF
}

# Function to test response times
test_response_times() {
    local service_name=$1
    local namespace=$2
    local endpoint=${3:-"/health"}
    
    # Get service IP
    local service_ip=$(oc get service "$service_name" -n "$namespace" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
    
    if [[ -z "$service_ip" ]]; then
        echo "null"
        return
    fi
    
    # Test response time from within cluster
    local pod_name=$(oc get pods -l app=nanopore-tracking-app -n "$namespace" --no-headers | head -1 | awk '{print $1}')
    
    if [[ -z "$pod_name" ]]; then
        echo "null"
        return
    fi
    
    local response_time=$(oc exec "$pod_name" -n "$namespace" -- sh -c "
        time_start=\$(date +%s%3N)
        if wget -q -O /dev/null --timeout=10 http://$service_ip$endpoint 2>/dev/null; then
            time_end=\$(date +%s%3N)
            echo \$((time_end - time_start))
        else
            echo -1
        fi
    " 2>/dev/null || echo "-1")
    
    cat << EOF
{
  "service_name": "$service_name",
  "endpoint": "$endpoint",
  "response_time_ms": $response_time,
  "status": "$([ $response_time -gt 0 ] && echo "success" || echo "failed")"
}
EOF
}

# Function to collect comprehensive metrics
collect_metrics() {
    log_info "Collecting performance metrics..."
    
    local metrics_file="/tmp/performance-metrics-${TIMESTAMP}.json"
    
    # Initialize metrics structure
    cat > "$metrics_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "namespace": "$NAMESPACE",
  "deployments": {},
  "response_times": {},
  "cluster_resources": {}
}
EOF
    
    # Get deployments
    local deployments=$(oc get deployments -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for deployment in $deployments; do
        log_info "Collecting metrics for deployment: $deployment"
        
        local usage=$(get_resource_usage "$deployment" "$NAMESPACE")
        
        # Add to metrics file
        jq --arg dep "$deployment" --argjson usage "$usage" \
           '.deployments[$dep] = $usage' "$metrics_file" > "${metrics_file}.tmp" && mv "${metrics_file}.tmp" "$metrics_file"
    done
    
    # Test response times for key services
    local services=("nanopore-tracking-service" "python-gateway" "sample-service-optimized")
    
    for service in "${services[@]}"; do
        if oc get service "$service" -n "$NAMESPACE" >/dev/null 2>&1; then
            log_info "Testing response time for service: $service"
            
            local response_time=$(test_response_times "$service" "$NAMESPACE")
            
            if [[ "$response_time" != "null" ]]; then
                jq --arg svc "$service" --argjson rt "$response_time" \
                   '.response_times[$svc] = $rt' "$metrics_file" > "${metrics_file}.tmp" && mv "${metrics_file}.tmp" "$metrics_file"
            fi
        fi
    done
    
    # Get cluster-level resource usage
    local cluster_cpu=$(oc adm top nodes --no-headers 2>/dev/null | awk '{sum+=$3} END {print sum}' || echo "0")
    local cluster_memory=$(oc adm top nodes --no-headers 2>/dev/null | awk '{sum+=$5} END {print sum}' || echo "0")
    
    jq --argjson cpu "$cluster_cpu" --argjson memory "$cluster_memory" \
       '.cluster_resources = {"cpu_usage": $cpu, "memory_usage": $memory}' "$metrics_file" > "${metrics_file}.tmp" && mv "${metrics_file}.tmp" "$metrics_file"
    
    echo "$metrics_file"
}

# Function to analyze performance and generate recommendations
analyze_performance() {
    local metrics_file=$1
    
    log_info "Analyzing performance metrics..."
    
    local recommendations=()
    local critical_issues=()
    local warnings=()
    
    # Analyze each deployment
    for deployment in $(jq -r '.deployments | keys[]' "$metrics_file"); do
        local cpu_percentage=$(jq -r ".deployments.\"$deployment\".cpu_percentage" "$metrics_file")
        local memory_percentage=$(jq -r ".deployments.\"$deployment\".memory_percentage" "$metrics_file")
        
        # Check CPU usage
        if [[ $cpu_percentage -gt $CPU_THRESHOLD ]]; then
            critical_issues+=("High CPU usage in $deployment: ${cpu_percentage}%")
            recommendations+=("Scale up $deployment or increase CPU limits")
        fi
        
        # Check memory usage
        if [[ $memory_percentage -gt $MEMORY_THRESHOLD ]]; then
            critical_issues+=("High memory usage in $deployment: ${memory_percentage}%")
            recommendations+=("Increase memory limits for $deployment")
        fi
        
        # Check for underutilization
        if [[ $cpu_percentage -lt 20 && $memory_percentage -lt 20 ]]; then
            warnings+=("Low resource utilization in $deployment")
            recommendations+=("Consider reducing resource requests for $deployment")
        fi
    done
    
    # Analyze response times
    for service in $(jq -r '.response_times | keys[]' "$metrics_file"); do
        local response_time=$(jq -r ".response_times.\"$service\".response_time_ms" "$metrics_file")
        
        if [[ $response_time -gt $RESPONSE_TIME_THRESHOLD ]]; then
            critical_issues+=("Slow response time for $service: ${response_time}ms")
            recommendations+=("Optimize $service performance or scale horizontally")
        fi
    done
    
    # Generate recommendations JSON
    local recommendations_json=$(printf '%s\n' "${recommendations[@]}" | jq -R . | jq -s .)
    local critical_json=$(printf '%s\n' "${critical_issues[@]}" | jq -R . | jq -s .)
    local warnings_json=$(printf '%s\n' "${warnings[@]}" | jq -R . | jq -s .)
    
    # Add analysis to metrics file
    jq --argjson rec "$recommendations_json" \
       --argjson crit "$critical_json" \
       --argjson warn "$warnings_json" \
       '.analysis = {
         "recommendations": $rec,
         "critical_issues": $crit,
         "warnings": $warn,
         "overall_health": (if ($crit | length) > 0 then "CRITICAL" elif ($warn | length) > 0 then "WARNING" else "HEALTHY" end)
       }' "$metrics_file" > "${metrics_file}.tmp" && mv "${metrics_file}.tmp" "$metrics_file"
}

# Function to apply automatic optimizations
apply_optimizations() {
    local metrics_file=$1
    
    log_info "Applying automatic optimizations..."
    
    local optimizations_applied=()
    
    # Check for deployments that need scaling
    for deployment in $(jq -r '.deployments | keys[]' "$metrics_file"); do
        local cpu_percentage=$(jq -r ".deployments.\"$deployment\".cpu_percentage" "$metrics_file")
        local memory_percentage=$(jq -r ".deployments.\"$deployment\".memory_percentage" "$metrics_file")
        
        # Auto-scale if CPU usage is high
        if [[ $cpu_percentage -gt 90 ]]; then
            local current_replicas=$(oc get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
            local new_replicas=$((current_replicas + 1))
            
            if [[ $new_replicas -le 5 ]]; then  # Don't scale beyond 5 replicas
                log_info "Auto-scaling $deployment from $current_replicas to $new_replicas replicas"
                
                if oc scale deployment "$deployment" --replicas="$new_replicas" -n "$NAMESPACE"; then
                    optimizations_applied+=("Scaled $deployment to $new_replicas replicas due to high CPU usage")
                fi
            fi
        fi
    done
    
    # Add optimizations to metrics file
    local optimizations_json=$(printf '%s\n' "${optimizations_applied[@]}" | jq -R . | jq -s .)
    
    jq --argjson opt "$optimizations_json" \
       '.optimizations_applied = $opt' "$metrics_file" > "${metrics_file}.tmp" && mv "${metrics_file}.tmp" "$metrics_file"
}

# Function to generate performance report
generate_performance_report() {
    local metrics_file=$1
    
    log_info "Generating performance report..."
    
    # Copy metrics to final report location
    cp "$metrics_file" "$PERFORMANCE_REPORT"
    
    log_success "Performance report generated: $PERFORMANCE_REPORT"
}

# Function to display performance summary
display_performance_summary() {
    log_info "=== Performance Optimization Summary ==="
    
    if [[ -f "$PERFORMANCE_REPORT" ]]; then
        local health=$(jq -r '.analysis.overall_health' "$PERFORMANCE_REPORT")
        local critical_count=$(jq -r '.analysis.critical_issues | length' "$PERFORMANCE_REPORT")
        local warning_count=$(jq -r '.analysis.warnings | length' "$PERFORMANCE_REPORT")
        local rec_count=$(jq -r '.analysis.recommendations | length' "$PERFORMANCE_REPORT")
        local opt_count=$(jq -r '.optimizations_applied | length' "$PERFORMANCE_REPORT")
        
        echo "Overall Health: $health"
        echo "Critical Issues: $critical_count"
        echo "Warnings: $warning_count"
        echo "Recommendations: $rec_count"
        echo "Optimizations Applied: $opt_count"
        echo "Report File: $PERFORMANCE_REPORT"
        
        # Display critical issues
        if [[ $critical_count -gt 0 ]]; then
            echo ""
            echo "Critical Issues:"
            jq -r '.analysis.critical_issues[]' "$PERFORMANCE_REPORT" | while read -r issue; do
                echo "  🚨 $issue"
            done
        fi
        
        # Display recommendations
        if [[ $rec_count -gt 0 ]]; then
            echo ""
            echo "Recommendations:"
            jq -r '.analysis.recommendations[]' "$PERFORMANCE_REPORT" | while read -r rec; do
                echo "  💡 $rec"
            done
        fi
        
        # Display applied optimizations
        if [[ $opt_count -gt 0 ]]; then
            echo ""
            echo "Applied Optimizations:"
            jq -r '.optimizations_applied[]' "$PERFORMANCE_REPORT" | while read -r opt; do
                echo "  ✅ $opt"
            done
        fi
    else
        log_error "Performance report not found"
    fi
}

# Function to cleanup old reports
cleanup_old_reports() {
    log_info "Cleaning up old performance reports..."
    
    # Keep only last 20 reports
    find "$REPORTS_DIR" -name "performance-*.json" -type f | sort -r | tail -n +21 | xargs rm -f || true
    
    log_info "Cleanup completed"
}

# Main function
main() {
    log_info "Starting performance optimization and monitoring..."
    
    # Initialize
    create_reports_dir
    
    # Collect metrics
    local metrics_file=$(collect_metrics)
    
    # Analyze performance
    analyze_performance "$metrics_file"
    
    # Apply optimizations
    apply_optimizations "$metrics_file"
    
    # Generate report
    generate_performance_report "$metrics_file"
    
    # Display summary
    display_performance_summary
    
    # Cleanup
    cleanup_old_reports
    
    # Clean up temporary files
    rm -f "$metrics_file"
    
    log_success "Performance optimization completed"
}

# Run main function
main "$@" 
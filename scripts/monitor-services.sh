#!/bin/bash

# Service Monitoring Script
# Monitors DNS resolution, service health, and network connectivity

# Ensure we're using bash 4+ for advanced features
if [[ ${BASH_VERSION%%.*} -lt 4 ]]; then
    echo "⚠️  Warning: This script requires bash 4+. Current version: $BASH_VERSION"
    echo "🔄 Continuing with compatibility mode..."
fi

set -e

NAMESPACE="dept-barc"
LOG_FILE="/tmp/service-monitoring-$(date +%Y%m%d-%H%M%S).log"
DURATION=${1:-3600}  # Default 1 hour
INTERVAL=${2:-30}    # Default 30 seconds

echo "🔍 Starting Service Monitoring..."
echo "📊 Duration: ${DURATION} seconds"
echo "⏱️  Interval: ${INTERVAL} seconds"
echo "📝 Log file: ${LOG_FILE}"

# Initialize log file
cat > "$LOG_FILE" << EOF
Service Monitoring Log - $(date)
Duration: ${DURATION}s, Interval: ${INTERVAL}s
Namespace: ${NAMESPACE}
EOF

# Function to log with timestamp
log_with_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to test DNS resolution
test_dns_resolution() {
    local service_name=$1
    local pod_name=$(oc get pods -l app=nanopore-tracking-app -n "$NAMESPACE" --no-headers | head -1 | awk '{print $1}')
    
    if [[ -z "$pod_name" ]]; then
        log_with_timestamp "❌ No application pods found"
        return 1
    fi
    
    local dns_targets=(
        "$service_name"
        "$service_name.$NAMESPACE"
        "$service_name.$NAMESPACE.svc"
        "$service_name.$NAMESPACE.svc.cluster.local"
    )
    
    local dns_success=0
    for target in "${dns_targets[@]}"; do
        if oc exec "$pod_name" -n "$NAMESPACE" -- nslookup "$target" >/dev/null 2>&1; then
            log_with_timestamp "✅ DNS resolution successful: $target"
            dns_success=1
            break
        else
            log_with_timestamp "❌ DNS resolution failed: $target"
        fi
    done
    
    return $((1 - dns_success))
}

# Function to test service connectivity
test_service_connectivity() {
    local service_name=$1
    local service_ip=$2
    local service_port=$3
    local health_path=$4
    local pod_name=$(oc get pods -l app=nanopore-tracking-app -n "$NAMESPACE" --no-headers | head -1 | awk '{print $1}')
    
    if [[ -z "$pod_name" ]]; then
        log_with_timestamp "❌ No application pods found"
        return 1
    fi
    
    # Test IP connectivity
    if oc exec "$pod_name" -n "$NAMESPACE" -- wget -O- --timeout=5 "http://$service_ip:$service_port$health_path" >/dev/null 2>&1; then
        log_with_timestamp "✅ Service connectivity successful: $service_name ($service_ip:$service_port)"
        return 0
    else
        log_with_timestamp "❌ Service connectivity failed: $service_name ($service_ip:$service_port)"
        return 1
    fi
}

# Function to check pod status
check_pod_status() {
    local app_label=$1
    local pod_info=$(oc get pods -l "app=$app_label" -n "$NAMESPACE" --no-headers 2>/dev/null)
    
    if [[ -z "$pod_info" ]]; then
        log_with_timestamp "❌ No pods found for app: $app_label"
        return 1
    fi
    
    local ready_count=$(echo "$pod_info" | grep -c "Running.*1/1" || echo "0")
    local total_count=$(echo "$pod_info" | wc -l)
    
    log_with_timestamp "📊 Pod status for $app_label: $ready_count/$total_count ready"
    
    if [[ "$ready_count" -gt 0 ]]; then
        return 0
    else
        return 1
    fi
}

# Function to test API endpoints
test_api_endpoints() {
    local pod_name=$(oc get pods -l app=nanopore-tracking-app -n "$NAMESPACE" --no-headers | head -1 | awk '{print $1}')
    
    if [[ -z "$pod_name" ]]; then
        log_with_timestamp "❌ No application pods found"
        return 1
    fi
    
    # Test main application health
    if oc exec "$pod_name" -n "$NAMESPACE" -- wget -O- --timeout=5 "http://localhost:3001/health" >/dev/null 2>&1; then
        log_with_timestamp "✅ Main application health check passed"
    else
        log_with_timestamp "❌ Main application health check failed"
    fi
    
    # Test service health API
    if oc exec "$pod_name" -n "$NAMESPACE" -- wget -O- --timeout=5 "http://localhost:3001/api/service-health" >/dev/null 2>&1; then
        log_with_timestamp "✅ Service health API accessible"
    else
        log_with_timestamp "❌ Service health API failed"
    fi
}

# Function to collect network diagnostics
collect_network_diagnostics() {
    local pod_name=$(oc get pods -l app=nanopore-tracking-app -n "$NAMESPACE" --no-headers | head -1 | awk '{print $1}')
    
    if [[ -z "$pod_name" ]]; then
        log_with_timestamp "❌ No application pods found for diagnostics"
        return 1
    fi
    
    log_with_timestamp "🔍 Collecting network diagnostics..."
    
    # Check DNS resolver
    local dns_config=$(oc exec "$pod_name" -n "$NAMESPACE" -- cat /etc/resolv.conf 2>/dev/null || echo "Failed to read resolv.conf")
    log_with_timestamp "📝 DNS Config: $dns_config"
    
    # Check network interfaces
    local network_info=$(oc exec "$pod_name" -n "$NAMESPACE" -- ip addr show 2>/dev/null || echo "Failed to get network info")
    log_with_timestamp "📝 Network interfaces: $(echo "$network_info" | grep -E 'inet|eth0' | head -2)"
    
    # Check routing
    local route_info=$(oc exec "$pod_name" -n "$NAMESPACE" -- ip route show 2>/dev/null || echo "Failed to get route info")
    log_with_timestamp "📝 Default route: $(echo "$route_info" | grep default | head -1)"
}

# Main monitoring loop
log_with_timestamp "🚀 Starting monitoring loop..."

start_time=$(date +%s)
end_time=$((start_time + DURATION))

# Service definitions (compatible with older bash versions)
SERVICES=(
    "submission-service|172.30.47.35:8000|/api/v1/health"
    "ai-service-optimized|unknown:8001|/health"
)

iteration=0
while [[ $(date +%s) -lt $end_time ]]; do
    iteration=$((iteration + 1))
    log_with_timestamp "🔄 Monitoring iteration $iteration"
    
    # Check pod status
    check_pod_status "nanopore-tracking-app"
    check_pod_status "submission-service"
    check_pod_status "ai-service-optimized"
    
    # Test DNS resolution and connectivity for each service
    for service_entry in "${SERVICES[@]}"; do
        IFS='|' read -r service_name service_endpoint service_path <<< "$service_entry"
        IFS=':' read -r service_ip service_port <<< "$service_endpoint"
        
        log_with_timestamp "🔍 Testing $service_name..."
        
        # Test DNS resolution
        test_dns_resolution "$service_name"
        
        # Test connectivity (if IP is known)
        if [[ "$service_ip" != "unknown" ]]; then
            test_service_connectivity "$service_name" "$service_ip" "$service_port" "$service_path"
        fi
    done
    
    # Test API endpoints
    test_api_endpoints
    
    # Collect network diagnostics every 5 iterations
    if [[ $((iteration % 5)) -eq 0 ]]; then
        collect_network_diagnostics
    fi
    
    # Check if we should continue
    if [[ $(date +%s) -ge $end_time ]]; then
        break
    fi
    
    log_with_timestamp "⏳ Waiting ${INTERVAL}s before next check..."
    sleep "$INTERVAL"
done

# Final summary
log_with_timestamp "📊 Monitoring completed after $iteration iterations"
log_with_timestamp "📝 Full log available at: $LOG_FILE"

# Generate summary report
echo
echo "📋 MONITORING SUMMARY"
echo "===================="
echo "Duration: ${DURATION}s"
echo "Iterations: $iteration"
echo "Log file: $LOG_FILE"
echo
echo "🔍 Key findings:"
grep -E "(✅|❌)" "$LOG_FILE" | tail -10
echo
echo "📊 Service status counts:"
echo "DNS resolution successes: $(grep -c "✅ DNS resolution successful" "$LOG_FILE" || echo "0")"
echo "DNS resolution failures: $(grep -c "❌ DNS resolution failed" "$LOG_FILE" || echo "0")"
echo "Service connectivity successes: $(grep -c "✅ Service connectivity successful" "$LOG_FILE" || echo "0")"
echo "Service connectivity failures: $(grep -c "❌ Service connectivity failed" "$LOG_FILE" || echo "0")"
echo
echo "💡 Recommendations:"
if grep -q "❌ DNS resolution failed" "$LOG_FILE"; then
    echo "- DNS resolution issues detected. Consider using IP-based service discovery."
fi
if grep -q "✅ Service connectivity successful" "$LOG_FILE"; then
    echo "- Direct IP connectivity is working. DNS is the primary issue."
fi
echo "- Review network policies and DNS configuration"
echo "- Consider implementing application-level service discovery"
echo
echo "🔗 View full log: cat $LOG_FILE" 
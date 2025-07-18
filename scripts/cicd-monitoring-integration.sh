#!/bin/bash

# CI/CD Monitoring Integration Script
# Integrates service monitoring into deployment pipeline

set -euo pipefail

# Configuration
NAMESPACE="dept-barc"
MONITORING_DURATION=${MONITORING_DURATION:-300}  # 5 minutes
MONITORING_INTERVAL=${MONITORING_INTERVAL:-30}   # 30 seconds
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="${SCRIPT_DIR}/../reports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="${REPORTS_DIR}/cicd-monitoring-${TIMESTAMP}.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[CI/CD-MONITOR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[CI/CD-MONITOR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[CI/CD-MONITOR]${NC} $1"
}

log_error() {
    echo -e "${RED}[CI/CD-MONITOR]${NC} $1"
}

# Function to create reports directory
create_reports_dir() {
    mkdir -p "$REPORTS_DIR"
    log_info "Created reports directory: $REPORTS_DIR"
}

# Function to run service monitoring
run_service_monitoring() {
    log_info "Starting CI/CD service monitoring..."
    log_info "Duration: ${MONITORING_DURATION}s, Interval: ${MONITORING_INTERVAL}s"
    
    # Run monitoring script
    local monitoring_log="/tmp/cicd-monitoring-${TIMESTAMP}.log"
    
    if "${SCRIPT_DIR}/monitor-services.sh" "$MONITORING_DURATION" "$MONITORING_INTERVAL" > "$monitoring_log" 2>&1; then
        log_success "Service monitoring completed successfully"
        return 0
    else
        log_error "Service monitoring failed"
        cat "$monitoring_log"
        return 1
    fi
}

# Function to generate monitoring report
generate_monitoring_report() {
    local monitoring_log="/tmp/cicd-monitoring-${TIMESTAMP}.log"
    
    if [[ ! -f "$monitoring_log" ]]; then
        log_error "Monitoring log file not found: $monitoring_log"
        return 1
    fi
    
    log_info "Generating monitoring report..."
    
    # Extract metrics from log
    local dns_success=$(grep -c "✅ DNS resolution successful" "$monitoring_log" || echo "0")
    local dns_failure=$(grep -c "❌ DNS resolution failed" "$monitoring_log" || echo "0")
    local connectivity_success=$(grep -c "✅ Service connectivity successful" "$monitoring_log" || echo "0")
    local connectivity_failure=$(grep -c "❌ Service connectivity failed" "$monitoring_log" || echo "0")
    local health_success=$(grep -c "✅.*health check passed" "$monitoring_log" || echo "0")
    local health_failure=$(grep -c "❌.*health check failed" "$monitoring_log" || echo "0")
    
    # Calculate success rates
    local total_dns=$((dns_success + dns_failure))
    local total_connectivity=$((connectivity_success + connectivity_failure))
    local total_health=$((health_success + health_failure))
    
    local dns_rate=0
    local connectivity_rate=0
    local health_rate=0
    
    [[ $total_dns -gt 0 ]] && dns_rate=$((dns_success * 100 / total_dns))
    [[ $total_connectivity -gt 0 ]] && connectivity_rate=$((connectivity_success * 100 / total_connectivity))
    [[ $total_health -gt 0 ]] && health_rate=$((health_success * 100 / total_health))
    
    # Generate JSON report
    cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "monitoring_duration": $MONITORING_DURATION,
  "monitoring_interval": $MONITORING_INTERVAL,
  "namespace": "$NAMESPACE",
  "metrics": {
    "dns_resolution": {
      "success": $dns_success,
      "failure": $dns_failure,
      "success_rate": $dns_rate
    },
    "service_connectivity": {
      "success": $connectivity_success,
      "failure": $connectivity_failure,
      "success_rate": $connectivity_rate
    },
    "health_checks": {
      "success": $health_success,
      "failure": $health_failure,
      "success_rate": $health_rate
    }
  },
  "overall_status": "$(determine_overall_status $dns_rate $connectivity_rate $health_rate)",
  "recommendations": $(generate_recommendations $dns_rate $connectivity_rate $health_rate),
  "log_file": "$monitoring_log"
}
EOF
    
    log_success "Monitoring report generated: $REPORT_FILE"
}

# Function to determine overall status
determine_overall_status() {
    local dns_rate=$1
    local connectivity_rate=$2
    local health_rate=$3
    
    if [[ $dns_rate -ge 90 && $connectivity_rate -ge 90 && $health_rate -ge 90 ]]; then
        echo "\"HEALTHY\""
    elif [[ $dns_rate -ge 70 && $connectivity_rate -ge 70 && $health_rate -ge 70 ]]; then
        echo "\"WARNING\""
    else
        echo "\"CRITICAL\""
    fi
}

# Function to generate recommendations
generate_recommendations() {
    local dns_rate=$1
    local connectivity_rate=$2
    local health_rate=$3
    
    local recommendations=()
    
    [[ $dns_rate -lt 80 ]] && recommendations+=("\"Investigate DNS resolution issues\"")
    [[ $connectivity_rate -lt 80 ]] && recommendations+=("\"Check service connectivity and network policies\"")
    [[ $health_rate -lt 80 ]] && recommendations+=("\"Review application health and resource allocation\"")
    [[ $dns_rate -ge 90 && $connectivity_rate -ge 90 && $health_rate -ge 90 ]] && recommendations+=("\"System is operating optimally\"")
    
    printf "[%s]" "$(IFS=,; echo "${recommendations[*]}")"
}

# Function to send alerts
send_alerts() {
    local status=$(jq -r '.overall_status' "$REPORT_FILE")
    
    case "$status" in
        "CRITICAL")
            log_error "CRITICAL: System monitoring detected critical issues"
            send_critical_alert
            ;;
        "WARNING")
            log_warning "WARNING: System monitoring detected potential issues"
            send_warning_alert
            ;;
        "HEALTHY")
            log_success "HEALTHY: System monitoring shows optimal performance"
            ;;
    esac
}

# Function to send critical alert
send_critical_alert() {
    log_error "Sending critical alert..."
    
    # Example webhook notification (customize as needed)
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"🚨 CRITICAL: Nanopore Tracking App monitoring detected critical issues\",
                \"attachments\": [{
                    \"color\": \"danger\",
                    \"title\": \"Monitoring Report\",
                    \"text\": \"$(cat "$REPORT_FILE" | jq -c .)\",
                    \"ts\": $(date +%s)
                }]
            }" || log_warning "Failed to send webhook notification"
    fi
    
    # Set exit code for CI/CD pipeline
    export MONITORING_EXIT_CODE=2
}

# Function to send warning alert
send_warning_alert() {
    log_warning "Sending warning alert..."
    
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"⚠️ WARNING: Nanopore Tracking App monitoring detected potential issues\",
                \"attachments\": [{
                    \"color\": \"warning\",
                    \"title\": \"Monitoring Report\",
                    \"text\": \"$(cat "$REPORT_FILE" | jq -c .)\",
                    \"ts\": $(date +%s)
                }]
            }" || log_warning "Failed to send webhook notification"
    fi
    
    export MONITORING_EXIT_CODE=1
}

# Function to cleanup old reports
cleanup_old_reports() {
    log_info "Cleaning up old reports..."
    
    # Keep only last 30 reports
    find "$REPORTS_DIR" -name "cicd-monitoring-*.json" -type f | sort -r | tail -n +31 | xargs rm -f || true
    
    log_info "Cleanup completed"
}

# Function to display summary
display_summary() {
    log_info "=== CI/CD Monitoring Summary ==="
    
    if [[ -f "$REPORT_FILE" ]]; then
        local status=$(jq -r '.overall_status' "$REPORT_FILE")
        local dns_rate=$(jq -r '.metrics.dns_resolution.success_rate' "$REPORT_FILE")
        local connectivity_rate=$(jq -r '.metrics.service_connectivity.success_rate' "$REPORT_FILE")
        local health_rate=$(jq -r '.metrics.health_checks.success_rate' "$REPORT_FILE")
        
        echo "Overall Status: $status"
        echo "DNS Resolution Success Rate: ${dns_rate}%"
        echo "Service Connectivity Success Rate: ${connectivity_rate}%"
        echo "Health Check Success Rate: ${health_rate}%"
        echo "Report File: $REPORT_FILE"
        
        # Display recommendations
        echo "Recommendations:"
        jq -r '.recommendations[]' "$REPORT_FILE" | while read -r rec; do
            echo "  - $rec"
        done
    else
        log_error "Report file not found"
    fi
}

# Main function
main() {
    log_info "Starting CI/CD monitoring integration..."
    
    # Initialize
    create_reports_dir
    
    # Run monitoring
    if run_service_monitoring; then
        generate_monitoring_report
        send_alerts
        display_summary
        cleanup_old_reports
        
        # Exit with appropriate code
        exit "${MONITORING_EXIT_CODE:-0}"
    else
        log_error "CI/CD monitoring failed"
        exit 1
    fi
}

# Run main function
main "$@" 
#!/bin/bash

# CORS Testing Framework for CI/CD Pipeline
# Comprehensive CORS validation and testing automation

set -euo pipefail

# Configuration
NAMESPACE="dept-barc"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="${SCRIPT_DIR}/../reports/cors"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CORS_REPORT="${REPORTS_DIR}/cors-test-${TIMESTAMP}.json"

# Test configuration
TEST_TIMEOUT=30
MAX_RETRIES=3
PARALLEL_TESTS=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[CORS-TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[CORS-TEST]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[CORS-TEST]${NC} $1"
}

log_error() {
    echo -e "${RED}[CORS-TEST]${NC} $1"
}

# Function to create reports directory
create_reports_dir() {
    mkdir -p "$REPORTS_DIR"
    log_info "Created CORS reports directory: $REPORTS_DIR"
}

# Function to get service routes
get_service_routes() {
    log_info "Discovering service routes..."
    
    local routes=()
    
    # Get all routes in the namespace
    while IFS= read -r route_line; do
        if [[ -n "$route_line" ]]; then
            local route_name=$(echo "$route_line" | awk '{print $1}')
            local route_host=$(echo "$route_line" | awk '{print $2}')
            
            if [[ "$route_name" =~ nanopore|api|gateway ]]; then
                routes+=("https://$route_host")
            fi
        fi
    done < <(oc get routes -n "$NAMESPACE" --no-headers 2>/dev/null)
    
    # Add localhost for local testing
    routes+=("http://localhost:3001")
    
    printf '%s\n' "${routes[@]}"
}

# Function to test CORS for a specific endpoint
test_cors_endpoint() {
    local url=$1
    local origin=$2
    local method=${3:-"GET"}
    local endpoint=${4:-"/health"}
    
    local test_url="${url}${endpoint}"
    local test_id="${url//https:\/\//}_${origin//https:\/\//}_${method}_${endpoint//\//_}"
    
    log_info "Testing CORS: $test_url with origin: $origin"
    
    # Test preflight request for non-simple requests
    local preflight_result="null"
    if [[ "$method" != "GET" && "$method" != "HEAD" && "$method" != "POST" ]]; then
        preflight_result=$(curl -s -m "$TEST_TIMEOUT" -w "%{http_code}" -o /dev/null \
            -H "Origin: $origin" \
            -H "Access-Control-Request-Method: $method" \
            -H "Access-Control-Request-Headers: Content-Type" \
            -X OPTIONS "$test_url" 2>/dev/null || echo "000")
    fi
    
    # Test actual request
    local response_code=$(curl -s -m "$TEST_TIMEOUT" -w "%{http_code}" -o /dev/null \
        -H "Origin: $origin" \
        -H "Content-Type: application/json" \
        -X "$method" "$test_url" 2>/dev/null || echo "000")
    
    # Get CORS headers
    local cors_headers=$(curl -s -m "$TEST_TIMEOUT" -I \
        -H "Origin: $origin" \
        -H "Content-Type: application/json" \
        -X "$method" "$test_url" 2>/dev/null | grep -i "access-control" || echo "")
    
    # Parse CORS headers
    local allow_origin=$(echo "$cors_headers" | grep -i "access-control-allow-origin" | cut -d: -f2- | tr -d '\r\n ' || echo "")
    local allow_methods=$(echo "$cors_headers" | grep -i "access-control-allow-methods" | cut -d: -f2- | tr -d '\r\n ' || echo "")
    local allow_headers=$(echo "$cors_headers" | grep -i "access-control-allow-headers" | cut -d: -f2- | tr -d '\r\n ' || echo "")
    local allow_credentials=$(echo "$cors_headers" | grep -i "access-control-allow-credentials" | cut -d: -f2- | tr -d '\r\n ' || echo "")
    
    # Determine test result
    local test_passed=false
    local issues=()
    
    if [[ "$response_code" =~ ^[2-3][0-9][0-9]$ ]]; then
        if [[ "$allow_origin" == "*" || "$allow_origin" == "$origin" ]]; then
            test_passed=true
        else
            issues+=("Origin not allowed")
        fi
    else
        issues+=("HTTP error: $response_code")
    fi
    
    # Check preflight if applicable
    if [[ "$preflight_result" != "null" ]]; then
        if [[ ! "$preflight_result" =~ ^[2][0-9][0-9]$ ]]; then
            test_passed=false
            issues+=("Preflight failed: $preflight_result")
        fi
    fi
    
    cat << EOF
{
  "test_id": "$test_id",
  "url": "$test_url",
  "origin": "$origin",
  "method": "$method",
  "endpoint": "$endpoint",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "response_code": "$response_code",
  "preflight_code": "$preflight_result",
  "cors_headers": {
    "allow_origin": "$allow_origin",
    "allow_methods": "$allow_methods",
    "allow_headers": "$allow_headers",
    "allow_credentials": "$allow_credentials"
  },
  "test_passed": $test_passed,
  "issues": $(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .)
}
EOF
}

# Function to run comprehensive CORS tests
run_cors_tests() {
    log_info "Running comprehensive CORS tests..."
    
    local test_results=()
    local routes=($(get_service_routes))
    
    # Define test scenarios
    local origins=(
        "https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu"
        "https://nanopore-app-dept-barc.apps.cloudapps.unc.edu"
        "http://localhost:3001"
        "http://localhost:3000"
        "https://evil-domain.com"  # Should be blocked
    )
    
    local methods=("GET" "POST" "PUT" "DELETE" "OPTIONS")
    local endpoints=("/health" "/api/v1/health" "/api/samples" "/api/metrics")
    
    # Create temporary results file
    local temp_results="/tmp/cors-test-results-${TIMESTAMP}.json"
    echo "[]" > "$temp_results"
    
    # Test each combination
    local test_count=0
    local total_tests=$((${#routes[@]} * ${#origins[@]} * ${#methods[@]} * ${#endpoints[@]}))
    
    log_info "Running $total_tests CORS tests..."
    
    for route in "${routes[@]}"; do
        for origin in "${origins[@]}"; do
            for method in "${methods[@]}"; do
                for endpoint in "${endpoints[@]}"; do
                    test_count=$((test_count + 1))
                    
                    # Skip if route is not accessible
                    if ! curl -s -m 5 --head "$route/health" >/dev/null 2>&1; then
                        log_warning "Skipping inaccessible route: $route"
                        continue
                    fi
                    
                    log_info "Test $test_count/$total_tests: $route$endpoint ($method, $origin)"
                    
                    # Run test with retry logic
                    local retry_count=0
                    local test_result=""
                    
                    while [[ $retry_count -lt $MAX_RETRIES ]]; do
                        if test_result=$(test_cors_endpoint "$route" "$origin" "$method" "$endpoint" 2>/dev/null); then
                            break
                        fi
                        retry_count=$((retry_count + 1))
                        log_warning "Retry $retry_count/$MAX_RETRIES for $route$endpoint"
                        sleep 1
                    done
                    
                    if [[ -n "$test_result" ]]; then
                        # Add result to temporary file
                        jq --argjson result "$test_result" '. += [$result]' "$temp_results" > "${temp_results}.tmp" && mv "${temp_results}.tmp" "$temp_results"
                    fi
                    
                    # Rate limiting
                    sleep 0.1
                done
            done
        done
    done
    
    echo "$temp_results"
}

# Function to analyze CORS test results
analyze_cors_results() {
    local results_file=$1
    
    log_info "Analyzing CORS test results..."
    
    local total_tests=$(jq 'length' "$results_file")
    local passed_tests=$(jq '[.[] | select(.test_passed == true)] | length' "$results_file")
    local failed_tests=$(jq '[.[] | select(.test_passed == false)] | length' "$results_file")
    
    local success_rate=0
    [[ $total_tests -gt 0 ]] && success_rate=$((passed_tests * 100 / total_tests))
    
    # Analyze failure patterns
    local failure_analysis=$(jq -r '
        [.[] | select(.test_passed == false)] |
        group_by(.issues[0] // "unknown") |
        map({
            issue: .[0].issues[0] // "unknown",
            count: length,
            examples: [.[0:3] | .[] | {url: .url, origin: .origin, method: .method}]
        })
    ' "$results_file")
    
    # Security analysis
    local security_issues=$(jq -r '
        [.[] | select(.origin == "https://evil-domain.com" and .test_passed == true)] |
        map({
            url: .url,
            method: .method,
            endpoint: .endpoint,
            severity: "HIGH"
        })
    ' "$results_file")
    
    # Generate analysis
    local analysis=$(cat << EOF
{
  "summary": {
    "total_tests": $total_tests,
    "passed_tests": $passed_tests,
    "failed_tests": $failed_tests,
    "success_rate": $success_rate,
    "overall_status": "$([ $success_rate -ge 90 ] && echo "PASS" || echo "FAIL")"
  },
  "failure_analysis": $failure_analysis,
  "security_issues": $security_issues,
  "recommendations": $(generate_cors_recommendations "$results_file")
}
EOF
)
    
    echo "$analysis"
}

# Function to generate CORS recommendations
generate_cors_recommendations() {
    local results_file=$1
    
    local recommendations=()
    
    # Check for common issues
    local origin_issues=$(jq -r '[.[] | select(.issues[] | contains("Origin not allowed"))] | length' "$results_file")
    local preflight_issues=$(jq -r '[.[] | select(.issues[] | contains("Preflight failed"))] | length' "$results_file")
    local security_issues=$(jq -r '[.[] | select(.origin == "https://evil-domain.com" and .test_passed == true)] | length' "$results_file")
    
    [[ $origin_issues -gt 0 ]] && recommendations+=("Configure proper CORS origins in API Gateway")
    [[ $preflight_issues -gt 0 ]] && recommendations+=("Fix preflight request handling for complex HTTP methods")
    [[ $security_issues -gt 0 ]] && recommendations+=("SECURITY: Restrict CORS origins - currently allowing unauthorized domains")
    
    # Check for missing CORS headers
    local missing_headers=$(jq -r '[.[] | select(.cors_headers.allow_origin == "")] | length' "$results_file")
    [[ $missing_headers -gt 0 ]] && recommendations+=("Add CORS headers to all API endpoints")
    
    # Check for overly permissive CORS
    local wildcard_origins=$(jq -r '[.[] | select(.cors_headers.allow_origin == "*")] | length' "$results_file")
    [[ $wildcard_origins -gt 0 ]] && recommendations+=("Consider restricting wildcard CORS origins for better security")
    
    printf '%s\n' "${recommendations[@]}" | jq -R . | jq -s .
}

# Function to generate CORS test report
generate_cors_report() {
    local results_file=$1
    local analysis=$2
    
    log_info "Generating CORS test report..."
    
    # Combine results and analysis
    jq --argjson analysis "$analysis" \
       --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg namespace "$NAMESPACE" \
       '{
         timestamp: $timestamp,
         namespace: $namespace,
         test_results: .,
         analysis: $analysis
       }' "$results_file" > "$CORS_REPORT"
    
    log_success "CORS test report generated: $CORS_REPORT"
}

# Function to display CORS test summary
display_cors_summary() {
    log_info "=== CORS Testing Summary ==="
    
    if [[ -f "$CORS_REPORT" ]]; then
        local status=$(jq -r '.analysis.summary.overall_status' "$CORS_REPORT")
        local total_tests=$(jq -r '.analysis.summary.total_tests' "$CORS_REPORT")
        local passed_tests=$(jq -r '.analysis.summary.passed_tests' "$CORS_REPORT")
        local failed_tests=$(jq -r '.analysis.summary.failed_tests' "$CORS_REPORT")
        local success_rate=$(jq -r '.analysis.summary.success_rate' "$CORS_REPORT")
        local security_issues=$(jq -r '.analysis.security_issues | length' "$CORS_REPORT")
        
        echo "Overall Status: $status"
        echo "Total Tests: $total_tests"
        echo "Passed: $passed_tests"
        echo "Failed: $failed_tests"
        echo "Success Rate: ${success_rate}%"
        echo "Security Issues: $security_issues"
        echo "Report File: $CORS_REPORT"
        
        # Display security issues
        if [[ $security_issues -gt 0 ]]; then
            echo ""
            echo "🚨 Security Issues:"
            jq -r '.analysis.security_issues[] | "  - \(.url) (\(.method) \(.endpoint))"' "$CORS_REPORT"
        fi
        
        # Display recommendations
        local rec_count=$(jq -r '.analysis.recommendations | length' "$CORS_REPORT")
        if [[ $rec_count -gt 0 ]]; then
            echo ""
            echo "💡 Recommendations:"
            jq -r '.analysis.recommendations[]' "$CORS_REPORT" | while read -r rec; do
                echo "  - $rec"
            done
        fi
        
        # Display failure analysis
        echo ""
        echo "📊 Failure Analysis:"
        jq -r '.analysis.failure_analysis[] | "  - \(.issue): \(.count) occurrences"' "$CORS_REPORT"
    else
        log_error "CORS test report not found"
    fi
}

# Function to send CORS test alerts
send_cors_alerts() {
    local status=$(jq -r '.analysis.summary.overall_status' "$CORS_REPORT")
    local security_issues=$(jq -r '.analysis.security_issues | length' "$CORS_REPORT")
    
    if [[ "$status" == "FAIL" || $security_issues -gt 0 ]]; then
        log_error "CORS tests failed or security issues detected"
        
        if [[ -n "${WEBHOOK_URL:-}" ]]; then
            local alert_color="danger"
            local alert_text="🚨 CORS Testing Failed"
            
            [[ $security_issues -gt 0 ]] && alert_text="🔒 CORS Security Issues Detected"
            
            curl -X POST "$WEBHOOK_URL" \
                -H "Content-Type: application/json" \
                -d "{
                    \"text\": \"$alert_text\",
                    \"attachments\": [{
                        \"color\": \"$alert_color\",
                        \"title\": \"CORS Test Report\",
                        \"text\": \"Status: $status, Security Issues: $security_issues\",
                        \"ts\": $(date +%s)
                    }]
                }" || log_warning "Failed to send CORS alert"
        fi
        
        return 1
    fi
    
    return 0
}

# Function to cleanup old reports
cleanup_old_reports() {
    log_info "Cleaning up old CORS reports..."
    
    # Keep only last 15 reports
    find "$REPORTS_DIR" -name "cors-test-*.json" -type f | sort -r | tail -n +16 | xargs rm -f || true
    
    log_info "Cleanup completed"
}

# Main function
main() {
    log_info "Starting CORS testing pipeline..."
    
    # Initialize
    create_reports_dir
    
    # Run CORS tests
    local results_file=$(run_cors_tests)
    
    # Analyze results
    local analysis=$(analyze_cors_results "$results_file")
    
    # Generate report
    generate_cors_report "$results_file" "$analysis"
    
    # Display summary
    display_cors_summary
    
    # Send alerts if needed
    send_cors_alerts
    local alert_result=$?
    
    # Cleanup
    cleanup_old_reports
    rm -f "$results_file"
    
    # Exit with appropriate code
    if [[ $alert_result -eq 0 ]]; then
        log_success "CORS testing completed successfully"
        exit 0
    else
        log_error "CORS testing failed or security issues detected"
        exit 1
    fi
}

# Run main function
main "$@" 
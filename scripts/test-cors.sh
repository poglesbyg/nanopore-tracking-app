#!/bin/bash

# CORS Testing Framework
# Tests CORS configuration for all microservices

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

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

print_test_result() {
    local test_name=$1
    local result=$2
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$result" = "PASS" ]; then
        print_success "✓ $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        print_error "✗ $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Test CORS preflight request
test_cors_preflight() {
    local service_url=$1
    local origin=$2
    local test_name="CORS Preflight - $service_url - $origin"
    
    print_status "Testing: $test_name"
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: X-Requested-With" \
        -X OPTIONS \
        "$service_url" 2>/dev/null)
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    # Check if status is 200 and contains CORS headers
    if [ "$status" = "200" ] && curl -s -I \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS \
        "$service_url" 2>/dev/null | grep -q "access-control-allow-origin"; then
        print_test_result "$test_name" "PASS"
        return 0
    else
        print_test_result "$test_name" "FAIL"
        echo "  Status: $status"
        echo "  Response: $body"
        return 1
    fi
}

# Test CORS actual request
test_cors_actual() {
    local service_url=$1
    local origin=$2
    local test_name="CORS Actual Request - $service_url - $origin"
    
    print_status "Testing: $test_name"
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -H "Origin: $origin" \
        "$service_url" 2>/dev/null)
    
    local body=$(echo "$response" | sed -E 's/HTTPSTATUS\:[0-9]{3}$//')
    local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    # Check if status is 200 and contains CORS headers
    if [ "$status" = "200" ] && curl -s -I \
        -H "Origin: $origin" \
        "$service_url" 2>/dev/null | grep -q "access-control-allow-origin"; then
        print_test_result "$test_name" "PASS"
        return 0
    else
        print_test_result "$test_name" "FAIL"
        echo "  Status: $status"
        echo "  Response: $body"
        return 1
    fi
}

# Test CORS with invalid origin
test_cors_invalid_origin() {
    local service_url=$1
    local invalid_origin="https://malicious-site.com"
    local test_name="CORS Invalid Origin - $service_url"
    
    print_status "Testing: $test_name"
    
    local headers=$(curl -s -I \
        -H "Origin: $invalid_origin" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS \
        "$service_url" 2>/dev/null)
    
    # Should NOT contain access-control-allow-origin for invalid origin
    if ! echo "$headers" | grep -q "access-control-allow-origin: $invalid_origin"; then
        print_test_result "$test_name" "PASS"
        return 0
    else
        print_test_result "$test_name" "FAIL"
        echo "  Service allowed invalid origin: $invalid_origin"
        return 1
    fi
}

# Test CORS credentials
test_cors_credentials() {
    local service_url=$1
    local origin=$2
    local test_name="CORS Credentials - $service_url"
    
    print_status "Testing: $test_name"
    
    local headers=$(curl -s -I \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: GET" \
        -X OPTIONS \
        "$service_url" 2>/dev/null)
    
    # Should contain access-control-allow-credentials: true
    if echo "$headers" | grep -q "access-control-allow-credentials: true"; then
        print_test_result "$test_name" "PASS"
        return 0
    else
        print_test_result "$test_name" "FAIL"
        echo "  Missing or incorrect credentials header"
        return 1
    fi
}

# Test CORS methods
test_cors_methods() {
    local service_url=$1
    local origin=$2
    local test_name="CORS Methods - $service_url"
    
    print_status "Testing: $test_name"
    
    local headers=$(curl -s -I \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: POST" \
        -X OPTIONS \
        "$service_url" 2>/dev/null)
    
    # Should contain expected methods
    if echo "$headers" | grep -q "access-control-allow-methods" && \
       echo "$headers" | grep -i "access-control-allow-methods" | grep -q "POST"; then
        print_test_result "$test_name" "PASS"
        return 0
    else
        print_test_result "$test_name" "FAIL"
        echo "  Missing or incorrect methods header"
        return 1
    fi
}

# Test service health
test_service_health() {
    local service_url=$1
    local test_name="Service Health - $service_url"
    
    print_status "Testing: $test_name"
    
    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$service_url" 2>/dev/null)
    local status=$(echo "$response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')
    
    if [ "$status" = "200" ]; then
        print_test_result "$test_name" "PASS"
        return 0
    else
        print_test_result "$test_name" "FAIL"
        echo "  Status: $status"
        return 1
    fi
}

# Get list of services to test
get_services() {
    local services=()
    
    # Get routes from OpenShift
    while IFS= read -r route; do
        if [[ "$route" =~ ^(submission-service|nanopore-frontend|sample-management|auth-service|file-storage) ]]; then
            local url="https://$(echo "$route" | awk '{print $2}')"
            services+=("$url")
        fi
    done < <(oc get routes --no-headers 2>/dev/null || echo "")
    
    # Add hardcoded services if routes not found
    if [ ${#services[@]} -eq 0 ]; then
        services=(
            "https://submission-service-dept-barc.apps.cloudapps.unc.edu/api/v1/health"
            "https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu/health"
        )
    fi
    
    echo "${services[@]}"
}

# Get list of origins to test
get_origins() {
    local origins=(
        "https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu"
        "https://nanopore-frontend-final-dept-barc.apps.cloudapps.unc.edu"
        "https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu"
        "http://localhost:3000"
        "http://localhost:3001"
    )
    
    echo "${origins[@]}"
}

# Main test function
run_cors_tests() {
    local services=($(get_services))
    local origins=($(get_origins))
    
    print_status "Starting CORS testing framework"
    print_status "Services to test: ${#services[@]}"
    print_status "Origins to test: ${#origins[@]}"
    
    echo ""
    echo "========================================="
    echo "           CORS TEST RESULTS"
    echo "========================================="
    echo ""
    
    # Test each service
    for service_url in "${services[@]}"; do
        echo ""
        print_status "Testing service: $service_url"
        echo "----------------------------------------"
        
        # Test service health first
        test_service_health "$service_url"
        
        # Test CORS with valid origins
        for origin in "${origins[@]}"; do
            test_cors_preflight "$service_url" "$origin"
            test_cors_actual "$service_url" "$origin"
            test_cors_credentials "$service_url" "$origin"
            test_cors_methods "$service_url" "$origin"
        done
        
        # Test CORS with invalid origin
        test_cors_invalid_origin "$service_url"
        
        echo ""
    done
    
    echo ""
    echo "========================================="
    echo "           SUMMARY"
    echo "========================================="
    echo ""
    echo "Total tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Success rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo ""
    
    if [ $FAILED_TESTS -gt 0 ]; then
        print_error "Some tests failed. Check the output above for details."
        exit 1
    else
        print_success "All tests passed!"
        exit 0
    fi
}

# Command line options
case "${1:-}" in
    --help|-h)
        echo "CORS Testing Framework"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --service URL  Test specific service URL"
        echo "  --origin URL   Test specific origin URL"
        echo "  --quick        Run quick tests only"
        echo ""
        echo "Examples:"
        echo "  $0                                                    # Test all services"
        echo "  $0 --service https://service.com/api/health          # Test specific service"
        echo "  $0 --origin https://frontend.com                     # Test specific origin"
        echo "  $0 --quick                                           # Run quick tests only"
        exit 0
        ;;
    --service)
        if [ -z "$2" ]; then
            print_error "Service URL required"
            exit 1
        fi
        SERVICE_URL="$2"
        ORIGIN="${3:-https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu}"
        
        print_status "Testing single service: $SERVICE_URL"
        test_service_health "$SERVICE_URL"
        test_cors_preflight "$SERVICE_URL" "$ORIGIN"
        test_cors_actual "$SERVICE_URL" "$ORIGIN"
        test_cors_credentials "$SERVICE_URL" "$ORIGIN"
        test_cors_methods "$SERVICE_URL" "$ORIGIN"
        test_cors_invalid_origin "$SERVICE_URL"
        
        echo ""
        echo "Tests completed: $TOTAL_TESTS"
        echo "Passed: $PASSED_TESTS"
        echo "Failed: $FAILED_TESTS"
        exit $FAILED_TESTS
        ;;
    --origin)
        if [ -z "$2" ]; then
            print_error "Origin URL required"
            exit 1
        fi
        ORIGIN="$2"
        SERVICE_URL="${3:-https://submission-service-dept-barc.apps.cloudapps.unc.edu/api/v1/health}"
        
        print_status "Testing single origin: $ORIGIN"
        test_cors_preflight "$SERVICE_URL" "$ORIGIN"
        test_cors_actual "$SERVICE_URL" "$ORIGIN"
        
        echo ""
        echo "Tests completed: $TOTAL_TESTS"
        echo "Passed: $PASSED_TESTS"
        echo "Failed: $FAILED_TESTS"
        exit $FAILED_TESTS
        ;;
    --quick)
        print_status "Running quick CORS tests"
        SERVICE_URL="https://submission-service-dept-barc.apps.cloudapps.unc.edu/api/v1/health"
        ORIGIN="https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu"
        
        test_service_health "$SERVICE_URL"
        test_cors_preflight "$SERVICE_URL" "$ORIGIN"
        test_cors_actual "$SERVICE_URL" "$ORIGIN"
        
        echo ""
        echo "Quick tests completed: $TOTAL_TESTS"
        echo "Passed: $PASSED_TESTS"
        echo "Failed: $FAILED_TESTS"
        exit $FAILED_TESTS
        ;;
    *)
        run_cors_tests
        ;;
esac 
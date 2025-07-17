#!/bin/bash

# Test script for submission service integration
# This script tests the API Gateway integration with the submission service

echo "=== Submission Service Integration Test ==="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URLs
MAIN_APP="http://localhost:3001"
SUBMISSION_SERVICE="http://localhost:8001"

# Function to check if a service is running
check_service() {
    local url=$1
    local service_name=$2
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404"; then
        echo -e "${GREEN}✓${NC} $service_name is running at $url"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is not accessible at $url"
        return 1
    fi
}

# Function to test health endpoint
test_health() {
    local endpoint=$1
    local service_name=$2
    
    echo -e "\n${YELLOW}Testing $service_name health endpoint...${NC}"
    
    response=$(curl -s -w "\n%{http_code}" "$endpoint")
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC} Health check passed"
        echo "Response: $body"
    else
        echo -e "${RED}✗${NC} Health check failed (HTTP $http_code)"
        echo "Response: $body"
    fi
}

# Function to test PDF processing
test_pdf_processing() {
    local endpoint=$1
    local test_file=$2
    
    echo -e "\n${YELLOW}Testing PDF processing endpoint...${NC}"
    
    if [ ! -f "$test_file" ]; then
        echo -e "${RED}✗${NC} Test file not found: $test_file"
        return
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X POST \
        -F "file=@$test_file" \
        "$endpoint")
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC} PDF processing successful"
        echo "Response: $body"
    else
        echo -e "${RED}✗${NC} PDF processing failed (HTTP $http_code)"
        echo "Response: $body"
    fi
}

# Check if services are running
echo "Checking services..."
check_service "$MAIN_APP" "Main application"
MAIN_APP_RUNNING=$?

check_service "$SUBMISSION_SERVICE/health" "Submission service"
SUBMISSION_SERVICE_RUNNING=$?

if [ $MAIN_APP_RUNNING -ne 0 ] || [ $SUBMISSION_SERVICE_RUNNING -ne 0 ]; then
    echo -e "\n${RED}Please ensure both services are running before testing integration${NC}"
    echo "Start main app: pnpm dev"
    echo "Start submission service: cd services/submission-service && python app.py"
    exit 1
fi

# Test direct submission service endpoints
echo -e "\n${YELLOW}=== Testing Direct Submission Service ====${NC}"
test_health "$SUBMISSION_SERVICE/health" "Direct submission service"

# Test API Gateway endpoints
echo -e "\n${YELLOW}=== Testing API Gateway Integration ====${NC}"
test_health "$MAIN_APP/api/submission/health" "API Gateway submission"

# Test memory usage endpoint
echo -e "\n${YELLOW}Testing memory usage endpoint...${NC}"
response=$(curl -s "$MAIN_APP/api/submission/memory-usage")
echo "Memory usage: $response"

# Test PDF processing if test file exists
TEST_PDF="HTSF--JL-147_quote_160217072025.pdf"
if [ -f "$TEST_PDF" ]; then
    echo -e "\n${YELLOW}=== Testing PDF Processing ====${NC}"
    
    # Test direct submission service
    test_pdf_processing "$SUBMISSION_SERVICE/process-pdf" "$TEST_PDF"
    
    # Test via API Gateway
    test_pdf_processing "$MAIN_APP/api/submission/process-pdf" "$TEST_PDF"
else
    echo -e "\n${YELLOW}Skipping PDF processing test (no test file found)${NC}"
    echo "To test PDF processing, place HTSF--JL-147_quote_160217072025.pdf in the current directory"
fi

# Summary
echo -e "\n${YELLOW}=== Integration Test Summary ====${NC}"
echo "1. Main application: Running at $MAIN_APP"
echo "2. Submission service: Running at $SUBMISSION_SERVICE"
echo "3. API Gateway routes:"
echo "   - /api/submission/process-pdf"
echo "   - /api/submission/process-csv"
echo "   - /api/submission/health"
echo "   - /api/submission/memory-usage"
echo
echo -e "${GREEN}Integration test complete!${NC}"
echo
echo "Next steps:"
echo "1. Set SUBMISSION_SERVICE_URL environment variable in production"
echo "2. Configure authentication headers if needed"
echo "3. Monitor memory usage and performance"
echo "4. Test with real HTSF PDF files" 
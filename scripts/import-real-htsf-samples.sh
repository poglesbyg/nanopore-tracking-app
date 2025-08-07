#!/bin/bash
set -e

# Import real HTSF samples with all required fields into OpenShift nanopore tracking system
# Uses the correctly parsed sample data from HTSF PDF

# Configuration
OPENSHIFT_URL="https://nanopore-tracking-dept-barc.apps.cloudapps.unc.edu"
SAMPLES_FILE="HTSF--JL-147_quote_160217072025_correct_samples.json"
PROJECT_ID="e0641c61-0c0f-42c7-a7a1-d33e28824240"  # Nanopore Sequencing Project - JL-147
SUBMISSION_ID="c7efc98e-c8c8-4b79-8d6b-5e3b9a2d1f8c"  # Submission with 80 samples

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== HTSF Real Sample Import Script ===${NC}"
echo "OpenShift URL: $OPENSHIFT_URL"
echo "Samples file: $SAMPLES_FILE"
echo "Project ID: $PROJECT_ID"
echo "Submission ID: $SUBMISSION_ID"
echo

# Check if samples file exists
if [ ! -f "$SAMPLES_FILE" ]; then
    echo -e "${RED}Error: Samples file not found: $SAMPLES_FILE${NC}"
    echo "Please run the PDF parser first:"
    echo "python3 scripts/parse-htsf-samples-correct.py HTSF--JL-147_quote_160217072025.pdf"
    exit 1
fi

# Get total sample count
TOTAL_SAMPLES=$(jq 'length' "$SAMPLES_FILE")
echo -e "${BLUE}Found $TOTAL_SAMPLES samples to import${NC}"
echo

# Counter for progress
SUCCESS_COUNT=0
ERROR_COUNT=0

# Import each sample
for i in $(seq 0 $((TOTAL_SAMPLES - 1))); do
    # Extract sample data
    SAMPLE_DATA=$(jq -r ".[$i]" "$SAMPLES_FILE")
    SAMPLE_NAME=$(echo "$SAMPLE_DATA" | jq -r '.sample_name')
    SAMPLE_ID=$(echo "$SAMPLE_DATA" | jq -r '.sample_id')
    VOLUME=$(echo "$SAMPLE_DATA" | jq -r '.volume')
    VOLUME_UNIT=$(echo "$SAMPLE_DATA" | jq -r '.volume_unit')
    QUBIT_CONC=$(echo "$SAMPLE_DATA" | jq -r '.qubit_concentration')
    NANODROP_CONC=$(echo "$SAMPLE_DATA" | jq -r '.nanodrop_concentration')
    CONCENTRATION=$(echo "$SAMPLE_DATA" | jq -r '.concentration')
    CONCENTRATION_UNIT=$(echo "$SAMPLE_DATA" | jq -r '.concentration_unit')
    A260_280=$(echo "$SAMPLE_DATA" | jq -r '.a260_280_ratio')
    A260_230=$(echo "$SAMPLE_DATA" | jq -r '.a260_230_ratio')
    SAMPLE_TYPE=$(echo "$SAMPLE_DATA" | jq -r '.sample_type')
    PRIORITY=$(echo "$SAMPLE_DATA" | jq -r '.priority')
    LAB_NAME=$(echo "$SAMPLE_DATA" | jq -r '.lab_name')
    CHART_FIELD=$(echo "$SAMPLE_DATA" | jq -r '.chart_field')
    
    # Create API payload with all HTSF fields
    PAYLOAD=$(jq -n \
        --arg project_id "$PROJECT_ID" \
        --arg submission_id "$SUBMISSION_ID" \
        --arg sample_name "$SAMPLE_NAME" \
        --arg sample_id "$SAMPLE_ID" \
        --arg sample_type "$SAMPLE_TYPE" \
        --argjson volume "$VOLUME" \
        --arg volume_unit "$VOLUME_UNIT" \
        --argjson concentration "$CONCENTRATION" \
        --arg concentration_unit "$CONCENTRATION_UNIT" \
        --argjson qubit_concentration "$QUBIT_CONC" \
        --argjson nanodrop_concentration "$NANODROP_CONC" \
        --argjson a260_280_ratio "$A260_280" \
        --argjson a260_230_ratio "$A260_230" \
        --arg priority "$PRIORITY" \
        --arg lab_name "$LAB_NAME" \
        --arg chart_field "$CHART_FIELD" \
        --arg workflow_stage "submitted" \
        --argjson flow_cell_count 1 \
        --arg submitter_name "Joshua Leon" \
        --arg submitter_email "joshleon@unc.edu" \
        '{
            project_id: $project_id,
            submission_id: $submission_id,
            sample_name: $sample_name,
            sample_id: $sample_id,
            sample_type: $sample_type,
            volume: $volume,
            volume_unit: $volume_unit,
            concentration: $concentration,
            concentration_unit: $concentration_unit,
            qubit_concentration: $qubit_concentration,
            nanodrop_concentration: $nanodrop_concentration,
            a260_280_ratio: $a260_280_ratio,
            a260_230_ratio: $a260_230_ratio,
            priority: $priority,
            lab_name: $lab_name,
            chart_field: $chart_field,
            workflow_stage: $workflow_stage,
            flow_cell_count: $flow_cell_count,
            submitter_name: $submitter_name,
            submitter_email: $submitter_email
        }')
    
    # Make API call
    echo -n -e "${YELLOW}[$((i + 1))/$TOTAL_SAMPLES] Importing $SAMPLE_NAME...${NC}"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" \
        "$OPENSHIFT_URL/api/samples")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        echo -e " ${GREEN}✓ SUCCESS${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        
        # Show key sample details
        echo -e "  ${GREEN}→${NC} Vol: ${VOLUME}${VOLUME_UNIT}, Qubit: ${QUBIT_CONC}ng/μL, Nanodrop: ${NANODROP_CONC}ng/μL"
        echo -e "  ${GREEN}→${NC} A260/280: ${A260_280}, A260/230: ${A260_230}"
    else
        echo -e " ${RED}✗ FAILED (HTTP $HTTP_CODE)${NC}"
        echo -e "  ${RED}Error:${NC} $RESPONSE_BODY"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        
        # Continue with next sample instead of failing completely
        continue
    fi
    
    # Brief pause to avoid overwhelming the API
    sleep 0.2
done

echo
echo -e "${BLUE}=== IMPORT SUMMARY ===${NC}"
echo -e "${GREEN}Successful imports: $SUCCESS_COUNT${NC}"
echo -e "${RED}Failed imports: $ERROR_COUNT${NC}"
echo -e "${BLUE}Total processed: $TOTAL_SAMPLES${NC}"

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo
    echo -e "${GREEN}✓ Successfully imported $SUCCESS_COUNT real HTSF samples with complete data!${NC}"
    echo -e "${BLUE}Check the dashboard at: $OPENSHIFT_URL${NC}"
    
    # Verify total sample count in system
    echo
    echo -e "${YELLOW}Verifying total samples in system...${NC}"
    TOTAL_IN_SYSTEM=$(curl -s "$OPENSHIFT_URL/api/hierarchy" | jq '[.. | .samples[]? | select(.)] | length' 2>/dev/null || echo "unknown")
    echo -e "${BLUE}Total samples now in system: $TOTAL_IN_SYSTEM${NC}"
else
    echo -e "${RED}No samples were successfully imported. Please check the errors above.${NC}"
    exit 1
fi

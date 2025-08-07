#!/bin/bash

# Import the remaining samples from the JSON file
# Using the existing submission we already created

API_BASE_URL="https://nanopore-tracking-dept-barc.apps.cloudapps.unc.edu"
SUBMISSION_ID="70bd2f60-86de-4ef7-8535-d43d01292636"  # The submission we created successfully
SAMPLES_FILE="HTSF--JL-147_quote_160217072025_samples.json"

echo "🚀 Importing remaining samples to existing submission: $SUBMISSION_ID"

if [ ! -f "$SAMPLES_FILE" ]; then
    echo "Error: File $SAMPLES_FILE not found"
    exit 1
fi

# Count samples
SAMPLE_COUNT=$(jq length "$SAMPLES_FILE")
echo "📊 Found $SAMPLE_COUNT samples to import"

# Import samples starting from sample 11 (we already have 1-10)
SUCCESS_COUNT=0
ERROR_COUNT=0

for i in $(seq 10 $((SAMPLE_COUNT - 1))); do
    SAMPLE=$(jq ".[$i]" "$SAMPLES_FILE")
    SAMPLE_NAME=$(echo "$SAMPLE" | jq -r '.sample_name')
    
    # Create sample data with submission_id
    SAMPLE_DATA=$(echo "$SAMPLE" | jq ". + {
        \"submission_id\": \"$SUBMISSION_ID\",
        \"submitter_name\": \"Dr. Jennifer Liu\",
        \"submitter_email\": \"jliu@university.edu\"
    }")
    
    # Send to API
    RESPONSE=$(curl -s -k -X POST "$API_BASE_URL/api/samples" \
        -H "Content-Type: application/json" \
        -d "$SAMPLE_DATA")
    
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
    
    if [ "$SUCCESS" = "true" ]; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "  ✅ $SAMPLE_NAME"
    else
        ERROR_COUNT=$((ERROR_COUNT + 1))
        ERROR_MSG=$(echo "$RESPONSE" | jq -r '.message // "Unknown error"')
        echo "  ❌ $SAMPLE_NAME: $ERROR_MSG"
    fi
    
    # Progress indicator
    CURRENT=$((i - 9))
    TOTAL=$((SAMPLE_COUNT - 10))
    if [ $((CURRENT % 10)) -eq 0 ]; then
        echo "📊 Progress: $CURRENT/$TOTAL samples processed"
    fi
    
    # Small delay to avoid overwhelming the server
    sleep 0.1
done

echo ""
echo "🎉 Import completed!"
echo "✅ Successfully imported: $SUCCESS_COUNT samples"
echo "❌ Failed: $ERROR_COUNT samples"
echo "📊 Total processed: $((SUCCESS_COUNT + ERROR_COUNT)) samples"

# Check final count
echo ""
echo "🔍 Checking final sample count..."
FINAL_COUNT=$(curl -s -k "$API_BASE_URL/api/hierarchy" | jq '.data.summary.totalSamples')
echo "📊 Total samples in system: $FINAL_COUNT"

#!/bin/bash

# Bulk import samples using curl
API_BASE_URL="https://nanopore-tracking-dept-barc.apps.cloudapps.unc.edu"
PROJECT_NAME="Nanopore Sequencing Project - JL-147"

if [ $# -ne 1 ]; then
    echo "Usage: $0 <samples.json>"
    echo "Example: $0 HTSF--JL-147_quote_160217072025_samples.json"
    exit 1
fi

SAMPLES_FILE="$1"

if [ ! -f "$SAMPLES_FILE" ]; then
    echo "Error: File $SAMPLES_FILE not found"
    exit 1
fi

echo "🚀 Starting bulk import from: $SAMPLES_FILE"

# Count samples
SAMPLE_COUNT=$(jq length "$SAMPLES_FILE")
echo "📊 Found $SAMPLE_COUNT samples to import"

# Find or create project
echo "🔍 Finding existing project..."
PROJECT_RESPONSE=$(curl -s -k "$API_BASE_URL/api/projects")
PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r ".data.data[]? | select(.name == \"$PROJECT_NAME\") | .id")

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
    echo "📁 Creating new project..."
    PROJECT_DATA='{
        "name": "'"$PROJECT_NAME"'",
        "description": "Nanopore sequencing project for JL-147 samples",
        "owner_name": "Dr. Jennifer Liu",
        "owner_email": "jliu@university.edu",
        "chart_prefix": "HTSF"
    }'
    
    CREATE_RESPONSE=$(curl -s -k -X POST "$API_BASE_URL/api/projects" \
        -H "Content-Type: application/json" \
        -d "$PROJECT_DATA")
    
    PROJECT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.data.id')
    echo "✅ Created project: $PROJECT_ID"
else
    echo "✅ Found existing project: $PROJECT_ID"
fi

# Create submission
echo "📄 Creating submission..."
SUBMISSION_DATA='{
    "project_id": "'"$PROJECT_ID"'",
    "name": "JL-147 Bulk Import - '"$SAMPLE_COUNT"' Samples",
    "description": "Bulk import of '"$SAMPLE_COUNT"' samples from HTSF quote PDF",
    "submitter_name": "Dr. Jennifer Liu",
    "submitter_email": "jliu@university.edu",
    "submission_type": "pdf",
    "priority": "normal"
}'

SUBMISSION_RESPONSE=$(curl -s -k -X POST "$API_BASE_URL/api/submissions" \
    -H "Content-Type: application/json" \
    -d "$SUBMISSION_DATA")

SUBMISSION_ID=$(echo "$SUBMISSION_RESPONSE" | jq -r '.data.data.id')
echo "✅ Created submission: $SUBMISSION_ID"

# Import samples
echo "🧬 Importing samples..."
SUCCESS_COUNT=0
ERROR_COUNT=0

for i in $(seq 0 $((SAMPLE_COUNT - 1))); do
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
    if [ $((($i + 1) % 10)) -eq 0 ]; then
        echo "📊 Progress: $(($i + 1))/$SAMPLE_COUNT samples processed"
    fi
    
    # Small delay to avoid overwhelming the server
    sleep 0.1
done

echo ""
echo "🎉 Import completed!"
echo "✅ Successfully imported: $SUCCESS_COUNT samples"
echo "❌ Failed: $ERROR_COUNT samples"
echo "📊 Total processed: $((SUCCESS_COUNT + ERROR_COUNT)) samples"

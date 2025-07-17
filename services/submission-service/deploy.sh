#!/bin/bash

# Submission Service Deployment Script
# Deploys the Python-based submission service to OpenShift

set -e

echo "🚀 Deploying Submission Service to OpenShift..."

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Set variables
SERVICE_NAME="submission-service"
NAMESPACE="dept-barc"
IMAGE_NAME="submission-service:latest"

echo "📦 Building submission service image..."

# Build the Docker image
cd "$SCRIPT_DIR"
docker build -t "$IMAGE_NAME" .

echo "🔧 Tagging image for OpenShift registry..."

# Get OpenShift registry URL
REGISTRY_URL="default-route-openshift-image-registry.apps.cloudapps.unc.edu"

# Tag image for OpenShift
docker tag "$IMAGE_NAME" "$REGISTRY_URL/$NAMESPACE/$IMAGE_NAME"

echo "📤 Pushing image to OpenShift registry..."

# Push image to OpenShift registry
docker push "$REGISTRY_URL/$NAMESPACE/$IMAGE_NAME"

echo "🔧 Applying OpenShift deployment configuration..."

# Apply deployment configuration
oc apply -f deployment/openshift/

echo "⏳ Waiting for deployment to be ready..."

# Wait for deployment to be ready
oc rollout status deployment/$SERVICE_NAME -n $NAMESPACE --timeout=300s

echo "🔍 Checking service health..."

# Wait a bit for the service to start
sleep 10

# Check service health
SERVICE_URL=$(oc get route $SERVICE_NAME-route -n $NAMESPACE -o jsonpath='{.spec.host}' 2>/dev/null || echo "")

if [ -n "$SERVICE_URL" ]; then
    echo "✅ Service deployed successfully!"
    echo "🌐 Service URL: https://$SERVICE_URL"
    echo "🔍 Health check: https://$SERVICE_URL/health"
    
    # Test health endpoint
    if curl -s -f "https://$SERVICE_URL/health" > /dev/null; then
        echo "✅ Health check passed!"
    else
        echo "⚠️  Health check failed, but service may still be starting up"
    fi
else
    echo "⚠️  Service deployed but route not found"
fi

echo "📊 Checking pod status..."

# Show pod status
oc get pods -l app=$SERVICE_NAME -n $NAMESPACE

echo "🎉 Submission service deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Update the main app to use the submission service"
echo "2. Test CSV and PDF upload functionality"
echo "3. Monitor memory usage improvements" 
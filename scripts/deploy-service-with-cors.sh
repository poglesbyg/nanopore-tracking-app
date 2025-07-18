#!/bin/bash

# Deploy a microservice with standardized CORS configuration
# Usage: ./deploy-service-with-cors.sh <service-name> <service-type> <image> <port> [additional-args]

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if required arguments are provided
if [ $# -lt 4 ]; then
    print_error "Usage: $0 <service-name> <service-type> <image> <port> [environment] [replicas] [memory-request] [memory-limit] [cpu-request] [cpu-limit]"
    print_error "Example: $0 sample-management api registry/sample-management:latest 8000 production 2 256Mi 512Mi 100m 500m"
    exit 1
fi

# Required arguments
SERVICE_NAME=$1
SERVICE_TYPE=$2
IMAGE=$3
PORT=$4

# Optional arguments with defaults
ENVIRONMENT=${5:-"production"}
REPLICAS=${6:-"1"}
MEMORY_REQUEST=${7:-"256Mi"}
MEMORY_LIMIT=${8:-"512Mi"}
CPU_REQUEST=${9:-"100m"}
CPU_LIMIT=${10:-"500m"}
VERSION=${11:-"v1.0.0"}
HEALTH_PATH=${12:-"/health"}

# Additional environment variables (empty by default)
ADDITIONAL_ENV_VARS=${13:-""}

print_status "Deploying service: $SERVICE_NAME"
print_status "Service type: $SERVICE_TYPE"
print_status "Image: $IMAGE"
print_status "Port: $PORT"
print_status "Environment: $ENVIRONMENT"
print_status "Replicas: $REPLICAS"

# Check if cors-config ConfigMap exists
if ! oc get configmap cors-config >/dev/null 2>&1; then
    print_warning "CORS ConfigMap not found. Creating it..."
    
    # Create CORS ConfigMap
    cat <<EOF | oc apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: cors-config
  labels:
    app: nanopore-microservices
    component: cors-config
data:
  CORS_ORIGINS: "https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu,https://nanopore-frontend-final-dept-barc.apps.cloudapps.unc.edu,https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu,http://localhost:3000,http://localhost:3001"
  CORS_METHODS: "GET,POST,PUT,DELETE,OPTIONS,PATCH"
  CORS_HEADERS: "Content-Type,Authorization,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers"
  CORS_CREDENTIALS: "true"
  CORS_MAX_AGE: "86400"
EOF
    
    print_success "CORS ConfigMap created"
else
    print_status "CORS ConfigMap already exists"
fi

# Create temporary deployment file
TEMP_FILE=$(mktemp)
TEMPLATE_FILE="deployment/openshift/service-deployment-template.yaml"

if [ ! -f "$TEMPLATE_FILE" ]; then
    print_error "Template file not found: $TEMPLATE_FILE"
    exit 1
fi

# Substitute variables in template
sed -e "s/\${SERVICE_NAME}/$SERVICE_NAME/g" \
    -e "s/\${SERVICE_TYPE}/$SERVICE_TYPE/g" \
    -e "s/\${VERSION}/$VERSION/g" \
    -e "s/\${REPLICAS}/$REPLICAS/g" \
    -e "s|\${IMAGE}|$IMAGE|g" \
    -e "s/\${PORT}/$PORT/g" \
    -e "s/\${ENVIRONMENT}/$ENVIRONMENT/g" \
    -e "s/\${MEMORY_REQUEST}/$MEMORY_REQUEST/g" \
    -e "s/\${MEMORY_LIMIT}/$MEMORY_LIMIT/g" \
    -e "s/\${CPU_REQUEST}/$CPU_REQUEST/g" \
    -e "s/\${CPU_LIMIT}/$CPU_LIMIT/g" \
    -e "s|\${HEALTH_PATH}|$HEALTH_PATH|g" \
    -e "s/\${ADDITIONAL_ENV_VARS}/$ADDITIONAL_ENV_VARS/g" \
    "$TEMPLATE_FILE" > "$TEMP_FILE"

print_status "Applying deployment configuration..."

# Apply the deployment
if oc apply -f "$TEMP_FILE"; then
    print_success "Deployment configuration applied successfully"
else
    print_error "Failed to apply deployment configuration"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Clean up temporary file
rm -f "$TEMP_FILE"

# Wait for rollout to complete
print_status "Waiting for rollout to complete..."
if oc rollout status deployment/$SERVICE_NAME --timeout=300s; then
    print_success "Rollout completed successfully"
else
    print_error "Rollout failed or timed out"
    exit 1
fi

# Check service health
print_status "Checking service health..."
ROUTE_URL=$(oc get route $SERVICE_NAME -o jsonpath='{.spec.host}' 2>/dev/null || echo "")

if [ -n "$ROUTE_URL" ]; then
    print_status "Service available at: https://$ROUTE_URL"
    
    # Test health endpoint
    if curl -f -s "https://$ROUTE_URL$HEALTH_PATH" >/dev/null 2>&1; then
        print_success "Health check passed"
    else
        print_warning "Health check failed - service may still be starting"
    fi
    
    # Test CORS
    print_status "Testing CORS configuration..."
    CORS_TEST=$(curl -s -H "Origin: https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu" \
                     -H "Access-Control-Request-Method: GET" \
                     -X OPTIONS \
                     "https://$ROUTE_URL$HEALTH_PATH" 2>/dev/null || echo "")
    
    if echo "$CORS_TEST" | grep -q "access-control-allow-origin"; then
        print_success "CORS configuration working correctly"
    else
        print_warning "CORS configuration may need adjustment"
    fi
else
    print_warning "Route not found - service may not be externally accessible"
fi

print_success "Service deployment completed: $SERVICE_NAME"
print_status "Use 'oc get pods -l app=$SERVICE_NAME' to check pod status"
print_status "Use 'oc logs deployment/$SERVICE_NAME' to check logs" 
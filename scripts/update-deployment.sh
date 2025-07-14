#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Updating Nanopore Tracking App Deployment...${NC}"

# Check if oc command is available
if ! command -v oc &> /dev/null; then
    echo -e "${RED}❌ OpenShift CLI (oc) is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if logged in to OpenShift
if ! oc whoami &> /dev/null; then
    echo -e "${RED}❌ You are not logged in to OpenShift. Please run 'oc login' first.${NC}"
    exit 1
fi

# Get current project
PROJECT=$(oc project -q)
echo -e "${YELLOW}📋 Current project: ${PROJECT}${NC}"

# Build the application locally first
echo -e "${YELLOW}🔨 Building application...${NC}"
pnpm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed. Please fix build errors before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful!${NC}"

# Update OpenShift configurations
echo -e "${YELLOW}📦 Updating ConfigMap...${NC}"
oc apply -f deployment/openshift/configmap.yaml

echo -e "${YELLOW}🔐 Updating Secret...${NC}"
oc apply -f deployment/openshift/secret.yaml

echo -e "${YELLOW}🚀 Updating Deployment...${NC}"
oc apply -f deployment/openshift/deployment.yaml

# Trigger a new build
echo -e "${YELLOW}🏗️ Starting new build...${NC}"
oc start-build nanopore-tracking-app --from-dir=. --follow

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed in OpenShift.${NC}"
    exit 1
fi

# Wait for rollout to complete
echo -e "${YELLOW}⏳ Waiting for deployment rollout...${NC}"
oc rollout status deployment/nanopore-tracking-app --timeout=300s

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment rollout failed.${NC}"
    echo -e "${YELLOW}💡 Checking pod logs...${NC}"
    POD=$(oc get pods -l app=nanopore-tracking-app --field-selector=status.phase!=Succeeded -o jsonpath='{.items[0].metadata.name}')
    if [ ! -z "$POD" ]; then
        oc logs $POD --tail=50
    fi
    exit 1
fi

# Get the route URL
ROUTE_URL=$(oc get route nanopore-tracking-route -o jsonpath='{.spec.host}')
echo -e "${GREEN}✅ Deployment updated successfully!${NC}"
echo -e "${GREEN}🌐 Application is available at: https://${ROUTE_URL}${NC}"

# Show pod status
echo -e "${YELLOW}📊 Current pod status:${NC}"
oc get pods -l app=nanopore-tracking-app

# Test the health endpoint
echo -e "${YELLOW}🏥 Testing health endpoint...${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://${ROUTE_URL}/health || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${RED}⚠️ Health check returned status: ${HEALTH_STATUS}${NC}"
    echo -e "${YELLOW}The application may still be starting up. Please check in a few moments.${NC}"
fi

echo -e "${GREEN}🎉 Deployment update complete!${NC}" 
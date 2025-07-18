#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Nanopore Frontend Service deployment to OpenShift...${NC}"

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
echo -e "${YELLOW}📋 Deploying to project: ${PROJECT}${NC}"

# Apply OpenShift configurations first
echo -e "${YELLOW}📦 Applying Build Configuration...${NC}"
oc apply -f deployment/openshift/build-config.yaml

# Build and push the image
echo -e "${YELLOW}🏗️ Building frontend image...${NC}"
oc start-build nanopore-frontend --from-dir=. --follow

echo -e "${YELLOW}🚀 Applying Deployment...${NC}"
oc apply -f deployment/openshift/deployment.yaml

echo -e "${YELLOW}⏳ Waiting for deployment to be ready...${NC}"
oc rollout status deployment/nanopore-frontend --timeout=300s

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"

# Get the route URL
ROUTE_URL=$(oc get route nanopore-frontend-route -o jsonpath='{.spec.host}')
echo -e "${GREEN}🌐 Frontend is available at: https://${ROUTE_URL}${NC}"

# Show pod status
echo -e "${YELLOW}📊 Pod Status:${NC}"
oc get pods -l app=nanopore-frontend

echo -e "${GREEN}🎉 Nanopore Frontend Service deployed successfully to OpenShift!${NC}" 
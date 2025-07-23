#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Nanopore Frontend Redeployment Script ${NC}"
echo -e "${BLUE}========================================${NC}"

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

# Confirm deployment
echo -e "${YELLOW}⚠️  This will rebuild and redeploy the frontend service.${NC}"
read -p "Do you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deployment cancelled.${NC}"
    exit 1
fi

# Step 1: Rebuild the application locally
echo -e "${GREEN}📦 Step 1: Building the application locally...${NC}"
cd "$(dirname "$0")/../.." # Go to project root
pnpm install
pnpm build

# Step 2: Start OpenShift build
echo -e "${GREEN}🏗️ Step 2: Building Docker image in OpenShift...${NC}"
cd services/frontend
oc start-build nanopore-frontend --from-dir=. --follow

# Step 3: Wait for the new image to be ready
echo -e "${GREEN}⏳ Step 3: Waiting for new image to be ready...${NC}"
sleep 10

# Step 4: Force a new deployment with the updated image
echo -e "${GREEN}🚀 Step 4: Rolling out new deployment...${NC}"
oc rollout latest dc/nanopore-frontend 2>/dev/null || oc rollout restart deployment/nanopore-frontend

# Step 5: Wait for deployment to complete
echo -e "${GREEN}⏳ Step 5: Waiting for deployment to complete...${NC}"
oc rollout status deployment/nanopore-frontend --timeout=300s

# Step 6: Verify the deployment
echo -e "${GREEN}✅ Step 6: Verifying deployment...${NC}"
PODS=$(oc get pods -l app=nanopore-frontend -o name | head -1)
if [ -n "$PODS" ]; then
    echo -e "${YELLOW}📊 Pod logs (last 20 lines):${NC}"
    oc logs $PODS --tail=20
fi

# Get the route URL
ROUTE_URL=$(oc get route nanopore-frontend-route -o jsonpath='{.spec.host}' 2>/dev/null || echo "Route not found")
if [ "$ROUTE_URL" != "Route not found" ]; then
    echo -e "${GREEN}🌐 Frontend is available at: https://${ROUTE_URL}${NC}"
else
    # Try alternative route name
    ROUTE_URL=$(oc get route nanopore-frontend -o jsonpath='{.spec.host}' 2>/dev/null || echo "Route not found")
    if [ "$ROUTE_URL" != "Route not found" ]; then
        echo -e "${GREEN}🌐 Frontend is available at: https://${ROUTE_URL}${NC}"
    fi
fi

# Show deployment status
echo -e "${YELLOW}📊 Current deployment status:${NC}"
oc get pods -l app=nanopore-frontend

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}🎉 Frontend redeployment completed!${NC}"
echo -e "${YELLOW}💡 TIP: Clear your browser cache (Ctrl+Shift+R or Cmd+Shift+R) to see the latest changes.${NC}"
echo -e "${BLUE}========================================${NC}" 
#!/bin/bash

# Pre-deployment checklist verification script

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Pre-Deployment Checklist for Nanopore Tracking App"
echo "====================================================="
echo

# Check OpenShift login
echo -n "✓ Checking OpenShift login... "
if oc whoami &>/dev/null; then
    echo -e "${GREEN}✓${NC} Logged in as $(oc whoami)"
else
    echo -e "${RED}✗${NC} Not logged in"
    echo "  Run: oc login"
    exit 1
fi

# Check project
echo -n "✓ Checking OpenShift project... "
PROJECT=$(oc project -q)
if [ "$PROJECT" = "dept-barc" ]; then
    echo -e "${GREEN}✓${NC} Using project: $PROJECT"
else
    echo -e "${YELLOW}⚠${NC} Current project: $PROJECT (expected: dept-barc)"
fi

# Check resource quotas
echo -n "✓ Checking resource availability... "
PODS_USED=$(oc get resourcequota default-quota -o jsonpath='{.status.used.pods}' 2>/dev/null || echo "0")
PODS_HARD=$(oc get resourcequota default-quota -o jsonpath='{.status.hard.pods}' 2>/dev/null || echo "20")
PODS_AVAILABLE=$((PODS_HARD - PODS_USED))

MEM_USED=$(oc get resourcequota compute-resources -o jsonpath='{.status.used.limits\.memory}' 2>/dev/null || echo "0")
MEM_HARD=$(oc get resourcequota compute-resources -o jsonpath='{.status.hard.limits\.memory}' 2>/dev/null || echo "4Gi")

echo -e "${GREEN}✓${NC} Pods: $PODS_AVAILABLE available, Memory: $MEM_USED/$MEM_HARD used"

# Check database
echo -n "✓ Checking PostgreSQL database... "
if oc get pods | grep -q postgresql; then
    echo -e "${GREEN}✓${NC} PostgreSQL pod found"
else
    echo -e "${RED}✗${NC} No PostgreSQL pod found"
fi

# Check existing deployments
echo -n "✓ Checking existing nanopore deployments... "
EXISTING=$(oc get deployments | grep -c nanopore || true)
if [ "$EXISTING" -gt 0 ]; then
    echo -e "${YELLOW}⚠${NC} Found $EXISTING existing nanopore deployments"
    oc get deployments | grep nanopore | awk '{print "  - " $1 " (" $2 "/" $3 " ready)"}'
else
    echo -e "${GREEN}✓${NC} No conflicting deployments"
fi

# Check secrets
echo -n "✓ Checking secrets... "
if oc get secret nanopore-secrets &>/dev/null; then
    echo -e "${GREEN}✓${NC} nanopore-secrets exists"
    echo "  ${YELLOW}⚠${NC} Remember to update with secure values!"
else
    echo -e "${RED}✗${NC} nanopore-secrets not found"
    echo "  Run: ./scripts/generate-secrets.sh"
fi

# Check images
echo -n "✓ Checking container images... "
if oc get is | grep -q nanopore; then
    echo -e "${GREEN}✓${NC} Image streams found:"
    oc get is | grep nanopore | awk '{print "  - " $1 " (" $2 ")"}'
else
    echo -e "${YELLOW}⚠${NC} No nanopore image streams found"
    echo "  You may need to build and push images first"
fi

# Resource recommendation
echo
echo "📊 Deployment Recommendations:"
echo "=============================="
if [ "$PODS_AVAILABLE" -lt 2 ] || [[ "$MEM_USED" == *"3"* ]]; then
    echo "  ${YELLOW}⚠${NC} Limited resources detected"
    echo "  Recommended: Use minimal deployment"
    echo "  Command: oc apply -f deployment/openshift/production/minimal-resource-deployment.yaml"
else
    echo "  ${GREEN}✓${NC} Sufficient resources available"
    echo "  Recommended: Use full production deployment"
    echo "  Command: oc apply -f deployment/openshift/production/nanopore-production.yaml"
fi

# Final checklist
echo
echo "📋 Final Checklist:"
echo "=================="
echo "  [ ] Secrets updated with secure values"
echo "  [ ] Database credentials verified"
echo "  [ ] Image built and pushed to registry"
echo "  [ ] Production environment variables reviewed"
echo "  [ ] Backup of current deployment created"

echo
echo "🚦 Ready to deploy? (y/N) "
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo
    echo "✅ Great! Run one of these commands:"
    echo
    if [ "$PODS_AVAILABLE" -lt 2 ]; then
        echo "  oc apply -f deployment/openshift/production/minimal-resource-deployment.yaml"
    else
        echo "  oc apply -f deployment/openshift/production/nanopore-production.yaml"
    fi
else
    echo
    echo "📝 Complete the checklist items above and run this script again."
fi 
#!/bin/bash

# Quick frontend redeployment script for OpenShift
# This script rebuilds and redeploys only the frontend component

set -e

echo "🚀 Quick Frontend Redeployment for Nanopore Tracking App"
echo "======================================================="

# Check if logged in to OpenShift
if ! oc whoami &> /dev/null; then
    echo "❌ Not logged in to OpenShift. Please run 'oc login' first."
    exit 1
fi

# Use the correct namespace
NAMESPACE="dept-barc"
echo "📍 Using namespace: $NAMESPACE"
oc project $NAMESPACE

# Build the frontend
echo ""
echo "🔨 Building frontend..."
pnpm build

# Create a new build if it doesn't exist, or start a new build
echo ""
echo "🏗️  Starting OpenShift build..."
if oc get bc nanopore-tracking-app &> /dev/null; then
    oc start-build nanopore-tracking-app --from-dir=. --follow
else
    echo "❌ Build config not found. Please run the full deployment script first."
    exit 1
fi

# Wait for the new deployment to roll out
echo ""
echo "🔄 Rolling out new deployment..."
oc rollout status deployment/nanopore-tracking-app

# Get the route URL
ROUTE_URL=$(oc get route nanopore-tracking-app -o jsonpath='{.spec.host}')

echo ""
echo "✅ Frontend redeployment complete!"
echo "🌐 Application URL: https://$ROUTE_URL"
echo ""
echo "📊 To view the new dashboard:"
echo "   1. Navigate to https://$ROUTE_URL"
echo "   2. Go to the main dashboard page"
echo "   3. Experience the new real-time insights and AI-powered features!" 
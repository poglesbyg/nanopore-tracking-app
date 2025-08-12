#!/bin/bash

# Script to check OpenShift deployments and find the correct names

echo "=================================================="
echo "OpenShift Deployment Check"
echo "=================================================="

# Login to OpenShift if not already logged in
if ! oc whoami &> /dev/null; then
    echo "Please log in to OpenShift first:"
    oc login
fi

# Set the project
PROJECT_NAME="dept-barc"
echo "Switching to project: $PROJECT_NAME"
oc project $PROJECT_NAME

echo ""
echo "1. All Deployments:"
echo "-------------------"
oc get deployments

echo ""
echo "2. All Services:"
echo "----------------"
oc get services

echo ""
echo "3. All Routes (URLs):"
echo "---------------------"
oc get routes

echo ""
echo "4. All Pods:"
echo "------------"
oc get pods

echo ""
echo "5. Deployments with 'nanopore' in name:"
echo "----------------------------------------"
oc get deployments | grep -i nanopore || echo "No deployments found with 'nanopore' in name"

echo ""
echo "6. Deployments with 'frontend' in name:"
echo "----------------------------------------"
oc get deployments | grep -i frontend || echo "No deployments found with 'frontend' in name"

echo ""
echo "7. All deployment names only:"
echo "------------------------------"
oc get deployments -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'

echo ""
echo "=================================================="
echo "To restart a deployment, use:"
echo "oc rollout restart deployment/<deployment-name>"
echo ""
echo "For example:"
FIRST_DEPLOYMENT=$(oc get deployments -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ ! -z "$FIRST_DEPLOYMENT" ]; then
    echo "oc rollout restart deployment/$FIRST_DEPLOYMENT"
fi
echo "=================================================="

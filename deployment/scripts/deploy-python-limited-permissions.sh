#!/bin/bash

# Limited Permissions Deployment Script for Python Microservices
# Works with existing namespace permissions

set -e

# Configuration - Use existing namespace
NAMESPACE="dept-barc"
ENVIRONMENT="production"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(openssl rand -base64 32)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 64)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."
    
    # Check if oc is installed
    if ! command -v oc &> /dev/null; then
        error "OpenShift CLI (oc) not found. Please install it first."
        exit 1
    fi
    
    # Check if logged in to OpenShift
    if ! oc whoami &> /dev/null; then
        error "Not logged in to OpenShift. Please run 'oc login' first."
        exit 1
    fi
    
    # Check if we have access to the namespace
    if ! oc get namespace "$NAMESPACE" &> /dev/null; then
        error "No access to namespace $NAMESPACE. Please request access from your admin."
        exit 1
    fi
    
    success "Prerequisites validated"
}

# Use existing namespace
use_existing_namespace() {
    log "Using existing namespace: $NAMESPACE"
    
    # Set current context to the namespace
    oc project "$NAMESPACE"
    success "Switched to namespace $NAMESPACE"
}

# Create secrets (with cleanup on failure)
create_secrets() {
    log "Creating secrets..."
    
    # Database password secret
    if oc get secret python-postgres-secret -n "$NAMESPACE" &> /dev/null; then
        warn "python-postgres-secret already exists, updating..."
        oc delete secret python-postgres-secret -n "$NAMESPACE"
    fi
    
    oc create secret generic python-postgres-secret \
        --from-literal=password="$POSTGRES_PASSWORD" \
        -n "$NAMESPACE"
    success "python-postgres-secret created"
    
    # JWT secret
    if oc get secret python-jwt-secret -n "$NAMESPACE" &> /dev/null; then
        warn "python-jwt-secret already exists, updating..."
        oc delete secret python-jwt-secret -n "$NAMESPACE"
    fi
    
    oc create secret generic python-jwt-secret \
        --from-literal=secret="$JWT_SECRET" \
        -n "$NAMESPACE"
    success "python-jwt-secret created"
    
    # API keys secret (if provided)
    if [[ -n "$OPENAI_API_KEY" ]]; then
        if oc get secret python-api-keys -n "$NAMESPACE" &> /dev/null; then
            warn "python-api-keys secret already exists, updating..."
            oc delete secret python-api-keys -n "$NAMESPACE"
        fi
        
        oc create secret generic python-api-keys \
            --from-literal=openai_api_key="$OPENAI_API_KEY" \
            -n "$NAMESPACE"
        success "python-api-keys secret created"
    fi
}

# Deploy lightweight PostgreSQL databases
deploy_databases() {
    log "Deploying PostgreSQL databases..."
    
    # Deploy databases with smaller resource requirements
    for db in sample auth ai file audit; do
        log "Deploying python-${db}-db..."
        
        # Create PVC
        cat <<EOF | oc apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: python-${db}-db-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
EOF
        
        # Create database deployment
        cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-${db}-db
  namespace: $NAMESPACE
  labels:
    app: python-${db}-db
    component: database
spec:
  replicas: 1
  selector:
    matchLabels:
      app: python-${db}-db
  template:
    metadata:
      labels:
        app: python-${db}-db
        component: database
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: ${db}_db
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: python-postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        readinessProbe:
          exec:
            command:
              - /bin/sh
              - -c
              - pg_isready -U postgres
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          exec:
            command:
              - /bin/sh
              - -c
              - pg_isready -U postgres
          initialDelaySeconds: 30
          periodSeconds: 30
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: python-${db}-db-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: python-${db}-db
  namespace: $NAMESPACE
  labels:
    app: python-${db}-db
    component: database
spec:
  selector:
    app: python-${db}-db
  ports:
  - port: 5432
    targetPort: 5432
EOF
        
        success "python-${db}-db deployed"
    done
}

# Deploy Python microservices with smaller footprint
deploy_python_services() {
    log "Deploying Python microservices..."
    
    # API Gateway
    cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-gateway
  namespace: $NAMESPACE
  labels:
    app: python-gateway
    component: api-gateway
spec:
  replicas: 1
  selector:
    matchLabels:
      app: python-gateway
  template:
    metadata:
      labels:
        app: python-gateway
        component: api-gateway
    spec:
      containers:
      - name: gateway
        image: python:3.12-slim
        command:
        - /bin/sh
        - -c
        - |
          pip install fastapi uvicorn[standard] httpx
          cat > /app/main.py << 'EOL'
          from fastapi import FastAPI
          from fastapi.middleware.cors import CORSMiddleware
          import httpx
          import os
          
          app = FastAPI(title="Python API Gateway", version="1.0.0")
          
          app.add_middleware(
              CORSMiddleware,
              allow_origins=["*"],
              allow_credentials=True,
              allow_methods=["*"],
              allow_headers=["*"],
          )
          
          @app.get("/health")
          async def health():
              return {
                  "service": "python-api-gateway",
                  "status": "healthy",
                  "version": "1.0.0"
              }
          
          @app.get("/")
          async def root():
              return {"message": "Python API Gateway", "status": "running"}
          EOL
          cd /app && python -m uvicorn main:app --host 0.0.0.0 --port 8000
        env:
        - name: PORT
          value: "8000"
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: python-gateway
  namespace: $NAMESPACE
  labels:
    app: python-gateway
    component: api-gateway
spec:
  selector:
    app: python-gateway
  ports:
  - port: 8000
    targetPort: 8000
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: python-gateway
  namespace: $NAMESPACE
  labels:
    app: python-gateway
    component: api-gateway
spec:
  to:
    kind: Service
    name: python-gateway
  port:
    targetPort: 8000
  tls:
    termination: edge
EOF
    
    success "Python API Gateway deployed"
}

# Wait for deployments to be ready
wait_for_deployments() {
    log "Waiting for deployments to be ready..."
    
    # Wait for gateway
    log "Waiting for python-gateway to be ready..."
    oc rollout status deployment/python-gateway -n "$NAMESPACE" --timeout=300s
    success "python-gateway is ready"
    
    # Wait for databases
    local databases=("python-sample-db" "python-auth-db" "python-ai-db" "python-file-db" "python-audit-db")
    
    for db in "${databases[@]}"; do
        log "Waiting for $db to be ready..."
        oc rollout status deployment/$db -n "$NAMESPACE" --timeout=300s
        success "$db is ready"
    done
}

# Run health checks
run_health_checks() {
    log "Running health checks..."
    
    # Get the route URL
    local gateway_url=$(oc get route python-gateway -n "$NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null)
    
    if [[ -n "$gateway_url" ]]; then
        log "Testing health endpoint: https://$gateway_url/health"
        
        # Wait a bit for the service to be fully ready
        sleep 10
        
        if curl -s -f "https://$gateway_url/health" > /dev/null; then
            success "Health check passed"
        else
            warn "Health check failed, but services may still be starting"
        fi
        
        # Display the URL for manual testing
        echo
        echo "🌐 Gateway URL: https://$gateway_url"
        echo "📚 Test endpoints:"
        echo "  - https://$gateway_url/health"
        echo "  - https://$gateway_url/"
        echo
    else
        warn "Could not determine gateway URL"
    fi
}

# Cleanup function
cleanup_on_error() {
    error "Deployment failed. Cleaning up resources..."
    
    # Remove deployments
    oc delete deployment --selector=component=api-gateway -n "$NAMESPACE" --ignore-not-found=true
    oc delete deployment --selector=component=database -n "$NAMESPACE" --ignore-not-found=true
    
    # Remove services
    oc delete service --selector=component=api-gateway -n "$NAMESPACE" --ignore-not-found=true
    oc delete service --selector=component=database -n "$NAMESPACE" --ignore-not-found=true
    
    # Remove routes
    oc delete route --selector=component=api-gateway -n "$NAMESPACE" --ignore-not-found=true
    
    # Remove PVCs
    oc delete pvc --selector=component=database -n "$NAMESPACE" --ignore-not-found=true
    
    warn "Cleanup completed"
}

# Main deployment function
main() {
    log "Starting limited-permissions deployment of Python microservices..."
    
    # Set up error handling
    trap cleanup_on_error ERR
    
    validate_prerequisites
    use_existing_namespace
    create_secrets
    deploy_databases
    
    # Wait for databases to be ready
    log "Waiting for databases to initialize..."
    sleep 30
    
    deploy_python_services
    wait_for_deployments
    run_health_checks
    
    success "Limited-permissions deployment completed successfully!"
    
    # Display important information
    local gateway_url=$(oc get route python-gateway -n "$NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null)
    echo
    echo "🎉 Deployment Summary:"
    echo "📍 Namespace: $NAMESPACE"
    echo "🌐 Gateway URL: https://$gateway_url"
    echo "🔧 Resources created with 'python-' prefix to avoid conflicts"
    echo "📊 Monitoring: oc get pods -l component=api-gateway -n $NAMESPACE"
    echo
    echo "🔧 Useful commands:"
    echo "  oc get pods -n $NAMESPACE"
    echo "  oc logs -f deployment/python-gateway -n $NAMESPACE"
    echo "  oc get routes -n $NAMESPACE"
    echo
    echo "🧹 To clean up:"
    echo "  oc delete all -l component=api-gateway -n $NAMESPACE"
    echo "  oc delete all -l component=database -n $NAMESPACE"
    echo "  oc delete pvc -l component=database -n $NAMESPACE"
    echo "  oc delete secret python-postgres-secret python-jwt-secret -n $NAMESPACE"
    echo
}

# Run main function
main "$@" 
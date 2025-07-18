#!/bin/bash

# Production Deployment Script for Python Microservices
# Nanopore Tracking Application

set -e

# Configuration
NAMESPACE="nanopore-prod"
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
    
    # Check if docker is available
    if ! command -v docker &> /dev/null; then
        error "Docker not found. Please install Docker first."
        exit 1
    fi
    
    success "Prerequisites validated"
}

# Create namespace if it doesn't exist
create_namespace() {
    log "Creating namespace: $NAMESPACE"
    
    if oc get namespace "$NAMESPACE" &> /dev/null; then
        warn "Namespace $NAMESPACE already exists"
    else
        oc create namespace "$NAMESPACE"
        success "Namespace $NAMESPACE created"
    fi
    
    # Set current context to the namespace
    oc project "$NAMESPACE"
}

# Create secrets
create_secrets() {
    log "Creating secrets..."
    
    # Database password secret
    if oc get secret postgres-secret -n "$NAMESPACE" &> /dev/null; then
        warn "postgres-secret already exists"
    else
        oc create secret generic postgres-secret \
            --from-literal=password="$POSTGRES_PASSWORD" \
            -n "$NAMESPACE"
        success "postgres-secret created"
    fi
    
    # JWT secret
    if oc get secret jwt-secret -n "$NAMESPACE" &> /dev/null; then
        warn "jwt-secret already exists"
    else
        oc create secret generic jwt-secret \
            --from-literal=secret="$JWT_SECRET" \
            -n "$NAMESPACE"
        success "jwt-secret created"
    fi
    
    # API keys secret (if provided)
    if [[ -n "$OPENAI_API_KEY" ]]; then
        if oc get secret api-keys -n "$NAMESPACE" &> /dev/null; then
            warn "api-keys secret already exists"
        else
            oc create secret generic api-keys \
                --from-literal=openai_api_key="$OPENAI_API_KEY" \
                -n "$NAMESPACE"
            success "api-keys secret created"
        fi
    fi
}

# Deploy PostgreSQL databases
deploy_databases() {
    log "Deploying PostgreSQL databases..."
    
    # Create persistent volumes
    cat <<EOF | oc apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: sample-db-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: auth-db-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ai-db-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: file-db-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: audit-db-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
EOF
    
    # Deploy databases
    for db in sample auth ai file audit; do
        log "Deploying ${db}-db..."
        
        cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${db}-db
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${db}-db
  template:
    metadata:
      labels:
        app: ${db}-db
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
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: init-sql
          mountPath: /docker-entrypoint-initdb.d
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
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
          claimName: ${db}-db-pvc
      - name: init-sql
        configMap:
          name: ${db}-db-init
---
apiVersion: v1
kind: Service
metadata:
  name: ${db}-db
  namespace: $NAMESPACE
spec:
  selector:
    app: ${db}-db
  ports:
  - port: 5432
    targetPort: 5432
EOF
    done
    
    success "PostgreSQL databases deployed"
}

# Create database initialization ConfigMaps
create_db_configmaps() {
    log "Creating database initialization ConfigMaps..."
    
    for db in sample auth ai file audit; do
        if [[ -f "../../database/python-migrations/${db}-schema.sql" ]]; then
            oc create configmap ${db}-db-init \
                --from-file=01-schema.sql="../../database/python-migrations/${db}-schema.sql" \
                -n "$NAMESPACE" \
                --dry-run=client -o yaml | oc apply -f -
            success "${db}-db-init ConfigMap created"
        else
            warn "Schema file not found for ${db} database"
        fi
    done
}

# Deploy Python microservices
deploy_python_services() {
    log "Deploying Python microservices..."
    
    # API Gateway
    cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-gateway
  namespace: $NAMESPACE
spec:
  replicas: 2
  selector:
    matchLabels:
      app: python-gateway
  template:
    metadata:
      labels:
        app: python-gateway
    spec:
      containers:
      - name: gateway
        image: ${DOCKER_REGISTRY}/nanopore-python-gateway:${IMAGE_TAG}
        env:
        - name: ENVIRONMENT
          value: production
        - name: PORT
          value: "8000"
        - name: SAMPLE_SERVICE_URL
          value: "http://sample-service:8001"
        - name: AI_SERVICE_URL
          value: "http://ai-service:8002"
        - name: AUTH_SERVICE_URL
          value: "http://auth-service:8003"
        - name: FILE_SERVICE_URL
          value: "http://file-service:8004"
        - name: AUDIT_SERVICE_URL
          value: "http://audit-service:8005"
        - name: SUBMISSION_SERVICE_URL
          value: "http://submission-service:8006"
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
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
spec:
  to:
    kind: Service
    name: python-gateway
  port:
    targetPort: 8000
  tls:
    termination: edge
EOF
    
    # Individual services
    local services=("sample:8001" "ai:8002" "auth:8003" "file:8004" "audit:8005" "submission:8006")
    
    for service_config in "${services[@]}"; do
        IFS=':' read -r service_name service_port <<< "$service_config"
        
        log "Deploying ${service_name}-service..."
        
        cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${service_name}-service
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${service_name}-service
  template:
    metadata:
      labels:
        app: ${service_name}-service
    spec:
      containers:
      - name: ${service_name}
        image: ${DOCKER_REGISTRY}/nanopore-${service_name}-service:${IMAGE_TAG}
        env:
        - name: ENVIRONMENT
          value: production
        - name: PORT
          value: "${service_port}"
        - name: DATABASE_URL
          value: "postgresql://postgres:\$(POSTGRES_PASSWORD)@${service_name}-db:5432/${service_name}_db"
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        ports:
        - containerPort: ${service_port}
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        readinessProbe:
          httpGet:
            path: /health
            port: ${service_port}
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: ${service_port}
          initialDelaySeconds: 30
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: ${service_name}-service
  namespace: $NAMESPACE
spec:
  selector:
    app: ${service_name}-service
  ports:
  - port: ${service_port}
    targetPort: ${service_port}
EOF
    done
    
    success "Python microservices deployed"
}

# Deploy supporting services
deploy_supporting_services() {
    log "Deploying supporting services..."
    
    # Ollama for AI processing
    cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        volumeMounts:
        - name: ollama-data
          mountPath: /root/.ollama
      volumes:
      - name: ollama-data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: ollama
  namespace: $NAMESPACE
spec:
  selector:
    app: ollama
  ports:
  - port: 11434
    targetPort: 11434
EOF
    
    # Redis for caching
    cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: $NAMESPACE
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
EOF
    
    success "Supporting services deployed"
}

# Wait for deployments to be ready
wait_for_deployments() {
    log "Waiting for deployments to be ready..."
    
    local deployments=("python-gateway" "sample-service" "ai-service" "auth-service" "file-service" "audit-service" "submission-service")
    
    for deployment in "${deployments[@]}"; do
        log "Waiting for $deployment to be ready..."
        oc rollout status deployment/$deployment -n "$NAMESPACE" --timeout=300s
        success "$deployment is ready"
    done
}

# Run health checks
run_health_checks() {
    log "Running health checks..."
    
    # Get the route URL
    local gateway_url=$(oc get route python-gateway -n "$NAMESPACE" -o jsonpath='{.spec.host}')
    
    if [[ -n "$gateway_url" ]]; then
        log "Testing health endpoint: https://$gateway_url/health"
        
        if curl -s -f "https://$gateway_url/health" > /dev/null; then
            success "Health check passed"
        else
            warn "Health check failed, but services may still be starting"
        fi
    else
        warn "Could not determine gateway URL"
    fi
}

# Main deployment function
main() {
    log "Starting production deployment of Python microservices..."
    
    validate_prerequisites
    create_namespace
    create_secrets
    create_db_configmaps
    deploy_databases
    
    # Wait for databases to be ready
    log "Waiting for databases to be ready..."
    sleep 30
    
    deploy_python_services
    deploy_supporting_services
    wait_for_deployments
    run_health_checks
    
    success "Production deployment completed successfully!"
    
    # Display important information
    local gateway_url=$(oc get route python-gateway -n "$NAMESPACE" -o jsonpath='{.spec.host}')
    echo
    echo "🎉 Deployment Summary:"
    echo "📍 Namespace: $NAMESPACE"
    echo "🌐 Gateway URL: https://$gateway_url"
    echo "🔐 Admin credentials: admin@nanopore.local / admin123"
    echo "📊 Monitoring: Check OpenShift console for metrics"
    echo
    echo "🔧 Useful commands:"
    echo "  oc get pods -n $NAMESPACE"
    echo "  oc logs -f deployment/python-gateway -n $NAMESPACE"
    echo "  oc get routes -n $NAMESPACE"
    echo
}

# Run main function
main "$@" 
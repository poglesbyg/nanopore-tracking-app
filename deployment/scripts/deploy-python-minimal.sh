#!/bin/bash

# Minimal Python Microservices Deployment (Single Database)
# Works within storage quota limits

set -e

# Configuration
NAMESPACE="dept-barc"
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

# Check storage quota
check_storage_quota() {
    log "Checking storage quota..."
    
    local quota_info=$(oc describe quota default-quota -n "$NAMESPACE" 2>/dev/null || echo "No quota found")
    echo "$quota_info" | grep -i storage || echo "Storage quota: Not found"
    
    local used_storage=$(oc get pvc -n "$NAMESPACE" --no-headers | awk '{sum += $4} END {print sum}' 2>/dev/null || echo "0")
    log "Current storage usage: checking existing PVCs..."
    oc get pvc -n "$NAMESPACE" --no-headers | awk '{print $1 ": " $4}' || echo "No PVCs found"
    
    warn "Using minimal storage approach due to quota limits"
}

# Deploy single shared database
deploy_shared_database() {
    log "Deploying shared PostgreSQL database..."
    
    # Create minimal PVC (500Mi)
    cat <<EOF | oc apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: python-shared-db-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
EOF
    
    # Create database deployment with all schemas
    cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-shared-db
  namespace: $NAMESPACE
  labels:
    app: python-shared-db
    component: database
spec:
  replicas: 1
  selector:
    matchLabels:
      app: python-shared-db
  template:
    metadata:
      labels:
        app: python-shared-db
        component: database
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: nanopore_shared
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
        - name: init-sql
          mountPath: /docker-entrypoint-initdb.d
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
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: python-shared-db-pvc
      - name: init-sql
        configMap:
          name: python-db-init
---
apiVersion: v1
kind: Service
metadata:
  name: python-shared-db
  namespace: $NAMESPACE
  labels:
    app: python-shared-db
    component: database
spec:
  selector:
    app: python-shared-db
  ports:
  - port: 5432
    targetPort: 5432
EOF
    
    success "Shared PostgreSQL database deployed"
}

# Create database initialization script
create_db_init_script() {
    log "Creating database initialization script..."
    
    cat <<EOF | oc apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: python-db-init
  namespace: $NAMESPACE
data:
  01-init.sql: |
    -- Create all schemas in a single database
    
    -- Sample Management Tables
    CREATE TABLE IF NOT EXISTS samples (
        id VARCHAR(36) PRIMARY KEY,
        sample_name VARCHAR(255) NOT NULL,
        project_id VARCHAR(255),
        submitter_name VARCHAR(255) NOT NULL,
        submitter_email VARCHAR(255) NOT NULL,
        lab_name VARCHAR(255),
        sample_type VARCHAR(50),
        status VARCHAR(20) DEFAULT 'submitted',
        priority VARCHAR(20) DEFAULT 'normal',
        assigned_to VARCHAR(255),
        library_prep_by VARCHAR(255),
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255),
        concentration DECIMAL(10,2),
        volume DECIMAL(10,2),
        flow_cell_type VARCHAR(50),
        chart_field VARCHAR(255)
    );
    
    -- Authentication Tables
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT FALSE,
        organization VARCHAR(255),
        department VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status);
    CREATE INDEX IF NOT EXISTS idx_samples_created_at ON samples(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    
    -- Insert sample data
    INSERT INTO samples (id, sample_name, submitter_name, submitter_email, status, chart_field) 
    VALUES 
        ('sample-001', 'Test Sample 1', 'John Doe', 'john@example.com', 'submitted', 'NANO-001'),
        ('sample-002', 'Test Sample 2', 'Jane Smith', 'jane@example.com', 'prep', 'NANO-002')
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert admin user (password: admin123)
    INSERT INTO users (id, email, username, full_name, hashed_password, role, is_active, is_verified) 
    VALUES (
        'admin-001', 
        'admin@nanopore.local', 
        'admin', 
        'System Administrator', 
        '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj7gNkSgBxUO',
        'admin', 
        TRUE, 
        TRUE
    ) ON CONFLICT (id) DO NOTHING;
EOF
    
    success "Database initialization script created"
}

# Deploy lightweight Python API Gateway
deploy_api_gateway() {
    log "Deploying Python API Gateway..."
    
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
          mkdir -p /app
          pip install fastapi uvicorn[standard] psycopg2-binary
          cat > /app/main.py << 'EOL'
          from fastapi import FastAPI, HTTPException
          from fastapi.middleware.cors import CORSMiddleware
          import psycopg2
          import os
          import json
          from datetime import datetime
          
          app = FastAPI(title="Python Microservices Gateway", version="1.0.0")
          
          app.add_middleware(
              CORSMiddleware,
              allow_origins=["*"],
              allow_credentials=True,
              allow_methods=["*"],
              allow_headers=["*"],
          )
          
          # Database connection
          def get_db_connection():
              return psycopg2.connect(
                  host="python-shared-db",
                  database="nanopore_shared",
                  user="postgres",
                  password=os.getenv("POSTGRES_PASSWORD", "password")
              )
          
          @app.get("/health")
          async def health():
              try:
                  conn = get_db_connection()
                  cursor = conn.cursor()
                  cursor.execute("SELECT 1")
                  cursor.close()
                  conn.close()
                  db_status = "healthy"
              except Exception as e:
                  db_status = f"unhealthy: {str(e)}"
              
              return {
                  "service": "python-microservices-gateway",
                  "status": "healthy",
                  "database": db_status,
                  "version": "1.0.0",
                  "timestamp": datetime.now().isoformat()
              }
          
          @app.get("/")
          async def root():
              return {
                  "message": "Python Microservices Gateway",
                  "status": "running",
                  "endpoints": ["/health", "/samples", "/users"]
              }
          
          @app.get("/samples")
          async def get_samples():
              try:
                  conn = get_db_connection()
                  cursor = conn.cursor()
                  cursor.execute("SELECT id, sample_name, submitter_name, submitter_email, status, chart_field FROM samples ORDER BY created_at DESC LIMIT 10")
                  rows = cursor.fetchall()
                  cursor.close()
                  conn.close()
                  
                  samples = []
                  for row in rows:
                      samples.append({
                          "id": row[0],
                          "sample_name": row[1],
                          "submitter_name": row[2],
                          "submitter_email": row[3],
                          "status": row[4],
                          "chart_field": row[5]
                      })
                  
                  return {"samples": samples, "count": len(samples)}
              except Exception as e:
                  raise HTTPException(status_code=500, detail=str(e))
          
          @app.get("/users")
          async def get_users():
              try:
                  conn = get_db_connection()
                  cursor = conn.cursor()
                  cursor.execute("SELECT id, username, email, full_name, role FROM users")
                  rows = cursor.fetchall()
                  cursor.close()
                  conn.close()
                  
                  users = []
                  for row in rows:
                      users.append({
                          "id": row[0],
                          "username": row[1],
                          "email": row[2],
                          "full_name": row[3],
                          "role": row[4]
                      })
                  
                  return {"users": users, "count": len(users)}
              except Exception as e:
                  raise HTTPException(status_code=500, detail=str(e))
          EOL
          cd /app && python -m uvicorn main:app --host 0.0.0.0 --port 8000
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: python-postgres-secret
              key: password
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
          initialDelaySeconds: 15
          periodSeconds: 10
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

# Main deployment function
main() {
    log "Starting minimal Python microservices deployment..."
    
    # Use existing namespace
    oc project "$NAMESPACE"
    
    # Check storage quota
    check_storage_quota
    
    # Create secrets if they don't exist
    if ! oc get secret python-postgres-secret -n "$NAMESPACE" &> /dev/null; then
        oc create secret generic python-postgres-secret \
            --from-literal=password="$POSTGRES_PASSWORD" \
            -n "$NAMESPACE"
        success "python-postgres-secret created"
    fi
    
    # Deploy components
    create_db_init_script
    deploy_shared_database
    
    # Wait for database to be ready
    log "Waiting for database to initialize..."
    sleep 20
    
    deploy_api_gateway
    
    # Wait for deployment
    log "Waiting for deployments to be ready..."
    oc rollout status deployment/python-shared-db -n "$NAMESPACE" --timeout=300s
    oc rollout status deployment/python-gateway -n "$NAMESPACE" --timeout=300s
    
    success "Minimal deployment completed successfully!"
    
    # Display results
    local gateway_url=$(oc get route python-gateway -n "$NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null)
    echo
    echo "🎉 Minimal Python Microservices Deployed!"
    echo "📍 Namespace: $NAMESPACE"
    echo "🌐 Gateway URL: https://$gateway_url"
    echo "📚 API Endpoints:"
    echo "  - https://$gateway_url/health"
    echo "  - https://$gateway_url/samples"
    echo "  - https://$gateway_url/users"
    echo "  - https://$gateway_url/docs (FastAPI docs)"
    echo
    echo "🔧 Test commands:"
    echo "  curl https://$gateway_url/health"
    echo "  curl https://$gateway_url/samples"
    echo
    echo "🧹 To clean up:"
    echo "  oc delete all -l component=api-gateway -n $NAMESPACE"
    echo "  oc delete all -l component=database -n $NAMESPACE"
    echo "  oc delete pvc python-shared-db-pvc -n $NAMESPACE"
    echo "  oc delete configmap python-db-init -n $NAMESPACE"
    echo "  oc delete secret python-postgres-secret -n $NAMESPACE"
    echo
}

# Run main function
main "$@" 
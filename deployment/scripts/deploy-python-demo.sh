#!/bin/bash

# Demo Python Microservices Deployment (No Persistent Storage)
# Works within OpenShift security constraints

set -e

# Configuration
NAMESPACE="dept-barc"

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

# Deploy Python microservices demo
deploy_python_demo() {
    log "Deploying Python microservices demo..."
    
    # Sample Management Service
    cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-sample-service
  namespace: $NAMESPACE
  labels:
    app: python-sample-service
    component: microservice
spec:
  replicas: 1
  selector:
    matchLabels:
      app: python-sample-service
  template:
    metadata:
      labels:
        app: python-sample-service
        component: microservice
    spec:
      containers:
      - name: sample-service
        image: python:3.12-slim
        command:
        - /bin/sh
        - -c
        - |
          pip install fastapi uvicorn[standard]
          cat > /app/main.py << 'EOL'
          from fastapi import FastAPI
          from fastapi.middleware.cors import CORSMiddleware
          from datetime import datetime
          import uuid
          
          app = FastAPI(title="Sample Management Service", version="1.0.0")
          
          app.add_middleware(
              CORSMiddleware,
              allow_origins=["*"],
              allow_credentials=True,
              allow_methods=["*"],
              allow_headers=["*"],
          )
          
          # In-memory data store
          samples = [
              {
                  "id": "sample-001",
                  "sample_name": "Demo Sample 1",
                  "submitter_name": "John Doe",
                  "submitter_email": "john@example.com",
                  "status": "submitted",
                  "chart_field": "NANO-001",
                  "created_at": "2025-01-18T09:00:00Z"
              },
              {
                  "id": "sample-002",
                  "sample_name": "Demo Sample 2",
                  "submitter_name": "Jane Smith",
                  "submitter_email": "jane@example.com",
                  "status": "prep",
                  "chart_field": "NANO-002",
                  "created_at": "2025-01-18T10:00:00Z"
              }
          ]
          
          @app.get("/health")
          async def health():
              return {
                  "service": "sample-management",
                  "status": "healthy",
                  "version": "1.0.0",
                  "timestamp": datetime.now().isoformat()
              }
          
          @app.get("/samples")
          async def get_samples():
              return {"samples": samples, "count": len(samples)}
          
          @app.post("/samples")
          async def create_sample(sample: dict):
              new_sample = {
                  "id": str(uuid.uuid4()),
                  "created_at": datetime.now().isoformat(),
                  **sample
              }
              samples.append(new_sample)
              return new_sample
          
          @app.get("/samples/{sample_id}")
          async def get_sample(sample_id: str):
              for sample in samples:
                  if sample["id"] == sample_id:
                      return sample
              return {"error": "Sample not found"}
          EOL
          mkdir -p /app && cd /app && python -m uvicorn main:app --host 0.0.0.0 --port 8001
        ports:
        - containerPort: 8001
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
            port: 8001
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 20
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: python-sample-service
  namespace: $NAMESPACE
  labels:
    app: python-sample-service
    component: microservice
spec:
  selector:
    app: python-sample-service
  ports:
  - port: 8001
    targetPort: 8001
EOF
    
    # Authentication Service
    cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-auth-service
  namespace: $NAMESPACE
  labels:
    app: python-auth-service
    component: microservice
spec:
  replicas: 1
  selector:
    matchLabels:
      app: python-auth-service
  template:
    metadata:
      labels:
        app: python-auth-service
        component: microservice
    spec:
      containers:
      - name: auth-service
        image: python:3.12-slim
        command:
        - /bin/sh
        - -c
        - |
          pip install fastapi uvicorn[standard] passlib[bcrypt] python-jose[cryptography]
          cat > /app/main.py << 'EOL'
          from fastapi import FastAPI, HTTPException
          from fastapi.middleware.cors import CORSMiddleware
          from datetime import datetime
          import hashlib
          
          app = FastAPI(title="Authentication Service", version="1.0.0")
          
          app.add_middleware(
              CORSMiddleware,
              allow_origins=["*"],
              allow_credentials=True,
              allow_methods=["*"],
              allow_headers=["*"],
          )
          
          # In-memory user store
          users = [
              {
                  "id": "admin-001",
                  "username": "admin",
                  "email": "admin@nanopore.local",
                  "full_name": "System Administrator",
                  "role": "admin",
                  "is_active": True,
                  "hashed_password": "admin123"  # In real app, this would be hashed
              },
              {
                  "id": "user-001",
                  "username": "testuser",
                  "email": "user@nanopore.local",
                  "full_name": "Test User",
                  "role": "user",
                  "is_active": True,
                  "hashed_password": "user123"
              }
          ]
          
          @app.get("/health")
          async def health():
              return {
                  "service": "authentication",
                  "status": "healthy",
                  "version": "1.0.0",
                  "timestamp": datetime.now().isoformat()
              }
          
          @app.get("/users")
          async def get_users():
              return {
                  "users": [
                      {k: v for k, v in user.items() if k != "hashed_password"}
                      for user in users
                  ],
                  "count": len(users)
              }
          
          @app.post("/auth/login")
          async def login(credentials: dict):
              username = credentials.get("username")
              password = credentials.get("password")
              
              for user in users:
                  if user["username"] == username and user["hashed_password"] == password:
                      return {
                          "access_token": "demo-token-" + user["id"],
                          "user": {k: v for k, v in user.items() if k != "hashed_password"}
                      }
              
              raise HTTPException(status_code=401, detail="Invalid credentials")
          EOL
          mkdir -p /app && cd /app && python -m uvicorn main:app --host 0.0.0.0 --port 8003
        ports:
        - containerPort: 8003
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
            port: 8003
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 8003
          initialDelaySeconds: 20
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: python-auth-service
  namespace: $NAMESPACE
  labels:
    app: python-auth-service
    component: microservice
spec:
  selector:
    app: python-auth-service
  ports:
  - port: 8003
    targetPort: 8003
EOF
    
    # API Gateway
    cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-api-gateway
  namespace: $NAMESPACE
  labels:
    app: python-api-gateway
    component: api-gateway
spec:
  replicas: 1
  selector:
    matchLabels:
      app: python-api-gateway
  template:
    metadata:
      labels:
        app: python-api-gateway
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
          from fastapi import FastAPI, HTTPException
          from fastapi.middleware.cors import CORSMiddleware
          import httpx
          from datetime import datetime
          
          app = FastAPI(title="Python Microservices API Gateway", version="1.0.0")
          
          app.add_middleware(
              CORSMiddleware,
              allow_origins=["*"],
              allow_credentials=True,
              allow_methods=["*"],
              allow_headers=["*"],
          )
          
          # Service URLs
          SAMPLE_SERVICE_URL = "http://python-sample-service:8001"
          AUTH_SERVICE_URL = "http://python-auth-service:8003"
          
          @app.get("/health")
          async def health():
              services = {}
              
              # Check sample service
              try:
                  async with httpx.AsyncClient() as client:
                      response = await client.get(f"{SAMPLE_SERVICE_URL}/health", timeout=5)
                      services["sample-service"] = "healthy" if response.status_code == 200 else "unhealthy"
              except:
                  services["sample-service"] = "unreachable"
              
              # Check auth service
              try:
                  async with httpx.AsyncClient() as client:
                      response = await client.get(f"{AUTH_SERVICE_URL}/health", timeout=5)
                      services["auth-service"] = "healthy" if response.status_code == 200 else "unhealthy"
              except:
                  services["auth-service"] = "unreachable"
              
              return {
                  "service": "python-microservices-gateway",
                  "status": "healthy",
                  "version": "1.0.0",
                  "timestamp": datetime.now().isoformat(),
                  "services": services
              }
          
          @app.get("/")
          async def root():
              return {
                  "message": "Python Microservices API Gateway",
                  "status": "running",
                  "architecture": "microservices",
                  "services": ["sample-management", "authentication"],
                  "endpoints": {
                      "health": "/health",
                      "samples": "/samples",
                      "users": "/users",
                      "auth": "/auth/login"
                  }
              }
          
          @app.get("/samples")
          async def get_samples():
              try:
                  async with httpx.AsyncClient() as client:
                      response = await client.get(f"{SAMPLE_SERVICE_URL}/samples")
                      return response.json()
              except Exception as e:
                  raise HTTPException(status_code=503, detail=f"Sample service unavailable: {str(e)}")
          
          @app.get("/users")
          async def get_users():
              try:
                  async with httpx.AsyncClient() as client:
                      response = await client.get(f"{AUTH_SERVICE_URL}/users")
                      return response.json()
              except Exception as e:
                  raise HTTPException(status_code=503, detail=f"Auth service unavailable: {str(e)}")
          
          @app.post("/auth/login")
          async def login(credentials: dict):
              try:
                  async with httpx.AsyncClient() as client:
                      response = await client.post(f"{AUTH_SERVICE_URL}/auth/login", json=credentials)
                      return response.json()
              except Exception as e:
                  raise HTTPException(status_code=503, detail=f"Auth service unavailable: {str(e)}")
          EOL
          mkdir -p /app && cd /app && python -m uvicorn main:app --host 0.0.0.0 --port 8000
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
  name: python-api-gateway
  namespace: $NAMESPACE
  labels:
    app: python-api-gateway
    component: api-gateway
spec:
  selector:
    app: python-api-gateway
  ports:
  - port: 8000
    targetPort: 8000
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: python-microservices
  namespace: $NAMESPACE
  labels:
    app: python-api-gateway
    component: api-gateway
spec:
  to:
    kind: Service
    name: python-api-gateway
  port:
    targetPort: 8000
  tls:
    termination: edge
EOF
    
    success "Python microservices demo deployed"
}

# Main deployment function
main() {
    log "Starting Python microservices demo deployment..."
    
    # Use existing namespace
    oc project "$NAMESPACE"
    
    # Deploy microservices
    deploy_python_demo
    
    # Wait for deployments
    log "Waiting for deployments to be ready..."
    oc rollout status deployment/python-sample-service -n "$NAMESPACE" --timeout=300s
    oc rollout status deployment/python-auth-service -n "$NAMESPACE" --timeout=300s
    oc rollout status deployment/python-api-gateway -n "$NAMESPACE" --timeout=300s
    
    success "Demo deployment completed successfully!"
    
    # Display results
    local gateway_url=$(oc get route python-microservices -n "$NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null)
    echo
    echo "🎉 Python Microservices Demo Deployed!"
    echo "📍 Namespace: $NAMESPACE"
    echo "🌐 Gateway URL: https://$gateway_url"
    echo
    echo "📚 API Endpoints:"
    echo "  - https://$gateway_url/health"
    echo "  - https://$gateway_url/samples"
    echo "  - https://$gateway_url/users"
    echo "  - https://$gateway_url/auth/login"
    echo "  - https://$gateway_url/docs (FastAPI docs)"
    echo
    echo "🔧 Test commands:"
    echo "  curl https://$gateway_url/health"
    echo "  curl https://$gateway_url/samples"
    echo "  curl https://$gateway_url/users"
    echo "  curl -X POST https://$gateway_url/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"admin123\"}'"
    echo
    echo "🏗️  Architecture:"
    echo "  - API Gateway (Python FastAPI)"
    echo "  - Sample Management Service (Python FastAPI)"
    echo "  - Authentication Service (Python FastAPI)"
    echo "  - In-memory data (no persistent storage required)"
    echo
    echo "🧹 To clean up:"
    echo "  oc delete all -l component=microservice -n $NAMESPACE"
    echo "  oc delete all -l component=api-gateway -n $NAMESPACE"
    echo
}

# Run main function
main "$@" 
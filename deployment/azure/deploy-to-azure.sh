#!/bin/bash

# Azure Deployment Script for Nanopore Tracking Application
# This script deploys the application to Azure Kubernetes Service (AKS)

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Nanopore App - Azure Deployment${NC}"
echo -e "${BLUE}======================================${NC}"

# Configuration Variables
RESOURCE_GROUP="nanopore-tracking-rg"
LOCATION="eastus"
CLUSTER_NAME="nanopore-cluster"
ACR_NAME="nanoporecr$RANDOM"  # Azure Container Registry name must be globally unique
NODE_COUNT=3
NODE_SIZE="Standard_D2s_v3"
POSTGRES_SERVER_NAME="nanopore-postgres-$RANDOM"
POSTGRES_ADMIN_USER="nanopore_admin"
POSTGRES_ADMIN_PASSWORD="NanoporeP@ss2024!"
POSTGRES_DB_NAME="nanopore_tracking"

# Application configuration
APP_NAME="nanopore-tracking-app"
NAMESPACE="nanopore"

# Check if logged in to Azure
echo -e "${YELLOW}Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${RED}Not logged in to Azure. Please run 'az login' first.${NC}"
    exit 1
fi

SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}✓ Logged in to Azure subscription: ${SUBSCRIPTION}${NC}"

# Function to check if resource exists
resource_exists() {
    local resource_type=$1
    local resource_name=$2
    local resource_group=$3
    
    if [ -z "$resource_group" ]; then
        az $resource_type show --name $resource_name &> /dev/null
    else
        az $resource_type show --name $resource_name --resource-group $resource_group &> /dev/null
    fi
}

# Step 1: Create Resource Group
echo -e "\n${YELLOW}Step 1: Creating Resource Group...${NC}"
if resource_exists group $RESOURCE_GROUP ""; then
    echo -e "${GREEN}✓ Resource group '$RESOURCE_GROUP' already exists${NC}"
else
    az group create --name $RESOURCE_GROUP --location $LOCATION
    echo -e "${GREEN}✓ Resource group created${NC}"
fi

# Step 2: Create Azure Container Registry
echo -e "\n${YELLOW}Step 2: Creating Azure Container Registry...${NC}"
if resource_exists acr $ACR_NAME $RESOURCE_GROUP; then
    echo -e "${GREEN}✓ Container registry '$ACR_NAME' already exists${NC}"
else
    az acr create \
        --resource-group $RESOURCE_GROUP \
        --name $ACR_NAME \
        --sku Basic \
        --admin-enabled true
    echo -e "${GREEN}✓ Container registry created${NC}"
fi

# Get ACR credentials
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

# Step 3: Create AKS Cluster
echo -e "\n${YELLOW}Step 3: Creating AKS Cluster...${NC}"
if resource_exists aks $CLUSTER_NAME $RESOURCE_GROUP; then
    echo -e "${GREEN}✓ AKS cluster '$CLUSTER_NAME' already exists${NC}"
else
    echo -e "${YELLOW}Creating AKS cluster (this may take 5-10 minutes)...${NC}"
    az aks create \
        --resource-group $RESOURCE_GROUP \
        --name $CLUSTER_NAME \
        --node-count $NODE_COUNT \
        --node-vm-size $NODE_SIZE \
        --enable-addons monitoring \
        --generate-ssh-keys \
        --attach-acr $ACR_NAME \
        --network-plugin azure \
        --network-policy azure
    echo -e "${GREEN}✓ AKS cluster created${NC}"
fi

# Step 4: Get AKS Credentials
echo -e "\n${YELLOW}Step 4: Getting AKS credentials...${NC}"
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --overwrite-existing
echo -e "${GREEN}✓ Kubernetes credentials configured${NC}"

# Step 5: Create PostgreSQL Database
echo -e "\n${YELLOW}Step 5: Creating Azure Database for PostgreSQL...${NC}"
if resource_exists postgres server $POSTGRES_SERVER_NAME $RESOURCE_GROUP; then
    echo -e "${GREEN}✓ PostgreSQL server '$POSTGRES_SERVER_NAME' already exists${NC}"
else
    echo -e "${YELLOW}Creating PostgreSQL server (this may take 5-10 minutes)...${NC}"
    az postgres server create \
        --resource-group $RESOURCE_GROUP \
        --name $POSTGRES_SERVER_NAME \
        --location $LOCATION \
        --admin-user $POSTGRES_ADMIN_USER \
        --admin-password $POSTGRES_ADMIN_PASSWORD \
        --sku-name B_Gen5_1 \
        --version 11
    
    # Configure firewall to allow Azure services
    az postgres server firewall-rule create \
        --resource-group $RESOURCE_GROUP \
        --server $POSTGRES_SERVER_NAME \
        --name AllowAzureServices \
        --start-ip-address 0.0.0.0 \
        --end-ip-address 0.0.0.0
    
    # Create database
    az postgres db create \
        --resource-group $RESOURCE_GROUP \
        --server-name $POSTGRES_SERVER_NAME \
        --name $POSTGRES_DB_NAME
    
    echo -e "${GREEN}✓ PostgreSQL server and database created${NC}"
fi

POSTGRES_HOST=$(az postgres server show --resource-group $RESOURCE_GROUP --name $POSTGRES_SERVER_NAME --query fullyQualifiedDomainName -o tsv)

# Step 6: Build and Push Docker Images
echo -e "\n${YELLOW}Step 6: Building and pushing Docker images...${NC}"

# Login to ACR
echo -e "${YELLOW}Logging in to Azure Container Registry...${NC}"
echo $ACR_PASSWORD | docker login $ACR_LOGIN_SERVER -u $ACR_USERNAME --password-stdin

# Build the application
echo -e "${YELLOW}Building application...${NC}"
pnpm build

# Build and push main application
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t $APP_NAME:latest .
docker tag $APP_NAME:latest $ACR_LOGIN_SERVER/$APP_NAME:latest
docker push $ACR_LOGIN_SERVER/$APP_NAME:latest
echo -e "${GREEN}✓ Application image pushed${NC}"

# Build and push MCP servers if they exist
if [ -d "services/mcp-servers" ]; then
    echo -e "${YELLOW}Building MCP server images...${NC}"
    
    # Sample Management MCP Server
    if [ -d "services/mcp-servers/sample-management" ]; then
        docker build -t mcp-sample-management:latest services/mcp-servers/sample-management/
        docker tag mcp-sample-management:latest $ACR_LOGIN_SERVER/mcp-sample-management:latest
        docker push $ACR_LOGIN_SERVER/mcp-sample-management:latest
        echo -e "${GREEN}✓ Sample Management MCP server image pushed${NC}"
    fi
    
    # Nanopore Domain MCP Server
    if [ -d "services/mcp-servers/nanopore-domain" ]; then
        docker build -t mcp-nanopore-domain:latest services/mcp-servers/nanopore-domain/
        docker tag mcp-nanopore-domain:latest $ACR_LOGIN_SERVER/mcp-nanopore-domain:latest
        docker push $ACR_LOGIN_SERVER/mcp-nanopore-domain:latest
        echo -e "${GREEN}✓ Nanopore Domain MCP server image pushed${NC}"
    fi
fi

# Step 7: Create Kubernetes namespace
echo -e "\n${YELLOW}Step 7: Creating Kubernetes namespace...${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
echo -e "${GREEN}✓ Namespace created${NC}"

# Step 8: Create Kubernetes secrets
echo -e "\n${YELLOW}Step 8: Creating Kubernetes secrets...${NC}"

# Database connection string
DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}@${POSTGRES_SERVER_NAME}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB_NAME}?sslmode=require"

kubectl create secret generic nanopore-secrets \
    --namespace=$NAMESPACE \
    --from-literal=database-url="$DATABASE_URL" \
    --from-literal=jwt-secret="$(openssl rand -base64 32)" \
    --from-literal=session-secret="$(openssl rand -base64 32)" \
    --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✓ Secrets created${NC}"

# Step 9: Generate Kubernetes manifests
echo -e "\n${YELLOW}Step 9: Generating Kubernetes manifests...${NC}"
mkdir -p deployment/azure/k8s

# Create deployment manifest
cat > deployment/azure/k8s/deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $APP_NAME
  namespace: $NAMESPACE
spec:
  replicas: 3
  selector:
    matchLabels:
      app: $APP_NAME
  template:
    metadata:
      labels:
        app: $APP_NAME
    spec:
      containers:
      - name: app
        image: $ACR_LOGIN_SERVER/$APP_NAME:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: nanopore-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: nanopore-secrets
              key: jwt-secret
        - name: SESSION_SECRET
          valueFrom:
            secretKeyRef:
              name: nanopore-secrets
              key: session-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
EOF

# Create service manifest
cat > deployment/azure/k8s/service.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: $APP_NAME
  namespace: $NAMESPACE
spec:
  selector:
    app: $APP_NAME
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP
EOF

# Create ingress manifest
cat > deployment/azure/k8s/ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: $APP_NAME-ingress
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: azure/application-gateway
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - $APP_NAME.azure.com
    secretName: $APP_NAME-tls
  rules:
  - host: $APP_NAME.azure.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: $APP_NAME
            port:
              number: 80
EOF

echo -e "${GREEN}✓ Kubernetes manifests generated${NC}"

# Step 10: Deploy to Kubernetes
echo -e "\n${YELLOW}Step 10: Deploying to Kubernetes...${NC}"
kubectl apply -f deployment/azure/k8s/
echo -e "${GREEN}✓ Application deployed${NC}"

# Step 11: Wait for deployment to be ready
echo -e "\n${YELLOW}Step 11: Waiting for deployment to be ready...${NC}"
kubectl rollout status deployment/$APP_NAME -n $NAMESPACE --timeout=300s

# Step 12: Get the application URL
echo -e "\n${YELLOW}Step 12: Getting application URL...${NC}"
echo -e "${YELLOW}Setting up Azure Load Balancer (this may take 2-3 minutes)...${NC}"

# For now, let's create a LoadBalancer service to get a public IP
kubectl expose deployment $APP_NAME \
    --namespace=$NAMESPACE \
    --type=LoadBalancer \
    --name=$APP_NAME-lb \
    --port=80 \
    --target-port=3001 \
    --dry-run=client -o yaml | kubectl apply -f -

# Wait for external IP
echo -e "${YELLOW}Waiting for external IP...${NC}"
for i in {1..30}; do
    EXTERNAL_IP=$(kubectl get svc $APP_NAME-lb -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [ ! -z "$EXTERNAL_IP" ]; then
        break
    fi
    echo -n "."
    sleep 10
done

echo ""

# Summary
echo -e "\n${BLUE}======================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${BLUE}======================================${NC}"
echo -e "\n${YELLOW}Resource Summary:${NC}"
echo -e "  Resource Group: ${GREEN}$RESOURCE_GROUP${NC}"
echo -e "  AKS Cluster: ${GREEN}$CLUSTER_NAME${NC}"
echo -e "  Container Registry: ${GREEN}$ACR_LOGIN_SERVER${NC}"
echo -e "  PostgreSQL Server: ${GREEN}$POSTGRES_HOST${NC}"
echo -e "  Database: ${GREEN}$POSTGRES_DB_NAME${NC}"

if [ ! -z "$EXTERNAL_IP" ]; then
    echo -e "\n${YELLOW}Application Access:${NC}"
    echo -e "  URL: ${GREEN}http://$EXTERNAL_IP${NC}"
    echo -e "  Status: ${GREEN}Ready${NC}"
else
    echo -e "\n${YELLOW}Application Access:${NC}"
    echo -e "  Status: ${YELLOW}Load Balancer provisioning...${NC}"
    echo -e "  Run this command to check status:"
    echo -e "  ${BLUE}kubectl get svc -n $NAMESPACE${NC}"
fi

echo -e "\n${YELLOW}Useful Commands:${NC}"
echo -e "  View pods: ${BLUE}kubectl get pods -n $NAMESPACE${NC}"
echo -e "  View logs: ${BLUE}kubectl logs -n $NAMESPACE -l app=$APP_NAME${NC}"
echo -e "  Scale app: ${BLUE}kubectl scale deployment/$APP_NAME -n $NAMESPACE --replicas=5${NC}"
echo -e "  Port forward: ${BLUE}kubectl port-forward -n $NAMESPACE svc/$APP_NAME 3001:80${NC}"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. Configure a custom domain name"
echo -e "  2. Set up SSL certificates with cert-manager"
echo -e "  3. Configure Azure Application Gateway for advanced routing"
echo -e "  4. Set up monitoring with Azure Monitor"
echo -e "  5. Configure autoscaling policies"

echo -e "\n${BLUE}======================================${NC}" 
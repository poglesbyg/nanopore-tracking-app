# Azure Deployment Guide for Nanopore Tracking Application

## Prerequisites

Before starting, ensure you have:
- Azure CLI installed (`az --version`)
- Docker installed and running
- kubectl installed
- Node.js and pnpm installed
- An Azure subscription

## Step 1: Azure Login

```bash
# Login to Azure
az login

# List subscriptions
az account list --output table

# Set subscription (if you have multiple)
az account set --subscription "Your-Subscription-Name"
```

## Step 2: Create Resource Group

```bash
# Set variables
RESOURCE_GROUP="nanopore-tracking-rg"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION
```

## Step 3: Create Azure Container Registry (ACR)

```bash
# ACR name must be globally unique
ACR_NAME="nanoporecr$(date +%s)"

# Create ACR
az acr create \
    --resource-group $RESOURCE_GROUP \
    --name $ACR_NAME \
    --sku Basic \
    --admin-enabled true

# Get ACR credentials
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

# Login to ACR
echo $ACR_PASSWORD | docker login $ACR_LOGIN_SERVER -u $ACR_USERNAME --password-stdin
```

## Step 4: Build and Push Docker Image

```bash
# Build the application
pnpm build

# Build Docker image
docker build -t nanopore-tracking-app:latest .

# Tag for ACR
docker tag nanopore-tracking-app:latest $ACR_LOGIN_SERVER/nanopore-tracking-app:latest

# Push to ACR
docker push $ACR_LOGIN_SERVER/nanopore-tracking-app:latest
```

## Step 5: Create AKS Cluster

```bash
CLUSTER_NAME="nanopore-cluster"

# Create AKS cluster (this takes 5-10 minutes)
az aks create \
    --resource-group $RESOURCE_GROUP \
    --name $CLUSTER_NAME \
    --node-count 3 \
    --node-vm-size Standard_D2s_v3 \
    --enable-addons monitoring \
    --generate-ssh-keys \
    --attach-acr $ACR_NAME \
    --network-plugin azure \
    --network-policy azure

# Get credentials
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME
```

## Step 6: Create Azure Database for PostgreSQL

```bash
# Database variables
POSTGRES_SERVER_NAME="nanopore-postgres-$(date +%s)"
POSTGRES_ADMIN_USER="nanopore_admin"
POSTGRES_ADMIN_PASSWORD="NanoporeP@ss2024!"
POSTGRES_DB_NAME="nanopore_tracking"

# Create PostgreSQL server (this takes 5-10 minutes)
az postgres server create \
    --resource-group $RESOURCE_GROUP \
    --name $POSTGRES_SERVER_NAME \
    --location $LOCATION \
    --admin-user $POSTGRES_ADMIN_USER \
    --admin-password $POSTGRES_ADMIN_PASSWORD \
    --sku-name B_Gen5_1 \
    --version 11

# Configure firewall for Azure services
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

# Get server hostname
POSTGRES_HOST=$(az postgres server show \
    --resource-group $RESOURCE_GROUP \
    --name $POSTGRES_SERVER_NAME \
    --query fullyQualifiedDomainName -o tsv)
```

## Step 7: Create Kubernetes Resources

### Create Namespace

```bash
kubectl create namespace nanopore
```

### Create Secrets

```bash
# Create database URL
DATABASE_URL="postgresql://${POSTGRES_ADMIN_USER}@${POSTGRES_SERVER_NAME}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB_NAME}?sslmode=require"

# Create secrets
kubectl create secret generic nanopore-secrets \
    --namespace=nanopore \
    --from-literal=database-url="$DATABASE_URL" \
    --from-literal=jwt-secret="$(openssl rand -base64 32)" \
    --from-literal=session-secret="$(openssl rand -base64 32)"
```

### Create Deployment

Create `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nanopore-tracking-app
  namespace: nanopore
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nanopore-tracking-app
  template:
    metadata:
      labels:
        app: nanopore-tracking-app
    spec:
      containers:
      - name: app
        image: <ACR_LOGIN_SERVER>/nanopore-tracking-app:latest
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
```

Apply deployment:

```bash
kubectl apply -f deployment.yaml
```

### Create Service

Create `service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nanopore-tracking-app
  namespace: nanopore
spec:
  selector:
    app: nanopore-tracking-app
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

Apply service:

```bash
kubectl apply -f service.yaml
```

## Step 8: Access the Application

```bash
# Wait for external IP
kubectl get svc -n nanopore -w

# Once EXTERNAL-IP is assigned, access your app:
# http://<EXTERNAL-IP>
```

## Step 9: Set Up SSL with Let's Encrypt (Optional)

### Install cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s
```

### Create ClusterIssuer

Create `cluster-issuer.yaml`:

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

Apply:

```bash
kubectl apply -f cluster-issuer.yaml
```

### Install NGINX Ingress Controller

```bash
# Install NGINX ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

### Create Ingress with SSL

Create `ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nanopore-ingress
  namespace: nanopore
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - nanopore.yourdomain.com
    secretName: nanopore-tls
  rules:
  - host: nanopore.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: nanopore-tracking-app
            port:
              number: 80
```

## Step 10: Configure Monitoring

### Enable Azure Monitor

```bash
# Already enabled with --enable-addons monitoring during cluster creation

# View container insights
az aks show --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --query addonProfiles.omsagent
```

### Set up Application Insights (Optional)

```bash
# Create Application Insights
az monitor app-insights component create \
    --app nanopore-insights \
    --location $LOCATION \
    --resource-group $RESOURCE_GROUP \
    --application-type web

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
    --app nanopore-insights \
    --resource-group $RESOURCE_GROUP \
    --query instrumentationKey -o tsv)

# Add to your deployment as environment variable
```

## Step 11: Set Up Autoscaling

### Horizontal Pod Autoscaler

```bash
# Create HPA
kubectl autoscale deployment nanopore-tracking-app \
    --namespace=nanopore \
    --cpu-percent=70 \
    --min=3 \
    --max=10
```

### Cluster Autoscaler

```bash
# Enable cluster autoscaler
az aks update \
    --resource-group $RESOURCE_GROUP \
    --name $CLUSTER_NAME \
    --enable-cluster-autoscaler \
    --min-count 3 \
    --max-count 10
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n nanopore
kubectl describe pod <pod-name> -n nanopore
kubectl logs <pod-name> -n nanopore
```

### Database Connection Issues

```bash
# Test database connection
kubectl run -it --rm psql --image=postgres:11 --restart=Never -- \
    psql "postgresql://${POSTGRES_ADMIN_USER}@${POSTGRES_SERVER_NAME}:${POSTGRES_ADMIN_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB_NAME}?sslmode=require"
```

### Image Pull Issues

```bash
# Check ACR connection
kubectl get events -n nanopore
kubectl describe pod <pod-name> -n nanopore | grep -A 5 "Events:"
```

## Cost Optimization

1. **Use Spot Instances**: For non-production workloads
   ```bash
   az aks nodepool add \
       --resource-group $RESOURCE_GROUP \
       --cluster-name $CLUSTER_NAME \
       --name spotnodepool \
       --priority Spot \
       --eviction-policy Delete \
       --spot-max-price -1 \
       --node-count 1
   ```

2. **Scale Down During Off-Hours**:
   ```bash
   # Scale down
   kubectl scale deployment nanopore-tracking-app -n nanopore --replicas=1
   
   # Scale up
   kubectl scale deployment nanopore-tracking-app -n nanopore --replicas=3
   ```

3. **Use Azure Dev/Test Pricing**: If eligible

## Clean Up Resources

```bash
# Delete everything (BE CAREFUL!)
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

## Next Steps

1. Set up CI/CD with Azure DevOps or GitHub Actions
2. Configure backup and disaster recovery
3. Implement network policies for security
4. Set up Azure Key Vault for secret management
5. Configure Azure Front Door for global distribution 
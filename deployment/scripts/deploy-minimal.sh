#!/bin/bash

# Deploy minimal nanopore tracking app

echo "🚀 Deploying Minimal Nanopore Tracking App..."

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t nanopore-app-minimal:latest .

# Create or update the deployment
echo "🔄 Updating deployment..."
cat <<EOF | oc apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nanopore-app-minimal
  namespace: dept-barc
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nanopore-app-minimal
  template:
    metadata:
      labels:
        app: nanopore-app-minimal
    spec:
      containers:
      - name: nanopore-app-minimal
        image: nanopore-app-minimal:latest
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 4321
        env:
        - name: NODE_ENV
          value: production
        - name: PUBLIC_API_URL
          value: "https://nanopore-minimal-dept-barc.apps.cloudapps.unc.edu"
        - name: ASTRO_TELEMETRY_DISABLED
          value: "1"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
EOF

# Ensure the service exists
echo "📡 Ensuring service exists..."
cat <<EOF | oc apply -f -
apiVersion: v1
kind: Service
metadata:
  name: nanopore-app-minimal
  namespace: dept-barc
spec:
  selector:
    app: nanopore-app-minimal
  ports:
  - name: http
    port: 80
    targetPort: 4321
    protocol: TCP
EOF

# Check deployment status
echo "⏳ Waiting for deployment to be ready..."
oc rollout status deployment/nanopore-app-minimal -n dept-barc

echo "✅ Deployment complete!"
echo "🌐 Application should be accessible at: https://nanopore-minimal-dept-barc.apps.cloudapps.unc.edu" 
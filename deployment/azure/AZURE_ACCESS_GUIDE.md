# Getting Azure Access at UNC

## Current Situation
You're logged into the UNC IT Services Azure subscription (`unc-itstl-avd-000`) but don't have permissions to create resources. This is typical for shared enterprise subscriptions.

## Options to Get Access

### Option 1: Request Permissions from UNC IT
Contact UNC IT Services and request one of the following:

1. **Contributor Role** on the current subscription
   - Email: help@unc.edu
   - Request: "Azure Contributor access to create resources in subscription unc-itstl-avd-000"
   - Justification: "Deploying research application for nanopore sequencing tracking"

2. **Access to Existing Resource Group**
   - Ask if there's a resource group for research applications
   - Request Contributor role on that specific resource group

3. **New Resource Group**
   - Request creation of a new resource group: `nanopore-tracking-rg`
   - Request Contributor role on that resource group

### Option 2: Request Research Computing Resources
UNC Research Computing may have separate Azure resources:

1. Contact Research Computing: https://its.unc.edu/research-computing/
2. Request Azure resources for research project
3. They may have dedicated subscriptions for research workloads

### Option 3: Use Your Own Azure Account
1. Create free Azure account: https://azure.microsoft.com/free/
   - $200 credit for 30 days
   - Free tier services for 12 months
   - Always free services

2. Create student account (if eligible): https://azure.microsoft.com/free/students/
   - $100 credit
   - No credit card required

## While Waiting for Access

### Run Locally with Docker Compose
```bash
# Use the local Azure simulation
docker-compose -f docker-compose.azure-local.yml up -d

# Access the application
open http://localhost
```

### Deploy to Other Platforms
1. **Heroku**: Simple deployment with free tier
2. **DigitalOcean**: $200 credit with GitHub Student Pack
3. **Google Cloud**: $300 free credit
4. **AWS**: 12 months free tier

## Required Azure Permissions

When requesting access, specify you need these permissions:

### Minimum Required Roles
- **Resource Group Contributor**: Create and manage resources within a resource group
- **Azure Kubernetes Service Contributor**: Create and manage AKS clusters
- **Azure Database for PostgreSQL Contributor**: Create and manage PostgreSQL servers

### Resources You'll Create
- 1 Resource Group
- 1 Azure Kubernetes Service (AKS) cluster (3 nodes)
- 1 Azure Container Registry
- 1 Azure Database for PostgreSQL server
- 1 Public IP for load balancer

### Estimated Costs
- Development: ~$150-200/month
- Production: ~$300-500/month
- Can be reduced with:
  - Spot instances
  - Auto-scaling
  - Scheduled shutdowns

## Email Template for IT Request

```
Subject: Azure Resource Access Request for Research Application

Hello IT Services,

I need Azure access to deploy a research application for tracking nanopore sequencing samples. 

Project Details:
- Application: Nanopore Sample Tracking System
- Purpose: Laboratory sample management and workflow tracking
- Department: [Your Department]
- Principal Investigator: [PI Name]

Resources Needed:
- Permission to create a resource group
- Ability to deploy:
  - Azure Kubernetes Service (AKS)
  - Azure Database for PostgreSQL
  - Azure Container Registry
  - Load Balancer with Public IP

Could you please either:
1. Grant me Contributor role on subscription unc-itstl-avd-000, OR
2. Create a resource group "nanopore-tracking-rg" and grant me Contributor access, OR
3. Provide access to an existing resource group for research applications

Expected monthly cost: ~$200 for development environment

Thank you,
[Your Name]
```

## Next Steps

1. Send the access request to UNC IT
2. While waiting, test locally with Docker Compose
3. Once you have access, run the deployment script:
   ```bash
   ./deployment/azure/deploy-to-azure.sh
   ``` 
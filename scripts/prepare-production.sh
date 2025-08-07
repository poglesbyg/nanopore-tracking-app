#!/bin/bash

# Production Preparation Script for Nanopore Tracking Application
# This script automates the production readiness steps

set -e

echo "========================================="
echo "Nanopore Tracking - Production Preparation"
echo "========================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# 1. Check uncommitted changes
echo ""
echo "1. Checking Git Status..."
if [ -n "$(git status --porcelain)" ]; then
    print_warning "You have uncommitted changes:"
    git status --short
    echo ""
    read -p "Do you want to commit these changes now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add -A
        read -p "Enter commit message: " commit_msg
        git commit -m "$commit_msg"
        git push origin main
        print_status "Changes committed and pushed"
    else
        print_warning "Continuing with uncommitted changes..."
    fi
else
    print_status "Working directory is clean"
fi

# 2. Build the application
echo ""
echo "2. Building Application..."
if npm run build; then
    print_status "Build successful"
else
    print_error "Build failed! Please fix build errors before continuing."
    exit 1
fi

# 3. Check for environment file
echo ""
echo "3. Checking Environment Configuration..."
if [ ! -f .env.production ]; then
    print_warning "Production environment file not found"
    if [ -f config/production.env.template ]; then
        echo "Creating .env.production from template..."
        cp config/production.env.template .env.production
        print_warning "Please update .env.production with actual values!"
        print_warning "Generating secure secrets..."
        
        # Generate secure secrets (URL-safe base64 to avoid sed issues)
        JWT_SECRET=$(openssl rand -base64 32 | tr -d "=\n/" | cut -c 1-32)
        SESSION_SECRET=$(openssl rand -base64 32 | tr -d "=\n/" | cut -c 1-32)
        ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "=\n/" | cut -c 1-16)
        
        # Create a temporary file with the secrets
        cp .env.production .env.production.tmp
        
        # Use a different approach for replacing secrets
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS version
            awk -v jwt="$JWT_SECRET" -v session="$SESSION_SECRET" -v admin="$ADMIN_PASSWORD" '
                /^JWT_SECRET=/ { print "JWT_SECRET=" jwt; next }
                /^SESSION_SECRET=/ { print "SESSION_SECRET=" session; next }
                /^ADMIN_PASSWORD=/ { print "ADMIN_PASSWORD=" admin; next }
                { print }
            ' .env.production.tmp > .env.production
        else
            # Linux version
            awk -v jwt="$JWT_SECRET" -v session="$SESSION_SECRET" -v admin="$ADMIN_PASSWORD" '
                /^JWT_SECRET=/ { print "JWT_SECRET=" jwt; next }
                /^SESSION_SECRET=/ { print "SESSION_SECRET=" session; next }
                /^ADMIN_PASSWORD=/ { print "ADMIN_PASSWORD=" admin; next }
                { print }
            ' .env.production.tmp > .env.production
        fi
        
        rm -f .env.production.tmp
        
        print_status "Secrets generated and saved to .env.production"
        echo ""
        echo "Generated credentials:"
        echo "Admin Password: $ADMIN_PASSWORD"
        echo "(Save this password securely - it won't be shown again)"
    else
        print_error "No template file found!"
        exit 1
    fi
else
    print_status "Production environment file exists"
fi

# 4. Check Docker
echo ""
echo "4. Checking Docker..."
if docker info > /dev/null 2>&1; then
    print_status "Docker is running"
    
    # Build Docker images
    echo "Building Docker images..."
    if docker build -t nanopore-app:latest -f Dockerfile.production .; then
        print_status "Docker image built successfully"
    else
        print_warning "Docker build failed - continuing without Docker"
    fi
else
    print_warning "Docker is not running - skipping Docker build"
fi

# 5. Run database migrations
echo ""
echo "5. Database Migrations..."
read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f run-migrations.js ]; then
        node run-migrations.js
        print_status "Migrations completed"
    else
        print_warning "Migration script not found"
    fi
else
    print_warning "Skipping database migrations"
fi

# 6. Security check
echo ""
echo "6. Security Audit..."
npm audit --audit-level=high > /dev/null 2>&1
audit_result=$?
if [ $audit_result -eq 0 ]; then
    print_status "No high-severity vulnerabilities found"
else
    print_warning "Security vulnerabilities detected. Run 'npm audit' for details"
    read -p "Do you want to try auto-fix? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm audit fix
    fi
fi

# 7. Create production checklist
echo ""
echo "7. Production Checklist..."
cat << EOF > PRODUCTION_DEPLOY_CHECKLIST.md
# Production Deployment Checklist
Generated: $(date)

## Pre-Deployment
- [ ] All changes committed and pushed
- [ ] Build successful
- [ ] Environment variables configured
- [ ] Secrets properly set
- [ ] Database migrations ready

## Deployment
- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Verify health endpoints
- [ ] Check logs for errors
- [ ] Test critical user flows

## Post-Deployment
- [ ] Monitor application metrics
- [ ] Check error rates
- [ ] Verify performance
- [ ] Backup database
- [ ] Document any issues

## Rollback Plan
1. Keep previous version tagged
2. Database rollback scripts ready
3. Quick rollback command: \`oc rollout undo deployment/nanopore-app\`

## Contacts
- Development Team: [Your Email]
- Operations: [Ops Email]
- On-Call: [Phone Number]
EOF

print_status "Deployment checklist created: PRODUCTION_DEPLOY_CHECKLIST.md"

# 8. OpenShift Deployment (if configured)
echo ""
echo "8. OpenShift Deployment..."
if command -v oc &> /dev/null; then
    print_status "OpenShift CLI found"
    read -p "Do you want to deploy to OpenShift now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Select deployment type:"
        echo "1) Production (full resources)"
        echo "2) Minimal (resource-optimized)"
        echo "3) Skip deployment"
        read -p "Enter choice (1-3): " deploy_choice
        
        case $deploy_choice in
            1)
                oc apply -f deployment/openshift/production/nanopore-production.yaml
                print_status "Production deployment initiated"
                ;;
            2)
                oc apply -f deployment/openshift/production/minimal-resource-deployment.yaml
                print_status "Minimal deployment initiated"
                ;;
            *)
                print_warning "Skipping deployment"
                ;;
        esac
    fi
else
    print_warning "OpenShift CLI not found - manual deployment required"
fi

# 9. Summary
echo ""
echo "========================================="
echo "Production Preparation Summary"
echo "========================================="
echo ""

# Check what's ready
ready_items=0
total_items=8

[ -z "$(git status --porcelain)" ] && ((ready_items++)) && print_status "Git: Clean working directory" || print_warning "Git: Uncommitted changes"
[ -f dist/server/entry.mjs ] && ((ready_items++)) && print_status "Build: Application built" || print_error "Build: Not built"
[ -f .env.production ] && ((ready_items++)) && print_status "Config: Environment file exists" || print_error "Config: Missing environment file"
docker info > /dev/null 2>&1 && ((ready_items++)) && print_status "Docker: Running" || print_warning "Docker: Not running"
[ $audit_result -eq 0 ] && ((ready_items++)) && print_status "Security: No high vulnerabilities" || print_warning "Security: Vulnerabilities found"

echo ""
echo "Ready: $ready_items/$total_items items"
echo ""

if [ $ready_items -eq $total_items ]; then
    print_status "Application is ready for production deployment!"
else
    print_warning "Some items need attention before production deployment"
fi

echo ""
echo "Next steps:"
echo "1. Review and update .env.production with actual values"
echo "2. Test the application thoroughly in staging"
echo "3. Complete the deployment checklist"
echo "4. Deploy to production with monitoring"
echo ""
echo "For detailed instructions, see PRODUCTION_READINESS_ASSESSMENT.md"

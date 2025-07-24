#!/bin/bash

# Generate secure secrets for production deployment

echo "🔐 Generating secure secrets for production deployment..."
echo

# Generate JWT secret (32 chars)
JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "JWT_SECRET: $JWT_SECRET"

# Generate admin password (16 chars)
ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
echo "ADMIN_PASSWORD: $ADMIN_PASSWORD"

# Generate session secret (32 chars)
SESSION_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "SESSION_SECRET: $SESSION_SECRET"

# Get database credentials
echo
echo "📋 Current database configuration:"
echo "Please provide the PostgreSQL connection details:"
read -p "Database host [postgresql]: " DB_HOST
DB_HOST=${DB_HOST:-postgresql}

read -p "Database port [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database name [nanopore_db]: " DB_NAME
DB_NAME=${DB_NAME:-nanopore_db}

read -p "Database user [nanopore_user]: " DB_USER
DB_USER=${DB_USER:-nanopore_user}

read -sp "Database password: " DB_PASSWORD
echo

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo
echo "✅ Generated secrets:"
echo "===================="
echo "DATABASE_URL: postgresql://${DB_USER}:****@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "JWT_SECRET: $JWT_SECRET"
echo "ADMIN_PASSWORD: $ADMIN_PASSWORD"
echo "SESSION_SECRET: $SESSION_SECRET"

echo
echo "📝 To update the OpenShift secret, run:"
echo
cat << EOF
oc create secret generic nanopore-secrets \\
  --from-literal=DATABASE_URL="${DATABASE_URL}" \\
  --from-literal=JWT_SECRET="${JWT_SECRET}" \\
  --from-literal=ADMIN_PASSWORD="${ADMIN_PASSWORD}" \\
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \\
  --dry-run=client -o yaml | oc apply -f -
EOF

echo
echo "Or manually edit the secret:"
echo "  oc edit secret nanopore-secrets" 
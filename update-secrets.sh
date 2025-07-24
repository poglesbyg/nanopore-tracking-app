#!/bin/bash

# Update OpenShift secrets with generated secure values

echo "🔐 Updating nanopore-secrets in OpenShift..."

oc create secret generic nanopore-secrets \
  --from-literal=DATABASE_URL="postgresql://nanopore_user:nanopore@postgresql:5432/nanopore_db" \
  --from-literal=JWT_SECRET="g4rsT36S0uWF0LWVo23nSbZRL4UgdsC0" \
  --from-literal=ADMIN_PASSWORD="g1tN4Id1xx1re5Ps" \
  --from-literal=SESSION_SECRET="lyZjnYHP3BNJmbeHCbNxGeoNd6t6953e" \
  --dry-run=client -o yaml | oc apply -f -

echo "✅ Secrets updated!"
echo
echo "⚠️  Note: The database password is still using the default 'nanopore'."
echo "    For production, you should change this in PostgreSQL and update the secret." 
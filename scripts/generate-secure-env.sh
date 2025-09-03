#!/bin/bash

# Generate Secure Environment Configuration
# This script creates a .env file with secure random passwords

set -e

echo "🔐 Generating secure environment configuration..."

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists. Creating backup..."
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Generate secure random passwords
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Copy from example and replace placeholders
cp .env.example .env

# Generate secure passwords
POSTGRES_PASSWORD=$(generate_password)
POSTGRES_REPLICA_PASSWORD=$(generate_password)
TEMPORAL_POSTGRES_PASSWORD=$(generate_password)

# Replace placeholders with secure passwords
sed -i "s/your-secure-postgres-password/$POSTGRES_PASSWORD/g" .env
sed -i "s/your-secure-replica-password/$POSTGRES_REPLICA_PASSWORD/g" .env
sed -i "s/your-secure-temporal-password/$TEMPORAL_POSTGRES_PASSWORD/g" .env

echo "✅ Secure environment configuration generated!"
echo ""
echo "🔑 Generated passwords:"
echo "   - PostgreSQL: $POSTGRES_PASSWORD"
echo "   - Replica: $POSTGRES_REPLICA_PASSWORD"
echo "   - Temporal: $TEMPORAL_POSTGRES_PASSWORD"
echo ""
echo "⚠️  IMPORTANT: Store these passwords securely!"
echo "   - Add .env to .gitignore (should already be there)"
echo "   - Use a password manager for production"
echo "   - Never commit .env to version control"
echo ""
echo "🚀 Next steps:"
echo "   1. Review .env file and update other configuration values"
echo "   2. Run: ./dev.sh restart"
echo "   3. Verify services start with new credentials"

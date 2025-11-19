#!/bin/bash

# Fix database password authentication issue

set -e

echo "Fixing database password authentication..."

# Get the password from .env file
DB_PASSWORD=$(grep "DB_PASSWORD=" /var/www/sps/backend/.env | cut -d'=' -f2)

echo "Password from .env: $DB_PASSWORD"

# Update PostgreSQL user password
sudo -u postgres psql << EOF
ALTER USER sps_user WITH PASSWORD '$DB_PASSWORD';
\q
EOF

echo "✓ Database password updated successfully!"
echo ""
echo "Now restart the API server:"
echo "  cd /var/www/sps/backend"
echo "  npm run dev"

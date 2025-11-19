#!/bin/bash

# SPS Database Setup Script
# Run with: sudo bash setup-database.sh

set -e

echo "================================="
echo "SPS Database Setup"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Configuration
DB_NAME="sps_db"
DB_USER="sps_user"
DB_PASSWORD="sps_secure_$(openssl rand -hex 12)"

echo "Step 1/5: Creating database and user..."

# Create database and user
sudo -u postgres psql << EOF
-- Create database
CREATE DATABASE ${DB_NAME};

-- Create user with password
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to the database and grant schema privileges
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};

\q
EOF

echo "✓ Database and user created"

# Import schema
echo ""
echo "Step 2/5: Importing database schema..."
sudo -u postgres psql -d ${DB_NAME} -f /var/www/sps/database/schema.sql

echo "✓ Schema imported"

# Grant permissions on existing tables
echo ""
echo "Step 3/5: Setting permissions..."
sudo -u postgres psql -d ${DB_NAME} << EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
\q
EOF

echo "✓ Permissions set"

# Create .env file
echo ""
echo "Step 4/5: Creating backend .env file..."

cat > /var/www/sps/backend/.env << EOF
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# JWT Configuration
JWT_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_EXPIRES_IN=30d

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:80,http://localhost

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

chmod 600 /var/www/sps/backend/.env
chown tne:tne /var/www/sps/backend/.env

echo "✓ Environment file created"

# Verify setup
echo ""
echo "Step 5/5: Verifying database setup..."
sudo -u postgres psql -d ${DB_NAME} -c "\dt" | head -20

echo ""
echo "================================="
echo "Database Setup Complete!"
echo "================================="
echo ""
echo "Database Credentials:"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo "  Password: ${DB_PASSWORD}"
echo ""
echo "⚠️  IMPORTANT: Save these credentials securely!"
echo "They have been saved to: /var/www/sps/backend/.env"
echo ""
echo "Next steps:"
echo "  1. Install Node.js dependencies:"
echo "     cd /var/www/sps/backend && npm install"
echo ""
echo "  2. Start the API server:"
echo "     npm run dev"

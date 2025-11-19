# SPS Database Setup Guide

## Overview

The Survival Preparedness System (SPS) uses a PostgreSQL database for storing user data, inventory, emergency plans, and more.

## Database Architecture

### Core Tables

1. **Users & Authentication**
   - `users` - User accounts and profiles
   - `user_sessions` - Active login sessions with JWT tokens

2. **Inventory Management**
   - `inventory_categories` - Categories for organizing items
   - `inventory_items` - User's preparedness supplies
   - `inventory_transactions` - History of all inventory changes

3. **Emergency Planning**
   - `emergency_plans` - Disaster response plans
   - `plan_steps` - Detailed steps for each plan

4. **Family & Contacts**
   - `family_members` - Family and group members
   - `meeting_points` - Emergency meeting locations

5. **Skills & Training**
   - `skills` - Available survival skills
   - `user_skills` - User's skill progress and proficiency

6. **Alerts & Notifications**
   - `alerts` - System notifications and warnings

7. **Resources**
   - `documents` - Important document storage
   - `checklists` - Preparedness checklists
   - `checklist_items` - Individual checklist items

8. **Sharing**
   - `shared_access` - Multi-user access control

## Installation Steps

### 1. Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE sps_db;
CREATE USER sps_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE sps_db TO sps_user;
\q
```

### 3. Import Schema

```bash
# Import the schema
psql -U sps_user -d sps_db -f /var/www/sps/database/schema.sql

# Or if you need to use sudo:
sudo -u postgres psql -d sps_db -f /var/www/sps/database/schema.sql
```

### 4. Verify Tables

```bash
psql -U sps_user -d sps_db

# List all tables
\dt

# Check a specific table
\d users
```

## Backend Setup

### 1. Install Node.js and Dependencies

```bash
cd /var/www/sps/backend

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your settings
nano .env
```

Update these values in `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sps_db
DB_USER=sps_user
DB_PASSWORD=your_secure_password
JWT_SECRET=generate_a_long_random_string_here
```

### 3. Start the API Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

### 4. Configure Nginx as Reverse Proxy

Create `/etc/nginx/sites-available/sps-api`:

```nginx
server {
    listen 3000;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/sps-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update profile

### Inventory
- `GET /api/inventory` - Get all items
- `GET /api/inventory/:id` - Get single item
- `POST /api/inventory` - Create item
- `PUT /api/inventory/:id` - Update item
- `DELETE /api/inventory/:id` - Delete item
- `GET /api/inventory/stats/overview` - Get inventory statistics
- `GET /api/inventory/categories/all` - Get all categories

### Emergency Plans
- `GET /api/plans` - Get all plans
- `POST /api/plans` - Create plan

### Family Members
- `GET /api/family` - Get all family members

### Skills
- `GET /api/skills` - Get all available skills
- `GET /api/skills/my-skills` - Get user's skill progress

### Alerts
- `GET /api/alerts` - Get all alerts
- `PUT /api/alerts/:id/read` - Mark alert as read

## Testing the API

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "securepassword123",
    "first_name": "Test",
    "last_name": "User"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "securepassword123"
  }'
```

### Add Inventory Item (requires token from login)
```bash
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Canned Beans",
    "category_id": 1,
    "quantity": 24,
    "unit": "cans",
    "location": "Basement Shelf A",
    "expiration_date": "2025-12-31"
  }'
```

## Production Deployment

### 1. Use PM2 for Process Management

```bash
# Install PM2
sudo npm install -g pm2

# Start the app
cd /var/www/sps/backend
pm2 start server.js --name sps-api

# Save the process list
pm2 save

# Setup startup script
pm2 startup
```

### 2. Enable SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. Database Backups

```bash
# Create backup script
cat > /usr/local/bin/backup-sps-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/sps"
mkdir -p $BACKUP_DIR
pg_dump -U sps_user sps_db > $BACKUP_DIR/sps_db_$(date +%Y%m%d_%H%M%S).sql
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-sps-db.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-sps-db.sh") | crontab -
```

## Security Best Practices

1. **Strong Passwords**: Use strong, unique passwords for database users
2. **JWT Secrets**: Generate long, random JWT secrets
3. **HTTPS Only**: Always use SSL/TLS in production
4. **Rate Limiting**: The API includes rate limiting by default
5. **Input Validation**: All endpoints validate input
6. **SQL Injection Protection**: Using parameterized queries
7. **Environment Variables**: Never commit `.env` files
8. **Regular Backups**: Schedule automated database backups
9. **Update Dependencies**: Regularly update npm packages
10. **Firewall**: Configure firewall to restrict database access

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
sudo -u postgres psql -l

# Test connection
psql -U sps_user -d sps_db -h localhost
```

### API Not Starting
```bash
# Check logs
pm2 logs sps-api

# Test database connection
node -e "require('./config/database').query('SELECT NOW()')"
```

### Permission Errors
```bash
# Grant all privileges
sudo -u postgres psql -d sps_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sps_user;"
sudo -u postgres psql -d sps_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sps_user;"
```

## Next Steps

1. Implement remaining API endpoints for plans, family, skills, etc.
2. Add file upload functionality for documents and photos
3. Implement email notifications
4. Create scheduled jobs for expiration alerts
5. Build frontend integration with the API
6. Add data export functionality
7. Implement sharing/collaboration features

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

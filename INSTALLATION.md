# SPS Installation Guide

## Quick Start (Automated)

Run the complete setup script to install everything automatically:

```bash
cd /var/www/sps
sudo bash scripts/complete-setup.sh
```

This will install PostgreSQL, create the database, install Node.js, and configure everything.

---

## Step-by-Step Installation (Manual)

If you prefer to install components individually:

### Step 1: Install PostgreSQL

```bash
sudo bash /var/www/sps/scripts/install-postgres.sh
```

This installs PostgreSQL 14+ and starts the service.

### Step 2: Create Database and Import Schema

```bash
sudo bash /var/www/sps/scripts/setup-database.sh
```

This will:
- Create the `sps_db` database
- Create the `sps_user` with a secure random password
- Import all tables from [schema.sql](database/schema.sql)
- Create the `.env` file with database credentials
- Generate secure JWT secrets

**Important:** Save the database credentials shown in the output!

### Step 3: Install Node.js

```bash
sudo bash /var/www/sps/scripts/install-nodejs.sh
```

Installs Node.js 18.x LTS and npm.

### Step 4: Install Backend Dependencies

```bash
cd /var/www/sps/backend
npm install
```

Installs all required npm packages (Express, PostgreSQL driver, JWT, etc.)

### Step 5: Start the API Server

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

The API will be available at `http://localhost:3000`

---

## Verify Installation

### Check PostgreSQL

```bash
sudo systemctl status postgresql
```

### Check Database Tables

```bash
sudo -u postgres psql -d sps_db -c "\dt"
```

You should see 16 tables including:
- users
- user_sessions
- inventory_items
- inventory_categories
- emergency_plans
- family_members
- skills
- alerts
- etc.

### Test API Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-19T..."}
```

### Test User Registration

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePass123!",
    "first_name": "Test",
    "last_name": "User"
  }'
```

---

## Configuration Files

### Database Credentials

Location: `/var/www/sps/backend/.env`

```bash
cat /var/www/sps/backend/.env
```

**Never commit this file to version control!**

### Environment Variables

Key settings in `.env`:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database connection
- `JWT_SECRET` - Token signing key
- `PORT` - API server port (default: 3000)
- `NODE_ENV` - development or production

---

## Production Deployment

### Use PM2 for Process Management

```bash
# Install PM2
sudo npm install -g pm2

# Start the API
cd /var/www/sps/backend
pm2 start server.js --name sps-api

# Save process list
pm2 save

# Setup auto-start on reboot
pm2 startup
# Run the command it outputs

# View logs
pm2 logs sps-api

# Restart after changes
pm2 restart sps-api
```

### Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/sps-api`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Serve frontend
    root /var/www/sps;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Proxy API requests
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

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/sps-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Enable SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Database Backups

### Create Backup Script

```bash
sudo nano /usr/local/bin/backup-sps-db.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/sps"
mkdir -p $BACKUP_DIR
pg_dump -U sps_user -h localhost sps_db > $BACKUP_DIR/sps_db_$(date +%Y%m%d_%H%M%S).sql
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
```

Make executable:
```bash
sudo chmod +x /usr/local/bin/backup-sps-db.sh
```

### Schedule Daily Backups

```bash
sudo crontab -e
```

Add:
```
0 2 * * * /usr/local/bin/backup-sps-db.sh
```

---

## Troubleshooting

### PostgreSQL won't start

```bash
sudo systemctl status postgresql
sudo journalctl -u postgresql -n 50
```

### Database connection refused

Check PostgreSQL is listening:
```bash
sudo -u postgres psql -c "SHOW listen_addresses;"
```

Edit `/etc/postgresql/14/main/postgresql.conf` if needed:
```
listen_addresses = 'localhost'
```

### API can't connect to database

Check credentials in `.env` match database:
```bash
psql -U sps_user -d sps_db -h localhost
# Enter password from .env file
```

### Permission errors

Grant all privileges:
```bash
sudo -u postgres psql -d sps_db
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sps_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sps_user;
\q
```

### Port 3000 already in use

Change port in `.env`:
```
PORT=3001
```

Or kill the process:
```bash
lsof -ti:3000 | xargs kill -9
```

---

## Uninstall

### Remove Database

```bash
sudo -u postgres psql
DROP DATABASE sps_db;
DROP USER sps_user;
\q
```

### Remove PostgreSQL

```bash
sudo apt remove --purge postgresql postgresql-contrib
sudo rm -rf /var/lib/postgresql
```

### Remove Node.js

```bash
sudo apt remove --purge nodejs
sudo rm -rf /usr/lib/node_modules
```

---

## Next Steps

1. ✅ PostgreSQL installed
2. ✅ Database created and schema imported
3. ✅ Backend API configured
4. 🔄 Test API endpoints (see [DATABASE_SETUP.md](DATABASE_SETUP.md))
5. 🔄 Build frontend integration
6. 🔄 Deploy to production with PM2 + Nginx
7. 🔄 Enable SSL with Let's Encrypt
8. 🔄 Setup automated backups

---

## Support

For issues, check:
- [DATABASE_SETUP.md](DATABASE_SETUP.md) - Detailed API documentation
- [docs/database-comparison.md](docs/database-comparison.md) - Why PostgreSQL?
- PostgreSQL logs: `sudo journalctl -u postgresql`
- API logs: `pm2 logs sps-api`

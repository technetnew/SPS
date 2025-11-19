# SPS Quick Start

## One-Command Installation

```bash
cd /var/www/sps
sudo bash scripts/complete-setup.sh
```

That's it! This installs and configures everything.

---

## Start the API

```bash
cd /var/www/sps/backend
npm run dev
```

API runs at: `http://localhost:3000`

---

## Test the API

```bash
# Health check
curl http://localhost:3000/health

# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@example.com","password":"SecurePass123!","first_name":"John","last_name":"Doe"}'

# Login (save the token from response)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"john","password":"SecurePass123!"}'

# Add inventory item (replace YOUR_TOKEN)
curl -X POST http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Canned Beans","quantity":24,"unit":"cans","category_id":1}'

# Get all inventory
curl -X GET http://localhost:3000/api/inventory \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Files You Need to Know

| File | Purpose |
|------|---------|
| [INSTALLATION.md](INSTALLATION.md) | Detailed setup guide |
| [DATABASE_SETUP.md](DATABASE_SETUP.md) | Complete API reference |
| [backend/.env](backend/.env) | Database credentials (created during setup) |
| [database/schema.sql](database/schema.sql) | Database structure |
| [scripts/](scripts/) | Installation scripts |

---

## Common Commands

```bash
# Start API (dev mode)
cd /var/www/sps/backend && npm run dev

# Start API (production with PM2)
pm2 start server.js --name sps-api
pm2 logs sps-api

# Database access
sudo -u postgres psql -d sps_db

# Check PostgreSQL status
sudo systemctl status postgresql

# View tables
sudo -u postgres psql -d sps_db -c "\dt"

# Restart everything
pm2 restart sps-api
sudo systemctl restart postgresql
```

---

## Production Checklist

- [ ] Run complete setup script
- [ ] Configure Nginx reverse proxy
- [ ] Install PM2 and setup auto-start
- [ ] Enable SSL with Let's Encrypt
- [ ] Setup database backups (cron)
- [ ] Update `.env` with production settings
- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Configure firewall (ufw)
- [ ] Test all API endpoints

---

## Get Help

- Installation issues? See [INSTALLATION.md](INSTALLATION.md)
- API questions? See [DATABASE_SETUP.md](DATABASE_SETUP.md)
- Database choice? See [docs/database-comparison.md](docs/database-comparison.md)

# Fork and Deploy Guide

Complete guide for forking SPS and deploying to your own server.

## ⚡ Quick Deploy (5 Steps)

### Step 1: Fork the Repository
1. Go to https://github.com/technetnew/SPS
2. Click "Fork" button (top right)
3. Select your account
4. Wait for fork to complete

### Step 2: Get a Server
Choose any provider:
- **DigitalOcean**: $6/month droplet
- **Linode**: $5/month instance
- **AWS**: Free tier eligible
- **Vultr**: $6/month instance
- **Hetzner**: €4/month VPS
- **Your own hardware**: Any Ubuntu/Debian server

Requirements:
- Ubuntu 20.04+ or Debian 11+
- 2GB RAM (4GB recommended)
- 20GB disk space
- Public IP address

### Step 3: Connect to Server
```bash
# SSH into your server
ssh root@your-server-ip

# Or with key:
ssh -i your-key.pem ubuntu@your-server-ip
```

### Step 4: Install SPS
```bash
# Clone YOUR fork (replace YOUR_USERNAME)
git clone https://github.com/YOUR_USERNAME/SPS.git
cd SPS

# Run installer
sudo bash install.sh
```

The installer will:
- ✅ Install all dependencies automatically
- ✅ Create database with secure random password
- ✅ Configure Nginx
- ✅ Start the application
- ✅ Take 10-15 minutes

### Step 5: Access Your System
```bash
# After installation, you'll see:
# Access your system:
#   Homepage: http://YOUR_SERVER_IP/
#   Dashboard: http://YOUR_SERVER_IP/dashboard.html
```

Open that URL in your browser and create your first user account!

## 🎯 That's It!

You now have your own SPS installation. Everything is included:
- Multi-user system with sharing
- Video library with YouTube downloads
- Offline knowledge (Kiwix)
- Inventory management
- Emergency planning
- All features ready to use

## 🔒 Post-Installation Security

### 1. Enable HTTPS (Strongly Recommended)
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
```

### 2. Configure Firewall
```bash
# Enable UFW firewall
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### 3. Setup Backups
```bash
# Create backup script
cat > /usr/local/bin/sps-backup.sh << 'BACKUP'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/sps"
mkdir -p $BACKUP_DIR

# Backup database
sudo -u postgres pg_dump sps_db | gzip > $BACKUP_DIR/sps_db_$DATE.sql.gz

# Backup uploads and videos
tar -czf $BACKUP_DIR/sps_files_$DATE.tar.gz /var/www/sps/uploads /var/www/sps/videos

# Keep only last 7 days
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
BACKUP

chmod +x /usr/local/bin/sps-backup.sh

# Run daily at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/sps-backup.sh >> /var/log/sps-backup.log 2>&1") | crontab -
```

### 4. Update Your Fork Regularly
```bash
# Add upstream remote (original repo)
git remote add upstream https://github.com/technetnew/SPS.git

# Get updates
git fetch upstream
git merge upstream/main

# Restart application
pm2 restart sps-api
```

## 🛠️ Customization

### Change Domain/Port

Edit `/etc/nginx/sites-available/sps` if you want to:
- Use a custom domain
- Change ports
- Add SSL configuration

### Modify Branding

Edit these files:
- `index.html` - Homepage
- `styles.css` - Global styles
- Replace logo images
- Update footer text

### Add Custom Features

The codebase is organized:
```
SPS/
├── backend/routes/     # Add new API endpoints here
├── js/                 # Add frontend JavaScript
├── css/                # Add custom styles
├── database/           # Database migrations
└── README.md           # Update documentation
```

## 💰 Monetization Ideas

Now that you have your own fork:

### 1. Hosted Solution
- Offer SPS as a service
- Charge monthly subscription
- Handle hosting, updates, backups
- Target price: $10-50/month

### 2. Custom Deployments
- Install for customers on their servers
- One-time setup fee: $500-1000
- Maintenance contracts: $100/month
- Custom feature development

### 3. Training & Support
- Video tutorials
- Live training sessions
- Priority support packages
- Consulting services

### 4. White Label
- Rebrand for organizations
- Add organization-specific features
- Enterprise deployments
- Multi-tenant solutions

### 5. App Store
- Create mobile apps (React Native)
- Publish to iOS/Android stores
- In-app purchases for features
- Subscription model

## 📊 Monitoring

### Check System Health
```bash
# API status
pm2 status

# View logs
pm2 logs sps-api

# Database size
sudo -u postgres psql -d sps_db -c "SELECT pg_size_pretty(pg_database_size('sps_db'));"

# Disk usage
df -h

# Memory usage
free -h
```

### Log Locations
- API logs: `pm2 logs sps-api`
- Nginx access: `/var/log/nginx/access.log`
- Nginx errors: `/var/log/nginx/error.log`
- System logs: `journalctl -u nginx -f`

## 🐛 Common Issues

### "Port 80 already in use"
```bash
# Stop existing web server
sudo systemctl stop apache2
# or
sudo systemctl stop lighttpd
```

### "Database connection failed"
```bash
# Check PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Check password in .env matches database
cat backend/.env | grep DB_PASSWORD
```

### "502 Bad Gateway"
```bash
# Backend not running
pm2 restart sps-api

# Check logs
pm2 logs sps-api --lines 50
```

### Cannot access from outside
```bash
# Check firewall
sudo ufw status

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check server has public IP
curl ifconfig.me
```

## 📞 Support

- **Documentation**: Check the [README.md](README.md)
- **Issues**: https://github.com/technetnew/SPS/issues
- **Testing Guide**: See [INSTALLATION_TEST.md](INSTALLATION_TEST.md)
- **Original Repo**: https://github.com/technetnew/SPS

## ✅ Success Checklist

After deployment, verify:

- [ ] Website accessible from internet
- [ ] Can create user accounts
- [ ] Can login/logout
- [ ] Can upload videos
- [ ] Can download YouTube videos
- [ ] Kiwix page loads
- [ ] Can share resources between users
- [ ] PM2 shows "online"
- [ ] No errors in logs
- [ ] HTTPS working (if configured)
- [ ] Firewall enabled
- [ ] Backups configured

## 🎓 Learning Resources

### Understand the Stack
- **Node.js/Express**: Backend API framework
- **PostgreSQL**: Database
- **Nginx**: Web server and reverse proxy
- **PM2**: Process manager
- **yt-dlp**: YouTube downloader
- **Kiwix**: Offline content server

### Extend Functionality
- Add new API routes in `backend/routes/`
- Add frontend pages as HTML files
- Modify database in `database/` folder
- Update styles in `css/` folder

### Best Practices
- Always test changes locally first
- Use git branches for features
- Keep fork updated with upstream
- Document your changes
- Test before deploying to production

---

**You're now ready to run your own SPS instance!**

Need help? Open an issue on GitHub or check the documentation.

**Happy Prepping! 🎯**

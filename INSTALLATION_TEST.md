# Installation Testing Guide

This document helps you test the SPS installation on a fresh server.

## Prerequisites Testing

### Test Server Requirements
- **OS**: Ubuntu 20.04+, Debian 11+, or similar
- **RAM**: 2GB minimum (4GB recommended)
- **Disk**: 20GB free space
- **Network**: Internet connection for downloads
- **Access**: Root/sudo privileges

### Quick Verification
```bash
# Check OS version
lsb_release -a

# Check available RAM
free -h

# Check disk space
df -h

# Check sudo access
sudo whoami  # Should output: root
```

## Installation Methods

### Method 1: One-Command Install (Recommended for Testing)

```bash
# Fresh Ubuntu/Debian server
git clone https://github.com/technetnew/SPS.git
cd SPS
sudo bash install.sh
```

**Expected Duration**: 10-15 minutes

**What it does:**
1. Updates system packages
2. Installs PostgreSQL
3. Installs Node.js 18+
4. Installs Nginx
5. Installs PM2
6. Installs FFmpeg & yt-dlp
7. Installs Kiwix server
8. Creates database with secure password
9. Imports all schemas
10. Installs Node dependencies
11. Auto-generates .env file
12. Configures Nginx
13. Starts backend with PM2

**Success Indicators:**
- ✅ Script completes without errors
- ✅ Shows "Installation Complete! 🎉"
- ✅ Displays server IP and URLs
- ✅ PM2 shows sps-api as "online"

### Method 2: Manual Step-by-Step

```bash
git clone https://github.com/technetnew/SPS.git
cd SPS

# Install dependencies
sudo bash scripts/complete-setup.sh

# Copy and configure environment
cp backend/.env.example backend/.env
nano backend/.env  # Edit as needed

# Deploy
sudo bash scripts/deploy-production.sh
```

## Post-Installation Tests

### 1. Check Services

```bash
# PostgreSQL
sudo systemctl status postgresql | grep Active
# Should show: active (running)

# Nginx
sudo systemctl status nginx | grep Active
# Should show: active (running)

# Backend API
pm2 status
# Should show: sps-api | online

# View logs
pm2 logs sps-api --lines 20
# Should show no errors
```

### 2. Test Database Connection

```bash
# Connect to database
sudo -u postgres psql -d sps_db -c "SELECT COUNT(*) FROM users;"

# Should return a count (0 if no users yet)
```

### 3. Test API Endpoints

```bash
# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

# Health check
curl http://localhost:3000/health
# Expected: {"status":"ok","timestamp":"..."}

# Test through Nginx proxy
curl http://localhost/api/auth/login
# Expected: JSON error (no credentials provided - this is normal)
```

### 4. Test Web Interface

Open in browser:
- `http://your-server-ip/` - Homepage
- `http://your-server-ip/dashboard.html` - Dashboard (redirects to login)
- `http://your-server-ip/videos.html` - Videos page
- `http://your-server-ip/kiwix.html` - Kiwix page

**Expected Behavior:**
- Pages load without 404 errors
- Login modal appears on protected pages
- CSS and JavaScript load correctly
- No console errors (check browser DevTools)

### 5. Test User Registration

1. Go to homepage
2. Click "Register"
3. Fill in:
   - Username: testuser
   - Email: test@example.com
   - Password: SecurePass123
4. Click Register
5. Should redirect to dashboard

### 6. Test Video Upload

1. Login as testuser
2. Go to Videos page
3. Click "Upload"
4. Select a small video file (< 100MB)
5. Should show progress bar
6. Video should appear in library

### 7. Test Kiwix

1. Go to Kiwix page
2. Check server status (should show "offline")
3. Try starting server (if you have ZIM files)
4. Check "Available Content" tab loads

### 8. Test Sharing System

1. Create second user account
2. Login as first user
3. Go to Videos
4. Click Share button on a video
5. Search for second user
6. Grant view permission
7. Login as second user
8. Should see shared video

## Troubleshooting

### Installation Fails

**Error: "Please run as root"**
```bash
# Solution: Use sudo
sudo bash install.sh
```

**Error: "PostgreSQL connection failed"**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Restart if needed
sudo systemctl restart postgresql
```

**Error: "Port 80 already in use"**
```bash
# Check what's using port 80
sudo lsof -i :80

# If it's another web server, stop it
sudo systemctl stop apache2  # or whatever is running
```

### Backend Won't Start

```bash
# Check logs
pm2 logs sps-api

# Common issues:
# - Database connection: Check .env DB_PASSWORD
# - Port in use: Check if port 3000 is available
# - Missing dependencies: cd backend && npm install
```

### Nginx 502 Bad Gateway

```bash
# Backend not running
pm2 status

# Start if needed
pm2 start sps-api

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Cannot Access Website

```bash
# Check firewall
sudo ufw status

# Allow HTTP if needed
sudo ufw allow 80/tcp

# Check Nginx is running
sudo systemctl status nginx
```

## Clean Install Testing

To test on a completely fresh server:

```bash
# Digital Ocean, Linode, AWS, etc.
# 1. Create Ubuntu 20.04 droplet/instance
# 2. SSH in
# 3. Run installation:

apt update
apt install -y git
git clone https://github.com/technetnew/SPS.git
cd SPS
sudo bash install.sh

# Should complete in 10-15 minutes
```

## Fork Testing

To test that forks work correctly:

```bash
# 1. Fork the repository on GitHub
# 2. Clone YOUR fork:
git clone https://github.com/YOUR_USERNAME/SPS.git
cd SPS

# 3. Install
sudo bash install.sh

# Should work identically to original
```

## Success Criteria

A successful installation should have:

- ✅ All services running (PostgreSQL, Nginx, PM2)
- ✅ Database created with proper schemas
- ✅ Backend API responding to requests
- ✅ Web interface accessible
- ✅ User registration/login works
- ✅ Video upload works
- ✅ Kiwix page loads
- ✅ Sharing system accessible
- ✅ No errors in logs
- ✅ Auto-start on reboot configured

## Report Issues

If you encounter problems:

1. Check logs: `pm2 logs sps-api`
2. Check GitHub Issues: https://github.com/technetnew/SPS/issues
3. Include:
   - OS version
   - Error messages
   - Steps to reproduce
   - Log output

---

**Note**: This guide is for testing. For production deployments, also configure:
- SSL/TLS certificates (Let's Encrypt)
- Firewall rules (UFW)
- Database backups
- Log rotation
- Monitoring

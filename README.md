# 🎯 SPS - Survival Preparedness System

A comprehensive web-based platform for managing emergency preparedness, survival resources, offline knowledge, and family coordination. Perfect for preppers, homesteaders, and anyone serious about emergency readiness.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![PostgreSQL](https://img.shields.io/badge/postgresql-14%2B-blue.svg)

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)
- [License](#license)

## ✨ Features

### 📦 Inventory Management
- Track food, water, medical supplies, tools, and equipment
- Expiration date monitoring with automated alerts
- Barcode scanning support
- Location-based organization
- Minimum quantity alerts
- Transaction history

### 📝 Emergency Plans
- Create custom emergency response plans
- Step-by-step action items
- Assign tasks to family members
- Multiple plan types (earthquake, fire, flood, evacuation, etc.)
- Plan templates and customization

### 🎥 Video Library
- Upload local videos or download from YouTube
- yt-dlp integration for video downloads
- Organized playlist system
- List and grid view modes
- Educational content management
- Search and categorization

### 📚 Offline Knowledge (Kiwix)
- Download entire Wikipedia and other encyclopedias
- Medical encyclopedias and WikiHow guides
- Completely offline access
- No internet required after download
- Search across all downloaded content
- Multiple ZIM file support

### 👥 Multi-User & Sharing
- User authentication with JWT tokens
- Share resources between users
- Granular permissions (view, edit, admin)
- Family/group collaboration
- Activity logging and audit trails

### 📱 Additional Features
- Family member profiles with medical information
- Skills tracking and training progress
- Important document storage
- Meeting point/evacuation location management
- Customizable checklists (bug-out bags, 72-hour kits, etc.)
- Alert system for low inventory and expiring items

## 🛠️ Tech Stack

### Backend
- **Node.js** (v18+) - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** (v14+) - Database
- **JWT** - Authentication
- **Helmet** - Security headers
- **Multer** - File uploads
- **yt-dlp** - Video downloads

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5 & CSS3** - Modern, responsive design
- **Fetch API** - HTTP requests
- **LocalStorage** - Client-side persistence

### Infrastructure
- **Nginx** - Reverse proxy & static file serving
- **PM2** - Process management
- **Kiwix Server** - Offline content serving
- **FFmpeg** - Video processing

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/sps.git
cd sps

# Run the installation script
sudo bash scripts/complete-setup.sh

# Configure your environment
cp backend/.env.example backend/.env
nano backend/.env  # Edit with your settings

# Deploy to production
sudo bash scripts/deploy-production.sh

# Access the application
# Open your browser to http://your-server-ip
```

## 📦 Installation

### Prerequisites

- **Ubuntu 20.04+** or **Debian 11+**
- **Sudo access**
- **At least 2GB RAM** (4GB+ recommended)
- **20GB+ free disk space** (more for video and Kiwix content)

### Step 1: System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install FFmpeg and yt-dlp
sudo apt install -y ffmpeg python3-pip
sudo pip3 install yt-dlp

# Install Kiwix Server (optional)
sudo bash scripts/install-kiwix.sh
```

### Step 2: Database Setup

```bash
# Run database setup script
sudo bash scripts/setup-database.sh

# This creates:
# - sps_db database
# - sps_user with secure password
# - All schemas (main, videos, sharing)
# - Initial data
```

### Step 3: Application Setup

```bash
# Clone to /var/www/sps
sudo mkdir -p /var/www/sps
cd /var/www/sps

# Install backend dependencies
cd backend
npm install

# Copy and configure environment
cp .env.example .env
nano .env  # Edit configuration

# Create directories
mkdir -p uploads videos kiwix/data kiwix/library
sudo chown -R $USER:$USER /var/www/sps
```

### Step 4: Nginx Configuration

```bash
# Copy Nginx configuration
sudo cp /etc/nginx/sites-enabled/sps /etc/nginx/sites-available/sps
sudo ln -s /etc/nginx/sites-available/sps /etc/nginx/sites-enabled/sps

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Start Application

```bash
# Start backend API
cd /var/www/sps/backend
pm2 start server.js --name sps-api

# Save PM2 configuration
pm2 save
pm2 startup  # Follow instructions

# Check status
pm2 status
```

## ⚙️ Configuration

### Environment Variables

Create `.env` file in `backend/` directory:

```env
# Server
PORT=3000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sps_db
DB_USER=sps_user
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=30d

# CORS
ALLOWED_ORIGINS=http://your-domain.com

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=10000

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

### Generate Secure Secrets

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📚 Usage

### Creating Your First User

1. Navigate to `http://your-server-ip`
2. Click "Register"
3. Fill in details and create account
4. Log in with credentials

### Managing Inventory

1. Go to **Dashboard** → **Inventory**
2. Click "Add Item"
3. Fill in details
4. Set minimum quantity alerts

### Uploading Videos

1. Go to **Videos**
2. Click "Upload" for local files or "Download" for YouTube
3. Organize into playlists
4. Use list or grid view

### Setting Up Kiwix

1. Go to **Kiwix**
2. Browse **Available Content**
3. Download knowledge bases
4. Click **Start Server**
5. Click **Access Library**

### Sharing Resources

1. Navigate to any resource
2. Click **Share** button
3. Search for user
4. Select permission level
5. Click **Share**

## 🔌 API Documentation

### Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

### Videos

```http
GET    /api/videos
POST   /api/videos/upload
POST   /api/videos/download
GET    /api/videos/:id
PUT    /api/videos/:id
DELETE /api/videos/:id
```

### Kiwix

```http
GET    /api/kiwix/status
POST   /api/kiwix/start
POST   /api/kiwix/stop
GET    /api/kiwix/catalog
GET    /api/kiwix/library
POST   /api/kiwix/download
```

### Sharing

```http
GET    /api/sharing/shared-with-me
GET    /api/sharing/shared-by-me
POST   /api/sharing/share
PUT    /api/sharing/share/:id
DELETE /api/sharing/share/:id
GET    /api/sharing/check-access/:type/:id
```

## 👨‍💻 Development

### Local Development

```bash
cd backend
npm install
npm run dev  # Auto-reload on changes
```

### Project Structure

```
sps/
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   └── server.js
├── database/
│   ├── schema.sql
│   ├── videos-schema.sql
│   └── sharing-schema.sql
├── scripts/
├── css/
├── js/
└── README.md
```

## 🚀 Deployment

### Production Checklist

- [ ] Change all default passwords
- [ ] Enable HTTPS
- [ ] Configure firewall
- [ ] Set up backups
- [ ] Configure log rotation
- [ ] Enable PM2 startup
- [ ] Review security headers

### Enable HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 📝 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- [Kiwix](https://www.kiwix.org/) - Offline content
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Video downloads
- [Express.js](https://expressjs.com/) - Web framework
- [PostgreSQL](https://www.postgresql.org/) - Database

---

**Made with ❤️ for preppers everywhere**

**Star ⭐ this project if you find it useful!**

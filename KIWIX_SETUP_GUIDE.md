# Kiwix Offline Knowledge Setup Guide

## ✅ What's Been Created

The complete Kiwix offline knowledge system is ready:

- **Frontend**: [kiwix.html](kiwix.html) - Download manager and library browser
- **Backend API**: [backend/routes/kiwix.js](backend/routes/kiwix.js) - 10 API endpoints
- **CSS**: [css/kiwix.css](css/kiwix.css) - Complete styling
- **JavaScript**: [js/kiwix.js](js/kiwix.js) - Full functionality
- **Installation Script**: [scripts/install-kiwix.sh](scripts/install-kiwix.sh)
- **Nginx Config**: `/tmp/sps-nginx-kiwix-update.conf`

## 🚀 Setup Steps

### 1. Install Kiwix Server

```bash
sudo bash /var/www/sps/scripts/install-kiwix.sh
```

This will:
- Download Kiwix Server 3.7.0
- Install `kiwix-serve` and `kiwix-manage` to `/usr/local/bin`
- Create directories:
  - `/var/www/sps/kiwix/data` - For ZIM files
  - `/var/www/sps/kiwix/library` - For library database

### 2. Update Nginx Configuration

```bash
sudo cp /tmp/sps-nginx-kiwix-update.conf /etc/nginx/sites-available/sps
sudo nginx -t && sudo systemctl reload nginx
```

This adds the `/kiwix-content/` proxy location for accessing Wikipedia and other content.

### 3. Verify Backend is Running

```bash
pm2 status
pm2 logs sps-api --lines 10
```

Backend should show "online" status with Kiwix routes loaded.

## 📚 What is Kiwix?

Kiwix allows you to download and access **entire knowledge bases offline**:

- **Wikipedia** (all languages, with/without images)
- **Medical encyclopedias**
- **WikiHow** guides
- **Stack Exchange** programming Q&A
- **Khan Academy** educational content
- **Wiktionary** dictionaries
- **And 1000+ other resources**

Perfect for emergency preparedness when internet access is unavailable.

## 🎯 Features

### Available in the Interface:

1. **Server Management**
   - Start/stop Kiwix server
   - Real-time status indicator
   - Port configuration (default: 8080)

2. **Content Catalog**
   - Browse available ZIM files
   - See file sizes before downloading
   - Categorized content (encyclopedia, medical, education, etc.)

3. **Download Management**
   - Download ZIM files from official Kiwix catalog
   - Monitor download progress
   - Resume interrupted downloads (wget -c)

4. **Library Management**
   - View installed ZIM files
   - See file sizes and dates
   - Delete unwanted content

5. **Access Offline Content**
   - Click "Access Library" when server is running
   - Opens in new tab at `/kiwix-content`
   - Full search and navigation

## 📦 Popular Downloads

### Recommended for Preparedness:

**1. Wikipedia English (Mini)** - ~10GB
- Top 100,000 articles
- Great for testing and essential info
- Download time: ~2-4 hours

**2. Medical Wikipedia** - ~3GB
- Medicine and health information
- Critical for emergency situations
- Download time: ~30-60 minutes

**3. WikiHow** - ~8GB
- How-to guides for everything
- Practical survival knowledge
- Download time: ~1-2 hours

**4. Survival Wiki** - ~500MB
- Wilderness and survival knowledge
- Perfect for preppers
- Download time: ~10-20 minutes

### For Complete Knowledge:

**Wikipedia English (No Pictures)** - ~50GB
- Entire English Wikipedia without images
- Download time: ~10-20 hours
- Requires ~60GB free space

**Wikipedia English (Full)** - ~100GB
- Complete with all images
- Download time: ~1-2 days
- Requires ~120GB free space

## 🔧 API Endpoints

### Server Control
- `GET /api/kiwix/status` - Check if Kiwix server is running
- `POST /api/kiwix/start` - Start Kiwix server with PM2
- `POST /api/kiwix/stop` - Stop Kiwix server

### Content Management
- `GET /api/kiwix/catalog` - List available ZIM files
- `GET /api/kiwix/library` - List installed ZIM files
- `POST /api/kiwix/download` - Start downloading a ZIM file
- `GET /api/kiwix/download/status/:filename` - Check download progress
- `DELETE /api/kiwix/library/:filename` - Delete a ZIM file

## 📁 File Locations

```
/var/www/sps/kiwix/
├── data/           # ZIM files stored here
│   ├── wikipedia_en_mini.zim
│   ├── wikihow_en.zim
│   └── ...
└── library/
    └── library.xml # Kiwix library database
```

## 🌐 Accessing Content

### Method 1: Through Dashboard (Recommended)
1. Go to http://192.168.1.111/kiwix.html
2. Start the server
3. Click "Access Library"
4. Browse and search offline content

### Method 2: Direct Access
- When server is running: http://192.168.1.111/kiwix-content

### Method 3: Command Line
```bash
# Start server manually
kiwix-serve --port 8080 --library /var/www/sps/kiwix/library/library.xml

# With PM2 (recommended)
pm2 start kiwix-serve --name kiwix -- --port 8080 --library /var/www/sps/kiwix/library/library.xml
```

## 📥 Downloading Content

### Through the Interface:
1. Go to http://192.168.1.111/kiwix.html
2. Click "Available Content" tab
3. Choose content to download
4. Click "Download"
5. Monitor in "Downloads" tab

### Manual Download:
```bash
# Download directly with wget
cd /var/www/sps/kiwix/data
wget https://download.kiwix.org/zim/wikipedia_en_simple_all_nopic.zim

# Add to library
kiwix-manage /var/www/sps/kiwix/library/library.xml add wikipedia_en_simple_all_nopic.zim
```

## 🔍 Official Kiwix Library

Browse all available content:
https://library.kiwix.org/

Download ZIM files from:
https://download.kiwix.org/zim/

## ⚡ Performance Tips

### Storage Requirements:
- **Minimal Setup**: 20-30GB (Wikipedia Mini + WikiHow + Medical)
- **Recommended**: 100-150GB (Multiple encyclopedias)
- **Complete Setup**: 500GB+ (All major content)

### Download Tips:
- Use wired connection for large files
- Downloads can be resumed if interrupted
- Download overnight for large files
- Check available disk space first

### Server Performance:
- Kiwix server uses minimal RAM (~100MB)
- Search is very fast once indexed
- Can serve multiple users simultaneously
- No internet required after download

## 🛠️ Troubleshooting

### Server won't start
```bash
# Check if port 8080 is available
sudo lsof -i :8080

# Kill any conflicting process
pm2 delete kiwix
pm2 start kiwix-serve --name kiwix -- --port 8080 --library /var/www/sps/kiwix/library/library.xml
```

### Download stuck
```bash
# Check download status
ls -lh /var/www/sps/kiwix/data/

# Restart interrupted download (wget resumes automatically with -c flag)
```

### Can't access content
```bash
# Verify Nginx proxy
curl http://localhost:8080
curl http://localhost/kiwix-content

# Check PM2 status
pm2 status
pm2 logs kiwix
```

### Library not showing content
```bash
# Rebuild library
cd /var/www/sps/kiwix/library
rm library.xml
kiwix-manage library.xml add /var/www/sps/kiwix/data/*.zim

# Restart server
pm2 restart kiwix
```

## 📊 Disk Usage

Monitor disk space:
```bash
# Check available space
df -h /var/www/sps/kiwix/data

# Check ZIM file sizes
du -h /var/www/sps/kiwix/data/*.zim

# Total size
du -sh /var/www/sps/kiwix/data
```

## 🔐 Security Notes

- Kiwix server runs on localhost:8080
- Proxied through Nginx to `/kiwix-content`
- No external access unless firewall opened
- Authentication required through SPS dashboard
- Read-only access to ZIM files

## ✨ Use Cases

### Emergency Preparedness:
- Medical reference when hospitals unavailable
- Survival guides and wilderness skills
- Food preservation techniques
- First aid procedures

### Education:
- Complete encyclopedia for homeschooling
- Science and history references
- Language learning resources
- Math and programming tutorials

### Off-Grid Living:
- Agricultural knowledge
- Construction guides
- Alternative energy information
- Water purification methods

## 🎯 Quick Start

```bash
# 1. Install
sudo bash /var/www/sps/scripts/install-kiwix.sh

# 2. Update Nginx
sudo cp /tmp/sps-nginx-kiwix-update.conf /etc/nginx/sites-available/sps
sudo nginx -t && sudo systemctl reload nginx

# 3. Access dashboard
# Go to: http://192.168.1.111/kiwix.html

# 4. Download your first content
# In the dashboard:
# - Go to "Available Content"
# - Click download on "Wikipedia English (Mini)"
# - Wait for download to complete

# 5. Start server and access
# Click "Start Server"
# Click "Access Library"
# Search and browse offline Wikipedia!
```

---

**Access Kiwix Dashboard**: http://192.168.1.111/kiwix.html

**Documentation**: https://wiki.kiwix.org/

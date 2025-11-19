#!/bin/bash

echo "================================="
echo "Setting Up Video Feature"
echo "================================="
echo ""

# Step 1: Install yt-dlp and FFmpeg
echo "Step 1/4: Installing yt-dlp and FFmpeg..."
if ! command -v yt-dlp &> /dev/null; then
    echo "Installing yt-dlp..."
    pip3 install --break-system-packages yt-dlp 2>&1 | grep -v "WARNING"
    echo "✓ yt-dlp installed"
else
    echo "✓ yt-dlp already installed ($(yt-dlp --version))"
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "Installing ffmpeg..."
    apt install -y ffmpeg > /dev/null 2>&1
    echo "✓ FFmpeg installed"
else
    echo "✓ FFmpeg already installed"
fi

echo ""

# Step 2: Import database schema
echo "Step 2/4: Creating video database tables..."
sudo -u postgres psql -d sps_db -f /var/www/sps/database/videos-schema.sql > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Database tables created"
else
    echo "✗ Failed to create database tables"
    echo "  Try running manually:"
    echo "  sudo -u postgres psql -d sps_db -f /var/www/sps/database/videos-schema.sql"
fi

echo ""

# Step 3: Set up directories
echo "Step 3/4: Setting up directories..."
mkdir -p /var/www/sps/videos
chmod 755 /var/www/sps/videos
echo "✓ Video storage directory created"

echo ""

# Step 4: Restart backend
echo "Step 4/4: Restarting backend..."
pm2 restart sps-api > /dev/null 2>&1
sleep 2
echo "✓ Backend restarted"

echo ""
echo "================================="
echo "Setup Complete!"
echo "================================="
echo ""
echo "Test the video feature:"
echo "  http://192.168.1.111/videos.html"
echo ""
echo "Verify installation:"
echo "  yt-dlp --version"
echo "  ffmpeg -version"
echo ""

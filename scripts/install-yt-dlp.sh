#!/bin/bash

# Install yt-dlp for video downloading

set -e

echo "================================="
echo "Installing yt-dlp"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

echo "Step 1/4: Installing dependencies..."
apt update
apt install -y python3 python3-pip ffmpeg

echo ""
echo "Step 2/4: Installing yt-dlp..."
pip3 install --upgrade yt-dlp

echo ""
echo "Step 3/4: Verifying installation..."
yt-dlp --version

echo ""
echo "Step 4/4: Creating video storage directory..."
mkdir -p /var/www/sps/videos
chown -R tne:tne /var/www/sps/videos
chmod 755 /var/www/sps/videos

echo ""
echo "================================="
echo "yt-dlp installed successfully!"
echo "================================="
echo ""
echo "Version: $(yt-dlp --version)"
echo "FFmpeg: $(ffmpeg -version | head -1)"
echo "Video storage: /var/www/sps/videos"
echo ""

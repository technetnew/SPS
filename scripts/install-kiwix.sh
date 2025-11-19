#!/bin/bash

echo "================================="
echo "Installing Kiwix Server"
echo "================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (use sudo)"
    exit 1
fi

# Step 1: Download Kiwix Server
echo "Step 1/5: Downloading Kiwix Server..."
cd /tmp
KIWIX_VERSION="3.7.0-1"
KIWIX_URL="https://download.kiwix.org/release/kiwix-tools/kiwix-tools_linux-x86_64-${KIWIX_VERSION}.tar.gz"

if [ ! -f "kiwix-tools_linux-x86_64-${KIWIX_VERSION}.tar.gz" ]; then
    wget -q --show-progress "$KIWIX_URL"
    if [ $? -eq 0 ]; then
        echo "✓ Downloaded Kiwix Server"
    else
        echo "✗ Failed to download Kiwix"
        exit 1
    fi
else
    echo "✓ Kiwix archive already downloaded"
fi

# Step 2: Extract
echo ""
echo "Step 2/5: Extracting..."
tar -xzf "kiwix-tools_linux-x86_64-${KIWIX_VERSION}.tar.gz"
echo "✓ Extracted"

# Step 3: Install
echo ""
echo "Step 3/5: Installing to /usr/local/bin..."
cd "kiwix-tools_linux-x86_64-${KIWIX_VERSION}"
cp kiwix-serve /usr/local/bin/
cp kiwix-manage /usr/local/bin/
chmod +x /usr/local/bin/kiwix-serve
chmod +x /usr/local/bin/kiwix-manage
echo "✓ Installed kiwix-serve and kiwix-manage"

# Step 4: Create directories
echo ""
echo "Step 4/5: Creating directories..."
mkdir -p /var/www/sps/kiwix/data
mkdir -p /var/www/sps/kiwix/library
chmod 755 /var/www/sps/kiwix/data
chmod 755 /var/www/sps/kiwix/library
chown -R $SUDO_USER:$SUDO_USER /var/www/sps/kiwix
echo "✓ Created directories"

# Step 5: Create empty library
echo ""
echo "Step 5/5: Creating library file..."
touch /var/www/sps/kiwix/library/library.xml
chown $SUDO_USER:$SUDO_USER /var/www/sps/kiwix/library/library.xml
echo "✓ Library created"

# Cleanup
cd /tmp
rm -rf "kiwix-tools_linux-x86_64-${KIWIX_VERSION}"
rm "kiwix-tools_linux-x86_64-${KIWIX_VERSION}.tar.gz"

echo ""
echo "================================="
echo "Kiwix Server Installed!"
echo "================================="
echo ""
echo "Verify installation:"
echo "  kiwix-serve --version"
echo ""
echo "Directories created:"
echo "  /var/www/sps/kiwix/data     - ZIM files storage"
echo "  /var/www/sps/kiwix/library  - Library database"
echo ""
echo "Next steps:"
echo "  1. Download ZIM files (Wikipedia, etc.)"
echo "  2. Add to library with kiwix-manage"
echo "  3. Start server with PM2"
echo ""

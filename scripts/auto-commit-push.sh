#!/bin/bash

# SPS Auto-commit and Push Script
# Runs every 10 minutes via cron to sync changes to GitHub

cd /var/www/sps || exit 1

# Configure git if not already done
git config user.email "sps-auto@technetnew.local" 2>/dev/null
git config user.name "SPS Auto Sync" 2>/dev/null

# Add all changes (respecting .gitignore)
git add .

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "[$(date)] No changes to commit"
    exit 0
fi

# Create commit with timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
CHANGES=$(git diff --cached --stat | tail -1)

git commit -m "Auto-sync: ${TIMESTAMP}

${CHANGES}"

# Push to GitHub
git push origin main 2>&1

if [ $? -eq 0 ]; then
    echo "[$(date)] Successfully pushed to GitHub"
else
    echo "[$(date)] Failed to push to GitHub" >&2
    exit 1
fi

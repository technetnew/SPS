#!/bin/bash

echo "🚀 SPS GitHub Push Script"
echo "=========================="
echo ""

cd /var/www/sps || exit 1

# Check if we have changes staged
if ! git diff --cached --quiet; then
    echo "✅ Changes are staged and ready"
else
    echo "📦 Staging all changes..."
    git add .
fi

# Show what will be pushed
echo ""
echo "📊 Files to be committed:"
git status --short | wc -l
echo ""

# Check if authenticated
echo "🔐 Testing GitHub authentication..."
if git ls-remote origin &>/dev/null; then
    echo "✅ GitHub authentication working!"
    echo ""
    
    # Commit
    echo "💾 Creating commit..."
    if [ -f /tmp/commit-message.txt ]; then
        git commit -F /tmp/commit-message.txt
    else
        git commit -m "Update SPS - $(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    # Push
    echo ""
    echo "🚀 Pushing to GitHub..."
    git push origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ SUCCESS! Pushed to https://github.com/technetnew/SPS"
        echo ""
        echo "🔄 To enable auto-push every 10 minutes, run:"
        echo "(crontab -l 2>/dev/null; echo '*/10 * * * * /var/www/sps/scripts/auto-commit-push.sh >> /var/log/sps-auto-sync.log 2>&1') | crontab -"
    else
        echo ""
        echo "❌ Push failed! Check the error above."
        exit 1
    fi
else
    echo "❌ NOT AUTHENTICATED!"
    echo ""
    echo "You need to set up GitHub authentication first:"
    echo ""
    echo "Option 1 - Personal Access Token (Easiest):"
    echo "1. Go to: https://github.com/settings/tokens"
    echo "2. Create token with 'repo' permission"
    echo "3. Run: git remote set-url origin https://YOUR_TOKEN@github.com/technetnew/SPS.git"
    echo ""
    echo "Option 2 - SSH Key:"
    echo "1. Run: ssh-keygen -t ed25519 -C 'sps@technetnew.local' -f ~/.ssh/sps_github"
    echo "2. Add public key to: https://github.com/settings/ssh/new"
    echo "3. Run: git remote set-url origin git@github.com:technetnew/SPS.git"
    echo ""
    echo "See READY_TO_PUSH.md for detailed instructions"
    exit 1
fi

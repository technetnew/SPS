# GitHub Authentication Setup for Auto-Push

To enable automatic pushes to GitHub every 10 minutes, you need to set up authentication.

## Option 1: Personal Access Token (Recommended)

### Step 1: Create a Personal Access Token on GitHub

1. Go to GitHub: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name: `SPS Auto-Sync`
4. Set expiration: `No expiration` (or your preference)
5. Select scopes:
   - ✅ `repo` (Full control of private repositories)
6. Click "Generate token"
7. **COPY THE TOKEN** - you won't see it again!

### Step 2: Configure Git to Use the Token

Run these commands on your server:

```bash
cd /var/www/sps

# Set the remote URL with your token
# Replace YOUR_TOKEN with the token you just copied
git remote set-url origin https://YOUR_TOKEN@github.com/technetnew/SPS.git

# Test it
git push origin main
```

**Security Note:** The token will be stored in `.git/config`. Make sure `/var/www/sps` has proper permissions.

## Option 2: SSH Key (More Secure)

### Step 1: Generate SSH Key

```bash
# Generate SSH key (press Enter for all prompts)
ssh-keygen -t ed25519 -C "sps-auto@technetnew.local" -f ~/.ssh/sps_github

# Start SSH agent
eval "$(ssh-agent -s)"

# Add key to agent
ssh-add ~/.ssh/sps_github

# Copy public key
cat ~/.ssh/sps_github.pub
```

### Step 2: Add SSH Key to GitHub

1. Go to: https://github.com/settings/ssh/new
2. Title: `SPS Server`
3. Paste the public key from above
4. Click "Add SSH key"

### Step 3: Configure Git to Use SSH

```bash
cd /var/www/sps

# Change remote URL to SSH
git remote set-url origin git@github.com:technetnew/SPS.git

# Test it
git push origin main
```

## Current Status

✅ Auto-commit script created: `/var/www/sps/scripts/auto-commit-push.sh`
⏳ Waiting for authentication setup
⏳ Cron job setup pending

## Next Steps

After setting up authentication (Option 1 or 2 above):

1. Test the script manually:
```bash
bash /var/www/sps/scripts/auto-commit-push.sh
```

2. If successful, I'll set up the cron job to run every 10 minutes

## What Gets Pushed

The auto-sync will commit and push:
- ✅ All code changes
- ✅ Database schemas
- ✅ Configuration files (not .env)
- ✅ Scripts and documentation
- ❌ User uploads (excluded by .gitignore)
- ❌ Videos (excluded by .gitignore)
- ❌ ZIM files (excluded by .gitignore)
- ❌ Environment secrets (excluded by .gitignore)

## Troubleshooting

### Permission Denied
If you get "Permission denied (publickey)":
- Your SSH key isn't added to GitHub
- Follow Option 2 above

### Authentication Failed
If you get "Authentication failed":
- Your token is incorrect or expired
- Regenerate token and update URL

### Push Rejected
If you get "push rejected":
- Someone else pushed changes
- Pull first: `git pull origin main --rebase`
- Then push: `git push origin main`

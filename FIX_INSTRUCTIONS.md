# Quick Fix for 403 Errors

## The Problem
The login/registration modals aren't working and dashboard shows 403 Forbidden because:
1. File permissions are too restrictive (Nginx can't read them)
2. Nginx API proxy configuration needs adjustment

## The Solution

Run this command:

```bash
sudo bash /var/www/sps/scripts/fix-permissions-and-nginx.sh
```

This will:
1. Fix all file permissions (make readable by Nginx)
2. Update Nginx configuration for proper API proxying
3. Reload Nginx

## Test After Fix

1. **Homepage**: http://192.168.1.111/
   - Click "Login" or "Sign Up" buttons
   - Modals should open

2. **Dashboard**: http://192.168.1.111/dashboard.html  
   - Should load without 403 error
   - Login with: `john` / `SecurePass123`

3. **API**: Test health check
   ```bash
   curl http://192.168.1.111/api/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

## If Still Not Working

### Check Browser Console
1. Open browser (Chrome/Firefox)
2. Press F12 to open DevTools
3. Go to Console tab
4. Look for any JavaScript errors

### Check Nginx Logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### Check API Logs
```bash
pm2 logs sps-api
```

### Verify Permissions
```bash
ls -la /var/www/sps/
ls -la /var/www/sps/js/
ls -la /var/www/sps/css/
```

All should show `-rw-r--r--` (644) for files and `drwxr-xr-x` (755) for directories.

## Manual Fix (if script doesn't work)

### 1. Fix Permissions
```bash
chmod 755 /var/www/sps/js /var/www/sps/css
chmod 644 /var/www/sps/*.html
chmod 644 /var/www/sps/js/*.js
chmod 644 /var/www/sps/css/*.css
```

### 2. Update Nginx
```bash
sudo cp /tmp/sps-nginx-fixed.conf /etc/nginx/sites-available/sps
sudo nginx -t
sudo systemctl reload nginx
```

## Expected Result

After running the fix script:
- ✅ Homepage loads and shows Login/Sign Up buttons
- ✅ Clicking Login/Sign Up opens modal dialogs
- ✅ Dashboard loads without 403 error
- ✅ Can login with test account
- ✅ Can view inventory and statistics
- ✅ Can add/edit/delete items

---

**Quick Command:**
```bash
sudo bash /var/www/sps/scripts/fix-permissions-and-nginx.sh
```

# Quick Fix for Video Feature

## The Problem

The video feature is failing because the database tables haven't been created yet. You're getting errors like:
- "Failed to start download"
- "Failed to load videos"
- "Route not found"

## The Solution

Run this ONE command to create the database tables:

```bash
sudo -u postgres psql -d sps_db -f /var/www/sps/database/videos-schema.sql
```

### Expected Output

You should see:
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

### Verify It Worked

Check if the tables were created:

```bash
sudo -u postgres psql -d sps_db -c "\dt video*"
```

You should see 5 tables:
- videos
- video_playlists
- video_playlist_items
- video_downloads
- video_notes

### Restart Backend

After creating the tables, restart the backend:

```bash
pm2 restart sps-api
```

### Test Again

Now go to http://192.168.1.111/videos.html and try:
1. Click "⬇️ Download from URL"
2. Enter: https://www.youtube.com/shorts/kU0CjuUVQDw
3. Click "Download Video"

It should work now!

---

## If You Get Permission Errors

If the postgres command fails, try:

```bash
# Switch to postgres user
sudo su - postgres

# Run the import
psql -d sps_db -f /var/www/sps/database/videos-schema.sql

# Exit back to your user
exit
```

## Troubleshooting

### Error: "relation does not exist"
This means the tables aren't created. Run the postgres command above.

### Error: "Failed to start download"
1. Check if yt-dlp is installed: `yt-dlp --version`
2. Check if tables exist: `sudo -u postgres psql -d sps_db -c "\dt video*"`
3. Check backend logs: `pm2 logs sps-api --lines 20`

### Error: "Access token required"
You need to be logged in. Click the Login button and use:
- Username: john
- Password: SecurePass123

---

**Quick Test Command:**

```bash
sudo -u postgres psql -d sps_db -f /var/www/sps/database/videos-schema.sql && pm2 restart sps-api && echo "✓ Ready to test!"
```

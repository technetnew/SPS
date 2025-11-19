# Video Feature Setup Guide

## What's Been Created

The complete video management system has been built with:

✅ **Database Schema** - Tables for videos, playlists, downloads, and notes
✅ **Backend API** - Complete REST API with upload, download, and management endpoints
✅ **Frontend UI** - Full video management interface with player
✅ **CSS Styling** - Responsive design for all screen sizes
✅ **Videos Tab** - Added to dashboard navigation

## Required Setup Steps

You need to run these commands to complete the installation:

### 1. Install yt-dlp and FFmpeg

```bash
sudo apt update
sudo apt install -y python3 python3-pip ffmpeg
pip3 install --break-system-packages yt-dlp
```

**Note**: We use `--break-system-packages` because Ubuntu 24.04 uses externally-managed Python environment.

### 2. Import Video Database Schema

```bash
sudo -u postgres psql -d sps_db -f /var/www/sps/database/videos-schema.sql
```

### 3. Verify Installations

```bash
# Check yt-dlp
yt-dlp --version

# Check ffmpeg
ffmpeg -version

# Check database tables
sudo -u postgres psql -d sps_db -c "\dt"
```

### 4. Restart Backend Server

```bash
pm2 restart sps-backend
```

Or if you prefer to see logs:

```bash
pm2 stop sps-backend
cd /var/www/sps/backend
npm run dev
```

## Features Overview

### Upload Videos
- Upload video files directly from your computer
- Supports up to 500MB file size
- Automatic metadata extraction (duration, resolution, format)
- Progress bar showing upload status
- Thumbnail support

### Download with yt-dlp
- Download videos from YouTube, Vimeo, and 1000+ other sites
- Select quality (best, 1080p, 720p, 480p, 360p)
- Choose format (mp4, mkv, webm, avi)
- Real-time download progress tracking
- Automatic metadata extraction from source

### Video Management
- **View**: Watch videos in built-in player
- **Edit**: Update title, description, category, and tags
- **Delete**: Remove videos from library
- **Search**: Find videos by title or description
- **Filter**: Filter by category or playlist

### Playlists
- Create custom playlists
- Add videos to multiple playlists
- Track video count per playlist
- Filter videos by playlist

### Statistics Dashboard
- Total videos count
- Total storage used
- Number of playlists
- Total video duration

## File Structure

```
/var/www/sps/
├── videos.html              # Video management page
├── videos/                  # Video storage directory (created)
├── js/
│   └── videos.js           # Frontend JavaScript
├── css/
│   └── videos.css          # Styling
├── backend/
│   └── routes/
│       └── videos.js       # API endpoints
└── database/
    └── videos-schema.sql   # Database schema
```

## API Endpoints

All endpoints are prefixed with `/api/videos`

### Video Management
- `GET /` - List all videos
- `GET /:id` - Get video details
- `POST /upload` - Upload video file
- `PUT /:id` - Update video metadata
- `DELETE /:id` - Delete video

### Download with yt-dlp
- `POST /download` - Start video download
- `GET /downloads` - List all downloads
- `GET /downloads/:id` - Get download status

### Playlists
- `GET /playlists/all` - List all playlists
- `POST /playlists` - Create playlist
- `POST /playlists/:id/videos` - Add video to playlist
- `DELETE /playlists/:playlistId/videos/:videoId` - Remove from playlist

## Testing the Feature

1. **Access the page**: http://192.168.1.111/videos.html

2. **Test Upload**:
   - Click "📤 Upload Video"
   - Select a video file
   - Fill in title and description
   - Click "Upload Video"
   - Watch progress bar

3. **Test Download**:
   - Click "⬇️ Download from URL"
   - Enter a YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)
   - Select quality and format
   - Click "Download Video"
   - Monitor progress in Downloads section

4. **Test Player**:
   - Click on any video card
   - Video should play in modal
   - Test controls (play, pause, fullscreen)

## Troubleshooting

### yt-dlp not found
```bash
which yt-dlp
# If empty, install again:
pip3 install --break-system-packages yt-dlp
```

### FFmpeg not found
```bash
sudo apt install -y ffmpeg
ffmpeg -version
```

### Database tables not created
```bash
# Check if tables exist
sudo -u postgres psql -d sps_db -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'video%';"

# If empty, import schema again
sudo -u postgres psql -d sps_db -f /var/www/sps/database/videos-schema.sql
```

### Upload fails with 413 error
This means the file is too large. Check Nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/sps
# Add: client_max_body_size 500M;
sudo nginx -t && sudo systemctl reload nginx
```

### Videos directory permission denied
```bash
sudo chown -R www-data:www-data /var/www/sps/videos
sudo chmod 755 /var/www/sps/videos
```

### Backend errors
Check PM2 logs:
```bash
pm2 logs sps-backend
```

## Next Steps

After completing the setup, you can:

1. **Customize Categories**: Edit the category dropdown in [videos.html](videos.html#L35-L42)
2. **Adjust Upload Limit**: Modify `limits: { fileSize: 500 * 1024 * 1024 }` in [backend/routes/videos.js](backend/routes/videos.js#L17)
3. **Add More Video Sources**: yt-dlp supports 1000+ sites automatically
4. **Create Playlists**: Organize videos into categories
5. **Add Notes**: Document important timestamps or information

## Quick Command Reference

```bash
# Install dependencies
sudo apt install -y python3 python3-pip ffmpeg
pip3 install --break-system-packages yt-dlp

# Import database
sudo -u postgres psql -d sps_db -f /var/www/sps/database/videos-schema.sql

# Restart backend
pm2 restart sps-backend

# Check logs
pm2 logs sps-backend

# Test yt-dlp
yt-dlp --version

# List videos directory
ls -lah /var/www/sps/videos/
```

---

**Ready to test!** Once you complete the setup steps, visit http://192.168.1.111/videos.html 🎬

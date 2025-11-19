# Video Features Guide

## ✅ Everything is Now Working!

The video system is fully operational with both upload and download features.

## Download Queue/Session Location

The download queue appears **automatically on the videos page** when there are active downloads.

### How It Works:

1. **Start a Download**: Click "⬇️ Download from URL" and submit a video URL
2. **Downloads Section Appears**: The page automatically shows a "Downloads" section
3. **Real-time Progress**: Updates every 3 seconds showing:
   - Video title or URL
   - Status (pending, downloading, completed, failed)
   - Progress percentage
4. **Auto-hide**: When all downloads are complete, the section automatically hides

### Viewing Download History

To see all downloads (including completed ones):
```bash
# Via API
curl -H "Authorization: Bearer YOUR_TOKEN" http://192.168.1.111/api/videos/downloads
```

Or check the database:
```bash
sudo -u postgres psql -d sps_db -c "SELECT * FROM video_downloads ORDER BY created_at DESC;"
```

## Upload Feature

### How Uploads Work:

1. Click "📤 Upload Video"
2. Select video file (up to 500MB)
3. Enter title, description, category, tags
4. Click "Upload Video"
5. Watch progress bar (uses XHR for real-time progress)
6. Video appears in grid when complete

### Upload Size Limits:

- **Backend**: 500MB (configured in multer)
- **Nginx**: 500MB (configured with `client_max_body_size`)
- **Timeout**: 10 minutes (600 seconds)

### What Was Fixed for Uploads:

1. **Nginx Configuration**:
   - Increased `client_max_body_size` from 1MB to 500MB
   - Added proxy timeouts (600s)
   - Added `/videos/` location to serve uploaded files

2. **File Permissions**:
   - Videos directory: 755
   - Video files: Auto-set by backend

## Download Feature

### Supported Sites:

yt-dlp supports **1000+ websites** including:
- YouTube (videos and shorts)
- Vimeo
- Dailymotion
- Facebook
- Instagram
- TikTok
- Twitter/X
- And many more...

### Quality Options:

- **Best Available**: Highest quality (default)
- **1080p**: Full HD
- **720p**: HD
- **480p**: SD
- **360p**: Low quality

### Format Options:

- **MP4**: Most compatible (default)
- **MKV**: High quality container
- **WEBM**: Web-optimized
- **AVI**: Legacy format

### What Gets Downloaded:

- Video file
- Metadata (title, description, duration, resolution)
- Automatically extracted using FFprobe
- Stored in PostgreSQL database

## Video Management

### Available Actions:

1. **Play**: Click any video card to play in modal
2. **Edit**: Click ✏️ to update metadata
3. **Delete**: Click 🗑️ to remove video
4. **Search**: Type in search box
5. **Filter**: By category or playlist

### Video Stats:

The dashboard shows:
- Total videos count
- Total storage used
- Number of playlists
- Total video duration

## File Storage

### Location:
```
/var/www/sps/videos/
```

### File Naming:
- Uploads: `video-{timestamp}-{random}.{ext}`
- Downloads: `video-{id}-{original-title}.{ext}`

### Access URLs:
```
http://192.168.1.111/videos/video-1-example.mp4
```

## API Endpoints

### Videos:
- `GET /api/videos` - List all videos
- `GET /api/videos/:id` - Get single video
- `POST /api/videos/upload` - Upload video file
- `PUT /api/videos/:id` - Update metadata
- `DELETE /api/videos/:id` - Delete video

### Downloads:
- `POST /api/videos/download` - Start download
- `GET /api/videos/downloads` - List all downloads
- `GET /api/videos/downloads/:id` - Get download status

### Playlists:
- `GET /api/videos/playlists/all` - List playlists
- `POST /api/videos/playlists` - Create playlist
- `POST /api/videos/playlists/:id/videos` - Add to playlist

## Database Tables

### videos
Stores all video information:
- Basic info (title, description, filename)
- Metadata (duration, resolution, format)
- Source (URL, type, download date)
- Stats (view count, last viewed)

### video_downloads
Tracks download progress:
- URL, quality, format
- Status, progress percentage
- Error messages
- Timestamps

### video_playlists
User-created playlists:
- Name, description
- Public/private flag

### video_playlist_items
Links videos to playlists:
- Position in playlist
- Many-to-many relationship

### video_notes
Notes for specific timestamps (future feature)

## Troubleshooting

### Upload stuck at 100%?
- Check Nginx error log: `sudo tail -f /var/nginx/error.log`
- Verify file size < 500MB
- Check backend logs: `pm2 logs sps-api`

### Download failing?
- Check yt-dlp is installed: `yt-dlp --version`
- Verify URL is supported: `yt-dlp -F URL`
- Check backend logs for errors

### Video won't play?
- Verify file exists: `ls -lah /var/www/sps/videos/`
- Check Nginx serves videos: `curl -I http://192.168.1.111/videos/filename.mp4`
- Browser console for errors

### Downloads not showing?
- They auto-hide when complete
- Check API: `curl http://192.168.1.111/api/videos/downloads`
- Start a new download to trigger display

## Current Status

✅ **Working Features:**
- Video downloads from URLs (yt-dlp)
- Video uploads (up to 500MB)
- Video playback in modal
- Metadata editing
- Search and filtering
- Download progress tracking
- Automatic metadata extraction

✅ **Fixed Issues:**
- Route ordering (downloads vs :id)
- Nginx upload size limit
- File permissions
- Database schema
- Proxy timeouts

## Quick Test Commands

```bash
# Check backend status
pm2 status

# Test downloads endpoint
curl -H "Authorization: Bearer TOKEN" http://192.168.1.111/api/videos/downloads

# List videos
curl -H "Authorization: Bearer TOKEN" http://192.168.1.111/api/videos

# Check video files
ls -lah /var/www/sps/videos/

# Watch download in progress
watch -n 2 'curl -s -H "Authorization: Bearer TOKEN" http://192.168.1.111/api/videos/downloads | python3 -m json.tool'
```

---

**Access the video page**: http://192.168.1.111/videos.html

**Your downloaded video is ready!**
- Title: "Turboflex meme pt5 #shorts"
- Size: 1.2MB
- Duration: 13 seconds
- Resolution: 720x1280
- File: `/var/www/sps/videos/video-1-Turboflex meme pt5 #shorts.mp4`

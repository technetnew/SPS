// Videos page functionality

let videos = [];
let playlists = [];
let visibleVideos = [];
let currentVideo = null;
let currentView = 'list'; // default to list view
const thumbnailCache = new Map();

// Initialize videos page
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!spsApi.isAuthenticated()) {
        authManager.showLoginModal();
        return;
    }

    // Wait for auth manager to initialize
    let attempts = 0;
    while (!authManager.isAuthenticated() && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!authManager.isAuthenticated()) {
        authManager.showLoginModal();
        return;
    }

    await loadVideos();
    await loadPlaylists();
    setupEventListeners();
    startDownloadPolling();
});

async function loadVideos(filters = {}) {
    try {
        const response = await spsApi.request('/videos', {
            method: 'GET'
        });

        videos = response.videos;
        renderVideos(videos);
        updateStats();
    } catch (error) {
        console.error('Failed to load videos:', error);
        showNotification('Failed to load videos', 'error');
    }
}

async function loadPlaylists() {
    try {
        const response = await spsApi.request('/videos/playlists/all', {
            method: 'GET'
        });

        playlists = response.playlists;

        // Populate playlist filter
        const playlistSelect = document.getElementById('filter-playlist');
        playlistSelect.innerHTML = '<option value="">All Videos</option>';
        playlists.forEach(playlist => {
            const option = document.createElement('option');
            option.value = playlist.id;
            option.textContent = `${playlist.name} (${playlist.video_count})`;
            playlistSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load playlists:', error);
    }
}

function renderVideos(videoList) {
    const container = document.getElementById('videos-container');
    visibleVideos = videoList.slice();

    if (videoList.length === 0) {
        container.innerHTML = '<div class="empty-state">No videos yet. Upload or download videos to get started!</div>';
        return;
    }

    container.innerHTML = videoList.map(video => {
        const thumbPath = video.thumbnail_path ? `/videos/${video.thumbnail_path}` : '';
        const safeTitle = escapeHtml(video.title);
        const fileAttr = video.filename ? ` data-video-file="${escapeHtml(video.filename)}"` : '';
        return `
        <div class="video-card" onclick="playVideo(${video.id})">
            <div class="video-thumbnail" data-video-id="${video.id}" data-video-title="${safeTitle}"${fileAttr} data-thumb-loaded="${thumbPath ? 'true' : 'false'}">
                ${thumbPath
                    ? `<img src="${thumbPath}" alt="${safeTitle}" loading="lazy">`
                    : '<div class="thumbnail-placeholder">Generating preview…</div>'
                }
                ${video.duration ? `<span class="video-duration">${formatDuration(video.duration)}</span>` : ''}
            </div>
            <div class="video-card-content">
                <h3>${safeTitle}</h3>
                ${video.description ? `<p class="video-description">${escapeHtml(video.description).substring(0, 120)}...</p>` : ''}
                <div class="video-meta">
                    ${video.category ? `<span class="badge">${escapeHtml(video.category)}</span>` : ''}
                    ${video.resolution ? `<span>${video.resolution}</span>` : ''}
                    ${video.file_size ? `<span>${formatFileSize(video.file_size)}</span>` : ''}
                </div>
                <div class="video-stats">
                    <span>👁️ ${video.view_count || 0} views</span>
                    ${video.upload_date ? `<span>📅 ${formatDateTime(video.upload_date)}</span>` : ''}
                </div>
                <div class="video-card-actions" onclick="event.stopPropagation()">
                    <button onclick="editVideo(${video.id})" class="btn-icon" title="Edit">✏️</button>
                    <button onclick="deleteVideo(${video.id})" class="btn-icon" title="Delete">🗑️</button>
                </div>
            </div>
        </div>
    `;
    }).join('');

    requestAnimationFrame(() => initializeGeneratedThumbnails(videoList));
}

// Switch between list and grid view
function switchView(view) {
    currentView = view;
    const container = document.getElementById('videos-container');
    const listBtn = document.getElementById('view-list');
    const gridBtn = document.getElementById('view-grid');

    if (view === 'list') {
        container.className = 'videos-list';
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
    } else {
        container.className = 'videos-grid';
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
    }

    // Save preference
    localStorage.setItem('video_view_preference', view);
}

function updateStats() {
    const totalVideos = videos.length;
    const totalSize = videos.reduce((sum, v) => sum + (parseInt(v.file_size) || 0), 0);
    const totalDuration = videos.reduce((sum, v) => sum + (parseInt(v.duration) || 0), 0);
    const totalPlaylists = playlists.length;

    document.getElementById('total-videos').textContent = totalVideos;
    document.getElementById('total-size').textContent = formatFileSize(totalSize);
    document.getElementById('total-playlists').textContent = totalPlaylists;
    document.getElementById('total-duration').textContent = formatDuration(totalDuration);
}

function setupEventListeners() {
    // Upload form
    const uploadForm = document.getElementById('upload-form');
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await uploadVideo();
    });

    // Download form
    const downloadForm = document.getElementById('download-form');
    downloadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await downloadVideo();
    });

    // Edit form
    const editForm = document.getElementById('edit-form');
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveVideoEdit();
    });

    // Search and filters
    const searchInput = document.getElementById('search-videos');
    const categoryFilter = document.getElementById('filter-category');
    const playlistFilter = document.getElementById('filter-playlist');

    searchInput.addEventListener('input', debounce(applyFilters, 300));
    categoryFilter.addEventListener('change', applyFilters);
    playlistFilter.addEventListener('change', applyFilters);
}

function applyFilters() {
    const search = document.getElementById('search-videos').value.toLowerCase();
    const category = document.getElementById('filter-category').value;

    let filtered = videos;

    if (search) {
        filtered = filtered.filter(v =>
            v.title.toLowerCase().includes(search) ||
            (v.description && v.description.toLowerCase().includes(search))
        );
    }

    if (category) {
        filtered = filtered.filter(v => v.category === category);
    }

    renderVideos(filtered);
}

// Upload video
function showUploadModal() {
    document.getElementById('upload-modal').style.display = 'block';
}

function closeUploadModal() {
    document.getElementById('upload-modal').style.display = 'none';
    document.getElementById('upload-form').reset();
}

async function uploadVideo() {
    const fileInput = document.getElementById('video-file');
    const file = fileInput.files[0];

    if (!file) {
        showNotification('Please select a video file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', document.getElementById('video-title').value || file.name);
    formData.append('description', document.getElementById('video-description').value);
    formData.append('category', document.getElementById('video-category').value);
    formData.append('tags', document.getElementById('video-tags').value);

    const progressDiv = document.getElementById('upload-progress');
    const progressBar = document.getElementById('upload-progress-bar');
    const statusText = document.getElementById('upload-status');

    progressDiv.style.display = 'block';

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressBar.style.width = percentComplete + '%';
                statusText.textContent = `Uploading... ${Math.round(percentComplete)}%`;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 201) {
                showNotification('Video uploaded successfully!', 'success');
                closeUploadModal();
                loadVideos();
            } else {
                const error = JSON.parse(xhr.responseText);
                showNotification('Upload failed: ' + error.error, 'error');
            }
            progressDiv.style.display = 'none';
        });

        xhr.addEventListener('error', () => {
            showNotification('Upload failed', 'error');
            progressDiv.style.display = 'none';
        });

        xhr.open('POST', '/api/videos/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${spsApi.getToken()}`);
        xhr.send(formData);

    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Upload failed: ' + error.message, 'error');
        progressDiv.style.display = 'none';
    }
}

// Download video from URL
function showDownloadModal() {
    document.getElementById('download-modal').style.display = 'block';
}

function closeDownloadModal() {
    document.getElementById('download-modal').style.display = 'none';
    document.getElementById('download-form').reset();
}

async function downloadVideo() {
    const url = document.getElementById('download-url').value;
    const quality = document.getElementById('download-quality').value;
    const format = document.getElementById('download-format').value;

    try {
        const response = await spsApi.request('/videos/download', {
            method: 'POST',
            body: JSON.stringify({ url, quality, format })
        });

        showNotification('Download started! Check the downloads section.', 'success');
        closeDownloadModal();

        // Show downloads section
        document.getElementById('downloads-section').style.display = 'block';
        monitorDownload(response.download_id);

    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to start download: ' + error.message, 'error');
    }
}

// Monitor download progress
function startDownloadPolling() {
    setInterval(checkActiveDownloads, 5000);
}

async function checkActiveDownloads() {
    try {
        const response = await spsApi.request('/videos/downloads', {
            method: 'GET'
        });

        const activeDownloads = response.downloads.filter(d =>
            d.status === 'pending' || d.status === 'downloading'
        );

        if (activeDownloads.length > 0) {
            document.getElementById('downloads-section').style.display = 'block';
            renderDownloads(activeDownloads);
        } else {
            document.getElementById('downloads-section').style.display = 'none';
        }

    } catch (error) {
        console.error('Failed to check downloads:', error);
    }
}

function renderDownloads(downloads) {
    const container = document.getElementById('downloads-list');

    container.innerHTML = downloads.map(download => `
        <div class="download-item">
            <div class="download-info">
                <strong>${download.title || download.url}</strong>
                <span>${download.status}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${download.progress}%"></div>
            </div>
        </div>
    `).join('');
}

async function monitorDownload(downloadId) {
    const checkDownload = async () => {
        try {
            const response = await spsApi.request(`/videos/downloads/${downloadId}`, {
                method: 'GET'
            });

            if (response.download.status === 'completed') {
                showNotification('Video downloaded successfully!', 'success');
                loadVideos();
                return true;
            } else if (response.download.status === 'failed') {
                showNotification('Download failed: ' + response.download.error_message, 'error');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to check download status:', error);
            return true;
        }
    };

    // Check every 3 seconds
    const interval = setInterval(async () => {
        const done = await checkDownload();
        if (done) {
            clearInterval(interval);
        }
    }, 3000);
}

// Play video
async function playVideo(videoId) {
    try {
        const response = await spsApi.request(`/videos/${videoId}`, {
            method: 'GET'
        });

        currentVideo = response.video;

        const player = document.getElementById('video-player');
        const videoPath = `/videos/${currentVideo.filename}`;

        player.src = videoPath;
        document.getElementById('playing-title').textContent = currentVideo.title;
        document.getElementById('playing-description').textContent = currentVideo.description || '';
        document.getElementById('playing-duration').textContent = currentVideo.duration ? formatDuration(currentVideo.duration) : '';
        document.getElementById('playing-resolution').textContent = currentVideo.resolution || '';
        document.getElementById('playing-size').textContent = formatFileSize(currentVideo.file_size);

        document.getElementById('player-modal').style.display = 'block';
        player.play();

    } catch (error) {
        console.error('Failed to play video:', error);
        showNotification('Failed to play video', 'error');
    }
}

function showNextVideo() {
    navigateVideos(1);
}

function showPreviousVideo() {
    navigateVideos(-1);
}

function navigateVideos(direction) {
    if (!currentVideo || visibleVideos.length === 0) return;

    const currentIndex = visibleVideos.findIndex(v => v.id === currentVideo.id);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= visibleVideos.length) {
        showNotification(direction > 0 ? 'No more videos ahead' : 'Already at first video', 'info');
        return;
    }

    const nextVideo = visibleVideos[nextIndex];
    playVideo(nextVideo.id);
}

function closePlayerModal() {
    const player = document.getElementById('video-player');
    player.pause();
    player.src = '';
    document.getElementById('player-modal').style.display = 'none';
}

function toggleVideoFullscreen() {
    const frame = document.getElementById('player-frame');
    if (!frame) return;

    if (!document.fullscreenElement) {
        if (frame.requestFullscreen) {
            frame.requestFullscreen().catch(() => {});
        }
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

// Edit video
async function editVideo(videoId) {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    document.getElementById('edit-video-id').value = video.id;
    document.getElementById('edit-title').value = video.title;
    document.getElementById('edit-description').value = video.description || '';
    document.getElementById('edit-category').value = video.category || '';
    document.getElementById('edit-tags').value = video.tags ? video.tags.join(', ') : '';

    document.getElementById('edit-modal').style.display = 'block';
}

function editCurrentVideo() {
    if (currentVideo) {
        closePlayerModal();
        editVideo(currentVideo.id);
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    document.getElementById('edit-form').reset();
}

async function saveVideoEdit() {
    const videoId = document.getElementById('edit-video-id').value;
    const tags = document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(t => t);

    try {
        await spsApi.request(`/videos/${videoId}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: document.getElementById('edit-title').value,
                description: document.getElementById('edit-description').value,
                category: document.getElementById('edit-category').value,
                tags: tags
            })
        });

        showNotification('Video updated successfully!', 'success');
        closeEditModal();
        loadVideos();

    } catch (error) {
        console.error('Failed to update video:', error);
        showNotification('Failed to update video', 'error');
    }
}

// Delete video
async function deleteVideo(videoId) {
    if (!confirm('Are you sure you want to delete this video?')) {
        return;
    }

    try {
        await spsApi.request(`/videos/${videoId}`, {
            method: 'DELETE'
        });

        showNotification('Video deleted successfully', 'success');
        loadVideos();

    } catch (error) {
        console.error('Failed to delete video:', error);
        showNotification('Failed to delete video', 'error');
    }
}

function deleteCurrentVideo() {
    if (currentVideo) {
        closePlayerModal();
        deleteVideo(currentVideo.id);
    }
}

// Utility functions
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function initializeGeneratedThumbnails(videoList) {
    videoList.forEach(video => {
        if (!video || typeof video.id === 'undefined' || video.thumbnail_path || !video.filename) {
            return;
        }
        generateThumbnailForVideo(video);
    });
}

async function generateThumbnailForVideo(video) {
    const container = document.querySelector(`.video-thumbnail[data-video-id="${video.id}"]`);
    if (!container || container.dataset.thumbLoaded === 'true' || container.dataset.loading === 'true') {
        return;
    }

    if (thumbnailCache.has(video.id)) {
        applyThumbnailToDom(video, thumbnailCache.get(video.id));
        return;
    }

    container.dataset.loading = 'true';

    try {
        const encodedFile = encodeURIComponent(video.filename);
        const source = `/videos/${encodedFile}`;
        const dataUrl = await captureVideoFrame(source);
        if (dataUrl) {
            thumbnailCache.set(video.id, dataUrl);
            applyThumbnailToDom(video, dataUrl);
        }
    } catch (error) {
        console.error('Failed to generate thumbnail:', error);
    } finally {
        container.dataset.loading = 'false';
    }
}

function applyThumbnailToDom(video, src) {
    const container = document.querySelector(`.video-thumbnail[data-video-id="${video.id}"]`);
    if (!container) return;

    let img = container.querySelector('img');
    if (!img) {
        img = document.createElement('img');
        img.loading = 'lazy';
        container.insertBefore(img, container.firstChild);
    }

    img.src = src;
    img.alt = video.title || 'Video thumbnail';

    const placeholder = container.querySelector('.thumbnail-placeholder');
    if (placeholder) placeholder.remove();

    container.dataset.thumbLoaded = 'true';
}

function captureVideoFrame(source) {
    return new Promise((resolve) => {
        const videoElement = document.createElement('video');
        let resolved = false;

        const cleanUp = () => {
            videoElement.pause();
            videoElement.removeAttribute('src');
            videoElement.load();
        };

        const finish = (result) => {
            if (resolved) return;
            resolved = true;
            cleanUp();
            resolve(result);
        };

        videoElement.preload = 'metadata';
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.crossOrigin = 'anonymous';
        videoElement.src = source;

        videoElement.addEventListener('error', () => finish(null), { once: true });

        videoElement.addEventListener('loadeddata', () => {
            const seekTo = Math.min(1, Math.max(0.1, (videoElement.duration || 1) * 0.1));
            const handleSeeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const width = videoElement.videoWidth || 320;
                    const height = videoElement.videoHeight || 180;
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(videoElement, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    finish(dataUrl);
                } catch {
                    finish(null);
                }
            };

            if (videoElement.readyState >= 2) {
                videoElement.currentTime = seekTo;
            } else {
                videoElement.addEventListener('loadedmetadata', () => {
                    videoElement.currentTime = seekTo;
                }, { once: true });
            }

            videoElement.addEventListener('seeked', handleSeeked, { once: true });
        }, { once: true });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Close modals on click outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Kiwix page functionality

let catalog = [];
let library = [];
let downloads = {};
let serverStatus = { running: false };

// Initialize kiwix page
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

    await checkServerStatus();
    await loadCatalog();
    await loadLibrary();

    // Start polling for server status
    setInterval(checkServerStatus, 5000);
});

// Check Kiwix server status
async function checkServerStatus() {
    try {
        const response = await spsApi.request('/kiwix/status');
        serverStatus = response;

        const indicator = document.getElementById('server-status-indicator');
        const statusText = document.getElementById('status-text');
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        const accessBtn = document.getElementById('access-btn');
        const serverInfoCard = document.getElementById('server-info-card');
        const serverUrl = document.getElementById('server-url');

        if (response.running) {
            indicator.className = 'status-indicator online';
            statusText.textContent = 'Server Running';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            accessBtn.style.display = 'inline-block';
            serverInfoCard.style.display = 'grid';
            serverUrl.textContent = `localhost:${response.port}`;
        } else {
            indicator.className = 'status-indicator offline';
            statusText.textContent = 'Server Stopped';
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            accessBtn.style.display = 'none';
            serverInfoCard.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to check server status:', error);
    }
}

// Load catalog
async function loadCatalog() {
    try {
        const response = await spsApi.request('/kiwix/catalog');
        catalog = response.catalog;
        renderCatalog();
    } catch (error) {
        console.error('Failed to load catalog:', error);
        showNotification('Failed to load catalog', 'error');
    }
}

// Render catalog
function renderCatalog() {
    const container = document.getElementById('catalog-grid');

    if (catalog.length === 0) {
        container.innerHTML = '<div class="empty-state">No content available</div>';
        return;
    }

    container.innerHTML = catalog.map(item => `
        <div class="catalog-item">
            <h3>${escapeHtml(item.name)}</h3>
            <span class="category">${escapeHtml(item.category)}</span>
            <p>${escapeHtml(item.description)}</p>
            <div class="size">💾 Size: ${item.size}</div>
            <button onclick="downloadZIM('${escapeHtml(item.url)}', '${escapeHtml(item.name)}')" class="btn btn-primary">
                📥 Download
            </button>
        </div>
    `).join('');
}

// Load library
async function loadLibrary() {
    try {
        const response = await spsApi.request('/kiwix/library');
        library = response.files;
        renderLibrary();
        updateStats();
    } catch (error) {
        console.error('Failed to load library:', error);
        showNotification('Failed to load library', 'error');
    }
}

// Render library
function renderLibrary() {
    const container = document.getElementById('library-list');

    if (library.length === 0) {
        container.innerHTML = '<div class="empty-state">No libraries installed yet. Download from the catalog!</div>';
        return;
    }

    container.innerHTML = library.map(file => `
        <div class="library-item">
            <div class="library-item-info">
                <h3>${escapeHtml(file.filename)}</h3>
                <div class="library-item-meta">
                    <span>💾 ${formatFileSize(file.size)}</span>
                    <span>📅 Added: ${formatDate(file.created)}</span>
                </div>
            </div>
            <div class="library-item-actions">
                <button onclick="deleteZIM('${escapeHtml(file.filename)}')" class="btn btn-danger">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Update stats
function updateStats() {
    const totalSize = library.reduce((sum, file) => sum + file.size, 0);
    document.getElementById('installed-count').textContent = library.length;
    document.getElementById('total-size').textContent = formatFileSize(totalSize);
}

// Download ZIM file
async function downloadZIM(url, name) {
    if (!confirm(`Download ${name}?\n\nThis may take several hours depending on the file size and your internet connection.`)) {
        return;
    }

    // Generate filename from URL
    const filename = url.split('/').pop();

    try {
        const response = await spsApi.request('/kiwix/download', {
            method: 'POST',
            body: JSON.stringify({ url, filename })
        });

        showNotification('Download started! Check the Downloads tab for progress.', 'success');

        // Switch to downloads tab
        switchTab('downloads');

        // Track download
        downloads[filename] = {
            name,
            filename,
            url,
            started: new Date()
        };

        // Start monitoring
        monitorDownload(filename);

    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to start download: ' + error.message, 'error');
    }
}

// Monitor download progress
function monitorDownload(filename) {
    const interval = setInterval(async () => {
        try {
            const response = await spsApi.request(`/kiwix/download/status/${filename}`);

            if (response.exists && response.downloaded > 0) {
                renderDownloads();
            }

            // Check if download is complete by seeing if file size hasn't changed
            if (downloads[filename]) {
                if (downloads[filename].lastSize === response.downloaded) {
                    downloads[filename].stableCount = (downloads[filename].stableCount || 0) + 1;

                    // If size hasn't changed for 3 checks, consider complete
                    if (downloads[filename].stableCount >= 3) {
                        clearInterval(interval);
                        delete downloads[filename];
                        showNotification('Download complete!', 'success');
                        loadLibrary();
                        renderDownloads();
                    }
                } else {
                    downloads[filename].lastSize = response.downloaded;
                    downloads[filename].stableCount = 0;
                }
            }

        } catch (error) {
            console.error('Failed to check download status:', error);
            clearInterval(interval);
        }
    }, 5000);
}

// Render downloads
function renderDownloads() {
    const container = document.getElementById('downloads-list');
    const downloadList = Object.values(downloads);

    if (downloadList.length === 0) {
        container.innerHTML = '<div class="empty-state">No active downloads</div>';
        return;
    }

    container.innerHTML = downloadList.map(download => `
        <div class="download-item">
            <h3>${escapeHtml(download.name)}</h3>
            <div class="download-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="download-stats">
                    <span>Downloading...</span>
                    <span>⏱️ Started: ${formatTime(download.started)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Delete ZIM file
async function deleteZIM(filename) {
    if (!confirm(`Delete ${filename}?\n\nThis will permanently remove the file.`)) {
        return;
    }

    try {
        await spsApi.request(`/kiwix/library/${filename}`, {
            method: 'DELETE'
        });

        showNotification('File deleted successfully', 'success');
        loadLibrary();

    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete file', 'error');
    }
}

// Start Kiwix server
async function startKiwixServer() {
    try {
        const response = await spsApi.request('/kiwix/start', {
            method: 'POST'
        });

        showNotification('Kiwix server starting...', 'success');

        // Wait a bit then check status
        setTimeout(checkServerStatus, 2000);

    } catch (error) {
        console.error('Failed to start server:', error);
        showNotification('Failed to start server: ' + error.message, 'error');
    }
}

// Stop Kiwix server
async function stopKiwixServer() {
    try {
        const response = await spsApi.request('/kiwix/stop', {
            method: 'POST'
        });

        showNotification('Kiwix server stopped', 'success');
        checkServerStatus();

    } catch (error) {
        console.error('Failed to stop server:', error);
        showNotification('Failed to stop server: ' + error.message, 'error');
    }
}

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        // Activate the button that matches the tab name
        if (tab.textContent.toLowerCase().includes(tabName)) {
            tab.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Utility functions
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

function formatTime(date) {
    return date.toLocaleTimeString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

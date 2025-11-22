// Kiwix page functionality

let catalog = [];
let library = [];
let downloads = {};
let serverStatus = { running: false };

// Pagination state
const ITEMS_PER_PAGE = 20;
let currentPage = 1;
let filteredCatalog = [];
let isLoadingMore = false;

// Initialize kiwix page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkServerStatus();
        await loadCatalog();
        await loadLibrary();
    } catch (error) {
        console.error('Failed to initialize Kiwix UI:', error);
    }

    // Start polling for server status
    setInterval(checkServerStatus, 5000);
});

// Check Kiwix server status
async function checkServerStatus() {
    try {
        const response = await spsApi.request('/kiwix/status');
        const indicator = document.getElementById('server-status-indicator');
        const statusText = document.getElementById('status-text');
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        const restartBtn = document.getElementById('restart-btn');
        const killBtn = document.getElementById('kill-btn');
        const accessBtn = document.getElementById('access-btn');
        const serverInfoCard = document.getElementById('server-info-card');
        const serverUrl = document.getElementById('server-url');
        const serverIp = response.ip || (response.ipCandidates && response.ipCandidates[0]) || '';
        const hostDisplay = serverIp || response.clientHost || window.location.hostname || 'localhost';
        const accessHost = (response.clientHost || serverIp || window.location.hostname || 'localhost').toString().split(' ')[0] || 'localhost';

        response.accessHost = accessHost;
        serverStatus = response;

        if (response.running) {
            indicator.className = 'status-indicator online';
            statusText.textContent = 'Server Running';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            if (restartBtn) restartBtn.style.display = 'inline-block';
            if (killBtn) killBtn.style.display = 'inline-block';
            if (accessBtn) {
                accessBtn.style.display = 'inline-block';
                accessBtn.disabled = false;
                accessBtn.title = `Open Kiwix at http://${accessHost}:${response.port}`;
            }
            serverInfoCard.style.display = 'grid';
            serverUrl.textContent = `${hostDisplay}:${response.port}`;
        } else {
            indicator.className = 'status-indicator offline';
            if (response.autoStarting) {
                statusText.textContent = 'Auto-starting...';
            } else if (response.restarting) {
                statusText.textContent = 'Restarting...';
            } else {
                statusText.textContent = 'Server Stopped';
            }
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            if (restartBtn) restartBtn.style.display = 'none';
            if (killBtn) killBtn.style.display = 'none';
            if (accessBtn) {
                accessBtn.style.display = 'none';
                accessBtn.disabled = true;
                accessBtn.title = 'Start the Kiwix server to access the library';
            }
            serverInfoCard.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to check server status:', error);
    }
}

// Open Kiwix Library in new window
function openKiwixLibrary() {
    const host = (serverStatus?.accessHost || serverStatus?.clientHost || serverStatus?.ip || window.location.hostname || 'localhost').toString().split(' ')[0];
    if (serverStatus && serverStatus.running) {
        const url = `http://${host}:${serverStatus.port}`;
        window.open(url, '_blank');
    } else {
        showNotification('Kiwix server is not running', 'error');
    }
}

// Load catalog
async function loadCatalog() {
    try {
        const response = await spsApi.request('/kiwix/catalog');
        catalog = response.catalog;
        renderCatalog();

        if (response.scanning) {
            showNotification(response.message || 'Catalog scan in progress...', 'info');
        } else if (response.cached && response.cacheAge) {
            const hours = Math.floor(response.cacheAge / 60);
            const mins = response.cacheAge % 60;
            console.log(`Catalog cached (${hours}h ${mins}m old)`);
        }
    } catch (error) {
        console.error('Failed to load catalog:', error);
        showNotification('Failed to load catalog', 'error');
    }
}

// Force rescan catalog
async function forceRescanCatalog() {
    try {
        const btn = document.getElementById('rescan-btn');
        btn.disabled = true;
        btn.textContent = '⏳ Scanning...';

        const response = await spsApi.request('/kiwix/catalog?force=true');

        showNotification('Catalog scan started in background. Refresh in a minute to see new results.', 'success');

        // Re-enable button after 60 seconds
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = '🔄 Force Rescan';
        }, 60000);
    } catch (error) {
        console.error('Failed to force rescan:', error);
        showNotification('Failed to start rescan', 'error');
        const btn = document.getElementById('rescan-btn');
        btn.disabled = false;
        btn.textContent = '🔄 Force Rescan';
    }
}

// Render catalog with pagination
function renderCatalog(searchTerm = '', reset = true) {
    const container = document.getElementById('catalog-grid');

    if (catalog.length === 0) {
        container.innerHTML = '<div class="empty-state">Loading catalog...</div>';
        return;
    }

    // Reset pagination on new search
    if (reset) {
        currentPage = 1;
    }

    // Filter catalog based on search
    filteredCatalog = catalog;
    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredCatalog = catalog.filter(item =>
            item.name.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term) ||
            item.category.toLowerCase().includes(term)
        );
    }

    if (filteredCatalog.length === 0) {
        container.innerHTML = `<div class="empty-state">No content found for "${escapeHtml(searchTerm)}"</div>`;
        removeLoadMoreButton();
        return;
    }

    // Get items for current page
    const startIdx = 0;
    const endIdx = currentPage * ITEMS_PER_PAGE;
    const itemsToShow = filteredCatalog.slice(startIdx, endIdx);
    const hasMore = endIdx < filteredCatalog.length;

    // Show count
    const countHtml = `<div class="catalog-count">Showing ${itemsToShow.length} of ${filteredCatalog.length} items</div>`;

    container.innerHTML = countHtml + itemsToShow.map(item => {
        const filename = item.url.split('/').pop();
        const sizeLabel = item.sizeBytes ? formatBytes(item.sizeBytes) : (item.size || '0 MB');
        const description = item.description || '';
        return `
        <div class="catalog-item">
            <div class="catalog-summary">
                <h3>${escapeHtml(item.name)}</h3>
                <div class="catalog-meta">
                    <span class="category category-${escapeHtml(item.category)}">${escapeHtml(item.category)}</span>
                    <span class="language">🌐 ${escapeHtml(item.language || 'eng')}</span>
                    <span class="size">💾 ${escapeHtml(sizeLabel)}</span>
                </div>
            </div>
            <div class="catalog-actions">
                ${item.date ? `<span class="date">Updated: ${new Date(item.date).toLocaleDateString()}</span>` : ''}
                <button type="button" class="btn btn-primary btn-sm" data-url="${escapeHtml(item.url)}" data-name="${escapeHtml(filename)}" onclick="handleDownloadClick(event)">
                    📥 Download
                </button>
            </div>
            ${description ? `<p>${escapeHtml(description.substring(0, 150))}${description.length > 150 ? '...' : ''}</p>` : ''}
        </div>
    `;
    }).join('');

    // Add load more button if there are more items
    if (hasMore) {
        addLoadMoreButton();
    } else {
        removeLoadMoreButton();
    }
}

// Load more items
function loadMoreCatalogItems() {
    if (isLoadingMore) return;
    isLoadingMore = true;

    currentPage++;
    const searchInput = document.getElementById('catalog-search');
    const searchTerm = searchInput ? searchInput.value : '';

    renderCatalog(searchTerm, false);
    isLoadingMore = false;
}

// Add load more button
function addLoadMoreButton() {
    let btn = document.getElementById('load-more-btn');
    if (!btn) {
        const container = document.getElementById('catalog-grid');
        btn = document.createElement('button');
        btn.id = 'load-more-btn';
        btn.className = 'btn btn-outline load-more-btn';
        btn.textContent = 'Load More';
        btn.onclick = loadMoreCatalogItems;
        container.parentNode.insertBefore(btn, container.nextSibling);
    }
    btn.style.display = 'block';
    btn.textContent = `Load More (${filteredCatalog.length - currentPage * ITEMS_PER_PAGE} remaining)`;
}

// Remove load more button
function removeLoadMoreButton() {
    const btn = document.getElementById('load-more-btn');
    if (btn) {
        btn.style.display = 'none';
    }
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

// Download button handler
function handleDownloadClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const url = button.dataset.url;
    const name = button.dataset.name || url?.split('/').pop();

    if (!url) {
        console.error('No download URL provided for this item');
        return;
    }

    downloadZIM(url, name);
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

// Restart Kiwix server
async function restartKiwixServer() {
    try {
        showNotification('Restarting Kiwix server...', 'info');

        const response = await spsApi.request('/kiwix/restart', {
            method: 'POST'
        });

        showNotification('Kiwix server restarted successfully', 'success');
        setTimeout(() => checkServerStatus(), 2000);

    } catch (error) {
        console.error('Failed to restart server:', error);
        showNotification('Failed to restart server: ' + error.message, 'error');
    }
}

// Kill Kiwix server (force stop)
async function killKiwixServer() {
    if (!confirm('Are you sure you want to force kill the Kiwix server? This will stop it immediately.')) {
        return;
    }

    try {
        const response = await spsApi.request('/kiwix/kill', {
            method: 'POST'
        });

        showNotification('Kiwix server killed successfully', 'success');
        checkServerStatus();

    } catch (error) {
        console.error('Failed to kill server:', error);
        showNotification('Failed to kill server: ' + error.message, 'error');
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

    // Load data for specific tabs
    if (tabName === 'downloads') {
        loadDownloads();
    } else if (tabName === 'library') {
        loadLibrary();
    }
}

// Utility functions
function formatFileSize(bytes) {
    return formatBytes(bytes);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatTime(date) {
    return date.toLocaleTimeString();
}

// Search catalog
function searchCatalog(term) {
    renderCatalog(term);
    const count = document.getElementById('catalog-count');
    if (count) {
        const filtered = term ? catalog.filter(item =>
            item.name.toLowerCase().includes(term.toLowerCase()) ||
            item.description.toLowerCase().includes(term.toLowerCase()) ||
            item.category.toLowerCase().includes(term.toLowerCase())
        ).length : catalog.length;
        count.textContent = `${filtered} of ${catalog.length} results`;
    }
}

// Load active downloads and update progress
let downloadInterval;

async function loadDownloads() {
    try {
        const response = await spsApi.request('/kiwix/downloads');
        const downloads = response.downloads || [];

        const container = document.getElementById('downloads-list');

        if (downloads.length === 0) {
            container.innerHTML = '<div class="empty-state">No active downloads</div>';
            if (downloadInterval) {
                clearInterval(downloadInterval);
                downloadInterval = null;
            }
            return;
        }

        container.innerHTML = downloads.map(dl => `
            <div class="download-item">
                <div class="download-header">
                    <h4>${escapeHtml(dl.filename)}</h4>
                    <span class="download-status status-${dl.status}">${escapeHtml(dl.status)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${dl.progress || 0}%"></div>
                    <span class="progress-text">${dl.progress || 0}%</span>
                </div>
                <div class="download-info">
                    ${dl.downloaded ? `<span>Downloaded: ${formatBytes(dl.downloaded)}</span>` : ''}
                    ${dl.startTime ? `<span>Started: ${new Date(dl.startTime).toLocaleTimeString()}</span>` : ''}
                </div>
            </div>
        `).join('');

        // Auto-refresh if there are active downloads
        if (!downloadInterval) {
            downloadInterval = setInterval(loadDownloads, 3000);
        }
    } catch (error) {
        console.error('Failed to load downloads:', error);
    }
}

// Format bytes to human readable
function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    const gb = bytes / Math.pow(1024, 3);
    if (gb >= 1) {
        const decimals = gb >= 10 ? 1 : 2;
        return `${gb.toFixed(decimals)} GB`;
    }

    const mb = bytes / Math.pow(1024, 2);
    const decimals = mb >= 10 ? 1 : 2;
    return `${mb.toFixed(decimals)} MB`;
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

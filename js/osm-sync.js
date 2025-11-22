// OSM Sync Management
let currentJobId = null;
let statusInterval = null;
let jobPollInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadPresets();
    await checkSystemStatus();

    // Poll status every 10 seconds
    statusInterval = setInterval(checkSystemStatus, 10000);
});

// Load available presets
async function loadPresets() {
    try {
        const response = await fetch('/api/osm/presets');
        const presets = await response.json();

        const presetsGrid = document.getElementById('presets-grid');
        presetsGrid.innerHTML = '';

        presets.forEach(preset => {
            const card = document.createElement('div');
            card.className = 'preset-card';
            card.innerHTML = `
                <h3>${preset.name}</h3>
                <div class="preset-info">
                    <div class="preset-info-item">
                        <span class="preset-info-label">Download Size:</span>
                        <span class="preset-info-value">${preset.size}</span>
                    </div>
                    <div class="preset-info-item">
                        <span class="preset-info-label">Disk Space Needed:</span>
                        <span class="preset-info-value">${preset.diskSpace}</span>
                    </div>
                    <div class="preset-info-item">
                        <span class="preset-info-label">Import Time:</span>
                        <span class="preset-info-value">${preset.importTime}</span>
                    </div>
                </div>
                <p class="preset-description">${preset.description}</p>
                <button onclick="startPresetSync('${preset.id}')" class="btn btn-primary">
                    Download ${preset.name}
                </button>
            `;
            presetsGrid.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load presets:', error);
        showNotification('Failed to load presets', 'error');
    }
}

// Check system status
async function checkSystemStatus() {
    try {
        const response = await fetch('/api/osm/status');
        const status = await response.json();

        // Update database status
        updateStatusCard('database-status', status.database);

        // Update tile server status
        updateStatusCard('tileserver-status', status.tileServer);

        // Update geocoder status
        updateStatusCard('geocoder-status', status.geocoder);

        // Update data files status
        updateStatusCard('datafiles-status', status.dataFiles);

        // Check for active sync job
        if (status.syncJob) {
            currentJobId = status.syncJob.id;
            showActiveSyncJob(status.syncJob);
            startJobPolling();
        } else if (currentJobId) {
            // Job completed
            stopJobPolling();
            currentJobId = null;
            hideActiveSyncJob();
            await checkSystemStatus(); // Refresh status
        }
    } catch (error) {
        console.error('Failed to check system status:', error);
    }
}

// Update status card
function updateStatusCard(cardId, statusData) {
    const card = document.getElementById(cardId);
    const statusText = card.querySelector('.status-text');
    const statusDetail = card.querySelector('.status-detail');

    // Remove existing status classes
    card.classList.remove('status-ok', 'status-error', 'status-warning');

    // Map backend status values to UI classes
    const status = statusData.status;
    if (status === 'ready' || status === 'present' || status === 'online') {
        card.classList.add('status-ok');
        statusText.textContent = status === 'ready' ? 'Ready' :
                                 status === 'present' ? 'Available' : 'Running';

        // Add detailed info
        if (statusData.tables) {
            statusDetail.textContent = `${statusData.tables} tables imported`;
        } else if (statusData.size) {
            statusDetail.textContent = `Size: ${statusData.size}`;
        } else if (statusData.port) {
            statusDetail.textContent = `Port: ${statusData.port}`;
        }
    } else if (status === 'offline' || status === 'not_present') {
        card.classList.add('status-warning');
        statusText.textContent = status === 'offline' ? 'Offline' : 'Not Available';
        if (statusData.port) {
            statusDetail.textContent = `Port ${statusData.port} not responding`;
        } else {
            statusDetail.textContent = 'No data files found';
        }
    } else if (status === 'error' || status === 'not_configured') {
        card.classList.add('status-error');
        statusText.textContent = 'Error';
        statusDetail.textContent = statusData.message || statusData.error || 'Configuration error';
    } else {
        statusText.textContent = status || 'Unknown';
        statusDetail.textContent = statusData.message || '';
    }
}

// Start preset sync
async function startPresetSync(presetId) {
    if (currentJobId) {
        showNotification('A sync job is already running', 'warning');
        return;
    }

    if (!confirm('This will download and import map data. Continue?')) {
        return;
    }

    try {
        const response = await fetch('/api/osm/sync/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetId })
        });

        if (!response.ok) {
            throw new Error('Failed to start sync');
        }

        const result = await response.json();
        currentJobId = result.jobId;

        showNotification('Sync job started', 'success');
        startJobPolling();
    } catch (error) {
        console.error('Failed to start sync:', error);
        showNotification('Failed to start sync job', 'error');
    }
}

// Start custom URL sync
async function startCustomSync() {
    if (currentJobId) {
        showNotification('A sync job is already running', 'warning');
        return;
    }

    const input = document.getElementById('custom-url-input');
    const customUrl = input.value.trim();

    if (!customUrl) {
        showNotification('Please enter a URL', 'warning');
        return;
    }

    if (!customUrl.endsWith('.osm.pbf')) {
        showNotification('URL must point to a .osm.pbf file', 'warning');
        return;
    }

    if (!confirm('This will download and import map data. Continue?')) {
        return;
    }

    try {
        const response = await fetch('/api/osm/sync/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customUrl })
        });

        if (!response.ok) {
            throw new Error('Failed to start sync');
        }

        const result = await response.json();
        currentJobId = result.jobId;

        showNotification('Sync job started', 'success');
        input.value = '';
        startJobPolling();
    } catch (error) {
        console.error('Failed to start sync:', error);
        showNotification('Failed to start sync job', 'error');
    }
}

// Cancel sync job
async function cancelSyncJob() {
    if (!currentJobId) return;

    if (!confirm('Are you sure you want to cancel this sync job?')) {
        return;
    }

    try {
        const response = await fetch(`/api/osm/sync/${currentJobId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to cancel sync');
        }

        showNotification('Sync job cancelled', 'info');
        stopJobPolling();
        currentJobId = null;
        hideActiveSyncJob();
    } catch (error) {
        console.error('Failed to cancel sync:', error);
        showNotification('Failed to cancel sync job', 'error');
    }
}

// Start polling job progress
function startJobPolling() {
    if (jobPollInterval) {
        clearInterval(jobPollInterval);
    }

    // Poll every 2 seconds
    jobPollInterval = setInterval(pollJobProgress, 2000);
    pollJobProgress(); // Initial poll
}

// Stop polling job progress
function stopJobPolling() {
    if (jobPollInterval) {
        clearInterval(jobPollInterval);
        jobPollInterval = null;
    }
}

// Poll job progress
async function pollJobProgress() {
    if (!currentJobId) {
        stopJobPolling();
        return;
    }

    try {
        const response = await fetch(`/api/osm/sync/${currentJobId}`);

        if (!response.ok) {
            throw new Error('Failed to fetch job progress');
        }

        const job = await response.json();
        updateJobDisplay(job);

        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            stopJobPolling();

            if (job.status === 'completed') {
                showNotification('Sync completed successfully!', 'success');
            } else if (job.status === 'failed') {
                showNotification('Sync failed: ' + (job.error || 'Unknown error'), 'error');
            } else {
                showNotification('Sync cancelled', 'info');
            }

            setTimeout(() => {
                currentJobId = null;
                hideActiveSyncJob();
                checkSystemStatus();
            }, 5000);
        }
    } catch (error) {
        console.error('Failed to poll job progress:', error);
    }
}

// Update job display
function updateJobDisplay(job) {
    document.getElementById('job-preset-name').textContent = job.preset;
    document.getElementById('job-progress-percent').textContent = job.progress;
    document.getElementById('job-progress-fill').style.width = `${job.progress}%`;
    document.getElementById('job-stage').textContent = job.stage || 'Processing...';
    document.getElementById('job-status').textContent = job.status;

    // Update log
    const logContent = document.getElementById('job-log-content');
    if (job.log && job.log.length > 0) {
        // Show last 20 log entries
        const recentLogs = job.log.slice(-20);
        logContent.innerHTML = recentLogs.map(entry => {
            const logClass = entry.includes('Error') ? 'log-error' :
                           entry.includes('Complete') ? 'log-success' : 'log-info';
            return `<div class="log-entry ${logClass}">${escapeHtml(entry)}</div>`;
        }).join('');

        // Scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;
    }
}

// Show active sync job
function showActiveSyncJob(job) {
    document.getElementById('active-sync-section').style.display = 'block';
    document.getElementById('presets-section').style.display = 'none';
    updateJobDisplay(job);
}

// Hide active sync job
function hideActiveSyncJob() {
    document.getElementById('active-sync-section').style.display = 'none';
    document.getElementById('presets-section').style.display = 'block';
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (statusInterval) clearInterval(statusInterval);
    if (jobPollInterval) clearInterval(jobPollInterval);
});

/**
 * SPS QR Scanner Module
 * Handles scanning, decoding, and displaying full item data from QR codes
 * Supports both pantry and inventory items with offline sync options
 */

const QRScanner = (function() {
    'use strict';

    let scanner = null;
    let scanCallback = null;
    let lastScannedCode = null;

    /**
     * Initialize scanner modal if it doesn't exist
     */
    function ensureScannerModal() {
        let modal = document.getElementById('qr-scanner-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'qr-scanner-modal';
            modal.className = 'modal scanner-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Scan QR Code</h3>
                        <button type="button" class="modal-close" onclick="QRScanner.close()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="qr-scanner-viewport" class="scanner-viewport"></div>
                        <div id="qr-scanner-status" class="scanner-status">Initializing camera...</div>
                        <div class="scanner-manual-input">
                            <input type="text" id="qr-manual-input" placeholder="Or enter code manually...">
                            <button type="button" class="btn btn-primary" onclick="QRScanner.processManualInput()">Submit</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        return modal;
    }

    /**
     * Create scanned item details modal
     */
    function ensureDetailsModal() {
        let modal = document.getElementById('qr-scanned-details-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'qr-scanned-details-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="qr-details-title">Scanned Item</h3>
                        <button type="button" class="modal-close" onclick="QRScanner.closeDetails()">&times;</button>
                    </div>
                    <div class="modal-body" id="qr-details-body">
                        <!-- Content populated dynamically -->
                    </div>
                    <div class="modal-footer" id="qr-details-footer">
                        <!-- Buttons populated dynamically -->
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        return modal;
    }

    /**
     * Open scanner modal
     * @param {Function} callback - Optional callback when code is scanned
     */
    function open(callback = null) {
        scanCallback = callback;
        const modal = ensureScannerModal();
        modal.classList.add('active');

        const status = document.getElementById('qr-scanner-status');
        status.textContent = 'Initializing camera...';
        status.className = 'scanner-status';

        startCamera();
    }

    /**
     * Close scanner modal
     */
    function close() {
        const modal = document.getElementById('qr-scanner-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        stopCamera();
        scanCallback = null;
    }

    /**
     * Start camera for scanning
     */
    async function startCamera() {
        const viewport = document.getElementById('qr-scanner-viewport');
        const status = document.getElementById('qr-scanner-status');

        // Check if Html5QrcodeScanner is available
        if (typeof Html5Qrcode !== 'undefined') {
            try {
                scanner = new Html5Qrcode('qr-scanner-viewport');
                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 }
                    },
                    onScanSuccess,
                    onScanFailure
                );
                status.textContent = 'Point camera at QR code';
                status.className = 'scanner-status';
            } catch (err) {
                console.error('[QRScanner] Camera error:', err);
                status.textContent = 'Camera unavailable. Use manual entry.';
                status.className = 'scanner-status error';
            }
            return;
        }

        // Fallback to Quagga
        if (typeof Quagga !== 'undefined') {
            try {
                Quagga.init({
                    inputStream: {
                        name: 'Live',
                        type: 'LiveStream',
                        target: viewport,
                        constraints: {
                            facingMode: 'environment',
                            width: { min: 640 },
                            height: { min: 480 }
                        }
                    },
                    decoder: {
                        readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'code_128_reader']
                    },
                    locate: true
                }, (err) => {
                    if (err) {
                        status.textContent = 'Camera unavailable. Use manual entry.';
                        status.className = 'scanner-status error';
                        return;
                    }
                    Quagga.start();
                    status.textContent = 'Point camera at code';
                });

                Quagga.onDetected((result) => {
                    if (result.codeResult.code) {
                        onScanSuccess(result.codeResult.code);
                    }
                });

                scanner = Quagga;
            } catch (err) {
                status.textContent = 'Scanner not available. Use manual entry.';
                status.className = 'scanner-status error';
            }
            return;
        }

        status.textContent = 'No scanner library available. Use manual entry.';
        status.className = 'scanner-status error';
    }

    /**
     * Stop camera
     */
    function stopCamera() {
        if (scanner) {
            if (typeof scanner.stop === 'function') {
                scanner.stop().catch(() => {});
            }
            scanner = null;
        }
    }

    /**
     * Handle successful scan
     */
    function onScanSuccess(decodedText) {
        // Prevent duplicate scans
        if (decodedText === lastScannedCode) return;
        lastScannedCode = decodedText;

        // Play beep
        playBeep();

        // Close scanner
        close();

        // Process the scanned code
        if (scanCallback) {
            scanCallback(decodedText);
        } else {
            processScannedCode(decodedText);
        }

        // Reset last scanned after delay
        setTimeout(() => { lastScannedCode = null; }, 2000);
    }

    /**
     * Handle scan failure (ignore - just means no QR in view)
     */
    function onScanFailure(error) {
        // Ignore - normal when QR not in view
    }

    /**
     * Process manual input
     */
    function processManualInput() {
        const input = document.getElementById('qr-manual-input');
        const code = input.value.trim();
        if (code) {
            onScanSuccess(code);
        }
    }

    /**
     * Process scanned QR code
     */
    async function processScannedCode(code) {
        // Try to decode as SPS QR code
        if (typeof QRData !== 'undefined') {
            const decoded = QRData.decode(code);
            if (decoded) {
                showScannedItemDetails(decoded);
                return;
            }
        }

        // Try to parse as raw JSON
        try {
            const parsed = JSON.parse(code);
            if (parsed.type && (parsed.name || parsed.items)) {
                showScannedItemDetails(parsed);
                return;
            }
        } catch (e) {
            // Not JSON
        }

        // Treat as barcode - lookup in existing items
        showBarcodeSearchResult(code);
    }

    /**
     * Show scanned item details with sync options
     */
    async function showScannedItemDetails(data) {
        const modal = ensureDetailsModal();
        const title = document.getElementById('qr-details-title');
        const body = document.getElementById('qr-details-body');
        const footer = document.getElementById('qr-details-footer');

        const isGroup = data.isGroup || data.items;
        const isPantry = data.type === 'pantry' || data.type === 'p';
        const typeName = isPantry ? 'Pantry' : 'Inventory';

        // Set title
        title.textContent = isGroup ? `${typeName} Group` : `${typeName} Item`;

        // Build content
        if (isGroup) {
            body.innerHTML = buildGroupDisplay(data, typeName);
        } else {
            body.innerHTML = buildItemDisplay(data, typeName);
        }

        // Add sync comparison if we have an ID
        let syncStatus = null;
        if (data.id && !isGroup) {
            syncStatus = await checkSyncStatus(data);
            if (syncStatus) {
                body.innerHTML += buildSyncStatusDisplay(syncStatus);
            }
        }

        // Build footer buttons
        footer.innerHTML = buildFooterButtons(data, syncStatus, isPantry);

        modal.classList.add('active');
    }

    /**
     * Build single item display HTML
     */
    function buildItemDisplay(data, typeName) {
        const qrDate = data.created ? new Date(data.created).toLocaleString() : 'Unknown';

        let html = `
            <div class="qr-scanned-item">
                <div class="qr-item-header">
                    <span class="qr-item-type badge">${typeName}</span>
                    <span class="qr-item-date">QR Date: ${qrDate}</span>
                </div>
                <h3 class="qr-item-name">${escapeHtml(data.name || 'Unknown')}</h3>
                <div class="qr-item-grid">
                    <div class="qr-item-field">
                        <label>Quantity</label>
                        <span>${data.quantity || 0} ${data.unit || ''}</span>
                    </div>
                    <div class="qr-item-field">
                        <label>Category</label>
                        <span>${escapeHtml(data.category || 'N/A')}</span>
                    </div>
                    <div class="qr-item-field">
                        <label>Location</label>
                        <span>${escapeHtml(data.location || 'N/A')}</span>
                    </div>
        `;

        if (typeName === 'Pantry') {
            if (data.expiration_date) {
                html += `
                    <div class="qr-item-field">
                        <label>Expires</label>
                        <span class="${getExpiryClass(data.expiration_date)}">${formatDate(data.expiration_date)}</span>
                    </div>
                `;
            }
            if (data.calories_per_unit) {
                const totalCal = (data.calories_per_unit || 0) * (data.quantity || 1);
                html += `
                    <div class="qr-item-field">
                        <label>Total Calories</label>
                        <span>${formatNumber(totalCal)}</span>
                    </div>
                `;
            }
        } else {
            if (data.serial_number) {
                html += `
                    <div class="qr-item-field">
                        <label>Serial Number</label>
                        <span>${escapeHtml(data.serial_number)}</span>
                    </div>
                `;
            }
            if (data.min_quantity) {
                html += `
                    <div class="qr-item-field">
                        <label>Min Quantity</label>
                        <span>${data.min_quantity}</span>
                    </div>
                `;
            }
        }

        if (data.notes) {
            html += `
                <div class="qr-item-field full-width">
                    <label>Notes</label>
                    <span>${escapeHtml(data.notes)}</span>
                </div>
            `;
        }

        html += '</div></div>';
        return html;
    }

    /**
     * Build group display HTML
     */
    function buildGroupDisplay(data, typeName) {
        const items = data.items || [];
        const totalQty = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);

        let html = `
            <div class="qr-scanned-group">
                <div class="qr-group-header">
                    <h3>${escapeHtml(data.group_name || data.name || 'Item Group')}</h3>
                    <span class="qr-item-type badge">${typeName} Group</span>
                </div>
                <div class="qr-group-summary">
                    <div class="summary-stat">
                        <span class="stat-value">${items.length}</span>
                        <span class="stat-label">Items</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${totalQty}</span>
                        <span class="stat-label">Total Qty</span>
                    </div>
                </div>
                <div class="qr-group-items">
                    <h4>Items in Group</h4>
                    <ul class="group-items-list">
        `;

        items.forEach(item => {
            html += `
                <li>
                    <span class="item-name">${escapeHtml(item.name || 'Unknown')}</span>
                    <span class="item-qty">${item.quantity || 0} ${item.unit || ''}</span>
                </li>
            `;
        });

        html += '</ul></div></div>';
        return html;
    }

    /**
     * Build sync status display
     */
    function buildSyncStatusDisplay(syncStatus) {
        let statusClass = '';
        let statusIcon = '';

        switch (syncStatus.action) {
            case 'none':
                statusClass = 'sync-ok';
                statusIcon = '✓';
                break;
            case 'update_db':
                statusClass = 'sync-update-db';
                statusIcon = '↑';
                break;
            case 'update_qr':
                statusClass = 'sync-update-qr';
                statusIcon = '↓';
                break;
            case 'create':
                statusClass = 'sync-create';
                statusIcon = '+';
                break;
        }

        let html = `
            <div class="qr-sync-status ${statusClass}">
                <div class="sync-header">
                    <span class="sync-icon">${statusIcon}</span>
                    <span class="sync-message">${syncStatus.message}</span>
                </div>
        `;

        if (syncStatus.differences && syncStatus.differences.length > 0) {
            html += `
                <div class="sync-differences">
                    <h5>Differences Found:</h5>
                    <table class="diff-table">
                        <tr><th>Field</th><th>QR Value</th><th>Database Value</th></tr>
            `;
            syncStatus.differences.forEach(diff => {
                html += `
                    <tr>
                        <td>${diff.field}</td>
                        <td>${escapeHtml(String(diff.qrValue || '—'))}</td>
                        <td>${escapeHtml(String(diff.dbValue || '—'))}</td>
                    </tr>
                `;
            });
            html += '</table></div>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Build footer buttons
     */
    function buildFooterButtons(data, syncStatus, isPantry) {
        let html = '<button type="button" class="btn btn-secondary" onclick="QRScanner.closeDetails()">Close</button>';

        if (data.isGroup || data.items) {
            // Group actions
            html += `<button type="button" class="btn btn-primary" onclick="QRScanner.viewGroupItems(${JSON.stringify(data.items).replace(/"/g, '&quot;')}, ${isPantry})">View All Items</button>`;
        } else {
            // Single item actions
            if (syncStatus) {
                switch (syncStatus.action) {
                    case 'create':
                        html += `<button type="button" class="btn btn-success" onclick="QRScanner.createFromQR()">Add to ${isPantry ? 'Pantry' : 'Inventory'}</button>`;
                        break;
                    case 'update_db':
                        html += `<button type="button" class="btn btn-warning" onclick="QRScanner.updateDBFromQR()">Update Database</button>`;
                        break;
                    case 'update_qr':
                        html += `<button type="button" class="btn btn-info" onclick="QRScanner.regenerateQR()">Regenerate QR</button>`;
                        break;
                }
            }

            if (data.id) {
                html += `<button type="button" class="btn btn-primary" onclick="QRScanner.viewItem(${data.id}, ${isPantry})">View Item</button>`;
            }
        }

        return html;
    }

    /**
     * Check sync status between QR data and database
     */
    async function checkSyncStatus(qrData) {
        if (!qrData.id) return null;

        const isPantry = qrData.type === 'pantry' || qrData.type === 'p';
        const endpoint = isPantry ? `/api/pantry/items/${qrData.id}` : `/api/inventory/${qrData.id}`;

        try {
            const response = await fetch(endpoint, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return {
                        action: 'create',
                        message: 'Item not found in database. Create new entry?',
                        qrData,
                        dbData: null
                    };
                }
                return null;
            }

            const dbData = await response.json();

            if (typeof QRData !== 'undefined') {
                return QRData.compareSyncData(qrData, dbData.item || dbData);
            }

            // Simple comparison
            return {
                action: 'none',
                message: 'Item found in database',
                qrData,
                dbData: dbData.item || dbData
            };
        } catch (err) {
            console.error('[QRScanner] Sync check error:', err);
            return null;
        }
    }

    /**
     * Show barcode search result
     */
    async function showBarcodeSearchResult(barcode) {
        const modal = ensureDetailsModal();
        const title = document.getElementById('qr-details-title');
        const body = document.getElementById('qr-details-body');
        const footer = document.getElementById('qr-details-footer');

        title.textContent = 'Barcode Scanned';

        body.innerHTML = `
            <div class="qr-barcode-result">
                <div class="barcode-display">
                    <span class="barcode-icon">📦</span>
                    <span class="barcode-value">${escapeHtml(barcode)}</span>
                </div>
                <div id="barcode-search-status">Searching for item...</div>
            </div>
        `;

        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" onclick="QRScanner.closeDetails()">Close</button>
            <button type="button" class="btn btn-primary" onclick="QRScanner.addNewWithBarcode('${escapeHtml(barcode)}')">Add New Item</button>
        `;

        modal.classList.add('active');

        // Search for item with this barcode
        await searchByBarcode(barcode);
    }

    /**
     * Search for item by barcode
     */
    async function searchByBarcode(barcode) {
        const statusEl = document.getElementById('barcode-search-status');

        try {
            // Search pantry
            const pantryRes = await fetch(`/api/pantry/items?barcode=${encodeURIComponent(barcode)}`, {
                headers: getAuthHeaders()
            });
            if (pantryRes.ok) {
                const data = await pantryRes.json();
                if (data.items && data.items.length > 0) {
                    statusEl.innerHTML = `
                        <div class="found-items">
                            <p><strong>Found in Pantry:</strong></p>
                            <ul>
                                ${data.items.map(i => `<li>${escapeHtml(i.name)} - ${i.quantity} ${i.unit || ''}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                    return;
                }
            }

            // Search inventory
            const invRes = await fetch(`/api/inventory?barcode=${encodeURIComponent(barcode)}`, {
                headers: getAuthHeaders()
            });
            if (invRes.ok) {
                const data = await invRes.json();
                if (data.items && data.items.length > 0) {
                    statusEl.innerHTML = `
                        <div class="found-items">
                            <p><strong>Found in Inventory:</strong></p>
                            <ul>
                                ${data.items.map(i => `<li>${escapeHtml(i.name)} - ${i.quantity} ${i.unit || ''}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                    return;
                }
            }

            statusEl.innerHTML = '<p>No items found with this barcode. You can add it as a new item.</p>';

        } catch (err) {
            console.error('[QRScanner] Barcode search error:', err);
            statusEl.innerHTML = '<p>Search failed. You can still add as new item.</p>';
        }
    }

    /**
     * Close details modal
     */
    function closeDetails() {
        const modal = document.getElementById('qr-scanned-details-modal');
        if (modal) {
            modal.classList.remove('active');
        }
        window.currentScannedData = null;
    }

    /**
     * View item in appropriate module
     */
    function viewItem(itemId, isPantry) {
        closeDetails();
        if (isPantry && typeof editPantryItem === 'function') {
            editPantryItem(itemId);
        } else if (!isPantry && typeof editItem === 'function') {
            editItem(itemId);
        }
    }

    /**
     * View all items in group
     */
    function viewGroupItems(items, isPantry) {
        // Just close and let user navigate
        closeDetails();
        showNotification(`${items.length} items in group`, 'info');
    }

    /**
     * Add new item with barcode pre-filled
     */
    function addNewWithBarcode(barcode) {
        closeDetails();
        // Try to open appropriate add modal
        if (typeof openAddItemModal === 'function') {
            openAddItemModal();
            setTimeout(() => {
                const barcodeInput = document.getElementById('item-barcode') || document.getElementById('food-barcode');
                if (barcodeInput) barcodeInput.value = barcode;
            }, 100);
        }
    }

    /**
     * Create item from QR data
     */
    async function createFromQR() {
        const data = window.currentScannedData;
        if (!data) return;

        const isPantry = data.type === 'pantry' || data.type === 'p';
        const endpoint = isPantry ? '/api/pantry/items' : '/api/inventory';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Failed to create item');

            showNotification('Item created successfully', 'success');
            closeDetails();

            // Reload data
            if (isPantry && typeof loadPantryData === 'function') {
                loadPantryData();
            } else if (!isPantry && typeof loadInventoryData === 'function') {
                loadInventoryData();
            }

        } catch (err) {
            console.error('[QRScanner] Create error:', err);
            showNotification('Failed to create item', 'error');
        }
    }

    /**
     * Update database from QR data
     */
    async function updateDBFromQR() {
        const data = window.currentScannedData;
        if (!data || !data.id) return;

        const isPantry = data.type === 'pantry' || data.type === 'p';
        const endpoint = isPantry ? `/api/pantry/items/${data.id}` : `/api/inventory/${data.id}`;

        try {
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Failed to update item');

            showNotification('Database updated from QR data', 'success');
            closeDetails();

            // Reload data
            if (isPantry && typeof loadPantryData === 'function') {
                loadPantryData();
            } else if (!isPantry && typeof loadInventoryData === 'function') {
                loadInventoryData();
            }

        } catch (err) {
            console.error('[QRScanner] Update error:', err);
            showNotification('Failed to update database', 'error');
        }
    }

    /**
     * Regenerate QR code for item
     */
    function regenerateQR() {
        const data = window.currentScannedData;
        if (!data || !data.id) return;

        const isPantry = data.type === 'pantry' || data.type === 'p';
        closeDetails();

        if (isPantry && typeof showItemQRCode === 'function') {
            showItemQRCode(data.id);
        } else if (!isPantry && typeof showInventoryItemQRCode === 'function') {
            showInventoryItemQRCode(data.id);
        }
    }

    // Utility functions

    function getAuthHeaders() {
        const token = localStorage.getItem('sps_token') || localStorage.getItem('token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function getExpiryClass(dateStr) {
        if (!dateStr) return '';
        const exp = new Date(dateStr).getTime();
        const now = Date.now();
        const thirtyDays = now + (30 * 24 * 60 * 60 * 1000);
        if (exp < now) return 'expired';
        if (exp <= thirtyDays) return 'expiring-soon';
        return '';
    }

    function showNotification(message, type = 'info') {
        // Use existing notification function if available
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }

        // Fallback
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = 'position: fixed; top: 1rem; right: 1rem; z-index: 9999;';
            document.body.appendChild(container);
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            padding: 1rem 1.5rem;
            margin-bottom: 0.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
        `;
        notification.textContent = message;

        container.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    function playBeep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 1000;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {}
    }

    // Store scanned data globally for action buttons
    function setCurrentScannedData(data) {
        window.currentScannedData = data;
    }

    // Public API
    return {
        open,
        close,
        closeDetails,
        processManualInput,
        viewItem,
        viewGroupItems,
        addNewWithBarcode,
        createFromQR,
        updateDBFromQR,
        regenerateQR,
        processScannedCode
    };
})();

// Make globally available
window.QRScanner = QRScanner;

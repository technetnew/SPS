/**
 * SPS Advanced Inventory Module
 * Features: Barcode scanning, Par levels, DOS calculator, Multi-location storage
 */

// Global state
let inventoryItems = [];
let categories = [];
let locations = [];
let currentSort = { column: 'name', direction: 'asc' };
let currentFilters = { search: '', category: '', location: '', status: '' };
let editingItemId = null;
let scanner = null;
let expandedInventoryGroups = new Set(); // Track which groups are expanded

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initInventory();
    initBarcodeScanner();
    initModals();
    initFilters();
    loadInventoryData();
});

/**
 * Initialize inventory module
 */
function initInventory() {
    console.log('[Inventory] Initializing module...');

    // Load categories and locations
    loadCategories();
    loadLocations();
}

/**
 * Load inventory data from API
 */
async function loadInventoryData() {
    try {
        showLoading(true);

        const response = await fetch('/api/inventory', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load inventory');
        }

        const data = await response.json();
        inventoryItems = data.items || [];

        updateStats();
        renderInventoryTable();

    } catch (error) {
        console.error('[Inventory] Load error:', error);
        showNotification('Failed to load inventory data', 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * Load categories
 */
async function loadCategories() {
    try {
        const response = await fetch('/api/inventory/categories', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            categories = data.categories || [];
            populateCategoryDropdowns();
        }
    } catch (error) {
        console.error('[Inventory] Categories load error:', error);
        // Use default categories
        categories = [
            { id: 1, name: 'Food', icon: '🥫' },
            { id: 2, name: 'Water', icon: '💧' },
            { id: 3, name: 'Medical', icon: '🏥' },
            { id: 4, name: 'Tools', icon: '🔧' },
            { id: 5, name: 'Ammo', icon: '🎯' },
            { id: 6, name: 'Fuel', icon: '⛽' },
            { id: 7, name: 'Clothing', icon: '👕' },
            { id: 8, name: 'Electronics', icon: '🔋' },
            { id: 9, name: 'Hygiene', icon: '🧼' },
            { id: 10, name: 'Other', icon: '📦' }
        ];
        populateCategoryDropdowns();
    }
}

/**
 * Load storage locations
 */
async function loadLocations() {
    try {
        const response = await fetch('/api/inventory/locations', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            locations = data.locations || [];
            populateLocationDropdowns();
        }
    } catch (error) {
        console.error('[Inventory] Locations load error:', error);
        // Use default locations
        locations = [
            { id: 1, name: 'Main Storage' },
            { id: 2, name: 'Bug Out Bag' },
            { id: 3, name: 'Vehicle Kit' },
            { id: 4, name: 'Safe Room' }
        ];
        populateLocationDropdowns();
    }
}

/**
 * Populate category dropdowns
 */
function populateCategoryDropdowns() {
    const filterSelect = document.getElementById('filter-category');
    const formSelect = document.getElementById('item-category');

    const options = categories.map(cat =>
        `<option value="${cat.id}">${cat.icon || ''} ${cat.name}</option>`
    ).join('');

    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Categories</option>' + options;
    }

    if (formSelect) {
        formSelect.innerHTML = '<option value="">Select Category</option>' + options;
    }
}

/**
 * Populate location dropdowns
 */
function populateLocationDropdowns() {
    const filterSelect = document.getElementById('filter-location');
    const formSelect = document.getElementById('item-location');

    const options = locations.map(loc =>
        `<option value="${loc.id}">${loc.name}</option>`
    ).join('');

    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Locations</option>' + options;
    }

    if (formSelect) {
        formSelect.innerHTML = '<option value="">Select Location</option>' + options;
    }
}

/**
 * Update inventory statistics
 */
function updateStats() {
    const totalItems = inventoryItems.length;
    const totalQuantity = inventoryItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

    // Calculate low stock items (below par level or min_quantity)
    const lowStock = inventoryItems.filter(item => {
        const minQty = item.par_level || item.min_quantity;
        return minQty && item.quantity < minQty;
    }).length;

    // Calculate expiring soon (within 30 days)
    const thirtyDays = Date.now() + (30 * 24 * 60 * 60 * 1000);
    const expiringSoon = inventoryItems.filter(item => {
        if (!item.expiration_date) return false;
        const expDate = new Date(item.expiration_date).getTime();
        return expDate <= thirtyDays && expDate > Date.now();
    }).length;

    // Update DOM
    const totalItemsEl = document.getElementById('total-items') || document.getElementById('stat-total-items');
    const totalQuantityEl = document.getElementById('total-quantity');
    const lowStockEl = document.getElementById('low-stock') || document.getElementById('stat-low-stock');
    const expiringEl = document.getElementById('expiring-soon') || document.getElementById('stat-expiring');

    if (totalItemsEl) totalItemsEl.textContent = totalItems;
    if (totalQuantityEl) totalQuantityEl.textContent = formatNumber(Math.round(totalQuantity));
    if (lowStockEl) lowStockEl.textContent = lowStock;
    if (expiringEl) expiringEl.textContent = expiringSoon;

    // Update sidebar badges
    const expiringBadge = document.getElementById('expiring-count');
    if (expiringBadge) {
        expiringBadge.textContent = expiringSoon;
        expiringBadge.style.display = expiringSoon > 0 ? 'inline-flex' : 'none';
    }

    const lowStockBadge = document.getElementById('low-stock-count');
    if (lowStockBadge) {
        lowStockBadge.textContent = lowStock;
        lowStockBadge.style.display = lowStock > 0 ? 'inline-flex' : 'none';
    }
}

/**
 * Normalize item name for grouping - exact match after lowercase and trim
 */
function normalizeInventoryName(name) {
    return (name || '').trim().toLowerCase();
}

/**
 * Group inventory items by normalized name
 */
function groupInventoryItems(items) {
    const groups = {};

    items.forEach(item => {
        const groupKey = normalizeInventoryName(item.name);
        if (!groups[groupKey]) {
            groups[groupKey] = {
                key: groupKey,
                displayName: item.name,
                items: [],
                totalQuantity: 0,
                totalCalories: 0,
                totalValue: 0,
                categories: new Set(),
                categoryIds: new Set(),
                locations: new Set(),
                locationIds: new Set(),
                expiringSoon7: 0,
                expiringSoon30: 0,
                expiringSoon90: 0,
                earliestExpiry: null,
                units: new Set()
            };
        }

        const group = groups[groupKey];
        group.items.push(item);

        // Aggregate quantities (ensure numeric addition)
        const qty = parseFloat(item.quantity) || 0;
        group.totalQuantity += qty;
        group.totalCalories += (parseFloat(item.calories_per_serving) || 0) * (parseFloat(item.servings_per_container) || 1) * qty;
        group.totalValue += (parseFloat(item.price) || 0) * qty;

        // Track categories, locations, units
        if (item.category_id) {
            group.categoryIds.add(item.category_id);
            const cat = categories.find(c => c.id == item.category_id);
            if (cat) group.categories.add(cat.name);
        }
        if (item.location_id) {
            group.locationIds.add(item.location_id);
            const loc = locations.find(l => l.id == item.location_id);
            if (loc) group.locations.add(loc.name);
        }
        if (item.unit) group.units.add(item.unit);

        // Track expiring items
        if (item.expiration_date) {
            const expDate = new Date(item.expiration_date);
            const now = new Date();
            const days7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const days30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const days90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

            if (expDate > now && expDate <= days7) group.expiringSoon7++;
            if (expDate > now && expDate <= days30) group.expiringSoon30++;
            if (expDate > now && expDate <= days90) group.expiringSoon90++;

            if (!group.earliestExpiry || expDate < group.earliestExpiry) {
                group.earliestExpiry = expDate;
            }
        }
    });

    return Object.values(groups).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Toggle inventory group expansion
 */
function toggleInventoryGroup(groupKey) {
    if (expandedInventoryGroups.has(groupKey)) {
        expandedInventoryGroups.delete(groupKey);
    } else {
        expandedInventoryGroups.add(groupKey);
    }
    renderInventoryTable();
}

/**
 * Render inventory table with grouping
 */
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-body') || document.getElementById('inventory-tbody');
    if (!tbody) return;

    // Filter items
    let filtered = inventoryItems.filter(item => {
        if (currentFilters.search) {
            const search = currentFilters.search.toLowerCase();
            const matchName = item.name?.toLowerCase().includes(search);
            const matchBarcode = item.barcode?.toLowerCase().includes(search);
            if (!matchName && !matchBarcode) return false;
        }

        if (currentFilters.category && item.category_id != currentFilters.category) {
            return false;
        }

        if (currentFilters.location && item.location_id != currentFilters.location) {
            return false;
        }

        if (currentFilters.status) {
            const status = getStockStatus(item);
            if (currentFilters.status !== status) return false;
        }

        return true;
    });

    // Render empty state
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <h3>No Items Found</h3>
                    <p>Add items to your inventory using the buttons above</p>
                </td>
            </tr>
        `;
        return;
    }

    // Group items by normalized name
    const groups = groupInventoryItems(filtered);

    let html = '';

    groups.forEach(group => {
        const isExpanded = expandedInventoryGroups.has(group.key);
        const isSingleItem = group.items.length === 1;

        // Get primary unit
        const primaryUnit = group.units.size > 0 ? [...group.units][0] : 'units';
        const unitDisplay = group.units.size > 1 ? 'mixed' : primaryUnit;

        // Get category display
        const categoryDisplay = group.categories.size > 1
            ? `${[...group.categories][0]} +${group.categories.size - 1}`
            : ([...group.categories][0] || 'Unknown');

        // Get location display
        const locationDisplay = group.locations.size > 1
            ? `${[...group.locations][0]} +${group.locations.size - 1}`
            : ([...group.locations][0] || 'Unassigned');

        // Expiry display
        let expiryDisplay = '—';
        let expiryClass = 'good';
        if (group.earliestExpiry) {
            expiryDisplay = formatDate(group.earliestExpiry.toISOString());
            expiryClass = getExpiryClass(group.earliestExpiry.toISOString());
            if (group.expiringSoon7 > 0) {
                expiryDisplay += ` <span class="expiry-count warning">(${group.expiringSoon7} soon)</span>`;
            }
        }

        // Group stock status
        const qtyClass = group.totalQuantity <= 0 ? 'out' : group.totalQuantity <= 2 ? 'low' : 'good';

        if (isSingleItem) {
            // Single item - render normally
            const item = group.items[0];
            const stockStatus = getStockStatus(item);
            const itemExpiryClass = getExpiryClass(item.expiration_date);
            const category = categories.find(c => c.id == item.category_id);
            const location = locations.find(l => l.id == item.location_id);

            html += `
                <tr class="item-row ${stockStatus === 'low' || stockStatus === 'critical' ? 'low-stock' : ''} ${itemExpiryClass === 'expiring-soon' ? 'expiring-soon' : ''}">
                    <td>
                        <div class="item-name-cell">
                            <div class="item-info">
                                <div class="item-name">${escapeHtml(item.name)}</div>
                                ${item.barcode ? `<div class="item-barcode">${escapeHtml(item.barcode)}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="category-badge">${category?.icon || '📦'} ${category?.name || 'Unknown'}</span>
                    </td>
                    <td>
                        <span class="stock-badge ${stockStatus}">
                            ${item.quantity} ${item.unit || 'units'}
                        </span>
                        ${item.par_level ? `<div style="font-size: 0.75rem; color: var(--text-secondary);">Par: ${item.par_level}</div>` : ''}
                    </td>
                    <td>
                        <span class="location-badge">${location?.name || 'Unassigned'}</span>
                    </td>
                    <td>
                        <span class="expiry-date ${itemExpiryClass}">
                            ${item.expiration_date ? formatDate(item.expiration_date) : '—'}
                        </span>
                    </td>
                    <td>
                        ${item.calories_per_serving ? `${formatNumber(item.calories_per_serving * (item.servings_per_container || 1))} cal` : '—'}
                    </td>
                    <td>$${(item.price || 0).toFixed(2)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon qr" onclick="showInventoryItemQRCode(${item.id})" title="QR Code">📱</button>
                            <button class="btn-icon" onclick="editItem(${item.id})" title="Edit">✏️</button>
                            <button class="btn-icon" onclick="adjustQuantity(${item.id}, 1)" title="Add 1">➕</button>
                            <button class="btn-icon" onclick="adjustQuantity(${item.id}, -1)" title="Remove 1">➖</button>
                            <button class="btn-icon danger" onclick="deleteItem(${item.id})" title="Delete">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Multiple items - render group header
            const firstCat = categories.find(c => group.categoryIds.has(c.id));

            html += `
                <tr class="group-row ${isExpanded ? 'expanded' : ''}" onclick="toggleInventoryGroup('${escapeHtml(group.key)}')" style="cursor: pointer;">
                    <td>
                        <div class="item-name-cell group-header">
                            <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                            <div class="item-info">
                                <div class="item-name">${escapeHtml(group.displayName)}</div>
                                <span class="group-count">(${group.items.length} items)</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="category-badge">${firstCat?.icon || '📦'} ${categoryDisplay}</span>
                    </td>
                    <td>
                        <span class="stock-badge ${qtyClass}">
                            ${group.totalQuantity} ${unitDisplay}
                        </span>
                    </td>
                    <td>
                        <span class="location-badge">${locationDisplay}</span>
                    </td>
                    <td>
                        <span class="expiry-date ${expiryClass}">${expiryDisplay}</span>
                    </td>
                    <td>
                        ${group.totalCalories > 0 ? `${formatNumber(Math.round(group.totalCalories))} cal` : '—'}
                    </td>
                    <td>$${group.totalValue.toFixed(2)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon qr" onclick="event.stopPropagation(); showInventoryGroupQRCode('${escapeHtml(group.key)}')" title="Group QR">📱</button>
                            <span class="group-summary" title="Total: ${group.items.length} items">📊</span>
                        </div>
                    </td>
                </tr>
            `;

            // Render child items if expanded
            if (isExpanded) {
                group.items.forEach(item => {
                    const stockStatus = getStockStatus(item);
                    const itemExpiryClass = getExpiryClass(item.expiration_date);
                    const category = categories.find(c => c.id == item.category_id);
                    const location = locations.find(l => l.id == item.location_id);

                    html += `
                        <tr class="child-row ${stockStatus === 'low' || stockStatus === 'critical' ? 'low-stock' : ''} ${itemExpiryClass === 'expiring-soon' ? 'expiring-soon' : ''}">
                            <td>
                                <div class="item-name-cell child-item">
                                    <span class="child-indent"></span>
                                    <div class="item-info">
                                        <div class="item-name">${escapeHtml(item.name)}</div>
                                        ${item.barcode ? `<div class="item-barcode">${escapeHtml(item.barcode)}</div>` : ''}
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="category-badge">${category?.icon || '📦'} ${category?.name || 'Unknown'}</span>
                            </td>
                            <td>
                                <span class="stock-badge ${stockStatus}">
                                    ${item.quantity} ${item.unit || 'units'}
                                </span>
                                ${item.par_level ? `<div style="font-size: 0.75rem; color: var(--text-secondary);">Par: ${item.par_level}</div>` : ''}
                            </td>
                            <td>
                                <span class="location-badge">${location?.name || 'Unassigned'}</span>
                            </td>
                            <td>
                                <span class="expiry-date ${itemExpiryClass}">
                                    ${item.expiration_date ? formatDate(item.expiration_date) : '—'}
                                </span>
                            </td>
                            <td>
                                ${item.calories_per_serving ? `${formatNumber(item.calories_per_serving * (item.servings_per_container || 1))} cal` : '—'}
                            </td>
                            <td>$${(item.price || 0).toFixed(2)}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn-icon qr" onclick="event.stopPropagation(); showInventoryItemQRCode(${item.id})" title="QR Code">📱</button>
                                    <button class="btn-icon" onclick="event.stopPropagation(); editItem(${item.id})" title="Edit">✏️</button>
                                    <button class="btn-icon" onclick="event.stopPropagation(); adjustQuantity(${item.id}, 1)" title="Add 1">➕</button>
                                    <button class="btn-icon" onclick="event.stopPropagation(); adjustQuantity(${item.id}, -1)" title="Remove 1">➖</button>
                                    <button class="btn-icon danger" onclick="event.stopPropagation(); deleteItem(${item.id})" title="Delete">🗑️</button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
        }
    });

    tbody.innerHTML = html;
}

/**
 * Get stock status for an item
 */
function getStockStatus(item) {
    if (item.quantity <= 0) return 'out';
    if (item.par_level) {
        if (item.quantity <= item.par_level * 0.25) return 'critical';
        if (item.quantity <= item.par_level) return 'low';
    }
    return 'good';
}

/**
 * Get expiry class for a date
 */
function getExpiryClass(dateStr) {
    if (!dateStr) return '';

    const expDate = new Date(dateStr).getTime();
    const now = Date.now();
    const thirtyDays = now + (30 * 24 * 60 * 60 * 1000);

    if (expDate < now) return 'expired';
    if (expDate <= thirtyDays) return 'expiring-soon';
    return 'good';
}

/**
 * Initialize filters
 */
function initFilters() {
    // Search input - support both IDs
    const searchInput = document.getElementById('search-inventory') || document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            currentFilters.search = e.target.value;
            renderInventoryTable();
        }, 300));
    }

    // Category filter
    const categoryFilter = document.getElementById('filter-category');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            currentFilters.category = e.target.value;
            renderInventoryTable();
        });
    }

    // Location filter
    const locationFilter = document.getElementById('filter-location');
    if (locationFilter) {
        locationFilter.addEventListener('change', (e) => {
            currentFilters.location = e.target.value;
            renderInventoryTable();
        });
    }

    // Status filter
    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentFilters.status = e.target.value;
            renderInventoryTable();
        });
    }

    // Table sorting
    document.querySelectorAll('.inventory-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;

            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }

            // Update sort indicators
            document.querySelectorAll('.inventory-table th').forEach(header => {
                header.classList.remove('sorted-asc', 'sorted-desc');
            });
            th.classList.add(`sorted-${currentSort.direction}`);

            renderInventoryTable();
        });
    });
}

/**
 * Initialize modals
 */
function initModals() {
    // Close modals on backdrop click
    document.querySelectorAll('.scanner-modal, .item-modal, .shopping-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });

    // Close buttons
    document.querySelectorAll('.scanner-close, .btn-cancel').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // Form submission
    const itemForm = document.getElementById('item-form');
    if (itemForm) {
        itemForm.addEventListener('submit', handleItemFormSubmit);
    }
}

/**
 * Close all modals
 */
function closeAllModals() {
    document.querySelectorAll('.scanner-modal, .item-modal, .shopping-modal').forEach(modal => {
        modal.classList.remove('active');
    });

    if (scanner) {
        stopScanner();
    }

    editingItemId = null;
}

/**
 * Initialize barcode scanner
 */
function initBarcodeScanner() {
    // Manual barcode input
    const manualInput = document.getElementById('manual-barcode');
    if (manualInput) {
        manualInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleBarcodeScanned(manualInput.value);
            }
        });
    }
}

/**
 * Open barcode scanner
 */
function openScanner() {
    const modal = document.getElementById('scanner-modal');
    modal.classList.add('active');

    const statusEl = document.getElementById('scanner-status');
    statusEl.textContent = 'Initializing camera...';
    statusEl.className = 'scanner-status';

    startScanner();
}

/**
 * Start the barcode scanner
 */
async function startScanner() {
    const viewport = document.getElementById('scanner-viewport');

    // Check if Quagga2 is available
    if (typeof Quagga === 'undefined') {
        console.log('[Scanner] Quagga not loaded, trying to load dynamically...');

        try {
            await loadScript('https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js');
        } catch (error) {
            document.getElementById('scanner-status').textContent = 'Scanner library not available. Use manual entry.';
            document.getElementById('scanner-status').className = 'scanner-status error';
            return;
        }
    }

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
                readers: [
                    'ean_reader',
                    'ean_8_reader',
                    'upc_reader',
                    'upc_e_reader',
                    'code_128_reader',
                    'code_39_reader'
                ]
            },
            locate: true,
            locator: {
                patchSize: 'medium',
                halfSample: true
            }
        }, (err) => {
            if (err) {
                console.error('[Scanner] Init error:', err);
                document.getElementById('scanner-status').textContent = 'Camera access denied or unavailable';
                document.getElementById('scanner-status').className = 'scanner-status error';
                return;
            }

            Quagga.start();
            document.getElementById('scanner-status').textContent = 'Point camera at barcode';
            document.getElementById('scanner-status').className = 'scanner-status';
        });

        Quagga.onDetected((result) => {
            const code = result.codeResult.code;
            if (code) {
                handleBarcodeScanned(code);
            }
        });

        scanner = Quagga;

    } catch (error) {
        console.error('[Scanner] Error:', error);
        document.getElementById('scanner-status').textContent = 'Scanner initialization failed';
        document.getElementById('scanner-status').className = 'scanner-status error';
    }
}

/**
 * Stop the barcode scanner
 */
function stopScanner() {
    if (scanner && typeof scanner.stop === 'function') {
        scanner.stop();
        scanner = null;
    }
}

/**
 * Handle scanned barcode
 */
async function handleBarcodeScanned(barcode) {
    if (!barcode || barcode.trim() === '') return;

    barcode = barcode.trim();
    console.log('[Scanner] Barcode detected:', barcode);

    const statusEl = document.getElementById('scanner-status');
    statusEl.textContent = `Barcode: ${barcode} - Searching...`;
    statusEl.className = 'scanner-status success';

    // Play beep sound
    playBeep();

    // Check if item exists in inventory
    const existingItem = inventoryItems.find(item => item.barcode === barcode);

    if (existingItem) {
        // Item found - offer to add quantity or edit
        closeAllModals();
        showItemModal(existingItem);
    } else {
        // New item - try to lookup product info
        const productInfo = await lookupBarcode(barcode);
        closeAllModals();
        showItemModal(null, barcode, productInfo);
    }
}

/**
 * Lookup barcode in product database
 */
async function lookupBarcode(barcode) {
    try {
        // Try Open Food Facts API
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();

        if (data.status === 1 && data.product) {
            const product = data.product;
            return {
                name: product.product_name || '',
                brand: product.brands || '',
                calories: product.nutriments?.['energy-kcal_100g'] || null,
                protein: product.nutriments?.proteins_100g || null,
                carbs: product.nutriments?.carbohydrates_100g || null,
                fat: product.nutriments?.fat_100g || null,
                image: product.image_url || null
            };
        }
    } catch (error) {
        console.log('[Scanner] Product lookup failed:', error);
    }

    return null;
}

/**
 * Show item add/edit modal
 */
function showItemModal(item = null, barcode = '', productInfo = null) {
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    const title = document.getElementById('modal-title');

    // Reset form
    form.reset();

    // Hide existing item selector by default
    const existingItemSection = document.getElementById('existing-item-section');
    if (existingItemSection) {
        existingItemSection.style.display = 'none';
    }

    if (item) {
        // Edit mode
        editingItemId = item.id;
        if (title) title.textContent = 'Edit Item';

        // Use safe setter to avoid null errors for fields that may not exist
        const setFieldValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? '';
        };

        setFieldValue('item-name', item.name);
        setFieldValue('item-barcode', item.barcode);
        setFieldValue('item-category', item.category_id);
        setFieldValue('item-location', item.location_id);
        setFieldValue('item-quantity', item.quantity || 1);
        setFieldValue('item-unit', item.unit || 'units');
        setFieldValue('item-min-qty', item.min_quantity || item.par_level);
        setFieldValue('item-expiration', item.expiration_date ? item.expiration_date.split('T')[0] : '');
        setFieldValue('item-price', item.price || item.cost);
        setFieldValue('item-notes', item.notes);
        setFieldValue('item-purchase-date', item.purchase_date ? item.purchase_date.split('T')[0] : '');
        setFieldValue('item-calories', item.calories_total || item.calories_per_serving);

    } else {
        // Add mode
        editingItemId = null;
        if (title) title.textContent = 'Add New Item';

        document.getElementById('item-barcode').value = barcode;
        document.getElementById('item-quantity').value = 1;
        document.getElementById('item-unit').value = 'units';

        // Show existing item selector and populate it
        if (existingItemSection) {
            existingItemSection.style.display = 'block';
            populateExistingItemsDropdown();
        }

        // Pre-fill from product info if available
        if (productInfo) {
            document.getElementById('item-name').value = productInfo.name || '';
            if (productInfo.calories) {
                document.getElementById('item-calories').value = Math.round(productInfo.calories);
            }
            if (productInfo.protein) {
                document.getElementById('item-protein').value = Math.round(productInfo.protein);
            }
            if (productInfo.carbs) {
                document.getElementById('item-carbs').value = Math.round(productInfo.carbs);
            }
            if (productInfo.fat) {
                document.getElementById('item-fat').value = Math.round(productInfo.fat);
            }
        }
    }

    modal.classList.add('active');
    document.getElementById('item-name').focus();
}

/**
 * Populate existing items dropdown for quick selection
 */
function populateExistingItemsDropdown() {
    const select = document.getElementById('existing-item-select');
    if (!select) return;

    // Get unique items by name
    const uniqueItems = {};
    inventoryItems.forEach(item => {
        if (item.name && !uniqueItems[item.name.toLowerCase()]) {
            uniqueItems[item.name.toLowerCase()] = item;
        }
    });

    // Sort alphabetically
    const sortedItems = Object.values(uniqueItems).sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    select.innerHTML = '<option value="">-- Select existing item or enter new --</option>';
    sortedItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name}${item.category_name ? ` (${item.category_name})` : ''}`;
        option.dataset.item = JSON.stringify(item);
        select.appendChild(option);
    });
}

/**
 * Handle existing item selection - pre-fill form with selected item's details
 */
function selectExistingItem(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (!selectedOption.value) return;

    try {
        const item = JSON.parse(selectedOption.dataset.item);

        // Pre-fill form fields with existing item data (but not quantity/expiration)
        // Use safe setter to avoid null errors
        const setFieldValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };

        setFieldValue('item-name', item.name);
        setFieldValue('item-barcode', item.barcode);
        setFieldValue('item-category', item.category_id);
        setFieldValue('item-location', item.location_id);
        setFieldValue('item-unit', item.unit || 'units');
        setFieldValue('item-min-qty', item.min_quantity);
        setFieldValue('item-cost', item.cost);

        // Nutrition
        setFieldValue('item-calories', item.calories_total);

        // Keep quantity at 1 and don't copy expiration date
        setFieldValue('item-quantity', 1);

        showNotification(`Pre-filled from "${item.name}". Adjust quantity and expiration as needed.`, 'info');
    } catch (e) {
        console.error('[Inventory] Error parsing item data:', e);
    }
}

/**
 * Handle item form submission
 */
async function handleItemFormSubmit(e) {
    e.preventDefault();

    const formData = {
        name: document.getElementById('item-name').value.trim(),
        barcode: document.getElementById('item-barcode').value.trim() || null,
        category_id: document.getElementById('item-category').value || null,
        location_id: document.getElementById('item-location').value || null,
        quantity: parseInt(document.getElementById('item-quantity').value) || 1,
        unit: document.getElementById('item-unit').value || 'units',
        par_level: parseInt(document.getElementById('item-par-level').value) || null,
        expiration_date: document.getElementById('item-expiration').value || null,
        price: parseFloat(document.getElementById('item-price').value) || null,
        notes: document.getElementById('item-notes').value.trim() || null,
        calories_per_serving: parseInt(document.getElementById('item-calories').value) || null,
        protein_grams: parseFloat(document.getElementById('item-protein').value) || null,
        carbs_grams: parseFloat(document.getElementById('item-carbs').value) || null,
        fat_grams: parseFloat(document.getElementById('item-fat').value) || null,
        servings_per_container: parseInt(document.getElementById('item-servings').value) || null
    };

    if (!formData.name) {
        showNotification('Item name is required', 'error');
        return;
    }

    try {
        let response;

        if (editingItemId) {
            // Update existing item
            response = await fetch(`/api/inventory/${editingItemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new item
            response = await fetch('/api/inventory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(formData)
            });
        }

        if (!response.ok) {
            throw new Error('Failed to save item');
        }

        showNotification(editingItemId ? 'Item updated successfully' : 'Item added successfully', 'success');
        closeAllModals();
        loadInventoryData();

    } catch (error) {
        console.error('[Inventory] Save error:', error);
        showNotification('Failed to save item', 'error');
    }
}

/**
 * Edit an item
 */
function editItem(itemId) {
    const item = inventoryItems.find(i => i.id === itemId);
    if (item) {
        showItemModal(item);
    }
}

/**
 * Adjust item quantity
 */
async function adjustQuantity(itemId, delta) {
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    // Ensure whole number quantities
    const currentQty = Math.round(parseFloat(item.quantity) || 0);
    const newQty = Math.max(0, currentQty + delta);

    try {
        const response = await fetch(`/api/inventory/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ quantity: newQty })
        });

        if (!response.ok) {
            throw new Error('Failed to update quantity');
        }

        item.quantity = newQty;
        updateStats();
        renderInventoryTable();

    } catch (error) {
        console.error('[Inventory] Quantity update error:', error);
        showNotification('Failed to update quantity', 'error');
    }
}

/**
 * Delete an item
 */
async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }

    try {
        const response = await fetch(`/api/inventory/${itemId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to delete item');
        }

        showNotification('Item deleted successfully', 'success');
        loadInventoryData();

    } catch (error) {
        console.error('[Inventory] Delete error:', error);
        showNotification('Failed to delete item', 'error');
    }
}

/**
 * Open shopping list modal
 */
function openShoppingList() {
    const modal = document.getElementById('shopping-modal');
    const listContainer = document.getElementById('shopping-list');

    // Generate shopping list from items below par level
    const shoppingItems = inventoryItems
        .filter(item => item.par_level && item.quantity < item.par_level)
        .map(item => ({
            id: item.id,
            name: item.name,
            needed: item.par_level - item.quantity,
            unit: item.unit || 'units',
            checked: false
        }));

    if (shoppingItems.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <h3>All Stocked Up!</h3>
                <p>All items are at or above their par levels</p>
            </div>
        `;
    } else {
        listContainer.innerHTML = shoppingItems.map(item => `
            <div class="shopping-item" data-id="${item.id}">
                <input type="checkbox" ${item.checked ? 'checked' : ''}
                       onchange="toggleShoppingItem(${item.id}, this.checked)">
                <div class="shopping-item-info">
                    <div class="shopping-item-name">${escapeHtml(item.name)}</div>
                    <div class="shopping-item-qty">Need: ${item.needed} ${item.unit}</div>
                </div>
            </div>
        `).join('');
    }

    modal.classList.add('active');
}

/**
 * Toggle shopping item checked state
 */
function toggleShoppingItem(itemId, checked) {
    const itemEl = document.querySelector(`.shopping-item[data-id="${itemId}"]`);
    if (itemEl) {
        itemEl.classList.toggle('checked', checked);
    }
}

/**
 * Export inventory to CSV
 */
function exportInventory() {
    const headers = ['Name', 'Barcode', 'Category', 'Location', 'Quantity', 'Unit', 'Par Level', 'Expiration', 'Price', 'Calories', 'Notes'];

    const rows = inventoryItems.map(item => {
        const category = categories.find(c => c.id == item.category_id);
        const location = locations.find(l => l.id == item.location_id);

        return [
            item.name,
            item.barcode || '',
            category?.name || '',
            location?.name || '',
            item.quantity,
            item.unit || 'units',
            item.par_level || '',
            item.expiration_date || '',
            item.price || '',
            item.calories_per_serving || '',
            item.notes || ''
        ];
    });

    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sps-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showNotification('Inventory exported successfully', 'success');
}

// Utility functions

/**
 * Get auth headers
 */
function getAuthHeaders() {
    const token = localStorage.getItem('sps_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
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
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
    `;
    notification.textContent = message;

    container.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format date
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Debounce function
 */
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

/**
 * Load script dynamically
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Play beep sound
 */
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
    } catch (e) {
        // Ignore audio errors
    }
}

// Add CSS animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Functions called from HTML buttons
function openBarcodeScanner() {
    const modal = document.getElementById('scanner-modal');
    if (modal) {
        modal.classList.add('active');
        startScanner();
    }
}

function closeBarcodeScanner() {
    const modal = document.getElementById('scanner-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    stopScanner();
}

function openAddItemModal() {
    showItemModal(null);
}

function closeItemModal() {
    const modal = document.getElementById('item-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    editingItemId = null;
}

function scanToInput(inputId) {
    const input = document.getElementById(inputId);
    openBarcodeScanner();
    // Store target input for when scan completes
    window.scanTargetInput = inputId;
}

function useScanResult() {
    const code = document.getElementById('scanned-code')?.value;
    if (code && window.scanTargetInput) {
        document.getElementById(window.scanTargetInput).value = code;
        window.scanTargetInput = null;
    }
    closeBarcodeScanner();
}

async function saveItem(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Convert numeric fields
    if (data.quantity) data.quantity = parseFloat(data.quantity);
    if (data.min_quantity) data.min_quantity = parseFloat(data.min_quantity);
    if (data.cost) data.cost = parseFloat(data.cost);
    if (data.calories_total) data.calories_total = parseInt(data.calories_total);
    if (data.category_id) data.category_id = parseInt(data.category_id);
    if (data.location_id) data.location_id = parseInt(data.location_id) || null;

    // Remove empty values
    Object.keys(data).forEach(key => {
        if (data[key] === '' || data[key] === null || data[key] === undefined) {
            delete data[key];
        }
    });

    try {
        let response;
        const itemId = data.id;
        delete data.id;

        if (itemId) {
            response = await fetch(`/api/inventory/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(data)
            });
        } else {
            response = await fetch('/api/inventory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(data)
            });
        }

        if (!response.ok) {
            throw new Error('Failed to save item');
        }

        showNotification(itemId ? 'Item updated' : 'Item added', 'success');
        closeItemModal();
        loadInventoryData();

    } catch (error) {
        console.error('[Inventory] Save error:', error);
        showNotification('Failed to save item', 'error');
    }
}

// CSV Import functions
let csvData = [];

function openImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.classList.add('active');
        // Reset state
        document.getElementById('csv-file').value = '';
        document.getElementById('csv-preview').style.display = 'none';
        document.getElementById('import-btn').disabled = true;
        csvData = [];
    }
}

function closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    csvData = [];
}

function previewCSV(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        csvData = parseCSV(text);

        if (csvData.length < 2) {
            showNotification('CSV file is empty or has no data rows', 'error');
            return;
        }

        // Show preview
        const previewEl = document.getElementById('csv-preview');
        const tableEl = document.getElementById('csv-preview-table');
        const countEl = document.getElementById('csv-row-count');

        const headers = csvData[0];
        const rows = csvData.slice(1);

        // Build table header
        tableEl.querySelector('thead').innerHTML = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;

        // Build table body (first 5 rows)
        tableEl.querySelector('tbody').innerHTML = rows.slice(0, 5).map(row =>
            `<tr>${row.map(cell => `<td>${escapeHtml(cell || '')}</td>`).join('')}</tr>`
        ).join('');

        countEl.textContent = `Total: ${rows.length} items to import`;
        previewEl.style.display = 'block';
        document.getElementById('import-btn').disabled = false;
    };

    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split(/\r\n|\n/);
    const result = [];

    for (let line of lines) {
        if (!line.trim()) continue;

        const row = [];
        let cell = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(cell.trim());
                cell = '';
            } else {
                cell += char;
            }
        }
        row.push(cell.trim());
        result.push(row);
    }

    return result;
}

async function importCSV() {
    if (csvData.length < 2) {
        showNotification('No data to import', 'error');
        return;
    }

    const headers = csvData[0].map(h => h.toLowerCase().trim().replace(/\s+/g, '_'));
    const rows = csvData.slice(1);

    // Map CSV columns to API fields
    const items = rows.map(row => {
        const item = {};
        headers.forEach((header, i) => {
            const value = row[i]?.trim();
            if (value) {
                item[header] = value;
            }
        });
        return item;
    }).filter(item => item.name); // Filter out rows without names

    if (items.length === 0) {
        showNotification('No valid items found in CSV', 'error');
        return;
    }

    try {
        const response = await fetch('/api/inventory/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ items })
        });

        if (!response.ok) {
            throw new Error('Import failed');
        }

        const result = await response.json();
        showNotification(`Imported ${result.results.success.length} items`, 'success');

        if (result.results.errors.length > 0) {
            console.log('Import errors:', result.results.errors);
            showNotification(`${result.results.errors.length} items failed to import`, 'warning');
        }

        closeImportModal();
        loadInventoryData();

    } catch (error) {
        console.error('[Inventory] Import error:', error);
        showNotification('Failed to import items', 'error');
    }
}

// Export functions for global access
window.openScanner = openScanner;
window.openBarcodeScanner = openBarcodeScanner;
window.closeBarcodeScanner = closeBarcodeScanner;
window.openAddItemModal = openAddItemModal;
window.closeItemModal = closeItemModal;
window.scanToInput = scanToInput;
window.useScanResult = useScanResult;
window.saveItem = saveItem;
window.showItemModal = showItemModal;
window.editItem = editItem;
window.adjustQuantity = adjustQuantity;
window.deleteItem = deleteItem;
window.toggleInventoryGroup = toggleInventoryGroup;
window.openShoppingList = openShoppingList;
window.toggleShoppingItem = toggleShoppingItem;
window.exportInventory = exportInventory;
window.selectExistingItem = selectExistingItem;
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.previewCSV = previewCSV;
window.importCSV = importCSV;

// ============================================
// QR CODE GENERATION WITH FULL DATA
// ============================================

/**
 * Generate QR code data URL for an inventory item with full embedded metadata
 * @param {Object} item - Inventory item data
 * @returns {Promise<string>} QR code as data URL
 */
async function generateInventoryQRCode(item) {
    if (!item || !item.id) {
        console.error('[Inventory] Cannot generate QR for invalid item');
        return null;
    }

    // Get category and location names
    const category = categories.find(c => c.id == item.category_id);
    const location = locations.find(l => l.id == item.location_id);

    // Build full item data for QR
    const qrItemData = {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: category?.name,
        category_id: item.category_id,
        location: location?.name,
        location_id: item.location_id,
        barcode: item.barcode,
        min_quantity: item.min_quantity || item.par_level,
        expiration_date: item.expiration_date,
        purchase_date: item.purchase_date,
        price: item.price,
        serial_number: item.serial_number,
        model_number: item.model_number,
        condition: item.condition,
        notes: item.notes,
        updated_at: item.updated_at
    };

    // Use QRData encoder if available
    let qrString;
    if (typeof QRData !== 'undefined') {
        qrString = QRData.encode(qrItemData, 'inventory');
    } else {
        // Fallback to simple JSON
        qrString = JSON.stringify({ type: 'inventory', ...qrItemData });
    }

    // Generate QR code using qrcode library
    if (typeof QRCode !== 'undefined') {
        try {
            return await QRCode.toDataURL(qrString, {
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 200,
                color: { dark: '#000000', light: '#ffffff' }
            });
        } catch (err) {
            console.error('[Inventory] QR generation error:', err);
            return null;
        }
    }

    console.warn('[Inventory] QRCode library not available');
    return null;
}

/**
 * Generate QR code for a group of inventory items
 * @param {Array} items - Array of inventory items
 * @param {string} groupName - Name of the group
 * @returns {Promise<string>} QR code as data URL
 */
async function generateInventoryGroupQRCode(items, groupName) {
    if (!items || items.length === 0) {
        console.error('[Inventory] Cannot generate group QR for empty items');
        return null;
    }

    // Build items data for QR
    const itemsData = items.map(item => {
        const category = categories.find(c => c.id == item.category_id);
        const location = locations.find(l => l.id == item.location_id);
        return {
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: category?.name,
            location: location?.name,
            min_quantity: item.min_quantity || item.par_level,
            serial_number: item.serial_number
        };
    });

    // Use QRData encoder if available
    let qrString;
    if (typeof QRData !== 'undefined') {
        const firstCat = categories.find(c => items[0]?.category_id == c.id);
        qrString = QRData.encodeGroup(itemsData, 'inventory', { name: groupName, category: firstCat?.name });
    } else {
        qrString = JSON.stringify({ type: 'inventory_group', name: groupName, items: itemsData });
    }

    // Check size
    if (typeof QRData !== 'undefined') {
        const sizeInfo = QRData.getQRSize(qrString);
        if (sizeInfo.tooLarge) {
            showNotification('Group too large for single QR code', 'warning');
            return null;
        }
    }

    if (typeof QRCode !== 'undefined') {
        try {
            return await QRCode.toDataURL(qrString, {
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 250,
                color: { dark: '#000000', light: '#ffffff' }
            });
        } catch (err) {
            console.error('[Inventory] Group QR generation error:', err);
            return null;
        }
    }

    return null;
}

/**
 * Show QR code modal for an inventory item
 * @param {number} itemId - Item ID
 */
async function showInventoryItemQRCode(itemId) {
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) {
        showNotification('Item not found', 'error');
        return;
    }

    const qrDataUrl = await generateInventoryQRCode(item);
    if (!qrDataUrl) {
        showNotification('Failed to generate QR code', 'error');
        return;
    }

    // Get category and location names
    const category = categories.find(c => c.id == item.category_id);
    const location = locations.find(l => l.id == item.location_id);

    // Create or get QR modal
    let modal = document.getElementById('qr-code-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'qr-code-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="qr-modal-title">Item QR Code</h3>
                    <button type="button" class="modal-close" onclick="closeInventoryQRModal()">&times;</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <div id="qr-code-container"></div>
                    <div id="qr-item-info" style="margin-top: 1rem; text-align: left;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeInventoryQRModal()">Close</button>
                    <button type="button" class="btn btn-primary" onclick="printInventoryQRLabel()">Print Label</button>
                    <button type="button" class="btn btn-info" onclick="downloadInventoryQRCode()">Download</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Update content
    document.getElementById('qr-modal-title').textContent = `QR Code: ${item.name}`;
    document.getElementById('qr-code-container').innerHTML = `<img src="${qrDataUrl}" alt="QR Code" style="max-width: 200px;">`;

    // Show item info
    document.getElementById('qr-item-info').innerHTML = `
        <div class="qr-item-details">
            <p><strong>Name:</strong> ${escapeHtml(item.name)}</p>
            <p><strong>Quantity:</strong> ${item.quantity} ${item.unit || 'units'}</p>
            <p><strong>Category:</strong> ${escapeHtml(category?.name || 'N/A')}</p>
            <p><strong>Location:</strong> ${escapeHtml(location?.name || 'N/A')}</p>
            ${item.serial_number ? `<p><strong>Serial:</strong> ${escapeHtml(item.serial_number)}</p>` : ''}
            ${item.min_quantity ? `<p><strong>Min Qty:</strong> ${item.min_quantity}</p>` : ''}
            ${item.expiration_date ? `<p><strong>Expires:</strong> ${formatDate(item.expiration_date)}</p>` : ''}
        </div>
    `;

    // Store current item for print/download
    window.currentInventoryQRItem = item;
    window.currentInventoryQRDataUrl = qrDataUrl;

    modal.classList.add('active');
}

/**
 * Show QR code for a group of inventory items
 * @param {string} groupKey - Group key
 */
async function showInventoryGroupQRCode(groupKey) {
    const groups = groupInventoryItems(inventoryItems);
    const group = groups.find(g => g.key === groupKey);

    if (!group || group.items.length === 0) {
        showNotification('Group not found', 'error');
        return;
    }

    const qrDataUrl = await generateInventoryGroupQRCode(group.items, group.displayName);
    if (!qrDataUrl) {
        showNotification('Failed to generate group QR code', 'error');
        return;
    }

    // Create or get QR modal
    let modal = document.getElementById('qr-code-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'qr-code-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="qr-modal-title">Group QR Code</h3>
                    <button type="button" class="modal-close" onclick="closeInventoryQRModal()">&times;</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <div id="qr-code-container"></div>
                    <div id="qr-item-info" style="margin-top: 1rem; text-align: left;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeInventoryQRModal()">Close</button>
                    <button type="button" class="btn btn-primary" onclick="printInventoryQRLabel()">Print Label</button>
                    <button type="button" class="btn btn-info" onclick="downloadInventoryQRCode()">Download</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Update content
    document.getElementById('qr-modal-title').textContent = `Group QR: ${group.displayName}`;
    document.getElementById('qr-code-container').innerHTML = `<img src="${qrDataUrl}" alt="QR Code" style="max-width: 250px;">`;

    // Show group info
    document.getElementById('qr-item-info').innerHTML = `
        <div class="qr-item-details">
            <p><strong>Group:</strong> ${escapeHtml(group.displayName)}</p>
            <p><strong>Items:</strong> ${group.items.length}</p>
            <p><strong>Total Quantity:</strong> ${group.totalQuantity}</p>
            <p><strong>Total Value:</strong> $${group.totalValue.toFixed(2)}</p>
            <p><strong>Locations:</strong> ${[...group.locations].join(', ') || 'N/A'}</p>
        </div>
    `;

    // Store for print/download
    window.currentInventoryQRItem = { name: group.displayName, isGroup: true, items: group.items, totalQuantity: group.totalQuantity };
    window.currentInventoryQRDataUrl = qrDataUrl;

    modal.classList.add('active');
}

/**
 * Close QR code modal
 */
function closeInventoryQRModal() {
    const modal = document.getElementById('qr-code-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    window.currentInventoryQRItem = null;
    window.currentInventoryQRDataUrl = null;
}

/**
 * Download current QR code as image
 */
function downloadInventoryQRCode() {
    if (!window.currentInventoryQRDataUrl || !window.currentInventoryQRItem) return;

    const link = document.createElement('a');
    link.download = `qr-${window.currentInventoryQRItem.name.replace(/[^a-z0-9]/gi, '_')}.png`;
    link.href = window.currentInventoryQRDataUrl;
    link.click();
}

/**
 * Print QR label with item details
 */
function printInventoryQRLabel() {
    if (!window.currentInventoryQRDataUrl || !window.currentInventoryQRItem) return;

    const item = window.currentInventoryQRItem;
    const isGroup = item.isGroup;

    // Get category and location names for non-group items
    let categoryName = '', locationName = '';
    if (!isGroup) {
        const category = categories.find(c => c.id == item.category_id);
        const location = locations.find(l => l.id == item.location_id);
        categoryName = category?.name || '';
        locationName = location?.name || '';
    }

    // Generate print-ready label data
    let labelData;
    if (typeof QRData !== 'undefined') {
        labelData = QRData.generateLabelData(item, 'inventory', window.currentInventoryQRDataUrl);
    } else {
        labelData = {
            qrCode: window.currentInventoryQRDataUrl,
            name: item.name,
            quantity: `${item.quantity || ''} ${item.unit || ''}`,
            category: categoryName,
            location: locationName,
            serial: item.serial_number || '',
            printDate: new Date().toLocaleDateString()
        };
    }

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Label - ${escapeHtml(item.name)}</title>
            <style>
                @media print {
                    body { margin: 0; padding: 10mm; }
                    .no-print { display: none; }
                }
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                }
                .label {
                    border: 2px solid #333;
                    padding: 15px;
                    max-width: 300px;
                    text-align: center;
                }
                .label-qr img {
                    max-width: 150px;
                }
                .label-name {
                    font-size: 18px;
                    font-weight: bold;
                    margin: 10px 0;
                }
                .label-details {
                    font-size: 12px;
                    text-align: left;
                }
                .label-details p {
                    margin: 4px 0;
                }
                .label-date {
                    font-size: 10px;
                    color: #666;
                    margin-top: 10px;
                }
                .print-btn {
                    margin: 20px;
                    padding: 10px 20px;
                    font-size: 16px;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <button class="print-btn no-print" onclick="window.print()">Print Label</button>
            <div class="label">
                <div class="label-qr">
                    <img src="${labelData.qrCode}" alt="QR Code">
                </div>
                <div class="label-name">${escapeHtml(labelData.name)}</div>
                <div class="label-details">
                    ${isGroup ? `<p><strong>Items:</strong> ${item.items.length}</p>` : ''}
                    ${isGroup ? `<p><strong>Total Qty:</strong> ${item.totalQuantity}</p>` : `<p><strong>Qty:</strong> ${labelData.quantity}</p>`}
                    ${labelData.category ? `<p><strong>Category:</strong> ${escapeHtml(labelData.category)}</p>` : ''}
                    ${labelData.location ? `<p><strong>Location:</strong> ${escapeHtml(labelData.location)}</p>` : ''}
                    ${labelData.serial ? `<p><strong>Serial:</strong> ${escapeHtml(labelData.serial)}</p>` : ''}
                </div>
                <div class="label-date">Printed: ${labelData.printDate}</div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Export QR functions for inventory
window.generateInventoryQRCode = generateInventoryQRCode;
window.generateInventoryGroupQRCode = generateInventoryGroupQRCode;
window.showInventoryItemQRCode = showInventoryItemQRCode;
window.showInventoryGroupQRCode = showInventoryGroupQRCode;
window.closeInventoryQRModal = closeInventoryQRModal;
window.downloadInventoryQRCode = downloadInventoryQRCode;
window.printInventoryQRLabel = printInventoryQRLabel;

/**
 * SPS Food Pantry Module
 * Enterprise-grade food tracking with USDA nutrition data and family planning
 */

// State
let pantryItems = [];
let familyProfiles = [];
let locations = [];
let categories = [];
let currentFilters = { search: '', category: '', location: '', status: '' };
let editingItemId = null;
let editingFamilyId = null;
let consumeItemId = null;
let scanner = null;
let expandedGroups = new Set(); // Track which groups are expanded

// Charts
let macrosChart = null;
let categoryChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initFilters();
    loadCategories();
    loadLocations();
    loadPantryData();
    loadFamilyProfiles();
    handleURLParams();
});

// Handle URL parameters (for linking from dashboard)
function handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const days = params.get('days');

    if (tab === 'expiring') {
        // Switch to expiring tab
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const expiringBtn = document.querySelector('.tab-btn[data-tab="expiring"]');
        if (expiringBtn) expiringBtn.classList.add('active');

        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const expiringPanel = document.getElementById('tab-expiring');
        if (expiringPanel) expiringPanel.classList.add('active');

        // Set the days filter
        if (days) {
            const daysSelect = document.getElementById('expiring-days');
            if (daysSelect) {
                daysSelect.value = days;
            }
        }

        // Load expiring items
        loadExpiringItems();
    }
}

// ============================================
// TAB NAVIGATION
// ============================================

// Switch to expiring tab with specific days filter (called from stat cards)
function switchToExpiringTab(days) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const expiringBtn = document.querySelector('.tab-btn[data-tab="expiring"]');
    if (expiringBtn) expiringBtn.classList.add('active');

    // Update panels
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    const expiringPanel = document.getElementById('tab-expiring');
    if (expiringPanel) expiringPanel.classList.add('active');

    // Set the days filter
    const daysSelect = document.getElementById('expiring-days');
    if (daysSelect) {
        daysSelect.value = days;
    }

    // Load expiring items with the selected days
    loadExpiringItems();
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            // Update buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update panels
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');

            // Load tab-specific data
            if (tab === 'expiring') loadExpiringItems();
            if (tab === 'nutrition') updateCharts();
            if (tab === 'spreadsheet') {
                // Initialize spreadsheet when tab is clicked
                setTimeout(() => {
                    spreadsheetData = [...pantryItems];
                    modifiedRows.clear();
                    renderSpreadsheet();
                    updateUnsavedIndicator();
                }, 100);
            }
        });
    });
}

// ============================================
// DATA LOADING
// ============================================

async function loadPantryData() {
    try {
        const queryParams = new URLSearchParams();
        if (currentFilters.category) queryParams.append('category', currentFilters.category);
        if (currentFilters.location) queryParams.append('location_id', currentFilters.location);
        if (currentFilters.status) queryParams.append('status', currentFilters.status);
        if (currentFilters.search) queryParams.append('search', currentFilters.search);

        const response = await fetch(`/api/pantry/items?${queryParams}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to load pantry');

        const data = await response.json();
        pantryItems = data.items || [];

        updateStats();
        renderPantryTable();

    } catch (error) {
        console.error('[Pantry] Load error:', error);
        showNotification('Failed to load pantry data', 'error');
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/pantry/categories', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            categories = data.categories || [];
            populateCategoryDropdown();
        }
    } catch (error) {
        console.error('[Pantry] Categories error:', error);
        // Use defaults
        categories = [
            { id: 1, name: 'Grains & Cereals' },
            { id: 2, name: 'Canned Goods' },
            { id: 3, name: 'Proteins' },
            { id: 4, name: 'Dairy' },
            { id: 5, name: 'Fruits & Vegetables' },
            { id: 6, name: 'Snacks' },
            { id: 7, name: 'Beverages' },
            { id: 8, name: 'Condiments & Sauces' },
            { id: 9, name: 'Baking Supplies' },
            { id: 10, name: 'Emergency Rations' }
        ];
        populateCategoryDropdown();
    }
}

async function loadLocations() {
    try {
        const response = await fetch('/api/pantry/locations', {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            locations = data.locations || [];
            populateLocationDropdown();
        }
    } catch (error) {
        console.error('[Pantry] Locations error:', error);
    }
}

async function loadFamilyProfiles() {
    try {
        const response = await fetch('/api/family-profiles', {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to load family');

        const data = await response.json();
        familyProfiles = data.profiles || [];

        renderFamilyProfiles();
        updateFamilyCalorieSummary();
        populateFamilyDropdown();

    } catch (error) {
        console.error('[Pantry] Family load error:', error);
    }
}

async function loadExpiringItems() {
    const days = document.getElementById('expiring-days')?.value || 30;

    try {
        const response = await fetch(`/api/pantry/expiring?days=${days}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to load expiring');

        const data = await response.json();
        renderExpiringItems(data.items || []);

    } catch (error) {
        console.error('[Pantry] Expiring load error:', error);
    }
}

// ============================================
// RENDERING
// ============================================

/**
 * Normalize item name for grouping - exact match after lowercase and trim
 */
function normalizeItemName(name) {
    return (name || '').trim().toLowerCase();
}

/**
 * Group pantry items by normalized name
 */
function groupPantryItems(items) {
    const groups = {};

    items.forEach(item => {
        const groupKey = normalizeItemName(item.name);
        if (!groups[groupKey]) {
            groups[groupKey] = {
                key: groupKey,
                displayName: item.name, // Use first item's name for display
                items: [],
                // Aggregated totals
                totalQuantity: 0,
                totalCalories: 0,
                totalProtein: 0,
                totalCarbs: 0,
                totalFat: 0,
                totalCost: 0,
                categories: new Set(),
                locations: new Set(),
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
        group.totalCalories += (parseFloat(item.calories_per_unit) || 0) * qty;
        group.totalProtein += (parseFloat(item.protein_per_unit) || 0) * qty;
        group.totalCarbs += (parseFloat(item.carbs_per_unit) || 0) * qty;
        group.totalFat += (parseFloat(item.fat_per_unit) || 0) * qty;
        group.totalCost += (parseFloat(item.cost_per_unit) || 0) * qty;

        // Track categories, locations, units
        if (item.category) group.categories.add(item.category);
        if (item.location_name) group.locations.add(item.location_name);
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

            // Track earliest expiry
            if (!group.earliestExpiry || expDate < group.earliestExpiry) {
                group.earliestExpiry = expDate;
            }
        }
    });

    // Convert to array and sort by display name
    return Object.values(groups).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Toggle group expansion
 */
function togglePantryGroup(groupKey) {
    if (expandedGroups.has(groupKey)) {
        expandedGroups.delete(groupKey);
    } else {
        expandedGroups.add(groupKey);
    }
    renderPantryTable();
}

function renderPantryTable() {
    const tbody = document.getElementById('pantry-body');
    if (!tbody) return;

    if (pantryItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <div style="padding: 2rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">&#127857;</div>
                        <h3>No Items in Pantry</h3>
                        <p>Add food items using the button above</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Group items by normalized name
    const groups = groupPantryItems(pantryItems);

    let html = '';

    groups.forEach(group => {
        const isExpanded = expandedGroups.has(group.key);
        const isSingleItem = group.items.length === 1;
        const qtyClass = group.totalQuantity <= 0 ? 'out' : group.totalQuantity <= 2 ? 'low' : 'good';
        const expiryClass = group.earliestExpiry ? getExpiryClass(group.earliestExpiry.toISOString()) : 'good';

        // Get primary unit (most common)
        const primaryUnit = group.units.size > 0 ? [...group.units][0] : 'units';
        const unitDisplay = group.units.size > 1 ? 'mixed' : primaryUnit;

        // Get category display
        const categoryDisplay = group.categories.size > 1
            ? `${[...group.categories][0]} +${group.categories.size - 1}`
            : ([...group.categories][0] || 'Uncategorized');

        // Get location display
        const locationDisplay = group.locations.size > 1
            ? `${[...group.locations][0]} +${group.locations.size - 1}`
            : ([...group.locations][0] || '—');

        // Expiry display for group
        let expiryDisplay = '—';
        if (group.earliestExpiry) {
            expiryDisplay = formatDate(group.earliestExpiry.toISOString());
            if (group.expiringSoon7 > 0) {
                expiryDisplay += ` <span class="expiry-count warning">(${group.expiringSoon7} soon)</span>`;
            }
        }

        if (isSingleItem) {
            // Single item - render normally without expand toggle
            const item = group.items[0];
            const totalCalories = (item.calories_per_unit || 0) * item.quantity;
            const itemExpiryClass = getExpiryClass(item.expiration_date);
            const itemQtyClass = item.quantity <= 0 ? 'out' : item.quantity <= 2 ? 'low' : 'good';

            html += `
                <tr class="item-row">
                    <td>
                        <div class="item-cell">
                            <span class="item-name">${escapeHtml(item.name)}</span>
                            ${item.brand ? `<span class="item-brand">${escapeHtml(item.brand)}</span>` : ''}
                        </div>
                    </td>
                    <td><span class="category-badge">${escapeHtml(item.category || 'Uncategorized')}</span></td>
                    <td><span class="qty-badge ${itemQtyClass}">${item.quantity} ${item.unit || 'units'}</span></td>
                    <td>${totalCalories > 0 ? formatNumber(totalCalories) : '—'}</td>
                    <td>${item.location_name || '—'}</td>
                    <td><span class="expiry-badge ${itemExpiryClass}">${formatDate(item.expiration_date) || '—'}</span></td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn qr" onclick="showItemQRCode(${item.id})" title="QR Code">&#9641;</button>
                            <button class="action-btn consume" onclick="openConsumeModal(${item.id})" title="Consume">&#127869;</button>
                            <button class="action-btn" onclick="editPantryItem(${item.id})" title="Edit">&#9998;</button>
                            <button class="action-btn danger" onclick="deletePantryItem(${item.id})" title="Delete">&#128465;</button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Multiple items - render group header with expand toggle
            html += `
                <tr class="group-row ${isExpanded ? 'expanded' : ''}" onclick="togglePantryGroup('${escapeHtml(group.key)}')" style="cursor: pointer;">
                    <td>
                        <div class="item-cell group-header">
                            <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
                            <span class="item-name">${escapeHtml(group.displayName)}</span>
                            <span class="group-count">(${group.items.length} items)</span>
                        </div>
                    </td>
                    <td><span class="category-badge">${escapeHtml(categoryDisplay)}</span></td>
                    <td><span class="qty-badge ${qtyClass}">${group.totalQuantity} ${unitDisplay}</span></td>
                    <td>${group.totalCalories > 0 ? formatNumber(Math.round(group.totalCalories)) : '—'}</td>
                    <td>${locationDisplay}</td>
                    <td><span class="expiry-badge ${expiryClass}">${expiryDisplay}</span></td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn qr" onclick="event.stopPropagation(); showGroupQRCode('${escapeHtml(group.key)}')" title="Group QR">&#9641;</button>
                            <span class="group-summary" title="Protein: ${Math.round(group.totalProtein)}g | Carbs: ${Math.round(group.totalCarbs)}g | Fat: ${Math.round(group.totalFat)}g">
                                &#128202;
                            </span>
                        </div>
                    </td>
                </tr>
            `;

            // Render child items if expanded
            if (isExpanded) {
                group.items.forEach(item => {
                    const totalCalories = (item.calories_per_unit || 0) * item.quantity;
                    const itemExpiryClass = getExpiryClass(item.expiration_date);
                    const itemQtyClass = item.quantity <= 0 ? 'out' : item.quantity <= 2 ? 'low' : 'good';

                    html += `
                        <tr class="child-row">
                            <td>
                                <div class="item-cell child-item">
                                    <span class="child-indent"></span>
                                    <span class="item-name">${escapeHtml(item.name)}</span>
                                    ${item.brand ? `<span class="item-brand">${escapeHtml(item.brand)}</span>` : ''}
                                </div>
                            </td>
                            <td><span class="category-badge">${escapeHtml(item.category || 'Uncategorized')}</span></td>
                            <td><span class="qty-badge ${itemQtyClass}">${item.quantity} ${item.unit || 'units'}</span></td>
                            <td>${totalCalories > 0 ? formatNumber(totalCalories) : '—'}</td>
                            <td>${item.location_name || '—'}</td>
                            <td><span class="expiry-badge ${itemExpiryClass}">${formatDate(item.expiration_date) || '—'}</span></td>
                            <td>
                                <div class="action-btns">
                                    <button class="action-btn qr" onclick="event.stopPropagation(); showItemQRCode(${item.id})" title="QR Code">&#9641;</button>
                                    <button class="action-btn consume" onclick="event.stopPropagation(); openConsumeModal(${item.id})" title="Consume">&#127869;</button>
                                    <button class="action-btn" onclick="event.stopPropagation(); editPantryItem(${item.id})" title="Edit">&#9998;</button>
                                    <button class="action-btn danger" onclick="event.stopPropagation(); deletePantryItem(${item.id})" title="Delete">&#128465;</button>
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

function renderFamilyProfiles() {
    const container = document.getElementById('family-profiles');
    if (!container) return;

    if (familyProfiles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No family members added yet</p>
                <button class="btn btn-primary" onclick="openFamilyModal()">Add First Member</button>
            </div>
        `;
        return;
    }

    container.innerHTML = familyProfiles.map(profile => {
        const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const age = profile.age || calculateAge(profile.birth_date);

        return `
            <div class="family-card">
                <div class="family-card-header">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <div class="family-avatar">${initials}</div>
                        <div class="family-info">
                            <h4>${escapeHtml(profile.name)}</h4>
                            <span class="relationship">${profile.relationship || 'Member'}${age ? `, ${age} years` : ''}</span>
                        </div>
                    </div>
                </div>
                <div class="family-stats">
                    <div class="family-stat">
                        <div class="family-stat-value">${profile.calculated_tdee || '—'}</div>
                        <div class="family-stat-label">Daily Cal</div>
                    </div>
                    <div class="family-stat">
                        <div class="family-stat-value">${profile.protein_grams_target || '—'}g</div>
                        <div class="family-stat-label">Protein</div>
                    </div>
                </div>
                <div class="family-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editFamilyMember(${profile.id})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteFamilyMember(${profile.id})">Remove</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderExpiringItems(items) {
    const container = document.getElementById('expiring-list');
    const expiredContainer = document.getElementById('expired-list');
    if (!container) return;

    const now = new Date();
    const expiring = items.filter(i => new Date(i.expiration_date) >= now);
    const expired = items.filter(i => new Date(i.expiration_date) < now);

    if (expiring.length === 0) {
        container.innerHTML = '<div class="empty-state">No items expiring soon</div>';
    } else {
        container.innerHTML = expiring.map(item => {
            const daysLeft = item.days_until_expiry;
            const urgencyClass = daysLeft <= 7 ? 'urgent' : 'warning';

            return `
                <div class="expiring-item ${urgencyClass}">
                    <div class="expiring-item-info">
                        <span class="expiring-item-name">${escapeHtml(item.name)}</span>
                        <span class="expiring-item-date">${daysLeft} days left - ${formatDate(item.expiration_date)}</span>
                    </div>
                    <div class="action-btns">
                        <button class="action-btn consume" onclick="openConsumeModal(${item.id})" title="Consume">&#127869;</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (expiredContainer) {
        if (expired.length === 0) {
            expiredContainer.innerHTML = '<div class="empty-state">No expired items</div>';
        } else {
            expiredContainer.innerHTML = expired.map(item => `
                <div class="expiring-item urgent">
                    <div class="expiring-item-info">
                        <span class="expiring-item-name">${escapeHtml(item.name)}</span>
                        <span class="expiring-item-date">Expired ${formatDate(item.expiration_date)}</span>
                    </div>
                    <div class="action-btns">
                        <button class="action-btn danger" onclick="deletePantryItem(${item.id})" title="Remove">&#128465;</button>
                    </div>
                </div>
            `).join('');
        }
    }
}

// ============================================
// STATISTICS
// ============================================

function updateStats() {
    const totalItems = pantryItems.length;
    const totalCalories = pantryItems.reduce((sum, i) => sum + ((i.calories_per_unit || 0) * i.quantity), 0);

    const now = Date.now();
    const sevenDays = now + (7 * 24 * 60 * 60 * 1000);
    const thirtyDays = now + (30 * 24 * 60 * 60 * 1000);
    const ninetyDays = now + (90 * 24 * 60 * 60 * 1000);

    const expiring7 = pantryItems.filter(i => {
        if (!i.expiration_date) return false;
        const exp = new Date(i.expiration_date).getTime();
        return exp > now && exp <= sevenDays;
    }).length;

    const expiring30 = pantryItems.filter(i => {
        if (!i.expiration_date) return false;
        const exp = new Date(i.expiration_date).getTime();
        return exp > now && exp <= thirtyDays;
    }).length;

    const expiring90 = pantryItems.filter(i => {
        if (!i.expiration_date) return false;
        const exp = new Date(i.expiration_date).getTime();
        return exp > now && exp <= ninetyDays;
    }).length;

    // Calculate days of supply
    const familyDailyCalories = familyProfiles.reduce((sum, p) => sum + (p.calculated_tdee || 2000), 0) || 2000;
    const daysSupply = Math.floor(totalCalories / familyDailyCalories);

    document.getElementById('stat-total-items').textContent = totalItems;
    document.getElementById('stat-total-calories').textContent = formatNumber(totalCalories);
    document.getElementById('stat-days-supply').innerHTML = formatDaysOfSupply(daysSupply);
    document.getElementById('stat-expiring-7').textContent = expiring7;
    document.getElementById('stat-expiring-30').textContent = expiring30;
    document.getElementById('stat-expiring-90').textContent = expiring90;
}

// Format days of supply into days/weeks/months/years
function formatDaysOfSupply(days) {
    if (!days || days <= 0) {
        return '<span class="supply-value">0</span><span class="supply-unit">days</span>';
    }

    if (days < 7) {
        return `<span class="supply-value">${days}</span><span class="supply-unit">${days === 1 ? 'day' : 'days'}</span>`;
    } else if (days < 30) {
        const weeks = Math.floor(days / 7);
        const remainingDays = days % 7;
        if (remainingDays === 0) {
            return `<span class="supply-value">${weeks}</span><span class="supply-unit">${weeks === 1 ? 'week' : 'weeks'}</span>`;
        }
        return `<span class="supply-value">${weeks}</span><span class="supply-unit">wk</span> <span class="supply-value supply-secondary">${remainingDays}</span><span class="supply-unit">d</span>`;
    } else if (days < 365) {
        const months = Math.floor(days / 30);
        const remainingWeeks = Math.floor((days % 30) / 7);
        if (remainingWeeks === 0) {
            return `<span class="supply-value">${months}</span><span class="supply-unit">${months === 1 ? 'month' : 'months'}</span>`;
        }
        return `<span class="supply-value">${months}</span><span class="supply-unit">mo</span> <span class="supply-value supply-secondary">${remainingWeeks}</span><span class="supply-unit">wk</span>`;
    } else {
        const years = Math.floor(days / 365);
        const remainingMonths = Math.floor((days % 365) / 30);
        if (remainingMonths === 0) {
            return `<span class="supply-value">${years}</span><span class="supply-unit">${years === 1 ? 'year' : 'years'}</span>`;
        }
        return `<span class="supply-value">${years}</span><span class="supply-unit">yr</span> <span class="supply-value supply-secondary">${remainingMonths}</span><span class="supply-unit">mo</span>`;
    }
}

function updateFamilyCalorieSummary() {
    const familyDaily = familyProfiles.reduce((sum, p) => sum + (p.calculated_tdee || 0), 0);
    const pantryTotal = pantryItems.reduce((sum, i) => sum + ((i.calories_per_unit || 0) * i.quantity), 0);
    const daysSupply = familyDaily > 0 ? Math.floor(pantryTotal / familyDaily) : 0;

    const familyCalEl = document.getElementById('family-daily-calories');
    const pantryCalEl = document.getElementById('pantry-calories');
    const daysEl = document.getElementById('days-supply');

    if (familyCalEl) familyCalEl.textContent = `${formatNumber(familyDaily)} cal/day`;
    if (pantryCalEl) pantryCalEl.textContent = `${formatNumber(pantryTotal)} cal`;
    if (daysEl) daysEl.textContent = `${daysSupply} days`;
}

function updateCharts() {
    updateMacrosChart();
    updateCategoryChart();
    updateNutritionTotals();
}

function updateMacrosChart() {
    const protein = pantryItems.reduce((sum, i) => sum + ((i.protein_per_unit || 0) * i.quantity), 0);
    const carbs = pantryItems.reduce((sum, i) => sum + ((i.carbs_per_unit || 0) * i.quantity), 0);
    const fat = pantryItems.reduce((sum, i) => sum + ((i.fat_per_unit || 0) * i.quantity), 0);

    const ctx = document.getElementById('macros-chart')?.getContext('2d');
    if (!ctx) return;

    if (macrosChart) macrosChart.destroy();

    macrosChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Protein', 'Carbohydrates', 'Fat'],
            datasets: [{
                data: [protein, carbs, fat],
                backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateCategoryChart() {
    const categoryData = {};
    pantryItems.forEach(item => {
        const cat = item.category || 'Uncategorized';
        const calories = (item.calories_per_unit || 0) * item.quantity;
        categoryData[cat] = (categoryData[cat] || 0) + calories;
    });

    const ctx = document.getElementById('category-chart')?.getContext('2d');
    if (!ctx) return;

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                label: 'Calories',
                data: Object.values(categoryData),
                backgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateNutritionTotals() {
    const totalCalories = pantryItems.reduce((sum, i) => sum + ((i.calories_per_unit || 0) * i.quantity), 0);
    const totalProtein = pantryItems.reduce((sum, i) => sum + ((i.protein_per_unit || 0) * i.quantity), 0);
    const totalCarbs = pantryItems.reduce((sum, i) => sum + ((i.carbs_per_unit || 0) * i.quantity), 0);
    const totalFat = pantryItems.reduce((sum, i) => sum + ((i.fat_per_unit || 0) * i.quantity), 0);

    document.getElementById('total-calories').textContent = formatNumber(totalCalories);
    document.getElementById('total-protein').textContent = `${formatNumber(Math.round(totalProtein))}g`;
    document.getElementById('total-carbs').textContent = `${formatNumber(Math.round(totalCarbs))}g`;
    document.getElementById('total-fat').textContent = `${formatNumber(Math.round(totalFat))}g`;
}

// ============================================
// FILTERS
// ============================================

function initFilters() {
    const searchInput = document.getElementById('pantry-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            currentFilters.search = e.target.value;
            loadPantryData();
        }, 300));
    }

    document.getElementById('filter-category')?.addEventListener('change', (e) => {
        currentFilters.category = e.target.value;
        loadPantryData();
    });

    document.getElementById('filter-location')?.addEventListener('change', (e) => {
        currentFilters.location = e.target.value;
        loadPantryData();
    });

    document.getElementById('filter-status')?.addEventListener('change', (e) => {
        currentFilters.status = e.target.value;
        loadPantryData();
    });

    document.getElementById('expiring-days')?.addEventListener('change', () => {
        loadExpiringItems();
    });
}

function populateCategoryDropdown() {
    const filterSelect = document.getElementById('filter-category');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Categories</option>' +
            categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
    }
}

function populateLocationDropdown() {
    const filterSelect = document.getElementById('filter-location');
    const formSelect = document.getElementById('food-location');

    const options = locations.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');

    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">All Locations</option>' + options;
    }
    if (formSelect) {
        formSelect.innerHTML = '<option value="">Select Location</option>' + options;
    }
}

function populateFamilyDropdown() {
    const select = document.getElementById('consume-family');
    if (select) {
        select.innerHTML = '<option value="">Not specified</option>' +
            familyProfiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    }
}

// ============================================
// FOOD ITEM CRUD
// ============================================

function openAddItemModal() {
    editingItemId = null;
    document.getElementById('food-modal-title').textContent = 'Add Food Item';
    document.getElementById('food-form').reset();
    document.getElementById('food-id').value = '';

    // Show existing item selector and populate it
    const existingFoodSection = document.getElementById('existing-food-section');
    if (existingFoodSection) {
        existingFoodSection.style.display = 'block';
        populateExistingFoodDropdown();
    }

    document.getElementById('food-modal').classList.add('active');
}

function closeFoodModal() {
    document.getElementById('food-modal').classList.remove('active');
    editingItemId = null;

    // Hide existing item selector
    const existingFoodSection = document.getElementById('existing-food-section');
    if (existingFoodSection) {
        existingFoodSection.style.display = 'none';
    }
}

/**
 * Populate existing food items dropdown for quick selection
 */
function populateExistingFoodDropdown() {
    const select = document.getElementById('existing-food-select');
    if (!select) return;

    // Get unique items by name
    const uniqueItems = {};
    pantryItems.forEach(item => {
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
        option.textContent = `${item.name}${item.category ? ` (${item.category})` : ''}`;
        option.dataset.item = JSON.stringify(item);
        select.appendChild(option);
    });
}

/**
 * Handle existing food selection - pre-fill form with selected item's details
 */
function selectExistingFood(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    if (!selectedOption.value) return;

    try {
        const item = JSON.parse(selectedOption.dataset.item);

        // Pre-fill form fields with existing item data (but not quantity/expiration)
        document.getElementById('food-name').value = item.name || '';
        document.getElementById('food-barcode').value = item.barcode || '';
        document.getElementById('food-category').value = item.category || '';
        document.getElementById('food-location').value = item.location_id || '';
        document.getElementById('food-unit').value = item.unit || 'units';
        document.getElementById('food-servings').value = item.servings_per_unit || 1;

        // Nutrition info
        document.getElementById('food-calories').value = item.calories_per_unit || '';
        document.getElementById('food-protein').value = item.protein_per_unit || '';
        document.getElementById('food-carbs').value = item.carbs_per_unit || '';
        document.getElementById('food-fat').value = item.fat_per_unit || '';

        // Cost info
        document.getElementById('food-cost').value = item.cost_per_unit || '';

        // Keep quantity at 1 and don't copy dates
        document.getElementById('food-quantity').value = 1;
        document.getElementById('food-purchase').value = new Date().toISOString().split('T')[0];
        document.getElementById('food-expiration').value = '';

        showNotification(`Pre-filled from "${item.name}". Adjust quantity and expiration as needed.`, 'info');
    } catch (e) {
        console.error('[Pantry] Error parsing item data:', e);
    }
}

function editPantryItem(id) {
    const item = pantryItems.find(i => i.id === id);
    if (!item) return;

    editingItemId = id;
    document.getElementById('food-modal-title').textContent = 'Edit Food Item';
    document.getElementById('food-id').value = id;
    document.getElementById('food-name').value = item.name || '';
    document.getElementById('food-barcode').value = item.barcode || '';
    document.getElementById('food-category').value = item.category || '';
    document.getElementById('food-location').value = item.location_id || '';
    document.getElementById('food-quantity').value = item.quantity || 1;
    document.getElementById('food-unit').value = item.unit || 'units';
    document.getElementById('food-servings').value = item.servings_per_unit || 1;
    document.getElementById('food-calories').value = item.calories_per_unit || '';
    document.getElementById('food-protein').value = item.protein_per_unit || '';
    document.getElementById('food-carbs').value = item.carbs_per_unit || '';
    document.getElementById('food-fat').value = item.fat_per_unit || '';
    document.getElementById('food-purchase').value = item.purchase_date?.split('T')[0] || '';
    document.getElementById('food-expiration').value = item.expiration_date?.split('T')[0] || '';
    document.getElementById('food-cost').value = item.cost_per_unit || '';
    document.getElementById('food-notes').value = item.notes || '';

    // Hide existing item selector when editing
    const existingFoodSection = document.getElementById('existing-food-section');
    if (existingFoodSection) {
        existingFoodSection.style.display = 'none';
    }

    document.getElementById('food-modal').classList.add('active');
}

async function saveFood(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Convert numeric fields
    ['quantity', 'servings_per_unit', 'calories_per_unit', 'protein_per_unit', 'carbs_per_unit', 'fat_per_unit', 'cost_per_unit', 'location_id'].forEach(field => {
        if (data[field]) data[field] = parseFloat(data[field]);
        else delete data[field];
    });

    const id = data.id;
    delete data.id;

    try {
        const url = id ? `/api/pantry/items/${id}` : '/api/pantry/items';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Failed to save');

        showNotification(id ? 'Item updated' : 'Item added', 'success');
        closeFoodModal();
        loadPantryData();

    } catch (error) {
        console.error('[Pantry] Save error:', error);
        showNotification('Failed to save item', 'error');
    }
}

async function deletePantryItem(id) {
    if (!confirm('Delete this item?')) return;

    try {
        const response = await fetch(`/api/pantry/items/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to delete');

        showNotification('Item deleted', 'success');
        loadPantryData();

    } catch (error) {
        console.error('[Pantry] Delete error:', error);
        showNotification('Failed to delete item', 'error');
    }
}

// ============================================
// CONSUMPTION
// ============================================

function openConsumeModal(id) {
    const item = pantryItems.find(i => i.id === id);
    if (!item) return;

    consumeItemId = id;
    document.getElementById('consume-item-name').textContent = `${item.name} (${item.quantity} ${item.unit || 'units'} available)`;
    document.getElementById('consume-item-id').value = id;
    document.getElementById('consume-quantity').value = 1;
    document.getElementById('consume-quantity').max = item.quantity;
    document.getElementById('consume-modal').classList.add('active');
}

function closeConsumeModal() {
    document.getElementById('consume-modal').classList.remove('active');
    consumeItemId = null;
}

async function submitConsume(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
        quantity: parseFloat(formData.get('quantity')),
        family_profile_id: formData.get('family_profile_id') || null,
        meal_type: formData.get('meal_type') || null
    };

    try {
        const response = await fetch(`/api/pantry/items/${consumeItemId}/consume`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Failed to consume');

        showNotification('Consumption recorded', 'success');
        closeConsumeModal();
        loadPantryData();

    } catch (error) {
        console.error('[Pantry] Consume error:', error);
        showNotification('Failed to record consumption', 'error');
    }
}

// ============================================
// FAMILY MEMBER CRUD
// ============================================

function openFamilyModal() {
    editingFamilyId = null;
    document.getElementById('family-modal-title').textContent = 'Add Family Member';
    document.getElementById('family-form').reset();
    document.getElementById('family-id').value = '';
    document.getElementById('family-modal').classList.add('active');
}

function closeFamilyModal() {
    document.getElementById('family-modal').classList.remove('active');
    editingFamilyId = null;
}

function editFamilyMember(id) {
    const member = familyProfiles.find(p => p.id === id);
    if (!member) return;

    editingFamilyId = id;
    document.getElementById('family-modal-title').textContent = 'Edit Family Member';
    document.getElementById('family-id').value = id;
    document.getElementById('family-name').value = member.name || '';
    document.getElementById('family-relationship').value = member.relationship || 'other';
    document.getElementById('family-birthdate').value = member.birth_date?.split('T')[0] || '';
    document.getElementById('family-gender').value = member.gender || 'male';
    document.getElementById('family-activity').value = member.activity_level || 'moderate';
    document.getElementById('family-height').value = member.height_inches || '';
    document.getElementById('family-weight').value = member.weight_lbs || '';
    document.getElementById('family-pregnant').checked = member.is_pregnant || false;
    document.getElementById('family-lactating').checked = member.is_lactating || false;

    document.getElementById('family-modal').classList.add('active');
}

async function saveFamilyMember(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Handle checkboxes
    data.is_pregnant = document.getElementById('family-pregnant').checked;
    data.is_lactating = document.getElementById('family-lactating').checked;

    // Convert numeric fields
    if (data.height_inches) data.height_inches = parseFloat(data.height_inches);
    if (data.weight_lbs) data.weight_lbs = parseFloat(data.weight_lbs);

    const id = data.id;
    delete data.id;

    try {
        const url = id ? `/api/family-profiles/${id}` : '/api/family-profiles';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Failed to save');

        showNotification(id ? 'Member updated' : 'Member added', 'success');
        closeFamilyModal();
        loadFamilyProfiles();

    } catch (error) {
        console.error('[Pantry] Family save error:', error);
        showNotification('Failed to save member', 'error');
    }
}

async function deleteFamilyMember(id) {
    if (!confirm('Remove this family member?')) return;

    try {
        const response = await fetch(`/api/family-profiles/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Failed to delete');

        showNotification('Member removed', 'success');
        loadFamilyProfiles();

    } catch (error) {
        console.error('[Pantry] Family delete error:', error);
        showNotification('Failed to remove member', 'error');
    }
}

// ============================================
// BARCODE SCANNER
// ============================================

function openBarcodeScanner() {
    document.getElementById('scanner-modal').classList.add('active');
    startScanner();
}

function closeBarcodeScanner() {
    document.getElementById('scanner-modal').classList.remove('active');
    stopScanner();
}

async function startScanner() {
    const viewport = document.getElementById('scanner-viewport');
    const statusEl = document.getElementById('scanner-status');

    if (typeof Quagga === 'undefined') {
        statusEl.textContent = 'Scanner not available. Use manual entry.';
        return;
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
                readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader']
            },
            locate: true
        }, (err) => {
            if (err) {
                statusEl.textContent = 'Camera unavailable. Use manual entry.';
                return;
            }
            Quagga.start();
            statusEl.textContent = 'Point camera at barcode';
        });

        Quagga.onDetected((result) => {
            if (result.codeResult.code) {
                document.getElementById('scanned-code').value = result.codeResult.code;
                stopScanner();
                lookupAndFillFood(result.codeResult.code);
            }
        });

        scanner = Quagga;
    } catch (error) {
        statusEl.textContent = 'Scanner error. Use manual entry.';
    }
}

function stopScanner() {
    if (scanner) {
        scanner.stop();
        scanner = null;
    }
}

function useScanResult() {
    const code = document.getElementById('scanned-code').value;
    if (code) {
        lookupAndFillFood(code);
    }
    closeBarcodeScanner();
}

function scanToFoodInput() {
    openBarcodeScanner();
}

async function lookupAndFillFood(barcode) {
    // Try Open Food Facts API
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();

        if (data.status === 1 && data.product) {
            const p = data.product;
            document.getElementById('food-name').value = p.product_name || '';
            document.getElementById('food-barcode').value = barcode;

            if (p.nutriments) {
                document.getElementById('food-calories').value = Math.round(p.nutriments['energy-kcal_100g'] || 0);
                document.getElementById('food-protein').value = Math.round(p.nutriments.proteins_100g || 0);
                document.getElementById('food-carbs').value = Math.round(p.nutriments.carbohydrates_100g || 0);
                document.getElementById('food-fat').value = Math.round(p.nutriments.fat_100g || 0);
            }

            showNotification('Product found! Values filled in.', 'success');
            openAddItemModal();
            return;
        }
    } catch (error) {
        console.log('[Pantry] Barcode lookup failed:', error);
    }

    // Product not found
    document.getElementById('food-barcode').value = barcode;
    showNotification('Product not found. Please enter details manually.', 'info');
    openAddItemModal();
}

// ============================================
// IMPORT
// ============================================

let csvData = [];

function openImportModal() {
    document.getElementById('import-modal').classList.add('active');
    csvData = [];
    document.getElementById('csv-file').value = '';
    document.getElementById('csv-preview').style.display = 'none';
    document.getElementById('import-btn').disabled = true;
}

function closeImportModal() {
    document.getElementById('import-modal').classList.remove('active');
    csvData = [];
}

function previewCSV(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            showNotification('CSV file is empty or has no data rows', 'error');
            return;
        }

        const headers = parseCSVLine(lines[0]);
        csvData = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length >= 1 && values[0]) {
                const row = {};
                headers.forEach((header, idx) => {
                    row[header.toLowerCase().trim()] = values[idx] || '';
                });
                csvData.push(row);
            }
        }

        // Show preview
        const previewDiv = document.getElementById('csv-preview');
        const previewTable = document.getElementById('csv-preview-table');
        const rowCount = document.getElementById('csv-row-count');

        const previewRows = csvData.slice(0, 5);
        previewTable.querySelector('thead').innerHTML = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
        previewTable.querySelector('tbody').innerHTML = previewRows.map(row =>
            `<tr>${headers.map(h => `<td>${escapeHtml(row[h.toLowerCase().trim()] || '')}</td>`).join('')}</tr>`
        ).join('');

        rowCount.textContent = `Total rows to import: ${csvData.length}`;
        previewDiv.style.display = 'block';
        document.getElementById('import-btn').disabled = false;
    };
    reader.readAsText(file);
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

async function importCSV() {
    if (csvData.length === 0) {
        showNotification('No data to import', 'error');
        return;
    }

    const importBtn = document.getElementById('import-btn');
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';

    let imported = 0;
    let failed = 0;

    for (const row of csvData) {
        try {
            const item = {
                name: row.name || row.item || row.product,
                category: row.category || 'Uncategorized',
                quantity: parseFloat(row.quantity || row.qty) || 1,
                unit: row.unit || 'units',
                calories_per_unit: parseFloat(row.calories || row.calories_per_unit) || null,
                protein_per_unit: parseFloat(row.protein || row.protein_per_unit) || null,
                carbs_per_unit: parseFloat(row.carbs || row.carbs_per_unit) || null,
                fat_per_unit: parseFloat(row.fat || row.fat_per_unit) || null,
                expiration_date: row.expiration_date || row.expiration || row.expires || null,
                purchase_date: row.purchase_date || row.purchased || null,
                barcode: row.barcode || null,
                notes: row.notes || null
            };

            if (!item.name) {
                failed++;
                continue;
            }

            const response = await fetch('/api/pantry/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(item)
            });

            if (response.ok) {
                imported++;
            } else {
                failed++;
            }
        } catch (err) {
            failed++;
        }
    }

    importBtn.textContent = 'Import Items';
    importBtn.disabled = false;

    closeImportModal();
    showNotification(`Imported ${imported} items${failed > 0 ? `, ${failed} failed` : ''}`, imported > 0 ? 'success' : 'error');
    loadPantryData();
}

// ============================================
// EXPORT
// ============================================

function exportPantry() {
    const headers = ['Name', 'Brand', 'Category', 'Quantity', 'Unit', 'Calories', 'Protein', 'Carbs', 'Fat', 'Expiration', 'Location', 'Notes'];

    const rows = pantryItems.map(item => [
        item.name,
        item.brand || '',
        item.category || '',
        item.quantity,
        item.unit || 'units',
        item.calories_per_unit || '',
        item.protein_per_unit || '',
        item.carbs_per_unit || '',
        item.fat_per_unit || '',
        item.expiration_date || '',
        item.location_name || '',
        item.notes || ''
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sps-pantry-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showNotification('Pantry exported', 'success');
}

async function removeAllExpired() {
    if (!confirm('Remove all expired items? This cannot be undone.')) return;

    try {
        const expired = pantryItems.filter(i => {
            if (!i.expiration_date) return false;
            return new Date(i.expiration_date) < new Date();
        });

        for (const item of expired) {
            await fetch(`/api/pantry/items/${item.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
        }

        showNotification(`Removed ${expired.length} expired items`, 'success');
        loadPantryData();
        loadExpiringItems();

    } catch (error) {
        console.error('[Pantry] Remove expired error:', error);
        showNotification('Failed to remove expired items', 'error');
    }
}

// ============================================
// UTILITIES
// ============================================

// API Base URL
const API_BASE = '/api';

function getAuthHeaders() {
    const token = localStorage.getItem('token') || localStorage.getItem('sps_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function showNotification(message, type = 'info') {
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

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function getExpiryClass(dateStr) {
    if (!dateStr) return 'good';
    const exp = new Date(dateStr).getTime();
    const now = Date.now();
    const thirtyDays = now + (30 * 24 * 60 * 60 * 1000);

    if (exp < now) return 'expired';
    if (exp <= thirtyDays) return 'expiring-soon';
    return 'good';
}

function calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

// Add animation styles
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

// ============================================
// SPREADSHEET EDITOR
// ============================================

let spreadsheetData = [];
let modifiedRows = new Set();

function initSpreadsheet() {
    const tbody = document.getElementById('spreadsheet-body');
    if (!tbody) return;

    // Use the same data as pantryItems
    spreadsheetData = [...pantryItems];
    renderSpreadsheet();
}

function renderSpreadsheet() {
    const tbody = document.getElementById('spreadsheet-body');
    if (!tbody) return;

    if (spreadsheetData.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="11" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    No items in pantry. Click "Add Row" to add items or use the regular form.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = spreadsheetData.map((item, index) => {
        const isModified = modifiedRows.has(item.id || `new-${index}`);
        const isNew = !item.id;
        const rowClass = isNew ? 'new-row' : (isModified ? 'modified' : '');

        return `
            <tr data-id="${item.id || ''}" data-index="${index}" class="${rowClass}">
                <td><input type="text" value="${escapeHtml(item.name || '')}" data-field="name" onchange="markRowModified(${index})"></td>
                <td>
                    <select data-field="category_id" onchange="markRowModified(${index})">
                        <option value="">Select</option>
                        ${categories.map(c => `<option value="${c.id}" ${item.category_id == c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                    </select>
                </td>
                <td><input type="number" value="${item.quantity || ''}" data-field="quantity" min="0" step="0.1" onchange="markRowModified(${index})"></td>
                <td><input type="text" value="${escapeHtml(item.unit || '')}" data-field="unit" placeholder="unit" onchange="markRowModified(${index})"></td>
                <td><input type="number" value="${item.calories_per_unit || ''}" data-field="calories_per_unit" min="0" onchange="markRowModified(${index})"></td>
                <td><input type="number" value="${item.protein_grams || ''}" data-field="protein_grams" min="0" step="0.1" onchange="markRowModified(${index})"></td>
                <td><input type="number" value="${item.carbs_grams || ''}" data-field="carbs_grams" min="0" step="0.1" onchange="markRowModified(${index})"></td>
                <td><input type="number" value="${item.fat_grams || ''}" data-field="fat_grams" min="0" step="0.1" onchange="markRowModified(${index})"></td>
                <td>
                    <select data-field="location_id" onchange="markRowModified(${index})">
                        <option value="">Select</option>
                        ${locations.map(l => `<option value="${l.id}" ${item.location_id == l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
                    </select>
                </td>
                <td><input type="date" value="${item.expiration_date ? item.expiration_date.split('T')[0] : ''}" data-field="expiration_date" onchange="markRowModified(${index})"></td>
                <td>
                    <div class="row-actions">
                        <button class="btn-save" onclick="saveSpreadsheetRow(${index})" title="Save">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </button>
                        <button class="btn-delete" onclick="deleteSpreadsheetRow(${index})" title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function markRowModified(index) {
    const item = spreadsheetData[index];
    const rowId = item.id || `new-${index}`;
    modifiedRows.add(rowId);

    // Update data from inputs
    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (row) {
        row.classList.add('modified');
        row.querySelectorAll('input, select').forEach(input => {
            const field = input.dataset.field;
            if (field) {
                let value = input.value;
                if (input.type === 'number') {
                    value = value ? parseFloat(value) : null;
                }
                spreadsheetData[index][field] = value;
            }
        });
    }

    updateUnsavedIndicator();
}

function updateUnsavedIndicator() {
    const indicator = document.getElementById('unsaved-indicator');
    if (indicator) {
        indicator.style.display = modifiedRows.size > 0 ? 'inline' : 'none';
    }
}

function addSpreadsheetRow() {
    const newItem = {
        name: '',
        category_id: '',
        quantity: 1,
        unit: 'count',
        calories_per_unit: 0,
        protein_grams: 0,
        carbs_grams: 0,
        fat_grams: 0,
        location_id: '',
        expiration_date: ''
    };

    spreadsheetData.unshift(newItem);
    modifiedRows.add(`new-0`);
    renderSpreadsheet();
    updateUnsavedIndicator();

    // Focus on the name field of the new row
    setTimeout(() => {
        const firstInput = document.querySelector('#spreadsheet-body tr:first-child input[data-field="name"]');
        if (firstInput) firstInput.focus();
    }, 100);
}

async function saveSpreadsheetRow(index) {
    const item = spreadsheetData[index];
    const row = document.querySelector(`tr[data-index="${index}"]`);

    // Get values from the row
    row.querySelectorAll('input, select').forEach(input => {
        const field = input.dataset.field;
        if (field) {
            let value = input.value;
            if (input.type === 'number') {
                value = value ? parseFloat(value) : null;
            }
            item[field] = value;
        }
    });

    if (!item.name) {
        showNotification('Name is required', 'error');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        let response;

        if (item.id) {
            // Update existing
            response = await fetch(`${API_BASE}/pantry/items/${item.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(item)
            });
        } else {
            // Create new
            response = await fetch(`${API_BASE}/pantry/items`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(item)
            });
        }

        if (!response.ok) throw new Error('Failed to save');

        const result = await response.json();

        // Update the item with returned data
        if (result.item) {
            spreadsheetData[index] = result.item;
        }

        // Remove from modified set
        modifiedRows.delete(item.id || `new-${index}`);
        row.classList.remove('modified', 'new-row');
        updateUnsavedIndicator();

        showNotification('Item saved', 'success');

        // Refresh main pantry list
        loadPantryData();

    } catch (error) {
        console.error('Save error:', error);
        showNotification('Failed to save item', 'error');
    }
}

async function deleteSpreadsheetRow(index) {
    const item = spreadsheetData[index];

    if (item.id) {
        // Delete from server
        if (!confirm(`Delete "${item.name}"?`)) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/pantry/items/${item.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete');

            showNotification('Item deleted', 'success');
            loadPantryData();

        } catch (error) {
            console.error('Delete error:', error);
            showNotification('Failed to delete item', 'error');
            return;
        }
    }

    // Remove from local data
    spreadsheetData.splice(index, 1);
    modifiedRows.delete(item.id || `new-${index}`);
    renderSpreadsheet();
    updateUnsavedIndicator();
}

async function saveAllChanges() {
    if (modifiedRows.size === 0) {
        showNotification('No changes to save', 'info');
        return;
    }

    const toSave = [];
    modifiedRows.forEach(rowId => {
        const index = spreadsheetData.findIndex((item, idx) =>
            (item.id || `new-${idx}`) === rowId
        );
        if (index !== -1) toSave.push(index);
    });

    let saved = 0;
    let failed = 0;

    for (const index of toSave) {
        try {
            await saveSpreadsheetRow(index);
            saved++;
        } catch (error) {
            failed++;
        }
    }

    if (failed > 0) {
        showNotification(`Saved ${saved} items, ${failed} failed`, 'error');
    } else {
        showNotification(`All ${saved} items saved`, 'success');
    }
}

// Spreadsheet tab initialization is now handled in initTabs()

// Export functions
window.openAddItemModal = openAddItemModal;
window.closeFoodModal = closeFoodModal;
window.saveFood = saveFood;
window.editPantryItem = editPantryItem;
window.deletePantryItem = deletePantryItem;
window.togglePantryGroup = togglePantryGroup;
window.openConsumeModal = openConsumeModal;
window.closeConsumeModal = closeConsumeModal;
window.submitConsume = submitConsume;
window.openFamilyModal = openFamilyModal;
window.closeFamilyModal = closeFamilyModal;
window.saveFamilyMember = saveFamilyMember;
window.editFamilyMember = editFamilyMember;
window.deleteFamilyMember = deleteFamilyMember;
window.openBarcodeScanner = openBarcodeScanner;
window.closeBarcodeScanner = closeBarcodeScanner;
window.useScanResult = useScanResult;
window.scanToFoodInput = scanToFoodInput;
window.exportPantry = exportPantry;
window.removeAllExpired = removeAllExpired;
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.previewCSV = previewCSV;
window.importCSV = importCSV;
window.addSpreadsheetRow = addSpreadsheetRow;
window.saveSpreadsheetRow = saveSpreadsheetRow;
window.deleteSpreadsheetRow = deleteSpreadsheetRow;
window.saveAllChanges = saveAllChanges;
window.markRowModified = markRowModified;
window.selectExistingFood = selectExistingFood;

// ============================================
// QR CODE GENERATION WITH FULL DATA
// ============================================

/**
 * Generate QR code data URL for a pantry item with full embedded metadata
 * @param {Object} item - Pantry item data
 * @returns {Promise<string>} QR code as data URL
 */
async function generateItemQRCode(item) {
    if (!item || !item.id) {
        console.error('[Pantry] Cannot generate QR for invalid item');
        return null;
    }

    // Build full item data for QR
    const qrItemData = {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        location: item.location_name,
        location_id: item.location_id,
        expiration_date: item.expiration_date,
        purchase_date: item.purchase_date,
        calories_per_unit: item.calories_per_unit,
        protein_per_unit: item.protein_per_unit,
        carbs_per_unit: item.carbs_per_unit,
        fat_per_unit: item.fat_per_unit,
        cost_per_unit: item.cost_per_unit,
        barcode: item.barcode,
        notes: item.notes,
        updated_at: item.updated_at
    };

    // Use QRData encoder if available
    let qrString;
    if (typeof QRData !== 'undefined') {
        qrString = QRData.encode(qrItemData, 'pantry');
    } else {
        // Fallback to simple JSON
        qrString = JSON.stringify({ type: 'pantry', ...qrItemData });
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
            console.error('[Pantry] QR generation error:', err);
            return null;
        }
    }

    console.warn('[Pantry] QRCode library not available');
    return null;
}

/**
 * Generate QR code for a group of pantry items
 * @param {Array} items - Array of pantry items
 * @param {string} groupName - Name of the group
 * @returns {Promise<string>} QR code as data URL
 */
async function generateGroupQRCode(items, groupName) {
    if (!items || items.length === 0) {
        console.error('[Pantry] Cannot generate group QR for empty items');
        return null;
    }

    // Build items data for QR
    const itemsData = items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        location: item.location_name,
        expiration_date: item.expiration_date,
        calories_per_unit: item.calories_per_unit
    }));

    // Use QRData encoder if available
    let qrString;
    if (typeof QRData !== 'undefined') {
        qrString = QRData.encodeGroup(itemsData, 'pantry', { name: groupName, category: items[0]?.category });
    } else {
        qrString = JSON.stringify({ type: 'pantry_group', name: groupName, items: itemsData });
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
            console.error('[Pantry] Group QR generation error:', err);
            return null;
        }
    }

    return null;
}

/**
 * Show QR code modal for a pantry item
 * @param {number} itemId - Item ID
 */
async function showItemQRCode(itemId) {
    const item = pantryItems.find(i => i.id === itemId);
    if (!item) {
        showNotification('Item not found', 'error');
        return;
    }

    const qrDataUrl = await generateItemQRCode(item);
    if (!qrDataUrl) {
        showNotification('Failed to generate QR code', 'error');
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
                    <h3 id="qr-modal-title">Item QR Code</h3>
                    <button type="button" class="modal-close" onclick="closeQRModal()">&times;</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <div id="qr-code-container"></div>
                    <div id="qr-item-info" style="margin-top: 1rem; text-align: left;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeQRModal()">Close</button>
                    <button type="button" class="btn btn-primary" onclick="printQRLabel()">Print Label</button>
                    <button type="button" class="btn btn-info" onclick="downloadQRCode()">Download</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Update content
    document.getElementById('qr-modal-title').textContent = `QR Code: ${item.name}`;
    document.getElementById('qr-code-container').innerHTML = `<img src="${qrDataUrl}" alt="QR Code" style="max-width: 200px;">`;

    // Show item info
    const totalCalories = (item.calories_per_unit || 0) * (item.quantity || 0);
    document.getElementById('qr-item-info').innerHTML = `
        <div class="qr-item-details">
            <p><strong>Name:</strong> ${escapeHtml(item.name)}</p>
            <p><strong>Quantity:</strong> ${item.quantity} ${item.unit || 'units'}</p>
            <p><strong>Category:</strong> ${escapeHtml(item.category || 'N/A')}</p>
            <p><strong>Location:</strong> ${escapeHtml(item.location_name || 'N/A')}</p>
            ${item.expiration_date ? `<p><strong>Expires:</strong> ${formatDate(item.expiration_date)}</p>` : ''}
            ${totalCalories > 0 ? `<p><strong>Total Calories:</strong> ${formatNumber(totalCalories)}</p>` : ''}
        </div>
    `;

    // Store current item for print/download
    window.currentQRItem = item;
    window.currentQRDataUrl = qrDataUrl;

    modal.classList.add('active');
}

/**
 * Show QR code for a group of items
 * @param {string} groupKey - Group key
 */
async function showGroupQRCode(groupKey) {
    const groups = groupPantryItems(pantryItems);
    const group = groups.find(g => g.key === groupKey);

    if (!group || group.items.length === 0) {
        showNotification('Group not found', 'error');
        return;
    }

    const qrDataUrl = await generateGroupQRCode(group.items, group.displayName);
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
                    <button type="button" class="modal-close" onclick="closeQRModal()">&times;</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <div id="qr-code-container"></div>
                    <div id="qr-item-info" style="margin-top: 1rem; text-align: left;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeQRModal()">Close</button>
                    <button type="button" class="btn btn-primary" onclick="printQRLabel()">Print Label</button>
                    <button type="button" class="btn btn-info" onclick="downloadQRCode()">Download</button>
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
            <p><strong>Total Calories:</strong> ${formatNumber(Math.round(group.totalCalories))}</p>
            <p><strong>Locations:</strong> ${[...group.locations].join(', ') || 'N/A'}</p>
        </div>
    `;

    // Store for print/download
    window.currentQRItem = { name: group.displayName, isGroup: true, items: group.items };
    window.currentQRDataUrl = qrDataUrl;

    modal.classList.add('active');
}

/**
 * Close QR code modal
 */
function closeQRModal() {
    const modal = document.getElementById('qr-code-modal');
    if (modal) {
        modal.classList.remove('active');
    }
    window.currentQRItem = null;
    window.currentQRDataUrl = null;
}

/**
 * Download current QR code as image
 */
function downloadQRCode() {
    if (!window.currentQRDataUrl || !window.currentQRItem) return;

    const link = document.createElement('a');
    link.download = `qr-${window.currentQRItem.name.replace(/[^a-z0-9]/gi, '_')}.png`;
    link.href = window.currentQRDataUrl;
    link.click();
}

/**
 * Print QR label with item details
 */
function printQRLabel() {
    if (!window.currentQRDataUrl || !window.currentQRItem) return;

    const item = window.currentQRItem;
    const isGroup = item.isGroup;

    // Generate print-ready label data
    let labelData;
    if (typeof QRData !== 'undefined') {
        labelData = QRData.generateLabelData(item, 'pantry', window.currentQRDataUrl);
    } else {
        labelData = {
            qrCode: window.currentQRDataUrl,
            name: item.name,
            quantity: `${item.quantity || ''} ${item.unit || ''}`,
            category: item.category || '',
            expiration: item.expiration_date || '',
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
                    ${labelData.quantity ? `<p><strong>Qty:</strong> ${labelData.quantity}</p>` : ''}
                    ${labelData.category ? `<p><strong>Category:</strong> ${escapeHtml(labelData.category)}</p>` : ''}
                    ${labelData.expiration ? `<p><strong>Expires:</strong> ${labelData.expiration}</p>` : ''}
                </div>
                <div class="label-date">Printed: ${labelData.printDate}</div>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Export QR functions
window.generateItemQRCode = generateItemQRCode;
window.generateGroupQRCode = generateGroupQRCode;
window.showItemQRCode = showItemQRCode;
window.showGroupQRCode = showGroupQRCode;
window.closeQRModal = closeQRModal;
window.downloadQRCode = downloadQRCode;
window.printQRLabel = printQRLabel;

// Dashboard functionality - Overview Only
// This dashboard shows graphs and summaries only.
// Full inventory management is done in inventory.html

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Check if token exists (faster check)
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

    await loadDashboard();
    setupEventListeners();
});

async function loadDashboard() {
    try {
        await Promise.all([
            loadInventoryStats(),
            loadInventoryOverview(),
            loadPantryOverview(),
            loadSystemInfo()
        ]);
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

async function loadInventoryStats() {
    const response = await spsApi.getInventoryStats();
    const stats = response.stats;

    document.getElementById('total-items').textContent = stats.total_items || '0';
    document.getElementById('expiring-soon').textContent = stats.expiring_soon || '0';
    document.getElementById('low-stock').textContent = stats.low_stock || '0';
    document.getElementById('total-value').textContent = stats.total_value
        ? `$${parseFloat(stats.total_value).toFixed(2)}`
        : '$0';
}

// ============================================
// INVENTORY OVERVIEW (Charts & Summaries Only)
// ============================================

let inventoryChart = null;

async function loadInventoryOverview() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Fetch all inventory items for chart
        const response = await spsApi.getInventory({ limit: 1000 });
        const items = response.items || [];

        renderInventoryCategoryChart(items);
        renderAttentionList(items);
    } catch (error) {
        console.error('Failed to load inventory overview:', error);
    }
}

function renderInventoryCategoryChart(items) {
    const canvas = document.getElementById('inventory-category-chart');
    if (!canvas) return;

    // Group by category
    const categoryTotals = {};
    items.forEach(item => {
        const cat = item.category_name || 'Uncategorized';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + 1;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    const colors = [
        '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6',
        '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#84cc16'
    ];

    if (inventoryChart) {
        inventoryChart.destroy();
    }

    if (labels.length === 0) {
        canvas.parentElement.innerHTML = '<p class="empty-text">No inventory items yet</p>';
        return;
    }

    inventoryChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary') || '#fff',
                        padding: 10,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function renderAttentionList(items) {
    const container = document.getElementById('inventory-attention-list');
    if (!container) return;

    // Find items that need attention (expiring soon or low stock)
    const attentionItems = items.filter(item => {
        const isLowStock = item.min_quantity && parseFloat(item.quantity) <= parseFloat(item.min_quantity);
        const isExpiring = item.expiration_date && isExpiringSoon(item.expiration_date);
        return isLowStock || isExpiring;
    }).slice(0, 5); // Limit to 5 items

    if (attentionItems.length === 0) {
        container.innerHTML = '<p class="empty-text">All items are well stocked!</p>';
        return;
    }

    container.innerHTML = attentionItems.map(item => {
        const isLowStock = item.min_quantity && parseFloat(item.quantity) <= parseFloat(item.min_quantity);
        const isExpiring = item.expiration_date && isExpiringSoon(item.expiration_date);

        let alertType = '';
        let alertText = '';

        if (isExpiring && isLowStock) {
            alertType = 'urgent';
            alertText = 'Low stock & Expiring';
        } else if (isLowStock) {
            alertType = 'warning';
            alertText = 'Low stock';
        } else {
            alertType = 'expiring';
            alertText = 'Expiring soon';
        }

        return `
            <div class="attention-item ${alertType}">
                <div class="attention-item-info">
                    <span class="attention-item-name">${escapeHtml(item.name)}</span>
                    <span class="attention-item-detail">${parseFloat(item.quantity)} ${escapeHtml(item.unit || 'units')}</span>
                </div>
                <span class="attention-badge ${alertType}">${alertText}</span>
            </div>
        `;
    }).join('');
}

function setupEventListeners() {
    // Dashboard is now overview-only, no inventory management controls needed
    // Auto-refresh dashboard data every 60 seconds
    setInterval(refreshDashboardData, 60000);
}

// Refresh all dashboard data (for auto-update)
async function refreshDashboardData() {
    try {
        await Promise.all([
            loadInventoryStats(),
            loadInventoryOverview(),
            loadPantryOverview(),
            loadSystemInfo()
        ]);
    } catch (error) {
        console.error('Failed to refresh dashboard:', error);
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function isExpiringSoon(dateString) {
    const expDate = new Date(dateString);
    const now = new Date();
    const daysUntilExpiration = (expDate - now) / (1000 * 60 * 60 * 24);
    return daysUntilExpiration <= 30 && daysUntilExpiration >= 0;
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

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// ============================================
// PANTRY OVERVIEW
// ============================================

let pantryData = [];
let pantryCharts = { category: null, macros: null };

async function loadPantryOverview() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Fetch pantry stats
        const statsResponse = await fetch('/api/pantry/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (statsResponse.ok) {
            const stats = await statsResponse.json();
            updatePantryStats(stats);
        }

        // Fetch pantry items for charts
        const itemsResponse = await fetch('/api/pantry/items?limit=500', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (itemsResponse.ok) {
            const data = await itemsResponse.json();
            pantryData = data.items || [];
            renderPantryCharts();
        }

        // Fetch expiring items
        const expiringResponse = await fetch('/api/pantry/expiring?days=30&limit=5', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (expiringResponse.ok) {
            const data = await expiringResponse.json();
            renderExpiringItems(data.items || []);
        }

    } catch (error) {
        console.error('Failed to load pantry overview:', error);
    }
}

function updatePantryStats(data) {
    // API returns { stats: {...}, days_of_supply: {...}, by_category: [...] }
    const stats = data.stats || data;
    const daysOfSupply = data.days_of_supply;

    document.getElementById('pantry-total-items').textContent = stats.total_items || 0;
    document.getElementById('pantry-total-calories').textContent = formatNumber(Math.round(stats.total_calories) || 0);

    // days_of_supply is an object with estimated_days_supply property
    let supplyDays = 0;
    if (daysOfSupply) {
        // Try different possible property names
        supplyDays = Math.round(
            daysOfSupply.estimated_days_supply ||
            daysOfSupply.days_of_food_supply ||
            daysOfSupply.days ||
            0
        );
    } else if (typeof data.days_of_supply === 'number') {
        supplyDays = data.days_of_supply;
    }
    document.getElementById('pantry-days-supply').innerHTML = formatDaysOfSupply(supplyDays);

    // Update expiring counts for 7, 30, 90 days
    document.getElementById('pantry-expiring-7').textContent = stats.expiring_7_days || 0;
    document.getElementById('pantry-expiring-30').textContent = stats.expiring_30_days || 0;
    document.getElementById('pantry-expiring-90').textContent = stats.expiring_90_days || 0;
}

function renderPantryCharts() {
    renderCategoryChart();
    renderMacrosChart();
}

function renderCategoryChart() {
    const canvas = document.getElementById('pantry-category-chart');
    if (!canvas) return;

    // Group by category
    const categoryTotals = {};
    pantryData.forEach(item => {
        const cat = item.category || 'Uncategorized';
        const calories = (item.calories_per_unit || 0) * (item.quantity || 0);
        categoryTotals[cat] = (categoryTotals[cat] || 0) + calories;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    const colors = [
        '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6',
        '#f97316', '#ec4899', '#14b8a6', '#6366f1', '#84cc16'
    ];

    if (pantryCharts.category) {
        pantryCharts.category.destroy();
    }

    pantryCharts.category = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary') || '#fff',
                        padding: 10,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

function renderMacrosChart() {
    const canvas = document.getElementById('pantry-macros-chart');
    if (!canvas) return;

    // Calculate totals - use protein_per_unit, carbs_per_unit, fat_per_unit from API
    let totalProtein = 0, totalCarbs = 0, totalFat = 0;
    pantryData.forEach(item => {
        const qty = item.quantity || 0;
        totalProtein += (item.protein_per_unit || 0) * qty;
        totalCarbs += (item.carbs_per_unit || 0) * qty;
        totalFat += (item.fat_per_unit || 0) * qty;
    });

    if (pantryCharts.macros) {
        pantryCharts.macros.destroy();
    }

    pantryCharts.macros = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['Protein', 'Carbs', 'Fat'],
            datasets: [{
                data: [totalProtein, totalCarbs, totalFat],
                backgroundColor: ['#22c55e', '#3b82f6', '#eab308'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-secondary') || '#9ca3af',
                        callback: v => v + 'g'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: getComputedStyle(document.body).getPropertyValue('--text-primary') || '#fff'
                    }
                }
            }
        }
    });
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

function renderExpiringItems(items) {
    const container = document.getElementById('dashboard-expiring-list');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = '<p class="empty-text">No items expiring soon</p>';
        return;
    }

    container.innerHTML = items.map(item => {
        const expDate = new Date(item.expiration_date);
        const isExpired = expDate < new Date();
        const daysText = isExpired ? 'EXPIRED' : formatDate(item.expiration_date);

        return `
            <div class="expiring-item ${isExpired ? 'expired' : ''}">
                <div class="expiring-item-info">
                    <span class="expiring-item-name">${escapeHtml(item.name)}</span>
                    <span class="expiring-item-qty">${item.quantity} ${escapeHtml(item.unit || 'units')}</span>
                </div>
                <span class="expiring-item-date">${daysText}</span>
            </div>
        `;
    }).join('');
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================
// SYSTEM MONITORING
// ============================================

async function loadSystemInfo() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/system/info', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch system info');
        }

        const result = await response.json();
        if (result.success) {
            updateSystemDisplay(result.data);
        }
    } catch (error) {
        console.error('Failed to load system info:', error);
        // Don't show error notification - system monitoring is optional
    }
}

function updateSystemDisplay(data) {
    // CPU
    const cpuPercent = document.getElementById('cpu-percent');
    const cpuBar = document.getElementById('cpu-bar');
    if (cpuPercent && cpuBar) {
        cpuPercent.textContent = `${Math.round(data.cpu.percent)}%`;
        cpuBar.style.width = `${Math.min(100, data.cpu.percent)}%`;
        cpuBar.className = 'progress-fill' + getProgressClass(data.cpu.percent);
    }

    // Memory
    const memPercent = document.getElementById('memory-percent');
    const memBar = document.getElementById('memory-bar');
    if (memPercent && memBar) {
        memPercent.textContent = `${data.memory.percent}%`;
        memBar.style.width = `${data.memory.percent}%`;
        memBar.className = 'progress-fill' + getProgressClass(data.memory.percent);

        // Update memory details
        const memUsed = document.getElementById('memory-used');
        const memTotal = document.getElementById('memory-total');
        if (memUsed) memUsed.textContent = formatBytes(data.memory.used);
        if (memTotal) memTotal.textContent = formatBytes(data.memory.total);
    }

    // Disk
    const diskPercent = document.getElementById('disk-percent');
    const diskBar = document.getElementById('disk-bar');
    if (diskPercent && diskBar) {
        diskPercent.textContent = `${data.disk.percent}%`;
        diskBar.style.width = `${data.disk.percent}%`;
        diskBar.className = 'progress-fill' + getProgressClass(data.disk.percent);

        // Update disk details
        const diskUsed = document.getElementById('disk-used');
        const diskFree = document.getElementById('disk-free');
        if (diskUsed) diskUsed.textContent = formatBytes(data.disk.used);
        if (diskFree) diskFree.textContent = formatBytes(data.disk.available);
    }

    // Uptime
    const uptimeEl = document.getElementById('system-uptime');
    if (uptimeEl) {
        uptimeEl.textContent = data.uptime.formatted;
    }

    // Hostname
    const hostnameEl = document.getElementById('system-hostname');
    if (hostnameEl) {
        hostnameEl.textContent = data.hostname;
    }

    // Load Average
    const loadEl = document.getElementById('load-average');
    if (loadEl && data.cpu.loadAvg) {
        loadEl.textContent = data.cpu.loadAvg.join(' / ');
    }

    // PM2 Processes
    renderPM2Processes(data.pm2 || []);
}

function getProgressClass(percent) {
    if (percent >= 90) return ' critical';
    if (percent >= 70) return ' warning';
    return '';
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function renderPM2Processes(processes) {
    const container = document.getElementById('pm2-process-list');
    if (!container) return;

    if (processes.length === 0) {
        container.innerHTML = '<p class="empty-text">No PM2 processes running</p>';
        return;
    }

    container.innerHTML = processes.map(proc => {
        const statusClass = proc.status === 'online' ? 'online' :
                           proc.status === 'stopped' ? 'stopped' : 'error';
        const uptimeStr = formatProcessUptime(proc.uptime);

        return `
            <div class="process-item ${statusClass}">
                <div class="process-info">
                    <span class="process-name">${escapeHtml(proc.name)}</span>
                    <span class="process-status ${statusClass}">${proc.status}</span>
                </div>
                <div class="process-stats">
                    <span class="process-stat">
                        <span class="stat-label">CPU</span>
                        <span class="stat-value">${proc.cpu.toFixed(1)}%</span>
                    </span>
                    <span class="process-stat">
                        <span class="stat-label">Mem</span>
                        <span class="stat-value">${formatBytes(proc.memory)}</span>
                    </span>
                    <span class="process-stat">
                        <span class="stat-label">Up</span>
                        <span class="stat-value">${uptimeStr}</span>
                    </span>
                    <span class="process-stat">
                        <span class="stat-label">Rst</span>
                        <span class="stat-value">${proc.restarts}</span>
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function formatProcessUptime(ms) {
    if (!ms || ms <= 0) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

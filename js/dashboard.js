// Dashboard functionality

let categories = [];
let inventory = [];

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
            loadCategories(),
            loadInventoryStats(),
            loadInventory()
        ]);
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

async function loadCategories() {
    const response = await spsApi.getCategories();
    categories = response.categories;

    // Populate category filters
    const categorySelect = document.getElementById('item-category');
    const filterSelect = document.getElementById('filter-category');

    categories.forEach(cat => {
        const option = new Option(cat.name, cat.id);
        categorySelect.add(option.cloneNode(true));
        filterSelect.add(option);
    });
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

async function loadInventory(filters = {}) {
    const response = await spsApi.getInventory(filters);
    inventory = response.items;
    renderInventory(inventory);
}

function renderInventory(items) {
    const container = document.getElementById('inventory-list');

    if (items.length === 0) {
        container.innerHTML = '<div class="empty-state">No inventory items found. Add your first item to get started!</div>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="inventory-card">
            <div class="inventory-card-header">
                <h3>${escapeHtml(item.name)}</h3>
                <span class="category-badge">${escapeHtml(item.category_name || 'Uncategorized')}</span>
            </div>
            <div class="inventory-card-body">
                <div class="inventory-detail">
                    <span class="label">Quantity:</span>
                    <span class="value">${parseFloat(item.quantity)} ${escapeHtml(item.unit || '')}</span>
                </div>
                ${item.location ? `
                <div class="inventory-detail">
                    <span class="label">Location:</span>
                    <span class="value">${escapeHtml(item.location)}</span>
                </div>
                ` : ''}
                ${item.expiration_date ? `
                <div class="inventory-detail">
                    <span class="label">Expires:</span>
                    <span class="value ${isExpiringSoon(item.expiration_date) ? 'text-warning' : ''}">${formatDate(item.expiration_date)}</span>
                </div>
                ` : ''}
                ${item.min_quantity && parseFloat(item.quantity) <= parseFloat(item.min_quantity) ? `
                <div class="inventory-alert">
                    ⚠️ Low stock alert
                </div>
                ` : ''}
            </div>
            <div class="inventory-card-actions">
                <button onclick="editItem(${item.id})" class="btn btn-sm btn-secondary">Edit</button>
                <button onclick="deleteItem(${item.id})" class="btn btn-sm btn-danger">Delete</button>
            </div>
        </div>
    `).join('');
}

function setupEventListeners() {
    // Search and filters
    const searchInput = document.getElementById('search-inventory');
    const categoryFilter = document.getElementById('filter-category');
    const expiringFilter = document.getElementById('filter-expiring');
    const lowStockFilter = document.getElementById('filter-low-stock');

    const applyFilters = () => {
        const filters = {};

        const searchTerm = searchInput.value.trim();
        if (searchTerm) filters.search = searchTerm;

        const categoryId = categoryFilter.value;
        if (categoryId) filters.category_id = categoryId;

        if (expiringFilter.checked) filters.expiring_soon = 'true';
        if (lowStockFilter.checked) filters.low_stock = 'true';

        loadInventory(filters);
    };

    searchInput.addEventListener('input', debounce(applyFilters, 300));
    categoryFilter.addEventListener('change', applyFilters);
    expiringFilter.addEventListener('change', applyFilters);
    lowStockFilter.addEventListener('change', applyFilters);

    // Item form submission
    const itemForm = document.getElementById('item-form');
    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveItem();
    });
}

function showAddItemModal() {
    document.getElementById('item-modal-title').textContent = 'Add Inventory Item';
    document.getElementById('item-form').reset();
    document.getElementById('item-id').value = '';
    document.getElementById('item-modal').style.display = 'block';
}

async function editItem(id) {
    try {
        const response = await spsApi.getInventoryItem(id);
        const item = response.item;

        document.getElementById('item-modal-title').textContent = 'Edit Inventory Item';
        document.getElementById('item-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-category').value = item.category_id || '';
        document.getElementById('item-quantity').value = parseFloat(item.quantity);
        document.getElementById('item-unit').value = item.unit || '';
        document.getElementById('item-location').value = item.location || '';
        document.getElementById('item-expiration').value = item.expiration_date ? item.expiration_date.split('T')[0] : '';
        document.getElementById('item-min-quantity').value = item.min_quantity ? parseFloat(item.min_quantity) : '';
        document.getElementById('item-description').value = item.description || '';

        document.getElementById('item-modal').style.display = 'block';
    } catch (error) {
        showNotification('Failed to load item details', 'error');
    }
}

async function saveItem() {
    const itemId = document.getElementById('item-id').value;
    const itemData = {
        name: document.getElementById('item-name').value,
        category_id: document.getElementById('item-category').value || null,
        quantity: parseFloat(document.getElementById('item-quantity').value),
        unit: document.getElementById('item-unit').value || null,
        location: document.getElementById('item-location').value || null,
        expiration_date: document.getElementById('item-expiration').value || null,
        min_quantity: document.getElementById('item-min-quantity').value ? parseFloat(document.getElementById('item-min-quantity').value) : null,
        description: document.getElementById('item-description').value || null
    };

    try {
        if (itemId) {
            await spsApi.updateInventoryItem(itemId, itemData);
            showNotification('Item updated successfully', 'success');
        } else {
            await spsApi.createInventoryItem(itemData);
            showNotification('Item added successfully', 'success');
        }

        closeItemModal();
        await loadInventoryStats();
        await loadInventory();
    } catch (error) {
        showNotification('Failed to save item: ' + error.message, 'error');
    }
}

async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }

    try {
        await spsApi.deleteInventoryItem(id);
        showNotification('Item deleted successfully', 'success');
        await loadInventoryStats();
        await loadInventory();
    } catch (error) {
        showNotification('Failed to delete item: ' + error.message, 'error');
    }
}

function closeItemModal() {
    document.getElementById('item-modal').style.display = 'none';
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

/**
 * SPS Garden & Production Module Frontend
 * Handles gardens, plants, logbook, harvests, environment data, and PDF export
 */

// Global state
let gardens = [];
let plants = [];
let plantGuides = [];
let currentGarden = null;
let tempChart = null;
let humidityChart = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Setup tab handlers
    setupTabs();
    setupGuideTabs();
    setupDetailTabs();

    // Load initial data
    await loadGardens();
    await loadPlantGuides();
    await loadPlants();
    await loadLogs();
    await loadHarvests();
    await loadEnvironment();

    // Populate filter dropdowns
    populateGardenFilters();

    // Set default dates
    document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('harvest-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('env-timestamp').value = new Date().toISOString().slice(0, 16);
});

// =====================================================
// TAB HANDLING
// =====================================================

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
}

function setupGuideTabs() {
    document.querySelectorAll('.guide-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.guide-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.guide-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`guide-tab-${btn.dataset.guideTab}`).classList.add('active');
        });
    });
}

function setupDetailTabs() {
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`detail-${btn.dataset.detailTab}`).classList.add('active');
        });
    });
}

// =====================================================
// GARDENS
// =====================================================

async function loadGardens() {
    try {
        const response = await apiClient.get('/garden/gardens');
        if (response.success) {
            gardens = response.gardens;
            renderGardens();
            updateStats();
        }
    } catch (error) {
        console.error('Failed to load gardens:', error);
        showToast('Failed to load gardens', 'error');
    }
}

function renderGardens() {
    const container = document.getElementById('gardens-list');
    if (gardens.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No gardens yet. Create your first garden to get started!</p>
                <button class="btn btn-primary" onclick="openGardenModal()">Create Garden</button>
            </div>
        `;
        return;
    }

    container.innerHTML = gardens.map(g => `
        <div class="garden-card" onclick="viewGarden(${g.id})">
            <div class="garden-card-header">
                <h3>${escapeHtml(g.name)}</h3>
                <span class="garden-type-badge">${g.garden_type || 'outdoor'}</span>
            </div>
            <div class="garden-card-stats">
                <div class="garden-stat">
                    <span class="garden-stat-value">${g.plant_count || 0}</span>
                    <span class="garden-stat-label">Plants</span>
                </div>
                <div class="garden-stat">
                    <span class="garden-stat-value">${g.bed_count || 0}</span>
                    <span class="garden-stat-label">Beds</span>
                </div>
                <div class="garden-stat">
                    <span class="garden-stat-value">${formatWeight(g.total_harvest_grams)}</span>
                    <span class="garden-stat-label">Harvested</span>
                </div>
            </div>
            ${g.total_area_sqft ? `<div class="garden-area">${g.total_area_sqft} sq ft</div>` : ''}
            ${g.usda_zone ? `<div class="garden-zone">Zone ${g.usda_zone}</div>` : ''}
            <div class="garden-card-actions">
                <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); editGarden(${g.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteGarden(${g.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function openGardenModal(garden = null) {
    const modal = document.getElementById('garden-modal');
    const title = document.getElementById('garden-modal-title');
    const form = document.getElementById('garden-form');

    form.reset();
    document.getElementById('garden-id').value = '';

    if (garden) {
        title.textContent = 'Edit Garden';
        document.getElementById('garden-id').value = garden.id;
        document.getElementById('garden-name').value = garden.name || '';
        document.getElementById('garden-type').value = garden.garden_type || 'outdoor';
        document.getElementById('garden-area').value = garden.total_area_sqft || '';
        document.getElementById('garden-zone').value = garden.usda_zone || '';
        document.getElementById('garden-last-frost').value = garden.last_frost_date || '';
        document.getElementById('garden-first-frost').value = garden.first_frost_date || '';
        document.getElementById('garden-hemisphere').value = garden.hemisphere || 'northern';
        document.getElementById('garden-irrigation').value = garden.irrigation_type || '';
        document.getElementById('garden-location').value = garden.location_description || '';
        document.getElementById('garden-description').value = garden.description || '';
    } else {
        title.textContent = 'New Garden';
    }

    modal.classList.add('active');
}

function closeGardenModal() {
    document.getElementById('garden-modal').classList.remove('active');
}

async function saveGarden(event) {
    event.preventDefault();

    const id = document.getElementById('garden-id').value;
    const data = {
        name: document.getElementById('garden-name').value,
        garden_type: document.getElementById('garden-type').value,
        total_area_sqft: parseFloat(document.getElementById('garden-area').value) || null,
        usda_zone: document.getElementById('garden-zone').value || null,
        last_frost_date: document.getElementById('garden-last-frost').value || null,
        first_frost_date: document.getElementById('garden-first-frost').value || null,
        hemisphere: document.getElementById('garden-hemisphere').value,
        irrigation_type: document.getElementById('garden-irrigation').value || null,
        location_description: document.getElementById('garden-location').value || null,
        description: document.getElementById('garden-description').value || null
    };

    try {
        let response;
        if (id) {
            response = await apiClient.put(`/garden/gardens/${id}`, data);
        } else {
            response = await apiClient.post('/garden/gardens', data);
        }

        if (response.success) {
            closeGardenModal();
            await loadGardens();
            populateGardenFilters();
            showToast('Garden saved successfully');
        }
    } catch (error) {
        console.error('Save garden error:', error);
        showToast('Failed to save garden', 'error');
    }
}

async function editGarden(id) {
    const garden = gardens.find(g => g.id === id);
    if (garden) {
        openGardenModal(garden);
    }
}

async function deleteGarden(id) {
    if (!confirm('Delete this garden? All associated plants, logs, and harvests will also be deleted.')) {
        return;
    }

    try {
        const response = await apiClient.delete(`/garden/gardens/${id}`);
        if (response.success) {
            await loadGardens();
            populateGardenFilters();
            showToast('Garden deleted');
        }
    } catch (error) {
        console.error('Delete garden error:', error);
        showToast('Failed to delete garden', 'error');
    }
}

async function viewGarden(id) {
    try {
        const response = await apiClient.get(`/garden/gardens/${id}`);
        if (response.success) {
            currentGarden = response.garden;
            showGardenDetail(response);
        }
    } catch (error) {
        console.error('View garden error:', error);
        showToast('Failed to load garden details', 'error');
    }
}

function showGardenDetail(data) {
    const modal = document.getElementById('garden-detail-modal');
    const title = document.getElementById('garden-detail-title');
    const { garden, beds, plants: gardenPlants, logs } = data;

    title.textContent = garden.name;

    // Overview tab
    document.getElementById('detail-overview').innerHTML = `
        <div class="garden-overview">
            <div class="overview-info">
                <div class="info-row"><span class="label">Type:</span> <span>${garden.garden_type || 'Outdoor'}</span></div>
                <div class="info-row"><span class="label">Area:</span> <span>${garden.total_area_sqft || 'N/A'} sq ft</span></div>
                <div class="info-row"><span class="label">Zone:</span> <span>${garden.usda_zone || 'N/A'}</span></div>
                <div class="info-row"><span class="label">Location:</span> <span>${garden.location_description || 'N/A'}</span></div>
                <div class="info-row"><span class="label">Last Frost:</span> <span>${garden.last_frost_date || 'N/A'}</span></div>
                <div class="info-row"><span class="label">First Frost:</span> <span>${garden.first_frost_date || 'N/A'}</span></div>
                <div class="info-row"><span class="label">Irrigation:</span> <span>${garden.irrigation_type || 'Manual'}</span></div>
            </div>
            ${garden.description ? `<div class="overview-description">${escapeHtml(garden.description)}</div>` : ''}
        </div>
    `;

    // Beds tab
    document.getElementById('bed-garden-id').value = garden.id;
    document.getElementById('garden-beds-list').innerHTML = beds.length === 0 ?
        '<p class="empty-text">No beds defined. Add beds to organize your garden.</p>' :
        beds.map(b => `
            <div class="bed-card">
                <h4>${escapeHtml(b.name)}</h4>
                <div class="bed-info">
                    <span>${b.bed_type || 'raised'}</span>
                    ${b.area_sqft ? `<span>${b.area_sqft} sq ft</span>` : ''}
                    <span>${b.plant_count || 0} plants</span>
                </div>
                <div class="bed-actions">
                    <button class="btn btn-xs btn-outline" onclick="editBed(${b.id})">Edit</button>
                    <button class="btn btn-xs btn-danger" onclick="deleteBed(${b.id})">Delete</button>
                </div>
            </div>
        `).join('');

    // Plants tab
    document.getElementById('garden-plants-list').innerHTML = gardenPlants.length === 0 ?
        '<p class="empty-text">No plants in this garden yet.</p>' :
        `<table class="data-table">
            <thead>
                <tr><th>Plant</th><th>Variety</th><th>Bed</th><th>Status</th><th>Planted</th></tr>
            </thead>
            <tbody>
                ${gardenPlants.map(p => `
                    <tr>
                        <td>${escapeHtml(p.plant_name)}</td>
                        <td>${p.variety || '-'}</td>
                        <td>${p.bed_name || '-'}</td>
                        <td><span class="status-badge status-${p.status}">${p.status}</span></td>
                        <td>${formatDate(p.planting_date)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;

    // Logs tab
    document.getElementById('garden-logs-list').innerHTML = logs.length === 0 ?
        '<p class="empty-text">No log entries for this garden.</p>' :
        logs.slice(0, 20).map(l => `
            <div class="log-entry">
                <div class="log-header">
                    <span class="log-date">${formatDate(l.entry_date)}</span>
                    <span class="log-action action-${l.action_type}">${l.action_type}</span>
                    ${l.plant_name ? `<span class="log-plant">${escapeHtml(l.plant_name)}</span>` : ''}
                </div>
                <div class="log-content">${escapeHtml(l.action_details || l.notes || '')}</div>
                ${l.weather_summary ? `<div class="log-weather">${l.weather_summary}</div>` : ''}
            </div>
        `).join('');

    // Stats tab - load async
    loadGardenStats(garden.id);

    // Show modal
    modal.classList.add('active');

    // Reset to overview tab
    document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.detail-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.detail-tab-btn[data-detail-tab="overview"]').classList.add('active');
    document.getElementById('detail-overview').classList.add('active');
}

async function loadGardenStats(gardenId) {
    try {
        const response = await apiClient.get(`/garden/gardens/${gardenId}/stats`);
        if (response.success) {
            const { stats } = response;
            document.getElementById('garden-stats').innerHTML = `
                <div class="stats-overview">
                    <div class="stat-item">
                        <span class="stat-value">${stats.harvests.total_kg} kg</span>
                        <span class="stat-label">Total Harvest</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${stats.harvests.total_calories.toLocaleString()}</span>
                        <span class="stat-label">Calories Produced</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${stats.harvests.harvest_count}</span>
                        <span class="stat-label">Harvest Events</span>
                    </div>
                </div>
                ${stats.top_plants.length > 0 ? `
                    <h4>Top Producing Plants</h4>
                    <ul class="top-plants-list">
                        ${stats.top_plants.map(p => `
                            <li>${escapeHtml(p.plant_name)} ${p.variety ? `(${p.variety})` : ''}: ${formatWeight(p.total_harvest)}</li>
                        `).join('')}
                    </ul>
                ` : ''}
                ${stats.environment.avg_temp_c ? `
                    <h4>Environment Summary</h4>
                    <div class="env-summary">
                        <div>Avg Temp: ${stats.environment.avg_temp_c}°C</div>
                        <div>Temp Range: ${stats.environment.min_temp_c}°C - ${stats.environment.max_temp_c}°C</div>
                        ${stats.environment.avg_humidity ? `<div>Avg Humidity: ${stats.environment.avg_humidity}%</div>` : ''}
                        ${stats.environment.total_rainfall_mm ? `<div>Total Rainfall: ${stats.environment.total_rainfall_mm}mm</div>` : ''}
                    </div>
                ` : ''}
            `;
        }
    } catch (error) {
        console.error('Load garden stats error:', error);
    }
}

function closeGardenDetailModal() {
    document.getElementById('garden-detail-modal').classList.remove('active');
    currentGarden = null;
}

// =====================================================
// BEDS
// =====================================================

function openBedModal(bed = null) {
    const modal = document.getElementById('bed-modal');
    const form = document.getElementById('bed-form');
    form.reset();
    document.getElementById('bed-id').value = bed ? bed.id : '';

    if (bed) {
        document.getElementById('bed-name').value = bed.name || '';
        document.getElementById('bed-type').value = bed.bed_type || 'raised';
        document.getElementById('bed-length').value = bed.length_ft || '';
        document.getElementById('bed-width').value = bed.width_ft || '';
        document.getElementById('bed-soil').value = bed.soil_type || '';
        document.getElementById('bed-notes').value = bed.notes || '';
    }

    modal.classList.add('active');
}

function closeBedModal() {
    document.getElementById('bed-modal').classList.remove('active');
}

async function saveBed(event) {
    event.preventDefault();

    const gardenId = document.getElementById('bed-garden-id').value;
    const bedId = document.getElementById('bed-id').value;
    const data = {
        name: document.getElementById('bed-name').value,
        bed_type: document.getElementById('bed-type').value,
        length_ft: parseFloat(document.getElementById('bed-length').value) || null,
        width_ft: parseFloat(document.getElementById('bed-width').value) || null,
        soil_type: document.getElementById('bed-soil').value || null,
        notes: document.getElementById('bed-notes').value || null
    };

    try {
        let response;
        if (bedId) {
            response = await apiClient.put(`/garden/beds/${bedId}`, data);
        } else {
            response = await apiClient.post(`/garden/gardens/${gardenId}/beds`, data);
        }

        if (response.success) {
            closeBedModal();
            viewGarden(gardenId);
            showToast('Bed saved');
        }
    } catch (error) {
        console.error('Save bed error:', error);
        showToast('Failed to save bed', 'error');
    }
}

async function editBed(id) {
    try {
        const response = await apiClient.get(`/garden/gardens/${currentGarden.id}/beds`);
        if (response.success) {
            const bed = response.beds.find(b => b.id === id);
            if (bed) openBedModal(bed);
        }
    } catch (error) {
        console.error('Edit bed error:', error);
    }
}

async function deleteBed(id) {
    if (!confirm('Delete this bed?')) return;

    try {
        const response = await apiClient.delete(`/garden/beds/${id}`);
        if (response.success) {
            viewGarden(currentGarden.id);
            showToast('Bed deleted');
        }
    } catch (error) {
        console.error('Delete bed error:', error);
        showToast('Failed to delete bed', 'error');
    }
}

// =====================================================
// PLANTS
// =====================================================

async function loadPlants() {
    try {
        const gardenId = document.getElementById('filter-garden').value;
        const status = document.getElementById('filter-status').value;

        let url = '/garden/plants?';
        if (gardenId) url += `garden_id=${gardenId}&`;
        if (status) url += `status=${status}&`;

        const response = await apiClient.get(url);
        if (response.success) {
            plants = response.plants;
            renderPlants();
        }
    } catch (error) {
        console.error('Load plants error:', error);
    }
}

function renderPlants() {
    const tbody = document.getElementById('plants-tbody');
    if (plants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-text">No plants found</td></tr>';
        return;
    }

    tbody.innerHTML = plants.map(p => `
        <tr>
            <td>
                <strong>${escapeHtml(p.plant_name)}</strong>
                ${p.variety ? `<br><small>${escapeHtml(p.variety)}</small>` : ''}
            </td>
            <td>${p.garden_name || '-'}</td>
            <td>${p.bed_name || '-'}</td>
            <td>${formatDate(p.planting_date)}</td>
            <td><span class="status-badge status-${p.status}">${p.status}</span></td>
            <td>${formatDate(p.expected_harvest_date)}</td>
            <td>
                <button class="btn btn-xs btn-outline" onclick="viewPlant(${p.id})">View</button>
                <button class="btn btn-xs btn-outline" onclick="editPlant(${p.id})">Edit</button>
                <button class="btn btn-xs btn-danger" onclick="deletePlant(${p.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openPlantModal(plant = null) {
    const modal = document.getElementById('plant-modal');
    const form = document.getElementById('plant-form');
    form.reset();
    document.getElementById('plant-id').value = '';

    // Populate garden dropdown
    const gardenSelect = document.getElementById('plant-garden');
    gardenSelect.innerHTML = '<option value="">Select Garden</option>' +
        gardens.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

    // Populate guide dropdown
    const guideSelect = document.getElementById('plant-guide');
    guideSelect.innerHTML = '<option value="">Select plant guide...</option>' +
        plantGuides.map(g => `<option value="${g.id}">${escapeHtml(g.common_name)}${g.variety_name ? ` - ${g.variety_name}` : ''}</option>`).join('');

    if (plant) {
        document.getElementById('plant-modal-title').textContent = 'Edit Plant';
        document.getElementById('plant-id').value = plant.id;
        document.getElementById('plant-garden').value = plant.garden_id;
        loadBedsForGarden(plant.garden_id).then(() => {
            document.getElementById('plant-bed').value = plant.garden_bed_id || '';
        });
        document.getElementById('plant-guide').value = plant.plant_guide_id || '';
        document.getElementById('plant-name').value = plant.plant_name;
        document.getElementById('plant-variety').value = plant.variety || '';
        document.getElementById('plant-quantity').value = plant.quantity || 1;
        document.getElementById('plant-area').value = plant.area_sqft || '';
        document.getElementById('plant-method').value = plant.planting_method || 'direct_sow';
        document.getElementById('plant-seed-start').value = formatDateForInput(plant.seed_start_date);
        document.getElementById('plant-transplant-date').value = formatDateForInput(plant.transplant_date);
        document.getElementById('plant-direct-sow').value = formatDateForInput(plant.direct_sow_date);
        document.getElementById('plant-date').value = formatDateForInput(plant.planting_date);
        document.getElementById('plant-source').value = plant.seed_source || '';
        document.getElementById('plant-organic').checked = plant.is_organic;
        document.getElementById('plant-heirloom').checked = plant.is_heirloom;
        document.getElementById('plant-notes').value = plant.notes || '';
    } else {
        document.getElementById('plant-modal-title').textContent = 'Add Plant';
        document.getElementById('plant-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
}

function closePlantModal() {
    document.getElementById('plant-modal').classList.remove('active');
}

async function loadBedsForGarden(gardenId) {
    const bedSelect = document.getElementById('plant-bed');
    bedSelect.innerHTML = '<option value="">No specific bed</option>';

    if (!gardenId) return;

    try {
        const response = await apiClient.get(`/garden/gardens/${gardenId}/beds`);
        if (response.success && response.beds.length > 0) {
            bedSelect.innerHTML += response.beds.map(b =>
                `<option value="${b.id}">${escapeHtml(b.name)}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Load beds error:', error);
    }
}

function populateFromGuide(guideId) {
    if (!guideId) return;
    const guide = plantGuides.find(g => g.id == guideId);
    if (guide) {
        document.getElementById('plant-name').value = guide.common_name;
        if (guide.variety_name) {
            document.getElementById('plant-variety').value = guide.variety_name;
        }
    }
}

async function savePlant(event) {
    event.preventDefault();

    const id = document.getElementById('plant-id').value;
    const data = {
        garden_id: parseInt(document.getElementById('plant-garden').value),
        garden_bed_id: document.getElementById('plant-bed').value || null,
        plant_guide_id: document.getElementById('plant-guide').value || null,
        plant_name: document.getElementById('plant-name').value,
        variety: document.getElementById('plant-variety').value || null,
        quantity: parseInt(document.getElementById('plant-quantity').value) || 1,
        area_sqft: parseFloat(document.getElementById('plant-area').value) || null,
        planting_method: document.getElementById('plant-method').value,
        seed_start_date: document.getElementById('plant-seed-start').value || null,
        transplant_date: document.getElementById('plant-transplant-date').value || null,
        direct_sow_date: document.getElementById('plant-direct-sow').value || null,
        planting_date: document.getElementById('plant-date').value,
        seed_source: document.getElementById('plant-source').value || null,
        is_organic: document.getElementById('plant-organic').checked,
        is_heirloom: document.getElementById('plant-heirloom').checked,
        notes: document.getElementById('plant-notes').value || null
    };

    try {
        let response;
        if (id) {
            response = await apiClient.put(`/garden/plants/${id}`, data);
        } else {
            response = await apiClient.post('/garden/plants', data);
        }

        if (response.success) {
            closePlantModal();
            await loadPlants();
            await loadGardens();
            updateStats();
            showToast('Plant saved');
        }
    } catch (error) {
        console.error('Save plant error:', error);
        showToast('Failed to save plant', 'error');
    }
}

async function viewPlant(id) {
    try {
        const response = await apiClient.get(`/garden/plants/${id}`);
        if (response.success) {
            // Show plant detail in an alert or modal
            const p = response.plant;
            alert(`${p.plant_name} ${p.variety ? `(${p.variety})` : ''}
Status: ${p.status}
Planted: ${formatDate(p.planting_date)}
Expected Harvest: ${formatDate(p.expected_harvest_date)}
Harvests: ${response.harvests.length}
Logs: ${response.logs.length}`);
        }
    } catch (error) {
        console.error('View plant error:', error);
    }
}

async function editPlant(id) {
    try {
        const response = await apiClient.get(`/garden/plants/${id}`);
        if (response.success) {
            openPlantModal(response.plant);
        }
    } catch (error) {
        console.error('Edit plant error:', error);
    }
}

async function deletePlant(id) {
    if (!confirm('Delete this plant?')) return;

    try {
        const response = await apiClient.delete(`/garden/plants/${id}`);
        if (response.success) {
            await loadPlants();
            await loadGardens();
            updateStats();
            showToast('Plant deleted');
        }
    } catch (error) {
        console.error('Delete plant error:', error);
        showToast('Failed to delete plant', 'error');
    }
}

// =====================================================
// PLANT GUIDES
// =====================================================

async function loadPlantGuides() {
    try {
        const category = document.getElementById('guide-category')?.value || '';
        const response = await apiClient.get(`/garden/plant-guides?category=${category}`);
        if (response.success) {
            plantGuides = response.guides;
            renderPlantGuides();
        }
    } catch (error) {
        console.error('Load plant guides error:', error);
    }
}

function searchPlantGuides() {
    const search = document.getElementById('guide-search').value.toLowerCase();
    const filtered = plantGuides.filter(g =>
        g.common_name.toLowerCase().includes(search) ||
        (g.latin_name && g.latin_name.toLowerCase().includes(search)) ||
        (g.variety_name && g.variety_name.toLowerCase().includes(search))
    );
    renderPlantGuides(filtered);
}

function renderPlantGuides(guides = plantGuides) {
    const container = document.getElementById('guides-list');
    if (guides.length === 0) {
        container.innerHTML = '<p class="empty-text">No plant guides found</p>';
        return;
    }

    container.innerHTML = guides.map(g => `
        <div class="guide-card ${g.source_type === 'builtin' ? 'builtin' : 'user'}" onclick="viewGuide(${g.id})">
            <div class="guide-card-header">
                <h4>${escapeHtml(g.common_name)}</h4>
                ${g.latin_name ? `<span class="latin-name">${escapeHtml(g.latin_name)}</span>` : ''}
            </div>
            ${g.variety_name ? `<div class="guide-variety">${escapeHtml(g.variety_name)}</div>` : ''}
            <div class="guide-info">
                <span class="guide-category">${g.category || 'other'}</span>
                ${g.days_to_maturity_min ? `<span>${g.days_to_maturity_min}-${g.days_to_maturity_max || g.days_to_maturity_min} days</span>` : ''}
            </div>
            <div class="guide-badge ${g.source_type}">${g.source_type === 'builtin' ? 'Built-in' : 'Custom'}</div>
        </div>
    `).join('');
}

let currentViewedGuide = null;

async function viewGuide(id) {
    try {
        const response = await apiClient.get(`/garden/plant-guides/${id}`);
        if (response.success) {
            currentViewedGuide = response.guide;
            showGuideView(response.guide);
        }
    } catch (error) {
        console.error('View guide error:', error);
    }
}

function showGuideView(guide) {
    const modal = document.getElementById('guide-view-modal');
    document.getElementById('guide-view-title').textContent = guide.common_name;

    const content = document.getElementById('guide-view-content');
    content.innerHTML = `
        <div class="guide-view-grid">
            <div class="guide-section">
                <h4>Basic Information</h4>
                <div class="info-grid">
                    <div><span class="label">Latin Name:</span> ${guide.latin_name || 'N/A'}</div>
                    <div><span class="label">Category:</span> ${guide.category || 'N/A'}</div>
                    <div><span class="label">Variety:</span> ${guide.variety_name || 'N/A'}</div>
                </div>
            </div>

            <div class="guide-section">
                <h4>Growing Requirements</h4>
                <div class="info-grid">
                    <div><span class="label">Hardiness Zones:</span> ${guide.hardiness_zones || 'N/A'}</div>
                    <div><span class="label">Sun:</span> ${guide.sun_requirements || 'N/A'}</div>
                    <div><span class="label">Water:</span> ${guide.water_requirements || 'N/A'}</div>
                    <div><span class="label">Soil:</span> ${guide.soil_type || 'N/A'}</div>
                    <div><span class="label">Soil pH:</span> ${guide.soil_ph_min && guide.soil_ph_max ? `${guide.soil_ph_min} - ${guide.soil_ph_max}` : 'N/A'}</div>
                    <div><span class="label">Spacing:</span> ${guide.plant_spacing_inches ? `${guide.plant_spacing_inches}"` : 'N/A'}</div>
                    <div><span class="label">Row Spacing:</span> ${guide.row_spacing_inches ? `${guide.row_spacing_inches}"` : 'N/A'}</div>
                    <div><span class="label">Planting Depth:</span> ${guide.planting_depth_inches ? `${guide.planting_depth_inches}"` : 'N/A'}</div>
                    <div><span class="label">Frost Tolerance:</span> ${guide.frost_tolerance || 'N/A'}</div>
                </div>
            </div>

            <div class="guide-section">
                <h4>Timing</h4>
                <div class="info-grid">
                    <div><span class="label">Start Indoors:</span> ${guide.indoor_start_weeks_before_frost ? `${guide.indoor_start_weeks_before_frost} weeks before last frost` : 'N/A'}</div>
                    <div><span class="label">Transplant:</span> ${guide.transplant_weeks_after_frost ? `${guide.transplant_weeks_after_frost} weeks after last frost` : 'N/A'}</div>
                    <div><span class="label">Direct Sow:</span> ${guide.direct_sow_weeks_after_frost ? `${guide.direct_sow_weeks_after_frost} weeks after last frost` : 'N/A'}</div>
                    <div><span class="label">Germination:</span> ${guide.germination_days_min ? `${guide.germination_days_min}-${guide.germination_days_max || guide.germination_days_min} days` : 'N/A'}</div>
                    <div><span class="label">Days to Maturity:</span> ${guide.days_to_maturity_min ? `${guide.days_to_maturity_min}-${guide.days_to_maturity_max || guide.days_to_maturity_min} days` : 'N/A'}</div>
                    <div><span class="label">Base Temp (GDD):</span> ${guide.base_temp_gdd_c ? `${guide.base_temp_gdd_c}°C` : '10°C'}</div>
                </div>
            </div>

            <div class="guide-section">
                <h4>Companions & Care</h4>
                ${guide.companion_plants ? `<div><span class="label">Companions:</span> ${escapeHtml(guide.companion_plants)}</div>` : ''}
                ${guide.antagonist_plants ? `<div><span class="label">Avoid Near:</span> ${escapeHtml(guide.antagonist_plants)}</div>` : ''}
                ${guide.common_pests ? `<div><span class="label">Common Pests:</span> ${escapeHtml(guide.common_pests)}</div>` : ''}
                ${guide.common_diseases ? `<div><span class="label">Common Diseases:</span> ${escapeHtml(guide.common_diseases)}</div>` : ''}
                ${guide.growing_tips ? `<div class="tips-block"><span class="label">Growing Tips:</span><br>${escapeHtml(guide.growing_tips)}</div>` : ''}
            </div>

            <div class="guide-section">
                <h4>Harvest & Storage</h4>
                <div class="info-grid">
                    <div><span class="label">Expected Yield:</span> ${guide.default_yield_per_sqft_grams ? `${guide.default_yield_per_sqft_grams}g/sq ft` : 'N/A'}</div>
                    <div><span class="label">Calories:</span> ${guide.default_calories_per_100g ? `${guide.default_calories_per_100g} cal/100g` : 'N/A'}</div>
                </div>
                ${guide.harvest_indicators ? `<div><span class="label">Harvest Indicators:</span> ${escapeHtml(guide.harvest_indicators)}</div>` : ''}
                ${guide.storage_notes ? `<div><span class="label">Storage:</span> ${escapeHtml(guide.storage_notes)}</div>` : ''}
                ${guide.seed_saving_notes ? `<div><span class="label">Seed Saving:</span> ${escapeHtml(guide.seed_saving_notes)}</div>` : ''}
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function closeGuideViewModal() {
    document.getElementById('guide-view-modal').classList.remove('active');
    currentViewedGuide = null;
}

async function cloneGuide() {
    if (!currentViewedGuide) return;

    try {
        const response = await apiClient.post(`/garden/plant-guides/${currentViewedGuide.id}/clone`);
        if (response.success) {
            closeGuideViewModal();
            await loadPlantGuides();
            openPlantGuideModal(response.guide);
            showToast('Guide cloned - you can now edit it');
        }
    } catch (error) {
        console.error('Clone guide error:', error);
        showToast('Failed to clone guide', 'error');
    }
}

function openPlantGuideModal(guide = null) {
    const modal = document.getElementById('guide-modal');
    const form = document.getElementById('guide-form');
    form.reset();

    // Reset to first tab
    document.querySelectorAll('.guide-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.guide-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.guide-tab-btn[data-guide-tab="basic"]').classList.add('active');
    document.getElementById('guide-tab-basic').classList.add('active');

    document.getElementById('guide-id').value = '';

    if (guide) {
        document.getElementById('guide-modal-title').textContent = 'Edit Plant Guide';
        document.getElementById('guide-id').value = guide.id;
        document.getElementById('guide-common-name').value = guide.common_name || '';
        document.getElementById('guide-latin-name').value = guide.latin_name || '';
        document.getElementById('guide-variety-name').value = guide.variety_name || '';
        document.getElementById('guide-category').value = guide.category || 'vegetable';
        document.getElementById('guide-description').value = guide.description || '';
        document.getElementById('guide-zones').value = guide.hardiness_zones || '';
        document.getElementById('guide-sun').value = guide.sun_requirements || '';
        document.getElementById('guide-water').value = guide.water_requirements || '';
        document.getElementById('guide-soil').value = guide.soil_type || '';
        document.getElementById('guide-ph-min').value = guide.soil_ph_min || '';
        document.getElementById('guide-ph-max').value = guide.soil_ph_max || '';
        document.getElementById('guide-spacing-in').value = guide.plant_spacing_inches || '';
        document.getElementById('guide-row-spacing').value = guide.row_spacing_inches || '';
        document.getElementById('guide-depth').value = guide.planting_depth_inches || '';
        document.getElementById('guide-indoor-weeks').value = guide.indoor_start_weeks_before_frost || '';
        document.getElementById('guide-transplant-weeks').value = guide.transplant_weeks_after_frost || '';
        document.getElementById('guide-direct-sow-weeks').value = guide.direct_sow_weeks_after_frost || '';
        document.getElementById('guide-germ-days-min').value = guide.germination_days_min || '';
        document.getElementById('guide-germ-days-max').value = guide.germination_days_max || '';
        document.getElementById('guide-maturity-min').value = guide.days_to_maturity_min || '';
        document.getElementById('guide-maturity-max').value = guide.days_to_maturity_max || '';
        document.getElementById('guide-base-temp').value = guide.base_temp_gdd_c || 10;
        document.getElementById('guide-frost-tolerance').value = guide.frost_tolerance || '';
        document.getElementById('guide-companions').value = guide.companion_plants || '';
        document.getElementById('guide-antagonists').value = guide.antagonist_plants || '';
        document.getElementById('guide-pests').value = guide.common_pests || '';
        document.getElementById('guide-diseases').value = guide.common_diseases || '';
        document.getElementById('guide-growing-tips').value = guide.growing_tips || '';
        document.getElementById('guide-harvest-indicators').value = guide.harvest_indicators || '';
        document.getElementById('guide-yield').value = guide.default_yield_per_sqft_grams || '';
        document.getElementById('guide-calories').value = guide.default_calories_per_100g || '';
        document.getElementById('guide-storage').value = guide.storage_notes || '';
        document.getElementById('guide-seed-saving').value = guide.seed_saving_notes || '';
    } else {
        document.getElementById('guide-modal-title').textContent = 'New Plant Guide';
    }

    modal.classList.add('active');
}

function closeGuideModal() {
    document.getElementById('guide-modal').classList.remove('active');
}

async function saveGuide(event) {
    event.preventDefault();

    const id = document.getElementById('guide-id').value;
    const data = {
        common_name: document.getElementById('guide-common-name').value,
        latin_name: document.getElementById('guide-latin-name').value || null,
        variety_name: document.getElementById('guide-variety-name').value || null,
        category: document.getElementById('guide-category').value,
        description: document.getElementById('guide-description').value || null,
        hardiness_zones: document.getElementById('guide-zones').value || null,
        sun_requirements: document.getElementById('guide-sun').value || null,
        water_requirements: document.getElementById('guide-water').value || null,
        soil_type: document.getElementById('guide-soil').value || null,
        soil_ph_min: parseFloat(document.getElementById('guide-ph-min').value) || null,
        soil_ph_max: parseFloat(document.getElementById('guide-ph-max').value) || null,
        plant_spacing_inches: parseInt(document.getElementById('guide-spacing-in').value) || null,
        row_spacing_inches: parseInt(document.getElementById('guide-row-spacing').value) || null,
        planting_depth_inches: parseFloat(document.getElementById('guide-depth').value) || null,
        indoor_start_weeks_before_frost: parseInt(document.getElementById('guide-indoor-weeks').value) || null,
        transplant_weeks_after_frost: parseInt(document.getElementById('guide-transplant-weeks').value) || null,
        direct_sow_weeks_after_frost: parseInt(document.getElementById('guide-direct-sow-weeks').value) || null,
        germination_days_min: parseInt(document.getElementById('guide-germ-days-min').value) || null,
        germination_days_max: parseInt(document.getElementById('guide-germ-days-max').value) || null,
        days_to_maturity_min: parseInt(document.getElementById('guide-maturity-min').value) || null,
        days_to_maturity_max: parseInt(document.getElementById('guide-maturity-max').value) || null,
        base_temp_gdd_c: parseFloat(document.getElementById('guide-base-temp').value) || 10,
        frost_tolerance: document.getElementById('guide-frost-tolerance').value || null,
        companion_plants: document.getElementById('guide-companions').value || null,
        antagonist_plants: document.getElementById('guide-antagonists').value || null,
        common_pests: document.getElementById('guide-pests').value || null,
        common_diseases: document.getElementById('guide-diseases').value || null,
        growing_tips: document.getElementById('guide-growing-tips').value || null,
        harvest_indicators: document.getElementById('guide-harvest-indicators').value || null,
        default_yield_per_sqft_grams: parseInt(document.getElementById('guide-yield').value) || null,
        default_calories_per_100g: parseInt(document.getElementById('guide-calories').value) || null,
        storage_notes: document.getElementById('guide-storage').value || null,
        seed_saving_notes: document.getElementById('guide-seed-saving').value || null
    };

    try {
        let response;
        if (id) {
            response = await apiClient.put(`/garden/plant-guides/${id}`, data);
        } else {
            response = await apiClient.post('/garden/plant-guides', data);
        }

        if (response.success) {
            closeGuideModal();
            await loadPlantGuides();
            showToast('Plant guide saved');
        }
    } catch (error) {
        console.error('Save guide error:', error);
        showToast('Failed to save plant guide', 'error');
    }
}

// =====================================================
// LOGBOOK
// =====================================================

async function loadLogs() {
    try {
        const gardenId = document.getElementById('log-filter-garden').value;
        const actionType = document.getElementById('log-filter-action').value;
        const startDate = document.getElementById('log-start-date').value;
        const endDate = document.getElementById('log-end-date').value;

        let url = '/garden/logs?limit=100';
        if (gardenId) url += `&garden_id=${gardenId}`;
        if (actionType) url += `&action_type=${actionType}`;
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;

        const response = await apiClient.get(url);
        if (response.success) {
            renderLogs(response.logs);
        }
    } catch (error) {
        console.error('Load logs error:', error);
    }
}

function renderLogs(logs) {
    const container = document.getElementById('logs-list');
    if (logs.length === 0) {
        container.innerHTML = '<p class="empty-text">No log entries found</p>';
        return;
    }

    container.innerHTML = logs.map(l => `
        <div class="log-entry">
            <div class="log-header">
                <span class="log-date">${formatDate(l.entry_date)} ${l.entry_time ? l.entry_time.slice(0, 5) : ''}</span>
                <span class="log-action action-${l.action_type}">${l.action_type}</span>
                ${l.garden_name ? `<span class="log-garden">${escapeHtml(l.garden_name)}</span>` : ''}
                ${l.plant_name ? `<span class="log-plant">${escapeHtml(l.plant_name)}</span>` : ''}
            </div>
            <div class="log-content">${escapeHtml(l.action_details || l.notes || '')}</div>
            ${l.weather_summary || l.temperature_c ? `
                <div class="log-weather">
                    ${l.weather_summary || ''}
                    ${l.temperature_c ? ` | ${l.temperature_c}°C` : ''}
                    ${l.humidity_percent ? ` | ${l.humidity_percent}%` : ''}
                </div>
            ` : ''}
            ${l.gdd_calculated ? `<div class="log-gdd">GDD: ${l.gdd_calculated}</div>` : ''}
            <div class="log-actions">
                <button class="btn btn-xs btn-outline" onclick="editLog(${l.id})">Edit</button>
                <button class="btn btn-xs btn-danger" onclick="deleteLog(${l.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function openLogModal() {
    const modal = document.getElementById('log-modal');
    const form = document.getElementById('log-form');
    form.reset();

    // Populate garden dropdown
    const gardenSelect = document.getElementById('log-garden');
    gardenSelect.innerHTML = '<option value="">Garden-wide entry</option>' +
        gardens.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

    document.getElementById('log-date').value = new Date().toISOString().split('T')[0];

    modal.classList.add('active');
}

function closeLogModal() {
    document.getElementById('log-modal').classList.remove('active');
}

async function loadPlantsForLog(gardenId) {
    const plantSelect = document.getElementById('log-plant');
    plantSelect.innerHTML = '<option value="">All plants / general</option>';

    if (!gardenId) return;

    try {
        const response = await apiClient.get(`/garden/gardens/${gardenId}/plants`);
        if (response.success && response.plants.length > 0) {
            plantSelect.innerHTML += response.plants.map(p =>
                `<option value="${p.id}">${escapeHtml(p.plant_name)}${p.variety ? ` (${p.variety})` : ''}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Load plants for log error:', error);
    }
}

function toggleLogFields() {
    const actionType = document.getElementById('log-action').value;

    // Hide all conditional fields
    document.querySelectorAll('.water-fields, .fertilizer-fields, .pest-fields, .disease-fields, .treatment-fields').forEach(el => {
        el.style.display = 'none';
    });

    // Show relevant fields
    if (actionType === 'watered') {
        document.querySelectorAll('.water-fields').forEach(el => el.style.display = 'block');
    } else if (actionType === 'fertilized') {
        document.querySelectorAll('.fertilizer-fields').forEach(el => el.style.display = 'block');
    } else if (actionType === 'pest_treatment') {
        document.querySelectorAll('.pest-fields, .treatment-fields').forEach(el => el.style.display = 'block');
    } else if (actionType === 'disease_treatment') {
        document.querySelectorAll('.disease-fields, .treatment-fields').forEach(el => el.style.display = 'block');
    }
}

async function saveLog(event) {
    event.preventDefault();

    const data = {
        garden_id: document.getElementById('log-garden').value || null,
        garden_plant_id: document.getElementById('log-plant').value || null,
        entry_date: document.getElementById('log-date').value,
        entry_time: document.getElementById('log-time').value || null,
        action_type: document.getElementById('log-action').value,
        weather_summary: document.getElementById('log-weather').value || null,
        temperature_c: parseFloat(document.getElementById('log-temp').value) || null,
        temperature_max_c: parseFloat(document.getElementById('log-temp-max').value) || null,
        temperature_min_c: parseFloat(document.getElementById('log-temp-min').value) || null,
        humidity_percent: parseInt(document.getElementById('log-humidity').value) || null,
        rain_mm: parseFloat(document.getElementById('log-rain').value) || null,
        water_amount_liters: parseFloat(document.getElementById('log-water-amount').value) || null,
        fertilizer_type: document.getElementById('log-fertilizer-type').value || null,
        fertilizer_amount: document.getElementById('log-fertilizer-amount').value || null,
        pest_identified: document.getElementById('log-pest').value || null,
        disease_identified: document.getElementById('log-disease').value || null,
        treatment_applied: document.getElementById('log-treatment').value || null,
        action_details: document.getElementById('log-details').value
    };

    try {
        const response = await apiClient.post('/garden/logs', data);
        if (response.success) {
            closeLogModal();
            await loadLogs();
            showToast('Log entry saved');
        }
    } catch (error) {
        console.error('Save log error:', error);
        showToast('Failed to save log entry', 'error');
    }
}

async function editLog(id) {
    // For simplicity, just delete and re-add
    showToast('Edit not implemented - delete and re-add', 'info');
}

async function deleteLog(id) {
    if (!confirm('Delete this log entry?')) return;

    try {
        const response = await apiClient.delete(`/garden/logs/${id}`);
        if (response.success) {
            await loadLogs();
            showToast('Log entry deleted');
        }
    } catch (error) {
        console.error('Delete log error:', error);
        showToast('Failed to delete log entry', 'error');
    }
}

// =====================================================
// HARVESTS
// =====================================================

async function loadHarvests() {
    try {
        const gardenId = document.getElementById('harvest-filter-garden').value;
        const startDate = document.getElementById('harvest-start-date').value;
        const endDate = document.getElementById('harvest-end-date').value;

        let url = '/garden/harvests?limit=100';
        if (gardenId) url += `&garden_id=${gardenId}`;
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;

        const response = await apiClient.get(url);
        if (response.success) {
            renderHarvests(response.harvests);
            updateStats();
        }
    } catch (error) {
        console.error('Load harvests error:', error);
    }
}

function renderHarvests(harvests) {
    // Calculate summary
    const totalGrams = harvests.reduce((sum, h) => sum + (parseFloat(h.weight_grams) || 0), 0);
    const totalCalories = harvests.reduce((sum, h) => sum + (parseInt(h.calories_total) || 0), 0);

    document.getElementById('harvest-summary').innerHTML = `
        <div class="harvest-summary-stats">
            <div class="summary-stat">
                <span class="value">${formatWeight(totalGrams)}</span>
                <span class="label">Total Harvested</span>
            </div>
            <div class="summary-stat">
                <span class="value">${totalCalories.toLocaleString()}</span>
                <span class="label">Total Calories</span>
            </div>
            <div class="summary-stat">
                <span class="value">${harvests.length}</span>
                <span class="label">Harvest Events</span>
            </div>
        </div>
    `;

    const tbody = document.getElementById('harvests-tbody');
    if (harvests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-text">No harvests recorded</td></tr>';
        return;
    }

    tbody.innerHTML = harvests.map(h => `
        <tr>
            <td>${formatDate(h.harvest_date)}</td>
            <td>${escapeHtml(h.plant_name || 'Unknown')} ${h.variety ? `<small>(${h.variety})</small>` : ''}</td>
            <td>${h.garden_name || '-'}</td>
            <td>${h.weight_grams || 0}g</td>
            <td>${h.calories_total || '-'}</td>
            <td>${'★'.repeat(h.quality_rating || 3)}${'☆'.repeat(5 - (h.quality_rating || 3))}</td>
            <td>${h.destination || '-'}</td>
            <td class="actions">
                <button class="btn btn-sm btn-icon" onclick="editHarvest(${h.id})" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="btn btn-sm btn-icon btn-danger" onclick="deleteHarvest(${h.id})" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </td>
        </tr>
    `).join('');
}

let editingHarvestId = null;

function openHarvestModal(harvest = null) {
    const modal = document.getElementById('harvest-modal');
    const form = document.getElementById('harvest-form');
    form.reset();
    editingHarvestId = null;

    // Populate garden dropdown
    const gardenSelect = document.getElementById('harvest-garden');
    gardenSelect.innerHTML = '<option value="">Select Garden</option>' +
        gardens.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

    if (harvest) {
        // Edit mode
        editingHarvestId = harvest.id;
        document.getElementById('harvest-modal-title').textContent = 'Edit Harvest';
        document.getElementById('harvest-garden').value = harvest.garden_id;

        // Load plants for the garden, then set the plant value
        loadPlantsForHarvest(harvest.garden_id).then(() => {
            document.getElementById('harvest-plant').value = harvest.garden_plant_id || '';
        });

        document.getElementById('harvest-date').value = formatDateForInput(harvest.harvest_date);
        document.getElementById('harvest-time').value = harvest.harvest_time || '';
        document.getElementById('harvest-weight').value = harvest.weight_grams || '';
        document.getElementById('harvest-count').value = harvest.count || '';
        document.getElementById('harvest-quality').value = harvest.quality_rating || 3;
        document.getElementById('harvest-destination').value = harvest.destination || 'consumed';
        document.getElementById('harvest-notes').value = harvest.notes || '';
    } else {
        // Add mode
        document.getElementById('harvest-modal-title').textContent = 'Record Harvest';
        document.getElementById('harvest-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
}

function closeHarvestModal() {
    document.getElementById('harvest-modal').classList.remove('active');
    editingHarvestId = null;
}

async function loadPlantsForHarvest(gardenId) {
    const plantSelect = document.getElementById('harvest-plant');
    plantSelect.innerHTML = '<option value="">Select Plant</option>';

    if (!gardenId) return;

    try {
        const response = await apiClient.get(`/garden/gardens/${gardenId}/plants`);
        if (response.success && response.plants.length > 0) {
            plantSelect.innerHTML += response.plants.map(p =>
                `<option value="${p.id}" data-guide="${p.plant_guide_id || ''}">${escapeHtml(p.plant_name)}${p.variety ? ` (${p.variety})` : ''}</option>`
            ).join('');
        }
    } catch (error) {
        console.error('Load plants for harvest error:', error);
    }
}

async function saveHarvest(event) {
    event.preventDefault();

    const plantSelect = document.getElementById('harvest-plant');
    const selectedOption = plantSelect.options[plantSelect.selectedIndex];

    const data = {
        garden_plant_id: document.getElementById('harvest-plant').value,
        garden_id: document.getElementById('harvest-garden').value,
        plant_guide_id: selectedOption?.dataset.guide || null,
        harvest_date: document.getElementById('harvest-date').value,
        harvest_time: document.getElementById('harvest-time').value || null,
        weight_grams: parseInt(document.getElementById('harvest-weight').value),
        count: parseInt(document.getElementById('harvest-count').value) || null,
        quality_rating: parseInt(document.getElementById('harvest-quality').value),
        destination: document.getElementById('harvest-destination').value,
        notes: document.getElementById('harvest-notes').value || null
    };

    try {
        let response;
        if (editingHarvestId) {
            response = await apiClient.put(`/garden/harvests/${editingHarvestId}`, data);
        } else {
            response = await apiClient.post('/garden/harvests', data);
        }

        if (response.success) {
            closeHarvestModal();
            await loadHarvests();
            await loadGardens();
            updateStats();
            showToast(editingHarvestId ? 'Harvest updated' : 'Harvest recorded');
        }
    } catch (error) {
        console.error('Save harvest error:', error);
        showToast('Failed to save harvest', 'error');
    }
}

async function editHarvest(id) {
    try {
        const response = await apiClient.get(`/garden/harvests/${id}`);
        if (response.success) {
            openHarvestModal(response.harvest);
        }
    } catch (error) {
        console.error('Edit harvest error:', error);
        showToast('Failed to load harvest', 'error');
    }
}

async function deleteHarvest(id) {
    if (!confirm('Delete this harvest record?')) return;

    try {
        const response = await apiClient.delete(`/garden/harvests/${id}`);
        if (response.success) {
            await loadHarvests();
            await loadGardens();
            updateStats();
            showToast('Harvest deleted');
        }
    } catch (error) {
        console.error('Delete harvest error:', error);
        showToast('Failed to delete harvest', 'error');
    }
}

// =====================================================
// ENVIRONMENT
// =====================================================

async function loadEnvironment() {
    try {
        const gardenId = document.getElementById('env-filter-garden').value;
        const startDate = document.getElementById('env-start-date').value;
        const endDate = document.getElementById('env-end-date').value;

        let url = '/garden/environment?limit=500';
        if (gardenId) url += `&garden_id=${gardenId}`;
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;

        const response = await apiClient.get(url);
        if (response.success) {
            renderEnvironmentCharts(response.data);
            renderEnvironmentSummary(response.data);
        }
    } catch (error) {
        console.error('Load environment error:', error);
    }
}

function renderEnvironmentCharts(data) {
    if (data.length === 0) {
        document.querySelector('.environment-charts').innerHTML = '<p class="empty-text">No environment data available</p>';
        return;
    }

    // Sort by timestamp
    data.sort((a, b) => new Date(a.reading_timestamp) - new Date(b.reading_timestamp));

    const labels = data.map(d => formatDate(d.reading_timestamp));
    const temps = data.map(d => d.temperature_c);
    const humidity = data.map(d => d.humidity_percent);

    // Temperature chart
    const tempCtx = document.getElementById('temp-chart').getContext('2d');
    if (tempChart) tempChart.destroy();
    tempChart = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: temps,
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Temperature Over Time' }
            }
        }
    });

    // Humidity chart
    const humCtx = document.getElementById('humidity-chart').getContext('2d');
    if (humidityChart) humidityChart.destroy();
    humidityChart = new Chart(humCtx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Humidity (%)',
                data: humidity,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Humidity Over Time' }
            }
        }
    });
}

function renderEnvironmentSummary(data) {
    if (data.length === 0) {
        document.getElementById('env-summary').innerHTML = '';
        return;
    }

    const temps = data.filter(d => d.temperature_c != null).map(d => parseFloat(d.temperature_c));
    const humidity = data.filter(d => d.humidity_percent != null).map(d => parseFloat(d.humidity_percent));
    const rainfall = data.reduce((sum, d) => sum + (parseFloat(d.rainfall_mm) || 0), 0);

    document.getElementById('env-summary').innerHTML = `
        <div class="env-summary-grid">
            ${temps.length > 0 ? `
                <div class="env-stat">
                    <span class="label">Avg Temp:</span>
                    <span class="value">${(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)}°C</span>
                </div>
                <div class="env-stat">
                    <span class="label">Temp Range:</span>
                    <span class="value">${Math.min(...temps).toFixed(1)}°C - ${Math.max(...temps).toFixed(1)}°C</span>
                </div>
            ` : ''}
            ${humidity.length > 0 ? `
                <div class="env-stat">
                    <span class="label">Avg Humidity:</span>
                    <span class="value">${Math.round(humidity.reduce((a, b) => a + b, 0) / humidity.length)}%</span>
                </div>
            ` : ''}
            <div class="env-stat">
                <span class="label">Total Rainfall:</span>
                <span class="value">${rainfall.toFixed(1)}mm</span>
            </div>
            <div class="env-stat">
                <span class="label">Readings:</span>
                <span class="value">${data.length}</span>
            </div>
        </div>
    `;
}

function openEnvironmentModal() {
    const modal = document.getElementById('environment-modal');
    const form = document.getElementById('environment-form');
    form.reset();

    // Populate garden dropdown
    const gardenSelect = document.getElementById('env-garden');
    gardenSelect.innerHTML = '<option value="">General</option>' +
        gardens.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

    document.getElementById('env-timestamp').value = new Date().toISOString().slice(0, 16);

    modal.classList.add('active');
}

function closeEnvironmentModal() {
    document.getElementById('environment-modal').classList.remove('active');
}

async function saveEnvironment(event) {
    event.preventDefault();

    const data = {
        garden_id: document.getElementById('env-garden').value || null,
        reading_timestamp: document.getElementById('env-timestamp').value,
        temperature_c: parseFloat(document.getElementById('env-temp').value) || null,
        temperature_max_c: parseFloat(document.getElementById('env-temp-max').value) || null,
        temperature_min_c: parseFloat(document.getElementById('env-temp-min').value) || null,
        soil_temperature_c: parseFloat(document.getElementById('env-soil-temp').value) || null,
        humidity_percent: parseInt(document.getElementById('env-humidity').value) || null,
        rainfall_mm: parseFloat(document.getElementById('env-rainfall').value) || null,
        light_hours: parseFloat(document.getElementById('env-light-hours').value) || null,
        notes: document.getElementById('env-notes').value || null
    };

    try {
        const response = await apiClient.post('/garden/environment', data);
        if (response.success) {
            closeEnvironmentModal();
            await loadEnvironment();
            showToast('Environment reading saved');
        }
    } catch (error) {
        console.error('Save environment error:', error);
        showToast('Failed to save environment reading', 'error');
    }
}

function openEnvironmentImportModal() {
    const modal = document.getElementById('env-import-modal');
    const form = document.getElementById('env-import-form');
    form.reset();

    // Populate garden dropdown
    const gardenSelect = document.getElementById('import-garden');
    gardenSelect.innerHTML = '<option value="">General/All</option>' +
        gardens.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

    modal.classList.add('active');
}

function closeEnvironmentImportModal() {
    document.getElementById('env-import-modal').classList.remove('active');
}

async function importEnvironmentData(event) {
    event.preventDefault();

    const file = document.getElementById('import-file').files[0];
    const gardenId = document.getElementById('import-garden').value;

    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (gardenId) formData.append('garden_id', gardenId);

    try {
        const token = authManager.getToken();
        const response = await fetch('/api/garden/environment/import', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            closeEnvironmentImportModal();
            await loadEnvironment();
            showToast(`Imported ${data.imported_count} readings`);
        } else {
            showToast(data.error || 'Import failed', 'error');
        }
    } catch (error) {
        console.error('Import environment error:', error);
        showToast('Failed to import environment data', 'error');
    }
}

// =====================================================
// PDF EXPORT
// =====================================================

async function exportToPDF() {
    try {
        showToast('Generating PDF report...');

        const response = await apiClient.get('/garden/export/pdf?include_logs=true&include_environment=true');
        if (!response.success) {
            showToast('Failed to get report data', 'error');
            return;
        }

        const { report } = response;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        let y = 20;

        // Title
        doc.setFontSize(20);
        doc.text('Garden Production Report', 105, y, { align: 'center' });
        y += 10;

        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, y, { align: 'center' });
        y += 15;

        // Summary
        doc.setFontSize(14);
        doc.text('Summary', 20, y);
        y += 8;

        doc.setFontSize(10);
        doc.text(`Gardens: ${report.summary.garden_count}`, 25, y); y += 5;
        doc.text(`Plants: ${report.summary.plant_count}`, 25, y); y += 5;
        doc.text(`Harvests: ${report.summary.harvest_count}`, 25, y); y += 5;
        doc.text(`Total Harvest: ${report.summary.total_harvest_kg} kg`, 25, y); y += 5;
        doc.text(`Total Calories: ${report.summary.total_calories.toLocaleString()}`, 25, y); y += 10;

        // Gardens
        if (report.gardens.length > 0) {
            doc.setFontSize(14);
            doc.text('Gardens', 20, y);
            y += 8;

            doc.setFontSize(10);
            report.gardens.forEach(g => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.text(`- ${g.name} (${g.garden_type || 'outdoor'})${g.total_area_sqft ? `, ${g.total_area_sqft} sq ft` : ''}`, 25, y);
                y += 5;
            });
            y += 5;
        }

        // Plants
        if (report.plants.length > 0) {
            if (y > 230) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            doc.text('Plants', 20, y);
            y += 8;

            doc.setFontSize(9);
            report.plants.slice(0, 30).forEach(p => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.text(`- ${p.plant_name}${p.variety ? ` (${p.variety})` : ''} - ${p.status} - Planted: ${formatDate(p.planting_date)}`, 25, y);
                y += 5;
            });
            y += 5;
        }

        // Production by plant
        const prodByPlant = Object.entries(report.summary.production_by_plant);
        if (prodByPlant.length > 0) {
            if (y > 200) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            doc.text('Production by Plant', 20, y);
            y += 8;

            doc.setFontSize(10);
            prodByPlant.sort((a, b) => b[1].grams - a[1].grams).slice(0, 15).forEach(([name, data]) => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.text(`${name}: ${formatWeight(data.grams)} (${data.count} harvests, ${data.calories} cal)`, 25, y);
                y += 5;
            });
            y += 5;
        }

        // Environment summary
        if (report.environment) {
            if (y > 230) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            doc.text('Environment Summary', 20, y);
            y += 8;

            doc.setFontSize(10);
            const env = report.environment;
            if (env.avg_temp) doc.text(`Average Temperature: ${parseFloat(env.avg_temp).toFixed(1)}°C`, 25, y), y += 5;
            if (env.max_temp && env.min_temp) doc.text(`Temperature Range: ${parseFloat(env.min_temp).toFixed(1)}°C - ${parseFloat(env.max_temp).toFixed(1)}°C`, 25, y), y += 5;
            if (env.avg_humidity) doc.text(`Average Humidity: ${Math.round(env.avg_humidity)}%`, 25, y), y += 5;
            if (env.total_rainfall) doc.text(`Total Rainfall: ${parseFloat(env.total_rainfall).toFixed(1)}mm`, 25, y), y += 5;
        }

        // Save
        doc.save(`garden-report-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('PDF exported successfully');
    } catch (error) {
        console.error('Export PDF error:', error);
        showToast('Failed to export PDF', 'error');
    }
}

// =====================================================
// UTILITIES
// =====================================================

function updateStats() {
    document.getElementById('stat-gardens').textContent = gardens.length;

    const activePlants = plants.filter(p => !['harvested', 'failed'].includes(p.status)).length;
    document.getElementById('stat-plants').textContent = activePlants;

    const totalHarvestGrams = gardens.reduce((sum, g) => sum + (parseFloat(g.total_harvest_grams) || 0), 0);
    // Show grams if less than 1kg, otherwise show kg
    if (totalHarvestGrams < 1000) {
        document.getElementById('stat-harvest-kg').textContent = Math.round(totalHarvestGrams) + 'g';
    } else {
        document.getElementById('stat-harvest-kg').textContent = (totalHarvestGrams / 1000).toFixed(1);
    }

    // Calculate total calories from harvests (estimate based on plant guides)
    // For now show total grams as a rough calorie estimate (1g ~= 0.5-1 cal for veggies)
    const estimatedCalories = Math.round(totalHarvestGrams * 0.25); // Conservative estimate
    document.getElementById('stat-calories').textContent = estimatedCalories > 0 ? estimatedCalories.toLocaleString() : '0';
}

function populateGardenFilters() {
    const options = '<option value="">All Gardens</option>' +
        gardens.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

    document.getElementById('filter-garden').innerHTML = options;
    document.getElementById('log-filter-garden').innerHTML = options;
    document.getElementById('harvest-filter-garden').innerHTML = options;
    document.getElementById('env-filter-garden').innerHTML = options;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}

function formatDateForInput(dateStr) {
    if (!dateStr) return '';
    // Handle both ISO strings and date-only strings
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
}

function formatWeight(grams) {
    if (!grams || grams === 0) return '0g';
    if (grams >= 1000) {
        return `${(grams / 1000).toFixed(1)}kg`;
    }
    return `${Math.round(grams)}g`;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'error' ? '#e74c3c' : type === 'info' ? '#3498db' : '#27ae60'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        animation: fadeIn 0.3s;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

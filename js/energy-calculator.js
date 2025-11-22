/**
 * SPS Energy Calculator Module
 * Features: Power load calculator, Generator sizing, Solar planning, Fuel tracking
 */

// Global state
let loadItems = [];
let equipment = [];
let fuelLog = [];
let loadIdCounter = 1;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadSavedData(); // Load saved data FIRST
    initLoadCalculator();
    initGeneratorCalc();
    initSolarCalc();
});

/**
 * Initialize tab navigation
 */
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;

            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update panels
            tabPanels.forEach(p => p.classList.remove('active'));
            document.getElementById(`${tabName}-panel`).classList.add('active');

            // Update URL without reload
            const url = new URL(window.location);
            url.searchParams.set('tab', tabName);
            window.history.replaceState({}, '', url);
        });
    });

    // Check URL for initial tab
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab');
    if (initialTab) {
        const btn = document.querySelector(`.tab-btn[data-tab="${initialTab}"]`);
        if (btn) btn.click();
    }
}

/**
 * Initialize load calculator
 */
function initLoadCalculator() {
    // Add some default items if none exist
    if (loadItems.length === 0) {
        addPreset('Refrigerator', 150, 24);
        addPreset('LED Lights', 50, 6);
        addPreset('Phone Charger', 10, 4);
    }
}

/**
 * Add a preset device to the load list
 */
function addPreset(name, watts, hours) {
    addLoadItem(name, watts, hours);
}

/**
 * Add a load item
 */
function addLoadItem(name = '', watts = 100, hours = 4) {
    const id = loadIdCounter++;

    loadItems.push({ id, name, watts, hours });

    renderLoadTable();
    calculateTotals();
    saveLoadData();
}

/**
 * Remove a load item
 */
function removeLoadItem(id) {
    loadItems = loadItems.filter(item => item.id !== id);
    renderLoadTable();
    calculateTotals();
    saveLoadData();
}

/**
 * Update a load item
 */
function updateLoadItem(id, field, value) {
    const item = loadItems.find(i => i.id === id);
    if (item) {
        item[field] = parseFloat(value) || 0;
        if (field === 'name') item[field] = value;
        calculateTotals();
        saveLoadData();
    }
}

/**
 * Render the load table
 */
function renderLoadTable() {
    const tbody = document.getElementById('load-tbody');
    if (!tbody) return;

    if (loadItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No devices added. Click "Add Device" or use the presets below.</td></tr>';
        return;
    }

    tbody.innerHTML = loadItems.map(item => {
        const whDay = item.watts * item.hours;
        return `
            <tr data-id="${item.id}">
                <td>
                    <input type="text" value="${escapeHtml(item.name)}"
                           onchange="updateLoadItem(${item.id}, 'name', this.value)"
                           style="width: 150px;">
                </td>
                <td>
                    <input type="number" value="${item.watts}" min="0"
                           onchange="updateLoadItem(${item.id}, 'watts', this.value)">
                </td>
                <td>
                    <input type="number" value="${item.hours}" min="0" max="24" step="0.5"
                           onchange="updateLoadItem(${item.id}, 'hours', this.value)">
                </td>
                <td>${formatNumber(whDay)} Wh</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="removeLoadItem(${item.id})">
                        Remove
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Calculate totals
 */
function calculateTotals() {
    const totalWatts = loadItems.reduce((sum, item) => sum + item.watts, 0);
    const totalWhDay = loadItems.reduce((sum, item) => sum + (item.watts * item.hours), 0);
    const dailyKwh = totalWhDay / 1000;

    // Update stats
    document.getElementById('total-watts').textContent = formatNumber(totalWatts);
    document.getElementById('daily-kwh').textContent = dailyKwh.toFixed(2);
    document.getElementById('total-watts-table').textContent = `${formatNumber(totalWatts)} W`;
    document.getElementById('total-wh-day').textContent = `${formatNumber(totalWhDay)} Wh`;

    // Calculate generator sizing
    calculateGeneratorSizing(totalWatts, dailyKwh);

    // Update solar calculator input
    const solarInput = document.getElementById('solar-daily-need');
    if (solarInput) {
        solarInput.value = totalWhDay;
        calculateSolar();
    }
}

/**
 * Initialize generator calculator
 */
function initGeneratorCalc() {
    const fuelCapacity = document.getElementById('fuel-capacity');
    const genEfficiency = document.getElementById('gen-efficiency');

    if (fuelCapacity) {
        fuelCapacity.addEventListener('input', () => {
            const totalWatts = loadItems.reduce((sum, item) => sum + item.watts, 0);
            const dailyKwh = loadItems.reduce((sum, item) => sum + (item.watts * item.hours), 0) / 1000;
            calculateGeneratorSizing(totalWatts, dailyKwh);
        });
    }

    if (genEfficiency) {
        genEfficiency.addEventListener('change', () => {
            const totalWatts = loadItems.reduce((sum, item) => sum + item.watts, 0);
            const dailyKwh = loadItems.reduce((sum, item) => sum + (item.watts * item.hours), 0) / 1000;
            calculateGeneratorSizing(totalWatts, dailyKwh);
        });
    }
}

/**
 * Calculate generator sizing
 */
function calculateGeneratorSizing(totalWatts, dailyKwh) {
    // Peak load with 25% surge factor
    const peakLoad = Math.round(totalWatts * 1.25);

    // Recommended generator (50% headroom)
    const recommendedGen = Math.round(totalWatts * 1.5);

    // Get fuel settings
    const fuelCapacity = parseFloat(document.getElementById('fuel-capacity')?.value) || 5;
    const efficiency = parseFloat(document.getElementById('gen-efficiency')?.value) || 0.25;

    // Calculate runtime
    // Efficiency is gal/kWh, so: hours = fuel / (kW * efficiency)
    const continuousKw = totalWatts / 1000;
    let estRuntime = 0;
    if (continuousKw > 0) {
        estRuntime = fuelCapacity / (continuousKw * efficiency);
    }

    // Fuel needed for 24 hours
    const fuel24h = dailyKwh * efficiency;

    // Days of autonomy
    let daysAutonomy = 0;
    if (fuel24h > 0) {
        daysAutonomy = fuelCapacity / fuel24h;
    }

    // Generator runtime per day based on daily kWh
    let generatorRuntime = 0;
    if (continuousKw > 0) {
        generatorRuntime = dailyKwh / continuousKw;
    }

    // Fuel per day
    const fuelPerDay = dailyKwh * efficiency;

    // Update display
    document.getElementById('peak-load').textContent = `${formatNumber(peakLoad)} W`;
    document.getElementById('recommended-gen').textContent = `${formatNumber(recommendedGen)} W`;
    document.getElementById('est-runtime').textContent = `${estRuntime.toFixed(1)} hours`;
    document.getElementById('fuel-24h').textContent = `${fuel24h.toFixed(2)} gallons`;
    document.getElementById('days-autonomy').textContent = `${daysAutonomy.toFixed(1)} days`;

    // Update stat cards
    document.getElementById('generator-runtime').textContent = `${generatorRuntime.toFixed(1)}h`;
    document.getElementById('fuel-per-day').textContent = fuelPerDay.toFixed(2);
}

/**
 * Initialize solar calculator
 */
function initSolarCalc() {
    const inputs = ['solar-daily-need', 'sun-hours', 'solar-efficiency', 'solar-autonomy'];

    inputs.forEach(inputId => {
        const el = document.getElementById(inputId);
        if (el) {
            el.addEventListener('input', calculateSolar);
            el.addEventListener('change', calculateSolar);
        }
    });
}

/**
 * Calculate solar system requirements
 */
function calculateSolar() {
    const dailyNeed = parseFloat(document.getElementById('solar-daily-need')?.value) || 5000;
    const sunHours = parseFloat(document.getElementById('sun-hours')?.value) || 5;
    const efficiency = parseFloat(document.getElementById('solar-efficiency')?.value) || 0.8;
    const autonomyDays = parseFloat(document.getElementById('solar-autonomy')?.value) || 2;

    // Solar panel sizing
    // Watts needed = Daily Wh / (Sun Hours * Efficiency)
    const panelsWatts = Math.round(dailyNeed / (sunHours * efficiency));
    const panels100w = Math.ceil(panelsWatts / 100);

    // Battery sizing (12V system)
    // Ah = (Daily Wh * Autonomy Days) / (12V * DoD)
    // Assuming 50% Depth of Discharge for lead-acid
    const batteryAh = Math.round((dailyNeed * autonomyDays) / (12 * 0.5));
    const batteries100ah = Math.ceil(batteryAh / 100);

    // Inverter sizing (peak load + 25% + some headroom)
    const peakWatts = loadItems.reduce((sum, item) => sum + item.watts, 0);
    const inverterSize = Math.round(peakWatts * 1.5);

    // Update display
    document.getElementById('solar-panels-needed').textContent = `${formatNumber(panelsWatts)} W`;
    document.getElementById('panels-100w').textContent = panels100w;
    document.getElementById('battery-ah').textContent = `${formatNumber(batteryAh)} Ah`;
    document.getElementById('batteries-100ah').textContent = batteries100ah;
    document.getElementById('inverter-size').textContent = `${formatNumber(inverterSize)} W`;
}

/**
 * Equipment Management
 */
function openEquipmentModal() {
    document.getElementById('equipment-modal').classList.add('active');
    document.getElementById('equipment-form').reset();
}

function closeEquipmentModal() {
    document.getElementById('equipment-modal').classList.remove('active');
}

function saveEquipment(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    equipment.push({
        id: Date.now(),
        ...data
    });

    renderEquipment();
    saveEquipmentData();
    closeEquipmentModal();
}

function deleteEquipment(id) {
    equipment = equipment.filter(e => e.id !== id);
    renderEquipment();
    saveEquipmentData();
}

function renderEquipment() {
    const grid = document.getElementById('equipment-grid');
    if (!grid) return;

    if (equipment.length === 0) {
        grid.innerHTML = `
            <div class="equipment-empty">
                <span class="empty-icon">⚡</span>
                <p>No equipment added yet</p>
                <button class="btn btn-outline" onclick="openEquipmentModal()">Add Your First Generator</button>
            </div>
        `;
        return;
    }

    grid.innerHTML = equipment.map(eq => `
        <div class="equipment-card">
            <div class="equipment-card-header">
                <div>
                    <div class="equipment-type">${escapeHtml(eq.type || 'Equipment')}</div>
                    <div class="equipment-name">${escapeHtml(eq.name)}</div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="deleteEquipment(${eq.id})">×</button>
            </div>
            <div class="equipment-specs">
                ${eq.wattage ? `<div class="spec-item"><span class="spec-label">Capacity</span><span class="spec-value">${eq.wattage}W</span></div>` : ''}
                ${eq.fuel_type ? `<div class="spec-item"><span class="spec-label">Fuel</span><span class="spec-value">${eq.fuel_type}</span></div>` : ''}
                ${eq.tank_size ? `<div class="spec-item"><span class="spec-label">Tank</span><span class="spec-value">${eq.tank_size} gal</span></div>` : ''}
                ${eq.runtime_50 ? `<div class="spec-item"><span class="spec-label">Runtime</span><span class="spec-value">${eq.runtime_50}h @ 50%</span></div>` : ''}
            </div>
            ${eq.notes ? `<div style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(eq.notes)}</div>` : ''}
        </div>
    `).join('');
}

/**
 * Fuel Log Management
 */
function openFuelModal() {
    document.getElementById('fuel-modal').classList.add('active');
    document.getElementById('fuel-form').reset();
    document.getElementById('fuel-date').value = new Date().toISOString().split('T')[0];
}

function closeFuelModal() {
    document.getElementById('fuel-modal').classList.remove('active');
}

function saveFuel(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    fuelLog.push({
        id: Date.now(),
        ...data,
        quantity: parseFloat(data.quantity) || 0,
        stabilized: data.stabilized === 'on'
    });

    renderFuelLog();
    updateFuelStats();
    saveFuelData();
    closeFuelModal();
}

function deleteFuel(id) {
    fuelLog = fuelLog.filter(f => f.id !== id);
    renderFuelLog();
    updateFuelStats();
    saveFuelData();
}

function renderFuelLog() {
    const tbody = document.getElementById('fuel-tbody');
    if (!tbody) return;

    if (fuelLog.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No fuel logged yet</td></tr>';
        return;
    }

    tbody.innerHTML = fuelLog.map(fuel => `
        <tr>
            <td>${escapeHtml(fuel.fuel_type)}</td>
            <td>${fuel.quantity} ${fuel.unit || 'gallons'}</td>
            <td>${escapeHtml(fuel.container || '-')}</td>
            <td>${fuel.date_added || '-'}</td>
            <td>${fuel.stabilized ? '✅ Yes' : '❌ No'}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteFuel(${fuel.id})">Remove</button>
            </td>
        </tr>
    `).join('');
}

function updateFuelStats() {
    // Calculate totals by fuel type
    const fuelByType = {};
    let totalGallons = 0;

    fuelLog.forEach(fuel => {
        let qty = fuel.quantity || 0;
        const type = fuel.fuel_type || 'Unknown';

        // Convert to gallons for total calculation
        if (fuel.unit === 'liters') qty *= 0.264172;
        if (fuel.unit === 'lbs') qty *= 0.23; // rough propane conversion

        totalGallons += qty;

        // Track by type in original units
        if (!fuelByType[type]) {
            fuelByType[type] = { quantity: 0, unit: fuel.unit || 'gallons' };
        }
        fuelByType[type].quantity += fuel.quantity || 0;
    });

    // Days of supply (based on current load)
    const dailyKwh = loadItems.reduce((sum, item) => sum + (item.watts * item.hours), 0) / 1000;
    const efficiency = parseFloat(document.getElementById('gen-efficiency')?.value) || 0.25;
    const fuelPerDay = dailyKwh * efficiency;
    const fuelDays = fuelPerDay > 0 ? totalGallons / fuelPerDay : 0;

    // Oldest fuel date
    const dates = fuelLog.filter(f => f.date_added).map(f => new Date(f.date_added));
    const oldestDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;

    // Update main stats
    const totalFuelEl = document.getElementById('total-fuel');
    if (totalFuelEl) totalFuelEl.textContent = totalGallons.toFixed(1);

    const fuelDaysEl = document.getElementById('fuel-days');
    if (fuelDaysEl) fuelDaysEl.textContent = fuelDays.toFixed(1);

    const oldestFuelEl = document.getElementById('oldest-fuel');
    if (oldestFuelEl) {
        oldestFuelEl.textContent = oldestDate ?
            oldestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--';
    }

    // Render fuel type breakdown
    const breakdownEl = document.getElementById('fuel-breakdown');
    if (breakdownEl) {
        if (Object.keys(fuelByType).length === 0) {
            breakdownEl.innerHTML = '<p class="empty-text">No fuel logged yet</p>';
        } else {
            breakdownEl.innerHTML = Object.entries(fuelByType).map(([type, data]) => `
                <div class="fuel-type-row">
                    <span class="fuel-type-name">${escapeHtml(type)}</span>
                    <span class="fuel-type-amount">${data.quantity.toFixed(1)} ${data.unit}</span>
                </div>
            `).join('');
        }
    }
}

/**
 * Data persistence
 */
function saveLoadData() {
    localStorage.setItem('sps_energy_loads', JSON.stringify(loadItems));
}

function saveEquipmentData() {
    localStorage.setItem('sps_energy_equipment', JSON.stringify(equipment));
}

function saveFuelData() {
    localStorage.setItem('sps_energy_fuel', JSON.stringify(fuelLog));
}

function loadSavedData() {
    try {
        const savedLoads = localStorage.getItem('sps_energy_loads');
        if (savedLoads) {
            loadItems = JSON.parse(savedLoads);
            loadIdCounter = Math.max(...loadItems.map(i => i.id), 0) + 1;
        }

        const savedEquipment = localStorage.getItem('sps_energy_equipment');
        if (savedEquipment) {
            equipment = JSON.parse(savedEquipment);
        }

        const savedFuel = localStorage.getItem('sps_energy_fuel');
        if (savedFuel) {
            fuelLog = JSON.parse(savedFuel);
        }
    } catch (e) {
        console.error('[Energy] Error loading saved data:', e);
    }

    renderLoadTable();
    calculateTotals();
    renderEquipment();
    renderFuelLog();
    updateFuelStats();
}

/**
 * Utility functions
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for global access
window.addLoadItem = addLoadItem;
window.addPreset = addPreset;
window.removeLoadItem = removeLoadItem;
window.updateLoadItem = updateLoadItem;
window.openEquipmentModal = openEquipmentModal;
window.closeEquipmentModal = closeEquipmentModal;
window.saveEquipment = saveEquipment;
window.deleteEquipment = deleteEquipment;
window.openFuelModal = openFuelModal;
window.closeFuelModal = closeFuelModal;
window.saveFuel = saveFuel;
window.deleteFuel = deleteFuel;

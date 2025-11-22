/**
 * OSM Map Interface using Leaflet
 * Works with SPS styling and tile proxy
 */

let map;
let gpsMarker;
let gpsCircle;
let currentTileLayer;

// Tile layer configurations
const tileLayers = {
    standard: {
        url: '/api/tiles/{z}/{x}/{y}.png',
        options: {
            maxZoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }
    },
    cycle: {
        url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
        options: {
            maxZoom: 20,
            attribution: '© OpenStreetMap © CyclOSM'
        }
    },
    humanitarian: {
        url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        options: {
            maxZoom: 19,
            attribution: '© OpenStreetMap, Tiles: HOT'
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initSidebar();
    initSearch();
    initLayerControls();
    initControls();
});

/**
 * Initialize Leaflet map
 */
function initMap() {
    try {
        // Create map
        map = L.map('map', {
            center: [37.7749, -122.4194], // San Francisco default
            zoom: 13,
            zoomControl: true
        });

        // Add default tile layer
        currentTileLayer = L.tileLayer(tileLayers.standard.url, tileLayers.standard.options);
        currentTileLayer.addTo(map);

        // Add scale control
        L.control.scale({ metric: true, imperial: true }).addTo(map);

        // Update info on map move
        map.on('moveend', updateMapInfo);
        map.on('zoomend', updateMapInfo);

        // Initial update
        updateMapInfo();

        console.log('[Map] Leaflet map initialized');
    } catch (error) {
        console.error('[Map] Init error:', error);
        document.getElementById('map').innerHTML = '<div style="padding:20px;text-align:center;">Map failed to load: ' + error.message + '</div>';
    }
}

/**
 * Update map info display
 */
function updateMapInfo() {
    if (!map) return;

    const center = map.getCenter();
    const zoom = map.getZoom();

    const zoomEl = document.getElementById('map-zoom');
    const centerEl = document.getElementById('map-center');

    if (zoomEl) zoomEl.textContent = 'Zoom: ' + zoom;
    if (centerEl) centerEl.textContent = 'Center: ' + center.lat.toFixed(4) + ', ' + center.lng.toFixed(4);
}

/**
 * Initialize sidebar tabs
 */
function initSidebar() {
    const tabs = document.querySelectorAll('.osm-sidebar-tab');
    const panels = document.querySelectorAll('.osm-tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Remove active from all
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            // Add active to clicked
            tab.classList.add('active');
            const panel = document.getElementById(tabName + '-panel');
            if (panel) panel.classList.add('active');
        });
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // Sidebar close button
    const closeBtn = document.getElementById('sidebar-close');
    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
        });
    }
}

/**
 * Initialize search functionality
 */
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            performSearch(searchInput.value);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(searchInput.value);
            }
        });
    }
}

/**
 * Perform geocoding search
 */
async function performSearch(query) {
    if (!query || query.trim() === '') return;

    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<div class="osm-search-result">Searching...</div>';

    try {
        // Try Nominatim for geocoding
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
        const results = await response.json();

        if (results.length > 0) {
            displaySearchResults(results);
        } else {
            resultsDiv.innerHTML = '<div class="osm-search-result">No results found</div>';
        }
    } catch (error) {
        console.error('[Map] Search error:', error);
        resultsDiv.innerHTML = '<div class="osm-search-result">Search failed</div>';
    }
}

/**
 * Display search results
 */
function displaySearchResults(results) {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '';

    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'osm-search-result';
        div.innerHTML = `
            <div class="osm-search-result-name">${escapeHtml(result.display_name.split(',')[0])}</div>
            <div class="osm-search-result-address">${escapeHtml(result.display_name)}</div>
        `;
        div.addEventListener('click', () => {
            flyToLocation(parseFloat(result.lat), parseFloat(result.lon), result.display_name);
            resultsDiv.innerHTML = '';
        });
        resultsDiv.appendChild(div);
    });
}

/**
 * Fly to a location
 */
function flyToLocation(lat, lon, name) {
    map.flyTo([lat, lon], 16, { duration: 1.5 });

    // Add marker
    const marker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup('<strong>' + escapeHtml(name.split(',')[0]) + '</strong>')
        .openPopup();

    // Remove after 30 seconds
    setTimeout(() => map.removeLayer(marker), 30000);
}

/**
 * Initialize layer controls
 */
function initLayerControls() {
    const radios = document.querySelectorAll('input[name="base-layer"]');

    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            changeLayer(e.target.value);
        });
    });
}

/**
 * Change tile layer
 */
function changeLayer(layerName) {
    const layer = tileLayers[layerName];
    if (!layer) return;

    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }

    currentTileLayer = L.tileLayer(layer.url, layer.options);
    currentTileLayer.addTo(map);

    console.log('[Map] Layer changed to:', layerName);
}

/**
 * Initialize control buttons
 */
function initControls() {
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) {
        locateBtn.addEventListener('click', showMyLocation);
    }
}

/**
 * Show user's current location
 */
function showMyLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation not supported');
        return;
    }

    document.getElementById('gps-status').textContent = 'Locating...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            // Update display
            document.getElementById('gps-status').textContent = 'Located';
            document.getElementById('gps-position').textContent = lat.toFixed(5) + ', ' + lon.toFixed(5);
            document.getElementById('gps-accuracy').textContent = Math.round(accuracy) + 'm';

            // Remove old markers
            if (gpsMarker) map.removeLayer(gpsMarker);
            if (gpsCircle) map.removeLayer(gpsCircle);

            // Add accuracy circle
            gpsCircle = L.circle([lat, lon], {
                radius: accuracy,
                color: '#7092FF',
                fillColor: '#7092FF',
                fillOpacity: 0.15,
                weight: 2
            }).addTo(map);

            // Add marker with custom icon
            const gpsIcon = L.divIcon({
                className: 'gps-marker-icon',
                html: '<div class="gps-dot"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            gpsMarker = L.marker([lat, lon], { icon: gpsIcon })
                .addTo(map)
                .bindPopup('Your location');

            // Fly to location
            map.flyTo([lat, lon], 16, { duration: 1.5 });
        },
        (error) => {
            console.error('[Map] GPS error:', error);
            document.getElementById('gps-status').textContent = 'Error: ' + error.message;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
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

// Export for global access
window.showMyLocation = showMyLocation;
window.performSearch = performSearch;

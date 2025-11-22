/**
 * OSM Official-style Map Interface
 * Based on openstreetmap-website JavaScript structure
 * Uses Leaflet (official OSM uses Leaflet, not MapLibre)
 */

// Global state
let map;
let gpsMarker;
let gpsCircle;
let gpsWatchId;
let currentPosition = null;
let markers = [];
let contextMenuLatLng = null;

// Tile layer URLs (matching OSM official layers)
const tileLayers = {
    standard: {
        url: '/api/tiles/{z}/{x}/{y}.png',
        options: {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    },
    cycle: {
        url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
        options: {
            maxZoom: 20,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.cyclosm.org">CyclOSM</a>'
        }
    },
    transport: {
        url: 'https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=YOUR_API_KEY',
        options: {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles: Thunderforest'
        }
    },
    humanitarian: {
        url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        options: {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles: HOT'
        }
    }
};

let currentTileLayer;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initSearch();
    initLayerControls();
    initContextMenu();
    initAuth();
    parseUrlHash();
});

/**
 * Initialize the Leaflet map
 */
function initMap() {
    // Create map centered on default location
    map = L.map('map', {
        center: [37.7749, -122.4194], // San Francisco default
        zoom: 13,
        zoomControl: true,
        attributionControl: true
    });

    // Add default tile layer
    currentTileLayer = L.tileLayer(tileLayers.standard.url, tileLayers.standard.options);
    currentTileLayer.addTo(map);

    // Add scale control
    L.control.scale({
        metric: true,
        imperial: true,
        position: 'bottomleft'
    }).addTo(map);

    // Map events
    map.on('moveend', updateUrlHash);
    map.on('zoomend', updateUrlHash);
    map.on('contextmenu', showContextMenu);
    map.on('click', hideContextMenu);

    // Handle keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    console.log('[OSM] Map initialized');
}

/**
 * Initialize search functionality
 */
function initSearch() {
    const searchForm = document.getElementById('search-form');
    const searchQuery = document.getElementById('search-query');
    const whereAmIBtn = document.getElementById('whereami-btn');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            performSearch(searchQuery.value);
        });
    }

    if (whereAmIBtn) {
        whereAmIBtn.addEventListener('click', showMyLocation);
    }

    // Mobile search
    const mobileSearch = document.getElementById('mobile-search');
    if (mobileSearch) {
        mobileSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(mobileSearch.value);
                bootstrap.Offcanvas.getInstance(document.getElementById('mobileMenu'))?.hide();
            }
        });
    }
}

/**
 * Perform geocoding search
 */
async function performSearch(query) {
    if (!query || query.trim() === '') return;

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm" role="status"></div> Searching...</div>';

    try {
        // Try local geocoder first
        const response = await fetch(`/api/osm/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            displaySearchResults(data.results);
        } else {
            // Fallback to Nominatim
            const nominatimResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
            const nominatimData = await nominatimResponse.json();

            if (nominatimData.length > 0) {
                displaySearchResults(nominatimData.map(r => ({
                    display_name: r.display_name,
                    lat: parseFloat(r.lat),
                    lon: parseFloat(r.lon),
                    type: r.type
                })));
            } else {
                resultsContainer.innerHTML = '<div class="alert alert-info">No results found</div>';
            }
        }
    } catch (error) {
        console.error('[OSM] Search error:', error);
        resultsContainer.innerHTML = '<div class="alert alert-danger">Search failed. Try again later.</div>';
    }
}

/**
 * Display search results in sidebar
 */
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    results.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <div class="fw-bold">${escapeHtml(result.display_name?.split(',')[0] || result.name || 'Unknown')}</div>
            <div class="small text-muted">${escapeHtml(result.display_name || '')}</div>
        `;
        item.addEventListener('click', () => {
            flyToResult(result);
        });
        resultsContainer.appendChild(item);
    });
}

/**
 * Fly to a search result
 */
function flyToResult(result) {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    map.flyTo([lat, lon], 16, { duration: 1.5 });

    // Add temporary marker
    const marker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(`<strong>${escapeHtml(result.display_name?.split(',')[0] || 'Location')}</strong>`)
        .openPopup();

    // Remove marker after 30 seconds
    setTimeout(() => {
        map.removeLayer(marker);
    }, 30000);
}

/**
 * Show user's current location
 */
function showMyLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    // Show GPS status panel
    const gpsPanel = document.getElementById('gps-status-panel');
    if (gpsPanel) {
        gpsPanel.classList.remove('d-none');
    }

    document.getElementById('gps-status').textContent = 'Locating...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            currentPosition = { lat, lon, accuracy };

            // Update status display
            document.getElementById('gps-status').textContent = 'Located';
            document.getElementById('gps-position').textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            document.getElementById('gps-accuracy').textContent = `${Math.round(accuracy)}m`;

            // Remove existing GPS marker
            if (gpsMarker) {
                map.removeLayer(gpsMarker);
            }
            if (gpsCircle) {
                map.removeLayer(gpsCircle);
            }

            // Add accuracy circle
            gpsCircle = L.circle([lat, lon], {
                radius: accuracy,
                color: '#7092FF',
                fillColor: '#7092FF',
                fillOpacity: 0.15,
                weight: 2
            }).addTo(map);

            // Add GPS marker with custom icon
            const gpsIcon = L.divIcon({
                className: 'gps-marker',
                html: '<div class="pulse"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            gpsMarker = L.marker([lat, lon], { icon: gpsIcon })
                .addTo(map)
                .bindPopup('Your location');

            // Fly to location
            map.flyTo([lat, lon], 16, { duration: 1.5 });
        },
        (error) => {
            console.error('[OSM] Geolocation error:', error);
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
 * Initialize layer controls
 */
function initLayerControls() {
    const layerRadios = document.querySelectorAll('input[name="base-layer"]');

    layerRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            changeLayer(e.target.value);
        });
    });
}

/**
 * Change the base tile layer
 */
function changeLayer(layerName) {
    const layer = tileLayers[layerName];
    if (!layer) return;

    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }

    currentTileLayer = L.tileLayer(layer.url, layer.options);
    currentTileLayer.addTo(map);

    console.log('[OSM] Layer changed to:', layerName);
}

/**
 * Initialize context menu
 */
function initContextMenu() {
    const contextMenu = document.getElementById('map-context-menu');

    document.getElementById('ctx-center-map')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (contextMenuLatLng) {
            map.panTo(contextMenuLatLng);
        }
        hideContextMenu();
    });

    document.getElementById('ctx-show-address')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (contextMenuLatLng) {
            await reverseGeocode(contextMenuLatLng.lat, contextMenuLatLng.lng);
        }
        hideContextMenu();
    });

    document.getElementById('ctx-directions-from')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Directions feature coming soon');
        hideContextMenu();
    });

    document.getElementById('ctx-directions-to')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Directions feature coming soon');
        hideContextMenu();
    });
}

/**
 * Show context menu at map click location
 */
function showContextMenu(e) {
    const contextMenu = document.getElementById('map-context-menu');
    contextMenuLatLng = e.latlng;

    contextMenu.style.display = 'block';
    contextMenu.style.left = e.originalEvent.pageX + 'px';
    contextMenu.style.top = e.originalEvent.pageY + 'px';
}

/**
 * Hide context menu
 */
function hideContextMenu() {
    const contextMenu = document.getElementById('map-context-menu');
    contextMenu.style.display = 'none';
}

/**
 * Reverse geocode a location
 */
async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();

        if (data.display_name) {
            L.popup()
                .setLatLng([lat, lng])
                .setContent(`<strong>Address</strong><br>${escapeHtml(data.display_name)}`)
                .openOn(map);
        }
    } catch (error) {
        console.error('[OSM] Reverse geocode error:', error);
    }
}

/**
 * Update URL hash with current map position
 */
function updateUrlHash() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    window.history.replaceState(null, '', `#map=${zoom}/${center.lat.toFixed(5)}/${center.lng.toFixed(5)}`);
}

/**
 * Parse URL hash to set map position
 */
function parseUrlHash() {
    const hash = window.location.hash;
    const match = hash.match(/#map=(\d+)\/([\d.-]+)\/([\d.-]+)/);

    if (match) {
        const zoom = parseInt(match[1]);
        const lat = parseFloat(match[2]);
        const lng = parseFloat(match[3]);

        if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], zoom);
        }
    }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboard(e) {
    // Don't handle if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    switch (e.key) {
        case '+':
        case '=':
            map.zoomIn();
            break;
        case '-':
            map.zoomOut();
            break;
        case 'l':
            showMyLocation();
            break;
    }
}

/**
 * Initialize auth UI based on login state
 */
function initAuth() {
    // Check if authManager exists and user is logged in
    if (typeof authManager !== 'undefined') {
        authManager.onAuthStateChange = (user) => {
            const loggedOutMenu = document.getElementById('logged-out-menu');
            const loggedInMenu = document.getElementById('logged-in-menu');

            if (user) {
                loggedOutMenu?.classList.add('d-none');
                loggedInMenu?.classList.remove('d-none');
                document.getElementById('user-display-name').textContent = user.username;
            } else {
                loggedOutMenu?.classList.remove('d-none');
                loggedInMenu?.classList.add('d-none');
            }
        };
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for global access
window.showMyLocation = showMyLocation;
window.performSearch = performSearch;

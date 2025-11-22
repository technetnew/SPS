// GPS and Offline Map Management using OpenStreetMap
let map = null;
let userMarker = null;
let followEnabled = true;
let currentPosition = null;
let updateInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    authManager.init();
    initializeMap();
    checkGPSStatus();
    setupControlListeners();
    setupSearchListeners();
    startGPSTracking();
});

// Initialize MapLibre GL map with OpenStreetMap
function initializeMap() {
    try {
        // Get server hostname
        const serverHost = window.location.hostname || 'localhost';
        const serverPort = window.location.port ? `:${window.location.port}` : '';
        const protocol = window.location.protocol;

        // Create map using cached tiles from local server
        map = new maplibregl.Map({
            container: 'map',
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: [
                            `${protocol}//${serverHost}:3000/api/tiles/{z}/{x}/{y}.png`
                        ],
                        tileSize: 256,
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Offline Cached'
                    }
                },
                layers: [
                    {
                        id: 'osm',
                        type: 'raster',
                        source: 'osm',
                        minzoom: 0,
                        maxzoom: 19
                    }
                ]
            },
            center: [-122.4194, 37.7749], // San Francisco as default
            zoom: 13,
            attributionControl: true
        });

        // Add navigation controls (zoom buttons)
        map.addControl(new maplibregl.NavigationControl(), 'top-left');

        // Add scale control
        map.addControl(new maplibregl.ScaleControl({
            maxWidth: 200,
            unit: 'metric'
        }), 'bottom-left');

        // Map load event
        map.on('load', () => {
            console.log('[GPS] OpenStreetMap loaded successfully');
        });

        // Map error event
        map.on('error', (e) => {
            console.error('[GPS] Map error:', e);
            showGPSAlert('Map Loading Error', e.error?.message || 'Unable to load map tiles');
        });

        console.log('[GPS] Map initialized with OpenStreetMap');
    } catch (error) {
        console.error('[GPS] Map initialization error:', error);
        document.getElementById('map').innerHTML = `
            <div class="map-error">
                <h2>Map Initialization Failed</h2>
                <p>Error: ${error.message}</p>
                <p>Please ensure MapLibre GL JS is loaded correctly.</p>
            </div>
        `;
    }
}

// Check GPS status
async function checkGPSStatus() {
    try {
        const response = await fetch('/api/gps/status');
        const data = await response.json();

        if (data.status === 'ready') {
            updateGPSStatus('Ready', 'success');
            hideGPSAlert();
        } else {
            updateGPSStatus(data.message || 'Not Ready', 'warning');
            showGPSAlert('GPS Not Ready', data.message || 'Waiting for GPS signal...');
        }
    } catch (error) {
        updateGPSStatus('Error', 'error');
        showGPSAlert('GPS Error', 'Unable to connect to GPS service');
        console.error('[GPS] Status check error:', error);
    }
}

// Update GPS location
async function updateGPSLocation() {
    try {
        const response = await fetch('/api/gps/location');
        const data = await response.json();

        if (data.success && data.lat && data.lon) {
            currentPosition = {
                lat: data.lat,
                lon: data.lon,
                alt: data.alt,
                speed: data.speed,
                fix: data.fix,
                satellites: data.satellites
            };

            // Update status displays
            updateGPSStatus(`Fix ${data.fix}/3`, data.fix >= 2 ? 'success' : 'warning');
            updatePositionDisplay(data.lat, data.lon);
            updateAltitudeDisplay(data.alt);
            updateSpeedDisplay(data.speed);
            updateSatellitesDisplay(data.satellites);
            updateAccuracyDisplay(data.accuracy);

            // Hide GPS alert when we have a good fix
            if (data.fix >= 2) {
                hideGPSAlert();
            }

            // Update marker on map
            updateMapMarker(data.lon, data.lat); // Note: MapLibre uses [lon, lat] order

            // Center map if follow is enabled
            if (followEnabled && map) {
                map.easeTo({
                    center: [data.lon, data.lat],
                    duration: 1000
                });
            }

        } else {
            updateGPSStatus(data.error || 'No Fix', 'warning');
            updatePositionDisplay(null, null);
            updateAltitudeDisplay(null);
            updateSpeedDisplay(null);
            updateSatellitesDisplay(data.satellites || 0);
            updateAccuracyDisplay(null);

            showGPSAlert('No GPS Fix', 'Waiting for GPS signal. Ensure clear view of sky.');
        }

    } catch (error) {
        console.error('[GPS] Location update error:', error);
        updateGPSStatus('Error', 'error');
        showGPSAlert('GPS Error', 'Unable to retrieve GPS data');
    }
}

// Update map marker
function updateMapMarker(lon, lat) {
    if (!map) return;

    if (userMarker) {
        // Update existing marker position
        userMarker.setLngLat([lon, lat]);
    } else {
        // Create new marker with custom styling
        const el = document.createElement('div');
        el.className = 'gps-marker';
        el.innerHTML = '<div class="pulse"></div>';

        userMarker = new maplibregl.Marker({
            element: el,
            anchor: 'center'
        })
            .setLngLat([lon, lat])
            .setPopup(new maplibregl.Popup({ offset: 25 })
                .setHTML('<strong>Your Location</strong>'))
            .addTo(map);

        // Auto-center on first marker
        map.flyTo({
            center: [lon, lat],
            zoom: 15,
            duration: 2000
        });
        followEnabled = true;
        updateFollowButtonState();
    }
}

// Start GPS tracking
function startGPSTracking() {
    // Update immediately
    updateGPSLocation();

    // Then update every second
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    updateInterval = setInterval(updateGPSLocation, 1000);
    console.log('[GPS] Tracking started - updating every 1 second');
}

// Stop GPS tracking
function stopGPSTracking() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    console.log('[GPS] Tracking stopped');
}

// Setup control button listeners
function setupControlListeners() {
    // Locate button - start tracking and center on location
    document.getElementById('locate-btn').addEventListener('click', () => {
        startGPSTracking();
        followEnabled = true;
        updateFollowButtonState();

        if (currentPosition && map) {
            map.flyTo({
                center: [currentPosition.lon, currentPosition.lat],
                zoom: 15,
                duration: 1500
            });
        }
    });

    // Follow button - toggle auto-follow
    document.getElementById('follow-btn').addEventListener('click', () => {
        followEnabled = !followEnabled;
        updateFollowButtonState();

        if (followEnabled && currentPosition && map) {
            map.flyTo({
                center: [currentPosition.lon, currentPosition.lat],
                zoom: map.getZoom(),
                duration: 1000
            });
        }
    });

    // Fullscreen button
    document.getElementById('fullscreen-btn').addEventListener('click', () => {
        const gpsMain = document.querySelector('.gps-main');
        if (!document.fullscreenElement) {
            gpsMain.requestFullscreen().catch(err => {
                console.error('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Disable follow when user manually moves the map
    map.on('dragstart', () => {
        if (followEnabled) {
            followEnabled = false;
            updateFollowButtonState();
        }
    });
}

// Update follow button visual state
function updateFollowButtonState() {
    const followBtn = document.getElementById('follow-btn');
    if (followEnabled) {
        followBtn.classList.add('active');
        followBtn.style.background = '#2c5f2d';
        followBtn.style.color = 'white';
        followBtn.style.borderColor = '#2c5f2d';
    } else {
        followBtn.classList.remove('active');
        followBtn.style.background = 'white';
        followBtn.style.color = '#333';
        followBtn.style.borderColor = '#ddd';
    }
}

// Show GPS alert
function showGPSAlert(title, message) {
    const alert = document.getElementById('gps-alert');
    const messageEl = document.getElementById('gps-alert-message');

    alert.querySelector('strong').textContent = title;
    messageEl.textContent = message;
    alert.style.display = 'block';
}

// Hide GPS alert
function hideGPSAlert() {
    const alert = document.getElementById('gps-alert');
    alert.style.display = 'none';
}

// Update status displays
function updateGPSStatus(text, status) {
    const el = document.getElementById('gps-status');
    if (el) {
        el.textContent = text;
        el.className = 'status-value status-' + status;
    }
}

function updatePositionDisplay(lat, lon) {
    const el = document.getElementById('gps-position');
    if (el) {
        if (lat && lon) {
            el.textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
        } else {
            el.textContent = '--';
        }
    }
}

function updateAltitudeDisplay(alt) {
    const el = document.getElementById('gps-altitude');
    if (el) {
        if (alt !== null && alt !== undefined) {
            el.textContent = `${Math.round(alt)} m`;
        } else {
            el.textContent = '--';
        }
    }
}

function updateSpeedDisplay(speed) {
    const el = document.getElementById('gps-speed');
    if (el) {
        if (speed !== null && speed !== undefined) {
            // Convert m/s to km/h
            const kmh = (speed * 3.6).toFixed(1);
            el.textContent = `${kmh} km/h`;
        } else {
            el.textContent = '--';
        }
    }
}

function updateSatellitesDisplay(count) {
    const el = document.getElementById('gps-satellites');
    if (el) {
        el.textContent = count || '--';
    }
}

function updateAccuracyDisplay(accuracy) {
    const el = document.getElementById('gps-accuracy');
    if (el) {
        if (accuracy !== null && accuracy !== undefined) {
            el.textContent = `${Math.round(accuracy)} m`;
        } else {
            el.textContent = '--';
        }
    }
}

// Setup search listeners
function setupSearchListeners() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');

    // Search on button click
    searchBtn.addEventListener('click', () => {
        performSearch(searchInput.value);
    });

    // Search on Enter key
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch(searchInput.value);
        }
    });

    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target) && !searchBtn.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

// Perform offline geocoding search
async function performSearch(query) {
    const searchResults = document.getElementById('search-results');

    if (!query || query.trim().length === 0) {
        searchResults.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/gps/geocode?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            displaySearchResults(data.results);
        } else {
            searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
            searchResults.style.display = 'block';
        }
    } catch (error) {
        console.error('[GPS] Search error:', error);
        searchResults.innerHTML = '<div class="search-result-item">Search failed</div>';
        searchResults.style.display = 'block';
    }
}

// Display search results
function displaySearchResults(results) {
    const searchResults = document.getElementById('search-results');
    searchResults.innerHTML = '';

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.textContent = result.display_name;

        item.addEventListener('click', () => {
            // Fly to location
            if (map) {
                map.flyTo({
                    center: [result.lon, result.lat],
                    zoom: 12,
                    duration: 2000
                });

                // Add a temporary marker
                const marker = new maplibregl.Marker({ color: '#ff0000' })
                    .setLngLat([result.lon, result.lat])
                    .setPopup(new maplibregl.Popup({ offset: 25 })
                        .setHTML(`<strong>${result.display_name}</strong>`))
                    .addTo(map);

                // Show popup
                marker.togglePopup();

                // Remove marker after 10 seconds
                setTimeout(() => {
                    marker.remove();
                }, 10000);
            }

            // Hide results
            searchResults.style.display = 'none';
            document.getElementById('search-input').value = result.display_name;
        });

        searchResults.appendChild(item);
    });

    searchResults.style.display = 'block';
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopGPSTracking();
});

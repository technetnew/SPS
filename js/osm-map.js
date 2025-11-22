// OpenStreetMap-style Map Interface
let map;
let gpsMarker;
let gpsWatchId;
let gpsTrack = [];
let currentPosition = null;
let markers = [];

// Initialize map
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initSidebar();
    initSearch();
    initGPS();
    initControls();
    initLayers();
    initShare();
});

// Initialize MapLibre GL map
function initMap() {
    try {
        console.log('Initializing map...');

        // Check if MapLibre GL is loaded
        if (typeof maplibregl === 'undefined') {
            console.error('MapLibre GL is not loaded!');
            alert('Map library failed to load. Please refresh the page.');
            return;
        }

        const protocol = window.location.protocol;
        const serverHost = window.location.host;
        const tileUrl = `${protocol}//${serverHost}/api/tiles/{z}/{x}/{y}.png`;

        console.log('Tile URL:', tileUrl);

        map = new maplibregl.Map({
            container: 'map',
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: 'raster',
                        tiles: [tileUrl],
                        tileSize: 256,
                        attribution: '© OpenStreetMap contributors'
                    }
                },
                layers: [{
                    id: 'osm',
                    type: 'raster',
                    source: 'osm',
                    minzoom: 0,
                    maxzoom: 19
                }]
            },
            center: [-119.4179, 36.7783], // California center
            zoom: 6
        });

        console.log('Map instance created');

        // Add navigation controls
        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

        // Update map info on move
        map.on('move', updateMapInfo);
        map.on('zoom', updateMapInfo);

        // Click to add marker
        map.on('click', (e) => {
            addMarker(e.lngLat);
        });

        // Log when map loads
        map.on('load', () => {
            console.log('Map loaded successfully');
            updateMapInfo();
        });

        // Log errors
        map.on('error', (e) => {
            console.error('Map error:', e);
        });

    } catch (error) {
        console.error('Failed to initialize map:', error);
        alert('Failed to initialize map: ' + error.message);
    }
}

// Initialize sidebar tabs
function initSidebar() {
    const tabs = document.querySelectorAll('.osm-sidebar-tab');
    const panels = document.querySelectorAll('.osm-tab-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Remove active class from all tabs and panels
            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            // Add active class to clicked tab and corresponding panel
            tab.classList.add('active');
            document.getElementById(`${tabName}-panel`).classList.add('active');
        });
    });

    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    document.getElementById('sidebar-close').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('collapsed');
    });
}

// Initialize search functionality
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

async function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    const searchResults = document.getElementById('search-results');
    searchResults.innerHTML = '<div class="osm-search-result">Searching...</div>';

    try {
        const response = await fetch(`/api/gps/geocode?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            displaySearchResults(data.results);
        } else {
            searchResults.innerHTML = '<div class="osm-search-result">No results found</div>';
        }
    } catch (error) {
        console.error('Search error:', error);
        searchResults.innerHTML = '<div class="osm-search-result">Search failed</div>';
    }
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('search-results');
    searchResults.innerHTML = '';

    results.forEach(result => {
        const div = document.createElement('div');
        div.className = 'osm-search-result';
        div.innerHTML = `
            <div class="osm-search-result-name">${result.name}</div>
            <div class="osm-search-result-address">${result.type || 'Place'}</div>
        `;
        div.addEventListener('click', () => {
            flyToLocation(result.lon, result.lat, result.name);
        });
        searchResults.appendChild(div);
    });
}

function flyToLocation(lon, lat, name) {
    map.flyTo({
        center: [lon, lat],
        zoom: 15,
        essential: true
    });

    // Add marker
    addMarker({ lng: lon, lat }, name);
}

// Initialize GPS
function initGPS() {
    if ('geolocation' in navigator) {
        document.getElementById('gps-status').textContent = 'Ready';
    } else {
        document.getElementById('gps-status').textContent = 'Not available';
    }
}

function startGPSTracking() {
    if (!navigator.geolocation) {
        alert('GPS not available');
        return;
    }

    document.getElementById('start-tracking-btn').style.display = 'none';
    document.getElementById('stop-tracking-btn').style.display = 'block';
    document.getElementById('gps-status').textContent = 'Acquiring...';

    gpsWatchId = navigator.geolocation.watchPosition(
        updateGPSPosition,
        handleGPSError,
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        }
    );
}

function stopGPSTracking() {
    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    document.getElementById('start-tracking-btn').style.display = 'block';
    document.getElementById('stop-tracking-btn').style.display = 'none';
    document.getElementById('gps-status').textContent = 'Stopped';
}

function updateGPSPosition(position) {
    currentPosition = position;
    const { latitude, longitude, altitude, accuracy, speed } = position.coords;

    // Update GPS info
    document.getElementById('gps-status').textContent = 'Active';
    document.getElementById('gps-position').textContent =
        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    document.getElementById('gps-altitude').textContent =
        altitude ? `${altitude.toFixed(1)} m` : '--';
    document.getElementById('gps-speed').textContent =
        speed ? `${(speed * 3.6).toFixed(1)} km/h` : '--';
    document.getElementById('gps-accuracy').textContent =
        `±${accuracy.toFixed(0)} m`;

    // Update or create GPS marker
    if (!gpsMarker) {
        const el = document.createElement('div');
        el.className = 'gps-marker';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.background = '#4285f4';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 0 10px rgba(66, 133, 244, 0.5)';

        gpsMarker = new maplibregl.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(map);
    } else {
        gpsMarker.setLngLat([longitude, latitude]);
    }

    // Auto-follow if enabled
    if (document.getElementById('gps-auto-follow').checked) {
        map.easeTo({
            center: [longitude, latitude],
            zoom: Math.max(map.getZoom(), 15)
        });
    }

    // Record track if enabled
    if (document.getElementById('gps-record-track').checked) {
        gpsTrack.push([longitude, latitude]);
        updateGPSTrackLayer();
    }
}

function handleGPSError(error) {
    console.error('GPS Error:', error);
    document.getElementById('gps-status').textContent = `Error: ${error.message}`;
}

function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert('GPS not available');
        return;
    }

    document.getElementById('gps-status').textContent = 'Locating...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            map.flyTo({
                center: [longitude, latitude],
                zoom: 15,
                essential: true
            });
            updateGPSPosition(position);
        },
        handleGPSError
    );
}

function showNearby() {
    if (currentPosition) {
        const { latitude, longitude } = currentPosition.coords;
        alert(`Finding nearby places at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        // TODO: Implement nearby search
    } else {
        alert('Please enable GPS first');
    }
}

// Initialize controls
function initControls() {
    document.getElementById('locate-btn').addEventListener('click', getCurrentLocation);

    document.getElementById('fullscreen-btn').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });
}

// Initialize layers
function initLayers() {
    const baseLayerInputs = document.querySelectorAll('input[name="base-layer"]');
    baseLayerInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            changeBaseLayer(e.target.value);
        });
    });

    document.getElementById('overlay-gps-track').addEventListener('change', (e) => {
        toggleGPSTrack(e.target.checked);
    });

    document.getElementById('overlay-markers').addEventListener('change', (e) => {
        toggleMarkers(e.target.checked);
    });
}

function changeBaseLayer(layerName) {
    // TODO: Implement different base layers
    console.log('Changing base layer to:', layerName);
}

function toggleGPSTrack(show) {
    if (show && gpsTrack.length > 0) {
        updateGPSTrackLayer();
    } else {
        if (map.getLayer('gps-track')) {
            map.removeLayer('gps-track');
            map.removeSource('gps-track');
        }
    }
}

function updateGPSTrackLayer() {
    if (!map.getSource('gps-track')) {
        map.addSource('gps-track', {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: gpsTrack
                }
            }
        });

        map.addLayer({
            id: 'gps-track',
            type: 'line',
            source: 'gps-track',
            paint: {
                'line-color': '#4285f4',
                'line-width': 3
            }
        });
    } else {
        map.getSource('gps-track').setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: gpsTrack
            }
        });
    }
}

function toggleMarkers(show) {
    markers.forEach(marker => {
        marker.getElement().style.display = show ? 'block' : 'none';
    });
}

// Initialize share functions
function initShare() {
    updateShareURL();
}

function updateShareURL() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const url = `${window.location.origin}/gps.html#map=${zoom.toFixed(2)}/${center.lat.toFixed(6)}/${center.lng.toFixed(6)}`;

    document.getElementById('share-url').value = url;

    const embedCode = `<iframe width="600" height="450" src="${url}" style="border:none;"></iframe>`;
    document.getElementById('embed-code').value = embedCode;
}

function copyShareLink() {
    const shareURL = document.getElementById('share-url');
    shareURL.select();
    document.execCommand('copy');
    alert('Link copied to clipboard!');
}

function copyEmbedCode() {
    const embedCode = document.getElementById('embed-code');
    embedCode.select();
    document.execCommand('copy');
    alert('Embed code copied to clipboard!');
}

function exportAsPNG() {
    map.once('render', () => {
        const canvas = map.getCanvas();
        const link = document.createElement('a');
        link.download = 'map.png';
        link.href = canvas.toDataURL();
        link.click();
    });
    map.triggerRepaint();
}

function exportGPX() {
    if (gpsTrack.length === 0) {
        alert('No GPS track recorded');
        return;
    }

    const gpx = generateGPX(gpsTrack);
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const link = document.createElement('a');
    link.download = 'gps-track.gpx';
    link.href = URL.createObjectURL(blob);
    link.click();
}

function generateGPX(track) {
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SPS OpenStreetMap">
  <trk>
    <name>GPS Track</name>
    <trkseg>`;

    track.forEach(point => {
        gpx += `
      <trkpt lat="${point[1]}" lon="${point[0]}">
        <time>${new Date().toISOString()}</time>
      </trkpt>`;
    });

    gpx += `
    </trkseg>
  </trk>
</gpx>`;

    return gpx;
}

// Add marker to map
function addMarker(lngLat, name = 'Location') {
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.width = '30px';
    el.style.height = '30px';
    el.style.backgroundImage = 'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtOSAxM3MtOS02LTktMTNhOSA5IDAgMCAxIDE4IDB6IiBmaWxsPSIjZTc0YzNjIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEwIiByPSIzIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4=)';
    el.style.backgroundSize = 'cover';
    el.style.cursor = 'pointer';

    const marker = new maplibregl.Marker({ element: el })
        .setLngLat(lngLat)
        .setPopup(new maplibregl.Popup().setHTML(`<strong>${name}</strong>`))
        .addTo(map);

    markers.push(marker);
}

// Update map info display
function updateMapInfo() {
    const center = map.getCenter();
    const zoom = map.getZoom();

    document.getElementById('map-zoom').textContent = `Zoom: ${zoom.toFixed(1)}`;
    document.getElementById('map-center').textContent =
        `Center: ${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;

    updateShareURL();
}

// Parse hash on load
window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash.startsWith('#map=')) {
        const parts = hash.substring(5).split('/');
        if (parts.length === 3) {
            const zoom = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            const lng = parseFloat(parts[2]);
            map.setCenter([lng, lat]);
            map.setZoom(zoom);
        }
    }
});

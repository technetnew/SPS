// Pictures Management
let currentPictures = [];
let currentAlbums = [];
let currentTags = [];
let selectedPictureId = null;
let selectedPicture = null;
let activeTab = 'gallery';
let thumbnailPreference = localStorage.getItem('picture_thumbnail_size') || 'medium';
let currentSearchQuery = '';
let currentTagFilter = '';
let currentAlbumFilter = '';
let currentPage = 1;
let pageSize = 24;
let totalPictures = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    authManager.init();
    loadPictures();
    loadAlbums();
    loadTags();
    initializeUploadForm();
    initializeCreateAlbumForm();
    initializeEditPictureForm();
    initializeThumbnailPreference();
});

// Tab switching
function switchTab(tabName, evt) {
    activeTab = tabName;

    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('active');
    } else {
        document.querySelectorAll('.tab').forEach(tab => {
            if (tab.textContent.toLowerCase().includes(tabName)) {
                tab.classList.add('active');
            }
        });
    }

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const tabContent = document.getElementById(`${tabName}-tab`);
    if (tabContent) tabContent.classList.add('active');

    if (tabName === 'albums' && currentAlbums.length === 0) {
        loadAlbums();
    } else if (tabName === 'tags' && currentTags.length === 0) {
        loadTags();
    }
}

// Load pictures
async function loadPictures(search = currentSearchQuery, tag = currentTagFilter, albumId = currentAlbumFilter) {
    try {
        currentSearchQuery = search || '';
        currentTagFilter = tag || '';
        currentAlbumFilter = albumId || '';

        let url = '/pictures';
        const params = new URLSearchParams();
        if (currentSearchQuery) params.append('search', currentSearchQuery);
        if (currentTagFilter) params.append('tag', currentTagFilter);
        if (currentAlbumFilter) params.append('album_id', currentAlbumFilter);
        params.append('page', currentPage);
        params.append('limit', pageSize);

        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await apiClient.get(url);
        currentPictures = (response.pictures || []).map(normalizePicture);
        totalPictures = response.count || currentPictures.length;

        renderPicturesGrid();
        updatePicturesStats();
    } catch (error) {
        console.error('Failed to load pictures:', error);
        document.getElementById('pictures-grid').innerHTML = '<div class="error-state">Failed to load pictures. Please try again.</div>';
    }
}

// Render pictures grid
function renderPicturesGrid() {
    const grid = document.getElementById('pictures-grid');

    if (currentPictures.length === 0) {
        grid.innerHTML = '<div class="empty-state">No pictures found. Upload your first picture!</div>';
        document.getElementById('picture-count').textContent = '';
        return;
    }

    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalPictures);
    document.getElementById('picture-count').textContent = `${from}-${to} of ${totalPictures}`;

    const cards = currentPictures.map(picture => {
        const thumbnailUrl = getThumbnailUrl(picture);
        return `
        <div class="picture-card" onclick="showPictureDetail(${picture.id})">
            <div class="picture-thumbnail" style="background-image: url('${thumbnailUrl}')"></div>
            <div class="picture-card-info">
                <h3>${escapeHtml(picture.title || picture.original_filename)}</h3>
                ${picture.tags && picture.tags.length > 0 ? `
                    <div class="picture-tags">
                        ${picture.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                        ${picture.tags.length > 3 ? `<span class="tag">+${picture.tags.length - 3}</span>` : ''}
                    </div>
                ` : ''}
                <p class="picture-meta">
                    ${formatBytes(picture.file_size)} •
                    ${picture.width && picture.height ? `${picture.width}×${picture.height}` : 'Unknown size'}
                </p>
            </div>
        </div>
    `;
    }).join('');
    grid.innerHTML = cards + renderPaginationControls();
}

function renderPaginationControls() {
    const totalPages = Math.max(1, Math.ceil(totalPictures / pageSize));
    if (totalPages <= 1) return '';

    return `
        <div class="picture-pagination">
            <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Previous</button>
            <span class="page-info">Page ${currentPage} of ${totalPages}</span>
            <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Next</button>
        </div>
    `;
}

function changePage(newPage) {
    const totalPages = Math.max(1, Math.ceil(totalPictures / pageSize));
    if (newPage < 1 || newPage > totalPages) return;
    currentPage = newPage;
    loadPictures();
}

// Load albums
async function loadAlbums() {
    try {
        const response = await apiClient.get('/pictures/albums/all');
        currentAlbums = (response.albums || []).map(album => ({
            ...album,
            cover_thumbnails: album.cover_thumbnails || null
        }));
        renderAlbumsGrid();
    } catch (error) {
        console.error('Failed to load albums:', error);
        document.getElementById('albums-grid').innerHTML = '<div class="error-state">Failed to load albums.</div>';
    }
}

// Render albums grid
function renderAlbumsGrid() {
    const grid = document.getElementById('albums-grid');

    if (currentAlbums.length === 0) {
        grid.innerHTML = '<div class="empty-state">No albums created yet. Create your first album!</div>';
        return;
    }

    grid.innerHTML = currentAlbums.map(album => `
        <div class="album-card" onclick="viewAlbum(${album.id})">
            <div class="album-thumbnail">
                ${album.cover_thumbnails ?
                    `<div class="album-cover" style="background-image: url('${album.cover_thumbnails[thumbnailPreference] || album.cover_thumbnails.medium}')"></div>` :
                    '<div class="album-placeholder">📁</div>'
                }
            </div>
            <div class="album-card-info">
                <h3>${escapeHtml(album.name)}</h3>
                <p>${album.picture_count || 0} picture${album.picture_count !== 1 ? 's' : ''}</p>
                ${album.description ? `<p class="album-description">${escapeHtml(album.description)}</p>` : ''}
            </div>
            <div class="album-actions">
                <button onclick="event.stopPropagation(); deleteAlbum(${album.id})" class="btn btn-sm btn-danger">Delete</button>
            </div>
        </div>
    `).join('');
}

// Load tags
async function loadTags() {
    try {
        const response = await apiClient.get('/pictures/tags/all');
        currentTags = response.tags || [];
        renderTagsCloud();
        updateTagFilter();
    } catch (error) {
        console.error('Failed to load tags:', error);
        document.getElementById('tags-cloud').innerHTML = '<div class="error-state">Failed to load tags.</div>';
    }
}

// Render tags cloud
function renderTagsCloud() {
    const cloud = document.getElementById('tags-cloud');

    if (currentTags.length === 0) {
        cloud.innerHTML = '<div class="empty-state">No tags available yet. Upload pictures and add tags!</div>';
        return;
    }

    cloud.innerHTML = currentTags.map(tag => `
        <div class="tag-cloud-item" onclick="filterByTag('${escapeHtml(tag.name)}')"
             style="${tag.color ? `background-color: ${tag.color}20; border-color: ${tag.color}` : ''}">
            <span class="tag-name">${escapeHtml(tag.name)}</span>
            <span class="tag-count">${tag.picture_count || 0}</span>
        </div>
    `).join('');
}

// Update tag filter dropdown
function updateTagFilter() {
    const filter = document.getElementById('tag-filter');
    filter.innerHTML = '<option value="">All Tags</option>' +
        currentTags.map(tag => `<option value="${escapeHtml(tag.name)}">${escapeHtml(tag.name)}</option>`).join('');
}

// Update stats
function updatePicturesStats() {
    document.getElementById('total-pictures').textContent = currentPictures.length;
    document.getElementById('total-albums').textContent = currentAlbums.length;
    document.getElementById('total-tags').textContent = currentTags.length;

    const totalSize = currentPictures.reduce((sum, p) => sum + (p.file_size || 0), 0);
    document.getElementById('total-size').textContent = formatBytes(totalSize);
}

// Search pictures
function searchPictures(query) {
    const tag = document.getElementById('tag-filter').value;
    loadPictures(query, tag);
}

// Filter by tag
function filterByTag(tagName) {
    document.getElementById('tag-filter').value = tagName;
    currentAlbumFilter = '';
    const search = document.getElementById('picture-search').value;
    loadPictures(search, tagName);

    switchTab('gallery');
}

// Sort pictures
function sortPictures(sortBy) {
    switch (sortBy) {
        case 'newest':
            currentPictures.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'oldest':
            currentPictures.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'name':
            currentPictures.sort((a, b) => (a.title || a.original_filename).localeCompare(b.title || b.original_filename));
            break;
        case 'size':
            currentPictures.sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
            break;
    }
    renderPicturesGrid();
}

// Show upload modal
function showUploadModal() {
    document.getElementById('upload-modal').style.display = 'block';
}

function hideUploadModal() {
    document.getElementById('upload-modal').style.display = 'none';
    document.getElementById('upload-form').reset();
    document.getElementById('upload-progress').style.display = 'none';
    document.getElementById('upload-error').style.display = 'none';
}

// Initialize upload form
function initializeUploadForm() {
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const files = document.getElementById('picture-files').files;
        if (files.length === 0) {
            showError('upload-error', 'Please select at least one picture');
            return;
        }

        const title = document.getElementById('picture-title').value;
        const description = document.getElementById('picture-description').value;
        const tags = document.getElementById('picture-tags').value;
        const location = document.getElementById('picture-location').value;

        document.getElementById('upload-progress').style.display = 'block';
        document.getElementById('upload-error').style.display = 'none';

        let uploaded = 0;
        const total = files.length;

        for (let i = 0; i < files.length; i++) {
            const formData = new FormData();
            formData.append('picture', files[i]);
            if (title) formData.append('title', title);
            if (description) formData.append('description', description);
            if (tags) formData.append('tags', tags);
            if (location) formData.append('location_name', location);

            try {
                await apiClient.upload('/pictures/upload', formData);
                uploaded++;

                const progress = (uploaded / total) * 100;
                document.getElementById('upload-progress-fill').style.width = progress + '%';
                document.getElementById('upload-status').textContent = `Uploaded ${uploaded} of ${total}`;
            } catch (error) {
                console.error('Upload error:', error);
                showError('upload-error', `Failed to upload ${files[i].name}`);
            }
        }

        if (uploaded === total) {
            hideUploadModal();
            loadPictures();
            loadTags();
        }
    });
}

async function rescanLibrary() {
    const btn = document.getElementById('rescan-library-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Rescanning...';
    }

    try {
        const response = await spsApi.request('/pictures/rescan', {
            method: 'POST',
            body: JSON.stringify({})
        });

        alert(response.message || 'Rescan completed');
        await loadPictures();
        await loadAlbums();
        await loadTags();
    } catch (error) {
        console.error('Rescan error:', error);
        alert(error.message || 'Failed to rescan library');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🔄 Rescan Library';
        }
    }
}

// Show create album modal
function showCreateAlbumModal() {
    document.getElementById('create-album-modal').style.display = 'block';
}

function hideCreateAlbumModal() {
    document.getElementById('create-album-modal').style.display = 'none';
    document.getElementById('create-album-form').reset();
    document.getElementById('create-album-error').style.display = 'none';
}

// Initialize create album form
function initializeCreateAlbumForm() {
    document.getElementById('create-album-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('album-name').value;
        const description = document.getElementById('album-description').value;

        try {
            await apiClient.post('/pictures/albums', {
                name,
                description
            });

            hideCreateAlbumModal();
            loadAlbums();
        } catch (error) {
            showError('create-album-error', error.message || 'Failed to create album');
        }
    });
}

// View album
function viewAlbum(albumId) {
    loadPictures(currentSearchQuery, currentTagFilter, albumId);
    switchTab('gallery');
}

// Delete album
async function deleteAlbum(albumId) {
    if (!confirm('Are you sure you want to delete this album? Pictures will not be deleted.')) {
        return;
    }

    try {
        await apiClient.delete(`/pictures/albums/${albumId}`);
        loadAlbums();
    } catch (error) {
        alert('Failed to delete album: ' + error.message);
    }
}

// Show picture detail
async function showPictureDetail(pictureId, pictureData = null) {
    try {
        let picture = pictureData ? normalizePicture(pictureData) : null;
        if (!picture) {
            const response = await apiClient.get(`/pictures/${pictureId}`);
            picture = normalizePicture(response.picture);
        }
        selectedPictureId = pictureId;
        selectedPicture = picture;

        const detailImage = document.getElementById('detail-image');
        const mainSource = (picture.thumbnails && (picture.thumbnails.large || picture.thumbnails.medium || picture.thumbnails.small))
            || picture.image_url
            || `/uploads/pictures/${picture.filename}`;
        detailImage.src = mainSource;
        detailImage.alt = picture.title || picture.original_filename;
        detailImage.dataset.pictureId = pictureId;
        document.getElementById('detail-title').textContent = picture.title || picture.original_filename;
        document.getElementById('detail-description').textContent = picture.description || 'No description';
        document.getElementById('detail-size').textContent = formatBytes(picture.file_size);
        document.getElementById('detail-dimensions').textContent = picture.width && picture.height ?
            `${picture.width} × ${picture.height}` : 'Unknown';
        document.getElementById('detail-format').textContent = picture.mime_type || 'Unknown';
        document.getElementById('detail-uploaded').textContent = new Date(picture.created_at).toLocaleString();
        document.getElementById('detail-location').textContent = picture.location_name || 'Not specified';

        // Render tags
        const tagsContainer = document.getElementById('detail-tags');
        if (picture.tags && picture.tags.length > 0) {
            tagsContainer.innerHTML = picture.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
        } else {
            tagsContainer.innerHTML = '<p>No tags</p>';
        }

        // Render albums
        const albumsContainer = document.getElementById('detail-albums');
        if (picture.albums && picture.albums.length > 0) {
            albumsContainer.innerHTML = picture.albums.map(album => `<span class="album-badge">${escapeHtml(album)}</span>`).join('');
        } else {
            albumsContainer.innerHTML = '<p>Not in any albums</p>';
        }

        document.getElementById('picture-detail-modal').style.display = 'block';
    } catch (error) {
        console.error('Failed to load picture details:', error);
        alert('Failed to load picture details');
    }
}

function hidePictureDetail() {
    document.getElementById('picture-detail-modal').style.display = 'none';
    selectedPictureId = null;
    selectedPicture = null;
}

// Delete picture
async function deletePicture() {
    if (!selectedPictureId) return;

    if (!confirm('Are you sure you want to delete this picture? This cannot be undone.')) {
        return;
    }

    try {
        await apiClient.delete(`/pictures/${selectedPictureId}`);
        hidePictureDetail();
        selectedPicture = null;
        loadPictures();
        loadTags();
    } catch (error) {
        alert('Failed to delete picture: ' + error.message);
    }
}

// Edit picture (placeholder)
function editPicture() {
    alert('Edit functionality coming soon!');
}

// Utility functions
function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    const gb = bytes / Math.pow(1024, 3);
    if (gb >= 1) {
        const decimals = gb >= 10 ? 1 : 2;
        return `${gb.toFixed(decimals)} GB`;
    }
    const mb = bytes / Math.pow(1024, 2);
    const decimals = mb >= 10 ? 1 : 2;
    return `${mb.toFixed(decimals)} MB`;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function normalizePicture(picture) {
    const thumbnails = picture.thumbnails || buildLegacyThumbnails(picture);
    return {
        ...picture,
        thumbnails,
        albums: picture.albums || [],
        album_ids: picture.album_ids || []
    };
}

function buildLegacyThumbnails(picture) {
    const base = `/uploads/pictures/${picture.filename}`;
    return {
        small: picture.thumbnail_small ? `/uploads/pictures/${picture.thumbnail_small}` : base,
        medium: picture.thumbnail_medium ? `/uploads/pictures/${picture.thumbnail_medium}` : base,
        large: picture.thumbnail_large ? `/uploads/pictures/${picture.thumbnail_large}` : base
    };
}

function getThumbnailUrl(picture) {
    if (!picture) return '';
    const thumbnails = picture.thumbnails || buildLegacyThumbnails(picture);
    return thumbnails[thumbnailPreference] || thumbnails.medium || thumbnails.small || `/uploads/pictures/${picture.filename}`;
}

function initializeThumbnailPreference() {
    const select = document.getElementById('thumbnail-size');
    if (select) {
        select.value = thumbnailPreference;
    }
}

function changeThumbnailSize(size) {
    thumbnailPreference = size || 'medium';
    localStorage.setItem('picture_thumbnail_size', thumbnailPreference);
    renderPicturesGrid();
}

function initializeEditPictureForm() {
    const form = document.getElementById('edit-picture-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePictureMetadata();
    });
}

async function editPicture() {
    if (!selectedPictureId) return;
    if (!selectedPicture) {
        await showPictureDetail(selectedPictureId);
    }

    if (!currentAlbums.length) {
        await loadAlbums();
    }

    const picture = selectedPicture || currentPictures.find(p => p.id === selectedPictureId);
    if (!picture) return;

    document.getElementById('edit-picture-title').value = picture.title || '';
    document.getElementById('edit-picture-description').value = picture.description || '';
    document.getElementById('edit-picture-tags').value = picture.tags ? picture.tags.join(', ') : '';
    document.getElementById('edit-picture-location').value = picture.location_name || '';
    document.getElementById('edit-picture-error').style.display = 'none';

    populateAlbumCheckboxes(picture.album_ids || []);
    document.getElementById('edit-picture-modal').style.display = 'block';
}

function hideEditPictureModal() {
    const modal = document.getElementById('edit-picture-modal');
    if (modal) modal.style.display = 'none';
}

async function savePictureMetadata() {
    if (!selectedPictureId) return;
    const payload = {
        title: document.getElementById('edit-picture-title').value.trim() || null,
        description: document.getElementById('edit-picture-description').value.trim() || null,
        location_name: document.getElementById('edit-picture-location').value.trim() || null,
        tags: parseTagsInput(document.getElementById('edit-picture-tags').value),
        album_ids: getSelectedAlbumIds()
    };

    try {
        await apiClient.put(`/pictures/${selectedPictureId}`, payload);
        hideEditPictureModal();
        await loadPictures();
        await loadAlbums();
        await loadTags();
        await showPictureDetail(selectedPictureId);
    } catch (error) {
        showError('edit-picture-error', error.message || 'Failed to save picture');
    }
}

function parseTagsInput(value) {
    if (!value) return [];
    return value.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
}

function populateAlbumCheckboxes(selectedAlbums = []) {
    const container = document.getElementById('edit-picture-albums');
    if (!container) return;

    const selectedSet = new Set((selectedPicture?.album_ids || selectedAlbums).map(id => String(id)));
    if (!currentAlbums.length) {
        container.innerHTML = '<p class="help-text">No albums yet. Create one to organize pictures.</p>';
        return;
    }

    container.innerHTML = currentAlbums.map(album => `
        <label>
            <input type="checkbox" name="edit-album-checkbox" value="${album.id}" ${selectedSet.has(String(album.id)) ? 'checked' : ''}>
            <span>${escapeHtml(album.name)}</span>
        </label>
    `).join('');
}

function getSelectedAlbumIds() {
    const inputs = document.querySelectorAll('input[name="edit-album-checkbox"]:checked');
    return Array.from(inputs).map(input => parseInt(input.value, 10)).filter(id => !isNaN(id));
}

function getCurrentPictureIndex() {
    return currentPictures.findIndex(p => p.id === selectedPictureId);
}

function showNextPicture() {
    const currentIndex = getCurrentPictureIndex();
    if (currentIndex === -1 || currentIndex + 1 >= currentPictures.length) {
        return false;
    }
    const nextPicture = currentPictures[currentIndex + 1];
    showPictureDetail(nextPicture.id, nextPicture);
    return true;
}

function showPreviousPicture() {
    const currentIndex = getCurrentPictureIndex();
    if (currentIndex <= 0) {
        return false;
    }
    const previousPicture = currentPictures[currentIndex - 1];
    showPictureDetail(previousPicture.id, previousPicture);
    return true;
}

function togglePictureFullscreen() {
    const preview = document.querySelector('.picture-preview');
    if (!preview) return;

    if (!document.fullscreenElement) {
        if (preview.requestFullscreen) {
            preview.requestFullscreen().catch(() => {});
        }
    } else {
        document.exitFullscreen().catch(() => {});
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

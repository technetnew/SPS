// Sharing functionality for SPS
// Allows users to share resources with other users

class SharingManager {
    constructor() {
        this.currentResource = null;
        this.init();
    }

    init() {
        // Create sharing modal if it doesn't exist
        if (!document.getElementById('sharing-modal')) {
            this.createSharingModal();
        }
    }

    createSharingModal() {
        const modal = document.createElement('div');
        modal.id = 'sharing-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="sharingManager.closeSharingModal()">&times;</span>
                <h2>Share Resource</h2>

                <div class="sharing-form">
                    <div class="form-group">
                        <label>Search for user to share with:</label>
                        <input type="text" id="share-user-search" placeholder="Search by username or email..." autocomplete="off">
                        <div id="share-user-results" class="search-results"></div>
                    </div>

                    <div class="form-group">
                        <label>Permission Level:</label>
                        <select id="share-permission-level">
                            <option value="view">View Only</option>
                            <option value="edit">Can Edit</option>
                            <option value="admin">Full Access</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="share-expires">
                            Set expiration date
                        </label>
                        <input type="datetime-local" id="share-expires-at" style="display: none;">
                    </div>

                    <button onclick="sharingManager.shareResource()" class="btn btn-primary">
                        Share
                    </button>
                </div>

                <hr style="margin: 2rem 0;">

                <h3>Currently Shared With:</h3>
                <div id="current-shares-list"></div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        const searchInput = document.getElementById('share-user-search');
        searchInput.addEventListener('input', (e) => this.searchUsers(e.target.value));

        const expiresCheckbox = document.getElementById('share-expires');
        const expiresInput = document.getElementById('share-expires-at');
        expiresCheckbox.addEventListener('change', (e) => {
            expiresInput.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    async openSharingModal(resourceType, resourceId, resourceName = '') {
        this.currentResource = {
            type: resourceType,
            id: resourceId,
            name: resourceName
        };

        const modal = document.getElementById('sharing-modal');
        modal.style.display = 'block';

        // Update modal title
        const title = modal.querySelector('h2');
        title.textContent = `Share: ${resourceName || resourceType}`;

        // Load current shares
        await this.loadCurrentShares();
    }

    closeSharingModal() {
        const modal = document.getElementById('sharing-modal');
        modal.style.display = 'none';

        // Reset form
        document.getElementById('share-user-search').value = '';
        document.getElementById('share-user-results').innerHTML = '';
        document.getElementById('share-permission-level').value = 'view';
        document.getElementById('share-expires').checked = false;
        document.getElementById('share-expires-at').style.display = 'none';
    }

    async searchUsers(query) {
        const resultsDiv = document.getElementById('share-user-results');

        if (query.length < 2) {
            resultsDiv.innerHTML = '';
            return;
        }

        try {
            const response = await spsApi.request(`/sharing/search-users?q=${encodeURIComponent(query)}`);
            const users = response.users;

            if (users.length === 0) {
                resultsDiv.innerHTML = '<div class="search-result-item">No users found</div>';
                return;
            }

            resultsDiv.innerHTML = users.map(user => `
                <div class="search-result-item" onclick="sharingManager.selectUser(${user.id}, '${escapeHtml(user.username)}')">
                    <strong>${escapeHtml(user.username)}</strong>
                    ${user.first_name ? `<span>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name || '')}</span>` : ''}
                    <span class="email">${escapeHtml(user.email)}</span>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }

    selectUser(userId, username) {
        this.selectedUser = { id: userId, username };
        document.getElementById('share-user-search').value = username;
        document.getElementById('share-user-results').innerHTML = '';
    }

    async shareResource() {
        if (!this.currentResource) {
            alert('No resource selected');
            return;
        }

        if (!this.selectedUser) {
            alert('Please select a user to share with');
            return;
        }

        const permissionLevel = document.getElementById('share-permission-level').value;
        const expiresCheckbox = document.getElementById('share-expires').checked;
        const expiresAt = expiresCheckbox ? document.getElementById('share-expires-at').value : null;

        try {
            await spsApi.request('/sharing/share', {
                method: 'POST',
                body: JSON.stringify({
                    shared_with_user_id: this.selectedUser.id,
                    resource_type: this.currentResource.type,
                    resource_id: this.currentResource.id,
                    permission_level: permissionLevel,
                    expires_at: expiresAt
                })
            });

            showNotification(`Shared with ${this.selectedUser.username}`, 'success');

            // Reset selection
            this.selectedUser = null;
            document.getElementById('share-user-search').value = '';

            // Reload current shares
            await this.loadCurrentShares();
        } catch (error) {
            console.error('Error sharing resource:', error);
            showNotification('Failed to share resource', 'error');
        }
    }

    async loadCurrentShares() {
        const listDiv = document.getElementById('current-shares-list');

        try {
            const response = await spsApi.request(
                `/sharing/${this.currentResource.type}/${this.currentResource.id}/users`
            );
            const shares = response.users;

            if (shares.length === 0) {
                listDiv.innerHTML = '<p class="empty-state">Not shared with anyone yet</p>';
                return;
            }

            listDiv.innerHTML = shares.map(share => `
                <div class="share-item">
                    <div class="share-user-info">
                        <strong>${escapeHtml(share.username)}</strong>
                        ${share.first_name ? `<span>${escapeHtml(share.first_name)} ${escapeHtml(share.last_name || '')}</span>` : ''}
                        <span class="email">${escapeHtml(share.email)}</span>
                    </div>
                    <div class="share-permissions">
                        <select onchange="sharingManager.updatePermission(${share.id}, this.value)">
                            <option value="view" ${share.permission_level === 'view' ? 'selected' : ''}>View</option>
                            <option value="edit" ${share.permission_level === 'edit' ? 'selected' : ''}>Edit</option>
                            <option value="admin" ${share.permission_level === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        <button onclick="sharingManager.revokeAccess(${share.id})" class="btn btn-danger btn-sm">
                            Revoke
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading shares:', error);
            listDiv.innerHTML = '<p class="error">Failed to load sharing information</p>';
        }
    }

    async updatePermission(shareId, permissionLevel) {
        try {
            await spsApi.request(`/sharing/share/${shareId}`, {
                method: 'PUT',
                body: JSON.stringify({ permission_level: permissionLevel })
            });

            showNotification('Permission updated', 'success');
        } catch (error) {
            console.error('Error updating permission:', error);
            showNotification('Failed to update permission', 'error');
        }
    }

    async revokeAccess(shareId) {
        if (!confirm('Revoke access for this user?')) {
            return;
        }

        try {
            await spsApi.request(`/sharing/share/${shareId}`, {
                method: 'DELETE'
            });

            showNotification('Access revoked', 'success');
            await this.loadCurrentShares();
        } catch (error) {
            console.error('Error revoking access:', error);
            showNotification('Failed to revoke access', 'error');
        }
    }

    // Helper function to add share button to any page
    static addShareButton(containerSelector, resourceType, resourceId, resourceName = '') {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        const shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-secondary btn-sm share-btn';
        shareBtn.innerHTML = '🔗 Share';
        shareBtn.onclick = () => {
            if (!window.sharingManager) {
                window.sharingManager = new SharingManager();
            }
            sharingManager.openSharingModal(resourceType, resourceId, resourceName);
        };

        container.appendChild(shareBtn);
    }
}

// Initialize global sharing manager
let sharingManager;
document.addEventListener('DOMContentLoaded', () => {
    sharingManager = new SharingManager();
});

// Helper function (reuse from other files or define here)
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

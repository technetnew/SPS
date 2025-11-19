// SPS API Client Library

class SPSApiClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.token = localStorage.getItem('sps_token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('sps_token', token);
        } else {
            localStorage.removeItem('sps_token');
        }
    }

    getToken() {
        return this.token;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Authentication
    async register(userData) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        if (data.token) {
            this.setToken(data.token);
        }
        return data;
    }

    async login(credentials) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        if (data.token) {
            this.setToken(data.token);
        }
        return data;
    }

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } finally {
            this.setToken(null);
        }
    }

    async getProfile() {
        return await this.request('/auth/me');
    }

    async updateProfile(profileData) {
        return await this.request('/auth/me', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    // Inventory
    async getInventory(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/inventory?${queryString}` : '/inventory';
        return await this.request(endpoint);
    }

    async getInventoryItem(id) {
        return await this.request(`/inventory/${id}`);
    }

    async createInventoryItem(itemData) {
        return await this.request('/inventory', {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
    }

    async updateInventoryItem(id, itemData) {
        return await this.request(`/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify(itemData)
        });
    }

    async deleteInventoryItem(id) {
        return await this.request(`/inventory/${id}`, {
            method: 'DELETE'
        });
    }

    async getInventoryStats() {
        return await this.request('/inventory/stats/overview');
    }

    async getCategories() {
        return await this.request('/inventory/categories/all');
    }

    // Emergency Plans
    async getPlans() {
        return await this.request('/plans');
    }

    async createPlan(planData) {
        return await this.request('/plans', {
            method: 'POST',
            body: JSON.stringify(planData)
        });
    }

    // Family Members
    async getFamilyMembers() {
        return await this.request('/family');
    }

    // Skills
    async getSkills() {
        return await this.request('/skills');
    }

    async getUserSkills() {
        return await this.request('/skills/my-skills');
    }

    // Alerts
    async getAlerts() {
        return await this.request('/alerts');
    }

    async markAlertRead(id) {
        return await this.request(`/alerts/${id}/read`, {
            method: 'PUT'
        });
    }

    // Helper Methods
    isAuthenticated() {
        return !!this.token;
    }
}

// Export global instance
const spsApi = new SPSApiClient();

// Authentication Management

class AuthManager {
    constructor() {
        this.user = null;
        this.init();
    }

    async init() {
        if (spsApi.isAuthenticated()) {
            try {
                await this.loadUser();
            } catch (error) {
                console.error('Failed to load user:', error);
                spsApi.setToken(null);
            }
        }
        this.updateUI();
        this.checkPageAccess();
    }

    checkPageAccess() {
        const currentPage = window.location.pathname;
        const protectedPages = ['/dashboard.html', '/videos.html', '/kiwix.html'];
        const publicPages = ['/', '/index.html'];

        // If on a protected page and not authenticated, redirect to home
        if (protectedPages.includes(currentPage) && !this.isAuthenticated()) {
            window.location.href = '/index.html';
            return;
        }

        // If on home page and authenticated, redirect to dashboard
        if (publicPages.includes(currentPage) && this.isAuthenticated()) {
            window.location.href = '/dashboard.html';
            return;
        }
    }

    async loadUser() {
        const response = await spsApi.getProfile();
        this.user = response.user;
        return this.user;
    }

    async login(username, password) {
        const response = await spsApi.login({ username, password });
        this.user = response.user;
        this.updateUI();
        return response;
    }

    async register(userData) {
        const response = await spsApi.register(userData);
        this.user = response.user;
        this.updateUI();
        return response;
    }

    async logout() {
        await spsApi.logout();
        this.user = null;
        this.updateUI();
        window.location.href = '/';
    }

    isAuthenticated() {
        return !!this.user;
    }

    getUser() {
        return this.user;
    }

    updateUI() {
        const authButtons = document.getElementById('auth-buttons');
        const userSection = document.getElementById('user-section');

        if (this.isAuthenticated()) {
            if (authButtons) authButtons.style.display = 'none';
            if (userSection) {
                userSection.style.display = 'flex';
                const userNameSpan = document.getElementById('user-name');
                if (userNameSpan) {
                    userNameSpan.textContent = this.user.first_name || this.user.username;
                }
            }
        } else {
            if (authButtons) authButtons.style.display = 'flex';
            if (userSection) userSection.style.display = 'none';
        }
    }

    showLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) modal.style.display = 'block';
    }

    showRegisterModal() {
        const modal = document.getElementById('register-modal');
        if (modal) modal.style.display = 'block';
    }

    hideModals() {
        const modals = document.querySelectorAll('.auth-modal');
        modals.forEach(modal => modal.style.display = 'none');
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// Login form handler
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorDiv = document.getElementById('login-error');

            try {
                await authManager.login(username, password);
                authManager.hideModals();
                showNotification('Login successful!', 'success');

                // Redirect to dashboard if exists
                if (window.location.pathname === '/') {
                    window.location.href = '/dashboard.html';
                } else {
                    window.location.reload();
                }
            } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
        });
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userData = {
                username: document.getElementById('register-username').value,
                email: document.getElementById('register-email').value,
                password: document.getElementById('register-password').value,
                first_name: document.getElementById('register-firstname').value,
                last_name: document.getElementById('register-lastname').value
            };
            const errorDiv = document.getElementById('register-error');

            try {
                await authManager.register(userData);
                authManager.hideModals();
                showNotification('Registration successful!', 'success');
                window.location.href = '/dashboard.html';
            } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
            }
        });
    }
});

// Utility function for notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

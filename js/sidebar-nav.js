/**
 * SPS Sidebar Navigation System
 * Handles sidebar toggle, submenu expansion, active states
 */

const SPSNav = {
    sidebar: null,
    isCollapsed: false,
    isMobileOpen: false,

    init() {
        this.sidebar = document.querySelector('.sps-sidebar');
        if (!this.sidebar) return;

        this.loadState();
        this.bindEvents();
        this.setActiveLink();
        this.updateOnlineStatus();

        // Check online status periodically
        setInterval(() => this.updateOnlineStatus(), 30000);
    },

    loadState() {
        const collapsed = localStorage.getItem('sps_sidebar_collapsed');
        if (collapsed === 'true') {
            this.isCollapsed = true;
            this.sidebar.classList.add('collapsed');
        }
    },

    saveState() {
        localStorage.setItem('sps_sidebar_collapsed', this.isCollapsed);
    },

    bindEvents() {
        // Toggle button
        const toggleBtn = document.querySelector('.sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }

        // Mobile menu button
        const mobileBtn = document.querySelector('.mobile-menu-btn');
        if (mobileBtn) {
            mobileBtn.addEventListener('click', () => this.toggleMobile());
        }

        // Submenu toggles
        document.querySelectorAll('.nav-link[data-toggle="submenu"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleSubmenu(link.closest('.nav-item'));
            });
        });

        // Close mobile menu on link click
        document.querySelectorAll('.sps-sidebar .nav-link:not([data-toggle="submenu"])').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    this.closeMobile();
                }
            });
        });

        // Close mobile menu on outside click
        document.addEventListener('click', (e) => {
            if (this.isMobileOpen &&
                !this.sidebar.contains(e.target) &&
                !e.target.closest('.mobile-menu-btn')) {
                this.closeMobile();
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMobileOpen) {
                this.closeMobile();
            }
        });
    },

    toggle() {
        this.isCollapsed = !this.isCollapsed;
        this.sidebar.classList.toggle('collapsed', this.isCollapsed);
        this.saveState();
    },

    toggleMobile() {
        this.isMobileOpen = !this.isMobileOpen;
        this.sidebar.classList.toggle('mobile-open', this.isMobileOpen);
    },

    closeMobile() {
        this.isMobileOpen = false;
        this.sidebar.classList.remove('mobile-open');
    },

    toggleSubmenu(navItem) {
        const wasExpanded = navItem.classList.contains('expanded');

        // Close all other submenus
        document.querySelectorAll('.nav-item.expanded').forEach(item => {
            if (item !== navItem) {
                item.classList.remove('expanded');
            }
        });

        // Toggle current submenu
        navItem.classList.toggle('expanded', !wasExpanded);
    },

    setActiveLink() {
        const currentPath = window.location.pathname;
        const currentPage = currentPath.split('/').pop() || 'index.html';

        document.querySelectorAll('.sps-sidebar .nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;

            const linkPage = href.split('/').pop();

            if (linkPage === currentPage || (currentPage === '' && linkPage === 'index.html')) {
                link.classList.add('active');

                // Expand parent submenu if in submenu
                const parentItem = link.closest('.nav-submenu')?.closest('.nav-item');
                if (parentItem) {
                    parentItem.classList.add('expanded');
                }
            } else {
                link.classList.remove('active');
            }
        });
    },

    updateOnlineStatus() {
        const statusEl = document.querySelector('.header-status');
        if (!statusEl) return;

        const isOnline = navigator.onLine;
        statusEl.classList.toggle('offline', !isOnline);
        statusEl.innerHTML = isOnline
            ? '<span class="status-dot"></span> Online'
            : '<span class="status-dot"></span> Offline Mode';
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => SPSNav.init());

// Export for use in other modules
window.SPSNav = SPSNav;

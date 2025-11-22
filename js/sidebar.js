/**
 * SPS Collapsible Sidebar Navigation
 * Provides a consistent sidebar navigation across all pages
 * Excludes: index.html, gps.html
 */

// Sidebar state
let sidebarCollapsed = localStorage.getItem('sps_sidebar_collapsed') === 'true';

// Navigation items configuration
const sidebarNavItems = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
        href: '/dashboard.html'
    },
    {
        id: 'inventory',
        label: 'Inventory',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
        href: '/inventory.html'
    },
    {
        id: 'pantry',
        label: 'Food Pantry',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>',
        href: '/pantry.html'
    },
    {
        id: 'garden',
        label: 'Garden',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 1 7.38 16.75"></path><path d="M12 2a10 10 0 0 0-7.38 16.75"></path><path d="M12 2v8"></path><circle cx="12" cy="14" r="4"></circle><path d="M12 18v4"></path><path d="M8 14h8"></path></svg>',
        href: '/garden.html'
    },
    {
        id: 'media',
        label: 'Media',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
        submenu: [
            { label: 'Videos', href: '/videos.html' },
            { label: 'Pictures', href: '/pictures.html' }
        ]
    },
    {
        id: 'kiwix',
        label: 'Kiwix Library',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
        href: '/kiwix.html'
    },
    {
        id: 'maps',
        label: 'Maps',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>',
        submenu: [
            { label: 'Map View', href: '/gps.html' },
            { label: 'Sync Maps', href: '/osm-sync.html' }
        ]
    },
    {
        id: 'tools',
        label: 'Tools',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>',
        submenu: [
            { label: 'Family Profile', href: '/familyprofile.html' },
            { label: 'Calculations', href: '/calculations.html' },
            { label: 'Simulation & Planning', href: '/simulation.html' },
            { label: 'Energy Calculator', href: '/energy.html' },
            { label: 'Medical Guide', href: '/medical.html' },
            { label: 'Settings', href: '/settings.html' }
        ]
    }
];

/**
 * Initialize sidebar on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Check if this page should have a sidebar
    const currentPath = window.location.pathname;
    const excludedPages = ['/index.html', '/gps.html', '/'];

    if (excludedPages.some(p => currentPath === p || currentPath.endsWith(p))) {
        return; // Don't add sidebar to excluded pages
    }

    injectSidebar();
    initSidebarEvents();
    highlightActiveSidebarLink();
});

/**
 * Inject sidebar HTML into the page
 */
function injectSidebar() {
    // Create sidebar container
    const sidebar = document.createElement('aside');
    sidebar.id = 'app-sidebar';
    sidebar.className = `app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`;

    // Build navigation HTML
    let navHtml = `
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <span class="logo-icon">SPS</span>
                <span class="logo-text">Survival Prep</span>
            </div>
            <button class="sidebar-toggle" onclick="toggleSidebar()" title="Toggle Sidebar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
        </div>
        <nav class="sidebar-nav">
            <ul class="sidebar-menu">
    `;

    sidebarNavItems.forEach(item => {
        if (item.submenu) {
            navHtml += `
                <li class="sidebar-item has-submenu">
                    <a href="#" class="sidebar-link" data-id="${item.id}" onclick="toggleSubmenu(event, '${item.id}')">
                        <span class="sidebar-icon">${item.icon}</span>
                        <span class="sidebar-label">${item.label}</span>
                        <svg class="submenu-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </a>
                    <ul class="sidebar-submenu" id="submenu-${item.id}">
                        ${item.submenu.map(sub => `
                            <li><a href="${sub.href}" class="sidebar-sublink">${sub.label}</a></li>
                        `).join('')}
                    </ul>
                </li>
            `;
        } else {
            navHtml += `
                <li class="sidebar-item">
                    <a href="${item.href}" class="sidebar-link" data-id="${item.id}">
                        <span class="sidebar-icon">${item.icon}</span>
                        <span class="sidebar-label">${item.label}</span>
                    </a>
                </li>
            `;
        }
    });

    navHtml += `
            </ul>
        </nav>
        <div class="sidebar-footer">
            <a href="/index.html" class="sidebar-link">
                <span class="sidebar-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </span>
                <span class="sidebar-label">Home</span>
            </a>
            <div class="sidebar-user" id="sidebar-user-section" style="display: none;">
                <div class="sidebar-user-name" id="sidebar-username">User</div>
                <button class="sidebar-logout" onclick="sidebarLogout()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Logout
                </button>
            </div>
        </div>
    `;

    sidebar.innerHTML = navHtml;

    // Wrap existing content
    const body = document.body;
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content-wrapper';

    // Move all body children to wrapper
    while (body.firstChild) {
        mainContent.appendChild(body.firstChild);
    }

    // Create app container
    const appContainer = document.createElement('div');
    appContainer.className = `app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`;
    appContainer.appendChild(sidebar);
    appContainer.appendChild(mainContent);

    body.appendChild(appContainer);

    // Hide the old navbar if it exists
    const oldNav = mainContent.querySelector('header nav.navbar');
    if (oldNav) {
        const header = oldNav.closest('header');
        if (header) {
            header.style.display = 'none';
        }
    }

    // Add mobile toggle button
    const mobileToggle = document.createElement('button');
    mobileToggle.className = 'mobile-sidebar-toggle';
    mobileToggle.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
    `;
    mobileToggle.onclick = toggleSidebar;
    mainContent.insertBefore(mobileToggle, mainContent.firstChild);
}

/**
 * Initialize sidebar events
 */
function initSidebarEvents() {
    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('app-sidebar');
            const mobileToggle = document.querySelector('.mobile-sidebar-toggle');

            if (sidebar && !sidebar.contains(e.target) && !mobileToggle?.contains(e.target)) {
                sidebar.classList.add('collapsed');
                document.querySelector('.app-container')?.classList.add('sidebar-collapsed');
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            // Restore saved state on desktop
            const sidebar = document.getElementById('app-sidebar');
            const appContainer = document.querySelector('.app-container');

            if (sidebarCollapsed) {
                sidebar?.classList.add('collapsed');
                appContainer?.classList.add('sidebar-collapsed');
            } else {
                sidebar?.classList.remove('collapsed');
                appContainer?.classList.remove('sidebar-collapsed');
            }
        }
    });
}

/**
 * Toggle sidebar collapsed state
 */
function toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const appContainer = document.querySelector('.app-container');

    if (!sidebar) return;

    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle('collapsed', sidebarCollapsed);
    appContainer?.classList.toggle('sidebar-collapsed', sidebarCollapsed);

    // Save state
    localStorage.setItem('sps_sidebar_collapsed', sidebarCollapsed);
}

/**
 * Toggle submenu open/close
 */
function toggleSubmenu(event, menuId) {
    event.preventDefault();

    const submenu = document.getElementById(`submenu-${menuId}`);
    const parentItem = submenu?.closest('.sidebar-item');

    if (!submenu || !parentItem) return;

    // Close other submenus
    document.querySelectorAll('.sidebar-item.has-submenu').forEach(item => {
        if (item !== parentItem) {
            item.classList.remove('open');
        }
    });

    // Toggle current submenu
    parentItem.classList.toggle('open');
}

/**
 * Highlight active sidebar link
 */
function highlightActiveSidebarLink() {
    const currentPath = window.location.pathname;

    document.querySelectorAll('.sidebar-link, .sidebar-sublink').forEach(link => {
        link.classList.remove('active');

        const href = link.getAttribute('href');
        if (!href || href === '#') return;

        if (currentPath === href || currentPath.endsWith(href)) {
            link.classList.add('active');

            // Open parent submenu if this is a sublink
            const submenu = link.closest('.sidebar-submenu');
            if (submenu) {
                submenu.closest('.sidebar-item')?.classList.add('open');
            }
        }
    });
}

/**
 * Update sidebar user section
 */
function updateSidebarUser() {
    const userSection = document.getElementById('sidebar-user-section');
    const usernameEl = document.getElementById('sidebar-username');

    if (!userSection) return;

    // Check both token keys for compatibility
    const token = localStorage.getItem('token') || localStorage.getItem('sps_token');
    const username = localStorage.getItem('username');

    if (token) {
        usernameEl.textContent = username || 'User';
        userSection.style.display = 'block';
    } else {
        userSection.style.display = 'none';
    }
}

/**
 * Sidebar logout function
 */
function sidebarLogout() {
    // Clear all auth-related items
    localStorage.removeItem('token');
    localStorage.removeItem('sps_token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');

    // Clear sessionStorage too
    sessionStorage.clear();

    // Clear caches if available
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }

    // Force reload without cache
    window.location.href = '/index.html?logout=' + Date.now();
}

// Check user on load
setTimeout(updateSidebarUser, 500);

// Export functions
window.toggleSidebar = toggleSidebar;
window.toggleSubmenu = toggleSubmenu;
window.sidebarLogout = sidebarLogout;
window.updateSidebarUser = updateSidebarUser;

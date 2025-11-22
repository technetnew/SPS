// Dynamic Navigation Menu
// Automatically highlights the active menu item based on the current page

document.addEventListener('DOMContentLoaded', () => {
    highlightActiveNavLink();
});

function highlightActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');

    const normalizePath = (path) => {
        if (!path) return null;
        return path.startsWith('/') ? path : '/' + path;
    };

    const matchesPath = (targetPath) => {
        if (!targetPath) return false;
        return currentPath === targetPath ||
            (currentPath === '/' && targetPath === '/index.html') ||
            (currentPath === '/index.html' && targetPath === '/') ||
            currentPath.endsWith(targetPath);
    };

    navLinks.forEach(link => {
        link.classList.remove('active');

        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) {
            return;
        }

        const linkPath = normalizePath(href);
        const additional = (link.dataset.activePaths || '')
            .split(',')
            .map(path => path.trim())
            .filter(Boolean)
            .map(normalizePath)
            .filter(Boolean);

        const pathsToMatch = [linkPath, ...additional.filter(path => path !== linkPath)];

        if (pathsToMatch.some(matchesPath)) {
            link.classList.add('active');
        }
    });

    const hasActive = Array.from(navLinks).some(link => link.classList.contains('active'));
    if (!hasActive && (currentPath === '/' || currentPath === '/index.html' || currentPath.endsWith('/index.html'))) {
        const homeLink = Array.from(navLinks).find(link => {
            const href = link.getAttribute('href');
            return href === '/' || href === '/index.html' || href === 'index.html';
        });
        if (homeLink) {
            homeLink.classList.add('active');
        }
    }
}

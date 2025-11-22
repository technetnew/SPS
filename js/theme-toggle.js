/**
 * SPS Theme Toggle
 * Handles dark/light mode switching across all pages
 */

(function() {
    'use strict';

    // Initialize theme on page load (before DOM ready to prevent flash)
    const savedTheme = localStorage.getItem('sps-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.body.setAttribute('data-theme', savedTheme);

    // Theme toggle function
    window.toggleTheme = function() {
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.body.setAttribute('data-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('sps-theme', newTheme);

        updateThemeIcons(newTheme);
    };

    // Update theme icons visibility
    function updateThemeIcons(theme) {
        const sunIcons = document.querySelectorAll('.sun-icon');
        const moonIcons = document.querySelectorAll('.moon-icon');

        sunIcons.forEach(icon => {
            icon.style.display = theme === 'dark' ? 'none' : 'block';
        });

        moonIcons.forEach(icon => {
            icon.style.display = theme === 'dark' ? 'block' : 'none';
        });
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        const savedTheme = localStorage.getItem('sps-theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        updateThemeIcons(savedTheme);
    });
})();

/**
 * APT Intelligence Dashboard - Accessibility Announcer
 * 
 * Provides screen reader announcements for dynamic content changes.
 * 
 * @module a11yAnnouncer
 * @version 1.0.0
 */

const A11yAnnouncer = (function() {
    'use strict';

    // =========================================================================
    // STATE
    // =========================================================================

    let politeRegion = null;
    let assertiveRegion = null;
    let debounceTimer = null;

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initializes the announcer regions
     */
    function init() {
        // Get or create polite region
        politeRegion = document.getElementById('sr-announcer');
        if (!politeRegion) {
            politeRegion = createRegion('sr-announcer', 'polite');
        }

        // Get or create assertive region
        assertiveRegion = document.getElementById('sr-announcer-assertive');
        if (!assertiveRegion) {
            assertiveRegion = createRegion('sr-announcer-assertive', 'assertive');
        }

        console.log('[A11yAnnouncer] Initialized');
    }

    /**
     * Creates an announcement region
     */
    function createRegion(id, level) {
        const region = document.createElement('div');
        region.id = id;
        region.className = 'visually-hidden';
        region.setAttribute('aria-live', level);
        region.setAttribute('aria-atomic', 'true');
        document.body.appendChild(region);
        return region;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        init,

        /**
         * Announces a message to screen readers (polite)
         * Use for non-urgent updates like search results
         * @param {string} message - Message to announce
         * @param {number} [delay=100] - Delay before announcement (debounce)
         */
        announce: function(message, delay = 100) {
            if (!politeRegion) init();

            // Debounce rapid announcements
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                // Clear then set (ensures announcement)
                politeRegion.textContent = '';
                requestAnimationFrame(() => {
                    politeRegion.textContent = message;
                });
            }, delay);
        },

        /**
         * Announces an urgent message (assertive)
         * Use for errors, critical alerts
         * @param {string} message - Message to announce
         */
        announceUrgent: function(message) {
            if (!assertiveRegion) init();

            assertiveRegion.textContent = '';
            requestAnimationFrame(() => {
                assertiveRegion.textContent = message;
            });
        },

        /**
         * Announces search/filter results
         * @param {number} count - Number of results
         * @param {string} [context='threat actors'] - What was searched
         */
        announceResults: function(count, context = 'threat actors') {
            const message = count === 0 
                ? `No ${context} found`
                : count === 1
                    ? `1 ${context.replace(/s$/, '')} found`
                    : `${count} ${context} found`;
            
            this.announce(message, 300);
        },

        /**
         * Announces view change
         * @param {string} viewName - Name of the view
         */
        announceViewChange: function(viewName) {
            this.announce(`Switched to ${viewName} view`);
        },

        /**
         * Announces loading state
         * @param {boolean} isLoading - Whether loading is in progress
         * @param {string} [context='data'] - What is loading
         */
        announceLoading: function(isLoading, context = 'data') {
            if (isLoading) {
                this.announce(`Loading ${context}...`);
            } else {
                this.announce(`${context} loaded`);
            }
        },

        /**
         * Announces filter change
         * @param {string} filterName - Name of the filter
         * @param {string} value - Filter value or state
         */
        announceFilter: function(filterName, value) {
            this.announce(`Filter ${filterName}: ${value}`, 200);
        },

        /**
         * Announces error
         * @param {string} message - Error message
         */
        announceError: function(message) {
            this.announceUrgent(`Error: ${message}`);
        }
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', A11yAnnouncer.init);
} else {
    A11yAnnouncer.init();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = A11yAnnouncer;
}


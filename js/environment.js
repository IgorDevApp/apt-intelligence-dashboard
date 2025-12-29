/**
 * APT Intelligence Dashboard - Environment Detector
 * 
 * Detects runtime environment and exposes capabilities.
 * Used to adapt behavior for file:// vs HTTP deployment.
 * 
 * @module environment
 * @version 1.0.0
 */

const Environment = (function() {
    'use strict';

    // =========================================================================
    // DETECTION
    // =========================================================================

    /**
     * Performs environment detection
     * @returns {Object} Environment information
     */
    function detect() {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        const href = window.location.href;

        // Protocol detection
        const isFileProtocol = protocol === 'file:';
        const isHttps = protocol === 'https:';
        const isHttp = protocol === 'http:';

        // Host detection
        const isLocalhost = ['localhost', '127.0.0.1', ''].includes(hostname);
        const isGitHubPages = hostname.endsWith('.github.io');
        const isNetlify = hostname.endsWith('.netlify.app');
        const isVercel = hostname.endsWith('.vercel.app');

        // Derived capabilities
        const canFetchExternal = !isFileProtocol;
        const canUseCORS = !isFileProtocol;
        const canUseIndexedDB = !isFileProtocol; // Limited in file://
        const canUseServiceWorker = isHttps || isLocalhost;

        // Determine environment name
        let name = 'unknown';
        if (isFileProtocol) name = 'file://';
        else if (isLocalhost) name = 'localhost';
        else if (isGitHubPages) name = 'GitHub Pages';
        else if (isNetlify) name = 'Netlify';
        else if (isVercel) name = 'Vercel';
        else if (isHttps) name = 'HTTPS';
        else if (isHttp) name = 'HTTP';

        return {
            // Raw values
            protocol,
            hostname,
            href,

            // Environment flags
            isFileProtocol,
            isLocalhost,
            isGitHubPages,
            isNetlify,
            isVercel,
            isProduction: isGitHubPages || isNetlify || isVercel,
            isDevelopment: isLocalhost,
            isOffline: isFileProtocol,
            isOnline: !isFileProtocol,

            // Capabilities
            canFetchExternal,
            canUseCORS,
            canUseIndexedDB,
            canUseServiceWorker,

            // Display name
            name
        };
    }

    // Perform detection once at load
    const env = detect();

    // =========================================================================
    // LOGGING
    // =========================================================================

    // Log environment on load
    console.log(`[Environment] Detected: ${env.name}`, {
        canFetchExternal: env.canFetchExternal,
        canUseCORS: env.canUseCORS,
        canUseIndexedDB: env.canUseIndexedDB
    });

    if (env.isFileProtocol) {
        console.log('[Environment] Running in offline mode - external data sources disabled');
        console.log('[Environment] Tip: Serve via HTTP for live data (python -m http.server 8000)');
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        // All detected properties
        ...env,

        // Re-run detection (useful after navigation)
        detect,

        /**
         * Gets a summary string for display
         * @returns {string}
         */
        getSummary: function() {
            if (env.isFileProtocol) {
                return 'Offline Mode (file://)';
            } else if (env.isGitHubPages) {
                return 'GitHub Pages';
            } else if (env.isLocalhost) {
                return 'Development (localhost)';
            } else {
                return 'Online';
            }
        },

        /**
         * Gets a detailed status for debugging
         * @returns {Object}
         */
        getStatus: function() {
            return { ...env };
        },

        /**
         * Checks if a specific capability is available
         * @param {string} capability - Capability name
         * @returns {boolean}
         */
        can: function(capability) {
            const capabilityMap = {
                'fetch': env.canFetchExternal,
                'cors': env.canUseCORS,
                'indexeddb': env.canUseIndexedDB,
                'serviceworker': env.canUseServiceWorker,
                'external': env.canFetchExternal
            };
            return capabilityMap[capability.toLowerCase()] ?? false;
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Environment;
}


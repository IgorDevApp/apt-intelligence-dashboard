/**
 * APT Intelligence Dashboard - Debug Mode
 * 
 * Provides console branding, debug mode toggle, and development helpers.
 * 
 * @module debug
 * @version 1.0.0
 */

const Debug = (function() {
    'use strict';

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        debugMode: false,
        version: '1.0.0',
        startTime: Date.now()
    };

    // =========================================================================
    // CONSOLE BRANDING
    // =========================================================================

    /**
     * Displays branded console banner on load
     */
    function showBanner() {
        const styles = {
            title: 'color: #00ff88; font-size: 20px; font-weight: bold; text-shadow: 0 0 10px #00ff88;',
            subtitle: 'color: #00ccff; font-size: 12px;',
            info: 'color: #a0a8b4; font-size: 11px;',
            warning: 'color: #ffcc00; font-size: 11px;'
        };

        console.log('%c╔══════════════════════════════════════════╗', styles.title);
        console.log('%c║     APT INTELLIGENCE DASHBOARD           ║', styles.title);
        console.log('%c╚══════════════════════════════════════════╝', styles.title);
        console.log('%cThreat Intelligence at Your Fingertips', styles.subtitle);
        console.log('%c────────────────────────────────────────────', styles.info);
        
        // Environment info
        if (typeof Environment !== 'undefined') {
            console.log(`%c🌐 Environment: ${Environment.name}`, styles.info);
            console.log(`%c📡 Can Fetch: ${Environment.canFetchExternal}`, styles.info);
        }
        
        // Version info
        console.log(`%c📦 Version: ${state.version}`, styles.info);
        console.log(`%c⏰ Loaded: ${new Date().toLocaleTimeString()}`, styles.info);
        console.log('%c────────────────────────────────────────────', styles.info);
        
        // Debug hint
        console.log('%c💡 Tip: Call Debug.enable() to enable debug mode', styles.warning);
        console.log('%c    Call Debug.status() for system information', styles.warning);
    }

    /**
     * Shows detailed system status
     */
    function showStatus() {
        console.group('%c📊 System Status', 'color: #00ff88; font-weight: bold;');
        
        // Memory (if available)
        if (performance && performance.memory) {
            const mem = performance.memory;
            console.log('Memory:', {
                usedJSHeapSize: `${Math.round(mem.usedJSHeapSize / 1048576)}MB`,
                totalJSHeapSize: `${Math.round(mem.totalJSHeapSize / 1048576)}MB`
            });
        }
        
        // Environment
        if (typeof Environment !== 'undefined') {
            console.log('Environment:', Environment.getStatus());
        }
        
        // Storage
        if (typeof StorageManager !== 'undefined') {
            console.log('Storage:', StorageManager.getStatus());
        }
        
        // Data Loader
        if (typeof DataLoader !== 'undefined') {
            DataLoader.getCacheStatus().then(status => {
                console.log('Cache Status:', status);
            });
        }
        
        // Errors
        if (typeof ErrorHandler !== 'undefined') {
            const errors = ErrorHandler.getErrors();
            console.log(`Errors: ${errors.length} recorded`);
            if (errors.length > 0) {
                console.table(errors.slice(-5));
            }
        }
        
        // Uptime
        const uptime = Math.round((Date.now() - state.startTime) / 1000);
        console.log(`Uptime: ${uptime}s`);
        
        console.groupEnd();
    }

    // =========================================================================
    // DEBUG MODE
    // =========================================================================

    /**
     * Enables debug mode
     */
    function enable() {
        state.debugMode = true;
        localStorage.setItem('apt_dashboard_debug', 'true');
        console.log('%c🔧 Debug mode enabled', 'color: #00ff88; font-weight: bold;');
        console.log('Available debug commands:');
        console.log('  Debug.status() - Show system status');
        console.log('  Debug.actors() - Show actor statistics');
        console.log('  Debug.benchmark(fn) - Benchmark a function');
        console.log('  Debug.disable() - Disable debug mode');
    }

    /**
     * Disables debug mode
     */
    function disable() {
        state.debugMode = false;
        localStorage.removeItem('apt_dashboard_debug');
        console.log('%c🔧 Debug mode disabled', 'color: #a0a8b4;');
    }

    /**
     * Logs a debug message (only if debug mode is enabled)
     * @param {string} category - Log category
     * @param {string} message - Log message
     * @param {*} [data] - Optional data to log
     */
    function log(category, message, data = null) {
        if (!state.debugMode) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}] [${category}]`;
        
        if (data) {
            console.log(`%c${prefix} ${message}`, 'color: #00ccff;', data);
        } else {
            console.log(`%c${prefix} ${message}`, 'color: #00ccff;');
        }
    }

    /**
     * Shows actor statistics
     */
    function showActorStats() {
        if (typeof ActorParser === 'undefined') {
            console.log('ActorParser not available');
            return;
        }
        
        const stats = ActorParser.getStatistics();
        if (!stats) {
            console.log('No statistics available');
            return;
        }
        
        console.group('%c📊 Actor Statistics', 'color: #00ff88; font-weight: bold;');
        console.log(`Total Actors: ${stats.totalActors}`);
        console.log(`With Country: ${stats.actorsWithCountry}`);
        console.log(`Total Reports: ${stats.totalReports}`);
        console.log(`Linked Reports: ${stats.linkedReports}`);
        console.log('By Country:', stats.byCountry?.slice(0, 10));
        console.log('By Sector:', stats.bySector?.slice(0, 10));
        console.groupEnd();
    }

    /**
     * Benchmarks a function
     * @param {Function} fn - Function to benchmark
     * @param {string} [name='function'] - Name for logging
     * @param {number} [iterations=1] - Number of iterations
     */
    function benchmark(fn, name = 'function', iterations = 1) {
        console.log(`%cBenchmarking ${name}...`, 'color: #00ccff;');
        
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            fn();
            times.push(performance.now() - start);
        }
        
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        console.log(`%c${name} benchmark results:`, 'color: #00ff88; font-weight: bold;');
        console.log(`  Iterations: ${iterations}`);
        console.log(`  Average: ${avg.toFixed(2)}ms`);
        console.log(`  Min: ${min.toFixed(2)}ms`);
        console.log(`  Max: ${max.toFixed(2)}ms`);
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    // Check if debug mode was previously enabled
    if (localStorage.getItem('apt_dashboard_debug') === 'true') {
        state.debugMode = true;
    }

    // Show banner on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showBanner);
    } else {
        showBanner();
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        enable,
        disable,
        status: showStatus,
        actors: showActorStats,
        log,
        benchmark,
        
        /**
         * Checks if debug mode is enabled
         * @returns {boolean}
         */
        isEnabled: function() {
            return state.debugMode;
        },
        
        /**
         * Gets the version
         * @returns {string}
         */
        getVersion: function() {
            return state.version;
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Debug;
}


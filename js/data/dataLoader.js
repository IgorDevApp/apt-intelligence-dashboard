/**
 * APT Intelligence Dashboard - Data Loader Module
 * 
 * This module handles fetching threat intelligence data from remote sources
 * (GitHub raw URLs) with caching, error handling, and retry logic.
 * 
 * Data Sources:
 * - MISP Galaxy threat-actor.json: Comprehensive APT group profiles
 * - APTnotes.json: Historical threat intelligence reports
 * - MITRE ATT&CK STIX (Future): TTPs and detailed technique mappings
 * 
 * @module dataLoader
 * @version 1.0.0
 */

const DataLoader = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        sources: {
            mispGalaxy: {
                name: 'MISP Galaxy Threat Actors',
                url: 'https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/threat-actor.json',
                cacheKey: 'apt_dashboard_misp_galaxy',
                cacheDuration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
                critical: true // App cannot function without this
            },
            aptNotes: {
                name: 'APTnotes Reports',
                url: 'https://raw.githubusercontent.com/aptnotes/data/master/APTnotes.json',
                cacheKey: 'apt_dashboard_aptnotes',
                cacheDuration: 24 * 60 * 60 * 1000,
                critical: false // App can function with degraded features
            },
            mitreAttack: {
                name: 'MITRE ATT&CK Enterprise',
                url: 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json',
                cacheKey: 'apt_dashboard_mitre_attack',
                cacheDuration: 7 * 24 * 60 * 60 * 1000, // 7 days (large file, less frequent updates)
                critical: false,
                enabled: false // Disabled by default due to file size; enable in Phase 2
            }
        },
        retry: {
            maxAttempts: 3,
            baseDelay: 1000, // 1 second
            maxDelay: 10000  // 10 seconds
        },
        timeout: 30000 // 30 seconds fetch timeout
    };

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        data: {
            mispGalaxy: null,
            aptNotes: null,
            mitreAttack: null
        },
        loading: {
            mispGalaxy: false,
            aptNotes: false,
            mitreAttack: false
        },
        errors: {
            mispGalaxy: null,
            aptNotes: null,
            mitreAttack: null
        },
        lastUpdated: {
            mispGalaxy: null,
            aptNotes: null,
            mitreAttack: null
        }
    };

    // Event listeners for load progress
    const listeners = {
        onProgress: [],
        onComplete: [],
        onError: []
    };

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * Calculates exponential backoff delay for retries
     * @param {number} attempt - Current attempt number (0-indexed)
     * @returns {number} Delay in milliseconds
     */
    function calculateBackoff(attempt) {
        const delay = CONFIG.retry.baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        return Math.min(delay + jitter, CONFIG.retry.maxDelay);
    }

    /**
     * Creates a fetch request with timeout support using AbortController
     * Properly cleans up timeout to prevent memory leaks
     * @param {string} url - URL to fetch
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Response>}
     */
    function fetchWithTimeout(url, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        return fetch(url, { signal: controller.signal })
            .then(response => {
                clearTimeout(timeoutId);
                return response;
            })
            .catch(error => {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }
                throw error;
            });
    }

    /**
     * Emits an event to all registered listeners
     * @param {string} eventType - Type of event ('onProgress', 'onComplete', 'onError')
     * @param {*} data - Data to pass to listeners
     */
    function emit(eventType, data) {
        if (listeners[eventType]) {
            listeners[eventType].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Error in ${eventType} listener:`, e);
                }
            });
        }
    }

    /**
     * Formats a timestamp for display
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Formatted date string
     */
    function formatTimestamp(timestamp) {
        if (!timestamp) return 'Never';
        return new Date(timestamp).toLocaleString();
    }

    // =========================================================================
    // CACHE MANAGEMENT
    // =========================================================================

    // Keys that should use StorageManager for large data (IndexedDB/memory)
    const LARGE_DATA_KEYS = ['apt_dashboard_mitre_attack'];

    const Cache = {
        /**
         * Saves data to cache with timestamp
         * Uses StorageManager for large data, localStorage for smaller data
         * @param {string} key - Cache key
         * @param {*} data - Data to cache
         */
        set: async function(key, data) {
            const cacheEntry = {
                data: data,
                timestamp: Date.now()
            };

            // Use StorageManager for large data (MITRE ATT&CK)
            if (LARGE_DATA_KEYS.includes(key)) {
                try {
                    await StorageManager.setLarge(key, cacheEntry);
                    console.log(`[DataLoader] Cached ${key} (large storage) at ${formatTimestamp(cacheEntry.timestamp)}`);
                    return true;
                } catch (e) {
                    console.warn(`[DataLoader] Failed to cache ${key} in large storage:`, e.message);
                    return false;
                }
            }

            // Use localStorage for smaller data
            try {
                localStorage.setItem(key, JSON.stringify(cacheEntry));
                console.log(`[DataLoader] Cached ${key} at ${formatTimestamp(cacheEntry.timestamp)}`);
                return true;
            } catch (e) {
                console.warn(`[DataLoader] Failed to cache ${key}:`, e.message);
                // If localStorage is full, try to clear old cache entries
                if (e.name === 'QuotaExceededError') {
                    this.clearAll();
                }
                return false;
            }
        },

        /**
         * Retrieves data from cache if not expired
         * Checks both StorageManager and localStorage
         * @param {string} key - Cache key
         * @param {number} maxAge - Maximum age in milliseconds
         * @returns {Promise<*|null>} Cached data or null if expired/missing
         */
        get: async function(key, maxAge) {
            let cacheEntry = null;

            // Check large storage first for known large keys
            if (LARGE_DATA_KEYS.includes(key)) {
                try {
                    cacheEntry = await StorageManager.getLarge(key);
                } catch (e) {
                    // Fall through to localStorage check
                }
            }

            // Check localStorage if not found in large storage
            if (!cacheEntry) {
                try {
                    const cached = localStorage.getItem(key);
                    if (cached) {
                        cacheEntry = JSON.parse(cached);
                    }
                } catch (e) {
                    console.warn(`[DataLoader] Failed to read cache for ${key}:`, e.message);
                    return null;
                }
            }

            if (!cacheEntry) return null;

            const age = Date.now() - cacheEntry.timestamp;

            if (age > maxAge) {
                console.log(`[DataLoader] Cache expired for ${key} (age: ${Math.round(age / 1000 / 60)} minutes)`);
                return null;
            }

            console.log(`[DataLoader] Using cached ${key} (age: ${Math.round(age / 1000 / 60)} minutes)`);
            return cacheEntry.data;
        },

        /**
         * Gets the timestamp of a cached entry
         * @param {string} key - Cache key
         * @returns {Promise<number|null>} Timestamp or null
         */
        getTimestamp: async function(key) {
            // Check large storage for known large keys
            if (LARGE_DATA_KEYS.includes(key)) {
                try {
                    const record = await StorageManager.getLarge(key);
                    if (record && record.timestamp) return record.timestamp;
                } catch (e) {
                    // Fall through to localStorage
                }
            }

            try {
                const cached = localStorage.getItem(key);
                if (!cached) return null;
                return JSON.parse(cached).timestamp;
            } catch (e) {
                return null;
            }
        },

        /**
         * Clears a specific cache entry
         * @param {string} key - Cache key to clear
         */
        clear: async function(key) {
            // Clear from large storage
            if (LARGE_DATA_KEYS.includes(key)) {
                try {
                    await StorageManager.deleteLarge(key);
                } catch (e) {
                    // Continue to clear localStorage
                }
            }

            // Always try to clear from localStorage too
            try {
                localStorage.removeItem(key);
                console.log(`[DataLoader] Cleared cache for ${key}`);
            } catch (e) {
                console.warn(`[DataLoader] Failed to clear cache for ${key}:`, e.message);
            }
        },

        /**
         * Clears all dashboard-related cache entries
         */
        clearAll: async function() {
            for (const source of Object.values(CONFIG.sources)) {
                await this.clear(source.cacheKey);
            }
            console.log('[DataLoader] Cleared all cache entries');
        }
    };

    // =========================================================================
    // DATA FETCHING
    // =========================================================================

    /**
     * Fetches data from a remote source with retry logic
     * @param {Object} sourceConfig - Configuration for the data source
     * @returns {Promise<Object>} Fetched data
     */
    async function fetchSource(sourceConfig) {
        const { name, url, cacheKey, cacheDuration } = sourceConfig;

        // Check cache first
        const cachedData = await Cache.get(cacheKey, cacheDuration);
        if (cachedData) {
            return {
                data: cachedData,
                fromCache: true,
                timestamp: await Cache.getTimestamp(cacheKey)
            };
        }

        // Fetch from remote with retry
        let lastError = null;
        
        for (let attempt = 0; attempt < CONFIG.retry.maxAttempts; attempt++) {
            try {
                console.log(`[DataLoader] Fetching ${name} (attempt ${attempt + 1}/${CONFIG.retry.maxAttempts})`);
                
                emit('onProgress', {
                    source: name,
                    status: 'fetching',
                    attempt: attempt + 1,
                    maxAttempts: CONFIG.retry.maxAttempts
                });

                const response = await fetchWithTimeout(url, CONFIG.timeout);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                
                // Cache the successful response (async, don't block)
                await Cache.set(cacheKey, data);

                console.log(`[DataLoader] Successfully fetched ${name}`);
                
                return {
                    data: data,
                    fromCache: false,
                    timestamp: Date.now()
                };

            } catch (error) {
                lastError = error;
                console.warn(`[DataLoader] Attempt ${attempt + 1} failed for ${name}:`, error.message);

                if (attempt < CONFIG.retry.maxAttempts - 1) {
                    const delay = calculateBackoff(attempt);
                    console.log(`[DataLoader] Retrying ${name} in ${Math.round(delay / 1000)} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        // All retries failed - try to use expired cache as fallback
        try {
            const expiredCache = localStorage.getItem(cacheKey);
            if (expiredCache) {
                const cacheEntry = JSON.parse(expiredCache);
                console.warn(`[DataLoader] Using expired cache for ${name} as fallback`);
                return {
                    data: cacheEntry.data,
                    fromCache: true,
                    expired: true,
                    timestamp: cacheEntry.timestamp,
                    error: lastError.message
                };
            }
        } catch (e) {
            // Ignore cache read errors
        }

        // No cache available, throw the error
        throw new Error(`Failed to fetch ${name} after ${CONFIG.retry.maxAttempts} attempts: ${lastError.message}`);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Gets the current configuration
         * @returns {Object} Configuration object
         */
        getConfig: function() {
            return { ...CONFIG };
        },

        /**
         * Gets the current state
         * @returns {Object} State object
         */
        getState: function() {
            return {
                data: { ...state.data },
                loading: { ...state.loading },
                errors: { ...state.errors },
                lastUpdated: { ...state.lastUpdated }
            };
        },

        /**
         * Registers an event listener
         * @param {string} event - Event name ('onProgress', 'onComplete', 'onError')
         * @param {Function} callback - Callback function
         */
        on: function(event, callback) {
            if (listeners[event] && typeof callback === 'function') {
                listeners[event].push(callback);
            }
        },

        /**
         * Removes an event listener
         * @param {string} event - Event name
         * @param {Function} callback - Callback function to remove
         */
        off: function(event, callback) {
            if (listeners[event]) {
                const index = listeners[event].indexOf(callback);
                if (index > -1) {
                    listeners[event].splice(index, 1);
                }
            }
        },

        /**
         * Loads MISP Galaxy threat actor data
         * @param {boolean} forceRefresh - Force fetch even if cached
         * @returns {Promise<Object>} Threat actor data
         */
        loadMispGalaxy: async function(forceRefresh = false) {
            if (state.loading.mispGalaxy) {
                console.log('[DataLoader] MISP Galaxy load already in progress');
                return state.data.mispGalaxy;
            }

            if (forceRefresh) {
                await Cache.clear(CONFIG.sources.mispGalaxy.cacheKey);
            }

            state.loading.mispGalaxy = true;
            state.errors.mispGalaxy = null;

            try {
                const result = await fetchSource(CONFIG.sources.mispGalaxy);
                state.data.mispGalaxy = result.data;
                state.lastUpdated.mispGalaxy = result.timestamp;

                emit('onProgress', {
                    source: 'MISP Galaxy',
                    status: 'complete',
                    fromCache: result.fromCache,
                    recordCount: result.data.values ? result.data.values.length : 0
                });

                return result.data;

            } catch (error) {
                state.errors.mispGalaxy = error.message;
                emit('onError', {
                    source: 'MISP Galaxy',
                    error: error.message,
                    critical: true
                });
                throw error;

            } finally {
                state.loading.mispGalaxy = false;
            }
        },

        /**
         * Loads APTnotes report data
         * @param {boolean} forceRefresh - Force fetch even if cached
         * @returns {Promise<Array>} APTnotes data
         */
        loadAptNotes: async function(forceRefresh = false) {
            if (state.loading.aptNotes) {
                console.log('[DataLoader] APTnotes load already in progress');
                return state.data.aptNotes;
            }

            if (forceRefresh) {
                await Cache.clear(CONFIG.sources.aptNotes.cacheKey);
            }

            state.loading.aptNotes = true;
            state.errors.aptNotes = null;

            try {
                const result = await fetchSource(CONFIG.sources.aptNotes);
                state.data.aptNotes = result.data;
                state.lastUpdated.aptNotes = result.timestamp;

                emit('onProgress', {
                    source: 'APTnotes',
                    status: 'complete',
                    fromCache: result.fromCache,
                    recordCount: Array.isArray(result.data) ? result.data.length : 0
                });

                return result.data;

            } catch (error) {
                state.errors.aptNotes = error.message;
                emit('onError', {
                    source: 'APTnotes',
                    error: error.message,
                    critical: false
                });
                // Don't throw - APTnotes is not critical
                return null;

            } finally {
                state.loading.aptNotes = false;
            }
        },

        /**
         * Loads MITRE ATT&CK STIX data (Phase 2 - currently disabled)
         * @param {boolean} forceRefresh - Force fetch even if cached
         * @returns {Promise<Object|null>} MITRE ATT&CK data or null if disabled
         */
        loadMitreAttack: async function(forceRefresh = false) {
            if (!CONFIG.sources.mitreAttack.enabled) {
                console.log('[DataLoader] MITRE ATT&CK loading is disabled (Phase 2 feature)');
                return null;
            }

            if (state.loading.mitreAttack) {
                console.log('[DataLoader] MITRE ATT&CK load already in progress');
                return state.data.mitreAttack;
            }

            if (forceRefresh) {
                await Cache.clear(CONFIG.sources.mitreAttack.cacheKey);
            }

            state.loading.mitreAttack = true;
            state.errors.mitreAttack = null;

            try {
                const result = await fetchSource(CONFIG.sources.mitreAttack);
                state.data.mitreAttack = result.data;
                state.lastUpdated.mitreAttack = result.timestamp;

                emit('onProgress', {
                    source: 'MITRE ATT&CK',
                    status: 'complete',
                    fromCache: result.fromCache
                });

                return result.data;

            } catch (error) {
                state.errors.mitreAttack = error.message;
                emit('onError', {
                    source: 'MITRE ATT&CK',
                    error: error.message,
                    critical: false
                });
                return null;

            } finally {
                state.loading.mitreAttack = false;
            }
        },

        /**
         * Loads all data sources in parallel
         * @param {boolean} forceRefresh - Force fetch even if cached
         * @returns {Promise<Object>} Object containing all loaded data
         */
        loadAll: async function(forceRefresh = false) {
            console.log('[DataLoader] Loading all data sources...');

            emit('onProgress', {
                source: 'all',
                status: 'starting'
            });

            const results = await Promise.allSettled([
                this.loadMispGalaxy(forceRefresh),
                this.loadAptNotes(forceRefresh),
                this.loadMitreAttack(forceRefresh)
            ]);

            const summary = {
                mispGalaxy: results[0].status === 'fulfilled' ? results[0].value : null,
                aptNotes: results[1].status === 'fulfilled' ? results[1].value : null,
                mitreAttack: results[2].status === 'fulfilled' ? results[2].value : null,
                errors: {
                    mispGalaxy: results[0].status === 'rejected' ? results[0].reason.message : null,
                    aptNotes: results[1].status === 'rejected' ? results[1].reason.message : null,
                    mitreAttack: results[2].status === 'rejected' ? results[2].reason.message : null
                }
            };

            // Check if critical data loaded successfully
            if (!summary.mispGalaxy) {
                emit('onError', {
                    source: 'all',
                    error: 'Critical data source (MISP Galaxy) failed to load',
                    critical: true
                });
            } else {
                emit('onComplete', {
                    mispGalaxyCount: summary.mispGalaxy.values ? summary.mispGalaxy.values.length : 0,
                    aptNotesCount: Array.isArray(summary.aptNotes) ? summary.aptNotes.length : 0,
                    mitreEnabled: CONFIG.sources.mitreAttack.enabled
                });
            }

            console.log('[DataLoader] All data sources loaded:', {
                mispGalaxy: summary.mispGalaxy ? 'OK' : 'FAILED',
                aptNotes: summary.aptNotes ? 'OK' : 'FAILED',
                mitreAttack: summary.mitreAttack ? 'OK' : (CONFIG.sources.mitreAttack.enabled ? 'FAILED' : 'DISABLED')
            });

            return summary;
        },

        /**
         * Gets loaded MISP Galaxy data
         * @returns {Object|null} MISP Galaxy data
         */
        getMispGalaxy: function() {
            return state.data.mispGalaxy;
        },

        /**
         * Gets loaded APTnotes data
         * @returns {Array|null} APTnotes data
         */
        getAptNotes: function() {
            return state.data.aptNotes;
        },

        /**
         * Gets loaded MITRE ATT&CK data
         * @returns {Object|null} MITRE ATT&CK data
         */
        getMitreAttack: function() {
            return state.data.mitreAttack;
        },

        /**
         * Enables MITRE ATT&CK loading (Phase 2)
         * Warning: This is a large file (~25MB) and will increase load times
         */
        enableMitreAttack: function() {
            CONFIG.sources.mitreAttack.enabled = true;
            console.log('[DataLoader] MITRE ATT&CK loading enabled');
        },

        /**
         * Disables MITRE ATT&CK loading
         */
        disableMitreAttack: function() {
            CONFIG.sources.mitreAttack.enabled = false;
            state.data.mitreAttack = null;
            console.log('[DataLoader] MITRE ATT&CK loading disabled');
        },

        /**
         * Clears all cached data
         */
        clearCache: async function() {
            await Cache.clearAll();
        },

        /**
         * Forces a refresh of all data from remote sources
         * @returns {Promise<Object>} Fresh data from all sources
         */
        refresh: function() {
            return this.loadAll(true);
        },

        /**
         * Gets cache status for all sources
         * @returns {Promise<Object>} Cache status information
         */
        getCacheStatus: async function() {
            const status = {};
            
            for (const [key, source] of Object.entries(CONFIG.sources)) {
                const timestamp = await Cache.getTimestamp(source.cacheKey);
                const age = timestamp ? Date.now() - timestamp : null;
                
                status[key] = {
                    name: source.name,
                    cached: !!timestamp,
                    timestamp: timestamp,
                    age: age,
                    ageFormatted: age ? `${Math.round(age / 1000 / 60)} minutes` : 'N/A',
                    expired: age ? age > source.cacheDuration : true,
                    enabled: source.enabled !== false
                };
            }

            return status;
        }
    };
})();

// Export for module systems (if applicable)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataLoader;
}

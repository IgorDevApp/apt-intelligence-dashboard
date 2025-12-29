/**
 * APT Intelligence Dashboard - Storage Manager
 * 
 * Provides unified storage API supporting:
 * - IndexedDB for large data (MITRE ATT&CK ~25MB)
 * - localStorage for small data (settings, preferences)
 * - Memory fallback for file:// protocol
 * 
 * @module storageManager
 * @version 1.0.0
 */

const StorageManager = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        dbName: 'APTDashboardDB',
        dbVersion: 1,
        stores: {
            largeData: 'largeDataStore',  // For MITRE, etc.
            cache: 'cacheStore'            // For general caching
        },
        // Data larger than this goes to IndexedDB
        localStorageThreshold: 1 * 1024 * 1024  // 1MB
    };

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        db: null,
        dbReady: false,
        dbError: null,
        memoryStore: new Map(),  // Fallback for file:// protocol
        isFileProtocol: window.location.protocol === 'file:'
    };

    // =========================================================================
    // INDEXEDDB INITIALIZATION
    // =========================================================================

    /**
     * Opens/creates the IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    function openDatabase() {
        return new Promise((resolve, reject) => {
            // IndexedDB may not work properly with file:// protocol
            if (state.isFileProtocol) {
                console.log('[StorageManager] file:// protocol detected - using memory storage');
                state.dbError = 'file:// protocol';
                reject(new Error('IndexedDB not available in file:// protocol'));
                return;
            }

            if (!window.indexedDB) {
                console.warn('[StorageManager] IndexedDB not supported');
                state.dbError = 'not supported';
                reject(new Error('IndexedDB not supported'));
                return;
            }

            const request = indexedDB.open(CONFIG.dbName, CONFIG.dbVersion);

            request.onerror = (event) => {
                console.error('[StorageManager] Database error:', event.target.error);
                state.dbError = event.target.error;
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                state.db = event.target.result;
                state.dbReady = true;
                console.log('[StorageManager] IndexedDB ready');
                resolve(state.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains(CONFIG.stores.largeData)) {
                    db.createObjectStore(CONFIG.stores.largeData, { keyPath: 'key' });
                    console.log('[StorageManager] Created largeData store');
                }

                if (!db.objectStoreNames.contains(CONFIG.stores.cache)) {
                    db.createObjectStore(CONFIG.stores.cache, { keyPath: 'key' });
                    console.log('[StorageManager] Created cache store');
                }
            };
        });
    }

    /**
     * Initializes the storage manager
     * @returns {Promise<boolean>}
     */
    async function init() {
        try {
            await openDatabase();
            return true;
        } catch (error) {
            console.warn('[StorageManager] Falling back to memory storage:', error.message);
            return false;
        }
    }

    // =========================================================================
    // INDEXEDDB OPERATIONS
    // =========================================================================

    /**
     * Stores data in IndexedDB
     * @param {string} storeName - Object store name
     * @param {string} key - Storage key
     * @param {*} data - Data to store
     * @param {number} [ttl] - Time to live in milliseconds
     * @returns {Promise<boolean>}
     */
    function idbSet(storeName, key, data, ttl = null) {
        return new Promise((resolve, reject) => {
            if (!state.db) {
                reject(new Error('Database not ready'));
                return;
            }

            const transaction = state.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            const record = {
                key: key,
                data: data,
                timestamp: Date.now(),
                expiresAt: ttl ? Date.now() + ttl : null
            };

            const request = store.put(record);

            request.onsuccess = () => {
                console.log(`[StorageManager] Saved to IndexedDB: ${key}`);
                resolve(true);
            };

            request.onerror = (event) => {
                console.error(`[StorageManager] Failed to save ${key}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Retrieves data from IndexedDB
     * @param {string} storeName - Object store name
     * @param {string} key - Storage key
     * @returns {Promise<*>} - Data or null if not found/expired
     */
    function idbGet(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!state.db) {
                reject(new Error('Database not ready'));
                return;
            }

            const transaction = state.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = (event) => {
                const record = event.target.result;

                if (!record) {
                    resolve(null);
                    return;
                }

                // Check expiration
                if (record.expiresAt && Date.now() > record.expiresAt) {
                    console.log(`[StorageManager] Cache expired for ${key}`);
                    // Clean up expired record
                    idbDelete(storeName, key).catch(() => {});
                    resolve(null);
                    return;
                }

                const age = Date.now() - record.timestamp;
                console.log(`[StorageManager] Retrieved from IndexedDB: ${key} (age: ${Math.round(age / 60000)}min)`);
                resolve(record.data);
            };

            request.onerror = (event) => {
                console.error(`[StorageManager] Failed to get ${key}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Deletes data from IndexedDB
     * @param {string} storeName - Object store name
     * @param {string} key - Storage key
     * @returns {Promise<boolean>}
     */
    function idbDelete(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!state.db) {
                reject(new Error('Database not ready'));
                return;
            }

            const transaction = state.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                console.log(`[StorageManager] Deleted from IndexedDB: ${key}`);
                resolve(true);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * Clears all data from an IndexedDB store
     * @param {string} storeName - Object store name
     * @returns {Promise<boolean>}
     */
    function idbClear(storeName) {
        return new Promise((resolve, reject) => {
            if (!state.db) {
                reject(new Error('Database not ready'));
                return;
            }

            const transaction = state.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log(`[StorageManager] Cleared IndexedDB store: ${storeName}`);
                resolve(true);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // =========================================================================
    // MEMORY STORAGE (FALLBACK)
    // =========================================================================

    function memorySet(key, data, ttl = null) {
        state.memoryStore.set(key, {
            data: data,
            timestamp: Date.now(),
            expiresAt: ttl ? Date.now() + ttl : null
        });
        console.log(`[StorageManager] Saved to memory: ${key}`);
        return true;
    }

    function memoryGet(key) {
        const record = state.memoryStore.get(key);
        if (!record) return null;

        if (record.expiresAt && Date.now() > record.expiresAt) {
            state.memoryStore.delete(key);
            return null;
        }

        return record.data;
    }

    function memoryDelete(key) {
        state.memoryStore.delete(key);
        return true;
    }

    function memoryClear() {
        state.memoryStore.clear();
        return true;
    }

    // =========================================================================
    // UNIFIED PUBLIC API
    // =========================================================================

    return {
        /**
         * Initialize the storage manager
         * Call this early in app initialization
         */
        init,

        /**
         * Store large data (uses IndexedDB or memory fallback)
         * Use for MITRE ATT&CK, large datasets
         */
        setLarge: async function(key, data, ttl = null) {
            if (state.dbReady) {
                try {
                    return await idbSet(CONFIG.stores.largeData, key, data, ttl);
                } catch (e) {
                    console.warn('[StorageManager] IndexedDB failed, using memory:', e);
                }
            }
            return memorySet(key, data, ttl);
        },

        /**
         * Retrieve large data
         */
        getLarge: async function(key) {
            if (state.dbReady) {
                try {
                    return await idbGet(CONFIG.stores.largeData, key);
                } catch (e) {
                    console.warn('[StorageManager] IndexedDB read failed:', e);
                }
            }
            return memoryGet(key);
        },

        /**
         * Delete large data
         */
        deleteLarge: async function(key) {
            if (state.dbReady) {
                try {
                    return await idbDelete(CONFIG.stores.largeData, key);
                } catch (e) {
                    console.warn('[StorageManager] IndexedDB delete failed:', e);
                }
            }
            return memoryDelete(key);
        },

        /**
         * Store small data (uses localStorage with fallback)
         * Use for settings, small caches
         */
        setSmall: function(key, data, ttl = null) {
            try {
                const record = {
                    data: data,
                    timestamp: Date.now(),
                    expiresAt: ttl ? Date.now() + ttl : null
                };
                localStorage.setItem(key, JSON.stringify(record));
                return true;
            } catch (e) {
                console.warn('[StorageManager] localStorage failed, using memory:', e);
                return memorySet(key, data, ttl);
            }
        },

        /**
         * Retrieve small data
         */
        getSmall: function(key) {
            try {
                const cached = localStorage.getItem(key);
                if (!cached) return null;

                const record = JSON.parse(cached);

                if (record.expiresAt && Date.now() > record.expiresAt) {
                    localStorage.removeItem(key);
                    return null;
                }

                return record.data;
            } catch (e) {
                return memoryGet(key);
            }
        },

        /**
         * Delete small data
         */
        deleteSmall: function(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                return memoryDelete(key);
            }
        },

        /**
         * Clear all stored data
         */
        clearAll: async function() {
            // Clear memory
            memoryClear();

            // Clear localStorage (only our keys)
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('apt_dashboard_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // Clear IndexedDB
            if (state.dbReady) {
                try {
                    await idbClear(CONFIG.stores.largeData);
                    await idbClear(CONFIG.stores.cache);
                } catch (e) {
                    console.warn('[StorageManager] Failed to clear IndexedDB:', e);
                }
            }

            console.log('[StorageManager] All storage cleared');
        },

        /**
         * Get storage status for debugging
         */
        getStatus: function() {
            return {
                indexedDBReady: state.dbReady,
                indexedDBError: state.dbError,
                isFileProtocol: state.isFileProtocol,
                memoryStoreSize: state.memoryStore.size,
                storageType: state.dbReady ? 'IndexedDB' : 
                            state.isFileProtocol ? 'Memory' : 'localStorage'
            };
        },

        /**
         * Check if using full storage capabilities
         */
        hasFullStorage: function() {
            return state.dbReady;
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}


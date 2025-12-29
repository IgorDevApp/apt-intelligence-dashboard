/**
 * APT Intelligence Dashboard - Country Data Module
 * 
 * Fetches country data from UNESCO API including coordinates and flags.
 * Provides utilities for displaying country flags throughout the dashboard.
 * 
 * @module countryData
 * @version 1.0.0
 */

const CountryData = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        // UNESCO API endpoint
        apiBaseUrl: 'https://data.unesco.org/api/explore/v2.1/catalog/datasets/cou001/records',
        apiParams: 'select=country_title_en,iso2,iso3,coordinates,flag&limit=100',
        cacheKey: 'apt_dashboard_country_data',
        cacheDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxOffset: 300 // Maximum offset to fetch
    };

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        countries: [],          // Array of country objects
        countryByIso2: {},      // ISO2 code -> country lookup
        countryByIso3: {},      // ISO3 code -> country lookup
        countryByName: {},      // Lowercase name -> country lookup
        loaded: false,
        loading: false
    };

    // Manual ISO2 to ISO3 mapping for common APT attribution countries
    // This ensures we can match MISP Galaxy country codes
    const ISO2_TO_ISO3 = {
        'CN': 'CHN', 'RU': 'RUS', 'KP': 'PRK', 'IR': 'IRN', 'US': 'USA',
        'IL': 'ISR', 'PK': 'PAK', 'IN': 'IND', 'VN': 'VNM', 'UA': 'UKR',
        'BY': 'BLR', 'TR': 'TUR', 'SA': 'SAU', 'AE': 'ARE', 'SY': 'SYR',
        'LB': 'LBN', 'PS': 'PSE', 'EG': 'EGY', 'NG': 'NGA', 'ZA': 'ZAF',
        'BR': 'BRA', 'GB': 'GBR', 'DE': 'DEU', 'FR': 'FRA', 'NL': 'NLD',
        'KR': 'KOR', 'JP': 'JPN', 'TW': 'TWN', 'MY': 'MYS', 'SG': 'SGP',
        'PH': 'PHL', 'ID': 'IDN', 'TH': 'THA', 'AU': 'AUS', 'CA': 'CAN',
        'MX': 'MEX', 'ES': 'ESP', 'IT': 'ITA', 'PL': 'POL', 'SE': 'SWE',
        'NO': 'NOR', 'FI': 'FIN', 'DK': 'DNK', 'BE': 'BEL', 'AT': 'AUT',
        'CH': 'CHE', 'CZ': 'CZE', 'HU': 'HUN', 'RO': 'ROU', 'GR': 'GRC',
        'PT': 'PRT', 'IE': 'IRL', 'NZ': 'NZL', 'AR': 'ARG', 'CL': 'CHL',
        'CO': 'COL', 'PE': 'PER', 'VE': 'VEN', 'EC': 'ECU', 'IQ': 'IRQ',
        'AF': 'AFG', 'BD': 'BGD', 'LK': 'LKA', 'MM': 'MMR', 'KH': 'KHM',
        'LA': 'LAO', 'NP': 'NPL', 'KZ': 'KAZ', 'UZ': 'UZB', 'AZ': 'AZE',
        'GE': 'GEO', 'AM': 'ARM', 'ET': 'ETH', 'KE': 'KEN', 'MA': 'MAR',
        'DZ': 'DZA', 'TN': 'TUN', 'LY': 'LBY', 'SD': 'SDN', 'YE': 'YEM',
        'JO': 'JOR', 'KW': 'KWT', 'QA': 'QAT', 'BH': 'BHR', 'OM': 'OMN'
    };

    // Reverse mapping
    const ISO3_TO_ISO2 = Object.fromEntries(
        Object.entries(ISO2_TO_ISO3).map(([k, v]) => [v, k])
    );

    // =========================================================================
    // CACHE MANAGEMENT
    // =========================================================================

    function saveToCache(data) {
        try {
            const cacheEntry = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(CONFIG.cacheKey, JSON.stringify(cacheEntry));
            console.log('[CountryData] Saved to cache');
        } catch (e) {
            console.warn('[CountryData] Failed to cache:', e.message);
        }
    }

    function loadFromCache() {
        try {
            const cached = localStorage.getItem(CONFIG.cacheKey);
            if (!cached) return null;

            const cacheEntry = JSON.parse(cached);
            const age = Date.now() - cacheEntry.timestamp;

            if (age > CONFIG.cacheDuration) {
                console.log('[CountryData] Cache expired');
                return null;
            }

            console.log('[CountryData] Using cached data');
            return cacheEntry.data;
        } catch (e) {
            console.warn('[CountryData] Failed to read cache:', e.message);
            return null;
        }
    }

    // =========================================================================
    // DATA FETCHING
    // =========================================================================

    /**
     * Fetches all country data from UNESCO API with pagination
     * @returns {Promise<Array>} Array of country records
     */
    async function fetchFromApi() {
        const allRecords = [];
        let offset = 0;
        let hasMore = true;

        console.log('[CountryData] Fetching from UNESCO API...');

        while (hasMore && offset <= CONFIG.maxOffset) {
            try {
                const url = `${CONFIG.apiBaseUrl}?${CONFIG.apiParams}&offset=${offset}`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    allRecords.push(...data.results);
                    offset += data.results.length;
                    
                    // Check if there are more records
                    hasMore = data.results.length === 100;
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.warn(`[CountryData] Fetch failed at offset ${offset}:`, error.message);
                hasMore = false;
            }
        }

        console.log(`[CountryData] Fetched ${allRecords.length} countries`);
        return allRecords;
    }

    /**
     * Processes raw API records into normalized country objects
     * @param {Array} records - Raw API records
     * @returns {Array} Normalized country objects
     */
    function processRecords(records) {
        return records
            .filter(record => record.iso2 && record.coordinates)
            .map(record => ({
                name: record.country_title_en || '',
                iso2: record.iso2?.toUpperCase() || '',
                iso3: record.iso3?.toUpperCase() || ISO2_TO_ISO3[record.iso2?.toUpperCase()] || '',
                coordinates: record.coordinates,
                lat: record.coordinates?.lat || 0,
                lon: record.coordinates?.lon || 0,
                flag: record.flag || null
            }));
    }

    /**
     * Builds lookup indices for fast access
     */
    function buildIndices() {
        state.countryByIso2 = {};
        state.countryByIso3 = {};
        state.countryByName = {};

        state.countries.forEach(country => {
            if (country.iso2) {
                state.countryByIso2[country.iso2] = country;
            }
            if (country.iso3) {
                state.countryByIso3[country.iso3] = country;
            }
            if (country.name) {
                state.countryByName[country.name.toLowerCase()] = country;
            }
        });

        console.log(`[CountryData] Indices built: ${Object.keys(state.countryByIso2).length} countries`);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Loads country data from cache or API
         * @param {boolean} forceRefresh - Force fetch from API
         * @returns {Promise<Array>} Array of country objects
         */
        load: async function(forceRefresh = false) {
            if (state.loaded && !forceRefresh) {
                return state.countries;
            }

            if (state.loading) {
                // Wait for existing load to complete
                return new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (!state.loading) {
                            clearInterval(checkInterval);
                            resolve(state.countries);
                        }
                    }, 100);
                });
            }

            state.loading = true;

            try {
                // Try cache first
                if (!forceRefresh) {
                    const cached = loadFromCache();
                    if (cached && cached.length > 0) {
                        state.countries = cached;
                        buildIndices();
                        state.loaded = true;
                        state.loading = false;
                        return state.countries;
                    }
                }

                // Fetch from API
                const records = await fetchFromApi();
                state.countries = processRecords(records);
                
                // Save to cache
                saveToCache(state.countries);
                
                // Build indices
                buildIndices();
                
                state.loaded = true;
                return state.countries;

            } catch (error) {
                console.error('[CountryData] Load failed:', error);
                throw error;
            } finally {
                state.loading = false;
            }
        },

        /**
         * Gets all loaded countries
         * @returns {Array} Array of country objects
         */
        getAll: function() {
            return state.countries;
        },

        /**
         * Gets a country by ISO2 code
         * @param {string} iso2 - ISO2 country code (e.g., 'CN', 'RU')
         * @returns {Object|null} Country object or null
         */
        getByIso2: function(iso2) {
            if (!iso2) return null;
            return state.countryByIso2[iso2.toUpperCase()] || null;
        },

        /**
         * Gets a country by ISO3 code
         * @param {string} iso3 - ISO3 country code (e.g., 'CHN', 'RUS')
         * @returns {Object|null} Country object or null
         */
        getByIso3: function(iso3) {
            if (!iso3) return null;
            return state.countryByIso3[iso3.toUpperCase()] || null;
        },

        /**
         * Gets a country by name (case-insensitive)
         * @param {string} name - Country name
         * @returns {Object|null} Country object or null
         */
        getByName: function(name) {
            if (!name) return null;
            return state.countryByName[name.toLowerCase()] || null;
        },

        /**
         * Gets a country by any identifier (ISO2, ISO3, or name)
         * @param {string} identifier - Country identifier
         * @returns {Object|null} Country object or null
         */
        get: function(identifier) {
            if (!identifier) return null;
            
            const upper = identifier.toUpperCase();
            
            // Try ISO2 first (most common in MISP data)
            if (upper.length === 2 && state.countryByIso2[upper]) {
                return state.countryByIso2[upper];
            }
            
            // Try ISO3
            if (upper.length === 3 && state.countryByIso3[upper]) {
                return state.countryByIso3[upper];
            }
            
            // Try name
            return state.countryByName[identifier.toLowerCase()] || null;
        },

        /**
         * Gets the flag URL for a country
         * @param {string} identifier - Country identifier (ISO2, ISO3, or name)
         * @returns {string|null} Flag URL or null
         */
        getFlagUrl: function(identifier) {
            const country = this.get(identifier);
            return country?.flag || null;
        },

        /**
         * Creates an HTML img element for a country flag
         * @param {string} identifier - Country identifier
         * @param {Object} options - Options (size, className, alt)
         * @returns {string} HTML string for flag image
         */
        getFlagHtml: function(identifier, options = {}) {
            const country = this.get(identifier);
            if (!country || !country.flag) {
                return '';
            }

            const size = options.size || 16;
            const className = options.className || 'country-flag';
            const alt = options.alt || country.name || identifier;

            return `<img src="${country.flag}" alt="${alt}" class="${className}" style="width:${size}px;height:auto;vertical-align:middle;" loading="lazy">`;
        },

        /**
         * Creates a flag + name display element
         * @param {string} identifier - Country identifier
         * @param {Object} options - Options (size, className, showName)
         * @returns {string} HTML string for flag with name
         */
        getFlagWithName: function(identifier, options = {}) {
            const country = this.get(identifier);
            if (!country) {
                return identifier || 'Unknown';
            }

            const showName = options.showName !== false;
            const flagHtml = this.getFlagHtml(identifier, options);
            const name = country.name || identifier;

            if (showName) {
                return `<span class="country-with-flag">${flagHtml} <span class="country-name">${name}</span></span>`;
            }
            return flagHtml;
        },

        /**
         * Gets countries that have APT actors attributed to them
         * @param {Array} actorCountryCodes - Array of ISO2 country codes from actors
         * @returns {Array} Filtered countries with coordinates
         */
        getCountriesWithActors: function(actorCountryCodes) {
            const codeSet = new Set(actorCountryCodes.map(c => c?.toUpperCase()).filter(Boolean));
            return state.countries.filter(country => 
                codeSet.has(country.iso2) && country.lat && country.lon
            );
        },

        /**
         * Converts ISO2 to ISO3
         * @param {string} iso2 - ISO2 code
         * @returns {string|null} ISO3 code or null
         */
        iso2ToIso3: function(iso2) {
            if (!iso2) return null;
            return ISO2_TO_ISO3[iso2.toUpperCase()] || null;
        },

        /**
         * Converts ISO3 to ISO2
         * @param {string} iso3 - ISO3 code
         * @returns {string|null} ISO2 code or null
         */
        iso3ToIso2: function(iso3) {
            if (!iso3) return null;
            return ISO3_TO_ISO2[iso3.toUpperCase()] || null;
        },

        /**
         * Checks if data is loaded
         * @returns {boolean} True if loaded
         */
        isLoaded: function() {
            return state.loaded;
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CountryData;
}

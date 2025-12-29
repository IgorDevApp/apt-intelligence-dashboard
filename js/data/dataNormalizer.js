/**
 * APT Intelligence Dashboard - Data Normalizer
 * 
 * Fetches, parses, and normalizes data from multiple external sources.
 * Merges actor data using earliest first-seen dates and unified naming.
 * 
 * @module dataNormalizer
 * @version 1.0.0
 */

const DataNormalizer = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        sources: {
            // JSON sources (direct fetch, no CORS issues)
            mispGalaxy: {
                url: 'https://raw.githubusercontent.com/MISP/misp-galaxy/main/clusters/threat-actor.json',
                type: 'json',
                priority: 1,  // Higher priority for name authority
                hasFirstSeen: false
            },
            aptNotes: {
                url: 'https://raw.githubusercontent.com/aptnotes/data/refs/heads/master/APTnotes.json',
                type: 'json',
                priority: 3,
                hasFirstSeen: true  // Has date field
            },
            mitreAttack: {
                url: 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/refs/heads/master/enterprise-attack/enterprise-attack-18.1.json',
                type: 'json',
                priority: 2,
                hasFirstSeen: false  // 'created' is entry creation, not first seen
            },
            aptMalware: {
                url: 'https://raw.githubusercontent.com/cyber-research/APTMalware/refs/heads/master/overview.csv',
                type: 'csv',
                priority: 4,
                hasFirstSeen: false
            },
            
            // HTML sources (require CORS proxy)
            etda: {
                url: 'https://apt.etda.or.th/cgi-bin/listgroups.cgi',
                type: 'html',
                priority: 1,  // High priority for first-seen dates
                hasFirstSeen: true,
                requiresProxy: true
            },
            malpedia: {
                url: 'https://malpedia.caad.fkie.fraunhofer.de/actors',
                type: 'html',
                priority: 2,
                hasFirstSeen: false,
                requiresProxy: true
            },
            googleApt: {
                url: 'https://cloud.google.com/security/resources/insights/apt-groups',
                type: 'html',
                priority: 3,
                hasFirstSeen: true,
                requiresProxy: true
            }
        },
        
        // CORS proxies to try
        corsProxies: [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest='
        ],
        
        timeout: 15000,  // Reduced from 30s to 15s for faster failure
        
        // Cache duration in milliseconds (24 hours - matches other sources)
        cacheDuration: 24 * 60 * 60 * 1000,
        
        // Fast startup mode - use cached data immediately, skip external HTML sources on first load
        fastStartup: true,
        
        // Priority sources (loaded first for fast startup)
        prioritySources: ['mispGalaxy', 'aptNotes', 'mitreAttack', 'aptMalware']
    };

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        // Raw data from each source
        rawData: {},
        
        // Normalized/merged actor data
        actors: new Map(),  // canonical name -> actor object
        
        // Source status
        sourceStatus: {},
        
        // Last update timestamps
        lastUpdated: null,
        
        // Processing statistics
        stats: {
            totalActors: 0,
            mergedActors: 0,
            sourcesLoaded: 0,
            sourcesFailed: 0,
            earliestDatesUsed: 0
        }
    };

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * Fetches data with timeout
     */
    async function fetchWithTimeout(url, timeout = CONFIG.timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Fetches URL with CORS proxy fallback
     */
    async function fetchWithProxy(url) {
        // Try direct fetch first
        try {
            const response = await fetchWithTimeout(url);
            if (response.ok) return response;
        } catch (e) {
            console.log(`[DataNormalizer] Direct fetch failed for ${url}, trying proxies...`);
        }
        
        // Try each proxy
        for (const proxy of CONFIG.corsProxies) {
            try {
                const proxyUrl = proxy + encodeURIComponent(url);
                const response = await fetchWithTimeout(proxyUrl);
                if (response.ok) {
                    console.log(`[DataNormalizer] Success with proxy: ${proxy}`);
                    return response;
                }
            } catch (e) {
                continue;
            }
        }
        
        throw new Error(`Failed to fetch ${url} (all proxies exhausted)`);
    }

    /**
     * Parses a date string to year
     * Handles various formats: "2015", "2015-Feb 2024", "Jan 2015", etc.
     */
    function parseFirstSeenYear(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
        
        // Try to extract first year mentioned
        const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            return parseInt(yearMatch[0], 10);
        }
        
        return null;
    }

    /**
     * Parses ETDA observed date range
     * Format: "2015-Feb 2024" -> { firstSeen: 2015, lastSeen: 2024 }
     */
    function parseETDAObserved(observed) {
        if (!observed) return { firstSeen: null, lastSeen: null };
        
        const years = observed.match(/\b(19|20)\d{2}\b/g);
        if (!years || years.length === 0) return { firstSeen: null, lastSeen: null };
        
        const numericYears = years.map(y => parseInt(y, 10));
        return {
            firstSeen: Math.min(...numericYears),
            lastSeen: Math.max(...numericYears)
        };
    }

    // =========================================================================
    // SOURCE PARSERS
    // =========================================================================

    /**
     * Parses MISP Galaxy threat actors
     */
    function parseMISPGalaxy(data) {
        const actors = [];
        
        if (!data || !data.values) return actors;
        
        for (const actor of data.values) {
            const normalized = {
                name: NameNormalizer.normalize(actor.value),
                originalName: actor.value,
                description: actor.description || '',
                country: actor.meta?.country || actor.meta?.['cfr-suspected-state-sponsor'] || null,
                aliases: actor.meta?.synonyms || [],
                sectors: actor.meta?.['cfr-target-category'] || actor.meta?.['targeted-sector'] || [],
                refs: actor.meta?.refs || [],
                uuid: actor.uuid,
                source: 'misp-galaxy',
                firstSeen: null,  // MISP doesn't have first-seen
                lastSeen: null
            };
            
            // Register aliases
            NameNormalizer.registerAlias(normalized.name, normalized.aliases);
            
            actors.push(normalized);
        }
        
        console.log(`[DataNormalizer] Parsed ${actors.length} actors from MISP Galaxy`);
        return actors;
    }

    /**
     * Parses MITRE ATT&CK intrusion sets
     */
    function parseMITREAttack(data) {
        const actors = [];
        
        if (!data || !data.objects) return actors;
        
        // Filter to intrusion-set type only
        const intrusionSets = data.objects.filter(obj => obj.type === 'intrusion-set');
        
        for (const actor of intrusionSets) {
            // Extract first-seen from description if available
            let firstSeen = null;
            if (actor.description) {
                const match = actor.description.match(/since at least (\d{4})/i);
                if (match) {
                    firstSeen = parseInt(match[1], 10);
                }
            }
            
            const normalized = {
                name: NameNormalizer.normalize(actor.name),
                originalName: actor.name,
                description: actor.description || '',
                country: null,  // MITRE doesn't include country directly
                aliases: actor.aliases || [],
                sectors: [],
                refs: actor.external_references?.map(r => r.url).filter(Boolean) || [],
                uuid: actor.id,
                mitreId: actor.external_references?.find(r => r.source_name === 'mitre-attack')?.external_id,
                source: 'mitre-attack',
                firstSeen: firstSeen,
                lastSeen: null
            };
            
            // Register aliases
            NameNormalizer.registerAlias(normalized.name, normalized.aliases);
            
            actors.push(normalized);
        }
        
        console.log(`[DataNormalizer] Parsed ${actors.length} actors from MITRE ATT&CK`);
        return actors;
    }

    /**
     * Parses ETDA HTML table
     */
    function parseETDAHtml(html) {
        const actors = [];
        
        // Parse HTML using DOMParser
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find all actor rows
        const rows = doc.querySelectorAll('tr');
        
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) continue;
            
            // Extract name from link
            const nameLink = cells[1]?.querySelector('a');
            if (!nameLink) continue;
            
            const name = nameLink.textContent.trim();
            if (!name || name.startsWith('Subgroup:')) continue;  // Skip subgroups for now
            
            // Extract country from flag image
            const flagImg = cells[2]?.querySelector('img');
            const country = flagImg?.alt || cells[2]?.textContent?.trim() || null;
            
            // Extract observed dates
            const observed = cells[3]?.textContent?.trim() || '';
            const { firstSeen, lastSeen } = parseETDAObserved(observed);
            
            const normalized = {
                name: NameNormalizer.normalize(name),
                originalName: name,
                description: '',
                country: country === '[Unknown]' ? null : country,
                aliases: [],  // ETDA includes aliases in name (comma-separated)
                sectors: [],
                refs: [],
                source: 'etda',
                firstSeen: firstSeen,
                lastSeen: lastSeen,
                observed: observed
            };
            
            // Parse comma-separated aliases from name
            if (name.includes(',')) {
                const parts = name.split(',').map(p => p.trim());
                normalized.name = NameNormalizer.normalize(parts[0]);
                normalized.originalName = parts[0];
                normalized.aliases = parts.slice(1);
                NameNormalizer.registerAlias(normalized.name, normalized.aliases);
            }
            
            actors.push(normalized);
        }
        
        console.log(`[DataNormalizer] Parsed ${actors.length} actors from ETDA`);
        return actors;
    }

    /**
     * Parses APTMalware CSV
     */
    function parseAPTMalwareCSV(csvText) {
        const actors = new Map();  // Use Map to dedupe by actor name
        
        const lines = csvText.split('\n');
        
        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parse CSV (simple parsing, assumes no quotes with commas inside)
            const parts = line.split(',');
            if (parts.length < 3) continue;
            
            const country = parts[1]?.trim();
            const name = parts[2]?.trim();
            
            if (!name) continue;
            
            const normalizedName = NameNormalizer.normalize(name);
            
            // Only add if not already present
            if (!actors.has(normalizedName)) {
                actors.set(normalizedName, {
                    name: normalizedName,
                    originalName: name,
                    description: '',
                    country: country || null,
                    aliases: [],
                    sectors: [],
                    refs: [],
                    source: 'apt-malware',
                    firstSeen: null,
                    lastSeen: null
                });
            }
        }
        
        const actorList = Array.from(actors.values());
        console.log(`[DataNormalizer] Parsed ${actorList.length} unique actors from APTMalware`);
        return actorList;
    }

    /**
     * Parses Malpedia HTML
     */
    function parseMalpediaHtml(html) {
        const actors = [];
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find actor rows
        const rows = doc.querySelectorAll('tr.clickable-row');
        
        for (const row of rows) {
            const nameCell = row.querySelector('.common_name');
            const countryCell = row.querySelector('.country .flag-icon');
            const synonymsCell = row.querySelector('.synonyms');
            
            if (!nameCell) continue;
            
            const name = nameCell.textContent.trim();
            const country = countryCell?.getAttribute('data-original-title')?.toUpperCase() || null;
            const synonymsText = synonymsCell?.textContent || '';
            const aliases = synonymsText.split(',').map(s => s.trim()).filter(Boolean);
            
            const normalized = {
                name: NameNormalizer.normalize(name),
                originalName: name,
                description: '',
                country: country,
                aliases: aliases,
                sectors: [],
                refs: [],
                source: 'malpedia',
                firstSeen: null,
                lastSeen: null
            };
            
            NameNormalizer.registerAlias(normalized.name, aliases);
            actors.push(normalized);
        }
        
        console.log(`[DataNormalizer] Parsed ${actors.length} actors from Malpedia`);
        return actors;
    }

    // =========================================================================
    // DATA FETCHING
    // =========================================================================

    /**
     * Fetches and parses a single source
     */
    async function fetchSource(sourceKey) {
        const source = CONFIG.sources[sourceKey];
        if (!source) {
            console.warn(`[DataNormalizer] Unknown source: ${sourceKey}`);
            return null;
        }
        
        state.sourceStatus[sourceKey] = { status: 'loading', error: null };
        
        try {
            let response;
            
            if (source.requiresProxy) {
                response = await fetchWithProxy(source.url);
            } else {
                response = await fetchWithTimeout(source.url);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            let data;
            const text = await response.text();
            
            switch (source.type) {
                case 'json':
                    data = JSON.parse(text);
                    break;
                case 'csv':
                    data = text;  // Keep as text for CSV parsing
                    break;
                case 'html':
                    data = text;  // Keep as text for HTML parsing
                    break;
                default:
                    throw new Error(`Unknown source type: ${source.type}`);
            }
            
            state.rawData[sourceKey] = data;
            state.sourceStatus[sourceKey] = { status: 'loaded', error: null };
            state.stats.sourcesLoaded++;
            
            return data;
            
        } catch (error) {
            console.error(`[DataNormalizer] Failed to fetch ${sourceKey}:`, error.message);
            state.sourceStatus[sourceKey] = { status: 'error', error: error.message };
            state.stats.sourcesFailed++;
            return null;
        }
    }

    /**
     * Fetches all sources with fast startup support
     * @param {boolean} fastMode - If true, only fetch priority sources (JSON), skip HTML sources
     */
    async function fetchAllSources(fastMode = false) {
        console.log('[DataNormalizer] Fetching data sources...' + (fastMode ? ' (fast mode)' : ''));
        
        const sourceKeys = Object.keys(CONFIG.sources);
        
        if (fastMode && CONFIG.fastStartup) {
            // Fast mode: only fetch priority sources (JSON files from GitHub)
            const priorityKeys = CONFIG.prioritySources.filter(k => sourceKeys.includes(k));
            const priorityPromises = priorityKeys.map(key => fetchSource(key));
            await Promise.allSettled(priorityPromises);
            console.log(`[DataNormalizer] Fast startup: fetched ${state.stats.sourcesLoaded}/${priorityKeys.length} priority sources`);
        } else {
            // Full mode: fetch all sources
            const promises = sourceKeys.map(key => fetchSource(key));
            await Promise.allSettled(promises);
            console.log(`[DataNormalizer] Fetched ${state.stats.sourcesLoaded}/${sourceKeys.length} sources`);
        }
    }
    
    /**
     * Fetches secondary sources (HTML sources via CORS proxy) in background
     * Call this after initial render for non-blocking enrichment
     */
    async function fetchSecondarySources() {
        const sourceKeys = Object.keys(CONFIG.sources);
        const secondaryKeys = sourceKeys.filter(k => !CONFIG.prioritySources.includes(k));
        
        if (secondaryKeys.length === 0) return;
        
        console.log('[DataNormalizer] Background loading secondary sources:', secondaryKeys.join(', '));
        
        const promises = secondaryKeys.map(key => fetchSource(key));
        await Promise.allSettled(promises);
        
        // Re-parse and merge with new data
        const allActors = parseAllSources();
        mergeActors(allActors);
        
        console.log('[DataNormalizer] Secondary sources loaded, total actors:', state.actors.size);
        
        return state.actors;
    }

    // =========================================================================
    // DATA MERGING
    // =========================================================================

    /**
     * Parses all raw data into actor objects
     */
    function parseAllSources() {
        const allActors = [];
        
        // Parse JSON sources
        if (state.rawData.mispGalaxy) {
            allActors.push(...parseMISPGalaxy(state.rawData.mispGalaxy));
        }
        
        if (state.rawData.mitreAttack) {
            allActors.push(...parseMITREAttack(state.rawData.mitreAttack));
        }
        
        // Parse CSV sources
        if (state.rawData.aptMalware) {
            allActors.push(...parseAPTMalwareCSV(state.rawData.aptMalware));
        }
        
        // Parse HTML sources
        if (state.rawData.etda) {
            allActors.push(...parseETDAHtml(state.rawData.etda));
        }
        
        if (state.rawData.malpedia) {
            allActors.push(...parseMalpediaHtml(state.rawData.malpedia));
        }
        
        return allActors;
    }

    /**
     * Merges actors from all sources
     * Uses earliest first-seen date and combines data
     */
    function mergeActors(allActors) {
        state.actors.clear();
        
        for (const actor of allActors) {
            // Resolve to canonical name
            const canonicalName = NameNormalizer.resolveAlias(actor.name);
            
            if (state.actors.has(canonicalName)) {
                // Merge with existing
                const existing = state.actors.get(canonicalName);
                
                // Use earliest first-seen date
                if (actor.firstSeen !== null) {
                    if (existing.firstSeen === null || actor.firstSeen < existing.firstSeen) {
                        existing.firstSeen = actor.firstSeen;
                        existing.firstSeenSource = actor.source;
                        state.stats.earliestDatesUsed++;
                    }
                }
                
                // Use latest last-seen date
                if (actor.lastSeen !== null) {
                    if (existing.lastSeen === null || actor.lastSeen > existing.lastSeen) {
                        existing.lastSeen = actor.lastSeen;
                    }
                }
                
                // Merge aliases
                const allAliases = new Set([...existing.aliases, ...actor.aliases]);
                existing.aliases = Array.from(allAliases);
                
                // Merge sectors
                const allSectors = new Set([...existing.sectors, ...actor.sectors]);
                existing.sectors = Array.from(allSectors);
                
                // Merge refs
                const allRefs = new Set([...existing.refs, ...actor.refs]);
                existing.refs = Array.from(allRefs);
                
                // Use longest description
                if (actor.description && actor.description.length > (existing.description?.length || 0)) {
                    existing.description = actor.description;
                }
                
                // Use country if not set
                if (!existing.country && actor.country) {
                    existing.country = actor.country;
                }
                
                // Track sources
                if (!existing.sources) existing.sources = [];
                if (!existing.sources.includes(actor.source)) {
                    existing.sources.push(actor.source);
                }
                
                state.stats.mergedActors++;
                
            } else {
                // Add new actor
                state.actors.set(canonicalName, {
                    ...actor,
                    name: canonicalName,
                    firstSeenSource: actor.firstSeen ? actor.source : null,
                    sources: [actor.source]
                });
            }
        }
        
        state.stats.totalActors = state.actors.size;
        console.log(`[DataNormalizer] Merged into ${state.actors.size} unique actors`);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Initializes and fetches all data sources
         * @param {Object} options - Initialization options
         * @param {boolean} options.fastStartup - If true, only load priority sources for faster initial load
         * @returns {Promise<Map>} Map of normalized actors
         */
        init: async function(options = {}) {
            const fastStartup = options.fastStartup !== false && CONFIG.fastStartup;
            console.log('[DataNormalizer] Initializing...' + (fastStartup ? ' (fast startup mode)' : ''));
            
            // Reset state
            state.rawData = {};
            state.actors.clear();
            state.sourceStatus = {};
            state.stats = {
                totalActors: 0,
                mergedActors: 0,
                sourcesLoaded: 0,
                sourcesFailed: 0,
                earliestDatesUsed: 0
            };
            
            // Reset name normalizer
            NameNormalizer.reset();
            
            // Fetch sources (fast mode skips HTML sources for speed)
            await fetchAllSources(fastStartup);
            
            // Parse and merge
            const allActors = parseAllSources();
            mergeActors(allActors);
            
            state.lastUpdated = Date.now();
            
            console.log('[DataNormalizer] Initialization complete:', state.stats);
            
            return state.actors;
        },
        
        /**
         * Loads secondary sources (HTML via CORS proxy) in background
         * Call this after initial render for non-blocking enrichment
         * @returns {Promise<Map>} Updated actors map
         */
        loadSecondarySources: async function() {
            return await fetchSecondarySources();
        },

        /**
         * Gets all normalized actors as array
         * @returns {Array} Array of actor objects
         */
        getActors: function() {
            return Array.from(state.actors.values());
        },

        /**
         * Gets actor by name (handles aliases)
         * @param {string} name - Actor name or alias
         * @returns {Object|null} Actor object or null
         */
        getActor: function(name) {
            const canonical = NameNormalizer.resolveAlias(name);
            return state.actors.get(canonical) || null;
        },

        /**
         * Searches actors by name/alias
         * @param {string} query - Search query
         * @returns {Array} Matching actors
         */
        search: function(query) {
            if (!query) return [];
            
            const searchable = NameNormalizer.toSearchable(query);
            const results = [];
            
            for (const actor of state.actors.values()) {
                // Check name
                if (NameNormalizer.toSearchable(actor.name).includes(searchable)) {
                    results.push(actor);
                    continue;
                }
                
                // Check aliases
                for (const alias of actor.aliases) {
                    if (NameNormalizer.toSearchable(alias).includes(searchable)) {
                        results.push(actor);
                        break;
                    }
                }
            }
            
            return results;
        },

        /**
         * Gets source status
         * @returns {Object} Source status map
         */
        getSourceStatus: function() {
            return { ...state.sourceStatus };
        },

        /**
         * Gets statistics
         * @returns {Object} Stats object
         */
        getStats: function() {
            return {
                ...state.stats,
                lastUpdated: state.lastUpdated,
                nameNormalizerStats: NameNormalizer.getStats()
            };
        },

        /**
         * Checks if a specific source loaded successfully
         * @param {string} sourceKey - Source key
         * @returns {boolean}
         */
        isSourceLoaded: function(sourceKey) {
            return state.sourceStatus[sourceKey]?.status === 'loaded';
        },

        /**
         * Gets raw data for a source (for debugging)
         * @param {string} sourceKey - Source key
         * @returns {*} Raw data
         */
        getRawData: function(sourceKey) {
            return state.rawData[sourceKey];
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataNormalizer;
}


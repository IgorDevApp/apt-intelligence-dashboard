/**
 * Live Data Fetcher Module
 * 
 * Fetches enrichment data from external sources on-the-fly.
 * Uses CORS proxies where necessary with fallback to cached data.
 * 
 * Sources:
 * - Malpedia: Official REST API (CORS enabled)
 * - ETDA Thailand: Via CORS proxy
 * - Breach-HQ: Via CORS proxy
 * - Google Cloud: Via CORS proxy
 * 
 * @version 1.0.0
 */

const LiveDataFetcher = (function() {
    'use strict';

    // CORS Proxy services (try multiple for reliability)
    const CORS_PROXIES = [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/'  // Requires manual activation
    ];

    // Source URLs
    const SOURCES = {
        malpedia: {
            api: 'https://malpedia.caad.fkie.fraunhofer.de/api/list/actors',
            needsProxy: false  // Malpedia API has CORS enabled
        },
        etda: {
            url: 'https://apt.etda.or.th/cgi-bin/listgroups.cgi',
            needsProxy: true
        },
        breachHQ: {
            url: 'https://breach-hq.com/threat-actors',
            needsProxy: true
        },
        googleCloud: {
            url: 'https://cloud.google.com/security/resources/insights/apt-groups',
            needsProxy: true
        }
    };

    // Cache for fetched data
    const cache = {
        malpedia: null,
        etda: null,
        breachHQ: null,
        googleCloud: null,
        lastFetch: {}
    };

    // Cache duration (1 hour)
    const CACHE_DURATION = 60 * 60 * 1000;

    // Store last fetch statistics for status reporting
    let lastFetchStats = {
        malpedia: 0,
        etda: 0,
        breachHQ: 0,
        errors: 0,
        timestamp: null
    };

    /**
     * Get last fetch statistics
     */
    function getLastFetchStats() {
        return { ...lastFetchStats };
    }

    /**
     * Fetch with CORS proxy fallback
     */
    async function fetchWithProxy(url, options = {}) {
        // Try direct fetch first
        try {
            const response = await fetch(url, { 
                ...options,
                mode: 'cors',
                signal: AbortSignal.timeout(10000)
            });
            if (response.ok) {
                return await response.text();
            }
        } catch (e) {
            console.log(`[LiveFetcher] Direct fetch failed for ${url}, trying proxies...`);
        }

        // Try CORS proxies
        for (const proxy of CORS_PROXIES) {
            try {
                const proxyUrl = proxy + encodeURIComponent(url);
                console.log(`[LiveFetcher] Trying proxy: ${proxy.substring(0, 30)}...`);
                
                const response = await fetch(proxyUrl, {
                    signal: AbortSignal.timeout(15000)
                });
                
                if (response.ok) {
                    console.log(`[LiveFetcher] Success with proxy`);
                    return await response.text();
                }
            } catch (e) {
                console.warn(`[LiveFetcher] Proxy failed:`, e.message);
            }
        }

        throw new Error(`All fetch methods failed for ${url}`);
    }

    /**
     * Check if cache is valid
     */
    function isCacheValid(source) {
        const lastFetch = cache.lastFetch[source];
        if (!lastFetch) return false;
        return (Date.now() - lastFetch) < CACHE_DURATION;
    }

    /**
     * Fetch Malpedia data (has official API with CORS)
     */
    async function fetchMalpedia() {
        if (isCacheValid('malpedia') && cache.malpedia) {
            console.log('[LiveFetcher] Using cached Malpedia data');
            return cache.malpedia;
        }

        try {
            console.log('[LiveFetcher] Fetching Malpedia API...');
            const response = await fetch(SOURCES.malpedia.api, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            // Transform API response to our format
            const actors = [];
            for (const [name, info] of Object.entries(data)) {
                actors.push({
                    name: name,
                    aliases: info.synonyms || [],
                    country: info.country || null,
                    description: info.description || '',
                    malwareFamilies: info.families || [],
                    refs: info.urls || []
                });
            }

            cache.malpedia = actors;
            cache.lastFetch.malpedia = Date.now();
            
            console.log(`[LiveFetcher] Malpedia: ${actors.length} actors loaded`);
            return actors;

        } catch (error) {
            console.error('[LiveFetcher] Malpedia fetch failed:', error);
            
            // Return cached data if available, otherwise use static fallback
            if (cache.malpedia) {
                console.log('[LiveFetcher] Using stale Malpedia cache');
                return cache.malpedia;
            }
            
            // Fall back to static MalpediaParser if available
            if (typeof MalpediaParser !== 'undefined') {
                console.log('[LiveFetcher] Using static Malpedia fallback');
                return MalpediaParser.getAllActors();
            }
            
            return [];
        }
    }

    /**
     * Fetch ETDA Thailand data
     */
    async function fetchETDA() {
        if (isCacheValid('etda') && cache.etda) {
            console.log('[LiveFetcher] Using cached ETDA data');
            return cache.etda;
        }

        try {
            console.log('[LiveFetcher] Fetching ETDA Thailand...');
            const html = await fetchWithProxy(SOURCES.etda.url);
            
            // Parse HTML response
            const actors = parseETDAHtml(html);
            
            cache.etda = actors;
            cache.lastFetch.etda = Date.now();
            
            console.log(`[LiveFetcher] ETDA: ${actors.length} actors loaded`);
            return actors;

        } catch (error) {
            console.error('[LiveFetcher] ETDA fetch failed:', error);
            
            if (cache.etda) {
                console.log('[LiveFetcher] Using stale ETDA cache');
                return cache.etda;
            }
            
            // Fall back to static ETDAParser if available
            if (typeof ETDAParser !== 'undefined') {
                console.log('[LiveFetcher] Using static ETDA fallback');
                return ETDAParser.getAllActors();
            }
            
            return [];
        }
    }

    /**
     * Parse ETDA HTML response
     */
    function parseETDAHtml(html) {
        const actors = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find all actor rows
        const rows = doc.querySelectorAll('tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 4) return;
            
            // Get actor name from link
            const link = cells[1]?.querySelector('a.inlink');
            if (!link) return;
            
            const fullName = link.textContent.trim();
            if (!fullName || fullName.startsWith('_')) return;  // Skip placeholders
            
            // Parse name and aliases
            const nameParts = fullName.split(',').map(s => s.trim());
            const name = nameParts[0];
            const aliases = nameParts.slice(1);
            
            // Get country from flag image
            const flagImg = cells[2]?.querySelector('img');
            const country = flagImg ? flagImg.alt : null;
            
            // Get observation period
            const observed = cells[3]?.textContent.trim() || '';
            const { firstSeen, lastSeen } = parseObservationPeriod(observed);
            
            // Check for counter operations
            const counterOps = cells[4]?.querySelector('img[title*="counter"]') !== null;
            
            // Check if subgroup
            const isSubgroup = cells[1]?.textContent.includes('↳');
            
            actors.push({
                name: normalizeAPTName(name),
                aliases: aliases.map(a => normalizeAPTName(a)),
                country: countryNameToCode(country),
                firstSeen,
                lastSeen,
                hadCounterOps: counterOps,
                isSubgroup
            });
        });
        
        return actors;
    }

    /**
     * Parse observation period string
     */
    function parseObservationPeriod(period) {
        if (!period) return { firstSeen: null, lastSeen: null };
        
        period = period.trim();
        
        // Single year: "2022"
        if (/^\d{4}$/.test(period)) {
            return { firstSeen: period, lastSeen: null };
        }
        
        // Year range: "2007-Nov 2017" or "2018-Jun 2022"
        const rangeMatch = period.match(/^(\d{4})[-–](.+)$/);
        if (rangeMatch) {
            return { 
                firstSeen: rangeMatch[1], 
                lastSeen: rangeMatch[2].trim()
            };
        }
        
        return { firstSeen: period, lastSeen: null };
    }

    /**
     * Normalize APT group names to match MISP/MITRE format
     * Converts "APT 1" -> "APT1", "APT 29" -> "APT29", etc.
     */
    function normalizeAPTName(name) {
        if (!name) return name;
        
        // Pattern: APT followed by space(s) and number(s)
        // Also handles: "APT 1", "APT  29", "APT-32" variations
        return name
            .replace(/\bAPT\s+(\d+)/gi, 'APT$1')    // "APT 1" -> "APT1"
            .replace(/\bAPT-(\d+)/gi, 'APT$1')      // "APT-1" -> "APT1"
            .replace(/\bUNC\s+(\d+)/gi, 'UNC$1')    // "UNC 1878" -> "UNC1878"
            .replace(/\bTA\s+(\d+)/gi, 'TA$1')      // "TA 505" -> "TA505"
            .replace(/\bFIN\s+(\d+)/gi, 'FIN$1')    // "FIN 7" -> "FIN7"
            .replace(/\bG\s+(\d+)/gi, 'G$1');       // "G 0001" -> "G0001"
    }

    /**
     * Convert country name to ISO code
     */
    function countryNameToCode(name) {
        if (!name) return null;
        
        const countryMap = {
            'China': 'CN', 'Russia': 'RU', 'Iran': 'IR', 'North Korea': 'KP',
            'USA': 'US', 'United States': 'US', 'Vietnam': 'VN', 'India': 'IN',
            'Pakistan': 'PK', 'South Korea': 'KR', 'UK': 'GB', 'Israel': 'IL',
            'Turkey': 'TR', 'Ukraine': 'UA', 'Syria': 'SY', 'Lebanon': 'LB',
            'Spain': 'ES', 'Germany': 'DE', 'Brazil': 'BR', 'Colombia': 'CO',
            'Belarus': 'BY', 'Kazakhstan': 'KZ', 'UAE': 'AE', 'Indonesia': 'ID'
        };
        
        return countryMap[name] || null;
    }

    /**
     * Fetch Breach-HQ data
     */
    async function fetchBreachHQ() {
        if (isCacheValid('breachHQ') && cache.breachHQ) {
            console.log('[LiveFetcher] Using cached Breach-HQ data');
            return cache.breachHQ;
        }

        try {
            console.log('[LiveFetcher] Fetching Breach-HQ...');
            const html = await fetchWithProxy(SOURCES.breachHQ.url);
            
            // Parse HTML response
            const actors = parseBreachHQHtml(html);
            
            cache.breachHQ = actors;
            cache.lastFetch.breachHQ = Date.now();
            
            console.log(`[LiveFetcher] Breach-HQ: ${actors.length} actors loaded`);
            return actors;

        } catch (error) {
            console.error('[LiveFetcher] Breach-HQ fetch failed:', error);
            
            if (cache.breachHQ) {
                console.log('[LiveFetcher] Using stale Breach-HQ cache');
                return cache.breachHQ;
            }
            
            // Fall back to static BreachHQParser if available
            if (typeof BreachHQParser !== 'undefined') {
                console.log('[LiveFetcher] Using static Breach-HQ fallback');
                return BreachHQParser.getAllActors();
            }
            
            return [];
        }
    }

    /**
     * Parse Breach-HQ HTML response
     */
    function parseBreachHQHtml(html) {
        const actors = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Breach-HQ uses table rows for actors
        const rows = doc.querySelectorAll('table tr, .threat-actor-row, [data-actor]');
        
        rows.forEach(row => {
            // Try to extract actor data from various possible formats
            const nameEl = row.querySelector('a, .actor-name, [data-name]');
            const typeEl = row.querySelector('.threat-type, [data-type]');
            const countryEl = row.querySelector('.country, [data-country], img[alt]');
            
            if (!nameEl) return;
            
            const name = nameEl.textContent.trim();
            if (!name) return;
            
            actors.push({
                name,
                threatType: typeEl?.textContent.trim() || 'Unknown',
                country: countryEl?.getAttribute('alt') || countryEl?.textContent.trim() || null,
                aliases: []
            });
        });
        
        return actors;
    }

    /**
     * Fetch all live data sources
     * Skips external fetches in offline mode (file:// protocol)
     */
    async function fetchAll(options = {}) {
        const { parallel = true, skipFailed = true } = options;
        
        // Check environment - skip external fetches in offline mode
        if (typeof Environment !== 'undefined' && !Environment.canFetchExternal) {
            console.log('[LiveFetcher] Offline mode detected - using static data only');
            
            // Return static fallback data immediately
            const results = {
                malpedia: typeof MalpediaParser !== 'undefined' ? MalpediaParser.getAllActors() : [],
                etda: typeof ETDAParser !== 'undefined' ? ETDAParser.getAllActors() : [],
                breachHQ: typeof BreachHQParser !== 'undefined' ? BreachHQParser.getAllActors() : [],
                errors: [],
                offlineMode: true
            };

            // Update stats
            lastFetchStats = {
                malpedia: results.malpedia.length,
                etda: results.etda.length,
                breachHQ: results.breachHQ.length,
                errors: 0,
                timestamp: Date.now(),
                offlineMode: true
            };

            console.log('[LiveFetcher] Static data loaded:', lastFetchStats);
            return results;
        }
        
        console.log('[LiveFetcher] Fetching all live data sources...');
        
        const results = {
            malpedia: null,
            etda: null,
            breachHQ: null,
            errors: []
        };

        const fetchers = [
            { name: 'malpedia', fn: fetchMalpedia },
            { name: 'etda', fn: fetchETDA },
            { name: 'breachHQ', fn: fetchBreachHQ }
        ];

        if (parallel) {
            // Fetch all in parallel
            const promises = fetchers.map(async ({ name, fn }) => {
                try {
                    results[name] = await fn();
                } catch (e) {
                    results.errors.push({ source: name, error: e.message });
                }
            });
            await Promise.all(promises);
        } else {
            // Fetch sequentially
            for (const { name, fn } of fetchers) {
                try {
                    results[name] = await fn();
                } catch (e) {
                    results.errors.push({ source: name, error: e.message });
                }
            }
        }

        // Store stats for later retrieval
        lastFetchStats = {
            malpedia: results.malpedia?.length || 0,
            etda: results.etda?.length || 0,
            breachHQ: results.breachHQ?.length || 0,
            errors: results.errors.length,
            timestamp: Date.now()
        };

        console.log('[LiveFetcher] Fetch complete:', lastFetchStats);

        return results;
    }

    /**
     * Enrich actors with live data
     * Includes cleanup of temporary Maps to prevent memory leaks
     */
    async function enrichActorsWithLiveData(actors) {
        console.log('[LiveFetcher] Starting live data enrichment...');
        
        // Check environment - skip if offline
        if (typeof Environment !== 'undefined' && !Environment.canFetchExternal) {
            console.log('[LiveFetcher] Offline mode - skipping live enrichment');
            return actors;
        }
        
        const liveData = await fetchAll();
        let enrichedCount = 0;

        // Create lookup maps for faster matching (with normalized names)
        const malpediaMap = new Map();
        if (liveData.malpedia) {
            liveData.malpedia.forEach(actor => {
                const normalizedName = normalizeAPTName(actor.name).toLowerCase();
                malpediaMap.set(normalizedName, actor);
                malpediaMap.set(actor.name.toLowerCase(), actor);  // Also store original
                (actor.aliases || []).forEach(alias => {
                    const normalizedAlias = normalizeAPTName(alias).toLowerCase();
                    malpediaMap.set(normalizedAlias, actor);
                    malpediaMap.set(alias.toLowerCase(), actor);
                });
            });
        }

        const etdaMap = new Map();
        if (liveData.etda) {
            liveData.etda.forEach(actor => {
                const normalizedName = normalizeAPTName(actor.name).toLowerCase();
                etdaMap.set(normalizedName, actor);
                etdaMap.set(actor.name.toLowerCase(), actor);  // Also store original
                (actor.aliases || []).forEach(alias => {
                    const normalizedAlias = normalizeAPTName(alias).toLowerCase();
                    etdaMap.set(normalizedAlias, actor);
                    etdaMap.set(alias.toLowerCase(), actor);
                });
            });
        }

        const breachHQMap = new Map();
        if (liveData.breachHQ) {
            liveData.breachHQ.forEach(actor => {
                const normalizedName = normalizeAPTName(actor.name).toLowerCase();
                breachHQMap.set(normalizedName, actor);
                breachHQMap.set(actor.name.toLowerCase(), actor);
            });
        }

        // Enrich each actor
        actors.forEach(actor => {
            // Normalize the actor name for matching
            const nameLower = actor.name.toLowerCase();
            const nameNormalized = normalizeAPTName(actor.name).toLowerCase();
            let wasEnriched = false;

            // Try Malpedia (check both normalized and original names)
            const malpediaMatch = malpediaMap.get(nameNormalized) || 
                malpediaMap.get(nameLower) ||
                (actor.aliases || []).map(a => malpediaMap.get(normalizeAPTName(a).toLowerCase())).find(m => m) ||
                (actor.aliases || []).map(a => malpediaMap.get(a.toLowerCase())).find(m => m);
            
            if (malpediaMatch) {
                // Merge aliases
                const existingAliases = new Set((actor.aliases || []).map(a => a.toLowerCase()));
                (malpediaMatch.aliases || []).forEach(alias => {
                    if (!existingAliases.has(alias.toLowerCase())) {
                        actor.aliases = actor.aliases || [];
                        actor.aliases.push(alias);
                    }
                });
                
                if (malpediaMatch.malwareFamilies?.length > 0) {
                    actor.malwareFamilies = malpediaMatch.malwareFamilies;
                }
                
                actor.malpediaEnriched = true;
                actor.malpediaLive = true;  // Mark as live data
                wasEnriched = true;
            }

            // Try ETDA (check both normalized and original names)
            const etdaMatch = etdaMap.get(nameNormalized) ||
                etdaMap.get(nameLower) ||
                (actor.aliases || []).map(a => etdaMap.get(normalizeAPTName(a).toLowerCase())).find(m => m) ||
                (actor.aliases || []).map(a => etdaMap.get(a.toLowerCase())).find(m => m);
            
            if (etdaMatch) {
                // Add country attribution if missing
                if (etdaMatch.country && !actor.country) {
                    actor.country = etdaMatch.country;
                    // Also set countryName for display
                    const countryNames = {
                        'CN': 'China', 'RU': 'Russia', 'IR': 'Iran', 'KP': 'North Korea',
                        'US': 'United States', 'VN': 'Vietnam', 'IN': 'India', 'PK': 'Pakistan',
                        'KR': 'South Korea', 'GB': 'United Kingdom', 'IL': 'Israel', 'TR': 'Turkey',
                        'UA': 'Ukraine', 'SY': 'Syria', 'LB': 'Lebanon', 'ES': 'Spain',
                        'DE': 'Germany', 'BR': 'Brazil', 'CO': 'Colombia', 'BY': 'Belarus',
                        'KZ': 'Kazakhstan', 'AE': 'UAE', 'ID': 'Indonesia', 'PS': 'Palestine',
                        'EG': 'Egypt', 'SA': 'Saudi Arabia', 'IQ': 'Iraq', 'MM': 'Myanmar',
                        'TW': 'Taiwan', 'PH': 'Philippines', 'MY': 'Malaysia', 'TH': 'Thailand'
                    };
                    actor.countryName = countryNames[etdaMatch.country] || etdaMatch.country;
                }
                
                // ETDA is authoritative for timeline data - always use it if available
                if (etdaMatch.firstSeen) {
                    actor.firstSeen = etdaMatch.firstSeen;
                }
                if (etdaMatch.lastSeen) {
                    actor.lastSeen = etdaMatch.lastSeen;
                }
                if (etdaMatch.hadCounterOps) {
                    actor.hadCounterOps = true;
                }
                
                actor.etdaEnriched = true;
                actor.etdaLive = true;  // Mark as live data
                wasEnriched = true;
            }

            // Try Breach-HQ (check both normalized and original names)
            const breachHQMatch = breachHQMap.get(nameNormalized) ||
                breachHQMap.get(nameLower) ||
                (actor.aliases || []).map(a => breachHQMap.get(normalizeAPTName(a).toLowerCase())).find(m => m) ||
                (actor.aliases || []).map(a => breachHQMap.get(a.toLowerCase())).find(m => m);
            
            if (breachHQMatch) {
                if (breachHQMatch.threatType) {
                    actor.threatType = breachHQMatch.threatType;
                }
                
                actor.breachHQEnriched = true;
                actor.breachHQLive = true;  // Mark as live data
                wasEnriched = true;
            }

            if (wasEnriched) enrichedCount++;
        });

        // MEMORY LEAK FIX: Clear lookup maps after enrichment
        malpediaMap.clear();
        etdaMap.clear();
        breachHQMap.clear();

        console.log(`[LiveFetcher] Enriched ${enrichedCount} actors with live data`);
        return actors;
    }

    /**
     * Get fetch status
     */
    function getStatus() {
        return {
            malpedia: {
                cached: cache.malpedia !== null,
                count: cache.malpedia?.length || 0,
                lastFetch: cache.lastFetch.malpedia,
                isLive: true
            },
            etda: {
                cached: cache.etda !== null,
                count: cache.etda?.length || 0,
                lastFetch: cache.lastFetch.etda,
                isLive: true
            },
            breachHQ: {
                cached: cache.breachHQ !== null,
                count: cache.breachHQ?.length || 0,
                lastFetch: cache.lastFetch.breachHQ,
                isLive: true
            }
        };
    }

    /**
     * Clear cache to force re-fetch
     */
    function clearCache() {
        cache.malpedia = null;
        cache.etda = null;
        cache.breachHQ = null;
        cache.googleCloud = null;
        cache.lastFetch = {};
        console.log('[LiveFetcher] Cache cleared');
    }

    // Public API
    return {
        fetchMalpedia,
        fetchETDA,
        fetchBreachHQ,
        fetchAll,
        enrichActorsWithLiveData,
        getStatus,
        getLastFetchStats,
        clearCache,
        
        // Expose for testing
        CORS_PROXIES,
        SOURCES
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveDataFetcher;
}

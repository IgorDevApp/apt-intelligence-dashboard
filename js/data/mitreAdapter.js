/**
 * APT Intelligence Dashboard - MITRE ATT&CK Adapter Module
 * 
 * Parses MITRE ATT&CK Enterprise STIX data to extract:
 * - Intrusion Sets (APT groups)
 * - Attack Patterns (TTPs/Techniques)
 * - Malware and Tools
 * - Relationships between groups and techniques
 * 
 * @module mitreAdapter
 * @version 2.0.0
 */

const MitreAdapter = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        dataUrl: 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/refs/heads/master/enterprise-attack/enterprise-attack.json',
        cacheKey: 'apt_dashboard_mitre_attack',
        cacheDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
        timeout: 60000 // 60 seconds (large file)
    };

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        raw: null,                    // Raw STIX bundle
        intrusionSets: [],            // Parsed APT groups
        attackPatterns: [],           // Parsed techniques
        malware: [],                  // Parsed malware
        tools: [],                    // Parsed tools
        relationships: [],            // All relationships
        
        // Indices for fast lookup
        intrusionSetById: new Map(),  // STIX ID -> intrusion set
        intrusionSetByName: new Map(), // Lowercase name -> intrusion set
        attackPatternById: new Map(), // STIX ID -> attack pattern
        malwareById: new Map(),       // STIX ID -> malware
        toolById: new Map(),          // STIX ID -> tool
        
        // Relationship maps
        groupTechniques: new Map(),   // Group ID -> [technique IDs]
        groupMalware: new Map(),      // Group ID -> [malware IDs]
        groupTools: new Map(),        // Group ID -> [tool IDs]
        
        loaded: false,
        loading: false
    };

    // =========================================================================
    // CACHE MANAGEMENT
    // =========================================================================

    function saveToCache() {
        try {
            // Store only essential parsed data to reduce storage size
            const cacheData = {
                intrusionSets: state.intrusionSets,
                attackPatterns: state.attackPatterns.map(ap => ({
                    id: ap.id,
                    name: ap.name,
                    mitreId: ap.mitreId,
                    tactics: ap.tactics
                })),
                malware: state.malware.map(m => ({
                    id: m.id,
                    name: m.name,
                    mitreId: m.mitreId
                })),
                tools: state.tools.map(t => ({
                    id: t.id,
                    name: t.name,
                    mitreId: t.mitreId
                })),
                groupTechniques: Array.from(state.groupTechniques.entries()),
                groupMalware: Array.from(state.groupMalware.entries()),
                groupTools: Array.from(state.groupTools.entries())
            };
            
            const cacheEntry = {
                data: cacheData,
                timestamp: Date.now()
            };
            localStorage.setItem(CONFIG.cacheKey, JSON.stringify(cacheEntry));
            console.log('[MitreAdapter] Saved to cache');
        } catch (e) {
            console.warn('[MitreAdapter] Failed to cache:', e.message);
            // If quota exceeded, clear old data
            if (e.name === 'QuotaExceededError') {
                localStorage.removeItem(CONFIG.cacheKey);
            }
        }
    }

    function loadFromCache() {
        try {
            const cached = localStorage.getItem(CONFIG.cacheKey);
            if (!cached) return null;

            const cacheEntry = JSON.parse(cached);
            const age = Date.now() - cacheEntry.timestamp;

            if (age > CONFIG.cacheDuration) {
                console.log('[MitreAdapter] Cache expired');
                return null;
            }

            console.log('[MitreAdapter] Using cached data');
            return cacheEntry.data;
        } catch (e) {
            console.warn('[MitreAdapter] Failed to read cache:', e.message);
            return null;
        }
    }

    function restoreFromCache(cacheData) {
        state.intrusionSets = cacheData.intrusionSets || [];
        state.attackPatterns = cacheData.attackPatterns || [];
        state.malware = cacheData.malware || [];
        state.tools = cacheData.tools || [];
        
        // Restore maps
        state.groupTechniques = new Map(cacheData.groupTechniques || []);
        state.groupMalware = new Map(cacheData.groupMalware || []);
        state.groupTools = new Map(cacheData.groupTools || []);
        
        // Rebuild indices
        buildIndices();
    }

    // =========================================================================
    // PARSING FUNCTIONS
    // =========================================================================

    /**
     * Extracts MITRE ID from external references
     * @param {Array} refs - External references array
     * @param {string} prefix - Expected prefix (G, T, S)
     * @returns {string|null} MITRE ID or null
     */
    function extractMitreId(refs, prefix) {
        if (!refs || !Array.isArray(refs)) return null;
        
        const mitreRef = refs.find(ref => 
            ref.source_name === 'mitre-attack' && 
            ref.external_id?.startsWith(prefix)
        );
        
        return mitreRef?.external_id || null;
    }

    /**
     * Parses an intrusion-set object into normalized format
     * @param {Object} obj - Raw STIX intrusion-set object
     * @returns {Object} Normalized intrusion set
     */
    function parseIntrusionSet(obj) {
        const mitreId = extractMitreId(obj.external_references, 'G');
        
        return {
            id: obj.id,
            stixId: obj.id,
            mitreId: mitreId,
            name: obj.name || '',
            description: obj.description || '',
            aliases: obj.aliases || [],
            
            // Dates
            created: obj.created ? new Date(obj.created) : null,
            modified: obj.modified ? new Date(obj.modified) : null,
            firstSeen: obj.first_seen ? new Date(obj.first_seen) : null,
            lastSeen: obj.last_seen ? new Date(obj.last_seen) : null,
            
            // Extract first seen year for timeline
            firstSeenYear: obj.first_seen ? new Date(obj.first_seen).getFullYear() : 
                          (obj.created ? new Date(obj.created).getFullYear() : null),
            
            // External references for linking
            references: (obj.external_references || [])
                .filter(ref => ref.url)
                .map(ref => ({
                    source: ref.source_name || 'Unknown',
                    url: ref.url,
                    description: ref.description || ''
                })),
            
            // Will be populated from relationships
            techniques: [],
            malwareUsed: [],
            toolsUsed: [],
            
            // Source marker
            source: 'mitre'
        };
    }

    /**
     * Parses an attack-pattern object
     * @param {Object} obj - Raw STIX attack-pattern object
     * @returns {Object} Normalized attack pattern
     */
    function parseAttackPattern(obj) {
        const mitreId = extractMitreId(obj.external_references, 'T');
        
        // Extract tactics from kill chain phases
        const tactics = (obj.kill_chain_phases || [])
            .filter(phase => phase.kill_chain_name === 'mitre-attack')
            .map(phase => phase.phase_name);
        
        return {
            id: obj.id,
            mitreId: mitreId,
            name: obj.name || '',
            description: obj.description || '',
            tactics: tactics,
            isSubtechnique: mitreId?.includes('.') || false,
            parentId: obj.x_mitre_is_subtechnique ? 
                mitreId?.split('.')[0] : null
        };
    }

    /**
     * Parses a malware object
     * @param {Object} obj - Raw STIX malware object
     * @returns {Object} Normalized malware
     */
    function parseMalware(obj) {
        const mitreId = extractMitreId(obj.external_references, 'S');
        
        return {
            id: obj.id,
            mitreId: mitreId,
            name: obj.name || '',
            description: obj.description || '',
            aliases: obj.x_mitre_aliases || [],
            platforms: obj.x_mitre_platforms || [],
            type: 'malware'
        };
    }

    /**
     * Parses a tool object
     * @param {Object} obj - Raw STIX tool object
     * @returns {Object} Normalized tool
     */
    function parseTool(obj) {
        const mitreId = extractMitreId(obj.external_references, 'S');
        
        return {
            id: obj.id,
            mitreId: mitreId,
            name: obj.name || '',
            description: obj.description || '',
            aliases: obj.x_mitre_aliases || [],
            platforms: obj.x_mitre_platforms || [],
            type: 'tool'
        };
    }

    /**
     * Processes relationships to build group -> technique/malware/tool mappings
     */
    function processRelationships() {
        console.log('[MitreAdapter] Processing relationships...');
        
        state.groupTechniques.clear();
        state.groupMalware.clear();
        state.groupTools.clear();
        
        let techniqueLinks = 0;
        let malwareLinks = 0;
        let toolLinks = 0;
        
        state.relationships.forEach(rel => {
            if (rel.relationship_type !== 'uses') return;
            
            const sourceId = rel.source_ref;
            const targetId = rel.target_ref;
            
            // Check if source is an intrusion-set (group)
            if (!sourceId?.startsWith('intrusion-set--')) return;
            
            // Link to attack patterns (techniques)
            if (targetId?.startsWith('attack-pattern--')) {
                if (!state.groupTechniques.has(sourceId)) {
                    state.groupTechniques.set(sourceId, []);
                }
                state.groupTechniques.get(sourceId).push(targetId);
                techniqueLinks++;
            }
            
            // Link to malware
            if (targetId?.startsWith('malware--')) {
                if (!state.groupMalware.has(sourceId)) {
                    state.groupMalware.set(sourceId, []);
                }
                state.groupMalware.get(sourceId).push(targetId);
                malwareLinks++;
            }
            
            // Link to tools
            if (targetId?.startsWith('tool--')) {
                if (!state.groupTools.has(sourceId)) {
                    state.groupTools.set(sourceId, []);
                }
                state.groupTools.get(sourceId).push(targetId);
                toolLinks++;
            }
        });
        
        console.log(`[MitreAdapter] Relationship links: ${techniqueLinks} techniques, ${malwareLinks} malware, ${toolLinks} tools`);
    }

    /**
     * Enriches intrusion sets with their linked TTPs, malware, and tools
     */
    function enrichIntrusionSets() {
        state.intrusionSets.forEach(group => {
            // Add techniques
            const techniqueIds = state.groupTechniques.get(group.id) || [];
            group.techniques = techniqueIds
                .map(id => state.attackPatternById.get(id))
                .filter(Boolean)
                .map(t => ({
                    id: t.mitreId,
                    name: t.name,
                    tactics: t.tactics
                }));
            
            // Add malware
            const malwareIds = state.groupMalware.get(group.id) || [];
            group.malwareUsed = malwareIds
                .map(id => state.malwareById.get(id))
                .filter(Boolean)
                .map(m => ({
                    id: m.mitreId,
                    name: m.name
                }));
            
            // Add tools
            const toolIds = state.groupTools.get(group.id) || [];
            group.toolsUsed = toolIds
                .map(id => state.toolById.get(id))
                .filter(Boolean)
                .map(t => ({
                    id: t.mitreId,
                    name: t.name
                }));
        });
    }

    /**
     * Builds lookup indices
     */
    function buildIndices() {
        state.intrusionSetById.clear();
        state.intrusionSetByName.clear();
        state.attackPatternById.clear();
        state.malwareById.clear();
        state.toolById.clear();
        
        state.intrusionSets.forEach(group => {
            state.intrusionSetById.set(group.id, group);
            state.intrusionSetByName.set(group.name.toLowerCase(), group);
            
            // Also index by aliases
            (group.aliases || []).forEach(alias => {
                state.intrusionSetByName.set(alias.toLowerCase(), group);
            });
        });
        
        state.attackPatterns.forEach(ap => {
            state.attackPatternById.set(ap.id, ap);
        });
        
        state.malware.forEach(m => {
            state.malwareById.set(m.id, m);
        });
        
        state.tools.forEach(t => {
            state.toolById.set(t.id, t);
        });
    }

    /**
     * Parses the full STIX bundle
     * @param {Object} bundle - Raw STIX bundle
     */
    function parseBundle(bundle) {
        console.log('[MitreAdapter] Parsing STIX bundle...');
        
        if (!bundle || !bundle.objects) {
            throw new Error('Invalid STIX bundle');
        }
        
        // Reset state
        state.intrusionSets = [];
        state.attackPatterns = [];
        state.malware = [];
        state.tools = [];
        state.relationships = [];
        
        // Categorize objects by type
        bundle.objects.forEach(obj => {
            if (obj.revoked || obj.x_mitre_deprecated) return;
            
            switch (obj.type) {
                case 'intrusion-set':
                    state.intrusionSets.push(parseIntrusionSet(obj));
                    break;
                case 'attack-pattern':
                    state.attackPatterns.push(parseAttackPattern(obj));
                    break;
                case 'malware':
                    state.malware.push(parseMalware(obj));
                    break;
                case 'tool':
                    state.tools.push(parseTool(obj));
                    break;
                case 'relationship':
                    state.relationships.push(obj);
                    break;
            }
        });
        
        console.log(`[MitreAdapter] Parsed: ${state.intrusionSets.length} groups, ${state.attackPatterns.length} techniques, ${state.malware.length} malware, ${state.tools.length} tools, ${state.relationships.length} relationships`);
        
        // Build indices
        buildIndices();
        
        // Process relationships
        processRelationships();
        
        // Enrich intrusion sets with TTPs
        enrichIntrusionSets();
    }

    // =========================================================================
    // DATA FETCHING
    // =========================================================================

    /**
     * Fetches MITRE ATT&CK data
     * @returns {Promise<Object>} Parsed STIX bundle
     */
    async function fetchData() {
        console.log('[MitreAdapter] Fetching MITRE ATT&CK data...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
        
        try {
            const response = await fetch(CONFIG.dataUrl, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[MitreAdapter] Fetch complete');
            
            return data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - MITRE data file is large');
            }
            throw error;
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Loads and parses MITRE ATT&CK data
         * @param {boolean} forceRefresh - Force fetch from API
         * @returns {Promise<Object>} Summary of loaded data
         */
        load: async function(forceRefresh = false) {
            if (state.loaded && !forceRefresh) {
                return this.getSummary();
            }
            
            if (state.loading) {
                return new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (!state.loading) {
                            clearInterval(checkInterval);
                            resolve(this.getSummary());
                        }
                    }, 100);
                });
            }
            
            state.loading = true;
            
            try {
                // Try cache first
                if (!forceRefresh) {
                    const cached = loadFromCache();
                    if (cached) {
                        restoreFromCache(cached);
                        state.loaded = true;
                        state.loading = false;
                        return this.getSummary();
                    }
                }
                
                // Fetch and parse
                const bundle = await fetchData();
                parseBundle(bundle);
                
                // Cache the results
                saveToCache();
                
                state.loaded = true;
                return this.getSummary();
                
            } catch (error) {
                console.error('[MitreAdapter] Load failed:', error);
                throw error;
            } finally {
                state.loading = false;
            }
        },

        /**
         * Gets summary of loaded data
         * @returns {Object} Data summary
         */
        getSummary: function() {
            return {
                loaded: state.loaded,
                intrusionSets: state.intrusionSets.length,
                attackPatterns: state.attackPatterns.length,
                malware: state.malware.length,
                tools: state.tools.length
            };
        },

        /**
         * Gets all intrusion sets (APT groups)
         * @returns {Array} Array of intrusion set objects
         */
        getIntrusionSets: function() {
            return state.intrusionSets;
        },

        /**
         * Gets an intrusion set by name or alias
         * @param {string} name - Group name or alias
         * @returns {Object|null} Intrusion set or null
         */
        getIntrusionSetByName: function(name) {
            if (!name) return null;
            return state.intrusionSetByName.get(name.toLowerCase()) || null;
        },

        /**
         * Gets an intrusion set by STIX ID
         * @param {string} id - STIX ID
         * @returns {Object|null} Intrusion set or null
         */
        getIntrusionSetById: function(id) {
            return state.intrusionSetById.get(id) || null;
        },

        /**
         * Gets techniques for a group
         * @param {string} groupId - Group STIX ID
         * @returns {Array} Array of technique objects
         */
        getTechniquesForGroup: function(groupId) {
            const group = state.intrusionSetById.get(groupId);
            return group?.techniques || [];
        },

        /**
         * Gets all attack patterns (techniques)
         * @returns {Array} Array of attack pattern objects
         */
        getAttackPatterns: function() {
            return state.attackPatterns;
        },

        /**
         * Gets all malware
         * @returns {Array} Array of malware objects
         */
        getMalware: function() {
            return state.malware;
        },

        /**
         * Gets all tools
         * @returns {Array} Array of tool objects
         */
        getTools: function() {
            return state.tools;
        },

        /**
         * Merges MITRE data with an existing actor from MISP Galaxy
         * @param {Object} actor - MISP Galaxy actor
         * @returns {Object} Enriched actor
         */
        enrichActor: function(actor) {
            if (!actor) return actor;
            
            // Try to find matching MITRE intrusion set
            let mitreGroup = null;
            
            // Try by primary name
            mitreGroup = state.intrusionSetByName.get(actor.name?.toLowerCase());
            
            // Try by synonyms/aliases
            if (!mitreGroup && actor.synonyms) {
                for (const synonym of actor.synonyms) {
                    mitreGroup = state.intrusionSetByName.get(synonym.toLowerCase());
                    if (mitreGroup) break;
                }
            }
            
            if (!mitreGroup) return actor;
            
            // Merge MITRE data into actor
            return {
                ...actor,
                mitreId: mitreGroup.mitreId,
                techniques: mitreGroup.techniques || [],
                malwareUsed: mitreGroup.malwareUsed || [],
                toolsUsed: mitreGroup.toolsUsed || [],
                mitreFirstSeen: mitreGroup.firstSeen,
                mitreLastSeen: mitreGroup.lastSeen,
                // Use MITRE first seen if MISP doesn't have it
                firstSeen: actor.firstSeen || mitreGroup.firstSeenYear,
                mitreDescription: mitreGroup.description,
                mitreReferences: mitreGroup.references,
                mitreEnriched: true
            };
        },

        /**
         * Checks if data is loaded
         * @returns {boolean} True if loaded
         */
        isLoaded: function() {
            return state.loaded;
        },

        /**
         * Clears cached data
         */
        clearCache: function() {
            localStorage.removeItem(CONFIG.cacheKey);
            console.log('[MitreAdapter] Cache cleared');
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MitreAdapter;
}

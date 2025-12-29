/**
 * APT Intelligence Dashboard - Name Normalizer
 * 
 * Normalizes threat actor names across different data sources.
 * Handles variations like "APT 42" vs "APT42" and builds alias mappings.
 * 
 * @module nameNormalizer
 * @version 1.0.0
 */

const NameNormalizer = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    /**
     * Patterns for normalizing APT-style names
     * Converts "APT 42", "APT-42", "APT_42" -> "APT42"
     */
    const NORMALIZATION_PATTERNS = [
        // APT with space/dash/underscore + number -> APTnumber
        { pattern: /^APT[\s\-_]+(\d+)$/i, replacement: 'APT$1' },
        // FIN with space/dash/underscore + number -> FINnumber
        { pattern: /^FIN[\s\-_]+(\d+)$/i, replacement: 'FIN$1' },
        // UNC with space/dash/underscore + number -> UNCnumber
        { pattern: /^UNC[\s\-_]+(\d+)$/i, replacement: 'UNC$1' },
        // TA with space/dash/underscore + number -> TAnumber
        { pattern: /^TA[\s\-_]+(\d+)$/i, replacement: 'TA$1' },
        // Group with space/dash/underscore + number -> Groupnumber
        { pattern: /^Group[\s\-_]+(\d+)$/i, replacement: 'Group$1' },
        // G + number (MITRE style) -> Gnumber
        { pattern: /^G[\s\-_]*(\d+)$/i, replacement: 'G$1' },
    ];

    /**
     * Known aliases that should map to canonical names
     * Key: alias (lowercase), Value: canonical name
     */
    const KNOWN_ALIASES = {
        // APT1
        'comment crew': 'APT1',
        'comment panda': 'APT1',
        'pla unit 61398': 'APT1',
        'byzantine candor': 'APT1',
        
        // APT28
        'fancy bear': 'APT28',
        'sofacy': 'APT28',
        'pawn storm': 'APT28',
        'sednit': 'APT28',
        'strontium': 'APT28',
        'forest blizzard': 'APT28',
        
        // APT29
        'cozy bear': 'APT29',
        'the dukes': 'APT29',
        'nobelium': 'APT29',
        'midnight blizzard': 'APT29',
        'yttrium': 'APT29',
        
        // APT32
        'oceanlotus': 'APT32',
        'ocean lotus': 'APT32',
        'cobalt kitty': 'APT32',
        'canvas cyclone': 'APT32',
        
        // APT33
        'elfin': 'APT33',
        'magnallium': 'APT33',
        'refined kitten': 'APT33',
        'peach sandstorm': 'APT33',
        
        // APT34
        'oilrig': 'APT34',
        'oil rig': 'APT34',
        'helix kitten': 'APT34',
        'crambus': 'APT34',
        'hazel sandstorm': 'APT34',
        
        // APT35
        'charming kitten': 'APT35',
        'phosphorus': 'APT35',
        'magic hound': 'APT35',
        'mint sandstorm': 'APT35',
        'newscaster': 'APT35',
        
        // APT37
        'reaper': 'APT37',
        'scarcruft': 'APT37',
        'ricochet chollima': 'APT37',
        'group123': 'APT37',
        
        // APT38
        'lazarus group': 'APT38',
        'lazarus': 'APT38',
        'hidden cobra': 'APT38',
        'zinc': 'APT38',
        'labyrinth chollima': 'APT38',
        
        // APT40
        'leviathan': 'APT40',
        'temp.periscope': 'APT40',
        'bronze mohawk': 'APT40',
        'gingham typhoon': 'APT40',
        
        // APT41
        'winnti': 'APT41',
        'wicked panda': 'APT41',
        'barium': 'APT41',
        'brass typhoon': 'APT41',
        'double dragon': 'APT41',
        
        // APT42
        'charming kitten': 'APT42', // Note: Some overlap with APT35
        
        // Sandworm
        'sandworm': 'APT44',
        'voodoo bear': 'APT44',
        'iridium': 'APT44',
        'seashell blizzard': 'APT44',
        
        // Turla
        'turla': 'Turla',
        'snake': 'Turla',
        'venomous bear': 'Turla',
        'uroburos': 'Turla',
        'secret blizzard': 'Turla',
    };

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        // Dynamic alias map built from data sources
        aliasMap: new Map(),
        // Canonical name to all aliases
        canonicalToAliases: new Map(),
        // Statistics
        stats: {
            normalized: 0,
            aliasesResolved: 0
        }
    };

    // =========================================================================
    // CORE FUNCTIONS
    // =========================================================================

    /**
     * Normalizes an actor name to canonical form
     * @param {string} name - Original name
     * @returns {string} Normalized name
     */
    function normalize(name) {
        if (!name || typeof name !== 'string') return '';
        
        let normalized = name.trim();
        
        // Apply normalization patterns
        for (const { pattern, replacement } of NORMALIZATION_PATTERNS) {
            if (pattern.test(normalized)) {
                normalized = normalized.replace(pattern, replacement);
                state.stats.normalized++;
                break;
            }
        }
        
        return normalized;
    }

    /**
     * Resolves an alias to its canonical name
     * @param {string} name - Name or alias
     * @returns {string} Canonical name or original if not found
     */
    function resolveAlias(name) {
        if (!name || typeof name !== 'string') return '';
        
        const normalized = normalize(name);
        const lowerName = normalized.toLowerCase();
        
        // Check known aliases first
        if (KNOWN_ALIASES[lowerName]) {
            state.stats.aliasesResolved++;
            return KNOWN_ALIASES[lowerName];
        }
        
        // Check dynamic alias map
        if (state.aliasMap.has(lowerName)) {
            state.stats.aliasesResolved++;
            return state.aliasMap.get(lowerName);
        }
        
        return normalized;
    }

    /**
     * Registers an alias for a canonical name
     * @param {string} canonical - Canonical name
     * @param {string|string[]} aliases - Alias or array of aliases
     */
    function registerAlias(canonical, aliases) {
        const normalizedCanonical = normalize(canonical);
        const aliasList = Array.isArray(aliases) ? aliases : [aliases];
        
        // Get or create alias set for canonical name
        if (!state.canonicalToAliases.has(normalizedCanonical)) {
            state.canonicalToAliases.set(normalizedCanonical, new Set());
        }
        const aliasSet = state.canonicalToAliases.get(normalizedCanonical);
        
        for (const alias of aliasList) {
            if (!alias || typeof alias !== 'string') continue;
            
            const normalizedAlias = normalize(alias).toLowerCase();
            
            // Add to alias map (alias -> canonical)
            state.aliasMap.set(normalizedAlias, normalizedCanonical);
            
            // Add to canonical -> aliases map
            aliasSet.add(alias);
        }
    }

    /**
     * Gets all aliases for a canonical name
     * @param {string} canonical - Canonical name
     * @returns {string[]} Array of aliases
     */
    function getAliases(canonical) {
        const normalizedCanonical = normalize(canonical);
        const aliasSet = state.canonicalToAliases.get(normalizedCanonical);
        return aliasSet ? Array.from(aliasSet) : [];
    }

    /**
     * Checks if two names refer to the same actor
     * @param {string} name1 - First name
     * @param {string} name2 - Second name
     * @returns {boolean} True if same actor
     */
    function isSameActor(name1, name2) {
        const resolved1 = resolveAlias(name1);
        const resolved2 = resolveAlias(name2);
        return resolved1.toLowerCase() === resolved2.toLowerCase();
    }

    /**
     * Extracts APT number from name if present
     * @param {string} name - Actor name
     * @returns {number|null} APT number or null
     */
    function extractAPTNumber(name) {
        if (!name) return null;
        const match = name.match(/APT[\s\-_]*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Generates a search-friendly version of the name
     * @param {string} name - Actor name
     * @returns {string} Search-friendly name
     */
    function toSearchable(name) {
        if (!name) return '';
        return normalize(name)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    /**
     * Builds alias mappings from actor data
     * @param {Array} actors - Array of actor objects with name and aliases
     */
    function buildFromActors(actors) {
        if (!Array.isArray(actors)) return;
        
        for (const actor of actors) {
            const name = actor.name || actor.value;
            const aliases = actor.aliases || actor.synonyms || 
                           (actor.meta && actor.meta.synonyms) || [];
            
            if (name) {
                registerAlias(name, aliases);
            }
        }
        
        console.log(`[NameNormalizer] Built alias map: ${state.aliasMap.size} aliases for ${state.canonicalToAliases.size} actors`);
    }

    /**
     * Resets the normalizer state
     */
    function reset() {
        state.aliasMap.clear();
        state.canonicalToAliases.clear();
        state.stats.normalized = 0;
        state.stats.aliasesResolved = 0;
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        normalize,
        resolveAlias,
        registerAlias,
        getAliases,
        isSameActor,
        extractAPTNumber,
        toSearchable,
        buildFromActors,
        reset,
        
        /**
         * Gets statistics
         * @returns {Object} Stats object
         */
        getStats: function() {
            return {
                ...state.stats,
                aliasMapSize: state.aliasMap.size,
                canonicalCount: state.canonicalToAliases.size
            };
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NameNormalizer;
}


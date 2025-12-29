/**
 * APT Intelligence Dashboard - Actor Parser Module
 * 
 * This module processes raw MISP Galaxy threat actor data and APTnotes reports,
 * normalizing the data structures, building search indices, and linking reports
 * to their associated threat actors.
 * 
 * @module actorParser
 * @version 1.0.0
 */

const ActorParser = (function() {
    'use strict';

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        actors: [],                    // Normalized actor objects
        actorIndex: new Map(),         // UUID -> actor lookup
        nameIndex: new Map(),          // Lowercase name/synonym -> actor UUID
        countryIndex: new Map(),       // Country code -> Set of actor UUIDs
        sectorIndex: new Map(),        // Sector -> Set of actor UUIDs
        reports: [],                   // Normalized report objects
        actorReports: new Map(),       // Actor UUID -> Array of report objects
        timeline: [],                  // Chronologically sorted actors
        statistics: null,              // Computed statistics
        parsed: false
    };

    // =========================================================================
    // COUNTRY CODE MAPPINGS
    // =========================================================================

    const COUNTRY_NAMES = {
        'CN': 'China',
        'RU': 'Russia',
        'KP': 'North Korea',
        'IR': 'Iran',
        'US': 'United States',
        'IL': 'Israel',
        'PK': 'Pakistan',
        'IN': 'India',
        'VN': 'Vietnam',
        'UA': 'Ukraine',
        'BY': 'Belarus',
        'TR': 'Turkey',
        'SA': 'Saudi Arabia',
        'AE': 'United Arab Emirates',
        'SY': 'Syria',
        'LB': 'Lebanon',
        'PS': 'Palestine',
        'EG': 'Egypt',
        'NG': 'Nigeria',
        'ZA': 'South Africa',
        'BR': 'Brazil',
        'GB': 'United Kingdom',
        'DE': 'Germany',
        'FR': 'France',
        'NL': 'Netherlands',
        'KR': 'South Korea',
        'JP': 'Japan',
        'TW': 'Taiwan',
        'MY': 'Malaysia',
        'SG': 'Singapore',
        'PH': 'Philippines',
        'ID': 'Indonesia',
        'TH': 'Thailand'
    };

    // Reverse mapping for lookups
    const COUNTRY_CODES = Object.fromEntries(
        Object.entries(COUNTRY_NAMES).map(([code, name]) => [name.toLowerCase(), code])
    );

    // =========================================================================
    // SECTOR NORMALIZATION
    // =========================================================================

    const SECTOR_ALIASES = {
        'government': ['government', 'gov', 'government, administration', 'public sector', 'state'],
        'military': ['military', 'defense', 'defence', 'armed forces'],
        'finance': ['finance', 'financial', 'banking', 'financial services', 'banks'],
        'technology': ['technology', 'tech', 'it', 'information technology', 'software', 'hardware'],
        'telecommunications': ['telecommunications', 'telecom', 'telco', 'communications'],
        'energy': ['energy', 'power', 'utilities', 'oil', 'gas', 'oil and gas', 'petroleum'],
        'healthcare': ['healthcare', 'health', 'medical', 'pharmaceutical', 'pharma', 'hospitals'],
        'aerospace': ['aerospace', 'aviation', 'airlines', 'space'],
        'defense': ['defense', 'defence', 'defense industrial base', 'dib'],
        'manufacturing': ['manufacturing', 'industrial', 'industry'],
        'education': ['education', 'academic', 'universities', 'research'],
        'media': ['media', 'journalism', 'news', 'press', 'entertainment'],
        'retail': ['retail', 'e-commerce', 'ecommerce', 'commerce'],
        'transportation': ['transportation', 'transport', 'logistics', 'shipping'],
        'chemical': ['chemical', 'chemicals'],
        'legal': ['legal', 'law', 'law firms'],
        'ngo': ['ngo', 'non-profit', 'nonprofit', 'civil society', 'think tank', 'think tanks'],
        'crypto': ['cryptocurrency', 'crypto', 'blockchain', 'defi']
    };

    // Build reverse lookup
    const SECTOR_LOOKUP = {};
    Object.entries(SECTOR_ALIASES).forEach(([normalized, aliases]) => {
        aliases.forEach(alias => {
            SECTOR_LOOKUP[alias.toLowerCase()] = normalized;
        });
    });

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * Normalizes a sector name to a standard form
     * @param {string} sector - Raw sector name
     * @returns {string} Normalized sector name
     */
    function normalizeSector(sector) {
        if (!sector) return 'unknown';
        const lower = sector.toLowerCase().trim();
        return SECTOR_LOOKUP[lower] || lower;
    }

    /**
     * Gets full country name from code
     * @param {string} code - ISO country code
     * @returns {string} Full country name
     */
    function getCountryName(code) {
        if (!code) return 'Unknown';
        return COUNTRY_NAMES[code.toUpperCase()] || code;
    }

    /**
     * Extracts a year from various date formats
     * @param {string} dateStr - Date string in various formats
     * @returns {number|null} Year or null if not parseable
     */
    function extractYear(dateStr) {
        if (!dateStr) return null;
        
        // Handle "YYYY" format
        if (/^\d{4}$/.test(dateStr)) {
            return parseInt(dateStr, 10);
        }
        
        // Handle "MM/DD/YYYY" format (APTnotes)
        const mdyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (mdyMatch) {
            return parseInt(mdyMatch[3], 10);
        }
        
        // Handle ISO format "YYYY-MM-DD"
        const isoMatch = dateStr.match(/^(\d{4})-/);
        if (isoMatch) {
            return parseInt(isoMatch[1], 10);
        }
        
        // Try generic year extraction
        const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            return parseInt(yearMatch[0], 10);
        }
        
        return null;
    }

    /**
     * Extracts the earliest year mentioned in a description
     * Looks for patterns like "since 2015", "active in 2010", "first observed in 2008", etc.
     * @param {string} description - Actor description text
     * @returns {number|null} Earliest year found or null
     */
    function extractYearFromDescription(description) {
        if (!description) return null;
        
        const text = description.toLowerCase();
        
        // Patterns that indicate a start year (prioritize these)
        const startPatterns = [
            /(?:since|from|starting|began|started|first\s+(?:seen|observed|detected|identified|appeared|active)|active\s+since|operating\s+since|emerged\s+in|dating\s+back\s+to)\s+(?:at\s+least\s+)?(\d{4})/gi,
            /(?:in|around|circa)\s+(\d{4})\s*(?:,|\.|\s|$)/gi,
            /(\d{4})\s*(?:-|–|to)\s*(?:present|current|ongoing|today)/gi
        ];
        
        const foundYears = [];
        
        // Check start patterns first
        for (const pattern of startPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const year = parseInt(match[1], 10);
                if (year >= 1990 && year <= new Date().getFullYear()) {
                    foundYears.push(year);
                }
            }
        }
        
        // If no start pattern found, look for any year mentioned
        if (foundYears.length === 0) {
            const anyYearPattern = /\b(19[9]\d|20[0-2]\d)\b/g;
            let match;
            while ((match = anyYearPattern.exec(text)) !== null) {
                const year = parseInt(match[1], 10);
                if (year >= 1990 && year <= new Date().getFullYear()) {
                    foundYears.push(year);
                }
            }
        }
        
        // Return the earliest year found
        if (foundYears.length > 0) {
            return Math.min(...foundYears);
        }
        
        return null;
    }

    /**
     * Parses a date string to a Date object
     * @param {string} dateStr - Date string
     * @returns {Date|null} Date object or null
     */
    function parseDate(dateStr) {
        if (!dateStr) return null;
        
        // Handle "MM/DD/YYYY" format
        const mdyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (mdyMatch) {
            return new Date(parseInt(mdyMatch[3]), parseInt(mdyMatch[1]) - 1, parseInt(mdyMatch[2]));
        }
        
        // Try standard parsing
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    /**
     * Generates search tokens from text
     * @param {string} text - Text to tokenize
     * @returns {string[]} Array of lowercase tokens
     */
    function tokenize(text) {
        if (!text) return [];
        return text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 1);
    }

    /**
     * Checks if a report title/filename matches an actor
     * @param {string} text - Text to search in
     * @param {string[]} searchTerms - Terms to look for
     * @returns {boolean} True if match found
     */
    function matchesActor(text, searchTerms) {
        if (!text || !searchTerms || searchTerms.length === 0) return false;
        
        const lowerText = text.toLowerCase();
        
        return searchTerms.some(term => {
            // Exact substring match
            if (lowerText.includes(term.toLowerCase())) {
                return true;
            }
            
            // Word boundary match for short terms (prevent false positives)
            if (term.length <= 4) {
                const regex = new RegExp(`\\b${term}\\b`, 'i');
                return regex.test(text);
            }
            
            return false;
        });
    }

    // =========================================================================
    // PARSING FUNCTIONS
    // =========================================================================

    /**
     * Normalizes a single threat actor from MISP Galaxy format
     * @param {Object} rawActor - Raw actor data from MISP Galaxy
     * @returns {Object} Normalized actor object
     */
    function normalizeActor(rawActor) {
        const meta = rawActor.meta || {};
        
        // Normalize the actor name using NameNormalizer
        const normalizedName = typeof NameNormalizer !== 'undefined' 
            ? NameNormalizer.normalize(rawActor.value)
            : rawActor.value;
        
        // Collect all names for search indexing
        const allNames = [normalizedName, rawActor.value];
        if (meta.synonyms && Array.isArray(meta.synonyms)) {
            allNames.push(...meta.synonyms);
        }
        // Deduplicate
        const uniqueNames = [...new Set(allNames)];
        
        // Register aliases if NameNormalizer is available
        if (typeof NameNormalizer !== 'undefined') {
            NameNormalizer.registerAlias(normalizedName, meta.synonyms || []);
        }
        
        // Normalize sectors
        let sectors = [];
        if (meta['targeted-sector']) {
            sectors = (Array.isArray(meta['targeted-sector']) 
                ? meta['targeted-sector'] 
                : [meta['targeted-sector']]
            ).map(normalizeSector);
        }
        if (meta['cfr-target-category']) {
            const cfrSectors = (Array.isArray(meta['cfr-target-category'])
                ? meta['cfr-target-category']
                : [meta['cfr-target-category']]
            ).map(normalizeSector);
            sectors = [...new Set([...sectors, ...cfrSectors])];
        }
        
        // Normalize victims (countries targeted)
        let victims = [];
        if (meta['cfr-suspected-victims']) {
            victims = Array.isArray(meta['cfr-suspected-victims'])
                ? meta['cfr-suspected-victims']
                : [meta['cfr-suspected-victims']];
        }
        
        // Extract first seen year from MISP data
        let firstSeen = null;
        let firstSeenSource = 'misp-galaxy';
        if (meta.since) {
            firstSeen = extractYear(meta.since);
        }
        
        // Check DataNormalizer for better first-seen date (from ETDA, MITRE, etc.)
        if (typeof DataNormalizer !== 'undefined') {
            const enrichedActor = DataNormalizer.getActor(normalizedName);
            if (enrichedActor) {
                // Use earliest first-seen date
                if (enrichedActor.firstSeen !== null) {
                    if (firstSeen === null || enrichedActor.firstSeen < firstSeen) {
                        firstSeen = enrichedActor.firstSeen;
                        firstSeenSource = enrichedActor.firstSeenSource || 'normalized';
                    }
                }
                
                // Merge additional aliases
                if (enrichedActor.aliases && enrichedActor.aliases.length > 0) {
                    uniqueNames.push(...enrichedActor.aliases);
                }
            }
        }
        
        // FALLBACK: If still no firstSeen, try to extract year from description
        if (firstSeen === null && rawActor.description) {
            const descriptionYear = extractYearFromDescription(rawActor.description);
            if (descriptionYear) {
                firstSeen = descriptionYear;
                firstSeenSource = 'description';
            }
        }
        
        // Build references array
        const refs = meta.refs && Array.isArray(meta.refs) ? meta.refs : [];
        
        // Find MITRE ATT&CK reference if exists
        const mitreRef = refs.find(ref => ref.includes('attack.mitre.org/groups/'));
        const mitreId = mitreRef ? mitreRef.match(/groups\/(G\d+)/)?.[1] : null;
        
        return {
            uuid: rawActor.uuid,
            name: normalizedName,
            originalName: rawActor.value,
            description: rawActor.description || '',
            
            // Attribution
            country: meta.country || null,
            countryName: getCountryName(meta.country),
            stateSponsored: !!meta['cfr-suspected-state-sponsor'],
            stateSponsor: meta['cfr-suspected-state-sponsor'] || null,
            
            // Confidence
            attributionConfidence: meta['attribution-confidence'] 
                ? parseInt(meta['attribution-confidence'], 10) 
                : null,
            
            // Targeting
            sectors: sectors,
            victims: victims,
            incidentType: meta['cfr-type-of-incident'] || null,
            
            // Identifiers
            synonyms: meta.synonyms || [],
            allNames: [...new Set(uniqueNames)],
            mitreId: mitreId,
            
            // Timeline
            firstSeen: firstSeen,
            firstSeenSource: firstSeenSource,
            
            // References
            refs: refs,
            refCount: refs.length,
            
            // Relations
            related: rawActor.related || [],
            
            // Metadata for UI
            searchTokens: tokenize(uniqueNames.join(' ') + ' ' + (rawActor.description || '')),
            reportsCount: 0  // Will be updated after report linking
        };
    }

    /**
     * Normalizes a single report from APTnotes format
     * @param {Object} rawReport - Raw report data from APTnotes
     * @returns {Object} Normalized report object
     */
    function normalizeReport(rawReport) {
        const date = parseDate(rawReport.Date);
        
        return {
            id: rawReport['SHA-1'] || rawReport.Filename,
            filename: rawReport.Filename || '',
            title: rawReport.Title || '',
            source: rawReport.Source || 'Unknown',
            link: rawReport.Link || '',
            date: date,
            year: rawReport.Year ? parseInt(rawReport.Year, 10) : extractYear(rawReport.Date),
            dateFormatted: date ? date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : rawReport.Date,
            
            // Will be populated during linking
            linkedActors: [],
            searchText: `${rawReport.Title} ${rawReport.Filename} ${rawReport.Source}`.toLowerCase()
        };
    }

    /**
     * Links reports to actors based on name/synonym matching
     * Uses inverted index for O(n+m) performance instead of O(n×m)
     */
    function linkReportsToActors() {
        console.log('[ActorParser] Linking reports to actors...');
        
        // Reset linkages
        state.actorReports.clear();
        state.actors.forEach(actor => {
            actor.reportsCount = 0;
        });
        state.reports.forEach(report => {
            report.linkedActors = [];
        });
        
        // OPTIMIZATION: Build inverted index from search terms to actor UUIDs
        // This converts O(n×m) to O(n+m) where n=reports, m=actors
        const termToActors = new Map();  // lowercase term -> Set of {uuid, name}
        
        state.actors.forEach(actor => {
            const terms = actor.allNames.filter(name => name && name.length > 2);
            terms.forEach(term => {
                const lowerTerm = term.toLowerCase();
                if (!termToActors.has(lowerTerm)) {
                    termToActors.set(lowerTerm, new Set());
                }
                termToActors.get(lowerTerm).add({ uuid: actor.uuid, name: actor.name });
            });
        });
        
        // Convert Set to array for each term for faster iteration
        const termToActorsArray = new Map();
        termToActors.forEach((actorSet, term) => {
            termToActorsArray.set(term, Array.from(actorSet));
        });
        
        // Get all unique terms sorted by length (longer terms first for better matching)
        const allTerms = Array.from(termToActorsArray.keys()).sort((a, b) => b.length - a.length);
        
        // Match each report against the inverted index
        let totalLinks = 0;
        const matchedPairs = new Set();  // Track "reportId:actorUuid" to avoid duplicates
        
        state.reports.forEach(report => {
            const searchText = `${report.title} ${report.filename}`.toLowerCase();
            
            // Check each term against the search text
            for (const term of allTerms) {
                // For short terms, require word boundary match
                if (term.length <= 4) {
                    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    if (!regex.test(searchText)) continue;
                } else {
                    // For longer terms, substring match is sufficient
                    if (!searchText.includes(term)) continue;
                }
                
                // Found a match - link all actors associated with this term
                const actors = termToActorsArray.get(term);
                for (const actorInfo of actors) {
                    const pairKey = `${report.id}:${actorInfo.uuid}`;
                    if (matchedPairs.has(pairKey)) continue;  // Skip if already linked
                    
                    matchedPairs.add(pairKey);
                    
                    const actor = state.actorIndex.get(actorInfo.uuid);
                    if (!actor) continue;
                    
                    report.linkedActors.push({
                        uuid: actor.uuid,
                        name: actor.name,
                        country: actor.country,
                        sectors: actor.sectors || [],
                        stateSponsor: actor.stateSponsor
                    });
                    
                    if (!state.actorReports.has(actor.uuid)) {
                        state.actorReports.set(actor.uuid, []);
                    }
                    state.actorReports.get(actor.uuid).push(report);
                    
                    actor.reportsCount++;
                    totalLinks++;
                }
            }
        });
        
        // Clean up temporary data structures
        termToActors.clear();
        termToActorsArray.clear();
        matchedPairs.clear();
        
        // Sort reports by date for each actor
        state.actorReports.forEach((reports, uuid) => {
            reports.sort((a, b) => {
                if (!a.date && !b.date) return 0;
                if (!a.date) return 1;
                if (!b.date) return -1;
                return b.date - a.date; // Most recent first
            });
        });
        
        console.log(`[ActorParser] Linked ${totalLinks} report-actor associations (optimized)`);
    }

    /**
     * Builds indices for fast lookups
     */
    function buildIndices() {
        console.log('[ActorParser] Building indices...');
        
        // Clear existing indices
        state.actorIndex.clear();
        state.nameIndex.clear();
        state.countryIndex.clear();
        state.sectorIndex.clear();
        
        state.actors.forEach(actor => {
            // UUID index
            state.actorIndex.set(actor.uuid, actor);
            
            // Name index (all names and synonyms)
            actor.allNames.forEach(name => {
                if (name) {
                    state.nameIndex.set(name.toLowerCase(), actor.uuid);
                }
            });
            
            // Country index
            if (actor.country) {
                const countryCode = actor.country.toUpperCase();
                if (!state.countryIndex.has(countryCode)) {
                    state.countryIndex.set(countryCode, new Set());
                }
                state.countryIndex.get(countryCode).add(actor.uuid);
            }
            
            // Sector index
            actor.sectors.forEach(sector => {
                if (!state.sectorIndex.has(sector)) {
                    state.sectorIndex.set(sector, new Set());
                }
                state.sectorIndex.get(sector).add(actor.uuid);
            });
        });
        
        console.log(`[ActorParser] Indices built: ${state.actorIndex.size} actors, ${state.nameIndex.size} names, ${state.countryIndex.size} countries, ${state.sectorIndex.size} sectors`);
    }

    /**
     * Builds chronological timeline
     */
    function buildTimeline() {
        // Filter actors with first seen dates and sort
        state.timeline = state.actors
            .filter(actor => actor.firstSeen)
            .sort((a, b) => a.firstSeen - b.firstSeen);
        
        console.log(`[ActorParser] Timeline built with ${state.timeline.length} dated actors`);
    }

    /**
     * Computes statistics about the parsed data
     */
    function computeStatistics() {
        const countryStats = {};
        const sectorStats = {};
        const yearStats = {};
        
        state.actors.forEach(actor => {
            // Country stats
            if (actor.country) {
                countryStats[actor.country] = (countryStats[actor.country] || 0) + 1;
            }
            
            // Sector stats
            actor.sectors.forEach(sector => {
                sectorStats[sector] = (sectorStats[sector] || 0) + 1;
            });
            
            // Year stats
            if (actor.firstSeen) {
                yearStats[actor.firstSeen] = (yearStats[actor.firstSeen] || 0) + 1;
            }
        });
        
        // Report year stats
        const reportYearStats = {};
        state.reports.forEach(report => {
            if (report.year) {
                reportYearStats[report.year] = (reportYearStats[report.year] || 0) + 1;
            }
        });
        
        state.statistics = {
            totalActors: state.actors.length,
            actorsWithCountry: Object.values(countryStats).reduce((a, b) => a + b, 0),
            actorsWithFirstSeen: state.timeline.length,
            totalReports: state.reports.length,
            linkedReports: state.reports.filter(r => r.linkedActors.length > 0).length,
            
            byCountry: Object.entries(countryStats)
                .map(([code, count]) => ({ code, name: getCountryName(code), count }))
                .sort((a, b) => b.count - a.count),
            
            bySector: Object.entries(sectorStats)
                .map(([sector, count]) => ({ sector, count }))
                .sort((a, b) => b.count - a.count),
            
            byYear: Object.entries(yearStats)
                .map(([year, count]) => ({ year: parseInt(year), count }))
                .sort((a, b) => a.year - b.year),
            
            reportsByYear: Object.entries(reportYearStats)
                .map(([year, count]) => ({ year: parseInt(year), count }))
                .sort((a, b) => a.year - b.year)
        };
        
        console.log('[ActorParser] Statistics computed:', state.statistics);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Parses MISP Galaxy threat actor data
         * @param {Object} mispData - Raw MISP Galaxy data
         * @returns {Array} Array of normalized actor objects
         */
        parseActors: function(mispData) {
            if (!mispData || !mispData.values) {
                console.error('[ActorParser] Invalid MISP Galaxy data');
                return [];
            }
            
            console.log(`[ActorParser] Parsing ${mispData.values.length} actors...`);
            
            state.actors = mispData.values.map(normalizeActor);
            state.parsed = true;
            
            buildIndices();
            buildTimeline();
            
            console.log(`[ActorParser] Parsed ${state.actors.length} actors`);
            
            return state.actors;
        },

        /**
         * Parses APTnotes report data
         * @param {Array} aptNotesData - Raw APTnotes data
         * @returns {Array} Array of normalized report objects
         */
        parseReports: function(aptNotesData) {
            if (!Array.isArray(aptNotesData)) {
                console.error('[ActorParser] Invalid APTnotes data');
                return [];
            }
            
            console.log(`[ActorParser] Parsing ${aptNotesData.length} reports...`);
            
            state.reports = aptNotesData.map(normalizeReport);
            
            // Sort by date descending
            state.reports.sort((a, b) => {
                if (!a.date && !b.date) return 0;
                if (!a.date) return 1;
                if (!b.date) return -1;
                return b.date - a.date;
            });
            
            // Link reports to actors if actors are already parsed
            if (state.parsed && state.actors.length > 0) {
                linkReportsToActors();
                computeStatistics();
            }
            
            console.log(`[ActorParser] Parsed ${state.reports.length} reports`);
            
            return state.reports;
        },

        /**
         * Parses both data sources and links them together
         * @param {Object} mispData - Raw MISP Galaxy data
         * @param {Array} aptNotesData - Raw APTnotes data
         * @returns {Object} Object containing actors, reports, and statistics
         */
        parseAll: function(mispData, aptNotesData) {
            const actors = this.parseActors(mispData);
            const reports = this.parseReports(aptNotesData);
            
            if (actors.length > 0 && reports.length > 0) {
                linkReportsToActors();
            }
            
            computeStatistics();
            
            return {
                actors,
                reports,
                statistics: state.statistics
            };
        },

        /**
         * Gets all parsed actors
         * @returns {Array} Array of actor objects
         */
        getActors: function() {
            return state.actors;
        },

        /**
         * Gets an actor by UUID
         * @param {string} uuid - Actor UUID
         * @returns {Object|null} Actor object or null
         */
        getActorByUuid: function(uuid) {
            return state.actorIndex.get(uuid) || null;
        },

        /**
         * Gets an actor by name or synonym
         * @param {string} name - Actor name or synonym
         * @returns {Object|null} Actor object or null
         */
        getActorByName: function(name) {
            if (!name) return null;
            const uuid = state.nameIndex.get(name.toLowerCase());
            return uuid ? state.actorIndex.get(uuid) : null;
        },

        /**
         * Gets actors by country code
         * @param {string} countryCode - ISO country code
         * @returns {Array} Array of actor objects
         */
        getActorsByCountry: function(countryCode) {
            if (!countryCode) return [];
            const uuids = state.countryIndex.get(countryCode.toUpperCase());
            if (!uuids) return [];
            return Array.from(uuids).map(uuid => state.actorIndex.get(uuid));
        },

        /**
         * Gets actors by target sector
         * @param {string} sector - Sector name
         * @returns {Array} Array of actor objects
         */
        getActorsBySector: function(sector) {
            if (!sector) return [];
            const normalizedSector = normalizeSector(sector);
            const uuids = state.sectorIndex.get(normalizedSector);
            if (!uuids) return [];
            return Array.from(uuids).map(uuid => state.actorIndex.get(uuid));
        },

        /**
         * Searches actors by text
         * @param {string} query - Search query
         * @returns {Array} Array of matching actor objects
         */
        searchActors: function(query) {
            if (!query || query.length < 2) return state.actors;
            
            const tokens = tokenize(query);
            
            return state.actors.filter(actor => {
                // Check name match first (faster)
                const nameLower = actor.name.toLowerCase();
                if (nameLower.includes(query.toLowerCase())) {
                    return true;
                }
                
                // Check synonyms
                if (actor.synonyms.some(s => s.toLowerCase().includes(query.toLowerCase()))) {
                    return true;
                }
                
                // Check description tokens
                return tokens.every(token => 
                    actor.searchTokens.some(t => t.includes(token))
                );
            });
        },

        /**
         * Gets all reports
         * @returns {Array} Array of report objects
         */
        getReports: function() {
            return state.reports;
        },

        /**
         * Gets reports for a specific actor
         * @param {string} uuid - Actor UUID
         * @returns {Array} Array of report objects
         */
        getReportsForActor: function(uuid) {
            return state.actorReports.get(uuid) || [];
        },

        /**
         * Searches reports by text
         * @param {string} query - Search query
         * @returns {Array} Array of matching report objects
         */
        searchReports: function(query) {
            if (!query || query.length < 2) return state.reports;
            
            const lowerQuery = query.toLowerCase();
            
            return state.reports.filter(report => 
                report.searchText.includes(lowerQuery)
            );
        },

        /**
         * Gets the chronological timeline of actors
         * @returns {Array} Actors sorted by first seen date
         */
        getTimeline: function() {
            return state.timeline;
        },

        /**
         * Rebuilds the timeline after enrichment adds new firstSeen dates
         * Should be called after all enrichment steps are complete
         */
        rebuildTimeline: function() {
            buildTimeline();
            computeStatistics();
            return state.timeline.length;
        },

        /**
         * Gets computed statistics
         * @returns {Object|null} Statistics object
         */
        getStatistics: function() {
            return state.statistics;
        },

        /**
         * Gets list of all countries with actors
         * @returns {Array} Array of {code, name, count} objects
         */
        getCountries: function() {
            return state.statistics?.byCountry || [];
        },

        /**
         * Gets list of all sectors with actors
         * @returns {Array} Array of {sector, count} objects
         */
        getSectors: function() {
            return state.statistics?.bySector || [];
        },

        /**
         * Gets the country name for a code
         * @param {string} code - ISO country code
         * @returns {string} Country name
         */
        getCountryName: getCountryName,

        /**
         * Checks if data has been parsed
         * @returns {boolean} True if parsed
         */
        isParsed: function() {
            return state.parsed;
        },

        /**
         * Resets all parsed data
         */
        reset: function() {
            state.actors = [];
            state.actorIndex.clear();
            state.nameIndex.clear();
            state.countryIndex.clear();
            state.sectorIndex.clear();
            state.reports = [];
            state.actorReports.clear();
            state.timeline = [];
            state.statistics = null;
            state.parsed = false;
            
            console.log('[ActorParser] Reset complete');
        }
    };
})();

// Export for module systems (if applicable)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActorParser;
}

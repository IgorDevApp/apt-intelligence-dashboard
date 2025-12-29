/**
 * APT Intelligence Dashboard - Search Module
 * 
 * Advanced search functionality with fuzzy matching and filtering.
 * 
 * @module search
 * @version 1.0.0
 */

const Search = (function() {
    'use strict';

    /**
     * Performs fuzzy string matching
     * @param {string} needle - Search string
     * @param {string} haystack - String to search in
     * @returns {Object} Match result with score
     */
    function fuzzyMatch(needle, haystack) {
        if (!needle || !haystack) {
            return { match: false, score: 0 };
        }

        needle = needle.toLowerCase();
        haystack = haystack.toLowerCase();

        // Exact match
        if (haystack === needle) {
            return { match: true, score: 100 };
        }

        // Contains match
        if (haystack.includes(needle)) {
            const position = haystack.indexOf(needle);
            const score = 80 - (position * 0.5); // Earlier matches score higher
            return { match: true, score: Math.max(score, 50) };
        }

        // Starts with match
        if (haystack.startsWith(needle)) {
            return { match: true, score: 90 };
        }

        // Word starts with match
        const words = haystack.split(/\s+/);
        for (const word of words) {
            if (word.startsWith(needle)) {
                return { match: true, score: 70 };
            }
        }

        // Fuzzy character match
        let needleIdx = 0;
        let score = 0;
        let consecutiveMatches = 0;

        for (let i = 0; i < haystack.length && needleIdx < needle.length; i++) {
            if (haystack[i] === needle[needleIdx]) {
                score += 10 + (consecutiveMatches * 5);
                consecutiveMatches++;
                needleIdx++;
            } else {
                consecutiveMatches = 0;
            }
        }

        if (needleIdx === needle.length) {
            // Normalize score (max possible score)
            const maxScore = needle.length * 10 + (needle.length - 1) * 5;
            const normalizedScore = (score / maxScore) * 40;
            return { match: true, score: normalizedScore };
        }

        return { match: false, score: 0 };
    }

    /**
     * Highlights matched text in a string
     * @param {string} text - Text to highlight in
     * @param {string} query - Query to highlight
     * @param {string} highlightClass - CSS class for highlighting
     * @returns {string} HTML string with highlighted matches
     */
    function highlight(text, query, highlightClass = 'search-highlight') {
        if (!text || !query) return text || '';

        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        
        return text.replace(regex, `<mark class="${highlightClass}">$1</mark>`);
    }

    /**
     * Tokenizes a search query into individual terms
     * @param {string} query - Search query
     * @returns {Object} Parsed query with terms, phrases, and exclusions
     */
    function parseQuery(query) {
        if (!query) {
            return { terms: [], phrases: [], exclusions: [] };
        }

        const phrases = [];
        const exclusions = [];
        const terms = [];

        // Extract quoted phrases
        const phraseRegex = /"([^"]+)"/g;
        let match;
        while ((match = phraseRegex.exec(query)) !== null) {
            phrases.push(match[1].toLowerCase());
        }

        // Remove quoted phrases from query
        let remaining = query.replace(phraseRegex, ' ').trim();

        // Extract exclusions (words starting with -)
        const words = remaining.split(/\s+/);
        for (const word of words) {
            if (word.startsWith('-') && word.length > 1) {
                exclusions.push(word.substring(1).toLowerCase());
            } else if (word.length > 0) {
                terms.push(word.toLowerCase());
            }
        }

        return { terms, phrases, exclusions };
    }

    /**
     * Searches an array of objects
     * @param {Array} items - Items to search
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} Matching items sorted by relevance
     */
    function search(items, query, options = {}) {
        const {
            fields = ['name'],
            threshold = 20,
            limit = 0,
            caseSensitive = false
        } = options;

        if (!query || !items || items.length === 0) {
            return items || [];
        }

        const parsed = parseQuery(query);
        const results = [];

        for (const item of items) {
            let totalScore = 0;
            let matchedFields = 0;
            let excluded = false;

            // Check exclusions
            for (const exclusion of parsed.exclusions) {
                for (const field of fields) {
                    const value = getFieldValue(item, field);
                    if (value && value.toLowerCase().includes(exclusion)) {
                        excluded = true;
                        break;
                    }
                }
                if (excluded) break;
            }

            if (excluded) continue;

            // Check phrases (must match exactly)
            let phraseMatches = 0;
            for (const phrase of parsed.phrases) {
                for (const field of fields) {
                    const value = getFieldValue(item, field);
                    if (value && value.toLowerCase().includes(phrase)) {
                        phraseMatches++;
                        totalScore += 50;
                        break;
                    }
                }
            }

            if (parsed.phrases.length > 0 && phraseMatches < parsed.phrases.length) {
                continue; // All phrases must match
            }

            // Check terms
            for (const term of parsed.terms) {
                let termMatched = false;
                let bestTermScore = 0;

                for (const field of fields) {
                    const value = getFieldValue(item, field);
                    if (!value) continue;

                    const result = fuzzyMatch(term, value);
                    if (result.match && result.score > bestTermScore) {
                        bestTermScore = result.score;
                        termMatched = true;
                    }
                }

                if (termMatched) {
                    totalScore += bestTermScore;
                    matchedFields++;
                }
            }

            // Calculate final score
            if (matchedFields > 0 || phraseMatches > 0) {
                const avgScore = parsed.terms.length > 0 
                    ? totalScore / (parsed.terms.length + parsed.phrases.length)
                    : totalScore;

                if (avgScore >= threshold) {
                    results.push({
                        item,
                        score: avgScore,
                        matchedFields
                    });
                }
            }
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        // Apply limit if specified
        const finalResults = limit > 0 ? results.slice(0, limit) : results;

        return finalResults.map(r => r.item);
    }

    /**
     * Gets a nested field value from an object
     * @param {Object} obj - Object to get value from
     * @param {string} field - Field path (supports dot notation)
     * @returns {string} Field value as string
     */
    function getFieldValue(obj, field) {
        if (!obj || !field) return '';

        const parts = field.split('.');
        let value = obj;

        for (const part of parts) {
            if (value === null || value === undefined) return '';
            value = value[part];
        }

        // Handle arrays
        if (Array.isArray(value)) {
            return value.join(' ');
        }

        return value ? String(value) : '';
    }

    /**
     * Creates a search index for faster searching
     * @param {Array} items - Items to index
     * @param {Array} fields - Fields to index
     * @returns {Object} Search index
     */
    function createIndex(items, fields) {
        const index = {
            items: items,
            fields: fields,
            tokens: new Map(),
            itemTokens: new Map()
        };

        items.forEach((item, itemIndex) => {
            const tokens = new Set();

            for (const field of fields) {
                const value = getFieldValue(item, field);
                if (!value) continue;

                // Tokenize the value
                const fieldTokens = tokenize(value);
                fieldTokens.forEach(token => {
                    tokens.add(token);

                    if (!index.tokens.has(token)) {
                        index.tokens.set(token, new Set());
                    }
                    index.tokens.get(token).add(itemIndex);
                });
            }

            index.itemTokens.set(itemIndex, tokens);
        });

        return index;
    }

    /**
     * Tokenizes a string into searchable tokens
     * @param {string} text - Text to tokenize
     * @returns {Array} Array of tokens
     */
    function tokenize(text) {
        if (!text) return [];
        
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length >= 2);
    }

    /**
     * Searches using a pre-built index
     * @param {Object} index - Search index
     * @param {string} query - Search query
     * @returns {Array} Matching items
     */
    function searchIndex(index, query) {
        if (!query) return index.items;

        const queryTokens = tokenize(query);
        if (queryTokens.length === 0) return index.items;

        // Find items that match all tokens
        let matchingIndices = null;

        for (const token of queryTokens) {
            const tokenMatches = new Set();

            // Find all tokens that start with the query token
            index.tokens.forEach((itemIndices, indexedToken) => {
                if (indexedToken.startsWith(token) || indexedToken.includes(token)) {
                    itemIndices.forEach(idx => tokenMatches.add(idx));
                }
            });

            if (matchingIndices === null) {
                matchingIndices = tokenMatches;
            } else {
                // Intersect with previous matches
                matchingIndices = new Set(
                    [...matchingIndices].filter(idx => tokenMatches.has(idx))
                );
            }
        }

        if (!matchingIndices || matchingIndices.size === 0) {
            return [];
        }

        return [...matchingIndices].map(idx => index.items[idx]);
    }

    return {
        fuzzyMatch,
        highlight,
        parseQuery,
        search,
        createIndex,
        searchIndex,
        tokenize
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Search;
}

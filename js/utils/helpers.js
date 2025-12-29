/**
 * APT Intelligence Dashboard - Helpers Module
 * 
 * Common utility functions used throughout the application.
 * 
 * @module helpers
 * @version 1.0.0
 */

const Helpers = (function() {
    'use strict';

    /**
     * Escapes HTML special characters to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, char => map[char]);
    }

    /**
     * Capitalizes the first letter of a string
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Capitalizes each word in a string
     * @param {string} str - String to title case
     * @returns {string} Title cased string
     */
    function titleCase(str) {
        if (!str) return '';
        return str.split(' ').map(capitalize).join(' ');
    }

    /**
     * Truncates text to a maximum length
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @param {string} suffix - Suffix to append if truncated
     * @returns {string} Truncated text
     */
    function truncate(text, maxLength = 100, suffix = '...') {
        if (!text || text.length <= maxLength) return text || '';
        return text.substring(0, maxLength - suffix.length).trim() + suffix;
    }

    /**
     * Creates a debounced function that delays invoking func
     * @param {Function} func - Function to debounce
     * @param {number} wait - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Creates a throttled function that only invokes func at most once per wait period
     * @param {Function} func - Function to throttle
     * @param {number} wait - Minimum time between invocations
     * @returns {Function} Throttled function
     */
    function throttle(func, wait = 100) {
        let lastTime = 0;
        return function executedFunction(...args) {
            const now = Date.now();
            if (now - lastTime >= wait) {
                lastTime = now;
                func.apply(this, args);
            }
        };
    }

    /**
     * Formats a number with thousands separators
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    function formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return num.toLocaleString('en-US');
    }

    /**
     * Formats a date object to a readable string
     * @param {Date|string|number} date - Date to format
     * @param {Object} options - Intl.DateTimeFormat options
     * @returns {string} Formatted date string
     */
    function formatDate(date, options = {}) {
        if (!date) return 'Unknown';
        
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return 'Invalid date';

        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };

        return d.toLocaleDateString('en-US', { ...defaultOptions, ...options });
    }

    /**
     * Formats a date as relative time (e.g., "2 hours ago")
     * @param {Date|string|number} date - Date to format
     * @returns {string} Relative time string
     */
    function formatRelativeTime(date) {
        if (!date) return 'Unknown';
        
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return 'Invalid date';

        const now = new Date();
        const diffMs = now - d;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return 'just now';
        if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
        if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
        if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
        
        return formatDate(d);
    }

    /**
     * Deep clones an object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (obj instanceof Object) {
            const clone = {};
            Object.keys(obj).forEach(key => {
                clone[key] = deepClone(obj[key]);
            });
            return clone;
        }
        return obj;
    }

    /**
     * Generates a unique ID
     * @param {string} prefix - Optional prefix
     * @returns {string} Unique ID
     */
    function generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    }

    /**
     * Checks if a value is empty (null, undefined, empty string, empty array, empty object)
     * @param {*} value - Value to check
     * @returns {boolean} True if empty
     */
    function isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }

    /**
     * Groups an array of objects by a key
     * @param {Array} array - Array to group
     * @param {string|Function} key - Key to group by (string or function)
     * @returns {Object} Grouped object
     */
    function groupBy(array, key) {
        if (!Array.isArray(array)) return {};
        
        const getKey = typeof key === 'function' ? key : item => item[key];
        
        return array.reduce((groups, item) => {
            const groupKey = getKey(item);
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
            return groups;
        }, {});
    }

    /**
     * Sorts an array of objects by a key
     * @param {Array} array - Array to sort
     * @param {string} key - Key to sort by
     * @param {string} order - 'asc' or 'desc'
     * @returns {Array} Sorted array
     */
    function sortBy(array, key, order = 'asc') {
        if (!Array.isArray(array)) return [];
        
        return [...array].sort((a, b) => {
            let valueA = a[key];
            let valueB = b[key];
            
            // Handle null/undefined
            if (valueA == null) return order === 'asc' ? 1 : -1;
            if (valueB == null) return order === 'asc' ? -1 : 1;
            
            // Handle strings
            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }
            
            if (valueA < valueB) return order === 'asc' ? -1 : 1;
            if (valueA > valueB) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Creates a URL-safe slug from a string
     * @param {string} str - String to slugify
     * @returns {string} URL-safe slug
     */
    function slugify(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Parses a URL and returns its components
     * @param {string} url - URL to parse
     * @returns {Object} URL components
     */
    function parseUrl(url) {
        try {
            const parsed = new URL(url);
            return {
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                pathname: parsed.pathname,
                search: parsed.search,
                hash: parsed.hash,
                origin: parsed.origin
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Extracts domain from a URL
     * @param {string} url - URL to extract domain from
     * @returns {string} Domain or original URL if parsing fails
     */
    function extractDomain(url) {
        const parsed = parseUrl(url);
        return parsed ? parsed.hostname : url;
    }

    /**
     * Copies text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                return true;
            } catch (err) {
                return false;
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }

    /**
     * Downloads data as a file
     * @param {string} data - Data to download
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    function downloadFile(data, filename, mimeType = 'text/plain') {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    return {
        escapeHtml,
        capitalize,
        titleCase,
        truncate,
        debounce,
        throttle,
        formatNumber,
        formatDate,
        formatRelativeTime,
        deepClone,
        generateId,
        isEmpty,
        groupBy,
        sortBy,
        slugify,
        parseUrl,
        extractDomain,
        copyToClipboard,
        downloadFile
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Helpers;
}

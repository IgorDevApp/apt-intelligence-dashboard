/**
 * APT Intelligence Dashboard - Timeline UI Module
 * 
 * Handles timeline visualization rendering.
 * Core functionality integrated into app.js.
 * 
 * @module timeline
 * @version 1.0.0
 */

const Timeline = (function() {
    'use strict';

    const config = {
        groupByYear: true,
        showDescriptions: true,
        maxItemsPerYear: 20
    };

    function getConfig() {
        return { ...config };
    }

    function setConfig(updates) {
        Object.assign(config, updates);
    }

    return {
        getConfig,
        setConfig
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Timeline;
}

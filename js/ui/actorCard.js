/**
 * APT Intelligence Dashboard - Actor Card UI Module
 * 
 * Handles actor card rendering and interactions.
 * Core functionality integrated into app.js.
 * 
 * @module actorCard
 * @version 1.0.0
 */

const ActorCard = (function() {
    'use strict';

    // Extension point for card customization
    const config = {
        showCountryFlag: true,
        showReportCount: true,
        maxDescriptionLength: 200
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
    module.exports = ActorCard;
}

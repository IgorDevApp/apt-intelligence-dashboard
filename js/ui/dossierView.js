/**
 * APT Intelligence Dashboard - Dossier View UI Module
 * 
 * Handles actor dossier modal rendering.
 * Core functionality integrated into app.js.
 * 
 * @module dossierView
 * @version 1.0.0
 */

const DossierView = (function() {
    'use strict';

    const config = {
        animateOnOpen: true,
        showAllReferences: false,
        maxReferences: 15,
        maxReports: 10
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
    module.exports = DossierView;
}

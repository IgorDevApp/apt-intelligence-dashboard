/**
 * APT Intelligence Dashboard - Dashboard UI Module
 * 
 * Handles main dashboard rendering and state management.
 * Most functionality is integrated into app.js for this version.
 * 
 * @module dashboard
 * @version 1.0.0
 */

const Dashboard = (function() {
    'use strict';

    // Dashboard state extension point for future enhancements
    const state = {
        sortField: 'name',
        sortOrder: 'asc',
        pageSize: 50,
        currentPage: 1
    };

    /**
     * Gets current dashboard state
     */
    function getState() {
        return { ...state };
    }

    /**
     * Updates dashboard state
     */
    function setState(updates) {
        Object.assign(state, updates);
    }

    /**
     * Resets dashboard state
     */
    function reset() {
        state.sortField = 'name';
        state.sortOrder = 'asc';
        state.pageSize = 50;
        state.currentPage = 1;
    }

    return {
        getState,
        setState,
        reset
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dashboard;
}

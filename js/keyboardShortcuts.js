/**
 * APT Intelligence Dashboard - Keyboard Shortcuts
 * 
 * Provides keyboard shortcuts for common actions and a help modal.
 * 
 * @module keyboardShortcuts
 * @version 1.0.0
 */

const KeyboardShortcuts = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const SHORTCUTS = [
        // Navigation
        { keys: ['1'], alt: true, action: 'viewActors', description: 'Go to Actors view' },
        { keys: ['2'], alt: true, action: 'viewMap', description: 'Go to World Map view' },
        { keys: ['3'], alt: true, action: 'viewTimeline', description: 'Go to Timeline view' },
        { keys: ['4'], alt: true, action: 'viewReports', description: 'Go to Reports view' },
        { keys: ['5'], alt: true, action: 'viewStats', description: 'Go to Statistics view' },
        
        // Actions
        { keys: ['/', 'k'], ctrl: true, action: 'focusSearch', description: 'Focus search' },
        { keys: ['r'], ctrl: true, shift: true, action: 'refresh', description: 'Refresh data' },
        { keys: [','], ctrl: true, action: 'openSettings', description: 'Open settings' },
        { keys: ['Escape'], action: 'closeModal', description: 'Close modal/dialog' },
        
        // Help
        { keys: ['?'], shift: true, action: 'showHelp', description: 'Show keyboard shortcuts' }
    ];

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        enabled: true,
        helpModal: null
    };

    // =========================================================================
    // ACTIONS
    // =========================================================================

    const actions = {
        viewActors: () => switchView('actors-view'),
        viewMap: () => switchView('worldmap-view'),
        viewTimeline: () => switchView('timeline-view'),
        viewReports: () => switchView('reports-view'),
        viewStats: () => switchView('statistics-view'),
        
        focusSearch: () => {
            const searchInput = document.querySelector('#search-input, .search-input, input[type="search"], input[type="text"]');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        },
        
        refresh: async () => {
            const refreshBtn = document.querySelector('.refresh-btn, [data-action="refresh"]');
            if (refreshBtn) {
                refreshBtn.click();
            } else if (typeof DataLoader !== 'undefined') {
                await DataLoader.clearCache();
                window.location.reload();
            }
        },
        
        openSettings: () => {
            const settingsBtn = document.querySelector('.settings-btn, [data-action="settings"]');
            if (settingsBtn) {
                settingsBtn.click();
            }
        },
        
        closeModal: () => {
            // Close help modal first
            if (state.helpModal && state.helpModal.classList.contains('visible')) {
                hideHelp();
                return;
            }
            
            // Close other modals
            const modals = document.querySelectorAll('.modal.active, .modal[aria-hidden="false"]');
            modals.forEach(modal => {
                const closeBtn = modal.querySelector('.modal-close, [data-action="close"]');
                if (closeBtn) {
                    closeBtn.click();
                }
            });
        },
        
        showHelp: () => showHelp()
    };

    /**
     * Helper to switch views
     */
    function switchView(viewId) {
        const tab = document.querySelector(`[data-view="${viewId}"], [href="#${viewId}"]`);
        if (tab) {
            tab.click();
        } else {
            // Fallback: trigger custom event
            window.dispatchEvent(new CustomEvent('switchView', { detail: { view: viewId } }));
        }
    }

    // =========================================================================
    // KEY HANDLER
    // =========================================================================

    /**
     * Main keyboard event handler
     */
    function handleKeyDown(event) {
        if (!state.enabled) return;
        
        // Don't intercept when typing in inputs (except for escape and certain shortcuts)
        const target = event.target;
        const isInput = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable;
        
        // Allow escape in inputs
        if (isInput && event.key !== 'Escape') {
            // Allow Ctrl+/ for search focus even in inputs
            if (!(event.ctrlKey && event.key === '/')) {
                return;
            }
        }

        // Find matching shortcut
        for (const shortcut of SHORTCUTS) {
            if (matchesShortcut(event, shortcut)) {
                event.preventDefault();
                event.stopPropagation();
                
                const action = actions[shortcut.action];
                if (action) {
                    action();
                    
                    // Log in debug mode
                    if (typeof Debug !== 'undefined' && Debug.isEnabled()) {
                        Debug.log('Shortcuts', `Executed: ${shortcut.action}`);
                    }
                }
                return;
            }
        }
    }

    /**
     * Check if event matches a shortcut definition
     */
    function matchesShortcut(event, shortcut) {
        // Check modifier keys
        if (shortcut.ctrl && !event.ctrlKey && !event.metaKey) return false;
        if (shortcut.alt && !event.altKey) return false;
        if (shortcut.shift && !event.shiftKey) return false;
        
        // If shortcut requires no modifiers, check none are pressed (except for special cases)
        if (!shortcut.ctrl && !shortcut.alt && !shortcut.shift) {
            if (event.ctrlKey || event.altKey || event.metaKey) return false;
            // Allow shift for ? key
            if (event.shiftKey && event.key !== '?') return false;
        }
        
        // Check if key matches
        return shortcut.keys.some(key => {
            if (key.length === 1) {
                return event.key.toLowerCase() === key.toLowerCase();
            }
            return event.key === key;
        });
    }

    // =========================================================================
    // HELP MODAL
    // =========================================================================

    /**
     * Creates and shows the help modal
     */
    function showHelp() {
        if (!state.helpModal) {
            createHelpModal();
        }
        
        state.helpModal.classList.add('visible');
        state.helpModal.setAttribute('aria-hidden', 'false');
        
        // Focus the modal for accessibility
        const closeBtn = state.helpModal.querySelector('.keyboard-help-close');
        if (closeBtn) {
            closeBtn.focus();
        }
        
        // Announce to screen readers
        if (typeof A11yAnnouncer !== 'undefined') {
            A11yAnnouncer.announce('Keyboard shortcuts help opened');
        }
    }

    /**
     * Hides the help modal
     */
    function hideHelp() {
        if (state.helpModal) {
            state.helpModal.classList.remove('visible');
            state.helpModal.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Creates the help modal element
     */
    function createHelpModal() {
        const modal = document.createElement('div');
        modal.className = 'keyboard-help-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'keyboard-help-title');
        modal.setAttribute('aria-hidden', 'true');
        
        // Group shortcuts by category
        const categories = {
            'Navigation': SHORTCUTS.filter(s => s.action.startsWith('view')),
            'Actions': SHORTCUTS.filter(s => ['focusSearch', 'refresh', 'openSettings', 'closeModal'].includes(s.action)),
            'Help': SHORTCUTS.filter(s => s.action === 'showHelp')
        };
        
        let html = `
            <div class="keyboard-help-content">
                <div class="keyboard-help-header">
                    <h2 id="keyboard-help-title">Keyboard Shortcuts</h2>
                    <button class="keyboard-help-close" aria-label="Close">&times;</button>
                </div>
                <div class="keyboard-help-body">
        `;
        
        for (const [category, shortcuts] of Object.entries(categories)) {
            if (shortcuts.length === 0) continue;
            
            html += `<div class="shortcut-category">
                <h3>${category}</h3>
                <dl class="shortcut-list">`;
            
            for (const shortcut of shortcuts) {
                const keyCombo = formatKeyCombo(shortcut);
                html += `
                    <div class="shortcut-item">
                        <dt class="shortcut-keys">${keyCombo}</dt>
                        <dd class="shortcut-description">${shortcut.description}</dd>
                    </div>`;
            }
            
            html += `</dl></div>`;
        }
        
        html += `
                </div>
                <div class="keyboard-help-footer">
                    Press <kbd>Esc</kbd> to close
                </div>
            </div>
        `;
        
        modal.innerHTML = html;
        
        // Add close handlers
        const closeBtn = modal.querySelector('.keyboard-help-close');
        closeBtn.addEventListener('click', hideHelp);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideHelp();
        });
        
        document.body.appendChild(modal);
        state.helpModal = modal;
    }

    /**
     * Formats key combination for display
     */
    function formatKeyCombo(shortcut) {
        const parts = [];
        
        if (shortcut.ctrl) parts.push('<kbd>Ctrl</kbd>');
        if (shortcut.alt) parts.push('<kbd>Alt</kbd>');
        if (shortcut.shift) parts.push('<kbd>Shift</kbd>');
        
        // Format the main key(s)
        const keyStr = shortcut.keys.map(k => {
            if (k === '/') return '/';
            if (k === '?') return '?';
            if (k === ',') return ',';
            if (k === 'Escape') return 'Esc';
            return k.toUpperCase();
        }).join(' / ');
        
        parts.push(`<kbd>${keyStr}</kbd>`);
        
        return parts.join(' + ');
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initialize keyboard shortcuts
     */
    function init() {
        document.addEventListener('keydown', handleKeyDown);
        
        // Log initialization
        if (typeof Debug !== 'undefined' && Debug.isEnabled()) {
            Debug.log('Shortcuts', 'Keyboard shortcuts initialized', { count: SHORTCUTS.length });
        }
    }

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Enable keyboard shortcuts
         */
        enable: function() {
            state.enabled = true;
        },
        
        /**
         * Disable keyboard shortcuts
         */
        disable: function() {
            state.enabled = false;
        },
        
        /**
         * Show the help modal
         */
        showHelp,
        
        /**
         * Hide the help modal
         */
        hideHelp,
        
        /**
         * Get list of all shortcuts
         * @returns {Array}
         */
        getShortcuts: function() {
            return SHORTCUTS.map(s => ({
                keys: formatKeyCombo(s).replace(/<\/?kbd>/g, ''),
                description: s.description
            }));
        },
        
        /**
         * Register a custom shortcut
         * @param {Object} shortcut - Shortcut definition
         * @param {Function} handler - Action handler
         */
        register: function(shortcut, handler) {
            const actionName = `custom_${Date.now()}`;
            actions[actionName] = handler;
            SHORTCUTS.push({ ...shortcut, action: actionName });
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardShortcuts;
}


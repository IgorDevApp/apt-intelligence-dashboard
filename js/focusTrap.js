/**
 * APT Intelligence Dashboard - Focus Trap Utility
 * 
 * Manages focus trapping for modals and dialogs.
 * Ensures keyboard accessibility per WCAG 2.4.3.
 * 
 * @module focusTrap
 * @version 1.0.0
 */

const FocusTrap = (function() {
    'use strict';

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        activeTraps: [],  // Stack of active traps (for nested modals)
        previouslyFocused: null
    };

    // Selector for focusable elements
    const FOCUSABLE_SELECTOR = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
    ].join(', ');

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * Gets all focusable elements within a container
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement[]} Array of focusable elements
     */
    function getFocusableElements(container) {
        const elements = container.querySelectorAll(FOCUSABLE_SELECTOR);
        return Array.from(elements).filter(el => {
            // Filter out hidden elements
            return el.offsetParent !== null && 
                   !el.hasAttribute('hidden') &&
                   getComputedStyle(el).visibility !== 'hidden';
        });
    }

    /**
     * Handles Tab key press within trapped container
     * @param {KeyboardEvent} event - Keyboard event
     * @param {HTMLElement} container - Trapped container
     */
    function handleTabKey(event, container) {
        const focusableElements = getFocusableElements(container);
        
        if (focusableElements.length === 0) {
            event.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        // Shift + Tab
        if (event.shiftKey) {
            if (activeElement === firstElement || !container.contains(activeElement)) {
                event.preventDefault();
                lastElement.focus();
            }
        }
        // Tab
        else {
            if (activeElement === lastElement || !container.contains(activeElement)) {
                event.preventDefault();
                firstElement.focus();
            }
        }
    }

    /**
     * Creates a keydown handler for a trapped container
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Trap options
     * @returns {Function} Event handler
     */
    function createKeydownHandler(container, options) {
        return function(event) {
            // Handle Escape key
            if (event.key === 'Escape' && options.onEscape) {
                event.preventDefault();
                event.stopPropagation();
                options.onEscape();
                return;
            }

            // Handle Tab key
            if (event.key === 'Tab') {
                handleTabKey(event, container);
            }
        };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Activates a focus trap on a container
         * @param {HTMLElement|string} containerOrSelector - Container element or selector
         * @param {Object} options - Trap options
         * @param {Function} [options.onEscape] - Callback when Escape is pressed
         * @param {boolean} [options.focusFirst=true] - Focus first element on activate
         * @param {HTMLElement} [options.initialFocus] - Specific element to focus initially
         * @returns {Object} Trap control object
         */
        activate: function(containerOrSelector, options = {}) {
            const container = typeof containerOrSelector === 'string'
                ? document.querySelector(containerOrSelector)
                : containerOrSelector;

            if (!container) {
                console.error('[FocusTrap] Container not found:', containerOrSelector);
                return null;
            }

            // Save currently focused element
            const previouslyFocused = document.activeElement;

            // Create keydown handler
            const keydownHandler = createKeydownHandler(container, options);

            // Add event listener
            document.addEventListener('keydown', keydownHandler);

            // Create trap object
            const trap = {
                container,
                previouslyFocused,
                keydownHandler,
                options,
                isActive: true
            };

            // Add to stack
            state.activeTraps.push(trap);

            // Set initial focus
            if (options.focusFirst !== false) {
                requestAnimationFrame(() => {
                    if (options.initialFocus && container.contains(options.initialFocus)) {
                        options.initialFocus.focus();
                    } else {
                        const focusableElements = getFocusableElements(container);
                        if (focusableElements.length > 0) {
                            focusableElements[0].focus();
                        } else {
                            // If no focusable elements, focus the container itself
                            container.setAttribute('tabindex', '-1');
                            container.focus();
                        }
                    }
                });
            }

            // Add ARIA attributes for accessibility
            container.setAttribute('role', 'dialog');
            container.setAttribute('aria-modal', 'true');

            console.log('[FocusTrap] Activated on:', container.id || container.className);

            return trap;
        },

        /**
         * Deactivates a focus trap
         * @param {Object} [trap] - Trap object to deactivate (defaults to most recent)
         * @param {boolean} [returnFocus=true] - Whether to return focus to previous element
         */
        deactivate: function(trap = null, returnFocus = true) {
            // Get trap to deactivate (default to most recent)
            if (!trap) {
                trap = state.activeTraps.pop();
            } else {
                const index = state.activeTraps.indexOf(trap);
                if (index > -1) {
                    state.activeTraps.splice(index, 1);
                }
            }

            if (!trap) {
                console.warn('[FocusTrap] No active trap to deactivate');
                return;
            }

            // Remove event listener
            document.removeEventListener('keydown', trap.keydownHandler);

            // Remove ARIA attributes
            trap.container.removeAttribute('aria-modal');
            // Keep role="dialog" as it may be set in HTML

            trap.isActive = false;

            // Return focus to previous element
            if (returnFocus && trap.previouslyFocused) {
                requestAnimationFrame(() => {
                    trap.previouslyFocused.focus();
                });
            }

            console.log('[FocusTrap] Deactivated:', trap.container.id || trap.container.className);
        },

        /**
         * Checks if any trap is currently active
         * @returns {boolean}
         */
        isActive: function() {
            return state.activeTraps.length > 0;
        },

        /**
         * Gets the currently active trap
         * @returns {Object|null}
         */
        getActiveTrap: function() {
            return state.activeTraps[state.activeTraps.length - 1] || null;
        },

        /**
         * Deactivates all active traps
         */
        deactivateAll: function() {
            while (state.activeTraps.length > 0) {
                this.deactivate();
            }
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FocusTrap;
}


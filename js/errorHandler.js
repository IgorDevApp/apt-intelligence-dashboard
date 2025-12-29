/**
 * APT Intelligence Dashboard - Error Handler
 * 
 * Centralized error handling with user-friendly display
 * and graceful degradation support.
 * 
 * @module errorHandler
 * @version 1.0.0
 */

const ErrorHandler = (function() {
    'use strict';

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        errors: [],
        maxErrors: 50,  // Keep last 50 errors for debugging
        errorContainer: null
    };

    // Error types and their user-friendly messages
    const ERROR_MESSAGES = {
        'network': {
            title: 'Connection Error',
            message: 'Unable to connect to the data source. Please check your internet connection.',
            icon: '🌐',
            recoverable: true
        },
        'cors': {
            title: 'Access Restricted',
            message: 'Cannot fetch external data in offline mode. Using cached data instead.',
            icon: '🔒',
            recoverable: false
        },
        'timeout': {
            title: 'Request Timeout',
            message: 'The request took too long. Please try again.',
            icon: '⏱️',
            recoverable: true
        },
        'parse': {
            title: 'Data Error',
            message: 'Unable to process the data. It may be corrupted or in an unexpected format.',
            icon: '📄',
            recoverable: true
        },
        'storage': {
            title: 'Storage Error',
            message: 'Unable to save data locally. Your browser storage may be full.',
            icon: '💾',
            recoverable: false
        },
        'render': {
            title: 'Display Error',
            message: 'Unable to display this content. Please try refreshing the page.',
            icon: '🖥️',
            recoverable: true
        },
        'unknown': {
            title: 'Unexpected Error',
            message: 'Something went wrong. Please try refreshing the page.',
            icon: '⚠️',
            recoverable: true
        }
    };

    // =========================================================================
    // ERROR CLASSIFICATION
    // =========================================================================

    /**
     * Classifies an error into a known type
     * @param {Error} error - The error object
     * @returns {string} Error type
     */
    function classifyError(error) {
        const message = error.message?.toLowerCase() || '';
        const name = error.name?.toLowerCase() || '';

        if (message.includes('cors') || message.includes('access-control')) {
            return 'cors';
        }
        if (message.includes('timeout') || name === 'aborterror') {
            return 'timeout';
        }
        if (message.includes('network') || message.includes('fetch') || name === 'typeerror') {
            return 'network';
        }
        if (message.includes('json') || message.includes('parse') || name === 'syntaxerror') {
            return 'parse';
        }
        if (message.includes('quota') || message.includes('storage')) {
            return 'storage';
        }
        if (message.includes('render') || message.includes('dom')) {
            return 'render';
        }

        return 'unknown';
    }

    // =========================================================================
    // ERROR DISPLAY
    // =========================================================================

    /**
     * Creates the error container if it doesn't exist
     */
    function ensureErrorContainer() {
        if (state.errorContainer) return;

        state.errorContainer = document.createElement('div');
        state.errorContainer.id = 'error-container';
        state.errorContainer.className = 'error-container';
        state.errorContainer.setAttribute('role', 'alert');
        state.errorContainer.setAttribute('aria-live', 'assertive');
        document.body.appendChild(state.errorContainer);
    }

    /**
     * Escapes HTML for safe display
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        if (typeof Helpers !== 'undefined' && Helpers.escapeHtml) {
            return Helpers.escapeHtml(text);
        }
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Displays an error message to the user
     * @param {Object} options - Display options
     */
    function displayError(options) {
        const { type, title, message, details, onRetry, dismissable = true } = options;

        ensureErrorContainer();

        const errorInfo = ERROR_MESSAGES[type] || ERROR_MESSAGES.unknown;
        const errorElement = document.createElement('div');
        errorElement.className = 'error-banner';
        errorElement.setAttribute('role', 'alert');

        errorElement.innerHTML = `
            <div class="error-icon" aria-hidden="true">${errorInfo.icon}</div>
            <div class="error-content">
                <h4 class="error-title">${escapeHtml(title || errorInfo.title)}</h4>
                <p class="error-message">${escapeHtml(message || errorInfo.message)}</p>
                ${details ? `<details class="error-details">
                    <summary>Technical details</summary>
                    <pre>${escapeHtml(details)}</pre>
                </details>` : ''}
            </div>
            <div class="error-actions">
                ${errorInfo.recoverable && onRetry ? `
                    <button class="error-retry-btn" type="button">Retry</button>
                ` : ''}
                ${dismissable ? `
                    <button class="error-dismiss-btn" type="button" aria-label="Dismiss error">✕</button>
                ` : ''}
            </div>
        `;

        // Add event listeners
        const retryBtn = errorElement.querySelector('.error-retry-btn');
        if (retryBtn && onRetry) {
            retryBtn.addEventListener('click', () => {
                errorElement.remove();
                onRetry();
            });
        }

        const dismissBtn = errorElement.querySelector('.error-dismiss-btn');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                errorElement.remove();
            });
        }

        // Auto-dismiss non-critical errors after 10 seconds
        if (type !== 'unknown' && dismissable) {
            setTimeout(() => {
                if (errorElement.parentNode) {
                    errorElement.classList.add('fade-out');
                    setTimeout(() => errorElement.remove(), 300);
                }
            }, 10000);
        }

        state.errorContainer.appendChild(errorElement);
    }

    /**
     * Displays an inline error in a specific container
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Display options
     */
    function displayInlineError(container, options) {
        const { type, message, onRetry } = options;
        const errorInfo = ERROR_MESSAGES[type] || ERROR_MESSAGES.unknown;

        container.innerHTML = `
            <div class="inline-error" role="alert">
                <span class="inline-error-icon" aria-hidden="true">${errorInfo.icon}</span>
                <span class="inline-error-message">${escapeHtml(message || errorInfo.message)}</span>
                ${onRetry ? `<button class="inline-error-retry" type="button">Retry</button>` : ''}
            </div>
        `;

        const retryBtn = container.querySelector('.inline-error-retry');
        if (retryBtn && onRetry) {
            retryBtn.addEventListener('click', onRetry);
        }
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Handles an error with logging and optional display
         * @param {Error} error - The error object
         * @param {Object} options - Handling options
         */
        handle: function(error, options = {}) {
            const {
                context = 'unknown',
                display = true,
                onRetry = null,
                silent = false
            } = options;

            // Classify the error
            const type = classifyError(error);

            // Log the error
            const errorRecord = {
                timestamp: new Date().toISOString(),
                type,
                context,
                message: error.message,
                stack: error.stack,
                originalError: error
            };

            state.errors.push(errorRecord);
            if (state.errors.length > state.maxErrors) {
                state.errors.shift();
            }

            // Console logging
            if (!silent) {
                console.error(`[ErrorHandler] ${context}:`, error);
            }

            // Display to user
            if (display) {
                displayError({
                    type,
                    details: error.stack,
                    onRetry
                });
            }

            return { type, handled: true };
        },

        /**
         * Handles a fetch-specific error
         * @param {Error} error - The fetch error
         * @param {string} source - Name of the data source
         * @param {Function} onRetry - Retry callback
         */
        handleFetchError: function(error, source, onRetry) {
            // Don't display CORS errors in file:// mode - they're expected
            if (typeof Environment !== 'undefined' && Environment.isFileProtocol) {
                const type = classifyError(error);
                if (type === 'cors' || type === 'network') {
                    console.log(`[ErrorHandler] Expected ${type} error in offline mode for ${source}`);
                    return { type, handled: true, silent: true };
                }
            }

            return this.handle(error, {
                context: `Fetching ${source}`,
                display: true,
                onRetry
            });
        },

        /**
         * Displays an inline error in a container
         */
        displayInline: displayInlineError,

        /**
         * Clears all displayed errors
         */
        clearAll: function() {
            if (state.errorContainer) {
                state.errorContainer.innerHTML = '';
            }
        },

        /**
         * Gets all recorded errors (for debugging)
         * @returns {Array}
         */
        getErrors: function() {
            return [...state.errors];
        },

        /**
         * Wraps an async function with error handling
         * @param {Function} fn - Async function to wrap
         * @param {Object} options - Error handling options
         * @returns {Function} Wrapped function
         */
        wrapAsync: function(fn, options = {}) {
            return async (...args) => {
                try {
                    return await fn(...args);
                } catch (error) {
                    this.handle(error, options);
                    return null;
                }
            };
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}


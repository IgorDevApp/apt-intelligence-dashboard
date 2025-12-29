/**
 * APT Intelligence Dashboard - World Map Module (D3.js Implementation)
 * 
 * Displays an interactive world map with country boundaries using D3.js
 * and TopoJSON. Country flags are positioned at geographic coordinates.
 * 
 * @module worldMap
 * @version 2.0.0
 */

const WorldMap = (function() {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================

    const CONFIG = {
        // TopoJSON world map data source (110m resolution - ~30KB, good for dashboards)
        worldDataUrl: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
        
        // Colors matching the dashboard theme
        colors: {
            ocean: '#0a0e14',
            land: '#151a21',
            border: '#2d3748',
            borderHover: '#00ff88',
            graticule: '#1e2530'
        },
        
        // Flag marker sizes based on actor count
        flagSizes: {
            small: 28,
            medium: 36,
            large: 44,
            xlarge: 52
        }
    };

    // =========================================================================
    // STATE
    // =========================================================================

    const state = {
        container: null,
        svg: null,
        projection: null,
        path: null,
        worldData: null,
        actorCountByCountry: {},
        countriesWithActors: [],
        selectedCountry: null,
        initialized: false,
        loading: false,
        // Track handlers for cleanup
        resizeHandler: null
    };

    // =========================================================================
    // CLEANUP
    // =========================================================================

    /**
     * Cleans up event listeners and resources to prevent memory leaks
     */
    function cleanup() {
        // Remove resize handler
        if (state.resizeHandler) {
            window.removeEventListener('resize', state.resizeHandler);
            state.resizeHandler = null;
        }
        
        // Remove D3 event listeners
        if (state.svg) {
            state.svg.selectAll('.map-country')
                .on('mouseenter', null)
                .on('mouseleave', null);
        }
        
        // Clear marker container event listeners
        const markerContainer = state.container?.querySelector('.map-markers-container');
        if (markerContainer) {
            const markers = markerContainer.querySelectorAll('.map-flag-marker');
            markers.forEach(marker => {
                marker.replaceWith(marker.cloneNode(true));
            });
        }
        
        // Clear tooltip
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) {
            tooltip.textContent = '';
        }
    }

    // =========================================================================
    // D3 PROJECTION AND COORDINATE CONVERSION
    // =========================================================================

    /**
     * Creates the D3 projection based on container dimensions
     * Using Natural Earth projection centered for optimal APT region visibility
     * @param {number} width - Container width
     * @param {number} height - Container height
     * @returns {Object} D3 projection
     */
    function createProjection(width, height) {
        return d3.geoNaturalEarth1()
            .scale(width / 5)
            .center([20, 15])  // Center slightly east and north to show Eurasia/Middle East better
            .translate([width / 2, height / 2]);
    }

    /**
     * Converts latitude/longitude to pixel coordinates using D3 projection
     * @param {number} lon - Longitude
     * @param {number} lat - Latitude
     * @returns {Object|null} {x, y} pixel coordinates or null if invalid
     */
    function geoToPixel(lon, lat) {
        if (!state.projection) return null;
        const coords = state.projection([lon, lat]);
        return coords ? { x: coords[0], y: coords[1] } : null;
    }

    /**
     * Gets flag size based on actor count
     * @param {number} count - Number of actors
     * @returns {number} Flag size in pixels
     */
    function getFlagSize(count) {
        if (count >= 50) return CONFIG.flagSizes.xlarge;
        if (count >= 20) return CONFIG.flagSizes.large;
        if (count >= 5) return CONFIG.flagSizes.medium;
        return CONFIG.flagSizes.small;
    }

    // =========================================================================
    // MAP RENDERING
    // =========================================================================

    /**
     * Loads the TopoJSON world data
     * @returns {Promise<Object>} World topology data
     */
    async function loadWorldData() {
        if (state.worldData) return state.worldData;
        
        try {
            state.worldData = await d3.json(CONFIG.worldDataUrl);
            return state.worldData;
        } catch (error) {
            console.error('[WorldMap] Failed to load world data:', error);
            throw error;
        }
    }

    /**
     * Creates the SVG map with country boundaries
     * @param {HTMLElement} container - Container element
     * @param {number} width - Map width
     * @param {number} height - Map height
     */
    async function createMap(container, width, height) {
        // Clear existing content
        container.innerHTML = '';
        
        // Create projection and path generator
        state.projection = createProjection(width, height);
        state.path = d3.geoPath().projection(state.projection);
        
        // Create SVG element
        state.svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('display', 'block')
            .style('background', CONFIG.colors.ocean);
        
        // Add ocean background
        state.svg.append('rect')
            .attr('class', 'map-ocean')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', CONFIG.colors.ocean);
        
        // Add graticule (grid lines)
        const graticule = d3.geoGraticule()
            .step([30, 30]);
        
        state.svg.append('path')
            .datum(graticule())
            .attr('class', 'map-graticule')
            .attr('d', state.path)
            .attr('fill', 'none')
            .attr('stroke', CONFIG.colors.graticule)
            .attr('stroke-width', 0.3)
            .attr('stroke-opacity', 0.5);
        
        // Load and render countries
        const worldData = await loadWorldData();
        const countries = topojson.feature(worldData, worldData.objects.countries);
        
        // Draw country polygons
        state.svg.selectAll('.map-country')
            .data(countries.features)
            .enter()
            .append('path')
            .attr('class', 'map-country')
            .attr('d', state.path)
            .attr('fill', CONFIG.colors.land)
            .attr('stroke', CONFIG.colors.border)
            .attr('stroke-width', 0.5)
            .style('cursor', 'pointer')
            .style('transition', 'fill 0.2s ease')
            .on('mouseenter', function() {
                d3.select(this)
                    .attr('fill', '#1a2028')
                    .attr('stroke', CONFIG.colors.borderHover)
                    .attr('stroke-width', 1);
            })
            .on('mouseleave', function() {
                d3.select(this)
                    .attr('fill', CONFIG.colors.land)
                    .attr('stroke', CONFIG.colors.border)
                    .attr('stroke-width', 0.5);
            });
        
        // Add country borders as a separate layer for cleaner rendering
        state.svg.append('path')
            .datum(topojson.mesh(worldData, worldData.objects.countries, (a, b) => a !== b))
            .attr('class', 'map-borders')
            .attr('d', state.path)
            .attr('fill', 'none')
            .attr('stroke', CONFIG.colors.border)
            .attr('stroke-width', 0.5)
            .attr('stroke-linejoin', 'round');
        
        // Create container for flag markers (HTML overlay)
        const markerContainer = document.createElement('div');
        markerContainer.className = 'map-markers-container';
        markerContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
        container.appendChild(markerContainer);
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.id = 'map-tooltip';
        tooltip.className = 'world-map-tooltip';
        container.appendChild(tooltip);
    }

    /**
     * Renders flag markers on the map
     */
    function renderMarkers() {
        const container = state.container?.querySelector('.map-markers-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        const rect = state.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        if (width === 0 || height === 0) {
            setTimeout(renderMarkers, 100);
            return;
        }
        
        state.countriesWithActors.forEach(country => {
            if (!country || !country.lat || !country.lon) return;
            
            const pixel = geoToPixel(country.lon, country.lat);
            if (!pixel) return;
            
            const count = state.actorCountByCountry[country.iso2] || 0;
            const size = getFlagSize(count);
            
            const marker = document.createElement('div');
            marker.className = 'map-flag-marker';
            marker.dataset.iso2 = country.iso2;
            marker.dataset.name = country.name;
            marker.dataset.count = count;
            marker.style.cssText = `
                position: absolute;
                left: ${pixel.x}px;
                top: ${pixel.y}px;
                transform: translate(-50%, -50%);
                pointer-events: auto;
                cursor: pointer;
                z-index: 10;
                transition: transform 0.2s ease, z-index 0s;
            `;
            
            marker.innerHTML = `
                <div class="flag-marker-inner" style="
                    width: ${size}px;
                    height: ${Math.round(size * 0.67)}px;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.5), 0 0 0 2px #1a2028;
                    background: #1a2028;
                    position: relative;
                    overflow: visible;
                ">
                    <img src="${country.flag || ''}" alt="${country.name}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:4px;" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;color:#a0a8b4;font-size:10px;font-family:monospace;position:absolute;top:0;left:0;">${country.iso2}</span>
                </div>
                <span class="flag-marker-count" style="
                    position: absolute;
                    bottom: -4px;
                    right: -4px;
                    min-width: 18px;
                    height: 16px;
                    padding: 0 4px;
                    background: #00ff88;
                    color: #0a0e14;
                    font-size: 10px;
                    font-weight: 700;
                    font-family: 'Share Tech Mono', monospace;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.8);
                    z-index: 20;
                ">${count}</span>
            `;
            
            // Hover effects
            marker.addEventListener('mouseenter', function(e) {
                this.style.transform = 'translate(-50%, -50%) scale(1.15)';
                this.style.zIndex = '100';
                this.querySelector('.flag-marker-inner').style.boxShadow = '0 4px 16px rgba(0,255,136,0.4), 0 0 0 2px #00ff88';
                showTooltip(e, country, count);
            });
            
            marker.addEventListener('mouseleave', function() {
                this.style.transform = 'translate(-50%, -50%)';
                this.style.zIndex = '10';
                this.querySelector('.flag-marker-inner').style.boxShadow = '0 2px 8px rgba(0,0,0,0.5), 0 0 0 2px #1a2028';
                hideTooltip();
            });
            
            // Click handler
            marker.addEventListener('click', () => handleFlagClick(country));
            
            container.appendChild(marker);
        });
    }

    // =========================================================================
    // INTERACTIONS
    // =========================================================================

    /**
     * Handles click on a country flag
     * @param {Object} country - Country data
     */
    function handleFlagClick(country) {
        if (!country) return;
        
        // Toggle selection
        if (state.selectedCountry === country.iso2) {
            state.selectedCountry = null;
            if (typeof App !== 'undefined' && App.clearCountryFilter) {
                App.clearCountryFilter();
            }
        } else {
            state.selectedCountry = country.iso2;
            if (typeof App !== 'undefined' && App.filterByCountry) {
                App.filterByCountry(country.iso2);
            }
        }
    }

    /**
     * Escapes HTML special characters to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtmlLocal(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Validates flag URL to prevent XSS via image src
     * @param {string} url - URL to validate
     * @returns {boolean} True if URL is from trusted source
     */
    function isValidFlagUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            const parsed = new URL(url);
            // Allow only known flag sources
            const allowedDomains = [
                'flagcdn.com',
                'data.unesco.org',
                'upload.wikimedia.org',
                'raw.githubusercontent.com',
                'flagpedia.net',
                'countryflagsapi.com'
            ];
            return parsed.protocol === 'https:' && 
                   allowedDomains.some(domain => parsed.hostname.endsWith(domain));
        } catch {
            return false;
        }
    }

    /**
     * Shows tooltip for a country using safe DOM methods (XSS prevention)
     * @param {Event} event - Mouse event
     * @param {Object} country - Country data
     * @param {number} actorCount - Number of actors
     */
    function showTooltip(event, country, actorCount) {
        const tooltip = document.getElementById('map-tooltip');
        if (!tooltip) return;
        
        // Clear previous content safely
        tooltip.textContent = '';
        
        // Create header row with flag and country name
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:4px;';
        
        if (country.flag) {
            const flagImg = document.createElement('img');
            flagImg.src = country.flag;
            flagImg.alt = '';
            flagImg.width = 24;
            flagImg.height = 16;
            flagImg.style.cssText = 'object-fit:cover;border-radius:2px;';
            headerRow.appendChild(flagImg);
        }
        
        const countryName = document.createElement('span');
        countryName.style.cssText = "font-family:'Share Tech Mono',monospace;font-size:14px;color:#00ff88;";
        countryName.textContent = country.name;
        headerRow.appendChild(countryName);
        
        tooltip.appendChild(headerRow);
        
        // Create actor count row
        const countRow = document.createElement('div');
        countRow.style.cssText = 'font-size:13px;color:#a0a8b4;';
        
        const countSpan = document.createElement('span');
        countSpan.style.cssText = 'color:#00ff88;font-weight:600;';
        countSpan.textContent = actorCount;
        countRow.appendChild(countSpan);
        countRow.appendChild(document.createTextNode(` threat actor${actorCount !== 1 ? 's' : ''}`));
        
        tooltip.appendChild(countRow);
        
        // Create hint row
        const hintRow = document.createElement('div');
        hintRow.style.cssText = 'font-size:11px;color:#6b7280;margin-top:4px;';
        hintRow.textContent = 'Click to filter';
        tooltip.appendChild(hintRow);
        
        // Position tooltip
        tooltip.style.cssText = `
            position: absolute;
            left: ${event.clientX - state.container.getBoundingClientRect().left + 15}px;
            top: ${event.clientY - state.container.getBoundingClientRect().top - 10}px;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 10px 14px;
            pointer-events: none;
            z-index: 200;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        `;
    }

    /**
     * Hides the tooltip
     */
    function hideTooltip() {
        const tooltip = document.getElementById('map-tooltip');
        if (tooltip) {
            tooltip.style.cssText = 'display:none;';
        }
    }

    /**
     * Handles window resize - recreates the map with new dimensions
     */
    function handleResize() {
        if (!state.container || !state.initialized) return;
        
        const rect = state.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        if (width === 0 || height === 0) return;
        
        // Update projection
        state.projection = createProjection(width, height);
        state.path = d3.geoPath().projection(state.projection);
        
        // Update SVG
        if (state.svg) {
            state.svg
                .attr('width', width)
                .attr('height', height)
                .attr('viewBox', `0 0 ${width} ${height}`);
            
            state.svg.select('.map-ocean')
                .attr('width', width)
                .attr('height', height);
            
            state.svg.select('.map-graticule')
                .attr('d', state.path);
            
            state.svg.selectAll('.map-country')
                .attr('d', state.path);
            
            state.svg.select('.map-borders')
                .attr('d', state.path);
        }
        
        // Reposition markers
        renderMarkers();
    }

    /**
     * Debounce helper (uses Helpers module if available)
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        if (typeof Helpers !== 'undefined' && Helpers.debounce) {
            return Helpers.debounce(func, wait);
        }
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Renders the world map
         * @param {HTMLElement} container - Container element
         * @param {Object} actorCountByCountry - Country code -> actor count mapping
         */
        render: async function(container, actorCountByCountry) {
            if (!container) return;
            if (state.loading) return;
            
            // Clean up previous render to prevent memory leaks
            cleanup();
            
            state.loading = true;
            state.container = container;
            state.actorCountByCountry = actorCountByCountry || {};
            
            // Set container styles
            container.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;';
            
            const rect = container.getBoundingClientRect();
            let width = rect.width;
            let height = rect.height;
            
            // If container has no dimensions yet, use defaults
            if (width === 0) width = 800;
            if (height === 0) height = 600;
            
            try {
                // Create the map
                await createMap(container, width, height);
                
                // Get countries with actors
                const countryCodes = Object.keys(state.actorCountByCountry)
                    .filter(code => state.actorCountByCountry[code] >= 1);
                
                state.countriesWithActors = countryCodes
                    .map(code => CountryData.getByIso2(code))
                    .filter(country => country && country.lat && country.lon);
                
                // Render markers
                renderMarkers();
                
                // Set up resize handler (store reference for cleanup)
                state.resizeHandler = debounce(handleResize, 200);
                window.addEventListener('resize', state.resizeHandler);
                
                state.initialized = true;
                
            } catch (error) {
                console.error('[WorldMap] Failed to render map:', error);
                container.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#a0a8b4;font-family:'Share Tech Mono',monospace;">
                        <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
                        <div style="font-size:16px;">Failed to load world map</div>
                        <div style="font-size:12px;color:#6b7280;margin-top:8px;">${error.message}</div>
                    </div>
                `;
            } finally {
                state.loading = false;
            }
        },

        /**
         * Updates the map with new data
         * @param {Object} actorCountByCountry - New country -> actor count mapping
         */
        update: function(actorCountByCountry) {
            state.actorCountByCountry = actorCountByCountry || {};
            
            const countryCodes = Object.keys(state.actorCountByCountry)
                .filter(code => state.actorCountByCountry[code] >= 1);
            
            state.countriesWithActors = countryCodes
                .map(code => CountryData.getByIso2(code))
                .filter(country => country && country.lat && country.lon);
            
            renderMarkers();
        },

        /**
         * Clears the current selection
         */
        clearSelection: function() {
            state.selectedCountry = null;
        },

        /**
         * Gets the currently selected country
         * @returns {string|null} ISO2 code or null
         */
        getSelectedCountry: function() {
            return state.selectedCountry;
        },

        /**
         * Checks if the map is initialized
         * @returns {boolean}
         */
        isInitialized: function() {
            return state.initialized;
        },

        /**
         * Destroys the map and cleans up resources
         */
        destroy: function() {
            cleanup();
            state.initialized = false;
            state.svg = null;
            state.container = null;
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorldMap;
}

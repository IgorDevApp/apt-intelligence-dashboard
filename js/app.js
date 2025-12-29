/**
 * APT Intelligence Dashboard - Main Application Controller
 * 
 * This module serves as the central controller for the dashboard,
 * coordinating data loading, UI updates, and user interactions.
 * 
 * @module app
 * @version 1.0.0
 */

const App = (function() {
    'use strict';

    // =========================================================================
    // APPLICATION STATE
    // =========================================================================

    const state = {
        initialized: false,
        currentView: 'worldmap',
        viewMode: 'grid',
        filters: {
            search: '',
            countries: [],
            sectors: [],
            hasReports: false,
            stateSponsored: false,
            sort: 'age-desc'  // Default sort by age (newest first)
        },
        reportsView: 'grid',  // 'grid' or 'list' for reports view
        reportsSort: 'date-desc',  // Default sort reports by date (newest first)
        timelineSort: 'desc',  // Default timeline order (newest first)
        settings: {
            animationsEnabled: false,
            soundsEnabled: false,
            mitreEnabled: true
        },
        config: {
            useLiveData: true  // Try to fetch live data from external sources
        },
        selectedActor: null
    };

    // =========================================================================
    // DOM REFERENCES
    // =========================================================================

    const elements = {
        // Loading screen
        loadingScreen: null,
        loadingBarFill: null,
        loadingMessage: null,
        statActors: null,
        statReports: null,

        // Main app
        app: null,
        globalSearch: null,
        searchClear: null,

        // Header stats
        headerStatActors: null,
        headerStatReports: null,

        // Navigation
        navTabs: null,

        // Views
        viewPanels: null,
        actorsGrid: null,
        timelineContainer: null,
        reportsList: null,
        statisticsGrid: null,

        // Filters
        filterCountries: null,
        filterSectors: null,
        filterHasReports: null,
        filterStateSponsored: null,
        filterReset: null,

        // View controls
        viewToggles: null,
        actorsCount: null,
        timelineCount: null,
        reportsCount: null,

        // Modals
        actorModal: null,
        settingsModal: null,

        // Footer
        lastUpdated: null,

        // Toast
        toastContainer: null
    };

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * Initializes the application
     */
    async function init() {
        console.log('[App] Initializing APT Intelligence Dashboard...');

        // Initialize storage manager for large data support
        await StorageManager.init();

        // Cache DOM elements
        cacheElements();

        // Set up event listeners
        setupEventListeners();

        // Load settings from localStorage
        loadSettings();

        // Start data loading
        await loadData();

        // Mark as initialized
        state.initialized = true;
        console.log('[App] Initialization complete');
    }

    /**
     * Caches DOM element references
     */
    function cacheElements() {
        // Loading screen
        elements.loadingScreen = document.getElementById('loading-screen');
        elements.loadingBarFill = document.getElementById('loading-bar-fill');
        elements.loadingMessage = document.getElementById('loading-message');
        elements.loadingSubstatus = document.getElementById('loading-substatus');
        elements.loadingLog = document.getElementById('loading-log');
        elements.statActors = document.getElementById('stat-actors');
        elements.statReports = document.getElementById('stat-reports');
        elements.statTTPs = document.getElementById('stat-ttps');
        elements.statSources = document.getElementById('stat-sources');

        // Main app
        elements.app = document.getElementById('app');
        elements.globalSearch = document.getElementById('global-search');
        elements.searchClear = document.getElementById('search-clear');

        // Header stats
        elements.headerStatActors = document.querySelector('#header-stat-actors .stat-value');
        elements.headerStatReports = document.querySelector('#header-stat-reports .stat-value');

        // Navigation
        elements.navTabs = document.querySelectorAll('.nav-tab');

        // Views
        elements.viewPanels = document.querySelectorAll('.view-panel');
        elements.worldMapWrapper = document.getElementById('world-map-wrapper');
        elements.actorsGrid = document.getElementById('actors-grid');
        elements.timelineContainer = document.getElementById('timeline-container');
        elements.reportsGrid = document.getElementById('reports-grid');
        elements.statisticsGrid = document.getElementById('statistics-grid');

        // Filters
        elements.filterCountries = document.getElementById('filter-countries');
        elements.filterSectors = document.getElementById('filter-sectors');
        elements.filterHasReports = document.getElementById('filter-has-reports');
        elements.filterStateSponsored = document.getElementById('filter-state-sponsored');
        elements.filterReset = document.getElementById('filter-reset');

        // View controls
        elements.viewToggles = document.querySelectorAll('.view-toggle');
        elements.actorsCount = document.getElementById('actors-count');
        elements.actorSort = document.getElementById('actor-sort');
        elements.timelineCount = document.getElementById('timeline-count');
        elements.timelineSort = document.getElementById('timeline-sort');
        elements.reportsCount = document.getElementById('reports-count');
        elements.reportsSort = document.getElementById('reports-sort');

        // Modals
        elements.actorModal = document.getElementById('actor-modal');
        elements.settingsModal = document.getElementById('settings-modal');

        // Footer
        elements.lastUpdated = document.getElementById('last-updated');

        // Toast
        elements.toastContainer = document.getElementById('toast-container');
    }

    /**
     * Sets up event listeners
     */
    function setupEventListeners() {
        // Navigation tabs
        elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => switchView(tab.dataset.view));
        });

        // Search
        elements.globalSearch.addEventListener('input', debounce(handleSearch, 300));
        elements.searchClear.addEventListener('click', clearSearch);

        // View toggles (for actors)
        elements.viewToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const target = toggle.dataset.target;
                if (target === 'reports') {
                    switchReportsViewMode(toggle.dataset.mode);
                } else {
                    switchViewMode(toggle.dataset.mode);
                }
            });
        });

        // Sort select for actors
        if (elements.actorSort) {
            elements.actorSort.addEventListener('change', handleSortChange);
        }
        
        // Sort select for reports
        if (elements.reportsSort) {
            elements.reportsSort.addEventListener('change', handleReportsSortChange);
        }
        
        // Sort select for timeline
        if (elements.timelineSort) {
            elements.timelineSort.addEventListener('change', handleTimelineSortChange);
        }

        // Filters
        elements.filterHasReports.addEventListener('change', handleFilterChange);
        elements.filterStateSponsored.addEventListener('change', handleFilterChange);
        elements.filterReset.addEventListener('click', resetFilters);

        // Header buttons
        document.getElementById('btn-refresh').addEventListener('click', refreshData);
        document.getElementById('btn-settings').addEventListener('click', openSettings);

        // Modal close buttons
        document.getElementById('modal-close').addEventListener('click', closeActorModal);
        document.getElementById('settings-close').addEventListener('click', closeSettings);
        document.getElementById('report-modal-close').addEventListener('click', closeReportModal);

        // Modal backdrop clicks
        elements.actorModal.querySelector('.modal-backdrop').addEventListener('click', closeActorModal);
        document.getElementById('report-modal').querySelector('.modal-backdrop').addEventListener('click', closeReportModal);
        elements.settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeSettings);

        // Settings controls
        document.getElementById('setting-animations').addEventListener('change', (e) => {
            state.settings.animationsEnabled = e.target.checked;
            saveSettings();
            updateAnimationState();
        });

        document.getElementById('setting-sounds').addEventListener('change', (e) => {
            state.settings.soundsEnabled = e.target.checked;
            saveSettings();
        });

        document.getElementById('setting-mitre-enabled').addEventListener('change', (e) => {
            state.settings.mitreEnabled = e.target.checked;
            saveSettings();
            if (e.target.checked) {
                DataLoader.enableMitreAttack();
            } else {
                DataLoader.disableMitreAttack();
            }
        });

        document.getElementById('btn-clear-cache').addEventListener('click', async () => {
            await DataLoader.clearCache();
            closeSettings();
            refreshData();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        // Data loader events
        DataLoader.on('onProgress', handleLoadProgress);
        DataLoader.on('onComplete', handleLoadComplete);
        DataLoader.on('onError', handleLoadError);
    }

    // =========================================================================
    // DATA LOADING
    // =========================================================================

    /**
     * Loads all data sources
     */
    async function loadData() {
        const startTime = Date.now();
        let sourcesLoaded = 0;
        let totalTTPs = 0;
        
        updateLoadingMessage('CONNECTING TO DATA SOURCES...');
        updateLoadingProgress(5);
        addLoadingLog('Initializing APT Intelligence Dashboard...', 'info');

        try {
            // Load country data first (for flags)
            updateLoadingMessage('LOADING COUNTRY DATA...');
            updateSubstatus('Fetching flag and country information');
            updateLoadingProgress(5);
            
            try {
                await CountryData.load();
                const countryCount = CountryData.getAll()?.length || 0;
                addLoadingLog(`✓ Country data loaded: ${countryCount} countries`, 'success');
                console.log('[App] Country data loaded');
            } catch (e) {
                addLoadingLog('⚠ Country data unavailable, using fallback', 'warning');
                console.warn('[App] Country data load failed:', e);
            }

            // Initialize DataNormalizer with fast startup (JSON sources only, HTML sources load in background)
            updateLoadingMessage('NORMALIZING DATA SOURCES...');
            updateSubstatus('Loading priority sources (fast startup mode)');
            updateLoadingProgress(10);
            addLoadingLog('Initializing data normalizer (fast mode)...', 'info');
            
            try {
                // Fast startup: only load JSON sources (GitHub raw), skip HTML sources (CORS proxy)
                await DataNormalizer.init({ fastStartup: true });
                const normStats = DataNormalizer.getStats();
                addLoadingLog(`✓ Priority sources loaded: ${normStats.sourcesLoaded} sources, ${normStats.totalActors} actors`, 'success');
                console.log('[App] DataNormalizer initialized (fast):', normStats);
            } catch (e) {
                addLoadingLog('⚠ Data normalization partial - using primary sources', 'warning');
                console.warn('[App] DataNormalizer init failed:', e);
            }

            // Load MISP Galaxy and APTnotes
            updateLoadingMessage('LOADING THREAT ACTOR DATABASE...');
            updateSubstatus('Fetching from MISP Galaxy (GitHub)');
            updateLoadingProgress(25);
            addLoadingLog('Connecting to MISP Galaxy...', 'info');
            
            const data = await DataLoader.loadAll();
            sourcesLoaded++;

            if (!data.mispGalaxy) {
                throw new Error('Failed to load critical threat actor data');
            }
            
            const actorCount = data.mispGalaxy.values?.length || 0;
            addLoadingLog(`✓ MISP Galaxy loaded: ${actorCount} threat actors`, 'success');
            updateLoadingStat('actors', actorCount);

            updateLoadingMessage('PARSING THREAT ACTORS...');
            updateSubstatus('Building threat actor profiles and relationships');
            updateLoadingProgress(40);

            // Parse actors
            ActorParser.parseActors(data.mispGalaxy);
            addLoadingLog('✓ Actors parsed and indexed', 'success');

            if (data.aptNotes) {
                updateLoadingMessage('LINKING INTELLIGENCE REPORTS...');
                updateSubstatus('Mapping reports to threat actors');
                updateLoadingProgress(50);
                ActorParser.parseReports(data.aptNotes);
                const reportCount = data.aptNotes.length || 0;
                addLoadingLog(`✓ APTnotes loaded: ${reportCount} reports`, 'success');
                updateLoadingStat('reports', reportCount);
                sourcesLoaded++;
            }

            // Load MITRE ATT&CK data
            updateLoadingMessage('LOADING MITRE ATT&CK DATA...');
            updateSubstatus('Fetching TTPs from MITRE (GitHub)');
            updateLoadingProgress(60);
            addLoadingLog('Connecting to MITRE ATT&CK...', 'info');
            
            try {
                await MitreAdapter.load();
                console.log('[App] MITRE ATT&CK data loaded');
                sourcesLoaded++;
                
                // Enrich actors with MITRE data
                updateLoadingMessage('ENRICHING WITH MITRE DATA...');
                updateSubstatus('Mapping techniques to threat actors');
                updateLoadingProgress(70);
                const mitreCount = enrichActorsWithMitreData();
                totalTTPs = MitreAdapter.getAttackPatterns()?.length || 0;
                addLoadingLog(`✓ MITRE ATT&CK: ${mitreCount} actors enriched, ${totalTTPs} techniques`, 'success');
                updateLoadingStat('ttps', totalTTPs);
            } catch (e) {
                addLoadingLog('⚠ MITRE ATT&CK unavailable', 'warning');
                console.warn('[App] MITRE ATT&CK load failed:', e);
            }

            // Enrich with Google Cloud APT data
            try {
                updateLoadingMessage('ENRICHING WITH GOOGLE APT DATA...');
                updateSubstatus('Adding Google Threat Intelligence aliases');
                updateLoadingProgress(80);
                const googleCount = enrichActorsWithGoogleData();
                addLoadingLog(`✓ Google Cloud APT: ${googleCount} actors enriched`, 'success');
                sourcesLoaded++;
            } catch (e) {
                addLoadingLog('⚠ Google APT data unavailable', 'warning');
                console.warn('[App] Google APT enrichment failed:', e);
            }

            // Enrich with APTMalware IOC data
            try {
                updateLoadingMessage('LOADING MALWARE IOCs...');
                updateSubstatus('Fetching malware samples and hashes');
                updateLoadingProgress(85);
                const malwareCount = await enrichActorsWithMalwareIOCs();
                addLoadingLog(`✓ APTMalware IOCs: ${malwareCount} actors enriched`, 'success');
                sourcesLoaded++;
            } catch (e) {
                addLoadingLog('⚠ Malware IOCs unavailable', 'warning');
                console.warn('[App] APTMalware enrichment failed:', e);
            }

            // Try live data fetching first, fallback to static parsers
            const useLiveData = state.config.useLiveData !== false;
            
            if (useLiveData && typeof LiveDataFetcher !== 'undefined') {
                try {
                    updateLoadingMessage('FETCHING LIVE DATA...');
                    updateSubstatus('Connecting to ETDA Thailand, Malpedia, Breach-HQ...');
                    updateLoadingProgress(87);
                    addLoadingLog('Attempting live data fetch (may use CORS proxies)...', 'info');
                    
                    const actors = ActorParser.getActors();
                    const liveResult = await LiveDataFetcher.enrichActorsWithLiveData(actors);
                    
                    // Count enriched sources
                    const liveStats = LiveDataFetcher.getLastFetchStats?.() || {};
                    if (liveStats.etda > 0) {
                        addLoadingLog(`✓ ETDA Thailand: ${liveStats.etda} actors (LIVE)`, 'success');
                        sourcesLoaded++;
                    }
                    if (liveStats.malpedia > 0) {
                        addLoadingLog(`✓ Malpedia: ${liveStats.malpedia} actors`, 'success');
                        sourcesLoaded++;
                    }
                    if (liveStats.breachHQ > 0) {
                        addLoadingLog(`✓ Breach-HQ: ${liveStats.breachHQ} actors`, 'success');
                        sourcesLoaded++;
                    }
                    
                    console.log('[App] Live data enrichment complete');
                } catch (e) {
                    addLoadingLog('⚠ Live fetch failed, using cached data', 'warning');
                    console.warn('[App] Live data fetch failed, using static fallbacks:', e);
                    await enrichWithStaticData();
                }
            } else {
                await enrichWithStaticData();
            }

            // Rebuild timeline after all enrichment is complete
            updateLoadingMessage('REBUILDING TIMELINE...');
            updateSubstatus('Building historical emergence timeline');
            updateLoadingProgress(92);
            const timelineCount = ActorParser.rebuildTimeline();
            addLoadingLog(`✓ Timeline: ${timelineCount} actors with dates`, 'success');
            console.log(`[App] Timeline rebuilt with ${timelineCount} actors after enrichment`);

            updateLoadingMessage('BUILDING INTERFACE...');
            updateSubstatus('Rendering views and components');
            updateLoadingProgress(93);
            
            // Update loading stats
            updateLoadingStat('sources', sourcesLoaded);

            // Update statistics
            const stats = ActorParser.getStatistics();
            if (stats) {
                elements.statActors.textContent = `ACTORS: ${stats.totalActors}`;
                elements.statActors.classList.add('loaded');
                elements.statReports.textContent = `REPORTS: ${stats.totalReports}`;
                elements.statReports.classList.add('loaded');
            }

            // Complete loading
            updateLoadingProgress(100);
            const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
            updateLoadingMessage('SYSTEMS ONLINE');
            updateSubstatus(`Loaded in ${loadTime}s`);
            addLoadingLog(`✓ Dashboard ready (${loadTime}s)`, 'success');

            // Render initial view
            renderFilters();
            renderCurrentView();
            updateHeaderStats();
            updateLastUpdated();

            // Hide loading screen
            setTimeout(() => {
                hideLoadingScreen();
                
                // Load secondary sources in background (ETDA, Malpedia, Google APT via CORS proxy)
                // This runs after UI is visible for faster perceived load time
                loadSecondarySourcesInBackground();
            }, 800);

        } catch (error) {
            console.error('[App] Data loading failed:', error);
            updateLoadingMessage('ERROR: ' + error.message);
            updateSubstatus('Check console for details');
            addLoadingLog(`✗ Fatal error: ${error.message}`, 'error');
            showToast('Failed to load data: ' + error.message, 'error');
        }
    }

    /**
     * Loads secondary data sources in background after UI is visible
     * This improves perceived load time by deferring slow CORS-proxy sources
     */
    async function loadSecondarySourcesInBackground() {
        try {
            console.log('[App] Loading secondary sources in background...');
            
            // Load HTML sources via CORS proxy (ETDA, Malpedia, Google APT)
            const updatedActors = await DataNormalizer.loadSecondarySources();
            
            if (updatedActors && updatedActors.size > 0) {
                const stats = DataNormalizer.getStats();
                console.log('[App] Secondary sources loaded:', stats);
                
                // Re-enrich actors with the new data
                const actors = ActorParser.getActors();
                let enrichedCount = 0;
                
                actors.forEach(actor => {
                    const enrichedData = DataNormalizer.getActor(actor.name);
                    if (enrichedData) {
                        // Update first-seen date if earlier
                        if (enrichedData.firstSeen && (!actor.firstSeen || enrichedData.firstSeen < actor.firstSeen)) {
                            actor.firstSeen = enrichedData.firstSeen;
                            actor.firstSeenSource = enrichedData.firstSeenSource;
                            enrichedCount++;
                        }
                        // Update last-seen date if later
                        if (enrichedData.lastSeen && (!actor.lastSeen || enrichedData.lastSeen > actor.lastSeen)) {
                            actor.lastSeen = enrichedData.lastSeen;
                        }
                    }
                });
                
                if (enrichedCount > 0) {
                    console.log(`[App] Background enriched ${enrichedCount} actors with new dates`);
                    
                    // Rebuild timeline with new data
                    const timelineCount = ActorParser.rebuildTimeline();
                    console.log(`[App] Timeline rebuilt with ${timelineCount} dated actors`);
                    
                    // Refresh current view if on timeline
                    if (state.currentView === 'timeline') {
                        renderCurrentView();
                    }
                    
                    // Show subtle notification
                    showToast('Data enriched with additional sources', 'info', 3000);
                }
            }
        } catch (error) {
            console.warn('[App] Background source loading failed:', error.message);
            // Silent failure - not critical for functionality
        }
    }

    /**
     * Enriches MISP Galaxy actors with MITRE ATT&CK data
     */
    function enrichActorsWithMitreData() {
        if (!MitreAdapter.isLoaded()) return;
        
        const actors = ActorParser.getActors();
        let enrichedCount = 0;
        
        actors.forEach(actor => {
            const enriched = MitreAdapter.enrichActor(actor);
            if (enriched.mitreEnriched) {
                // Update actor in place
                Object.assign(actor, enriched);
                enrichedCount++;
            }
        });
        
        console.log(`[App] Enriched ${enrichedCount} actors with MITRE data`);
        
        // Rebuild timeline with potentially new firstSeen data
        ActorParser.getStatistics(); // This recalculates
    }

    /**
     * Enriches MISP Galaxy actors with Google Cloud APT data
     * Adds target sectors, attack vectors, associated malware details
     */
    function enrichActorsWithGoogleData() {
        if (typeof GoogleAptParser === 'undefined') return;
        
        const actors = ActorParser.getActors();
        let enrichedCount = 0;
        
        actors.forEach(actor => {
            // Try to find matching Google APT data
            const googleData = GoogleAptParser.getByName(actor.name);
            
            // Also try aliases
            if (!googleData && actor.aliases) {
                for (const alias of actor.aliases) {
                    const match = GoogleAptParser.getByName(alias);
                    if (match) {
                        enrichWithGoogleData(actor, match);
                        enrichedCount++;
                        break;
                    }
                }
            } else if (googleData) {
                enrichWithGoogleData(actor, googleData);
                enrichedCount++;
            }
        });
        
        console.log(`[App] Enriched ${enrichedCount} actors with Google Cloud APT data`);
    }

    /**
     * Helper to merge Google APT data into an actor
     */
    function enrichWithGoogleData(actor, googleData) {
        // Add Google-specific target sectors (merge with existing)
        if (googleData.targetSectors && googleData.targetSectors.length > 0) {
            const existingSectors = actor.targetSectors || [];
            const allSectors = new Set([...existingSectors, ...googleData.targetSectors]);
            actor.targetSectors = Array.from(allSectors);
        }
        
        // Add attack vectors if not present
        if (googleData.attackVectors && googleData.attackVectors.length > 0) {
            actor.attackVectors = actor.attackVectors || [];
            const allVectors = new Set([...actor.attackVectors, ...googleData.attackVectors]);
            actor.attackVectors = Array.from(allVectors);
        }
        
        // Add associated malware if not present
        if (googleData.associatedMalware && googleData.associatedMalware.length > 0) {
            actor.associatedMalware = actor.associatedMalware || [];
            const allMalware = new Set([...actor.associatedMalware, ...googleData.associatedMalware]);
            actor.associatedMalware = Array.from(allMalware);
        }
        
        // Add Google attribution details if more specific
        if (googleData.attribution && googleData.attribution.length > actor.attribution?.length) {
            actor.googleAttribution = googleData.attribution;
        }
        
        // Add resource links
        if (googleData.resources && googleData.resources.length > 0) {
            actor.googleResources = googleData.resources;
        }
        
        // Mark as enriched
        actor.googleEnriched = true;
    }

    /**
     * Enriches MISP Galaxy actors with APTMalware IOC data
     * Adds malware sample counts and hash statistics
     */
    async function enrichActorsWithMalwareIOCs() {
        if (typeof AptMalwareParser === 'undefined') return;
        
        // Load malware data if not already loaded
        if (!AptMalwareParser.isLoaded()) {
            const loaded = await AptMalwareParser.load();
            if (!loaded) {
                console.warn('[App] Failed to load APTMalware data');
                return;
            }
        }
        
        const actors = ActorParser.getActors();
        let enrichedCount = 0;
        
        actors.forEach(actor => {
            // Get IOCs for this actor
            const iocs = AptMalwareParser.getIOCsForAptGroup(actor.name);
            
            // Also try aliases if no direct match
            if (iocs.total === 0 && actor.aliases) {
                for (const alias of actor.aliases) {
                    const aliasIOCs = AptMalwareParser.getIOCsForAptGroup(alias);
                    if (aliasIOCs.total > 0) {
                        actor.malwareIOCs = aliasIOCs;
                        actor.malwareEnriched = true;
                        enrichedCount++;
                        break;
                    }
                }
            } else if (iocs.total > 0) {
                actor.malwareIOCs = iocs;
                actor.malwareEnriched = true;
                enrichedCount++;
            }
        });
        
        console.log(`[App] Enriched ${enrichedCount} actors with malware IOC data`);
    }

    /**
     * Enriches MISP Galaxy actors with Malpedia alias data
     * Adds extensive alias lists and malware family counts
     */
    function enrichActorsWithMalpediaData() {
        if (typeof MalpediaParser === 'undefined') return;
        
        const actors = ActorParser.getActors();
        let enrichedCount = 0;
        
        actors.forEach(actor => {
            // Try to find matching Malpedia actor
            let malpediaActor = MalpediaParser.findActor(actor.name);
            
            // Try aliases if no direct match
            if (!malpediaActor && actor.aliases) {
                for (const alias of actor.aliases) {
                    malpediaActor = MalpediaParser.findActor(alias);
                    if (malpediaActor) break;
                }
            }
            
            if (malpediaActor) {
                // Merge aliases (deduplicated)
                const existingAliases = actor.aliases || [];
                const newAliases = MalpediaParser.getAliases(malpediaActor.name);
                actor.aliases = [...new Set([...existingAliases, ...newAliases])];
                
                // Add malware family count
                actor.malpediaMalwareFamilies = malpediaActor.malwareFamilies;
                
                // Mark as enriched
                actor.malpediaEnriched = true;
                enrichedCount++;
            }
        });
        
        console.log(`[App] Enriched ${enrichedCount} actors with Malpedia alias data`);
    }

    /**
     * Enriches MISP Galaxy actors with Breach-HQ threat type data
     * Adds threat type classification and confidence levels
     */
    function enrichActorsWithBreachHQData() {
        if (typeof BreachHQParser === 'undefined') return;
        
        const actors = ActorParser.getActors();
        let enrichedCount = 0;
        
        actors.forEach(actor => {
            // Try to find matching Breach-HQ actor
            let breachHQActor = BreachHQParser.findActor(actor.name);
            
            // Try aliases if no direct match
            if (!breachHQActor && actor.aliases) {
                for (const alias of actor.aliases) {
                    breachHQActor = BreachHQParser.findActor(alias);
                    if (breachHQActor) break;
                }
            }
            
            if (breachHQActor) {
                // Add threat type
                if (breachHQActor.threatType && breachHQActor.threatType !== 'Unknown') {
                    actor.threatType = breachHQActor.threatType;
                }
                
                // Add confidence level
                if (breachHQActor.confidence && breachHQActor.confidence !== 'Unknown') {
                    actor.confidenceLevel = breachHQActor.confidence;
                }
                
                // Merge aliases (deduplicated)
                const existingAliases = actor.aliases || [];
                const newAliases = breachHQActor.aliases || [];
                actor.aliases = [...new Set([...existingAliases, ...newAliases])];
                
                // Mark as enriched
                actor.breachHQEnriched = true;
                enrichedCount++;
            }
        });
        
        console.log(`[App] Enriched ${enrichedCount} actors with Breach-HQ threat type data`);
    }

    /**
     * Enriches MISP Galaxy actors with ETDA Thailand timeline data
     * Adds first-seen, last-seen dates, counter-ops status, and subgroup relationships
     */
    function enrichActorsWithETDAData() {
        if (typeof ETDAParser === 'undefined') return;
        
        const actors = ActorParser.getActors();
        let enrichedCount = 0;
        let timelineAddedCount = 0;
        let countryAddedCount = 0;
        
        actors.forEach(actor => {
            // Try to find matching ETDA actor
            let etdaActor = ETDAParser.findActor(actor.name);
            
            // Try aliases if no direct match
            if (!etdaActor && actor.aliases) {
                for (const alias of actor.aliases) {
                    etdaActor = ETDAParser.findActor(alias);
                    if (etdaActor) break;
                }
            }
            
            if (etdaActor) {
                // Add country attribution if missing
                if (etdaActor.country && !actor.country) {
                    actor.country = etdaActor.country;
                    actor.countryName = etdaActor.countryName || etdaActor.country;
                    countryAddedCount++;
                }
                
                // ETDA is authoritative for timeline data - always use it if available
                if (etdaActor.firstSeen) {
                    if (!actor.firstSeen) {
                        timelineAddedCount++;
                    }
                    actor.firstSeen = etdaActor.firstSeen;
                }
                
                // Add last-seen date (new data from ETDA!)
                if (etdaActor.lastSeen) {
                    actor.lastSeen = etdaActor.lastSeen;
                    actor.isActive = etdaActor.lastSeen.includes('2024') || etdaActor.lastSeen.includes('2025');
                } else if (etdaActor.firstSeen) {
                    // If no last-seen, consider active
                    actor.isActive = true;
                }
                
                // Add counter-operations flag
                if (etdaActor.hadCounterOps) {
                    actor.hadCounterOps = true;
                }
                
                // Add subgroup info
                if (etdaActor.isSubgroup && etdaActor.parentGroup) {
                    actor.isSubgroup = true;
                    actor.parentGroup = etdaActor.parentGroup;
                }
                
                // Merge aliases (deduplicated)
                const existingAliases = actor.aliases || [];
                const newAliases = etdaActor.aliases || [];
                actor.aliases = [...new Set([...existingAliases, ...newAliases])];
                
                // Mark as enriched
                actor.etdaEnriched = true;
                enrichedCount++;
            }
        });
        
        console.log(`[App] Enriched ${enrichedCount} actors with ETDA data (${timelineAddedCount} timelines, ${countryAddedCount} countries)`);
    }

    /**
     * Enriches actors with static/cached data from parsers
     * Used as fallback when live data fetching fails
     */
    async function enrichWithStaticData() {
        // Enrich with Malpedia alias data
        try {
            updateLoadingMessage('ENRICHING WITH MALPEDIA DATA (CACHED)...');
            updateLoadingProgress(88);
            enrichActorsWithMalpediaData();
        } catch (e) {
            console.warn('[App] Malpedia enrichment failed:', e);
        }

        // Enrich with Breach-HQ threat type data
        try {
            updateLoadingMessage('ENRICHING WITH BREACH-HQ DATA (CACHED)...');
            updateLoadingProgress(89);
            enrichActorsWithBreachHQData();
        } catch (e) {
            console.warn('[App] Breach-HQ enrichment failed:', e);
        }

        // Enrich with ETDA timeline data
        try {
            updateLoadingMessage('ENRICHING WITH ETDA TIMELINE DATA (CACHED)...');
            updateLoadingProgress(91);
            enrichActorsWithETDAData();
        } catch (e) {
            console.warn('[App] ETDA enrichment failed:', e);
        }
    }

    /**
     * Refreshes data from remote sources
     */
    async function refreshData() {
        showToast('Refreshing data...', 'info');
        
        try {
            await DataLoader.refresh();
            
            const data = DataLoader.getState().data;
            ActorParser.reset();
            ActorParser.parseActors(data.mispGalaxy);
            
            if (data.aptNotes) {
                ActorParser.parseReports(data.aptNotes);
            }

            // Re-run all enrichment steps
            try {
                enrichActorsWithMitreData();
            } catch (e) {
                console.warn('[App] MITRE enrichment failed during refresh:', e);
            }

            try {
                enrichActorsWithGoogleData();
            } catch (e) {
                console.warn('[App] Google APT enrichment failed during refresh:', e);
            }

            try {
                await enrichActorsWithMalwareIOCs();
            } catch (e) {
                console.warn('[App] APTMalware enrichment failed during refresh:', e);
            }

            // Try live data fetching for Malpedia, ETDA, Breach-HQ
            const useLiveData = state.config.useLiveData !== false;
            
            if (useLiveData && typeof LiveDataFetcher !== 'undefined') {
                try {
                    // Clear cache to force fresh fetch
                    LiveDataFetcher.clearCache();
                    const actors = ActorParser.getActors();
                    await LiveDataFetcher.enrichActorsWithLiveData(actors);
                    console.log('[App] Live data refresh complete');
                } catch (e) {
                    console.warn('[App] Live data refresh failed, using static fallbacks:', e);
                    await enrichWithStaticData();
                }
            } else {
                await enrichWithStaticData();
            }

            // Rebuild timeline after enrichment
            const timelineCount = ActorParser.rebuildTimeline();
            console.log(`[App] Timeline rebuilt with ${timelineCount} actors after refresh`);

            renderFilters();
            renderCurrentView();
            updateHeaderStats();
            updateLastUpdated();

            showToast('Data refreshed successfully', 'success');
        } catch (error) {
            showToast('Failed to refresh data: ' + error.message, 'error');
        }
    }

    // =========================================================================
    // LOADING SCREEN
    // =========================================================================

    function updateLoadingProgress(percent) {
        if (elements.loadingBarFill) {
            elements.loadingBarFill.style.width = percent + '%';
        }
    }

    function updateLoadingMessage(message) {
        if (elements.loadingMessage) {
            elements.loadingMessage.textContent = message;
        }
    }

    function updateSubstatus(message) {
        if (elements.loadingSubstatus) {
            elements.loadingSubstatus.textContent = message;
        }
    }

    function addLoadingLog(message, type = 'info') {
        if (elements.loadingLog) {
            const entry = document.createElement('div');
            entry.className = `loading-log-entry ${type}`;
            
            const icons = {
                'success': '✓',
                'warning': '⚠',
                'error': '✗',
                'info': '›'
            };
            
            const timestamp = new Date().toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            
            entry.innerHTML = `<span class="log-icon">${icons[type] || '›'}</span><span class="log-time">[${timestamp}]</span> ${message}`;
            elements.loadingLog.appendChild(entry);
            elements.loadingLog.scrollTop = elements.loadingLog.scrollHeight;
        }
    }

    function updateLoadingStat(stat, value) {
        const el = {
            'actors': elements.statActors,
            'reports': elements.statReports,
            'ttps': elements.statTTPs,
            'sources': elements.statSources
        }[stat];
        
        if (el) {
            const labels = {
                'actors': 'ACTORS',
                'reports': 'REPORTS',
                'ttps': 'TTPs',
                'sources': 'SOURCES'
            };
            el.textContent = `${labels[stat]}: ${value}`;
            el.classList.add('loaded');
        }
    }

    function hideLoadingScreen() {
        elements.loadingScreen.classList.add('fade-out');
        elements.app.classList.remove('hidden');
        
        setTimeout(() => {
            elements.loadingScreen.style.display = 'none';
            
            // Trigger resize to fix map dimensions, then reveal the map
            window.dispatchEvent(new Event('resize'));
            
            // Reveal map after resize has been processed
            setTimeout(() => {
                const mapWrapper = document.getElementById('world-map-wrapper');
                if (mapWrapper) {
                    mapWrapper.classList.add('ready');
                }
            }, 50);
        }, 400);
    }

    function handleLoadProgress(data) {
        console.log('[App] Load progress:', data);
    }

    function handleLoadComplete(data) {
        console.log('[App] Load complete:', data);
    }

    function handleLoadError(data) {
        console.error('[App] Load error:', data);
        if (data.critical) {
            showToast('Critical error: ' + data.error, 'error');
        }
    }

    // =========================================================================
    // VIEW MANAGEMENT
    // =========================================================================

    /**
     * Switches to a different view
     * @param {string} viewName - Name of the view to switch to
     */
    function switchView(viewName) {
        if (state.currentView === viewName) return;

        state.currentView = viewName;

        // Update nav tabs
        elements.navTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === viewName);
        });

        // Update view panels
        elements.viewPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `view-${viewName}`);
        });

        // Render the view if needed
        renderCurrentView();
    }

    /**
     * Switches between grid and list view modes
     * @param {string} mode - 'grid' or 'list'
     */
    function switchViewMode(mode) {
        if (state.viewMode === mode) return;

        state.viewMode = mode;

        // Update toggles
        elements.viewToggles.forEach(toggle => {
            toggle.classList.toggle('active', toggle.dataset.mode === mode);
        });

        // Update grid class
        elements.actorsGrid.classList.toggle('list-mode', mode === 'list');
    }

    /**
     * Renders the current view
     */
    function renderCurrentView() {
        switch (state.currentView) {
            case 'worldmap':
                renderWorldMapView();
                break;
            case 'actors':
                renderActorsView();
                break;
            case 'timeline':
                renderTimelineView();
                break;
            case 'reports':
                renderReportsView();
                break;
            case 'statistics':
                renderStatisticsView();
                break;
        }
    }

    /**
     * Renders the world map view
     */
    async function renderWorldMapView() {
        const actors = ActorParser.getActors();
        
        // Count actors by country
        const actorCountByCountry = {};
        actors.forEach(actor => {
            if (actor.country) {
                actorCountByCountry[actor.country] = (actorCountByCountry[actor.country] || 0) + 1;
            }
        });
        
        // Update stats display
        const countryCount = Object.keys(actorCountByCountry).length;
        const mapCountryCountEl = document.getElementById('map-country-count');
        const mapActorCountEl = document.getElementById('map-actor-count');
        
        if (mapCountryCountEl) mapCountryCountEl.textContent = countryCount;
        if (mapActorCountEl) mapActorCountEl.textContent = actors.length;
        
        // Render the world map
        const mapWrapper = document.getElementById('world-map-wrapper');
        
        if (mapWrapper && typeof WorldMap !== 'undefined') {
            await WorldMap.render(mapWrapper, actorCountByCountry);
        }
    }

    /**
     * Filters actors by country (called from WorldMap)
     * @param {string} countryCode - ISO2 country code
     */
    function filterByCountry(countryCode) {
        // Update filter state
        state.filters.countries = [countryCode];
        
        // Update filter UI
        const checkboxes = elements.filterCountries?.querySelectorAll('input');
        checkboxes?.forEach(cb => {
            cb.checked = cb.value === countryCode;
        });
        
        // Switch to actors view with filter applied
        switchView('actors');
    }

    /**
     * Clears the country filter
     */
    function clearCountryFilter() {
        state.filters.countries = [];
        
        // Update filter UI
        const checkboxes = elements.filterCountries?.querySelectorAll('input');
        checkboxes?.forEach(cb => {
            cb.checked = false;
        });
        
        renderCurrentView();
    }

    // =========================================================================
    // ACTORS VIEW
    // =========================================================================

    /**
     * Renders the actors grid view
     */
    function renderActorsView() {
        const actors = getFilteredActors();
        
        elements.actorsCount.textContent = `${actors.length} threat actors`;
        elements.actorsGrid.innerHTML = '';

        if (actors.length === 0) {
            elements.actorsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <h3 class="empty-state-title">No threat actors found</h3>
                    <p class="empty-state-message">Try adjusting your search or filter criteria.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        actors.forEach(actor => {
            const card = createActorCard(actor);
            fragment.appendChild(card);
        });

        elements.actorsGrid.appendChild(fragment);
    }

    /**
     * Creates an actor card element
     * @param {Object} actor - Actor data
     * @returns {HTMLElement} Actor card element
     */
    function createActorCard(actor) {
        const card = document.createElement('div');
        card.className = 'actor-card';
        card.dataset.uuid = actor.uuid;
        
        if (actor.country) {
            card.dataset.country = actor.country;
        }

        const description = actor.description 
            ? actor.description.substring(0, 200) + (actor.description.length > 200 ? '...' : '')
            : 'No description available.';

        // Get flag HTML if CountryData is available
        const flagHtml = (typeof CountryData !== 'undefined' && actor.country) 
            ? CountryData.getFlagHtml(actor.country, { size: 18, className: 'country-flag' })
            : '';

        // Show technique count if MITRE enriched
        const techniqueCount = actor.techniques?.length || 0;

        card.innerHTML = `
            <div class="actor-card-header">
                <span class="actor-card-name">${escapeHtml(actor.name)}</span>
                <span class="actor-card-country">${flagHtml} ${actor.countryName || 'Unknown'}</span>
            </div>
            <p class="actor-card-description">${escapeHtml(description)}</p>
            <div class="actor-card-meta">
                ${actor.firstSeen ? `
                    <span class="actor-card-meta-item">
                        <span class="icon">📅</span>
                        Since ${actor.firstSeen}
                    </span>
                ` : ''}
                ${actor.reportsCount > 0 ? `
                    <span class="actor-card-meta-item">
                        <span class="icon">📄</span>
                        ${actor.reportsCount} reports
                    </span>
                ` : ''}
                ${techniqueCount > 0 ? `
                    <span class="actor-card-meta-item">
                        <span class="icon">⚔️</span>
                        ${techniqueCount} TTPs
                    </span>
                ` : ''}
                ${actor.sectors.length > 0 ? `
                    <span class="actor-card-meta-item">
                        <span class="icon">🎯</span>
                        ${actor.sectors.length} sectors
                    </span>
                ` : ''}
            </div>
        `;

        card.addEventListener('click', () => openActorModal(actor.uuid));

        return card;
    }

    /**
     * Gets filtered actors based on current filter state
     * @returns {Array} Filtered actors
     */
    function getFilteredActors() {
        let actors = ActorParser.getActors();

        // Search filter
        if (state.filters.search) {
            actors = ActorParser.searchActors(state.filters.search);
        }

        // Country filter
        if (state.filters.countries.length > 0) {
            actors = actors.filter(actor => 
                state.filters.countries.includes(actor.country)
            );
        }

        // Sector filter
        if (state.filters.sectors.length > 0) {
            actors = actors.filter(actor =>
                actor.sectors.some(sector => state.filters.sectors.includes(sector))
            );
        }

        // Has reports filter
        if (state.filters.hasReports) {
            actors = actors.filter(actor => actor.reportsCount > 0);
        }

        // State-sponsored filter
        if (state.filters.stateSponsored) {
            actors = actors.filter(actor => actor.stateSponsored);
        }

        // Apply sorting
        actors = sortActors(actors, state.filters.sort);

        return actors;
    }

    /**
     * Sorts actors based on sort criteria
     * @param {Array} actors - Array of actors to sort
     * @param {string} sortBy - Sort criteria
     * @returns {Array} Sorted actors array
     */
    function sortActors(actors, sortBy) {
        const sorted = [...actors];
        
        switch (sortBy) {
            case 'name':
                sorted.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                sorted.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'age':
                // Oldest first (earliest firstSeen year)
                sorted.sort((a, b) => {
                    const yearA = a.firstSeen ? parseInt(a.firstSeen) : 9999;
                    const yearB = b.firstSeen ? parseInt(b.firstSeen) : 9999;
                    return yearA - yearB;
                });
                break;
            case 'age-desc':
                // Newest first (most recent firstSeen year)
                sorted.sort((a, b) => {
                    const yearA = a.firstSeen ? parseInt(a.firstSeen) : 0;
                    const yearB = b.firstSeen ? parseInt(b.firstSeen) : 0;
                    return yearB - yearA;
                });
                break;
            case 'ttps':
                // Most TTPs first
                sorted.sort((a, b) => {
                    const ttpsA = (a.mitreTechniques?.length || 0);
                    const ttpsB = (b.mitreTechniques?.length || 0);
                    return ttpsB - ttpsA;
                });
                break;
            case 'reports':
                // Most reports first
                sorted.sort((a, b) => (b.reportsCount || 0) - (a.reportsCount || 0));
                break;
            case 'sectors':
                // Most sectors first
                sorted.sort((a, b) => (b.sectors?.length || 0) - (a.sectors?.length || 0));
                break;
            case 'country':
                // By country name alphabetically
                sorted.sort((a, b) => {
                    const countryA = a.countryName || a.country || 'ZZZ';
                    const countryB = b.countryName || b.country || 'ZZZ';
                    return countryA.localeCompare(countryB);
                });
                break;
            default:
                // Default to name
                sorted.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        return sorted;
    }

    /**
     * Sorts reports array by criteria
     */
    function sortReports(reports, sortBy) {
        const sorted = [...reports];
        
        switch (sortBy) {
            case 'date-desc':
                // Newest first
                sorted.sort((a, b) => {
                    const dateA = a.date ? new Date(a.date) : new Date(0);
                    const dateB = b.date ? new Date(b.date) : new Date(0);
                    return dateB - dateA;
                });
                break;
            case 'date-asc':
                // Oldest first
                sorted.sort((a, b) => {
                    const dateA = a.date ? new Date(a.date) : new Date(0);
                    const dateB = b.date ? new Date(b.date) : new Date(0);
                    return dateA - dateB;
                });
                break;
            case 'title':
                // Title A-Z
                sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
            case 'source':
                // Source A-Z
                sorted.sort((a, b) => (a.source || '').localeCompare(b.source || ''));
                break;
            default:
                // Default to newest first
                sorted.sort((a, b) => {
                    const dateA = a.date ? new Date(a.date) : new Date(0);
                    const dateB = b.date ? new Date(b.date) : new Date(0);
                    return dateB - dateA;
                });
        }
        
        return sorted;
    }

    /**
     * Handles sort selection change
     */
    function handleSortChange() {
        state.filters.sort = elements.actorSort.value;
        renderActorsView();
    }

    /**
     * Handles reports sort selection change
     */
    function handleReportsSortChange() {
        state.reportsSort = elements.reportsSort.value;
        renderReportsView();
    }

    /**
     * Handles timeline sort order change
     */
    function handleTimelineSortChange() {
        state.timelineSort = elements.timelineSort.value;
        renderTimelineView();
    }

    /**
     * Switches reports view mode (grid/list)
     */
    function switchReportsViewMode(mode) {
        state.reportsView = mode;
        
        // Update toggle buttons
        document.querySelectorAll('.view-toggle[data-target="reports"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        renderReportsView();
    }

    // =========================================================================
    // TIMELINE VIEW
    // =========================================================================

    /**
     * Renders the timeline view
     */
    function renderTimelineView() {
        let timeline = ActorParser.getTimeline();
        
        // Apply filters to timeline
        if (state.filters.countries.length > 0) {
            timeline = timeline.filter(actor => 
                state.filters.countries.includes(actor.country)
            );
        }
        
        if (state.filters.sectors.length > 0) {
            timeline = timeline.filter(actor => 
                actor.sectors && actor.sectors.some(s => state.filters.sectors.includes(s))
            );
        }
        
        if (state.filters.stateSponsored) {
            timeline = timeline.filter(actor => actor.stateSponsor);
        }
        
        if (state.filters.search) {
            const searchLower = state.filters.search.toLowerCase();
            timeline = timeline.filter(actor => 
                actor.name.toLowerCase().includes(searchLower) ||
                (actor.synonyms && actor.synonyms.some(s => s.toLowerCase().includes(searchLower)))
            );
        }
        
        elements.timelineCount.textContent = `${timeline.length} dated actors`;
        elements.timelineContainer.innerHTML = '';

        if (timeline.length === 0) {
            elements.timelineContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <h3 class="empty-state-title">No timeline data</h3>
                    <p class="empty-state-message">No threat actors match the current filters.</p>
                </div>
            `;
            return;
        }

        // Group by year
        const yearGroups = {};
        timeline.forEach(actor => {
            const year = actor.firstSeen;
            if (!yearGroups[year]) {
                yearGroups[year] = [];
            }
            yearGroups[year].push(actor);
        });

        const fragment = document.createDocumentFragment();
        // Sort years based on user preference
        const years = Object.keys(yearGroups).sort((a, b) => {
            return state.timelineSort === 'asc' ? a - b : b - a;
        });

        years.forEach(year => {
            const yearSection = document.createElement('div');
            yearSection.className = 'timeline-year';
            
            yearSection.innerHTML = `
                <div class="timeline-year-label">${year}</div>
                <div class="timeline-year-marker"></div>
                <div class="timeline-year-content">
                    <div class="timeline-items"></div>
                </div>
            `;

            const itemsContainer = yearSection.querySelector('.timeline-items');
            
            yearGroups[year].forEach(actor => {
                const item = createTimelineItem(actor);
                itemsContainer.appendChild(item);
            });

            fragment.appendChild(yearSection);
        });

        elements.timelineContainer.appendChild(fragment);
    }

    /**
     * Creates a timeline item element
     * @param {Object} actor - Actor data
     * @returns {HTMLElement} Timeline item element
     */
    function createTimelineItem(actor) {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.dataset.uuid = actor.uuid;

        const description = actor.description
            ? actor.description.substring(0, 150) + (actor.description.length > 150 ? '...' : '')
            : 'No description available.';

        // Get flag HTML
        const flagHtml = (typeof CountryData !== 'undefined' && actor.country) 
            ? CountryData.getFlagHtml(actor.country, { size: 16, className: 'country-flag' })
            : '';

        item.innerHTML = `
            <div class="timeline-item-icon">👤</div>
            <div class="timeline-item-content">
                <div class="timeline-item-header">
                    <span class="timeline-item-name">${escapeHtml(actor.name)}</span>
                    <span class="timeline-item-country">${flagHtml} ${actor.countryName || 'Unknown'}</span>
                </div>
                <p class="timeline-item-description">${escapeHtml(description)}</p>
                <div class="timeline-item-meta">
                    ${actor.sectors.length > 0 ? `
                        <span class="timeline-item-tag">
                            <span>🎯</span> ${actor.sectors.slice(0, 3).join(', ')}
                        </span>
                    ` : ''}
                </div>
            </div>
        `;

        item.addEventListener('click', () => openActorModal(actor.uuid));

        return item;
    }

    // =========================================================================
    // REPORTS VIEW
    // =========================================================================

    /**
     * Renders the reports list view
     */
    function renderReportsView() {
        let reports = ActorParser.getReports();
        
        elements.reportsGrid.innerHTML = '';

        if (reports.length === 0) {
            elements.reportsCount.textContent = `0 reports`;
            elements.reportsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <h3 class="empty-state-title">No reports available</h3>
                    <p class="empty-state-message">Intelligence reports could not be loaded.</p>
                </div>
            `;
            return;
        }

        // Filter by search if active
        let filteredReports = reports;
        if (state.filters.search) {
            filteredReports = ActorParser.searchReports(state.filters.search);
        }
        
        // Filter by country - reports linked to actors from selected countries
        if (state.filters.countries.length > 0) {
            filteredReports = filteredReports.filter(report => 
                report.linkedActors && report.linkedActors.some(actor => 
                    state.filters.countries.includes(actor.country)
                )
            );
        }
        
        // Filter by sector - reports linked to actors targeting selected sectors
        if (state.filters.sectors.length > 0) {
            filteredReports = filteredReports.filter(report => 
                report.linkedActors && report.linkedActors.some(actor => 
                    actor.sectors && actor.sectors.some(s => state.filters.sectors.includes(s))
                )
            );
        }
        
        // Filter by state sponsored
        if (state.filters.stateSponsored) {
            filteredReports = filteredReports.filter(report => 
                report.linkedActors && report.linkedActors.some(actor => actor.stateSponsor)
            );
        }
        
        // Filter by has reports (only show reports with linked actors)
        if (state.filters.hasReports) {
            filteredReports = filteredReports.filter(report => 
                report.linkedActors && report.linkedActors.length > 0
            );
        }

        // Sort reports
        filteredReports = sortReports(filteredReports, state.reportsSort);

        elements.reportsCount.textContent = `${filteredReports.length} reports`;

        if (filteredReports.length === 0) {
            elements.reportsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <h3 class="empty-state-title">No matching reports</h3>
                    <p class="empty-state-message">No reports match the current filters.</p>
                </div>
            `;
            return;
        }

        // Apply view mode class
        elements.reportsGrid.className = state.reportsView === 'list' ? 'reports-list' : 'reports-grid';

        const fragment = document.createDocumentFragment();

        // Limit initial render for performance
        const renderLimit = 100;
        filteredReports.slice(0, renderLimit).forEach(report => {
            const item = state.reportsView === 'list' 
                ? createReportListItem(report)
                : createReportGridItem(report);
            fragment.appendChild(item);
        });

        if (filteredReports.length > renderLimit) {
            const loadMore = document.createElement('div');
            loadMore.className = 'load-more';
            loadMore.innerHTML = `
                <button class="load-more-btn">Load more (${filteredReports.length - renderLimit} remaining)</button>
            `;
            fragment.appendChild(loadMore);
        }

        elements.reportsGrid.appendChild(fragment);
    }

    /**
     * Creates a report list item element
     * @param {Object} report - Report data
     * @returns {HTMLElement} Report list item element
     */
    function createReportListItem(report) {
        const item = document.createElement('div');
        item.className = 'report-list-item';
        item.style.cursor = 'pointer';

        const actorChips = report.linkedActors.slice(0, 3).map(actor => 
            `<span class="report-actor-chip" data-uuid="${actor.uuid}">${escapeHtml(actor.name)}</span>`
        ).join('');

        item.innerHTML = `
            <span class="report-list-date">${report.dateFormatted || 'Unknown'}</span>
            <span class="report-list-title" title="${escapeHtml(report.title)}">${escapeHtml(report.title)}</span>
            <span class="report-list-source">${escapeHtml(report.source)}</span>
            <div class="report-list-actors">${actorChips || '<span class="no-data">—</span>'}</div>
            ${report.link ? `
                <a href="${report.link}" target="_blank" rel="noopener" class="report-list-link" title="Open report">↗</a>
            ` : ''}
        `;

        // Click on item opens report modal
        item.addEventListener('click', () => openReportModal(report));

        // Add click handlers for actor chips (prevent bubbling)
        item.querySelectorAll('.report-actor-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                openActorModal(chip.dataset.uuid);
            });
        });
        
        // Prevent link clicks from opening modal
        const linkEl = item.querySelector('.report-list-link');
        if (linkEl) {
            linkEl.addEventListener('click', (e) => e.stopPropagation());
        }

        return item;
    }

    /**
     * Creates a grid card for a report (compact view)
     */
    function createReportGridItem(report) {
        const item = document.createElement('div');
        item.className = 'report-grid-item';
        item.style.cursor = 'pointer';

        const actorChips = report.linkedActors.slice(0, 3).map(actor => 
            `<span class="report-actor-chip" data-uuid="${actor.uuid}">${escapeHtml(actor.name)}</span>`
        ).join('');
        
        const moreCount = report.linkedActors.length > 3 ? report.linkedActors.length - 3 : 0;
        const moreLabel = moreCount > 0 ? `<span class="report-more-actors">+${moreCount} more</span>` : '';

        item.innerHTML = `
            <div class="report-grid-header">
                <span class="report-grid-date">${report.dateFormatted || 'Unknown'}</span>
                <span class="report-grid-source">${escapeHtml(report.source)}</span>
            </div>
            <h4 class="report-grid-title" title="${escapeHtml(report.title)}">${escapeHtml(report.title)}</h4>
            <div class="report-grid-meta">
                <span class="report-grid-meta-item">
                    <span class="icon">👥</span>
                    <span>${report.linkedActors.length} actors</span>
                </span>
                <span class="report-grid-meta-item">
                    <span class="icon">📄</span>
                    <span>PDF</span>
                </span>
            </div>
            <div class="report-grid-actors">
                ${actorChips || '<span class="no-data">No linked actors</span>'}
                ${moreLabel}
            </div>
        `;

        // Click on card opens report modal
        item.addEventListener('click', () => openReportModal(report));

        // Add click handlers for actor chips (prevent bubbling to card)
        item.querySelectorAll('.report-actor-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                openActorModal(chip.dataset.uuid);
            });
        });

        return item;
    }

    // =========================================================================
    // STATISTICS VIEW
    // =========================================================================

    /**
     * Renders the statistics view
     */
    function renderStatisticsView() {
        try {
            const stats = ActorParser.getStatistics();
            
            if (!stats) {
                elements.statisticsGrid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <h3 class="empty-state-title">No statistics available</h3>
                        <p class="empty-state-message">Statistics will be available once data is loaded.</p>
                    </div>
                `;
                return;
            }

            // Get filtered actors for statistics
            const filteredActors = getFilteredActors();
            const hasFilters = state.filters.countries.length > 0 || 
                              state.filters.sectors.length > 0 || 
                              state.filters.stateSponsored ||
                              state.filters.hasReports ||
                              state.filters.search;
            
            // Compute filtered stats
            const filteredStats = {
                totalActors: filteredActors.length,
                actorsWithFirstSeen: filteredActors.filter(a => a.firstSeen).length
            };
            
            // Get filtered timeline data for summary
            let timeline = ActorParser.getTimeline() || [];
            if (hasFilters && timeline.length > 0) {
                const filteredUuids = new Set(filteredActors.map(a => a.uuid));
                timeline = timeline.filter(a => filteredUuids.has(a.uuid));
            }
            
            // Filtered stats for display
            const displayActors = hasFilters ? filteredStats.totalActors : stats.totalActors;
            const displayDated = hasFilters ? filteredStats.actorsWithFirstSeen : stats.actorsWithFirstSeen;
        const filterNote = hasFilters ? ' (filtered)' : '';

        elements.statisticsGrid.innerHTML = `
            <!-- Summary Stats -->
            <div class="stat-card">
                <div class="stat-card-header">
                    <span class="stat-card-icon">📈</span>
                    <span class="stat-card-title">OVERVIEW${filterNote.toUpperCase()}</span>
                </div>
                <div class="stat-card-content">
                    <div class="summary-stats">
                        <div class="summary-stat">
                            <div class="summary-stat-value">${displayActors}</div>
                            <div class="summary-stat-label">THREAT ACTORS</div>
                        </div>
                        <div class="summary-stat">
                            <div class="summary-stat-value">${stats.totalReports}</div>
                            <div class="summary-stat-label">REPORTS</div>
                        </div>
                        <div class="summary-stat">
                            <div class="summary-stat-value">${stats.linkedReports}</div>
                            <div class="summary-stat-label">LINKED REPORTS</div>
                        </div>
                        <div class="summary-stat">
                            <div class="summary-stat-value">${displayDated}</div>
                            <div class="summary-stat-label">DATED ACTORS</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Timeline Summary -->
            <div class="stat-card stat-card-wide">
                <div class="stat-card-header">
                    <span class="stat-card-icon">📅</span>
                    <span class="stat-card-title">APT EMERGENCE TIMELINE${filterNote.toUpperCase()}</span>
                </div>
                <div class="stat-card-content">
                    ${renderTimelineSummary(timeline)}
                </div>
            </div>

            <!-- By Country -->
            <div class="stat-card">
                <div class="stat-card-header">
                    <span class="stat-card-icon">🌍</span>
                    <span class="stat-card-title">BY ATTRIBUTION</span>
                </div>
                <div class="stat-card-content">
                    <div class="bar-chart">
                        ${(stats.byCountry && stats.byCountry.length > 0) ? stats.byCountry.slice(0, 10).map(item => {
                            const flagHtml = (typeof CountryData !== 'undefined') 
                                ? CountryData.getFlagHtml(item.code, { size: 20, className: 'country-flag' })
                                : '';
                            const maxCount = stats.byCountry[0]?.count || 1;
                            return `
                            <div class="bar-chart-item">
                                <span class="bar-chart-label">${flagHtml} ${item.name}</span>
                                <div class="bar-chart-bar">
                                    <div class="bar-chart-fill" style="width: ${(item.count / maxCount) * 100}%"></div>
                                </div>
                                <span class="bar-chart-value">${item.count}</span>
                            </div>
                        `}).join('') : '<div class="no-data">No attribution data available</div>'}
                    </div>
                </div>
            </div>

            <!-- By Sector -->
            <div class="stat-card">
                <div class="stat-card-header">
                    <span class="stat-card-icon">🎯</span>
                    <span class="stat-card-title">BY TARGET SECTOR</span>
                </div>
                <div class="stat-card-content">
                    <div class="bar-chart">
                        ${(stats.bySector && stats.bySector.length > 0) ? stats.bySector.slice(0, 10).map(item => {
                            const maxCount = stats.bySector[0]?.count || 1;
                            return `
                            <div class="bar-chart-item">
                                <span class="bar-chart-label">${capitalize(item.sector)}</span>
                                <div class="bar-chart-bar">
                                    <div class="bar-chart-fill" style="width: ${(item.count / maxCount) * 100}%"></div>
                                </div>
                                <span class="bar-chart-value">${item.count}</span>
                            </div>
                        `}).join('') : '<div class="no-data">No sector data available</div>'}
                    </div>
                </div>
            </div>

            <!-- Reports by Year -->
            <div class="stat-card">
                <div class="stat-card-header">
                    <span class="stat-card-icon">📄</span>
                    <span class="stat-card-title">REPORTS BY YEAR</span>
                </div>
                <div class="stat-card-content">
                    ${renderYearDistribution(stats.reportsByYear || [])}
                </div>
            </div>
        `;
        } catch (error) {
            console.error('[App] Error rendering statistics view:', error);
            elements.statisticsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <h3 class="empty-state-title">Error loading statistics</h3>
                    <p class="empty-state-message">An error occurred while rendering statistics. Check the console for details.</p>
                </div>
            `;
        }
    }

    /**
     * Renders horizontal timeline by year with attribution breakdown
     */
    function renderTimelineSummary(timeline) {
        if (!timeline || timeline.length === 0) {
            return '<div class="no-data">No timeline data available</div>';
        }

        // Country colors for visualization
        const countryColors = {
            'CN': '#e63946',  // China - Red
            'RU': '#457b9d',  // Russia - Blue
            'IR': '#2a9d8f',  // Iran - Teal
            'KP': '#e9c46a',  // North Korea - Yellow
            'US': '#3a86ff',  // USA - Blue
            'VN': '#06d6a0',  // Vietnam - Green
            'IN': '#ff9f1c',  // India - Orange
            'PK': '#118ab2',  // Pakistan - Blue
            'IL': '#073b4c',  // Israel - Dark blue
            'UA': '#ffd166',  // Ukraine - Yellow
            'BY': '#ef476f',  // Belarus - Pink
            'KR': '#26547c',  // South Korea - Blue
            'TR': '#dc2f02',  // Turkey - Red
            'Unknown': '#6c757d'  // Unknown - Gray
        };

        // Group actors by year AND country
        const byYearCountry = {};
        const countryCounts = {};
        
        timeline.forEach(actor => {
            if (actor.firstSeen) {
                const year = parseInt(actor.firstSeen);
                if (!isNaN(year) && year >= 1990 && year <= 2025) {
                    const country = actor.country || 'Unknown';
                    
                    if (!byYearCountry[year]) byYearCountry[year] = {};
                    if (!byYearCountry[year][country]) byYearCountry[year][country] = [];
                    byYearCountry[year][country].push(actor);
                    
                    countryCounts[country] = (countryCounts[country] || 0) + 1;
                }
            }
        });

        // Get years range
        const years = Object.keys(byYearCountry).map(Number).sort((a, b) => a - b);
        if (years.length === 0) {
            return '<div class="no-data">No timeline data available</div>';
        }

        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        
        // Get top countries for legend (sorted by count)
        const topCountries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([code]) => code);

        // Create all years array
        const allYears = [];
        for (let y = minYear; y <= maxYear; y++) {
            allYears.push(y);
        }

        // Find max total per year for scaling
        let maxYearTotal = 0;
        allYears.forEach(year => {
            const yearData = byYearCountry[year] || {};
            const total = Object.values(yearData).reduce((sum, actors) => sum + actors.length, 0);
            if (total > maxYearTotal) maxYearTotal = total;
        });

        // Calculate cumulative totals
        let cumulative = 0;
        const cumulativeByYear = {};
        allYears.forEach(year => {
            const yearData = byYearCountry[year] || {};
            const total = Object.values(yearData).reduce((sum, actors) => sum + actors.length, 0);
            cumulative += total;
            cumulativeByYear[year] = cumulative;
        });

        // Find peak year
        let peakYear = minYear;
        let peakCount = 0;
        allYears.forEach(year => {
            const yearData = byYearCountry[year] || {};
            const total = Object.values(yearData).reduce((sum, actors) => sum + actors.length, 0);
            if (total > peakCount) {
                peakCount = total;
                peakYear = year;
            }
        });

        // Build legend HTML
        const legendHtml = topCountries.map(code => {
            const color = countryColors[code] || countryColors['Unknown'];
            const flagHtml = code !== 'Unknown' && typeof CountryData !== 'undefined' 
                ? CountryData.getFlagHtml(code, { size: 14 }) 
                : '';
            const name = code !== 'Unknown' && typeof CountryData !== 'undefined'
                ? (CountryData.get(code)?.name || code)
                : 'Unknown';
            return `
                <div class="tl-legend-item">
                    <span class="tl-legend-color" style="background: ${color}"></span>
                    ${flagHtml}
                    <span class="tl-legend-name">${name}</span>
                    <span class="tl-legend-count">${countryCounts[code]}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="horizontal-timeline">
                <div class="timeline-chart-container">
                    <div class="timeline-chart">
                        ${allYears.map(year => {
                            const yearData = byYearCountry[year] || {};
                            const total = Object.values(yearData).reduce((sum, actors) => sum + actors.length, 0);
                            const heightPercent = total > 0 ? (total / maxYearTotal) * 100 : 0;
                            
                            // Build stacked segments
                            let segmentsHtml = '';
                            let currentOffset = 0;
                            
                            // Sort countries by count for this year (largest at bottom)
                            const yearCountries = Object.entries(yearData)
                                .sort((a, b) => b[1].length - a[1].length);
                            
                            yearCountries.forEach(([country, actors]) => {
                                const segmentHeight = (actors.length / total) * 100;
                                const color = countryColors[country] || countryColors['Unknown'];
                                const flagHtml = country !== 'Unknown' && typeof CountryData !== 'undefined'
                                    ? CountryData.getFlagHtml(country, { size: 10 })
                                    : '';
                                const countryName = country !== 'Unknown' && typeof CountryData !== 'undefined'
                                    ? (CountryData.get(country)?.name || country)
                                    : 'Unknown';
                                
                                segmentsHtml += `
                                    <div class="tl-segment" 
                                         style="height: ${segmentHeight}%; background: ${color};"
                                         data-country="${country}"
                                         data-count="${actors.length}">
                                    </div>
                                `;
                                currentOffset += segmentHeight;
                            });
                            
                            // Build tooltip content
                            let tooltipActors = '';
                            yearCountries.slice(0, 5).forEach(([country, actors]) => {
                                const flagHtml = country !== 'Unknown' && typeof CountryData !== 'undefined'
                                    ? CountryData.getFlagHtml(country, { size: 12 })
                                    : '🏴';
                                const countryName = country !== 'Unknown' && typeof CountryData !== 'undefined'
                                    ? (CountryData.get(country)?.name || country)
                                    : 'Unknown';
                                tooltipActors += `<div class="tl-tooltip-country">${flagHtml} ${countryName}: ${actors.length}</div>`;
                            });
                            
                            return `
                                <div class="tl-col ${total === 0 ? 'empty' : ''}" data-year="${year}">
                                    <div class="tl-bar-wrap">
                                        ${total > 0 ? `
                                            <div class="tl-bar-stacked" style="height: ${heightPercent}%">
                                                ${segmentsHtml}
                                                <span class="tl-count">${total}</span>
                                            </div>
                                        ` : '<div class="tl-bar-empty"></div>'}
                                    </div>
                                    <div class="tl-label">${year.toString().slice(-2)}</div>
                                    <div class="tl-tooltip">
                                        <div class="tl-tooltip-header">${year}</div>
                                        <div class="tl-tooltip-stat">${total} group${total !== 1 ? 's' : ''}</div>
                                        <div class="tl-tooltip-cumulative">Total: ${cumulativeByYear[year]}</div>
                                        ${tooltipActors ? `<div class="tl-tooltip-breakdown">${tooltipActors}</div>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="tl-country-legend">
                    ${legendHtml}
                </div>
                <div class="timeline-legend">
                    <div class="tl-stat">
                        <span class="tl-stat-label">First Tracked</span>
                        <span class="tl-stat-value">${minYear}</span>
                    </div>
                    <div class="tl-stat">
                        <span class="tl-stat-label">Peak Year</span>
                        <span class="tl-stat-value">${peakYear} (${peakCount})</span>
                    </div>
                    <div class="tl-stat">
                        <span class="tl-stat-label">Total Groups</span>
                        <span class="tl-stat-value">${timeline.length}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renders year distribution chart
     * @param {Array} yearData - Array of {year, count} objects
     * @returns {string} HTML string
     */
    function renderYearDistribution(yearData) {
        if (!yearData || yearData.length === 0) {
            return '<div class="no-data">No year data available</div>';
        }

        const maxCount = Math.max(...yearData.map(d => d.count));
        const minYear = Math.min(...yearData.map(d => d.year));
        const maxYear = Math.max(...yearData.map(d => d.year));

        const bars = yearData.map(item => {
            const height = (item.count / maxCount) * 100;
            return `
                <div class="year-bar" style="height: ${height}%">
                    <div class="year-bar-tooltip">${item.year}: ${item.count}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="year-distribution">${bars}</div>
            <div class="year-labels">
                <span>${minYear}</span>
                <span>${maxYear}</span>
            </div>
        `;
    }

    // =========================================================================
    // FILTERS
    // =========================================================================

    /**
     * Renders filter options
     */
    function renderFilters() {
        const countries = ActorParser.getCountries();
        const sectors = ActorParser.getSectors();

        // Render country filters with flags
        elements.filterCountries.innerHTML = countries.slice(0, 15).map(item => {
            const flagHtml = (typeof CountryData !== 'undefined') 
                ? CountryData.getFlagHtml(item.code, { size: 16, className: 'country-flag' })
                : '';
            return `
                <label class="filter-checkbox">
                    <input type="checkbox" value="${item.code}" data-filter="country">
                    <span class="checkmark"></span>
                    <span class="filter-label">${flagHtml} ${item.name} (${item.count})</span>
                </label>
            `;
        }).join('');

        // Render sector filters
        elements.filterSectors.innerHTML = sectors.slice(0, 15).map(item => `
            <label class="filter-checkbox">
                <input type="checkbox" value="${item.sector}" data-filter="sector">
                <span class="checkmark"></span>
                <span class="filter-label">${capitalize(item.sector)} (${item.count})</span>
            </label>
        `).join('');

        // Add event listeners
        elements.filterCountries.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', handleFilterChange);
        });

        elements.filterSectors.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', handleFilterChange);
        });
    }

    /**
     * Handles filter changes
     */
    function handleFilterChange() {
        // Collect country filters
        state.filters.countries = Array.from(
            elements.filterCountries.querySelectorAll('input:checked')
        ).map(input => input.value);

        // Collect sector filters
        state.filters.sectors = Array.from(
            elements.filterSectors.querySelectorAll('input:checked')
        ).map(input => input.value);

        // Checkbox filters
        state.filters.hasReports = elements.filterHasReports.checked;
        state.filters.stateSponsored = elements.filterStateSponsored.checked;

        // Re-render current view
        renderCurrentView();
    }

    /**
     * Resets all filters
     */
    function resetFilters() {
        state.filters = {
            search: '',
            countries: [],
            sectors: [],
            hasReports: false,
            stateSponsored: false
        };

        // Reset UI
        elements.globalSearch.value = '';
        elements.filterHasReports.checked = false;
        elements.filterStateSponsored.checked = false;
        
        elements.filterCountries.querySelectorAll('input').forEach(input => {
            input.checked = false;
        });
        
        elements.filterSectors.querySelectorAll('input').forEach(input => {
            input.checked = false;
        });

        renderCurrentView();
    }

    // =========================================================================
    // SEARCH
    // =========================================================================

    /**
     * Handles search input
     */
    function handleSearch() {
        state.filters.search = elements.globalSearch.value.trim();
        renderCurrentView();
    }

    /**
     * Clears search input
     */
    function clearSearch() {
        elements.globalSearch.value = '';
        state.filters.search = '';
        renderCurrentView();
    }

    // =========================================================================
    // ACTOR MODAL
    // =========================================================================

    // Store focus trap references
    let actorModalTrap = null;
    let settingsModalTrap = null;

    /**
     * Opens the actor detail modal
     * @param {string} uuid - Actor UUID
     */
    function openActorModal(uuid) {
        const actor = ActorParser.getActorByUuid(uuid);
        if (!actor) {
            showToast('Actor not found', 'error');
            return;
        }

        state.selectedActor = actor;

        // Populate modal content
        populateActorModal(actor);

        // Show modal
        elements.actorModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Activate focus trap (accessibility)
        if (typeof FocusTrap !== 'undefined') {
            actorModalTrap = FocusTrap.activate(elements.actorModal, {
                onEscape: closeActorModal,
                initialFocus: elements.actorModal.querySelector('.modal-close')
            });
        }

        // Announce to screen readers
        announceToScreenReader(`Opened dossier for ${actor.name}`);
    }

    /**
     * Populates the actor modal with data
     * @param {Object} actor - Actor data
     */
    function populateActorModal(actor) {
        // Helper to add source tooltip
        const withSource = (value, source) => {
            if (!value || value === 'Unknown') return value || 'Unknown';
            return `<span class="sourced-data">${escapeHtml(String(value))}<span class="source-tooltip">${source}</span></span>`;
        };

        // Source descriptions for tooltips
        const sourceDescriptions = {
            'MISP Galaxy': 'MISP Threat Actor Galaxy (GitHub)',
            'MITRE ATT&CK': 'MITRE ATT&CK Framework (GitHub)',
            'ETDA Thailand': 'Thailand ETDA APT Database',
            'Malpedia': 'Fraunhofer FKIE Malpedia',
            'Google Cloud': 'Google Cloud Threat Intelligence',
            'APTMalware': 'APTMalware IOC Repository (GitHub)',
            'APTnotes': 'APTnotes Report Collection (GitHub)',
            'Breach-HQ': 'Breach-HQ Threat Database'
        };

        // Helper to create source badge with tooltip
        const makeSourceBadge = (source) => {
            const tooltip = sourceDescriptions[source] || source;
            return `<span class="source-badge" data-tooltip="${tooltip}">📡 ${source}</span>`;
        };

        // Determine sources for this actor (with LIVE indicator)
        const getSource = (field) => {
            const sources = [];
            const addSource = (name, isLive) => {
                sources.push(isLive ? `${name} 🔴LIVE` : name);
            };
            
            if (field === 'name' || field === 'description') {
                addSource('MISP Galaxy', false);  // Always from GitHub
            }
            if (field === 'aliases') {
                addSource('MISP Galaxy', false);
                if (actor.malpediaEnriched) addSource('Malpedia', actor.malpediaLive);
                if (actor.breachHQEnriched) addSource('Breach-HQ', actor.breachHQLive);
                if (actor.etdaEnriched) addSource('ETDA Thailand', actor.etdaLive);
            }
            if (field === 'attribution') {
                // Check if country came from ETDA (actor didn't have country before ETDA enrichment)
                if (actor.etdaEnriched && actor.country) {
                    addSource('ETDA Thailand', actor.etdaLive);
                } else {
                    addSource('MISP Galaxy', false);
                }
                if (actor.googleEnriched) addSource('Google Cloud', false);
            }
            if (field === 'firstSeen') {
                if (actor.firstSeenSource) return actor.firstSeenSource;
                if (actor.etdaEnriched) addSource('ETDA Thailand', actor.etdaLive);
                else addSource('MISP Galaxy', false);
            }
            if (field === 'sectors') {
                addSource('MISP Galaxy', false);
                if (actor.googleEnriched) addSource('Google Cloud', false);
            }
            if (field === 'victims') {
                addSource('MISP Galaxy', false);
            }
            if (field === 'attackVectors' || field === 'malware') {
                addSource('Google Cloud', false);
            }
            if (field === 'iocs') {
                addSource('APTMalware', true);  // Always live from GitHub
            }
            if (field === 'threatType') {
                addSource('Breach-HQ', actor.breachHQLive);
            }
            return sources.join(' + ');
        };
        
        // Helper to create badge HTML with tooltip
        const sourceBadgeHtml = (field) => {
            const source = getSource(field);
            const mainSource = source.split(' + ')[0].replace(' 🔴LIVE', '');
            const tooltip = sourceDescriptions[mainSource] || source;
            return `<span class="source-badge" data-tooltip="${tooltip}">📡 ${source}</span>`;
        };

        // Title - display immediately (no animation)
        document.getElementById('dossier-title').innerHTML = 
            `<span class="dossier-field">${escapeHtml(actor.name)}${sourceBadgeHtml('name')}</span>`;

        // Aliases with source
        const aliasesContainer = document.getElementById('dossier-aliases');
        aliasesContainer.innerHTML = actor.synonyms.slice(0, 5).map(alias => 
            `<span class="alias-tag dossier-field">${escapeHtml(alias)}${sourceBadgeHtml('aliases')}</span>`
        ).join('');

        // Meta information with flag
        const flagHtml = (typeof CountryData !== 'undefined' && actor.country) 
            ? CountryData.getFlagHtml(actor.country, { size: 24, className: 'country-flag' })
            : '';
        
        document.getElementById('dossier-attribution').innerHTML = 
            `<span class="dossier-field">${flagHtml} ${actor.stateSponsor || actor.countryName || 'Unknown'}${sourceBadgeHtml('attribution')}</span>`;
        
        // First seen with source
        const firstSeenValue = actor.firstSeen || 'Unknown';
        const lastSeenHtml = actor.lastSeen ? ` → ${actor.lastSeen}` : '';
        document.getElementById('dossier-first-seen').innerHTML = 
            `<span class="dossier-field">${firstSeenValue}${lastSeenHtml}${sourceBadgeHtml('firstSeen')}</span>`;
        
        // Confidence meter
        const confidence = actor.attributionConfidence || 0;
        document.getElementById('dossier-confidence').innerHTML = `
            <div class="confidence-meter dossier-field">
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidence}%"></div>
                </div>
                <span class="confidence-value">${confidence}%</span>
                <span class="source-badge" data-tooltip="MISP Threat Actor Galaxy (GitHub)">📡 MISP Galaxy</span>
            </div>
        `;

        // Description with source
        document.getElementById('dossier-description').innerHTML = 
            `<span class="dossier-field">${escapeHtml(actor.description || 'No description available.')}${sourceBadgeHtml('description')}</span>`;

        // Sectors with source
        const sectorsContainer = document.getElementById('dossier-sectors');
        sectorsContainer.innerHTML = actor.sectors.length > 0
            ? actor.sectors.map(s => `<span class="targeting-tag sector dossier-field">${capitalize(s)}${sourceBadgeHtml('sectors')}</span>`).join('')
            : '<span class="no-data">No sectors identified</span>';

        // Victims with flags
        const victimsContainer = document.getElementById('dossier-victims');
        victimsContainer.innerHTML = actor.victims.length > 0
            ? actor.victims.map(v => {
                const victimFlag = (typeof CountryData !== 'undefined') 
                    ? CountryData.getFlagHtml(v, { size: 14, className: 'country-flag' })
                    : '';
                return `<span class="targeting-tag country dossier-field">${victimFlag} ${v}<span class="source-badge" data-tooltip="MISP Threat Actor Galaxy (GitHub)">📡 MISP Galaxy</span></span>`;
            }).join('')
            : '<span class="no-data">No victims identified</span>';

        // Incident type
        document.getElementById('dossier-incident-type').innerHTML = 
            `<span class="dossier-field">${escapeHtml(actor.incidentType || 'Unknown')}<span class="source-badge" data-tooltip="MISP Threat Actor Galaxy (GitHub)">📡 MISP Galaxy</span></span>`;

        // MITRE ATT&CK Techniques
        const techniquesSection = document.getElementById('dossier-techniques-section');
        const techniquesContainer = document.getElementById('dossier-techniques');
        const techniquesCount = document.getElementById('dossier-techniques-count');
        
        if (actor.techniques && actor.techniques.length > 0) {
            techniquesSection.style.display = '';
            techniquesCount.textContent = `(${actor.techniques.length})`;
            
            // Group techniques by tactic for better organization
            const tacticOrder = ['reconnaissance', 'resource-development', 'initial-access', 'execution', 
                'persistence', 'privilege-escalation', 'defense-evasion', 'credential-access', 
                'discovery', 'lateral-movement', 'collection', 'command-and-control', 'exfiltration', 'impact'];
            
            const byTactic = {};
            actor.techniques.forEach(t => {
                const tactic = t.tactic || 'other';
                if (!byTactic[tactic]) byTactic[tactic] = [];
                byTactic[tactic].push(t);
            });
            
            // Sort tactics by kill chain order
            const sortedTactics = Object.keys(byTactic).sort((a, b) => {
                const aIdx = tacticOrder.indexOf(a.toLowerCase());
                const bIdx = tacticOrder.indexOf(b.toLowerCase());
                return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
            });
            
            techniquesContainer.innerHTML = sortedTactics.map(tactic => `
                <div class="technique-group">
                    <div class="technique-tactic">${tactic.replace(/-/g, ' ').toUpperCase()}</div>
                    <div class="technique-list">
                        ${byTactic[tactic].map(t => `
                            <a href="https://attack.mitre.org/techniques/${t.id}/" target="_blank" rel="noopener" 
                               class="technique-tag dossier-field" title="${escapeHtml(t.name || t.id)}">
                                <span class="technique-id">${t.id}</span>
                                <span class="technique-name">${escapeHtml(t.name || '')}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } else {
            techniquesSection.style.display = 'none';
        }

        // Attack Vectors (from Google APT enrichment)
        const attackVectorsSection = document.getElementById('dossier-attack-vectors-section');
        const attackVectorsContainer = document.getElementById('dossier-attack-vectors');
        if (actor.attackVectors && actor.attackVectors.length > 0) {
            attackVectorsSection.style.display = '';
            attackVectorsContainer.innerHTML = actor.attackVectors.map(v => 
                `<span class="targeting-tag ttp dossier-field">${escapeHtml(v)}<span class="source-badge" data-tooltip="Google Cloud Threat Intelligence (Mandiant)">📡 Google Cloud</span></span>`
            ).join('');
        } else {
            attackVectorsSection.style.display = 'none';
        }

        // Associated Malware (from Google APT enrichment)
        const malwareSection = document.getElementById('dossier-malware-section');
        const malwareContainer = document.getElementById('dossier-malware');
        if (actor.associatedMalware && actor.associatedMalware.length > 0) {
            malwareSection.style.display = '';
            malwareContainer.innerHTML = actor.associatedMalware.map(m => 
                `<span class="targeting-tag malware dossier-field">${escapeHtml(m)}<span class="source-badge" data-tooltip="Google Cloud Threat Intelligence (Mandiant)">📡 Google Cloud</span></span>`
            ).join('');
        } else {
            malwareSection.style.display = 'none';
        }

        // Malware IOCs (from APTMalware enrichment)
        const iocsSection = document.getElementById('dossier-iocs-section');
        const iocsSummary = document.getElementById('dossier-iocs-summary');
        const iocsHashes = document.getElementById('dossier-iocs-hashes');
        const iocsCount = document.getElementById('dossier-iocs-count');
        
        if (actor.malwareIOCs && actor.malwareIOCs.total > 0) {
            iocsSection.style.display = '';
            iocsCount.textContent = `(${actor.malwareIOCs.total})`;
            
            iocsSummary.innerHTML = `
                <div class="iocs-stats dossier-field">
                    <div class="ioc-stat">
                        <span class="ioc-stat-value">${actor.malwareIOCs.total}</span>
                        <span class="ioc-stat-label">Total Samples</span>
                    </div>
                    <div class="ioc-stat">
                        <span class="ioc-stat-value">${actor.malwareIOCs.verified}</span>
                        <span class="ioc-stat-label">Verified</span>
                    </div>
                    <div class="ioc-stat">
                        <span class="ioc-stat-value">${actor.malwareIOCs.sha256.length}</span>
                        <span class="ioc-stat-label">SHA256 Hashes</span>
                    </div>
                    <span class="source-badge" data-tooltip="APTMalware IOC Repository (GitHub)">📡 APTMalware</span>
                </div>
            `;
            
            // Show first 5 hashes with expand option
            const sha256Hashes = actor.malwareIOCs.sha256.slice(0, 5);
            const hasMore = actor.malwareIOCs.sha256.length > 5;
            
            iocsHashes.innerHTML = `
                <div class="iocs-hash-list">
                    ${sha256Hashes.map(hash => `
                        <div class="ioc-hash-item dossier-field">
                            <code class="hash-value">${hash}</code>
                            <button class="copy-hash-btn" onclick="navigator.clipboard.writeText('${hash}')" title="Copy hash">📋</button>
                            <span class="source-badge" data-tooltip="APTMalware IOC Repository (GitHub)">📡 APTMalware</span>
                        </div>
                    `).join('')}
                    ${hasMore ? `<div class="iocs-more">+ ${actor.malwareIOCs.sha256.length - 5} more hashes</div>` : ''}
                </div>
            `;
        } else {
            iocsSection.style.display = 'none';
        }

        // Reports
        const reports = ActorParser.getReportsForActor(actor.uuid);
        document.getElementById('dossier-reports-count').textContent = `(${reports.length})`;
        
        const reportsContainer = document.getElementById('dossier-reports');
        reportsContainer.innerHTML = reports.length > 0
            ? reports.slice(0, 10).map(report => `
                <div class="report-row dossier-field">
                    <span class="report-date">${report.dateFormatted || 'Unknown'}</span>
                    <span class="report-title" title="${escapeHtml(report.title)}">${escapeHtml(report.title)}</span>
                    <span class="report-source">${escapeHtml(report.source)}</span>
                    ${report.link ? `<a href="${report.link}" target="_blank" rel="noopener" class="report-link">↗</a>` : ''}
                    <span class="source-badge" data-tooltip="APTnotes Report Collection (GitHub)">📡 APTnotes</span>
                </div>
            `).join('')
            : '<div class="reports-empty">No linked reports available.</div>';

        // References
        document.getElementById('dossier-refs-count').textContent = `(${actor.refs.length})`;
        
        const refsContainer = document.getElementById('dossier-refs');
        refsContainer.innerHTML = actor.refs.length > 0
            ? actor.refs.slice(0, 15).map(ref => {
                const refType = getRefType(ref);
                return `
                    <li class="reference-item ${refType} dossier-field">
                        <span class="reference-icon">🔗</span>
                        <a href="${ref}" target="_blank" rel="noopener" class="reference-link">${ref}</a>
                        <span class="source-badge" data-tooltip="MISP Threat Actor Galaxy (GitHub)">📡 MISP Galaxy</span>
                    </li>
                `;
            }).join('')
            : '<li class="no-data">No external references available.</li>';

        // Related actors
        const relatedContainer = document.getElementById('dossier-related');
        if (actor.related && actor.related.length > 0) {
            const relatedActors = actor.related
                .map(rel => {
                    const relatedActor = ActorParser.getActorByName(rel.dest_uuid) || 
                                        ActorParser.getActorByUuid(rel.dest_uuid);
                    return relatedActor ? { ...relatedActor, relation: rel.type } : null;
                })
                .filter(Boolean)
                .slice(0, 6);

            relatedContainer.innerHTML = relatedActors.length > 0
                ? relatedActors.map(rel => `
                    <div class="related-actor-card dossier-field" data-uuid="${rel.uuid}">
                        <div class="related-actor-icon">👤</div>
                        <div class="related-actor-info">
                            <span class="related-actor-name">${escapeHtml(rel.name)}</span>
                            <span class="related-actor-relation">${rel.relation || 'Related'}</span>
                        </div>
                        <span class="source-badge" data-tooltip="MISP Threat Actor Galaxy (GitHub)">📡 MISP Galaxy</span>
                    </div>
                `).join('')
                : '<span class="related-empty">No related actors identified.</span>';

            // Add click handlers
            relatedContainer.querySelectorAll('.related-actor-card').forEach(card => {
                card.addEventListener('click', () => {
                    openActorModal(card.dataset.uuid);
                });
            });
        } else {
            relatedContainer.innerHTML = '<span class="related-empty">No related actors identified.</span>';
        }

        // Footer info
        document.getElementById('dossier-uuid').textContent = actor.uuid;
        document.getElementById('dossier-timestamp').textContent = new Date().toLocaleString();
    }

    /**
     * Gets reference type from URL for styling
     * @param {string} url - Reference URL
     * @returns {string} Reference type
     */
    function getRefType(url) {
        if (url.includes('attack.mitre.org')) return 'mitre';
        if (url.includes('mandiant.com') || url.includes('fireeye.com')) return 'mandiant';
        if (url.includes('crowdstrike.com')) return 'crowdstrike';
        if (url.includes('microsoft.com')) return 'microsoft';
        if (url.includes('kaspersky')) return 'kaspersky';
        return '';
    }

    /**
     * Closes the actor modal
     */
    function closeActorModal() {
        elements.actorModal.classList.add('hidden');
        document.body.style.overflow = '';
        state.selectedActor = null;

        // Stop any running typewriter animations
        if (typeof Typewriter !== 'undefined') {
            Typewriter.stop();
        }

        // Deactivate focus trap (returns focus to trigger)
        if (actorModalTrap && typeof FocusTrap !== 'undefined') {
            FocusTrap.deactivate(actorModalTrap);
            actorModalTrap = null;
        }

        // Announce to screen readers
        announceToScreenReader('Dossier closed');
    }

    // =========================================================================
    // REPORT MODAL
    // =========================================================================

    let reportModalTrap = null;

    /**
     * Opens the report detail modal
     * @param {Object} report - Report data
     */
    function openReportModal(report) {
        if (!report) {
            showToast('Report not found', 'error');
            return;
        }

        state.selectedReport = report;

        // Populate modal
        document.getElementById('report-modal-date').textContent = report.dateFormatted || 'Unknown Date';
        document.getElementById('report-modal-source').textContent = report.source || 'Unknown Source';
        document.getElementById('report-modal-title').textContent = report.title || 'Untitled Report';
        document.getElementById('report-modal-filename').textContent = report.filename || 'N/A';
        document.getElementById('report-modal-actors-count').textContent = `(${report.linkedActors?.length || 0})`;

        // Populate linked actors
        const actorsContainer = document.getElementById('report-modal-actors');
        if (report.linkedActors && report.linkedActors.length > 0) {
            actorsContainer.innerHTML = report.linkedActors.map(actor => {
                const flagHtml = (typeof CountryData !== 'undefined' && actor.country) 
                    ? CountryData.getFlagHtml(actor.country, { size: 14 })
                    : '';
                return `
                    <span class="report-actor-tag" data-uuid="${actor.uuid}">
                        ${flagHtml}
                        <span>${escapeHtml(actor.name)}</span>
                    </span>
                `;
            }).join('');

            // Add click handlers for actor tags
            actorsContainer.querySelectorAll('.report-actor-tag').forEach(tag => {
                tag.addEventListener('click', () => {
                    closeReportModal();
                    openActorModal(tag.dataset.uuid);
                });
            });
        } else {
            actorsContainer.innerHTML = '<span class="no-data">No linked threat actors</span>';
        }

        // Set download link
        const downloadLink = document.getElementById('report-modal-link');
        if (report.link) {
            downloadLink.href = report.link;
            downloadLink.style.display = '';
        } else {
            downloadLink.style.display = 'none';
        }

        // Show modal
        const reportModal = document.getElementById('report-modal');
        reportModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Activate focus trap
        if (typeof FocusTrap !== 'undefined') {
            reportModalTrap = FocusTrap.activate(reportModal, {
                onEscape: closeReportModal,
                initialFocus: reportModal.querySelector('.modal-close')
            });
        }

        announceToScreenReader(`Opened report: ${report.title}`);
    }

    /**
     * Closes the report modal
     */
    function closeReportModal() {
        const reportModal = document.getElementById('report-modal');
        reportModal.classList.add('hidden');
        document.body.style.overflow = '';
        state.selectedReport = null;

        if (reportModalTrap && typeof FocusTrap !== 'undefined') {
            FocusTrap.deactivate(reportModalTrap);
            reportModalTrap = null;
        }

        announceToScreenReader('Report closed');
    }

    // =========================================================================
    // SETTINGS MODAL
    // =========================================================================

    /**
     * Opens the settings modal
     */
    function openSettings() {
        // Update settings UI
        document.getElementById('setting-animations').checked = state.settings.animationsEnabled;
        document.getElementById('setting-sounds').checked = state.settings.soundsEnabled;
        document.getElementById('setting-mitre-enabled').checked = state.settings.mitreEnabled;

        // Update cache status
        updateCacheStatus();

        elements.settingsModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Activate focus trap (accessibility)
        if (typeof FocusTrap !== 'undefined') {
            settingsModalTrap = FocusTrap.activate(elements.settingsModal, {
                onEscape: closeSettings,
                initialFocus: elements.settingsModal.querySelector('.modal-close')
            });
        }

        announceToScreenReader('Settings dialog opened');
    }

    /**
     * Closes the settings modal
     */
    function closeSettings() {
        elements.settingsModal.classList.add('hidden');
        document.body.style.overflow = '';

        // Save settings
        saveSettings();

        // Deactivate focus trap
        if (settingsModalTrap && typeof FocusTrap !== 'undefined') {
            FocusTrap.deactivate(settingsModalTrap);
            settingsModalTrap = null;
        }

        announceToScreenReader('Settings dialog closed');
    }

    /**
     * Updates cache status display
     */
    async function updateCacheStatus() {
        const cacheStatus = await DataLoader.getCacheStatus();
        const statusContainer = document.getElementById('cache-status');

        statusContainer.innerHTML = Object.entries(cacheStatus).map(([key, status]) => `
            <div style="margin-bottom: 8px;">
                <strong>${status.name}:</strong> 
                ${status.cached ? `Cached (${status.ageFormatted} ago)` : 'Not cached'}
                ${!status.enabled ? ' [Disabled]' : ''}
            </div>
        `).join('');
    }

    // =========================================================================
    // SETTINGS PERSISTENCE
    // =========================================================================

    /**
     * Loads settings from localStorage
     */
    function loadSettings() {
        try {
            const saved = localStorage.getItem('apt_dashboard_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                state.settings = { ...state.settings, ...parsed };
            }
        } catch (e) {
            console.warn('[App] Failed to load settings:', e);
        }

        // Apply settings
        updateAnimationState();
        
        if (state.settings.mitreEnabled) {
            DataLoader.enableMitreAttack();
        }
    }

    /**
     * Saves settings to localStorage
     */
    function saveSettings() {
        try {
            localStorage.setItem('apt_dashboard_settings', JSON.stringify(state.settings));
        } catch (e) {
            console.warn('[App] Failed to save settings:', e);
        }
    }

    /**
     * Updates animation state based on settings
     */
    function updateAnimationState() {
        document.body.classList.toggle('no-animations', !state.settings.animationsEnabled);
    }

    // =========================================================================
    // UI UPDATES
    // =========================================================================

    /**
     * Updates header statistics
     */
    function updateHeaderStats() {
        const stats = ActorParser.getStatistics();
        if (stats) {
            elements.headerStatActors.textContent = stats.totalActors;
            elements.headerStatReports.textContent = stats.totalReports;
        }
    }

    /**
     * Updates last updated timestamp
     */
    function updateLastUpdated() {
        const state = DataLoader.getState();
        const timestamp = state.lastUpdated.mispGalaxy || state.lastUpdated.aptNotes;
        
        if (timestamp) {
            elements.lastUpdated.textContent = `Last updated: ${new Date(timestamp).toLocaleString()}`;
        }
    }

    // =========================================================================
    // KEYBOARD HANDLING
    // =========================================================================

    /**
     * Handles keyboard shortcuts
     * @param {KeyboardEvent} e - Keyboard event
     */
    function handleKeyboard(e) {
        // Escape to close modals
        if (e.key === 'Escape') {
            if (!elements.actorModal.classList.contains('hidden')) {
                closeActorModal();
            } else if (!elements.settingsModal.classList.contains('hidden')) {
                closeSettings();
            }
        }

        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            elements.globalSearch.focus();
        }
    }

    // =========================================================================
    // TOAST NOTIFICATIONS
    // =========================================================================

    /**
     * Shows a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type: 'info', 'success', 'warning', 'error'
     * @param {number} duration - Duration in milliseconds
     */
    function showToast(message, type = 'info', duration = 5000) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close">✕</button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });

        elements.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    }

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * Escapes HTML special characters (uses Helpers if available, otherwise local)
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
     * Capitalizes first letter (uses Helpers if available)
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    function capitalize(str) {
        if (typeof Helpers !== 'undefined' && Helpers.capitalize) {
            return Helpers.capitalize(str);
        }
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Debounces a function (uses Helpers if available)
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        if (typeof Helpers !== 'undefined' && Helpers.debounce) {
            return Helpers.debounce(func, wait);
        }
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Announces a message to screen readers
     * @param {string} message - Message to announce
     * @param {string} [priority='polite'] - 'polite' or 'assertive'
     */
    function announceToScreenReader(message, priority = 'polite') {
        // Find or create announcement region
        let announcer = document.getElementById('sr-announcer');
        
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'sr-announcer';
            announcer.className = 'visually-hidden';
            announcer.setAttribute('aria-live', priority);
            announcer.setAttribute('aria-atomic', 'true');
            document.body.appendChild(announcer);
        } else {
            announcer.setAttribute('aria-live', priority);
        }

        // Clear and set message (triggers announcement)
        announcer.textContent = '';
        requestAnimationFrame(() => {
            announcer.textContent = message;
        });
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        init,
        switchView,
        openActorModal,
        closeActorModal,
        showToast,
        filterByCountry,
        clearCountryFilter,
        getState: () => ({ ...state }),
        refresh: refreshData
    };
})();

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Register Service Worker and PWA support (only in HTTP mode)
if (!Environment.isFileProtocol) {
    // Add manifest link dynamically (avoids CORS error in file:// mode)
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = 'manifest.json';
    document.head.appendChild(manifestLink);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('[App] Service Worker registered:', registration.scope);
                })
                .catch(error => {
                    console.warn('[App] Service Worker registration failed:', error);
                });
        });
    }
}

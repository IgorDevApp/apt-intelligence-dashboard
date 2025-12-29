# Changelog

All notable changes to the APT Intelligence Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-01

### Added
- **Multi-source data aggregation** - Fetches from 7+ threat intelligence sources
- **MISP Galaxy integration** - 864 threat actors with full profiles
- **APTnotes integration** - 689 intelligence reports linked to actors
- **MITRE ATT&CK integration** - TTPs mapped to threat actors
- **ETDA Thailand integration** - Accurate first-seen/last-seen dates
- **Malpedia integration** - Extended alias mappings
- **Google Cloud Threat Intel** - APT enrichment data
- **APTMalware IOCs** - Malware sample hashes

### Features
- **Global Threat Map** - Interactive D3.js world map with country flags
- **Chronological Timeline** - Visual timeline from 1990-present
- **Actor Dossier Modal** - Detailed intelligence profiles
- **Report Detail Modal** - Click reports to see details and linked actors
- **Advanced Search** - Search across actors, aliases, and descriptions
- **Multi-filter Support** - Filter by country, sector, state-sponsored
- **MITRE Techniques Display** - Grouped by tactic in actor dossiers
- **Source Attribution** - Hover to see data source for any field
- **Fast Startup Mode** - Progressive loading with background enrichment
- **Year Extraction** - Fallback year detection from descriptions

### Technical
- **Smart Caching** - IndexedDB with configurable TTL
- **CORS Proxy Fallback** - Automatic proxy for restricted sources
- **Offline Support** - Works from file:// protocol with cached data
- **Accessibility** - Screen reader support, keyboard navigation
- **Responsive Design** - Mobile-friendly layout

## [Unreleased]

### Planned
- Export to CSV/JSON functionality
- Custom threat actor notes
- Comparison view for multiple actors
- API endpoint for external integrations
- Dark/light theme toggle


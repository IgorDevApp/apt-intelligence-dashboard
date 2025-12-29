# Security Policy

## About This Project

The APT Intelligence Dashboard is a **client-side application** that aggregates publicly available threat intelligence data. It does not collect, store, or transmit any user data.

## Data Sources

All threat intelligence data is fetched from **public sources**:
- GitHub repositories (MISP, APTnotes, MITRE ATT&CK, APTMalware)
- Public threat intelligence websites (ETDA, Malpedia)

**No sensitive or classified information is included.**

## Reporting Security Issues

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainers directly with details
3. Allow reasonable time for a fix before public disclosure

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Security Considerations

### Client-Side Only
- All data processing happens in the browser
- No server-side code or database
- No user authentication or sessions

### Data Caching
- Data is cached in browser's IndexedDB
- Cache is local to the user's browser
- No data is sent to external servers (except to fetch source data)

### CORS Proxies
When running via HTTP, the dashboard may use public CORS proxies to fetch data from sources that don't support CORS:
- `api.allorigins.win`
- `corsproxy.io`

These proxies only relay the request - no data is stored.

## Disclaimer

This tool is for **educational and research purposes**. The threat intelligence data comes from public sources and may contain:
- Inaccuracies or outdated information
- Disputed attributions
- Incomplete data

**Always verify information through official channels before making security decisions.**


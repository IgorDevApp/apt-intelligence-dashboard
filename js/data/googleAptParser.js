/**
 * APT Intelligence Dashboard - Google Cloud APT Data Parser
 * 
 * Parses APT group data from Google Cloud Security Insights.
 * This data provides rich descriptions, target sectors, attack vectors,
 * and associated malware for major APT groups.
 * 
 * @module googleAptParser
 * @version 1.0.0
 */

const GoogleAptParser = (function() {
    'use strict';

    // =========================================================================
    // PARSED DATA (extracted from Google Cloud APT Groups page)
    // =========================================================================

    /**
     * Pre-parsed APT data from Google Cloud Security Insights
     * Source: https://cloud.google.com/security/resources/insights/apt-groups
     * 
     * This data is embedded rather than fetched because the source is HTML
     * and requires parsing. The data is relatively static (APT profiles don't
     * change frequently).
     */
    const APT_DATA = [
        {
            name: "APT41",
            aliases: ["Double Dragon", "Wicked Panda", "Winnti Group"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Healthcare", "Telecommunications", "High-tech", "Video game industry", "Higher education", "Travel services", "News/Media"],
            overview: "APT41 is a prolific cyber threat group that carries out Chinese state-sponsored espionage activity in addition to financially motivated activity potentially outside of state control.",
            associatedMalware: ["At least 46 different code families and tools"],
            attackVectors: ["Spear phishing emails with attachments (compiled HTML .chm files)", "Custom backdoors", "Credential stealers", "Keyloggers", "Rootkits", "MBR bootkits"],
            resources: ["https://cloud.google.com/blog/topics/threat-intelligence/apt41-dual-espionage-and-cyber-crime-operation"]
        },
        {
            name: "APT40",
            aliases: ["Leviathan", "TEMP.Periscope", "TEMP.Jumper"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Maritime", "Defense", "Aviation", "Chemicals", "Research/Education", "Government", "Technology", "Engineering"],
            overview: "APT40's operations are a cyber counterpart to China's efforts to modernize its naval capabilities. The group's operations tend to target government-sponsored projects and take large amounts of information specific to such projects.",
            associatedMalware: ["BADSIGN", "FIELDGOAL", "FINDLOCK", "PHOTO", "SCANBOX", "SOGU", "WIDETONE", "At least 51 different code families"],
            attackVectors: ["Spear phishing posing as journalists or trade publication individuals", "Compromised email accounts", "Military/NGO impersonation"],
            resources: ["https://cloud.google.com/blog/topics/threat-intelligence/apt40-examining-a-china-nexus-espionage-actor"]
        },
        {
            name: "APT31",
            aliases: ["Zirconium", "Judgment Panda"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Government", "International financial organizations", "Aerospace", "Defense", "High tech", "Construction", "Engineering", "Telecommunications", "Media", "Insurance"],
            overview: "APT31 is a China-nexus cyber espionage actor focused on obtaining information that can provide the Chinese government and state-owned enterprises with political, economic, and military advantages.",
            associatedMalware: ["SOGU", "LUCKYBIRD", "SLOWGYRO", "DUCKFAT"],
            attackVectors: ["Exploitation of vulnerabilities in Java and Adobe Flash"],
            resources: []
        },
        {
            name: "APT30",
            aliases: [],
            country: "CN",
            attribution: "China",
            targetSectors: ["ASEAN member nations", "Government", "Media", "Journalists"],
            overview: "APT30 is noted for sustained activity over a long period of time and successfully modifying and adapting source code to maintain the same tools, tactics, and infrastructure since at least 2005. The group has had the capability to infect air-gapped networks since 2005.",
            associatedMalware: ["SHIPSHAPE", "SPACESHIP", "FLASHFLOOD"],
            attackVectors: ["Downloaders", "Backdoors", "Removable drive infection", "Air-gap crossing techniques", "Custom DNS domains for C2"],
            resources: []
        },
        {
            name: "APT27",
            aliases: ["Emissary Panda", "Iron Tiger", "LuckyMouse", "Bronze Union"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Business services", "High tech", "Government", "Energy", "Aerospace", "Transport", "Travel"],
            overview: "APT27 engages in cyber operations where the goal is intellectual property theft, usually focusing on the data and projects that make a particular organization competitive within its field.",
            associatedMalware: ["PANDORA", "SOGU", "ZXSHELL", "GHOST", "WIDEBERTH", "QUICKPULSE", "FLOWERPOT"],
            attackVectors: ["Spear phishing", "Public exploit adoption", "Compromised email accounts", "Vulnerable web applications"],
            resources: []
        },
        {
            name: "APT26",
            aliases: [],
            country: "CN",
            attribution: "China",
            targetSectors: ["Aerospace", "Defense", "Energy"],
            overview: "APT26 engages in cyber operations where the goal is intellectual property theft, usually focusing on the data and projects that make a particular organization competitive within its field.",
            associatedMalware: ["SOGU", "HTRAN", "POSTSIZE", "TWOCHAINS", "BEACON"],
            attackVectors: ["Strategic web compromises (watering holes)", "Custom backdoors"],
            resources: []
        },
        {
            name: "APT25",
            aliases: ["Uncool", "Vixen Panda", "Ke3chang", "Sushi Roll", "Tor"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Defense industrial base", "Media", "Financial services", "Transportation"],
            overview: "APT25 engages in cyber operations focused on intellectual property theft targeting defense and government sectors.",
            associatedMalware: ["LINGBO", "PLAYWORK", "MADWOFL", "MIRAGE", "TOUGHROW", "TOYSNAKE", "SABERTOOTH"],
            attackVectors: ["Spear phishing", "Zero-day exploits"],
            resources: []
        },
        {
            name: "APT19",
            aliases: ["Codoso", "C0d0so0", "Sunshop Group"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Legal", "Investment", "Defense"],
            overview: "APT19 is a Chinese-based threat group that has targeted a variety of industries, including defense, finance, energy, pharmaceutical, telecommunications, high tech, education, manufacturing, and legal services.",
            associatedMalware: ["BEACON", "COBALTSTRIKE"],
            attackVectors: ["Spear phishing with RTF attachments", "Strategic web compromises", "Zero-day exploits"],
            resources: []
        },
        {
            name: "APT18",
            aliases: ["Wekby", "Dynamite Panda", "TG-0416"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Aerospace", "Defense", "Construction", "Education", "Health and biotechnology", "High tech", "Telecommunications", "Transportation"],
            overview: "APT18 is a threat group that has operated since at least 2009 and has targeted organizations across multiple sectors.",
            associatedMalware: ["Gh0st RAT", "HTTPBrowser", "pisloader"],
            attackVectors: ["Zero-day exploits in Flash", "Strategic web compromises", "Spear phishing"],
            resources: []
        },
        {
            name: "APT17",
            aliases: ["Tailgater Team", "Deputy Dog", "Hidden Lynx"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Government", "Defense", "Law firms", "IT companies", "Mining companies", "NGOs"],
            overview: "APT17 is a China-based threat group that has conducted network intrusions against US government entities, the defense industry, law firms, information technology companies, mining companies, and NGOs.",
            associatedMalware: ["BLACKCOFFEE", "DEPUTY DOG"],
            attackVectors: ["Zero-day exploits", "Strategic web compromises", "Legitimate websites for C2"],
            resources: []
        },
        {
            name: "APT16",
            aliases: [],
            country: "CN",
            attribution: "China",
            targetSectors: ["Japanese and Taiwanese organizations in high-tech, government, media, and financial services"],
            overview: "APT16 is a China-based threat group that has launched spear phishing campaigns targeting Japanese and Taiwanese organizations.",
            associatedMalware: ["ELMER", "IRONHALO", "QUICKBALL"],
            attackVectors: ["Spear phishing with Microsoft Word document exploits"],
            resources: []
        },
        {
            name: "APT15",
            aliases: ["Ke3chang", "Mirage", "Vixen Panda", "Playful Dragon"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Energy", "Government", "Defense", "Military"],
            overview: "APT15 is a China-based threat group that has conducted cyber espionage operations against global targets for over a decade.",
            associatedMalware: ["ENFAL", "NOISEMAKER", "MIRAGE"],
            attackVectors: ["Spear phishing", "Strategic web compromises"],
            resources: []
        },
        {
            name: "APT12",
            aliases: ["IXESHE", "DynCalc", "Numbered Panda", "DNSCALC"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Journalists", "Government", "Defense"],
            overview: "APT12 is a threat group that has been attributed to China. The group has targeted a variety of victims including but not limited to media outlets, high-tech companies, and multiple governments.",
            associatedMalware: ["RIPTIDE", "HIGHTIDE", "THREEBYTE", "WATERSPOUT"],
            attackVectors: ["Spear phishing with exploit-laden documents", "Strategic web compromises"],
            resources: []
        },
        {
            name: "APT10",
            aliases: ["MenuPass", "Stone Panda", "Red Apollo", "CVNX", "POTASSIUM", "Cloud Hopper"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Construction", "Engineering", "Aerospace", "Telecom", "Government", "Healthcare", "MSPs (Managed Service Providers)"],
            overview: "APT10 is a Chinese cyber espionage group that has been active since at least 2006. The group is known for its 'Cloud Hopper' campaign targeting managed service providers.",
            associatedMalware: ["HAYMAKER", "SNUGRIDE", "BUGJUICE", "QUASARRAT", "REDLEAVES", "PLUGX"],
            attackVectors: ["Spear phishing", "MSP compromise for supply chain attacks"],
            resources: []
        },
        {
            name: "APT5",
            aliases: [],
            country: "CN",
            attribution: "China",
            targetSectors: ["Telecommunications", "Technology", "High-tech manufacturing", "Military technology"],
            overview: "APT5 has been active since at least 2007 with focus on telecommunications and technology companies, especially information about satellite communications. The group has capabilities to modify router firmware and embedded operating systems.",
            associatedMalware: ["BRIGHTCREST", "SWEETCOLA", "SPIRITBOX", "PALEJAB", "LEOUNCIA", "Poison Ivy"],
            attackVectors: ["Keylogging", "Network device compromise", "Router image modification"],
            resources: []
        },
        {
            name: "APT4",
            aliases: ["Maverick Panda", "Sykipot Group", "Wisp"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Aerospace", "Defense", "Industrial engineering", "Electronics", "Automotive", "Government", "Telecommunications", "Transportation"],
            overview: "APT4 targets the defense industrial base (DIB) at a higher rate of frequency than other commercial organizations.",
            associatedMalware: ["GETKYS", "LIFESAVER", "CCHIP", "SHYLILT", "SWEETTOOTH", "PHOTO", "SOGO"],
            attackVectors: ["Spear phishing with US government/DoD themes"],
            resources: []
        },
        {
            name: "APT3",
            aliases: ["UPS Team", "Gothic Panda", "Pirpi", "Buckeye"],
            country: "CN",
            attribution: "China",
            targetSectors: ["Aerospace", "Defense", "Construction", "Engineering", "High tech", "Telecommunications", "Transportation"],
            overview: "APT3 is one of the more sophisticated threat groups with a history of using browser-based exploits as zero-days. Their C2 infrastructure is difficult to track with little overlap across campaigns.",
            associatedMalware: ["SHOTPUT", "COOKIECUTTER", "SOGU"],
            attackVectors: ["Zero-day exploits (IE, Firefox, Flash)", "Spear phishing", "ROP techniques to bypass DEP/ASLR"],
            resources: ["https://www.mandiant.com/resources/blog/demonstrating-hustle", "https://www.mandiant.com/resources/blog/operation-clandestine-wolf-adobe-flash-zero-day"]
        },
        {
            name: "APT2",
            aliases: [],
            country: "CN",
            attribution: "China",
            targetSectors: ["Military", "Aerospace"],
            overview: "This group was first observed in 2010. APT2 engages in cyber operations where the goal is intellectual property theft.",
            associatedMalware: ["MOOSE", "WARP"],
            attackVectors: ["Spear phishing exploiting CVE-2012-0158"],
            resources: []
        },
        {
            name: "APT1",
            aliases: ["Unit 61398", "Comment Crew", "Comment Panda", "PLA Unit 61398"],
            country: "CN",
            attribution: "China's People's Liberation Army (PLA) General Staff Department's 3rd Department, Unit 61398",
            targetSectors: ["Information technology", "Aerospace", "Public administration", "Satellites", "Telecommunications", "Scientific research", "Energy", "Transportation", "Construction", "Manufacturing", "Engineering services", "High-tech electronics", "Legal services", "Media", "Healthcare", "Education", "Financial services"],
            overview: "APT1 has systematically stolen hundreds of terabytes of data from at least 141 organizations. The group focuses on compromising organizations across a broad range of industries in English-speaking countries. The size of APT1's infrastructure implies a large organization with at least dozens, but potentially hundreds of human operators.",
            associatedMalware: ["TROJAN.ECLTYS", "BACKDOOR.BARKIOFORK", "BACKDOOR.WAKEMINAP", "TROJAN.DOWNBOT", "BACKDOOR.DALBOT", "BACKDOOR.REVIRD", "TROJAN.BADNAME", "BACKDOOR.WUALESS"],
            attackVectors: ["Spear phishing with malicious attachments or hyperlinks", "Custom backdoors", "Long-term persistent access"],
            resources: []
        },
        {
            name: "APT28",
            aliases: ["Fancy Bear", "Sofacy", "Sednit", "Pawn Storm", "STRONTIUM", "Tsar Team", "Forest Blizzard"],
            country: "RU",
            attribution: "Russia (GRU Unit 26165)",
            targetSectors: ["Government", "Military", "Defense", "Media", "Energy", "Political organizations", "Olympic organizations"],
            overview: "APT28 is a threat group attributed to Russia's General Staff Main Intelligence Directorate (GRU) 85th Main Special Service Center (GTsSS) military unit 26165. The group has been active since at least 2004 and conducts operations aligned with Russian government interests.",
            associatedMalware: ["CHOPSTICK", "CORESHELL", "GAMEFISH", "SOURFACE", "EVILTOSS", "HIDEDRV", "X-Agent", "X-Tunnel"],
            attackVectors: ["Spear phishing", "Zero-day exploits", "Credential harvesting", "Strategic web compromises"],
            resources: []
        },
        {
            name: "APT29",
            aliases: ["Cozy Bear", "The Dukes", "Midnight Blizzard", "NOBELIUM", "YTTRIUM"],
            country: "RU",
            attribution: "Russia (SVR - Foreign Intelligence Service)",
            targetSectors: ["Government", "Diplomatic", "Think tanks", "Healthcare", "Energy", "Technology"],
            overview: "APT29 is a threat group attributed to Russia's Foreign Intelligence Service (SVR). The group has been active since at least 2008 and has targeted government networks in Europe and NATO member countries.",
            associatedMalware: ["HAMMERTOSS", "SUNBURST", "TEARDROP", "RAINDROP", "Cobalt Strike"],
            attackVectors: ["Spear phishing", "Supply chain attacks (SolarWinds)", "Credential abuse", "Cloud service exploitation"],
            resources: []
        },
        {
            name: "Sandworm",
            aliases: ["Voodoo Bear", "IRIDIUM", "Seashell Blizzard", "ELECTRUM", "Telebots"],
            country: "RU",
            attribution: "Russia (GRU Unit 74455)",
            targetSectors: ["Energy", "Government", "Media", "Industrial control systems", "Elections"],
            overview: "Sandworm is a destructive threat group attributed to Russia's GRU Unit 74455. The group is known for destructive attacks including NotPetya and attacks on Ukrainian power grid.",
            associatedMalware: ["BlackEnergy", "Industroyer", "NotPetya", "Olympic Destroyer", "VPNFilter"],
            attackVectors: ["Destructive malware", "ICS/SCADA targeting", "Supply chain attacks", "Wiper malware"],
            resources: []
        },
        {
            name: "APT33",
            aliases: ["Elfin", "Magnallium", "Refined Kitten", "Holmium"],
            country: "IR",
            attribution: "Iran",
            targetSectors: ["Aerospace", "Energy", "Petrochemical", "Defense"],
            overview: "APT33 is an Iranian threat group that has conducted operations since at least 2013. The group shows particular interest in organizations in the aviation and energy sectors.",
            associatedMalware: ["DROPSHOT", "SHAPESHIFT", "TURNEDUP", "NANOCORE", "NETWIRE"],
            attackVectors: ["Spear phishing", "Domain masquerading", "Password spraying"],
            resources: []
        },
        {
            name: "APT34",
            aliases: ["OilRig", "Helix Kitten", "Crambus", "Hazel Sandstorm"],
            country: "IR",
            attribution: "Iran",
            targetSectors: ["Financial", "Government", "Energy", "Chemical", "Telecommunications"],
            overview: "APT34 is an Iranian threat group that has been active since at least 2014. The group conducts cyber espionage focused on reconnaissance efforts to benefit Iranian nation-state interests.",
            associatedMalware: ["POWRUNER", "BONDUPDATER", "REMEXI", "OopsIE", "QUADAGENT"],
            attackVectors: ["Spear phishing", "Social engineering", "Strategic web compromises"],
            resources: []
        },
        {
            name: "APT35",
            aliases: ["Charming Kitten", "Phosphorus", "Newscaster", "Ajax Security Team", "Mint Sandstorm"],
            country: "IR",
            attribution: "Iran (IRGC)",
            targetSectors: ["Government", "Defense", "Technology", "Media", "Academia", "Dissidents"],
            overview: "APT35 is an Iranian threat group attributed to the Islamic Revolutionary Guard Corps (IRGC). The group targets dissidents, academics, diplomats, and journalists.",
            associatedMalware: ["POWERSTAR", "HYPERSCRAPE", "DownPaper"],
            attackVectors: ["Spear phishing", "Social media reconnaissance", "Credential harvesting", "Fake personas"],
            resources: []
        },
        {
            name: "APT37",
            aliases: ["Reaper", "Group123", "ScarCruft", "Venus 121", "Ricochet Chollima"],
            country: "KP",
            attribution: "North Korea",
            targetSectors: ["Government", "Military", "Defense", "Media", "Aerospace", "Defectors"],
            overview: "APT37 is a North Korean state-sponsored threat group that has been active since at least 2012. The group primarily targets South Korea but has expanded operations globally.",
            associatedMalware: ["DOGCALL", "HAPPYWORK", "KARAE", "POORAIM", "SHUTTERSPEED", "SLOWDRIFT", "ZUMKONG"],
            attackVectors: ["Spear phishing", "Strategic web compromises", "Zero-day exploits", "Torrent file poisoning"],
            resources: []
        },
        {
            name: "APT38",
            aliases: ["Bluenoroff", "Stardust Chollima"],
            country: "KP",
            attribution: "North Korea",
            targetSectors: ["Financial institutions", "Banks", "Cryptocurrency exchanges", "SWIFT network"],
            overview: "APT38 is a North Korean state-sponsored threat group that specializes in financial cyber operations. The group has been attributed to the Bangladesh Bank heist and other major financial crimes.",
            associatedMalware: ["DYEPACK", "HERMES", "NACHOCHEESE", "QUICKCAFE", "RAWHIDE", "SMOOTHRIDE"],
            attackVectors: ["Watering holes", "Spear phishing", "SWIFT network abuse", "Cryptocurrency theft"],
            resources: []
        },
        {
            name: "Lazarus Group",
            aliases: ["Hidden Cobra", "Guardians of Peace", "ZINC", "Diamond Sleet", "Labyrinth Chollima"],
            country: "KP",
            attribution: "North Korea (RGB - Reconnaissance General Bureau)",
            targetSectors: ["Entertainment", "Financial", "Defense", "Technology", "Cryptocurrency", "Government"],
            overview: "Lazarus Group is a North Korean state-sponsored threat group attributed to the Reconnaissance General Bureau. The group has been active since at least 2009 and is known for the Sony Pictures hack and WannaCry ransomware.",
            associatedMalware: ["BISTROMATH", "CROWDEDFLOUNDER", "HOPLIGHT", "WannaCry", "FALLCHILL"],
            attackVectors: ["Spear phishing", "Supply chain attacks", "Watering holes", "Cryptocurrency exchange attacks"],
            resources: []
        },
        {
            name: "APT39",
            aliases: ["Chafer", "Remix Kitten", "Radio Serpens"],
            country: "IR",
            attribution: "Iran (MOIS - Ministry of Intelligence)",
            targetSectors: ["Telecommunications", "Travel", "IT", "Government"],
            overview: "APT39 is an Iranian threat group focused on personal information and supports monitoring, tracking, or surveillance operations that serve Iran's national priorities.",
            associatedMalware: ["SEAWEED", "CACHEMONEY", "POWBAT"],
            attackVectors: ["Spear phishing", "Credential theft", "Web shells", "Custom backdoors"],
            resources: []
        },
        {
            name: "APT42",
            aliases: ["Calanque", "UNC788"],
            country: "IR",
            attribution: "Iran (IRGC-IO - Intelligence Organization)",
            targetSectors: ["Education", "Government", "Healthcare", "Legal", "Manufacturing", "Media", "Pharmaceutical", "Policy organizations", "Dissidents"],
            overview: "APT42 is an Iranian state-sponsored threat group conducting highly targeted spear-phishing and surveillance operations against individuals and organizations of strategic interest to Iran.",
            associatedMalware: ["VINETHORN", "PINEFLOWER", "BROKEYOLK", "TABBYCAT", "VAPORRAGE"],
            attackVectors: ["Spear phishing", "Social engineering", "Credential harvesting", "Mobile malware deployment"],
            resources: []
        },
        {
            name: "APT43",
            aliases: ["Kimsuky", "Velvet Chollima", "Thallium", "Black Banshee"],
            country: "KP",
            attribution: "North Korea (RGB)",
            targetSectors: ["Government", "Education", "Research", "Policy institutes", "Think tanks"],
            overview: "APT43 is a North Korean threat group supporting intelligence collection aligned with the regime's interests. The group focuses on South Korea, Japan, and the United States.",
            associatedMalware: ["BabyShark", "AppleSeed", "PENCILDOWN", "LOGCABIN"],
            attackVectors: ["Spear phishing", "Credential harvesting", "Social engineering via fake personas"],
            resources: []
        },
        {
            name: "UNC2452",
            aliases: ["NOBELIUM", "StellarParticle", "Dark Halo"],
            country: "RU",
            attribution: "Russia",
            targetSectors: ["Government", "Technology", "Consulting", "Telecommunications"],
            overview: "UNC2452 is the threat group responsible for the SolarWinds supply chain compromise discovered in December 2020. The group demonstrated sophisticated operational security and targeting of cloud resources.",
            associatedMalware: ["SUNBURST", "TEARDROP", "SUNSPOT", "RAINDROP", "SIBOT"],
            attackVectors: ["Supply chain compromise", "Cloud service abuse", "Token theft", "SAML forgery"],
            resources: []
        },
        {
            name: "FIN7",
            aliases: ["Carbanak", "Navigator Group", "Carbon Spider"],
            country: "RU",
            attribution: "Russia (Cybercrime)",
            targetSectors: ["Retail", "Restaurant", "Hospitality", "Financial services"],
            overview: "FIN7 is a financially-motivated threat group that has been active since 2013. The group has targeted the U.S. retail, restaurant, and hospitality sectors extensively.",
            associatedMalware: ["CARBANAK", "BELLHOP", "BOOSTWRITE", "GRIFFON", "PILLOWMINT"],
            attackVectors: ["Spear phishing", "Malicious USB devices", "Point-of-sale malware"],
            resources: []
        }
    ];

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        /**
         * Gets all parsed APT data
         * @returns {Array} Array of APT group objects
         */
        getData: function() {
            return APT_DATA;
        },

        /**
         * Gets APT data by name
         * @param {string} name - APT name to search for
         * @returns {Object|null} APT data object or null
         */
        getByName: function(name) {
            const normalizedName = name.toLowerCase().replace(/[\s\-_]/g, '');
            return APT_DATA.find(apt => {
                const aptName = apt.name.toLowerCase().replace(/[\s\-_]/g, '');
                if (aptName === normalizedName) return true;
                
                // Check aliases
                if (apt.aliases && apt.aliases.some(alias => 
                    alias.toLowerCase().replace(/[\s\-_]/g, '') === normalizedName
                )) return true;
                
                return false;
            }) || null;
        },

        /**
         * Gets APT data by country code
         * @param {string} countryCode - ISO 2-letter country code
         * @returns {Array} Array of APT data objects from that country
         */
        getByCountry: function(countryCode) {
            const code = countryCode.toUpperCase();
            return APT_DATA.filter(apt => apt.country === code);
        },

        /**
         * Gets all unique target sectors across all APT groups
         * @returns {Array} Array of sector names
         */
        getAllSectors: function() {
            const sectors = new Set();
            APT_DATA.forEach(apt => {
                apt.targetSectors.forEach(sector => sectors.add(sector));
            });
            return Array.from(sectors).sort();
        },

        /**
         * Gets APT groups that target a specific sector
         * @param {string} sector - Sector name to search for
         * @returns {Array} Array of APT data objects
         */
        getBySector: function(sector) {
            const normalizedSector = sector.toLowerCase();
            return APT_DATA.filter(apt => 
                apt.targetSectors.some(s => 
                    s.toLowerCase().includes(normalizedSector)
                )
            );
        },

        /**
         * Gets count of APT groups by country
         * @returns {Object} Country code to count mapping
         */
        getCountryStats: function() {
            const stats = {};
            APT_DATA.forEach(apt => {
                stats[apt.country] = (stats[apt.country] || 0) + 1;
            });
            return stats;
        },

        /**
         * Gets total number of APT groups in dataset
         * @returns {number}
         */
        getCount: function() {
            return APT_DATA.length;
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleAptParser;
}

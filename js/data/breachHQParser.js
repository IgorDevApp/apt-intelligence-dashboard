/**
 * Breach-HQ Actor Parser
 * 
 * Parses and provides enrichment data from Breach-HQ.
 * Source: https://breach-hq.com/threat-actors
 * 
 * Provides threat type classification, confidence levels, and vendor-attributed aliases.
 * 
 * @version 1.0.0
 */

const BreachHQParser = (function() {
    'use strict';

    // Pre-parsed Breach-HQ actor data
    // Format: { name, country, threatType, confidence, aliases[] }
    const BREACHHQ_ACTORS = [
        {
            name: "LockBit",
            country: "RU",
            threatType: "Organized Crime",
            confidence: "Unknown",
            aliases: []
        },
        {
            name: "RansomHub",
            country: "Unknown",
            threatType: "Organized Crime",
            confidence: "Low",
            aliases: ["Cyclops", "Knight"]
        },
        {
            name: "IntelBroker",
            country: "Unknown",
            threatType: "Cyber Terrorists",
            confidence: "High",
            aliases: []
        },
        {
            name: "ALPHV",
            country: "RU",
            threatType: "Ransomware Gang",
            confidence: "High",
            aliases: ["BlackCat"]
        },
        {
            name: "BlackSuit",
            country: "Unknown",
            threatType: "Ransomware Gang",
            confidence: "Unknown",
            aliases: ["Royal Ransomware", "Conti"]
        },
        {
            name: "Rhysida",
            country: "Unknown",
            threatType: "Ransomware Gang",
            confidence: "High",
            aliases: []
        },
        {
            name: "Akira",
            country: "Unknown",
            threatType: "Cyber Terrorists",
            confidence: "High",
            aliases: []
        },
        {
            name: "APT28",
            country: "RU",
            threatType: "APT",
            confidence: "High",
            aliases: ["TA422", "BlueDelta", "Sofacy", "Fancy Bear", "Strontium", "Forest Blizzard", "G0007", "ITG05", "Iron Twilight", "TG-4127", "Blue Athena", "ATK5", "Swallowtail", "T-APT-12", "APT-C-20", "Pawn Storm", "Sednit", "Group74", "Fighting Ursa", "Tsar Team", "Grizzly Steppe", "Snakemackerel", "SIG40", "UAC-0028", "Frozenlake"]
        },
        {
            name: "Sp1d3r",
            country: "Unknown",
            threatType: "Organized Crime",
            confidence: "Low",
            aliases: []
        },
        {
            name: "LAPSUS$",
            country: "Worldwide",
            threatType: "Organized Crime",
            confidence: "High",
            aliases: ["UNC3661", "Slippy Spider", "DEV-0537", "Strawberry Tempest", "Gold Rainforest", "White Dev 111"]
        },
        {
            name: "Cl0p",
            country: "Other",
            threatType: "Cybercrime",
            confidence: "Unknown",
            aliases: []
        },
        {
            name: "UNC5537",
            country: "Worldwide",
            threatType: "Organized Crime",
            confidence: "High",
            aliases: []
        },
        {
            name: "Scattered Spider",
            country: "Worldwide",
            threatType: "Organized Crime",
            confidence: "High",
            aliases: ["UNC3944", "Scatter Swine", "DEV-0875", "Roasted 0ktapus"]
        },
        {
            name: "Qilin",
            country: "RU",
            threatType: "Organized Crime",
            confidence: "High",
            aliases: ["Agenda"]
        },
        {
            name: "Vice Society",
            country: "Worldwide",
            threatType: "Organized Crime",
            confidence: "High",
            aliases: ["Vice Spider", "DEV-0832", "Vanilla Tempest", "Gold Victor"]
        },
        {
            name: "ShinyHunters",
            country: "Unknown",
            threatType: "Organized Crime",
            confidence: "High",
            aliases: ["White Dev 100"]
        },
        {
            name: "BianLian",
            country: "CN",
            threatType: "Organized Crime",
            confidence: "Mid",
            aliases: []
        },
        {
            name: "FamousSparrow",
            country: "CN",
            threatType: "APT",
            confidence: "Mid",
            aliases: ["Earth Estries", "Salt Typhoon", "GhostEmperor"]
        },
        {
            name: "SN_BlackMeta",
            country: "Unknown",
            threatType: "Ransomware Gang",
            confidence: "Unknown",
            aliases: []
        },
        {
            name: "Monti",
            country: "Unknown",
            threatType: "Ransomware Gang",
            confidence: "High",
            aliases: []
        },
        {
            name: "BlackByte",
            country: "RU",
            threatType: "Ransomware Gang",
            confidence: "Unknown",
            aliases: []
        },
        {
            name: "BlackBasta",
            country: "Unknown",
            threatType: "Organized Crime",
            confidence: "Unknown",
            aliases: []
        },
        {
            name: "APT38",
            country: "KP",
            threatType: "APT",
            confidence: "High",
            aliases: ["UNC1758", "UNC1069", "UNC4736", "TA444", "Bluenoroff", "Stardust Chollima", "Copernicium", "Sapphire Sleet", "G0082", "G0032", "ITG03", "Hive0080", "Nickel Gladstone", "CTG-6459", "Lazarus", "Black Dev 2", "ATK117", "T-APT-15", "APT-C-26", "Klipodenc", "SectorA01", "Group77", "BeagleBoyz", "TAG-71", "Lazarus Group", "NESTEGG"]
        },
        {
            name: "APT29",
            country: "RU",
            threatType: "APT",
            confidence: "High",
            aliases: ["Cozy Bear", "The Dukes", "NOBELIUM", "Midnight Blizzard", "YTTRIUM", "Iron Hemlock", "G0016", "ITG11", "Iron Ritual", "ATK7", "Cloaked Ursa", "TA421", "Dark Halo", "StellarParticle", "BlueBravo", "UNC2452", "NobleBaron", "Grizzly Steppe"]
        },
        {
            name: "APT33",
            country: "IR",
            threatType: "APT",
            confidence: "High",
            aliases: ["Elfin", "Holmium", "MAGNALLIUM", "Peach Sandstorm", "G0064", "Refined Kitten", "ATK35", "TA451"]
        },
        {
            name: "APT41",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Double Dragon", "Wicked Panda", "BARIUM", "Brass Typhoon", "G0096", "Wicked Spider", "ATK91", "TA415", "Winnti", "TG-2633", "Blackfly", "Red Kelpie", "Earth Baku"]
        },
        {
            name: "APT1",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Comment Crew", "Comment Panda", "PLA Unit 61398", "Byzantine Candor", "G0006", "TG-8223", "Brown Fox", "GIF89a"]
        },
        {
            name: "Lazarus Group",
            country: "KP",
            threatType: "APT",
            confidence: "High",
            aliases: ["Hidden Cobra", "Zinc", "Diamond Sleet", "Labyrinth Chollima", "G0032", "ATK3", "TA404", "UNC577", "Bureau 121", "Unit 121", "Guardians of Peace", "NICKEL ACADEMY", "Appleworm", "APT-C-26"]
        },
        {
            name: "Turla",
            country: "RU",
            threatType: "APT",
            confidence: "High",
            aliases: ["Snake", "Venomous Bear", "Waterbug", "Uroburos", "KRYPTON", "Secret Blizzard", "G0010", "ITG12", "Iron Hunter", "ATK13", "Blue Python", "Pacifier APT", "SIG23", "UAC-0003"]
        },
        {
            name: "Sandworm",
            country: "RU",
            threatType: "APT",
            confidence: "High",
            aliases: ["Voodoo Bear", "IRIDIUM", "Seashell Blizzard", "Telebots", "G0034", "Iron Viking", "ATK14", "Electrum", "Quedagh", "BE2 APT", "UAC-0082", "Blue Echidna"]
        },
        {
            name: "Kimsuky",
            country: "KP",
            threatType: "APT",
            confidence: "High",
            aliases: ["Velvet Chollima", "Emerald Sleet", "THALLIUM", "G0086", "Black Banshee", "ATK77", "TA406", "Springtail", "SectorA05", "APT43"]
        },
        {
            name: "MuddyWater",
            country: "IR",
            threatType: "APT",
            confidence: "High",
            aliases: ["MERCURY", "Mango Sandstorm", "Seedworm", "Static Kitten", "G0069", "ATK51", "TA450", "TEMP.Zagros", "Boggy Serpens", "Yellow Nix"]
        },
        {
            name: "Charming Kitten",
            country: "IR",
            threatType: "APT",
            confidence: "High",
            aliases: ["APT35", "PHOSPHORUS", "Mint Sandstorm", "TA453", "G0059", "ITG18", "Newscaster", "NewsBeef", "ATK40", "Cobalt Illusion", "Yellow Garuda"]
        },
        {
            name: "OilRig",
            country: "IR",
            threatType: "APT",
            confidence: "High",
            aliases: ["APT34", "Helix Kitten", "Hazel Sandstorm", "EUROPIUM", "G0049", "Crambus", "Chrysene", "ITG13", "Cobalt Gypsy", "TA452", "GreenBug", "Yellow Maero"]
        },
        {
            name: "APT10",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Stone Panda", "menuPass", "Red Apollo", "POTASSIUM", "G0045", "Cicada", "TA429", "Cloud Hopper", "ATK41", "BRONZE RIVERSIDE", "CVNX"]
        },
        {
            name: "APT32",
            country: "VN",
            threatType: "APT",
            confidence: "High",
            aliases: ["OceanLotus", "Ocean Buffalo", "Canvas Cyclone", "SeaLotus", "G0050", "ATK17", "Cobalt Kitty", "APT-C-00", "TIN WOODLAWN"]
        },
        {
            name: "APT37",
            country: "KP",
            threatType: "APT",
            confidence: "High",
            aliases: ["Reaper", "ScarCruft", "Ricochet Chollima", "Ruby Sleet", "G0067", "Group123", "TEMP.Reaper", "Red Eyes", "ATK4", "InkySquid", "Venus 121"]
        },
        {
            name: "APT27",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Emissary Panda", "LuckyMouse", "Iron Tiger", "Silk Typhoon", "G0027", "Bronze Union", "ATK15", "TA428", "TG-3390", "Budworm"]
        },
        {
            name: "APT40",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Leviathan", "Kryptonite Panda", "Gingham Typhoon", "GADOLINIUM", "G0065", "BRONZE MOHAWK", "ATK29", "TA423", "TEMP.Periscope", "TEMP.Jumper", "Red Ladon"]
        },
        {
            name: "Gamaredon",
            country: "RU",
            threatType: "APT",
            confidence: "High",
            aliases: ["Primitive Bear", "ACTINIUM", "Aqua Blizzard", "Shuckworm", "G0047", "Armageddon", "ATK91", "DEV-0157", "UAC-0010", "Winterflounder", "BlueAlpha", "IRON TILDEN"]
        },
        {
            name: "Patchwork",
            country: "IN",
            threatType: "APT",
            confidence: "Mid",
            aliases: ["Dropping Elephant", "MONSOON", "Quilted Tiger", "G0040", "ATK11", "Chinastrats", "APT-C-09", "Orange Atropos", "Zinc Emerson"]
        },
        {
            name: "SideWinder",
            country: "IN",
            threatType: "APT",
            confidence: "Mid",
            aliases: ["Rattlesnake", "T-APT-04", "APT-C-17", "ATK143", "Hardcore Nationalist", "BabyElephant"]
        },
        {
            name: "Bitter",
            country: "IN",
            threatType: "APT",
            confidence: "Mid",
            aliases: ["T-APT-17", "HAZY TIGER", "Orange Yali"]
        },
        {
            name: "Transparent Tribe",
            country: "PK",
            threatType: "APT",
            confidence: "Mid",
            aliases: ["APT36", "Mythic Leopard", "ProjectM", "COPPER FIELDSTONE", "G0134", "C-Major", "Green Havildar"]
        },
        {
            name: "TA505",
            country: "RU",
            threatType: "Cybercrime",
            confidence: "High",
            aliases: ["GOLD TAHOE", "Graceful Spider", "G0092", "SectorJ04", "ATK103", "Hive0065"]
        },
        {
            name: "FIN7",
            country: "RU",
            threatType: "Cybercrime",
            confidence: "High",
            aliases: ["Carbanak", "CARBON SPIDER", "Sangria Tempest", "G0046", "GOLD NIAGARA", "ATK32", "ITG14", "Navigator Group"]
        },
        {
            name: "FIN6",
            country: "RU",
            threatType: "Cybercrime",
            confidence: "High",
            aliases: ["Skeleton Spider", "Camouflage Tempest", "G0037", "ITG08", "GOLD LEWISTON", "Magecart Group 6"]
        },
        {
            name: "Conti",
            country: "RU",
            threatType: "Ransomware Gang",
            confidence: "High",
            aliases: ["Wizard Spider", "UNC1878", "GOLD BLACKBURN", "G0102"]
        },
        {
            name: "REvil",
            country: "RU",
            threatType: "Ransomware Gang",
            confidence: "High",
            aliases: ["Sodinokibi", "Pinchy Spider", "GOLD SOUTHFIELD", "G0115"]
        },
        {
            name: "DarkSide",
            country: "RU",
            threatType: "Ransomware Gang",
            confidence: "High",
            aliases: ["Carbon Spider", "UNC2465"]
        },
        {
            name: "APT2",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Putter Panda", "Sulphur", "G0024", "TG-6952", "Group36"]
        },
        {
            name: "APT3",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Gothic Panda", "UPS Team", "Buckeye", "G0022", "TG-0110", "BRONZE MAYFAIR", "Pirpi", "Boyusec"]
        },
        {
            name: "APT15",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Ke3chang", "Vixen Panda", "NICKEL", "Nylon Typhoon", "G0004", "ATK24", "Mirage", "Playful Dragon", "Social Network Team", "BackdoorDiplomacy"]
        },
        {
            name: "APT17",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Deputy Dog", "Aurora Panda", "Hidden Lynx", "Heart Typhoon", "G0025", "BRONZE KEYSTONE", "Axiom", "Group 72", "Tailgater Team"]
        },
        {
            name: "APT30",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["Naikon", "Override Panda", "Lotus Panda", "G0019", "PLA Unit 78020", "Camerashy"]
        },
        {
            name: "MUSTANG PANDA",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["BRONZE PRESIDENT", "Twill Typhoon", "Stately Taurus", "TA416", "G0129", "HoneyMyte", "Red Lich", "TEMP.HEX", "Earth Preta", "LuminousMoth"]
        },
        {
            name: "Winnti",
            country: "CN",
            threatType: "APT",
            confidence: "High",
            aliases: ["APT41", "BARIUM", "Wicked Panda", "G0044", "Blackfly", "LEAD"]
        },
        {
            name: "Tick",
            country: "CN",
            threatType: "APT",
            confidence: "Mid",
            aliases: ["BRONZE BUTLER", "Stalker Panda", "Swirl Typhoon", "G0060", "Nian", "REDBALDKNIGHT", "PLA Unit 61419"]
        },
        {
            name: "Cobalt Group",
            country: "Unknown",
            threatType: "Cybercrime",
            confidence: "High",
            aliases: ["Cobalt", "Cobalt Gang", "GOLD KINGSWOOD", "G0080", "COBALT SPIDER"]
        }
    ];

    /**
     * Get all Breach-HQ actor data
     */
    function getAllActors() {
        return BREACHHQ_ACTORS;
    }

    /**
     * Find actor by name (case-insensitive)
     */
    function findActor(name) {
        if (!name) return null;
        const normalized = name.toLowerCase().trim();
        
        return BREACHHQ_ACTORS.find(actor => {
            if (actor.name.toLowerCase() === normalized) return true;
            return actor.aliases.some(alias => alias.toLowerCase() === normalized);
        });
    }

    /**
     * Get threat type for an actor
     */
    function getThreatType(name) {
        const actor = findActor(name);
        return actor ? actor.threatType : null;
    }

    /**
     * Get confidence level for an actor
     */
    function getConfidence(name) {
        const actor = findActor(name);
        return actor ? actor.confidence : null;
    }

    /**
     * Enrich existing actors with Breach-HQ data
     */
    function enrichActors(actors) {
        if (!Array.isArray(actors)) return actors;
        
        let enrichedCount = 0;
        
        actors.forEach(actor => {
            let breachHQActor = findActor(actor.name);
            
            // Try matching by aliases
            if (!breachHQActor && actor.aliases) {
                for (const alias of actor.aliases) {
                    breachHQActor = findActor(alias);
                    if (breachHQActor) break;
                }
            }
            
            if (breachHQActor) {
                enrichFromBreachHQ(actor, breachHQActor);
                enrichedCount++;
            }
        });
        
        console.log(`[Breach-HQ] Enriched ${enrichedCount} actors with threat type data`);
        return actors;
    }

    /**
     * Helper to enrich a single actor
     */
    function enrichFromBreachHQ(actor, breachHQActor) {
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
    }

    /**
     * Get statistics
     */
    function getStats() {
        const threatTypes = {};
        BREACHHQ_ACTORS.forEach(a => {
            threatTypes[a.threatType] = (threatTypes[a.threatType] || 0) + 1;
        });
        
        return {
            totalActors: BREACHHQ_ACTORS.length,
            totalAliases: BREACHHQ_ACTORS.reduce((sum, a) => sum + a.aliases.length, 0),
            threatTypes: threatTypes
        };
    }

    // Public API
    return {
        getAllActors,
        findActor,
        getThreatType,
        getConfidence,
        enrichActors,
        getStats
    };
})();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BreachHQParser;
}

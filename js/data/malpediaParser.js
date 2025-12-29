/**
 * Malpedia Actor Parser
 * 
 * Parses and provides enrichment data from Malpedia (Fraunhofer FKIE).
 * Source: https://malpedia.caad.fkie.fraunhofer.de/actors
 * 
 * Provides extensive alias mappings and malware family counts for APT groups.
 * 
 * @version 1.0.0
 */

const MalpediaParser = (function() {
    'use strict';

    // Pre-parsed Malpedia actor data (extracted from HTML)
    // Format: { name, country, aliases[], malwareFamilies }
    const MALPEDIA_ACTORS = [
        {
            name: "Lazarus Group",
            country: "KP",
            aliases: ["Operation DarkSeoul", "Dark Seoul", "Hidden Cobra", "Hastati Group", "Andariel", "Unit 121", "Bureau 121", "NewRomanic Cyber Army Team", "Bluenoroff", "Subgroup: Bluenoroff", "Group 77", "Labyrinth Chollima", "Operation Troy", "Operation GhostSecret", "Operation AppleJeus", "APT38", "APT 38", "Stardust Chollima", "Whois Hacking Team", "Zinc", "Appleworm", "Nickel Academy", "APT-C-26", "NICKEL GLADSTONE", "COVELLITE", "ATK3", "G0032", "ATK117", "G0082", "Citrine Sleet", "DEV-0139", "DEV-1222", "Diamond Sleet", "ZINC", "Sapphire Sleet", "COPERNICIUM", "TA404", "BeagleBoyz", "Moonstone Sleet", "Genie Spider"],
            malwareFamilies: 135
        },
        {
            name: "APT28",
            country: "RU",
            aliases: ["Pawn Storm", "FANCY BEAR", "Sednit", "SNAKEMACKEREL", "Tsar Team", "TG-4127", "STRONTIUM", "Swallowtail", "IRON TWILIGHT", "Group 74", "SIG40", "Grizzly Steppe", "G0007", "ATK5", "Fighting Ursa", "ITG05", "Blue Athena", "TA422", "T-APT-12", "APT-C-20", "UAC-0028", "FROZENLAKE", "Sofacy", "Forest Blizzard", "BlueDelta", "Fancy Bear", "GruesomeLarch", "APT 28", "TsarTeam", "Group-4127", "Grey-Cloud"],
            malwareFamilies: 39
        },
        {
            name: "Turla",
            country: "RU",
            aliases: ["Snake", "VENOMOUS Bear", "Group 88", "Waterbug", "WRAITH", "Uroburos", "Pfinet", "TAG_0530", "KRYPTON", "Hippo Team", "Pacifier APT", "Popeye", "SIG23", "IRON HUNTER", "MAKERSMARK", "ATK13", "G0010", "ITG12", "Blue Python", "SUMMIT", "UNC4210", "Secret Blizzard", "UAC-0144", "UAC-0024", "UAC-0003"],
            malwareFamilies: 39
        },
        {
            name: "Cleaver",
            country: "IR",
            aliases: ["Operation Cleaver", "Op Cleaver", "Tarh Andishan", "Alibaba", "TG-2889", "Cobalt Gypsy", "G0003", "Hazel Sandstorm", "EUROPIUM", "APT34", "OilRig"],
            malwareFamilies: 38
        },
        {
            name: "APT1",
            country: "CN",
            aliases: ["COMMENT PANDA", "PLA Unit 61398", "Comment Crew", "Byzantine Candor", "Group 3", "TG-8223", "Comment Group", "Brown Fox", "GIF89a", "ShadyRAT", "G0006"],
            malwareFamilies: 35
        },
        {
            name: "UNC2452",
            country: "RU",
            aliases: ["DarkHalo", "StellarParticle", "NOBELIUM", "Solar Phoenix", "Midnight Blizzard", "APT29", "Cozy Bear"],
            malwareFamilies: 35
        },
        {
            name: "APT41",
            country: "CN",
            aliases: ["G0096", "TA415", "Blackfly", "Grayfly", "LEAD", "BARIUM", "WICKED SPIDER", "WICKED PANDA", "BRONZE ATLAS", "BRONZE EXPORT", "Red Kelpie", "G0044", "Earth Baku", "Amoeba", "HOODOO", "Brass Typhoon", "Winnti", "Double Dragon", "TG-2633", "Leopard Typhoon"],
            malwareFamilies: 34
        },
        {
            name: "Gamaredon Group",
            country: "RU",
            aliases: ["ACTINIUM", "DEV-0157", "Primitive Bear", "Shuckworm", "Armageddon", "Winterflounder", "BlueAlpha", "IRON TILDEN", "G0047", "ATK91", "UAC-0010", "Aqua Blizzard"],
            malwareFamilies: 26
        },
        {
            name: "APT29",
            country: "RU",
            aliases: ["YTTRIUM", "The Dukes", "Cozy Bear", "CozyDuke", "Dark Halo", "StellarParticle", "NOBELIUM", "UNC2452", "IRON RITUAL", "IRON HEMLOCK", "NobleBaron", "ATK7", "G0016", "Cloaked Ursa", "TA421", "BlueBravo", "Midnight Blizzard"],
            malwareFamilies: 25
        },
        {
            name: "Sandworm",
            country: "RU",
            aliases: ["ELECTRUM", "Telebots", "IRON VIKING", "BlackEnergy", "Quedagh", "VOODOO BEAR", "IRIDIUM", "FROZENBARENTS", "Seashell Blizzard", "G0034", "ATK14", "BE2 APT", "UAC-0082", "Blue Echidna", "PHANTOM", "Ember Bear"],
            malwareFamilies: 23
        },
        {
            name: "APT32",
            country: "VN",
            aliases: ["OceanLotus", "Ocean Lotus", "OCEAN BUFFALO", "SeaLotus", "Cobalt Kitty", "APT-C-00", "Canvas Cyclone", "ATK17", "G0050", "POND LOACH", "TIN WOODLAWN", "SectorF01"],
            malwareFamilies: 19
        },
        {
            name: "Kimsuky",
            country: "KP",
            aliases: ["Velvet Chollima", "Black Banshee", "Thallium", "G0086", "Operation Kabar Cobra", "STOLEN PENCIL", "ATK77", "Emerald Sleet", "TA406", "ITG16", "APT43", "Springtail", "SectorA05"],
            malwareFamilies: 18
        },
        {
            name: "MuddyWater",
            country: "IR",
            aliases: ["MERCURY", "Seedworm", "Static Kitten", "TEMP.Zagros", "ATK51", "G0069", "Mango Sandstorm", "TA450", "Boggy Serpens", "UNC1860", "ATK147", "Yellow Nix"],
            malwareFamilies: 17
        },
        {
            name: "Transparent Tribe",
            country: "PK",
            aliases: ["C-Major", "Mythic Leopard", "APT36", "ProjectM", "COPPER FIELDSTONE", "Green Havildar", "STEPPY KAVACH", "G0134"],
            malwareFamilies: 17
        },
        {
            name: "TA505",
            country: "RU",
            aliases: ["GOLD TAHOE", "SectorJ04", "GRACEFUL SPIDER", "Hive0065", "ATK103", "G0092"],
            malwareFamilies: 16
        },
        {
            name: "Charming Kitten",
            country: "IR",
            aliases: ["ITG18", "Phosphorus", "Newscaster", "NewsBeef", "Group 83", "APT35", "COBALT ILLUSION", "TA453", "Mint Sandstorm", "ATK40", "G0059", "Yellow Garuda", "TunnelVision"],
            malwareFamilies: 15
        },
        {
            name: "Carbanak",
            country: "RU",
            aliases: ["Anunak", "CARBON SPIDER", "G0008"],
            malwareFamilies: 14
        },
        {
            name: "FIN7",
            country: "RU",
            aliases: ["GOLD NIAGARA", "ATK32", "CARBON SPIDER", "Sangria Tempest", "G0046", "G0008", "FIN7"],
            malwareFamilies: 14
        },
        {
            name: "APT33",
            country: "IR",
            aliases: ["Elfin", "Magnallium", "Holmium", "REFINED KITTEN", "ATK35", "G0064", "TA451", "Peach Sandstorm"],
            malwareFamilies: 12
        },
        {
            name: "Patchwork",
            country: "IN",
            aliases: ["Dropping Elephant", "Chinastrats", "MONSOON", "Sarit", "Quilted Tiger", "APT-C-09", "ATK11", "G0040", "Orange Atropos", "ZINC EMERSON"],
            malwareFamilies: 12
        },
        {
            name: "APT37",
            country: "KP",
            aliases: ["Group123", "TEMP.Reaper", "ScarCruft", "Reaper", "Red Eyes", "Ricochet Chollima", "InkySquid", "G0067", "ATK4", "Venus 121", "Star Blizzard", "Ruby Sleet", "CERIUM"],
            malwareFamilies: 11
        },
        {
            name: "SideWinder",
            country: "IN",
            aliases: ["Rattlesnake", "T-APT-04", "APT-C-17", "Hardcore Nationalist", "ATK143", "BabyElephant", "APT-Q-39", "GroupA21"],
            malwareFamilies: 11
        },
        {
            name: "Winnti Group",
            country: "CN",
            aliases: ["Winnti", "Blackfly", "LEAD", "WICKED SPIDER", "WICKED PANDA", "Suckfly", "APT17", "G0044"],
            malwareFamilies: 11
        },
        {
            name: "APT10",
            country: "CN",
            aliases: ["menuPass", "Stone Panda", "Red Apollo", "CVNX", "POTASSIUM", "ChessMaster", "ATK41", "G0045", "TA429", "BRONZE RIVERSIDE", "Cicada", "HOGFISH", "Cloud Hopper"],
            malwareFamilies: 10
        },
        {
            name: "APT3",
            country: "CN",
            aliases: ["Gothic Panda", "Pirpi", "UPS Team", "Buckeye", "Threat Group-0110", "TG-0110", "G0022", "APT 3", "BRONZE MAYFAIR", "Boyusec", "UPS"],
            malwareFamilies: 10
        },
        {
            name: "Confucius",
            country: "IN",
            aliases: ["Confucius APT"],
            malwareFamilies: 10
        },
        {
            name: "Domestic Kitten",
            country: "IR",
            aliases: ["APT-C-50", "Flying Kitten", "SectorD08"],
            malwareFamilies: 10
        },
        {
            name: "Evilnum",
            country: "Unknown",
            aliases: ["TA4563", "Stardust Tempest"],
            malwareFamilies: 10
        },
        {
            name: "Machete",
            country: "Unknown",
            aliases: ["APT-C-43", "El Machete"],
            malwareFamilies: 10
        },
        {
            name: "OilRig",
            country: "IR",
            aliases: ["APT34", "HELIX KITTEN", "IRN2", "Crambus", "Chrysene", "Cobalt Gypsy", "Hazel Sandstorm", "EUROPIUM", "TA452", "ATK40", "G0049", "ITG13", "GreenBug", "Yellow Maero"],
            malwareFamilies: 10
        },
        {
            name: "APT27",
            country: "CN",
            aliases: ["Emissary Panda", "BRONZE UNION", "Iron Tiger", "TG-3390", "LuckyMouse", "Group 35", "ZipToken", "HIPPOTeam", "G0027", "ATK15", "TA428", "RedLeaves", "Budworm", "Silk Typhoon"],
            malwareFamilies: 9
        },
        {
            name: "BlackTech",
            country: "CN",
            aliases: ["Palmerworm", "TEMP.Overboard", "Circuit Panda", "Radio Panda", "T-APT-03", "HUAPI", "G0098", "Manga Taurus", "Red Djinn", "PLEAD"],
            malwareFamilies: 9
        },
        {
            name: "Bitter",
            country: "IN",
            aliases: ["T-APT-17", "HAZY TIGER", "Orange Yali"],
            malwareFamilies: 9
        },
        {
            name: "Gorgon Group",
            country: "PK",
            aliases: ["G0078", "ATK137"],
            malwareFamilies: 9
        },
        {
            name: "Lotus Blossom",
            country: "CN",
            aliases: ["DRAGONFISH", "Spring Dragon", "ST Group", "BRONZE ELGIN", "ATK1", "G0030", "Billbug", "Thrip", "Lotus Panda"],
            malwareFamilies: 9
        },
        {
            name: "MUSTANG PANDA",
            country: "CN",
            aliases: ["BRONZE PRESIDENT", "HoneyMyte", "Red Lich", "TEMP.HEX", "BASIN", "Earth Preta", "TA416", "Stately Taurus", "LuminousMoth", "Polaris", "TANTALUM", "Twill Typhoon"],
            malwareFamilies: 8
        },
        {
            name: "Rocket Kitten",
            country: "IR",
            aliases: ["TEMP.Beanie", "Operation Woolen Goldfish", "Operation Woolen-Goldfish", "Thamar Reservoir", "Timberworm"],
            malwareFamilies: 8
        },
        {
            name: "Tick",
            country: "CN",
            aliases: ["Nian", "BRONZE BUTLER", "REDBALDKNIGHT", "STALKER PANDA", "G0060", "Stalker Taurus", "PLA Unit 61419", "Swirl Typhoon"],
            malwareFamilies: 8
        },
        {
            name: "APT17",
            country: "CN",
            aliases: ["Group 8", "AURORA PANDA", "Hidden Lynx", "Tailgater Team", "Dogfish", "BRONZE KEYSTONE", "G0025", "Group 72", "G0001", "Axiom", "HELIUM", "Heart Typhoon"],
            malwareFamilies: 7
        },
        {
            name: "Cobalt",
            country: "Unknown",
            aliases: ["Cobalt Group", "Cobalt Gang", "GOLD KINGSWOOD", "COBALT SPIDER", "G0080", "Mule Libra"],
            malwareFamilies: 7
        },
        {
            name: "DragonOK",
            country: "CN",
            aliases: ["Moafee", "BRONZE OVERBROOK", "G0017", "G0002", "Shallow Taurus"],
            malwareFamilies: 7
        },
        {
            name: "Hellsing",
            country: "CN",
            aliases: [],
            malwareFamilies: 7
        },
        {
            name: "InvisiMole",
            country: "RU",
            aliases: ["UAC-0035"],
            malwareFamilies: 7
        },
        {
            name: "Ke3chang",
            country: "CN",
            aliases: ["APT15", "Mirage", "Vixen Panda", "Metushy", "Lurid", "Social Network Team", "Royal APT", "Playful Dragon", "NICKEL", "BackdoorDiplomacy", "ATK24", "G0004", "Nylon Typhoon"],
            malwareFamilies: 7
        },
        {
            name: "Threat Group-3390",
            country: "CN",
            aliases: ["Emissary Panda", "APT27", "BRONZE UNION", "Iron Tiger", "LuckyMouse", "G0027"],
            malwareFamilies: 7
        },
        {
            name: "APT30",
            country: "CN",
            aliases: ["Naikon", "PLA Unit 78020", "OVERRIDE PANDA", "Camerashy", "G0019", "G0013", "Lotus Panda"],
            malwareFamilies: 6
        },
        {
            name: "APT40",
            country: "CN",
            aliases: ["Leviathan", "TEMP.Periscope", "TEMP.Jumper", "Kryptonite Panda", "BRONZE MOHAWK", "ATK29", "G0065", "GADOLINIUM", "TA423", "Red Ladon", "ITG09", "ISLANDDREAMS", "Gingham Typhoon"],
            malwareFamilies: 6
        },
        {
            name: "DarkHydrus",
            country: "IR",
            aliases: ["G0079"],
            malwareFamilies: 6
        },
        {
            name: "Earth Lusca",
            country: "CN",
            aliases: ["TAG-22", "Aquatic Panda", "ControlX", "CHROMIUM", "RedHotel", "Charcoal Typhoon"],
            malwareFamilies: 6
        },
        {
            name: "Magic Hound",
            country: "IR",
            aliases: ["Cobalt Illusion", "APT35", "ITG18", "Newscaster", "NewsBeef", "Mint Sandstorm", "TA453", "G0059", "Charming Kitten", "PHOSPHORUS"],
            malwareFamilies: 6
        },
        {
            name: "menuPass",
            country: "CN",
            aliases: ["APT10", "Stone Panda", "Red Apollo", "CVNX", "POTASSIUM", "G0045", "TA429", "BRONZE RIVERSIDE", "Cicada"],
            malwareFamilies: 6
        },
        {
            name: "Naikon",
            country: "CN",
            aliases: ["APT30", "PLA Unit 78020", "Lotus Panda", "OVERRIDE PANDA", "Camerashy", "G0019", "G0013"],
            malwareFamilies: 6
        },
        {
            name: "Silence",
            country: "RU",
            aliases: ["WHISPER SPIDER", "G0091", "TA505"],
            malwareFamilies: 6
        },
        {
            name: "TA410",
            country: "CN",
            aliases: ["FlowingFrog", "JollyFrog", "LookingFrog"],
            malwareFamilies: 6
        },
        {
            name: "APT-C-36",
            country: "CO",
            aliases: ["Blind Eagle"],
            malwareFamilies: 5
        },
        {
            name: "BackdoorDiplomacy",
            country: "CN",
            aliases: ["APT15", "Ke3chang", "Vixen Panda", "Nylon Typhoon"],
            malwareFamilies: 5
        },
        {
            name: "Bookworm",
            country: "CN",
            aliases: [],
            malwareFamilies: 5
        },
        {
            name: "Dark Caracal",
            country: "LB",
            aliases: ["G0070"],
            malwareFamilies: 5
        },
        {
            name: "DarkHotel",
            country: "KR",
            aliases: ["DUBNIUM", "Fallout Team", "Karba", "Luder", "Nemim", "Nemin", "Pioneer", "Shadow Crane", "SIG25", "Tapaoux", "ATK52", "G0012", "Higaisa", "APT-C-06"],
            malwareFamilies: 5
        },
        {
            name: "DustSquad",
            country: "RU",
            aliases: ["Hades"],
            malwareFamilies: 5
        },
        {
            name: "Equation",
            country: "US",
            aliases: ["Equation Group", "EQGRP", "Tilded Team", "PLATINUM COLONY", "Longhorn", "The Lamberts"],
            malwareFamilies: 5
        },
        {
            name: "FIN6",
            country: "RU",
            aliases: ["Magecart Group 6", "SKELETON SPIDER", "ITG08", "G0037", "Camouflage Tempest"],
            malwareFamilies: 5
        },
        {
            name: "Gallmaker",
            country: "Unknown",
            aliases: [],
            malwareFamilies: 5
        },
        {
            name: "GoldenJackal",
            country: "Unknown",
            aliases: [],
            malwareFamilies: 5
        },
        {
            name: "Higaisa",
            country: "KR",
            aliases: ["DarkHotel"],
            malwareFamilies: 5
        },
        {
            name: "IceFog",
            country: "CN",
            aliases: ["Dagger Panda", "G0049"],
            malwareFamilies: 5
        },
        {
            name: "Inception Framework",
            country: "RU",
            aliases: ["Cloud Atlas", "Blue Odin", "G0100", "Red October", "ATK116"],
            malwareFamilies: 5
        },
        {
            name: "Leviathan",
            country: "CN",
            aliases: ["APT40", "TEMP.Periscope", "TEMP.Jumper", "Kryptonite Panda", "BRONZE MOHAWK", "GADOLINIUM", "G0065", "Gingham Typhoon"],
            malwareFamilies: 5
        },
        {
            name: "Moses Staff",
            country: "IR",
            aliases: ["DEV-0500", "Abraham's Ax", "Marigold Sandstorm", "UNC3890"],
            malwareFamilies: 5
        },
        {
            name: "Night Dragon",
            country: "CN",
            aliases: ["G0014"],
            malwareFamilies: 5
        },
        {
            name: "Operation Wocao",
            country: "CN",
            aliases: [],
            malwareFamilies: 5
        },
        {
            name: "Platinum",
            country: "Unknown",
            aliases: ["TwoForOne", "ATK38", "G0068", "BRONZE KEYSTONE"],
            malwareFamilies: 5
        },
        {
            name: "Promethium",
            country: "TR",
            aliases: ["StrongPity", "ATK107", "G0056"],
            malwareFamilies: 5
        },
        {
            name: "Rancor",
            country: "CN",
            aliases: [],
            malwareFamilies: 5
        },
        {
            name: "Scarlet Mimic",
            country: "CN",
            aliases: ["G0029"],
            malwareFamilies: 5
        },
        {
            name: "Stealth Falcon",
            country: "AE",
            aliases: ["G0038", "FruityArmor"],
            malwareFamilies: 5
        },
        {
            name: "TeamTNT",
            country: "DE",
            aliases: ["NARWHAL SPIDER", "GOLD LEWISTON"],
            malwareFamilies: 5
        },
        {
            name: "TEMP.Veles",
            country: "RU",
            aliases: ["XENOTIME", "G0088", "ATK91"],
            malwareFamilies: 5
        },
        {
            name: "Tropic Trooper",
            country: "CN",
            aliases: ["KeyBoy", "Pirate Panda", "APT23", "BRONZE HOBART", "G0081", "Earth Centaur"],
            malwareFamilies: 5
        },
        {
            name: "WildPressure",
            country: "Unknown",
            aliases: [],
            malwareFamilies: 5
        },
        {
            name: "Winnti",
            country: "CN",
            aliases: ["Winnti Group", "G0044", "BARIUM", "Blackfly", "APT41", "LEAD", "WICKED SPIDER"],
            malwareFamilies: 5
        }
    ];

    /**
     * Get all Malpedia actor data
     */
    function getAllActors() {
        return MALPEDIA_ACTORS;
    }

    /**
     * Find actor by name (case-insensitive)
     */
    function findActor(name) {
        if (!name) return null;
        const normalized = name.toLowerCase().trim();
        
        return MALPEDIA_ACTORS.find(actor => {
            if (actor.name.toLowerCase() === normalized) return true;
            return actor.aliases.some(alias => alias.toLowerCase() === normalized);
        });
    }

    /**
     * Get all aliases for a given actor name
     */
    function getAliases(name) {
        const actor = findActor(name);
        return actor ? [actor.name, ...actor.aliases] : [];
    }

    /**
     * Enrich existing actors with Malpedia data
     */
    function enrichActors(actors) {
        if (!Array.isArray(actors)) return actors;
        
        let enrichedCount = 0;
        
        actors.forEach(actor => {
            const malpediaActor = findActor(actor.name);
            
            if (!malpediaActor && actor.aliases) {
                // Try matching by aliases
                for (const alias of actor.aliases) {
                    const found = findActor(alias);
                    if (found) {
                        enrichFromMalpedia(actor, found);
                        enrichedCount++;
                        break;
                    }
                }
            } else if (malpediaActor) {
                enrichFromMalpedia(actor, malpediaActor);
                enrichedCount++;
            }
        });
        
        console.log(`[Malpedia] Enriched ${enrichedCount} actors with alias data`);
        return actors;
    }

    /**
     * Helper to enrich a single actor
     */
    function enrichFromMalpedia(actor, malpediaActor) {
        // Merge aliases (deduplicated)
        const existingAliases = actor.aliases || [];
        const newAliases = malpediaActor.aliases || [];
        const allAliases = [...new Set([...existingAliases, ...newAliases])];
        actor.aliases = allAliases;
        
        // Add malware family count
        actor.malpediaMalwareFamilies = malpediaActor.malwareFamilies;
        
        // Mark as enriched
        actor.malpediaEnriched = true;
    }

    /**
     * Get statistics
     */
    function getStats() {
        return {
            totalActors: MALPEDIA_ACTORS.length,
            totalAliases: MALPEDIA_ACTORS.reduce((sum, a) => sum + a.aliases.length, 0),
            avgAliasesPerActor: (MALPEDIA_ACTORS.reduce((sum, a) => sum + a.aliases.length, 0) / MALPEDIA_ACTORS.length).toFixed(1),
            avgMalwareFamilies: (MALPEDIA_ACTORS.reduce((sum, a) => sum + a.malwareFamilies, 0) / MALPEDIA_ACTORS.length).toFixed(1)
        };
    }

    // Public API
    return {
        getAllActors,
        findActor,
        getAliases,
        enrichActors,
        getStats
    };
})();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MalpediaParser;
}

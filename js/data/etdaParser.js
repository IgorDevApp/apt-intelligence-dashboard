/**
 * ETDA Thailand APT Database Parser
 * 
 * Parses and provides enrichment data from Thailand's Electronic Transactions
 * Development Agency (ETDA) APT Groups database.
 * Source: https://apt.etda.or.th/cgi-bin/listgroups.cgi
 * 
 * Provides comprehensive timeline data (first-seen AND last-seen dates),
 * country attribution, extensive alias mappings, subgroup relationships,
 * and counter-operation tracking.
 * 
 * @version 1.0.0
 */

const ETDAParser = (function() {
    'use strict';

    // Pre-parsed ETDA actor data
    // Format: { name, aliases[], country, firstSeen, lastSeen, isSubgroup, parentGroup, hadCounterOps }
    const ETDA_ACTORS = [
        { name: "AeroBlade", aliases: [], country: null, firstSeen: "2022", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Aggah", aliases: [], country: null, firstSeen: "2018", lastSeen: "Jun 2022", isSubgroup: false, hadCounterOps: false },
        { name: "Agrius", aliases: [], country: "IR", firstSeen: "2020", lastSeen: "May 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Allanite", aliases: [], country: null, firstSeen: "2017", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "ALPHV", aliases: ["BlackCat", "BlackCat Gang"], country: null, firstSeen: "2021", lastSeen: "Mar 2024", isSubgroup: false, hadCounterOps: true },
        { name: "Scattered Spider", aliases: ["UNC3944", "Roasted 0ktapus"], country: null, firstSeen: "2022", lastSeen: "Aug 2025", isSubgroup: true, parentGroup: "ALPHV", hadCounterOps: true },
        { name: "Anchor Panda", aliases: ["APT 14", "APT14"], country: "CN", firstSeen: "2012", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Angry Likho", aliases: [], country: null, firstSeen: "2023", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Antlion", aliases: [], country: "CN", firstSeen: "2011", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Aoqin Dragon", aliases: [], country: "CN", firstSeen: "2013", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "APT3", aliases: ["APT 3", "Gothic Panda", "Buckeye", "UPS Team", "Pirpi"], country: "CN", firstSeen: "2007", lastSeen: "Nov 2017", isSubgroup: false, hadCounterOps: true },
        { name: "APT4", aliases: ["APT 4", "Maverick Panda", "Wisp Team"], country: "CN", firstSeen: "2007", lastSeen: "Oct 2018", isSubgroup: false, hadCounterOps: false },
        { name: "APT5", aliases: ["APT 5", "Keyhole Panda", "MANGANESE"], country: "CN", firstSeen: "2007", lastSeen: "Aug 2019", isSubgroup: false, hadCounterOps: false },
        { name: "APT6", aliases: ["APT 6"], country: "CN", firstSeen: "2011", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "APT12", aliases: ["APT 12", "Numbered Panda", "IXESHE", "DynCalc"], country: "CN", firstSeen: "2009", lastSeen: "Nov 2016", isSubgroup: false, hadCounterOps: false },
        { name: "APT16", aliases: ["APT 16", "SVCMONDR"], country: "CN", firstSeen: "2015", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "APT17", aliases: ["APT 17", "Deputy Dog", "Elderwood", "Sneaky Panda", "Aurora Panda", "Hidden Lynx"], country: "CN", firstSeen: "2009", lastSeen: "Jun 2024", isSubgroup: false, hadCounterOps: false },
        { name: "APT18", aliases: ["APT 18", "Dynamite Panda", "Wekby", "TG-0416"], country: "CN", firstSeen: "2009", lastSeen: "May 2016", isSubgroup: false, hadCounterOps: false },
        { name: "APT19", aliases: ["APT 19", "Deep Panda", "C0d0so0", "Codoso", "Shell Crew"], country: "CN", firstSeen: "2013", lastSeen: "Mar 2022", isSubgroup: false, hadCounterOps: false },
        { name: "APT20", aliases: ["APT 20", "Violin Panda", "TH3Bug"], country: "CN", firstSeen: "2014", lastSeen: "2017", isSubgroup: false, hadCounterOps: false },
        { name: "APT29", aliases: ["APT 29", "Cozy Bear", "The Dukes", "CozyDuke", "NOBELIUM", "Midnight Blizzard", "YTTRIUM", "Iron Hemlock", "Dark Halo"], country: "RU", firstSeen: "2008", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: false },
        { name: "APT30", aliases: ["APT 30", "Override Panda", "Naikon"], country: "CN", firstSeen: "2005", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "APT31", aliases: ["APT 31", "Judgment Panda", "Zirconium", "BRONZE VINEWOOD", "Violet Typhoon"], country: "CN", firstSeen: "2016", lastSeen: "Mar 2024", isSubgroup: false, hadCounterOps: false },
        { name: "APT32", aliases: ["APT 32", "OceanLotus", "SeaLotus", "Ocean Lotus", "Canvas Cyclone", "Cobalt Kitty", "APT-C-00"], country: "VN", firstSeen: "2013", lastSeen: "Aug 2024", isSubgroup: false, hadCounterOps: false },
        { name: "APT33", aliases: ["APT 33", "Elfin", "Magnallium", "HOLMIUM", "Refined Kitten", "Peach Sandstorm"], country: "IR", firstSeen: "2013", lastSeen: "Apr 2024", isSubgroup: false, hadCounterOps: false },
        { name: "APT41", aliases: ["APT 41", "Double Dragon", "Wicked Panda", "BARIUM", "Winnti", "Brass Typhoon"], country: "CN", firstSeen: "2012", lastSeen: "Jul 2025", isSubgroup: false, hadCounterOps: false },
        { name: "Earth Freybug", aliases: [], country: "CN", firstSeen: "2012", lastSeen: null, isSubgroup: true, parentGroup: "APT41", hadCounterOps: false },
        { name: "Earth Longzhi", aliases: [], country: "CN", firstSeen: "2020", lastSeen: "Apr 2023", isSubgroup: true, parentGroup: "APT41", hadCounterOps: false },
        { name: "APT42", aliases: ["APT 42", "Charming Kitten", "PHOSPHORUS", "Mint Sandstorm", "TA453", "Yellow Garuda"], country: "IR", firstSeen: "2015", lastSeen: "Feb 2024", isSubgroup: false, hadCounterOps: false },
        { name: "APT-C-60", aliases: [], country: "KR", firstSeen: "2018", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Aquatic Panda", aliases: ["RedHotel", "ControlX", "BRONZE UNIVERSITY"], country: "CN", firstSeen: "2020", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "AtlasCross", aliases: [], country: null, firstSeen: "2023", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "AVIVORE", aliases: [], country: "CN", firstSeen: "2015", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Awaken Likho", aliases: [], country: null, firstSeen: "2021", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Axiom", aliases: ["Group 72", "APT17"], country: "CN", firstSeen: "2008", lastSeen: "2014", isSubgroup: false, hadCounterOps: false },
        { name: "Bad Magic", aliases: ["RedStinger"], country: null, firstSeen: "2020", lastSeen: "May 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Bahamut", aliases: [], country: null, firstSeen: "2016", lastSeen: "Jul 2023", isSubgroup: false, hadCounterOps: false },
        { name: "BARIUM", aliases: [], country: "CN", firstSeen: "2016", lastSeen: "Nov 2017", isSubgroup: false, hadCounterOps: false },
        { name: "Berserk Bear", aliases: ["Dragonfly 2.0", "Energetic Bear", "Crouching Yeti", "IRON LIBERTY"], country: "RU", firstSeen: "2015", lastSeen: "May 2017", isSubgroup: false, hadCounterOps: false },
        { name: "Bitter", aliases: ["T-APT-17", "HAZY TIGER", "Orange Yali"], country: null, firstSeen: "2013", lastSeen: "Nov 2024", isSubgroup: false, hadCounterOps: false },
        { name: "BlackTech", aliases: ["Circuit Panda", "Radio Panda", "Palmerworm", "TEMP.Overboard"], country: "CN", firstSeen: "2010", lastSeen: "Oct 2020", isSubgroup: false, hadCounterOps: false },
        { name: "Blackwood", aliases: [], country: "CN", firstSeen: "2018", lastSeen: "Jan 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Blind Eagle", aliases: ["APT-C-36"], country: "CO", firstSeen: "2018", lastSeen: "Nov 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Blue Termite", aliases: ["Cloudy Omega"], country: "CN", firstSeen: "2013", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Bookworm", aliases: [], country: "CN", firstSeen: "2015", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Bronze Butler", aliases: ["Tick", "RedBaldNight", "Stalker Panda", "REDBALDKNIGHT"], country: "CN", firstSeen: "2006", lastSeen: "Apr 2021", isSubgroup: false, hadCounterOps: false },
        { name: "Bronze Highland", aliases: [], country: "CN", firstSeen: "2012", lastSeen: "Jul 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Bronze Starlight", aliases: ["DEV-0401", "Emperor Dragonfly"], country: "CN", firstSeen: "2021", lastSeen: "Mar 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Buhtrap", aliases: ["Ratopak Spider"], country: "RU", firstSeen: "2015", lastSeen: "Jun 2019", isSubgroup: false, hadCounterOps: false },
        { name: "Cadet Blizzard", aliases: ["DEV-0586"], country: "RU", firstSeen: "2020", lastSeen: "Jun 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Callisto Group", aliases: ["COLDRIVER", "Star Blizzard", "SEABORGIUM"], country: null, firstSeen: "2013", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Calypso", aliases: [], country: "CN", firstSeen: "2016", lastSeen: "Aug 2021", isSubgroup: false, hadCounterOps: false },
        { name: "Carbanak", aliases: ["Anunak", "CARBON SPIDER", "FIN7"], country: "UA", firstSeen: "2013", lastSeen: "Apr 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Careto", aliases: ["The Mask"], country: "ES", firstSeen: "2007", lastSeen: "2022", isSubgroup: false, hadCounterOps: false },
        { name: "Chafer", aliases: ["APT 39", "APT39", "Remix Kitten", "Cobalt Hickman"], country: "IR", firstSeen: "2014", lastSeen: "Sep 2020", isSubgroup: false, hadCounterOps: false },
        { name: "ChamelGang", aliases: [], country: "CN", firstSeen: "2021", lastSeen: "Jun 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Chimera", aliases: [], country: "CN", firstSeen: "2018", lastSeen: "Oct 2019", isSubgroup: false, hadCounterOps: false },
        { name: "CIA", aliases: [], country: "US", firstSeen: "1947", lastSeen: "Sep 2018", isSubgroup: false, hadCounterOps: false },
        { name: "Longhorn", aliases: ["The Lamberts"], country: "US", firstSeen: "2009", lastSeen: null, isSubgroup: true, parentGroup: "CIA", hadCounterOps: false },
        { name: "Circus Spider", aliases: ["NetWalker"], country: null, firstSeen: "2019", lastSeen: "Dec 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Clever Kitten", aliases: [], country: "IR", firstSeen: "2013", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "CloudSorcerer", aliases: [], country: null, firstSeen: "2024", lastSeen: "Jul 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Cobalt Group", aliases: ["Cobalt Gang", "GOLD KINGSWOOD", "COBALT SPIDER"], country: "RU", firstSeen: "2016", lastSeen: "Oct 2019", isSubgroup: false, hadCounterOps: false },
        { name: "Cold River", aliases: ["COLDRIVER", "Callisto", "Star Blizzard", "SEABORGIUM"], country: "RU", firstSeen: "2019", lastSeen: "Jan 2025", isSubgroup: false, hadCounterOps: false },
        { name: "Comment Crew", aliases: ["APT 1", "APT1", "Comment Panda", "PLA Unit 61398", "Byzantine Candor"], country: "CN", firstSeen: "2006", lastSeen: "May 2018", isSubgroup: false, hadCounterOps: false },
        { name: "Confucius", aliases: [], country: "IN", firstSeen: "2013", lastSeen: "Aug 2021", isSubgroup: false, hadCounterOps: false },
        { name: "CopyKittens", aliases: ["Slayer Kitten"], country: "IR", firstSeen: "2013", lastSeen: "Jan 2017", isSubgroup: false, hadCounterOps: false },
        { name: "Corkow", aliases: ["Metel"], country: "RU", firstSeen: "2011", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Cosmic Leopard", aliases: ["Operation Celestial Force"], country: "PK", firstSeen: "2018", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "CostaRicto", aliases: [], country: null, firstSeen: "2017", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Covellite", aliases: [], country: "KP", firstSeen: "2017", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Cutting Kitten", aliases: ["TG-2889"], country: "IR", firstSeen: "2012", lastSeen: "Mar 2016", isSubgroup: false, hadCounterOps: false },
        { name: "CyberAv3ngers", aliases: [], country: "IR", firstSeen: "2019", lastSeen: "Aug 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Cyber Berkut", aliases: [], country: "RU", firstSeen: "2014", lastSeen: "May 2015", isSubgroup: false, hadCounterOps: false },
        { name: "Dark Caracal", aliases: [], country: "LB", firstSeen: "2007", lastSeen: "Jun 2024", isSubgroup: false, hadCounterOps: false },
        { name: "DarkHotel", aliases: ["DUBNIUM", "Fallout Team", "Karba", "Tapaoux", "Higaisa"], country: "KR", firstSeen: "2007", lastSeen: "2023", isSubgroup: false, hadCounterOps: false },
        { name: "DarkHydrus", aliases: ["LazyMeerkat"], country: "IR", firstSeen: "2016", lastSeen: "Jan 2019", isSubgroup: false, hadCounterOps: false },
        { name: "Dark Pink", aliases: ["Saaiwc Group"], country: null, firstSeen: "2022", lastSeen: "Feb 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Deceptikons", aliases: ["DeathStalker"], country: null, firstSeen: "2012", lastSeen: "Jun 2020", isSubgroup: false, hadCounterOps: false },
        { name: "Desert Falcons", aliases: [], country: null, firstSeen: "2011", lastSeen: "Oct 2023", isSubgroup: false, hadCounterOps: false },
        { name: "DNSpionage", aliases: [], country: "IR", firstSeen: "2019", lastSeen: "Apr 2019", isSubgroup: false, hadCounterOps: false },
        { name: "Domestic Kitten", aliases: ["APT-C-50", "Flying Kitten"], country: "IR", firstSeen: "2016", lastSeen: "Oct 2022", isSubgroup: false, hadCounterOps: false },
        { name: "Donot Team", aliases: ["APT-C-35", "SectorE02", "Origami Elephant"], country: "IN", firstSeen: "2016", lastSeen: "Oct 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Doppel Spider", aliases: ["DoppelPaymer", "Grief Gang"], country: "RU", firstSeen: "2019", lastSeen: "May 2025", isSubgroup: false, hadCounterOps: false },
        { name: "DragonOK", aliases: ["Moafee", "BRONZE OVERBROOK"], country: "CN", firstSeen: "2015", lastSeen: "Jan 2017", isSubgroup: false, hadCounterOps: false },
        { name: "DragonSpark", aliases: [], country: "CN", firstSeen: "2022", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "DustSquad", aliases: ["Golden Falcon", "Hades"], country: "RU", firstSeen: "2014", lastSeen: "2020", isSubgroup: false, hadCounterOps: false },
        { name: "Dust Storm", aliases: [], country: "CN", firstSeen: "2010", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Earth Estries", aliases: ["Salt Typhoon", "FamousSparrow", "GhostEmperor"], country: "CN", firstSeen: "2020", lastSeen: "Dec 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Earth Krahang", aliases: [], country: "CN", firstSeen: "2022", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Earth Lusca", aliases: ["TAG-22", "Charcoal Typhoon", "CHROMIUM", "RedHotel"], country: "CN", firstSeen: "2019", lastSeen: "Nov 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Elderwood", aliases: [], country: "CN", firstSeen: "2012", lastSeen: "Sep 2014", isSubgroup: false, hadCounterOps: false },
        { name: "Elfin", aliases: [], country: "IR", firstSeen: "2016", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Ember Bear", aliases: ["UNC2589", "Lorec53", "Bleeding Bear", "Saint Bear"], country: "RU", firstSeen: "2021", lastSeen: "Jul 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Emissary Panda", aliases: ["APT 27", "APT27", "LuckyMouse", "Iron Tiger", "Bronze Union", "Budworm", "Silk Typhoon"], country: "CN", firstSeen: "2009", lastSeen: "Dec 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Equation Group", aliases: ["EQGRP", "Tilded Team", "PLATINUM COLONY"], country: "US", firstSeen: "1996", lastSeen: "2015", isSubgroup: false, hadCounterOps: false },
        { name: "Evilnum", aliases: ["TA4563"], country: null, firstSeen: "2018", lastSeen: "Aug 2022", isSubgroup: false, hadCounterOps: false },
        { name: "FamousSparrow", aliases: ["Salt Typhoon", "GhostEmperor", "Earth Estries"], country: "CN", firstSeen: "2019", lastSeen: "Nov 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Fancy Bear", aliases: ["APT 28", "APT28", "Sofacy", "Sednit", "Pawn Storm", "STRONTIUM", "Forest Blizzard", "Fighting Ursa", "Tsar Team", "Grizzly Steppe"], country: "RU", firstSeen: "2004", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: true },
        { name: "FIN6", aliases: ["Skeleton Spider", "GOLD LEWISTON", "Magecart Group 6", "Camouflage Tempest", "ITG08"], country: "RU", firstSeen: "2015", lastSeen: "Jul 2022", isSubgroup: false, hadCounterOps: false },
        { name: "FIN7", aliases: ["Carbanak", "GOLD NIAGARA", "CARBON SPIDER", "Sangria Tempest", "Navigator Group"], country: "RU", firstSeen: "2012", lastSeen: "Jul 2024", isSubgroup: false, hadCounterOps: true },
        { name: "FIN8", aliases: ["Syssphinx"], country: null, firstSeen: "2016", lastSeen: "Jun 2023", isSubgroup: false, hadCounterOps: false },
        { name: "FIN11", aliases: ["TA505"], country: null, firstSeen: "2016", lastSeen: "Nov 2024", isSubgroup: false, hadCounterOps: false },
        { name: "FIN12", aliases: ["Pistachio Tempest", "DEV-0237"], country: null, firstSeen: "2018", lastSeen: "Jun 2023", isSubgroup: false, hadCounterOps: false },
        { name: "FIN13", aliases: ["Elephant Beetle"], country: null, firstSeen: "2016", lastSeen: "Jan 2022", isSubgroup: false, hadCounterOps: false },
        { name: "Flax Typhoon", aliases: ["Ethereal Panda"], country: "CN", firstSeen: "2021", lastSeen: "Nov 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Flying Kitten", aliases: ["Ajax Security Team"], country: "IR", firstSeen: "2010", lastSeen: "2013", isSubgroup: false, hadCounterOps: false },
        { name: "Gamaredon", aliases: ["Gamaredon Group", "Primitive Bear", "ACTINIUM", "Shuckworm", "Armageddon", "Aqua Blizzard", "UAC-0010", "IRON TILDEN"], country: "RU", firstSeen: "2013", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: true },
        { name: "GCHQ", aliases: [], country: "GB", firstSeen: "1919", lastSeen: "2010", isSubgroup: false, hadCounterOps: false },
        { name: "GCMAN", aliases: [], country: "RU", firstSeen: "2016", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Gelsemium", aliases: [], country: "CN", firstSeen: "2014", lastSeen: "2023", isSubgroup: false, hadCounterOps: false },
        { name: "GhostNet", aliases: ["Snooping Dragon"], country: "CN", firstSeen: "2009", lastSeen: "2010", isSubgroup: false, hadCounterOps: true },
        { name: "Goblin Panda", aliases: ["Cycldek", "Conimes", "Hellsing"], country: "CN", firstSeen: "2013", lastSeen: "Jun 2020", isSubgroup: false, hadCounterOps: false },
        { name: "GoldenJackal", aliases: [], country: null, firstSeen: "2019", lastSeen: "2022", isSubgroup: false, hadCounterOps: false },
        { name: "Gorgon Group", aliases: [], country: "PK", firstSeen: "2017", lastSeen: "Jul 2020", isSubgroup: false, hadCounterOps: false },
        { name: "Grayling", aliases: [], country: null, firstSeen: "2023", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "GreenCharlie", aliases: [], country: "IR", firstSeen: "2020", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Group5", aliases: [], country: "IR", firstSeen: "2015", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Hafnium", aliases: ["Silk Typhoon"], country: "CN", firstSeen: "2021", lastSeen: "Mar 2021", isSubgroup: false, hadCounterOps: false },
        { name: "Handala Hack", aliases: [], country: "IR", firstSeen: "2023", lastSeen: "Dec 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Hellsing", aliases: [], country: "CN", firstSeen: "2012", lastSeen: "Apr 2015", isSubgroup: false, hadCounterOps: false },
        { name: "Hezbollah Cyber Unit", aliases: ["Lebanese Cedar"], country: "LB", firstSeen: "2012", lastSeen: "Jan 2021", isSubgroup: false, hadCounterOps: false },
        { name: "Higaisa", aliases: [], country: "KR", firstSeen: "2016", lastSeen: "Jun 2020", isSubgroup: false, hadCounterOps: false },
        { name: "Hive0117", aliases: [], country: "RU", firstSeen: "2022", lastSeen: "Mar 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Hurricane Panda", aliases: ["Black Vine", "TEMP.Avengers"], country: "CN", firstSeen: "2009", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "IceFog", aliases: ["Dagger Panda"], country: "CN", firstSeen: "2011", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Inception", aliases: ["Cloud Atlas", "Blue Odin", "Red October"], country: "RU", firstSeen: "2012", lastSeen: "Dec 2024", isSubgroup: false, hadCounterOps: false },
        { name: "InvisiMole", aliases: [], country: "RU", firstSeen: "2013", lastSeen: "Jun 2020", isSubgroup: false, hadCounterOps: false },
        { name: "IronHusky", aliases: [], country: "CN", firstSeen: "2017", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Ke3chang", aliases: ["APT 15", "APT15", "Vixen Panda", "NICKEL", "Nylon Typhoon", "Playful Dragon", "BackdoorDiplomacy"], country: "CN", firstSeen: "2010", lastSeen: "Oct 2022", isSubgroup: false, hadCounterOps: false },
        { name: "Kimsuky", aliases: ["Velvet Chollima", "Black Banshee", "THALLIUM", "Emerald Sleet", "APT43", "TA406", "Springtail"], country: "KP", firstSeen: "2012", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: false },
        { name: "Lazarus Group", aliases: ["Hidden Cobra", "ZINC", "Diamond Sleet", "Labyrinth Chollima", "Bureau 121", "Unit 121", "APT38", "Bluenoroff", "Andariel", "Guardians of Peace"], country: "KP", firstSeen: "2007", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: true },
        { name: "Leafminer", aliases: ["Raspite"], country: "IR", firstSeen: "2017", lastSeen: "Aug 2018", isSubgroup: false, hadCounterOps: false },
        { name: "Leviathan", aliases: ["APT 40", "APT40", "TEMP.Periscope", "TEMP.Jumper", "Kryptonite Panda", "BRONZE MOHAWK", "Gingham Typhoon", "GADOLINIUM"], country: "CN", firstSeen: "2009", lastSeen: "Jan 2025", isSubgroup: false, hadCounterOps: true },
        { name: "LightBasin", aliases: ["UNC1945"], country: "CN", firstSeen: "2016", lastSeen: "Oct 2021", isSubgroup: false, hadCounterOps: false },
        { name: "LockBit", aliases: ["LockBit Gang", "Gold Mystic", "ABCD Ransomware"], country: "RU", firstSeen: "2019", lastSeen: "May 2025", isSubgroup: false, hadCounterOps: true },
        { name: "Lotus Blossom", aliases: ["Spring Dragon", "DRAGONFISH", "ST Group", "BRONZE ELGIN", "Billbug", "Thrip", "Lotus Panda"], country: "CN", firstSeen: "2012", lastSeen: "Jan 2025", isSubgroup: false, hadCounterOps: false },
        { name: "Lyceum", aliases: ["HEXANE", "Siamesekitten", "Spirlin"], country: "IR", firstSeen: "2017", lastSeen: "Oct 2022", isSubgroup: false, hadCounterOps: false },
        { name: "Machete", aliases: ["APT-C-43", "El Machete"], country: null, firstSeen: "2010", lastSeen: "Apr 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Magic Hound", aliases: ["Cobalt Illusion", "APT 35", "APT35", "Charming Kitten", "PHOSPHORUS", "ITG18", "TA453", "Mint Sandstorm", "Newscaster"], country: "IR", firstSeen: "2012", lastSeen: "Sep 2022", isSubgroup: false, hadCounterOps: false },
        { name: "Maze Team", aliases: ["TA2101"], country: null, firstSeen: "2019", lastSeen: "Feb 2024", isSubgroup: false, hadCounterOps: true },
        { name: "menuPass", aliases: ["APT 10", "APT10", "Stone Panda", "Red Apollo", "CVNX", "POTASSIUM", "Cicada", "Cloud Hopper", "BRONZE RIVERSIDE"], country: "CN", firstSeen: "2006", lastSeen: "Aug 2024", isSubgroup: false, hadCounterOps: true },
        { name: "MuddyWater", aliases: ["MERCURY", "Seedworm", "Static Kitten", "Mango Sandstorm", "TA450", "TEMP.Zagros", "Boggy Serpens"], country: "IR", firstSeen: "2017", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: false },
        { name: "MUSTANG PANDA", aliases: ["BRONZE PRESIDENT", "HoneyMyte", "Red Lich", "TEMP.HEX", "Earth Preta", "TA416", "Stately Taurus", "Twill Typhoon"], country: "CN", firstSeen: "2017", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: false },
        { name: "Naikon", aliases: ["APT 30", "PLA Unit 78020", "Lotus Panda", "Override Panda"], country: "CN", firstSeen: "2005", lastSeen: "May 2020", isSubgroup: false, hadCounterOps: false },
        { name: "Ninja", aliases: [], country: null, firstSeen: "2020", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Nomadic Octopus", aliases: ["DustSquad"], country: "RU", firstSeen: "2014", lastSeen: "Oct 2022", isSubgroup: false, hadCounterOps: false },
        { name: "NSA", aliases: [], country: "US", firstSeen: "1952", lastSeen: "Nov 2017", isSubgroup: false, hadCounterOps: false },
        { name: "OceanLotus", aliases: ["APT 32", "APT32", "SeaLotus", "Canvas Cyclone", "Cobalt Kitty"], country: "VN", firstSeen: "2012", lastSeen: "Aug 2024", isSubgroup: false, hadCounterOps: false },
        { name: "OilRig", aliases: ["APT 34", "APT34", "Helix Kitten", "IRN2", "Crambus", "Chrysene", "Cobalt Gypsy", "Hazel Sandstorm", "EUROPIUM"], country: "IR", firstSeen: "2014", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: false },
        { name: "Operation Wocao", aliases: [], country: "CN", firstSeen: "2017", lastSeen: "Jun 2019", isSubgroup: false, hadCounterOps: false },
        { name: "Orangeworm", aliases: [], country: null, firstSeen: "2015", lastSeen: "Aug 2018", isSubgroup: false, hadCounterOps: false },
        { name: "Patchwork", aliases: ["Dropping Elephant", "Chinastrats", "MONSOON", "Quilted Tiger", "APT-C-09", "Zinc Emerson", "Orange Atropos"], country: "IN", firstSeen: "2009", lastSeen: "Jul 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Pioneer Kitten", aliases: ["UNC757", "RUBIDIUM", "Lemon Sandstorm", "Fox Kitten", "Parisite"], country: "IR", firstSeen: "2017", lastSeen: "Aug 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Platinum", aliases: ["TwoForOne", "BRONZE KEYSTONE"], country: null, firstSeen: "2009", lastSeen: "Jun 2020", isSubgroup: false, hadCounterOps: false },
        { name: "Poseidon Group", aliases: [], country: "BR", firstSeen: "2005", lastSeen: "2016", isSubgroup: false, hadCounterOps: false },
        { name: "Promethium", aliases: ["StrongPity"], country: "TR", firstSeen: "2012", lastSeen: "Jul 2022", isSubgroup: false, hadCounterOps: false },
        { name: "Qilin", aliases: ["Agenda"], country: "RU", firstSeen: "2022", lastSeen: "Dec 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Rancor", aliases: [], country: "CN", firstSeen: "2017", lastSeen: "2019", isSubgroup: false, hadCounterOps: false },
        { name: "REvil", aliases: ["Sodinokibi", "Gold Southfield", "Pinchy Spider"], country: "RU", firstSeen: "2019", lastSeen: "Nov 2021", isSubgroup: false, hadCounterOps: true },
        { name: "Rocke", aliases: ["Iron Group"], country: "CN", firstSeen: "2018", lastSeen: "Apr 2021", isSubgroup: false, hadCounterOps: false },
        { name: "Rocket Kitten", aliases: ["TEMP.Beanie", "Timberworm"], country: "IR", firstSeen: "2014", lastSeen: "May 2020", isSubgroup: false, hadCounterOps: false },
        { name: "Sandworm", aliases: ["Voodoo Bear", "IRIDIUM", "Telebots", "BlackEnergy", "Quedagh", "Seashell Blizzard", "ELECTRUM", "IRON VIKING", "Unit 74455"], country: "RU", firstSeen: "2009", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: true },
        { name: "Scarlet Mimic", aliases: [], country: "CN", firstSeen: "2014", lastSeen: "2016", isSubgroup: false, hadCounterOps: false },
        { name: "Shadow Brokers", aliases: [], country: "US", firstSeen: "2016", lastSeen: "Nov 2017", isSubgroup: false, hadCounterOps: true },
        { name: "ShinyHunters", aliases: [], country: null, firstSeen: "2020", lastSeen: "Aug 2025", isSubgroup: false, hadCounterOps: true },
        { name: "SideWinder", aliases: ["Rattlesnake", "T-APT-04", "APT-C-17", "Hardcore Nationalist", "BabyElephant"], country: "IN", firstSeen: "2012", lastSeen: "Nov 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Silence", aliases: ["WHISPER SPIDER"], country: "RU", firstSeen: "2016", lastSeen: "Nov 2021", isSubgroup: false, hadCounterOps: false },
        { name: "Silent Librarian", aliases: ["TA407", "Cobalt Dickens", "MABNA Institute"], country: "IR", firstSeen: "2013", lastSeen: "Feb 2024", isSubgroup: false, hadCounterOps: true },
        { name: "Sowbug", aliases: [], country: null, firstSeen: "2015", lastSeen: "2017", isSubgroup: false, hadCounterOps: false },
        { name: "Stealth Falcon", aliases: ["FruityArmor", "Project Raven"], country: "AE", firstSeen: "2012", lastSeen: "Aug 2019", isSubgroup: false, hadCounterOps: false },
        { name: "Syrian Electronic Army", aliases: ["SEA", "Deadeye Jackal"], country: "SY", firstSeen: "2011", lastSeen: "Aug 2021", isSubgroup: false, hadCounterOps: true },
        { name: "TA505", aliases: ["Graceful Spider", "Gold Evergreen", "GOLD TAHOE", "SectorJ04", "Hive0065"], country: "RU", firstSeen: "2006", lastSeen: "Nov 2022", isSubgroup: false, hadCounterOps: true },
        { name: "TA551", aliases: ["Shathak"], country: "RU", firstSeen: "2016", lastSeen: "Jan 2021", isSubgroup: false, hadCounterOps: false },
        { name: "TeamTNT", aliases: ["NARWHAL SPIDER"], country: "DE", firstSeen: "2019", lastSeen: "Dec 2021", isSubgroup: false, hadCounterOps: false },
        { name: "TEMP.Veles", aliases: ["XENOTIME", "TRITON"], country: "RU", firstSeen: "2014", lastSeen: "Jan 2019", isSubgroup: false, hadCounterOps: false },
        { name: "The Big Bang", aliases: [], country: null, firstSeen: "2017", lastSeen: null, isSubgroup: false, hadCounterOps: false },
        { name: "Tonto Team", aliases: ["CactusPete", "Karma Panda", "BRONZE HUNTLEY"], country: "CN", firstSeen: "2009", lastSeen: "Jan 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Tortoiseshell", aliases: ["IMPERIAL KITTEN", "Crimson Sandstorm"], country: "IR", firstSeen: "2018", lastSeen: "Nov 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Transparent Tribe", aliases: ["APT 36", "APT36", "ProjectM", "Mythic Leopard", "C-Major", "COPPER FIELDSTONE", "Earth Karkaddan"], country: "PK", firstSeen: "2013", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: false },
        { name: "Tropic Trooper", aliases: ["KeyBoy", "Pirate Panda", "APT23", "BRONZE HOBART", "Earth Centaur"], country: "CN", firstSeen: "2011", lastSeen: "Jun 2024", isSubgroup: false, hadCounterOps: false },
        { name: "Turla", aliases: ["Snake", "Venomous Bear", "Waterbug", "Uroburos", "KRYPTON", "Secret Blizzard", "IRON HUNTER", "Pacifier APT"], country: "RU", firstSeen: "1996", lastSeen: "Feb 2025", isSubgroup: false, hadCounterOps: false },
        { name: "UNC1151", aliases: ["Ghostwriter", "Storm-0257"], country: "BY", firstSeen: "2017", lastSeen: "Nov 2024", isSubgroup: false, hadCounterOps: false },
        { name: "UNC2452", aliases: ["NOBELIUM", "Dark Halo", "StellarParticle", "SolarStorm", "Midnight Blizzard"], country: "RU", firstSeen: "2019", lastSeen: "Dec 2020", isSubgroup: false, hadCounterOps: false },
        { name: "Vice Society", aliases: ["DEV-0832", "Vanilla Tempest"], country: null, firstSeen: "2021", lastSeen: "Sep 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Volt Typhoon", aliases: ["BRONZE SILHOUETTE", "Vanguard Panda", "DEV-0391", "Insidious Taurus"], country: "CN", firstSeen: "2021", lastSeen: "Jan 2025", isSubgroup: false, hadCounterOps: false },
        { name: "Winnti", aliases: ["Winnti Group", "Wicked Panda", "BARIUM", "Blackfly", "APT41", "LEAD"], country: "CN", firstSeen: "2010", lastSeen: "Aug 2022", isSubgroup: false, hadCounterOps: false },
        { name: "Wizard Spider", aliases: ["UNC1878", "Gold Blackburn", "Grim Spider", "TrickBot", "Conti Team"], country: "RU", firstSeen: "2016", lastSeen: "Feb 2024", isSubgroup: false, hadCounterOps: true },
        { name: "XDSpy", aliases: [], country: null, firstSeen: "2011", lastSeen: "Aug 2022", isSubgroup: false, hadCounterOps: false },
        { name: "YoroTrooper", aliases: [], country: "KZ", firstSeen: "2022", lastSeen: "Jun 2023", isSubgroup: false, hadCounterOps: false },
        { name: "Zebrocy", aliases: [], country: "RU", firstSeen: "2015", lastSeen: "Jan 2021", isSubgroup: false, hadCounterOps: false }
    ];

    /**
     * Parse observation period string into firstSeen and lastSeen dates
     * @param {string} period - e.g., "2007-Nov 2017", "2022", "2018-Jun 2022"
     * @returns {Object} { firstSeen, lastSeen }
     */
    function parseObservationPeriod(period) {
        if (!period) return { firstSeen: null, lastSeen: null };
        
        period = period.trim();
        
        // Single year: "2022"
        if (/^\d{4}$/.test(period)) {
            return { firstSeen: period, lastSeen: null };
        }
        
        // Year range: "2007-Nov 2017" or "2018-Jun 2022" or "2014-2020"
        const rangeMatch = period.match(/^(\d{4})[-–](.+)$/);
        if (rangeMatch) {
            return { 
                firstSeen: rangeMatch[1], 
                lastSeen: rangeMatch[2].trim()
            };
        }
        
        return { firstSeen: period, lastSeen: null };
    }

    /**
     * Get all ETDA actor data
     */
    function getAllActors() {
        return ETDA_ACTORS;
    }

    /**
     * Country code to name mapping
     */
    const COUNTRY_NAMES = {
        'CN': 'China', 'RU': 'Russia', 'IR': 'Iran', 'KP': 'North Korea',
        'US': 'United States', 'VN': 'Vietnam', 'IN': 'India', 'PK': 'Pakistan',
        'KR': 'South Korea', 'GB': 'United Kingdom', 'IL': 'Israel', 'TR': 'Turkey',
        'UA': 'Ukraine', 'SY': 'Syria', 'LB': 'Lebanon', 'ES': 'Spain',
        'DE': 'Germany', 'BR': 'Brazil', 'CO': 'Colombia', 'BY': 'Belarus',
        'KZ': 'Kazakhstan', 'AE': 'UAE', 'ID': 'Indonesia', 'PS': 'Palestine',
        'EG': 'Egypt', 'SA': 'Saudi Arabia', 'IQ': 'Iraq', 'MM': 'Myanmar',
        'TW': 'Taiwan', 'PH': 'Philippines', 'MY': 'Malaysia', 'TH': 'Thailand'
    };

    /**
     * Normalize APT group names to match MISP/MITRE format
     * Converts "APT 1" -> "APT1", "APT 29" -> "APT29", etc.
     */
    function normalizeAPTName(name) {
        if (!name) return name;
        
        return name
            .replace(/\bAPT\s+(\d+)/gi, 'APT$1')    // "APT 1" -> "APT1"
            .replace(/\bAPT-(\d+)/gi, 'APT$1')      // "APT-1" -> "APT1"
            .replace(/\bUNC\s+(\d+)/gi, 'UNC$1')    // "UNC 1878" -> "UNC1878"
            .replace(/\bTA\s+(\d+)/gi, 'TA$1')      // "TA 505" -> "TA505"
            .replace(/\bFIN\s+(\d+)/gi, 'FIN$1')    // "FIN 7" -> "FIN7"
            .replace(/\bG\s+(\d+)/gi, 'G$1');       // "G 0001" -> "G0001"
    }

    /**
     * Find actor by name (case-insensitive)
     * Returns actor object with countryName added
     */
    function findActor(name) {
        if (!name) return null;
        
        // Normalize the input name (remove APT spaces, normalize separators)
        const normalized = normalizeAPTName(name).toLowerCase().trim()
            .replace(/\s+/g, ' ')  // Normalize spaces
            .replace(/[_-]/g, ' '); // Normalize separators
        
        const actor = ETDA_ACTORS.find(actor => {
            // Check main name (also normalize it)
            const actorName = normalizeAPTName(actor.name).toLowerCase().replace(/[_-]/g, ' ');
            if (actorName === normalized) return true;
            
            // Check aliases (normalize them too)
            return actor.aliases.some(alias => {
                const aliasNorm = normalizeAPTName(alias).toLowerCase().replace(/[_-]/g, ' ');
                return aliasNorm === normalized;
            });
        });

        // Add countryName if actor found
        if (actor && actor.country) {
            return {
                ...actor,
                countryName: COUNTRY_NAMES[actor.country] || actor.country
            };
        }
        
        return actor;
    }

    /**
     * Get timeline data for an actor
     */
    function getTimeline(name) {
        const actor = findActor(name);
        if (!actor) return null;
        
        return {
            firstSeen: actor.firstSeen,
            lastSeen: actor.lastSeen,
            isActive: !actor.lastSeen || actor.lastSeen.includes('2024') || actor.lastSeen.includes('2025'),
            hadCounterOps: actor.hadCounterOps
        };
    }

    /**
     * Enrich existing actors with ETDA data
     */
    function enrichActors(actors) {
        if (!Array.isArray(actors)) return actors;
        
        let enrichedCount = 0;
        let timelineAddedCount = 0;
        
        actors.forEach(actor => {
            // Try to find matching ETDA actor
            let etdaActor = findActor(actor.name);
            
            // Try aliases if no direct match
            if (!etdaActor && actor.aliases) {
                for (const alias of actor.aliases) {
                    etdaActor = findActor(alias);
                    if (etdaActor) break;
                }
            }
            
            if (etdaActor) {
                // Add/update timeline data
                if (etdaActor.firstSeen) {
                    if (!actor.firstSeen) {
                        actor.firstSeen = etdaActor.firstSeen;
                        timelineAddedCount++;
                    }
                }
                
                if (etdaActor.lastSeen) {
                    actor.lastSeen = etdaActor.lastSeen;
                    actor.isActive = etdaActor.lastSeen.includes('2024') || etdaActor.lastSeen.includes('2025');
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
        
        console.log(`[ETDA] Enriched ${enrichedCount} actors (${timelineAddedCount} new timeline entries)`);
        return actors;
    }

    /**
     * Get all actors with timeline data
     */
    function getActorsWithTimeline() {
        return ETDA_ACTORS.filter(a => a.firstSeen);
    }

    /**
     * Get actors by country
     */
    function getActorsByCountry(countryCode) {
        return ETDA_ACTORS.filter(a => a.country === countryCode);
    }

    /**
     * Get actors that had counter-operations against them
     */
    function getActorsWithCounterOps() {
        return ETDA_ACTORS.filter(a => a.hadCounterOps);
    }

    /**
     * Get subgroups of a parent group
     */
    function getSubgroups(parentName) {
        return ETDA_ACTORS.filter(a => a.isSubgroup && a.parentGroup === parentName);
    }

    /**
     * Get statistics
     */
    function getStats() {
        const withTimeline = ETDA_ACTORS.filter(a => a.firstSeen).length;
        const withLastSeen = ETDA_ACTORS.filter(a => a.lastSeen).length;
        const active = ETDA_ACTORS.filter(a => {
            if (!a.lastSeen) return true;
            return a.lastSeen.includes('2024') || a.lastSeen.includes('2025');
        }).length;
        const withCounterOps = ETDA_ACTORS.filter(a => a.hadCounterOps).length;
        
        const countries = {};
        ETDA_ACTORS.forEach(a => {
            if (a.country) {
                countries[a.country] = (countries[a.country] || 0) + 1;
            }
        });
        
        return {
            totalActors: ETDA_ACTORS.length,
            withTimeline,
            withLastSeen,
            activeActors: active,
            withCounterOps,
            countryCounts: countries,
            totalAliases: ETDA_ACTORS.reduce((sum, a) => sum + a.aliases.length, 0)
        };
    }

    // Public API
    return {
        getAllActors,
        findActor,
        getTimeline,
        enrichActors,
        getActorsWithTimeline,
        getActorsByCountry,
        getActorsWithCounterOps,
        getSubgroups,
        getStats,
        parseObservationPeriod
    };
})();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ETDAParser;
}

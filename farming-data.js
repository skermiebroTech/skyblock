/* =========================================================================
 * farming-data.js — EliteFarmers-inspired Farming constants for Hypixie
 *
 * Sources / inspiration:
 * - EliteFarmers/FarmingWeight (MIT): crops, farming-weight divisors, garden
 *   level steps, crop milestone steps, pest brackets, Garden Chip stat names.
 * - EliteFarmers/Website (GPL-3.0): page decomposition and labels only.
 *
 * No build step: plain browser globals.
 * ======================================================================= */
"use strict";

window.HYPIXIE_FARMING_CROPS = [
  { id: "CACTUS", name: "Cactus", icon: "CACTUS", weightDivisor: 178730.65, npc: 4, drops: 2, breaks: 2, baseBreaksPerMinute: 1180, toolIds: ["CACTUS_KNIFE"], pest: "Mite", pestId: "mite", exportable: false, craftItems: ["ENCHANTED_CACTUS_GREEN", "ENCHANTED_CACTUS"] },
  { id: "CARROT_ITEM", name: "Carrot", icon: "CARROT_ITEM", weightDivisor: 300000, npc: 3, drops: 3, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_CARROT_1", "THEORETICAL_HOE_CARROT_2", "THEORETICAL_HOE_CARROT_3"], pest: "Cricket", pestId: "cricket", exportable: true, exportableItem: "EXPORTABLE_CARROTS", craftItems: ["ENCHANTED_CARROT", "ENCHANTED_GOLDEN_CARROT"] },
  { id: "INK_SACK:3", aliases: ["COCOA_BEANS"], name: "Cocoa Beans", icon: "COCOA_BEANS", weightDivisor: 276733.75, npc: 3, drops: 3, baseBreaksPerMinute: 1180, toolIds: ["COCO_CHOPPER"], pest: "Moth", pestId: "moth", exportable: true, exportableItem: "SUPREME_CHOCOLATE_BAR", craftItems: ["ENCHANTED_COCOA", "ENCHANTED_COOKIE"] },
  { id: "MELON", name: "Melon", icon: "MELON", weightDivisor: 488435.88, npc: 2, drops: 5, baseBreaksPerMinute: 1180, toolIds: ["MELON_DICER", "MELON_DICER_2", "MELON_DICER_3"], pest: "Earthworm", pestId: "worm", exportable: false, craftItems: ["ENCHANTED_MELON", "ENCHANTED_MELON_BLOCK"] },
  { id: "MUSHROOM_COLLECTION", aliases: ["MUSHROOM", "BROWN_MUSHROOM", "RED_MUSHROOM"], name: "Mushroom", icon: "RED_MUSHROOM", weightDivisor: 90944.27, npc: 10, drops: 1, baseBreaksPerMinute: 1180, toolIds: ["FUNGI_CUTTER"], pest: "Slug", pestId: "slug", exportable: true, exportableItem: "HALF_EATEN_MUSHROOM", mushroomSpecial: true, craftItems: ["ENCHANTED_BROWN_MUSHROOM", "ENCHANTED_BROWN_MUSHROOM_BLOCK", "ENCHANTED_RED_MUSHROOM", "ENCHANTED_RED_MUSHROOM_BLOCK"], rngItems: [{ id: "BURROWING_SPORES", chance: 1 / 250000 }] },
  { id: "NETHER_STALK", name: "Nether Wart", icon: "NETHER_STALK", weightDivisor: 248606.81, npc: 4, drops: 2.5, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_WARTS_1", "THEORETICAL_HOE_WARTS_2", "THEORETICAL_HOE_WARTS_3"], pest: "Beetle", pestId: "beetle", exportable: true, exportableItem: "WARTY", craftItems: ["ENCHANTED_NETHER_STALK", "MUTANT_NETHER_STALK"] },
  { id: "POTATO_ITEM", name: "Potato", icon: "POTATO_ITEM", weightDivisor: 298328.17, npc: 3, drops: 3, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_POTATO_1", "THEORETICAL_HOE_POTATO_2", "THEORETICAL_HOE_POTATO_3"], pest: "Locust", pestId: "locust", exportable: false, craftItems: ["ENCHANTED_POTATO", "ENCHANTED_BAKED_POTATO"] },
  { id: "PUMPKIN", name: "Pumpkin", icon: "PUMPKIN", weightDivisor: 99236.12, npc: 10, drops: 1, baseBreaksPerMinute: 1180, toolIds: ["PUMPKIN_DICER", "PUMPKIN_DICER_2", "PUMPKIN_DICER_3"], pest: "Rat", pestId: "rat", exportable: true, exportableItem: "EXPIRED_PUMPKIN", craftItems: ["ENCHANTED_PUMPKIN", "POLISHED_PUMPKIN"] },
  { id: "SUGAR_CANE", name: "Sugar Cane", icon: "SUGAR_CANE", weightDivisor: 198885.45, npc: 4, drops: 2, breaks: 2, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_CANE_1", "THEORETICAL_HOE_CANE_2", "THEORETICAL_HOE_CANE_3"], pest: "Mosquito", pestId: "mosquito", exportable: false, craftItems: ["ENCHANTED_SUGAR", "ENCHANTED_SUGAR_CANE"] },
  { id: "WHEAT", name: "Wheat", icon: "WHEAT", weightDivisor: 100000, npc: 1, drops: 1, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_WHEAT_1", "THEORETICAL_HOE_WHEAT_2", "THEORETICAL_HOE_WHEAT_3"], pest: "Fly", pestId: "fly", exportable: false, craftItems: ["ENCHANTED_BREAD", "ENCHANTED_HAY_BLOCK"] },
  { id: "DOUBLE_PLANT", aliases: ["SUNFLOWER"], name: "Sunflower", icon: "DOUBLE_PLANT", weightDivisor: 200000, npc: 2, drops: 1, baseBreaksPerMinute: 950, toolIds: [], pest: "Dragonfly", pestId: "dragonfly", flower: true, craftItems: [] },
  { id: "MOONFLOWER", name: "Moonflower", icon: "MOONFLOWER", weightDivisor: 200000, npc: 2, drops: 1, baseBreaksPerMinute: 950, toolIds: [], pest: "Firefly", pestId: "firefly", flower: true, craftItems: [] },
  { id: "WILD_ROSE", name: "Wild Rose", icon: "WILD_ROSE", weightDivisor: 200000, npc: 2, drops: 1, baseBreaksPerMinute: 950, toolIds: [], pest: "Mantis", pestId: "mantis", flower: true, craftItems: [] },
];

window.HYPIXIE_FARMING_BONUS_WEIGHT = {
  farming50: 100,
  farming60: 250,
  anitaPerLevel: 2,
  tier12Minion: 5,
  maxMedalsCounted: 1000,
  diamondMedal: 0.75,
  platinumMedal: 0.5,
  goldMedal: 0.25,
};

window.HYPIXIE_FARMING_TIER12_MINIONS = new Set([
  "WHEAT_12", "CARROT_12", "POTATO_12", "PUMPKIN_12", "MELON_12", "MUSHROOM_12",
  "COCOA_12", "CACTUS_12", "SUGAR_CANE_12", "NETHER_WARTS_12", "FLOWER_12", "SUNFLOWER_12",
]);

window.HYPIXIE_GARDEN_EXP_REQUIRED = [0, 70, 70, 140, 240, 600, 1500, 2000, 2500, 3000, 10000, 10000, 10000, 10000, 10000];

window.HYPIXIE_CROP_MILESTONES = {
  WHEAT: [30,50,80,200,350,700,1500,2500,3500,5000,6500,8000,10000,20000,35000,50000,75000,100000,175000,250000,375000,400000,450000,650000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000],
  CARROT_ITEM: [100,150,250,500,1000,2000,4500,9000,12000,15000,20000,25000,35000,70000,120000,180000,250000,350000,600000,850000,1100000,1400000,1800000,2200000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000],
  POTATO_ITEM: [100,150,250,500,1000,2000,4500,9000,12000,15000,20000,25000,35000,70000,120000,180000,250000,350000,600000,850000,1100000,1400000,1800000,2200000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000,2600000],
  MELON: [150,250,400,1000,1750,3500,7500,12500,17500,25000,32500,40000,50000,100000,175000,250000,375000,500000,875000,1250000,1875000,2000000,2250000,3250000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000,4000000],
  PUMPKIN: [30,50,80,200,350,700,1500,2500,3500,5000,6500,8000,10000,20000,35000,50000,75000,100000,175000,250000,375000,400000,450000,650000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000],
  SUGAR_CANE: [60,100,160,400,700,1400,3000,5000,7000,10000,13000,16000,20000,40000,70000,100000,150000,200000,350000,500000,750000,800000,900000,1300000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000],
  "INK_SACK:3": [90,150,240,600,1050,2100,4500,7500,10500,15000,19500,24000,30000,60000,105000,150000,225000,300000,525000,750000,1125000,1200000,1350000,1950000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000],
  CACTUS: [60,100,160,400,700,1400,3000,5000,7000,10000,13000,16000,20000,40000,70000,100000,150000,200000,350000,500000,750000,800000,900000,1300000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000],
  MUSHROOM_COLLECTION: [30,50,80,200,350,700,1500,2500,3500,5000,6500,8000,10000,20000,35000,50000,75000,100000,175000,250000,375000,400000,450000,650000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000],
  NETHER_STALK: [90,150,240,600,1050,2100,4500,7500,10500,15000,19500,24000,30000,60000,105000,150000,225000,300000,525000,750000,1125000,1200000,1350000,1950000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000,2400000],
  DOUBLE_PLANT: [30,50,80,200,350,700,1500,2500,3500,5000,6500,8000,10000,20000,35000,50000,75000,100000,175000,250000,375000,400000,450000,650000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000],
  MOONFLOWER: [30,50,80,200,700,700,1500,2500,3500,5000,6500,8000,10000,20000,35000,50000,75000,100000,175000,250000,375000,400000,450000,650000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000,800000],
  WILD_ROSE: [60,100,160,400,700,1400,3000,5000,7000,10000,13000,16000,20000,40000,70000,100000,150000,200000,350000,500000,750000,800000,900000,1300000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000,1600000],
};

window.HYPIXIE_PEST_BESTIARY = [
  { id: "beetle", aliases: ["pest_beetle_1"], name: "Beetle", crop: "NETHER_STALK" },
  { id: "cricket", aliases: ["pest_cricket_1"], name: "Cricket", crop: "CARROT_ITEM" },
  { id: "worm", aliases: ["pest_worm_1", "earthworm"], name: "Earthworm", crop: "MELON" },
  { id: "fly", aliases: ["pest_fly_1"], name: "Fly", crop: "WHEAT" },
  { id: "locust", aliases: ["pest_locust_1"], name: "Locust", crop: "POTATO_ITEM" },
  { id: "mite", aliases: ["pest_mite_1"], name: "Mite", crop: "CACTUS" },
  { id: "mosquito", aliases: ["pest_mosquito_1"], name: "Mosquito", crop: "SUGAR_CANE" },
  { id: "moth", aliases: ["pest_moth_1"], name: "Moth", crop: "INK_SACK:3" },
  { id: "rat", aliases: ["pest_rat_1"], name: "Rat", crop: "PUMPKIN" },
  { id: "slug", aliases: ["pest_slug_1"], name: "Slug", crop: "MUSHROOM_COLLECTION" },
  { id: "mouse", aliases: ["pest_mouse_1", "field_mouse"], name: "Field Mouse", crop: null, mouse: true },
  { id: "dragonfly", aliases: ["pest_dragonfly_1"], name: "Dragonfly", crop: "DOUBLE_PLANT" },
  { id: "firefly", aliases: ["pest_firefly_1"], name: "Firefly", crop: "MOONFLOWER" },
  { id: "mantis", aliases: ["praying_mantis", "pest_praying_mantis_1"], name: "Mantis", crop: "WILD_ROSE" },
  { id: "lunar_moth", aliases: ["pest_lunar_moth_1"], name: "Lunar Moth", crop: null, mouse: true },
  { id: "zombuddy", aliases: ["zombuddy_1"], name: "Zombuddy", crop: null },
  { id: "timestalk_clone", aliases: ["timestalk_clone_100"], name: "Timestalk Clone", crop: null, short: true },
];

window.HYPIXIE_PEST_DEFAULT_BRACKETS = [1, 2, 3, 5, 7, 9, 14, 17, 21, 25, 50, 80, 125, 175, 250];
window.HYPIXIE_PEST_MOUSE_BRACKETS = [1, 2, 3, 5, 7, 9, 11, 14, 17, 20, 30, 40, 55, 75, 100];
window.HYPIXIE_PEST_SHORT_BRACKETS = [1, 2, 3, 5, 7, 9, 11, 14, 17, 20];
window.HYPIXIE_PEST_FORTUNE_PER_BRACKET = 0.4;

window.HYPIXIE_FARMING_SOURCE_MATRIX = [
  { id: "farming-level", title: "Farming Level", category: "General", max: 60, fortunePerLevel: 4, source: "Profile Farming XP", wiki: "https://wiki.hypixel.net/Farming" },
  { id: "anita", title: "Anita Farming Fortune", category: "Jacob", max: 15, fortunePerLevel: 4, source: "Jacob's Tickets + medals", wiki: "https://wiki.hypixel.net/Anita" },
  { id: "crop-upgrades", title: "Garden Crop Upgrades", category: "Garden", max: 10, fortunePerLevel: 5, source: "Garden Desk crop upgrade levels", wiki: "https://wiki.hypixel.net/Garden" },
  { id: "plots", title: "Unlocked Plots", category: "Garden", max: 24, fortunePerLevel: 0, source: "Composter materials + copper", wiki: "https://wiki.hypixel.net/Garden_Plot" },
  { id: "pest-bestiary", title: "Garden Pest Bestiary", category: "Pests", max: 15, fortunePerLevel: 0.4, source: "Pest kill brackets", wiki: "https://wiki.hypixel.net/Pest" },
  { id: "garden-chips", title: "Garden Chips", category: "Garden", max: 20, fortunePerLevel: 0, source: "See Hypixie Garden Chips tab", wiki: "https://wiki.hypixel.net/Garden_Chip" },
  { id: "tools", title: "Crop Tools", category: "Gear", max: 5, fortunePerLevel: 0, source: "Dicer / Mathematical Hoe / crop-specific tools", wiki: "https://wiki.hypixel.net/Farming_Tools" },
  { id: "armor", title: "Farming Armor & Equipment", category: "Gear", max: 4, fortunePerLevel: 0, source: "Cropie, Squash, Fermento, Lotus, attributes", wiki: "https://wiki.hypixel.net/Farming_Fortune" },
];

window.HYPIXIE_GARDEN_VISITORS = [
  {
    "id": "adventurer",
    "name": "Adventurer",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Adventurer"
  },
  {
    "id": "alchemist",
    "name": "Alchemist",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Alchemist"
  },
  {
    "id": "andrew",
    "name": "Andrew",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Andrew"
  },
  {
    "id": "anita",
    "name": "Anita",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Anita"
  },
  {
    "id": "arthur",
    "name": "Arthur",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Arthur"
  },
  {
    "id": "baker",
    "name": "Baker",
    "rarity": "LEGENDARY",
    "wiki": "https://wiki.hypixel.net/Baker"
  },
  {
    "id": "banker_broadjaw",
    "name": "Banker Broadjaw",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Banker_Broadjaw"
  },
  {
    "id": "bartender",
    "name": "Bartender",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Bartender"
  },
  {
    "id": "beth",
    "name": "Beth",
    "rarity": "LEGENDARY",
    "wiki": "https://wiki.hypixel.net/Beth"
  },
  {
    "id": "seraphine",
    "name": "Clerk Seraphine",
    "rarity": "LEGENDARY",
    "wiki": "https://wiki.hypixel.net/Clerk_Seraphine"
  },
  {
    "id": "dalbrek",
    "name": "Dalbrek",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Dalbrek"
  },
  {
    "id": "duke",
    "name": "Duke",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Duke"
  },
  {
    "id": "dusk",
    "name": "Dusk",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Dusk"
  },
  {
    "id": "emissary_carlton",
    "name": "Emissary Carlton",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Emissary_Carlton"
  },
  {
    "id": "emissary_ceanna",
    "name": "Emissary Ceanna",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Emissary_Ceanna"
  },
  {
    "id": "emissary_fraiser",
    "name": "Emissary Fraiser",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Emissary_Fraiser"
  },
  {
    "id": "emissary_sisko",
    "name": "Emissary Sisko",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Emissary_Sisko"
  },
  {
    "id": "emissary_wilson",
    "name": "Emissary Wilson",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Emissary_Wilson"
  },
  {
    "id": "farmer_jon",
    "name": "Farmer Jon",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Farmer_Jon"
  },
  {
    "id": "farmhand",
    "name": "Farmhand",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Farmhand"
  },
  {
    "id": "fear_mongerer",
    "name": "Fear Mongerer",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Fear_Mongerer"
  },
  {
    "id": "felix",
    "name": "Felix",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Felix"
  },
  {
    "id": "fisherman",
    "name": "Fisherman",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Fisherman"
  },
  {
    "id": "fragilis",
    "name": "Fragilis",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Fragilis"
  },
  {
    "id": "friendly_hiker",
    "name": "Friendly Hiker",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Friendly_Hiker"
  },
  {
    "id": "geonathan_greatforge",
    "name": "Geonathan Greatforge",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Geonathan_Greatforge"
  },
  {
    "id": "gimley",
    "name": "Gimley",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Gimley"
  },
  {
    "id": "gold_forger",
    "name": "Gold Forger",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Gold_Forger"
  },
  {
    "id": "grandma_wolf",
    "name": "Grandma Wolf",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Grandma_Wolf"
  },
  {
    "id": "guy",
    "name": "Guy",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Guy"
  },
  {
    "id": "gwendolyn",
    "name": "Gwendolyn",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Gwendolyn"
  },
  {
    "id": "hornum",
    "name": "Hornum",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Hornum"
  },
  {
    "id": "hungry_hiker",
    "name": "Hungry Hiker",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Hungry_Hiker"
  },
  {
    "id": "iron_forger",
    "name": "Iron Forger",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Iron_Forger"
  },
  {
    "id": "jack",
    "name": "Jack",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Jack"
  },
  {
    "id": "jacob",
    "name": "Jacob",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Jacob"
  },
  {
    "id": "jamie",
    "name": "Jamie",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Jamie"
  },
  {
    "id": "jerry",
    "name": "Jerry",
    "rarity": "LEGENDARY",
    "wiki": "https://wiki.hypixel.net/Jerry"
  },
  {
    "id": "jotraeline_greatforge",
    "name": "Jotraeline Greatforge",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Jotraeline_Greatforge"
  },
  {
    "id": "lazy_miner",
    "name": "Lazy Miner",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Lazy_Miner"
  },
  {
    "id": "leo",
    "name": "Leo",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Leo"
  },
  {
    "id": "liam",
    "name": "Liam",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Liam"
  },
  {
    "id": "librarian",
    "name": "Librarian",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Librarian"
  },
  {
    "id": "lumberjack",
    "name": "Lumber Jack",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Lumber_Jack"
  },
  {
    "id": "lumina",
    "name": "Lumina",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Lumina"
  },
  {
    "id": "lynn",
    "name": "Lynn",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Lynn"
  },
  {
    "id": "madame_eleanor",
    "name": "Madame Eleanor Q. Goldsworth III",
    "rarity": "LEGENDARY",
    "wiki": "https://wiki.hypixel.net/Madame_Eleanor_Q._Goldsworth_III",
    "short": "Madame Eleanor"
  },
  {
    "id": "maeve",
    "name": "Maeve",
    "rarity": "MYTHIC",
    "wiki": "https://wiki.hypixel.net/Maeve"
  },
  {
    "id": "mason",
    "name": "Mason",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Mason"
  },
  {
    "id": "odawa",
    "name": "Odawa",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Odawa"
  },
  {
    "id": "old_man_garry",
    "name": "Old Man Garry",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Old_Man_Garry"
  },
  {
    "id": "oringo",
    "name": "Oringo",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Oringo"
  },
  {
    "id": "pest_wrangler",
    "name": "Pest Wrangler",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Pest_Wrangler"
  },
  {
    "id": "disguised_rats",
    "name": "Pest Wrangler?",
    "rarity": "LEGENDARY",
    "wiki": "https://wiki.hypixel.net/Pest_Wrangler%3F"
  },
  {
    "id": "bear_pete",
    "name": "Pete",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Pete"
  },
  {
    "id": "plumber_joe",
    "name": "Plumber Joe",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Plumber_Joe"
  },
  {
    "id": "puzzler",
    "name": "Puzzler",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Puzzler"
  },
  {
    "id": "queen_mismyla",
    "name": "Queen Mismyla",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Queen_Mismyla"
  },
  {
    "id": "ravenous_rhino",
    "name": "Ravenous Rhino",
    "rarity": "MYTHIC",
    "wiki": "https://wiki.hypixel.net/Ravenous_Rhino"
  },
  {
    "id": "rhys",
    "name": "Rhys",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Rhys"
  },
  {
    "id": "royal_resident_reward",
    "name": "Royal Resident",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Royal_Resident"
  },
  {
    "id": "royal_resident_peasant",
    "name": "Royal Resident (Snooty)",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Royal_Residents",
    "short": "Royal Res. (Snooty)"
  },
  {
    "id": "royal_resident_neighbour",
    "name": "Royal Resident (Neighbor)",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Royal_Residents",
    "short": "Royal Res. (Neighbor)"
  },
  {
    "id": "rusty",
    "name": "Rusty",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Rusty"
  },
  {
    "id": "ryu",
    "name": "Ryu",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Ryu"
  },
  {
    "id": "sargwyn",
    "name": "Sargwyn",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Sargwyn"
  },
  {
    "id": "seymour",
    "name": "Seymour",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Seymour"
  },
  {
    "id": "shaggy",
    "name": "Shaggy",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Shaggy"
  },
  {
    "id": "shifty",
    "name": "Shifty",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Shifty"
  },
  {
    "id": "sirius",
    "name": "Sirius",
    "rarity": "LEGENDARY",
    "wiki": "https://wiki.hypixel.net/Sirius"
  },
  {
    "id": "spaceman",
    "name": "Spaceman",
    "rarity": "SPECIAL",
    "wiki": "https://wiki.hypixel.net/Spaceman"
  },
  {
    "id": "stella",
    "name": "Stella",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Stella"
  },
  {
    "id": "tammy",
    "name": "Tammy",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Tammy"
  },
  {
    "id": "tarwen",
    "name": "Tarwen",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Tarwen"
  },
  {
    "id": "terry",
    "name": "Terry",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Terry"
  },
  {
    "id": "tia",
    "name": "Tia the Fairy",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Tia_the_Fairy"
  },
  {
    "id": "tom",
    "name": "Tom",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Tom"
  },
  {
    "id": "trevor",
    "name": "Trevor",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Trevor"
  },
  {
    "id": "vex",
    "name": "Vex",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Vex"
  },
  {
    "id": "vinyl_collector",
    "name": "Vinyl Collector",
    "rarity": "RARE",
    "wiki": "https://wiki.hypixel.net/Vinyl_Collector"
  },
  {
    "id": "weaponsmith",
    "name": "Weaponsmith",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Weaponsmith"
  },
  {
    "id": "wizard",
    "name": "Wizard",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Wizard"
  },
  {
    "id": "xalx",
    "name": "Xalx",
    "rarity": "UNCOMMON",
    "wiki": "https://wiki.hypixel.net/Xalx"
  },
  {
    "id": "carpenter",
    "name": "Carpenter",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Carpenter"
  },
  {
    "id": "chantelle",
    "name": "Chantelle",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Chantelle"
  },
  {
    "id": "farm_merchant",
    "name": "Farm Merchant",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Farm_Merchant"
  },
  {
    "id": "fire_guy",
    "name": "Fire Guy",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Fire_Guy"
  },
  {
    "id": "jacobus",
    "name": "Jacobus",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Jacobus"
  },
  {
    "id": "lift_operator",
    "name": "Lift Operator",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Lift_Operator"
  },
  {
    "id": "master_tactician",
    "name": "Master Tactician",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Master_Tactician"
  },
  {
    "id": "ophelia",
    "name": "Ophelia",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Ophelia"
  },
  {
    "id": "snowmaker",
    "name": "Snowmaker",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Snowmaker"
  },
  {
    "id": "zog",
    "name": "Zog",
    "rarity": "UNKNOWN",
    "wiki": "https://wiki.hypixel.net/Zog"
  }
];
window.HYPIXIE_GARDEN_VISITOR_TOTAL = window.HYPIXIE_GARDEN_VISITORS.length;

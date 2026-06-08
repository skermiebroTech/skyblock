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

window.HYPIXIE_GARDEN_VISITOR_TOTAL = 83;

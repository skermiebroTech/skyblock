/* =========================================================================
 * farming-data.js — Elite-style Farming constants for Hypixie
 *
 * Sources / inspiration:
 * - EliteFarmers/Website packages/farming-weight (GPL-compatible because this
 *   project is now GPL-3.0-or-later; the farming-weight package itself is MIT).
 * - Hypixel SkyBlock public profile fields and public wiki terminology.
 *
 * No build step: plain browser globals.
 * ======================================================================= */
"use strict";

window.HYPIXIE_FARMING_CROPS = [
  { id: "WHEAT", name: "Wheat", icon: "WHEAT", weightDivisor: 100000, npc: 1, drops: 1, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_WHEAT_1", "THEORETICAL_HOE_WHEAT_2", "THEORETICAL_HOE_WHEAT_3"], pest: "Fly" },
  { id: "CARROT_ITEM", name: "Carrot", icon: "CARROT_ITEM", weightDivisor: 300000, npc: 3, drops: 3, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_CARROT_1", "THEORETICAL_HOE_CARROT_2", "THEORETICAL_HOE_CARROT_3"], pest: "Cricket" },
  { id: "POTATO_ITEM", name: "Potato", icon: "POTATO_ITEM", weightDivisor: 298328.17, npc: 3, drops: 3, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_POTATO_1", "THEORETICAL_HOE_POTATO_2", "THEORETICAL_HOE_POTATO_3"], pest: "Locust" },
  { id: "PUMPKIN", name: "Pumpkin", icon: "PUMPKIN", weightDivisor: 99236.12, npc: 4, drops: 1, baseBreaksPerMinute: 1180, toolIds: ["PUMPKIN_DICER", "PUMPKIN_DICER_2", "PUMPKIN_DICER_3"], pest: "Rat" },
  { id: "MELON", name: "Melon", icon: "MELON", weightDivisor: 488435.88, npc: 2, drops: 5, baseBreaksPerMinute: 1180, toolIds: ["MELON_DICER", "MELON_DICER_2", "MELON_DICER_3"], pest: "Earthworm" },
  { id: "SUGAR_CANE", name: "Sugar Cane", icon: "SUGAR_CANE", weightDivisor: 198885.45, npc: 2, drops: 2, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_CANE_1", "THEORETICAL_HOE_CANE_2", "THEORETICAL_HOE_CANE_3"], pest: "Mosquito", doubleBreak: true },
  { id: "CACTUS", name: "Cactus", icon: "CACTUS", weightDivisor: 178730.65, npc: 4, drops: 2, baseBreaksPerMinute: 1180, toolIds: ["CACTUS_KNIFE"], pest: "Mite", doubleBreak: true },
  { id: "INK_SACK:3", aliases: ["COCOA_BEANS"], name: "Cocoa Beans", icon: "INK_SACK:3", weightDivisor: 276733.75, npc: 3, drops: 3, baseBreaksPerMinute: 1180, toolIds: ["COCO_CHOPPER"], pest: "Moth" },
  { id: "MUSHROOM_COLLECTION", aliases: ["MUSHROOM", "BROWN_MUSHROOM", "RED_MUSHROOM"], name: "Mushroom", icon: "RED_MUSHROOM", weightDivisor: 90944.27, npc: 4, drops: 1, baseBreaksPerMinute: 1180, toolIds: ["FUNGI_CUTTER"], pest: "Slug", mushroomSpecial: true },
  { id: "NETHER_STALK", name: "Nether Wart", icon: "NETHER_STALK", weightDivisor: 248606.81, npc: 4, drops: 2.5, baseBreaksPerMinute: 1180, toolIds: ["THEORETICAL_HOE_WARTS_1", "THEORETICAL_HOE_WARTS_2", "THEORETICAL_HOE_WARTS_3"], pest: "Beetle" },
  { id: "DOUBLE_PLANT", aliases: ["SUNFLOWER"], name: "Sunflower", icon: "DOUBLE_PLANT", weightDivisor: 200000, npc: 2, drops: 1, baseBreaksPerMinute: 950, toolIds: [], pest: "Dragonfly" },
  { id: "MOONFLOWER", name: "Moonflower", icon: "MOONFLOWER", weightDivisor: 200000, npc: 2, drops: 1, baseBreaksPerMinute: 950, toolIds: [], pest: "Firefly" },
  { id: "WILD_ROSE", name: "Wild Rose", icon: "WILD_ROSE", weightDivisor: 200000, npc: 2, drops: 1, baseBreaksPerMinute: 950, toolIds: [], pest: "Mantis" },
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

window.HYPIXIE_PEST_BESTIARY = [
  { id: "pest_beetle_1", name: "Beetle", crop: "NETHER_STALK" },
  { id: "pest_cricket_1", name: "Cricket", crop: "CARROT_ITEM" },
  { id: "pest_worm_1", name: "Earthworm", crop: "MELON" },
  { id: "pest_fly_1", name: "Fly", crop: "WHEAT" },
  { id: "pest_locust_1", name: "Locust", crop: "POTATO_ITEM" },
  { id: "pest_mite_1", name: "Mite", crop: "CACTUS" },
  { id: "pest_mosquito_1", name: "Mosquito", crop: "SUGAR_CANE" },
  { id: "pest_moth_1", name: "Moth", crop: "INK_SACK:3" },
  { id: "pest_rat_1", name: "Rat", crop: "PUMPKIN" },
  { id: "pest_slug_1", name: "Slug", crop: "MUSHROOM_COLLECTION" },
  { id: "pest_mouse_1", name: "Field Mouse", crop: null, mouse: true },
  { id: "pest_dragonfly_1", name: "Dragonfly", crop: "DOUBLE_PLANT" },
  { id: "pest_firefly_1", name: "Firefly", crop: "MOONFLOWER" },
  { id: "pest_praying_mantis_1", name: "Mantis", crop: "WILD_ROSE" },
  { id: "pest_lunar_moth_1", name: "Lunar Moth", crop: null, mouse: true },
  { id: "zombuddy_1", name: "Zombuddy", crop: null },
  { id: "timestalk_clone_100", name: "Timestalk Clone", crop: null, short: true },
];

window.HYPIXIE_PEST_DEFAULT_BRACKETS = [1, 2, 3, 5, 7, 9, 14, 17, 21, 25, 50, 80, 125, 175, 250];
window.HYPIXIE_PEST_MOUSE_BRACKETS = [1, 2, 3, 5, 7, 9, 11, 14, 17, 20, 30, 40, 55, 75, 100];
window.HYPIXIE_PEST_SHORT_BRACKETS = [1, 2, 3, 5, 7, 9, 11, 14, 17, 20];
window.HYPIXIE_PEST_FORTUNE_PER_BRACKET = 0.4;

window.HYPIXIE_FARMING_UPGRADE_HINTS = [
  { id: "farming-level", title: "Farming level", category: "Skill", max: 60, fortunePerLevel: 4, source: "Profile Farming XP", wiki: "Farming" },
  { id: "anita", title: "Anita Farming Fortune", category: "Jacob", max: 15, fortunePerLevel: 4, source: "Jacob's Tickets + medals", wiki: "Anita" },
  { id: "crop-upgrades", title: "Crop upgrades", category: "Garden", max: 10, fortunePerLevel: 5, source: "Garden crop upgrade levels", wiki: "Garden" },
  { id: "plots", title: "Unlocked plots", category: "Garden", max: 24, fortunePerLevel: 0, source: "Composter materials + copper", wiki: "Garden Plot" },
  { id: "garden-chips", title: "Garden Chips", category: "Garden", max: 20, fortunePerLevel: 0, source: "See Hypixie Garden Chips tab", wiki: "Garden Chips" },
  { id: "pest-bestiary", title: "Garden pest bestiary", category: "Pests", max: 15, fortunePerLevel: 0.4, source: "Bestiary brackets", wiki: "Pest" },
  { id: "vacuum", title: "Vacuum / pest gear", category: "Pests", max: 5, fortunePerLevel: 0, source: "Pest equipment progression", wiki: "Vacuum" },
];

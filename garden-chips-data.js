/* =========================================================================
 * garden-chips-data.js
 *
 * Static Garden Chip metadata sourced from the Hypixel SkyBlock Fandom
 * Garden Chips page (MediaWiki API), paired with live Bazaar prices in script.js.
 * ========================================================================= */
"use strict";

const GARDEN_CHIP_RARITIES = {
  RARE:      { label: "Rare",      copies: 1,  maxLevel: 10, color: "#55ffff" },
  EPIC:      { label: "Epic",      copies: 4,  maxLevel: 15, color: "#aa00aa" },
  LEGENDARY: { label: "Legendary", copies: 16, maxLevel: 20, color: "#ffaa00" },
};

const GARDEN_CHIP_LEVEL_COSTS = [
  0,
  0,
  100_000,
  200_000,
  300_000,
  400_000,
  550_000,
  700_000,
  850_000,
  1_000_000,
  1_150_000,
  1_300_000,
  1_450_000,
  1_600_000,
  1_750_000,
  1_900_000,
  2_050_000,
  2_200_000,
  2_350_000,
  2_500_000,
  2_650_000,
];

const GARDEN_CHIP_CUMULATIVE_SOWDUST = GARDEN_CHIP_LEVEL_COSTS.reduce((out, cost, level) => {
  out[level] = (out[level - 1] || 0) + cost;
  return out;
}, []);

const GARDEN_CHIPS = [
  {
    id: "VERMIN_VAPORIZER_GARDEN_CHIP",
    name: "Vermin Vaporizer Chip",
    ability: "Vermin Vaporizer",
    summary: "Grants +3 / +4 / +5 Bonus Pest Chance per chip level.",
    maxSummary: "Up to +30 / +60 / +100 Bonus Pest Chance.",
    source: "Rare Dragonfly drop (1%)",
    sourceType: "Drop",
  },
  {
    id: "SYNTHESIS_GARDEN_CHIP",
    name: "Synthesis Chip",
    ability: "Synthesis",
    summary: "Analyzing a mutation in the Crop Analyzer gives 1% / 1.5% / 2% more Copper per chip level.",
    maxSummary: "Up to 10% / 22.5% / 40% more Copper.",
    source: "Rare Greenhouse Harvest Bounty drop (3%)",
    sourceType: "Drop",
  },
  {
    id: "SOWLEDGE_GARDEN_CHIP",
    name: "Sowledge Chip",
    ability: "Sowledge",
    summary: "Grants +1 / +1.25 / +1.5 Farming Wisdom per chip level.",
    maxSummary: "Up to +10 / +18.75 / +30 Farming Wisdom.",
    source: "SkyMart for 200 Copper",
    sourceType: "SkyMart",
  },
  {
    id: "MECHAMIND_GARDEN_CHIP",
    name: "Mechamind Chip",
    ability: "Mechamind",
    summary: "Grants 1.5% / 2% / 2.5% more Farming Tool experience per chip level.",
    maxSummary: "Up to 15% / 30% / 50% Farming Tool XP.",
    source: "Anita for 1 Gold Medal",
    sourceType: "Anita",
  },
  {
    id: "HYPERCHARGE_GARDEN_CHIP",
    name: "Hypercharge Chip",
    ability: "Hypercharge",
    summary: "Temporary Farming Fortune buffs are 3% / 4% / 5% stronger per chip level.",
    maxSummary: "Up to 30% / 60% / 100% stronger temporary buffs.",
    source: "Rare Visitor Offer reward (2%)",
    sourceType: "Visitor",
  },
  {
    id: "EVERGREEN_GARDEN_CHIP",
    name: "Evergreen Chip",
    ability: "Evergreen",
    summary: "Gain 2% / 2.5% / 3% more base crops when harvesting in the Greenhouse per chip level.",
    maxSummary: "Up to 20% / 37.5% / 60% more base crops.",
    source: "Rare Greenhouse Harvest Bounty drop (3%)",
    sourceType: "Drop",
  },
  {
    id: "OVERDRIVE_GARDEN_CHIP",
    name: "Overdrive Chip",
    ability: "Overdrive",
    summary: "Grants +5 / +6 / +7 Crop Fortune for the active crop during Jacob's Farming Contest per chip level.",
    maxSummary: "Up to +50 / +90 / +140 Crop Fortune.",
    source: "Anita for 2 Gold Medals",
    sourceType: "Anita",
  },
  {
    id: "CROPSHOT_GARDEN_CHIP",
    name: "Cropshot Chip",
    ability: "Cropshot",
    summary: "Grants +3 / +4 / +5 Farming Fortune per chip level.",
    maxSummary: "Up to +30 / +60 / +100 Farming Fortune.",
    source: "SkyMart for 500 Copper; one free from Jeff",
    sourceType: "SkyMart",
  },
  {
    id: "QUICKDRAW_GARDEN_CHIP",
    name: "Quickdraw Chip",
    ability: "Quickdraw",
    summary: "Decreases the time for Visitors to appear when harvesting crops by 1.5% / 2% / 2.5% per chip level.",
    maxSummary: "Up to 15% / 30% / 50% faster Visitor appearances.",
    source: "Rare Visitor Offer reward (2%)",
    sourceType: "Visitor",
  },
  {
    id: "RAREFINDER_GARDEN_CHIP",
    name: "Rarefinder Chip",
    ability: "Rarefinder",
    summary: "Increases overbloom stats by 2 / 2.5 / 3 per chip level.",
    maxSummary: "Up to 20 / 37.5 / 60 overbloom stats.",
    source: "Very rare crop farming drop (0.00015%)",
    sourceType: "Drop",
  },
];

window.GARDEN_CHIP_RARITIES = GARDEN_CHIP_RARITIES;
window.GARDEN_CHIP_LEVEL_COSTS = GARDEN_CHIP_LEVEL_COSTS;
window.GARDEN_CHIP_CUMULATIVE_SOWDUST = GARDEN_CHIP_CUMULATIVE_SOWDUST;
window.GARDEN_CHIPS = GARDEN_CHIPS;

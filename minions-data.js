/* =========================================================================
 * minions-data.js
 *
 * Minion Maxing Calculator Data and Algorithms.
 * Standardizes recipes for 38 craftable minions across T1-T11.
 * ======================================================================= */

"use strict";

const MINIONS_DATA = [
  // Mining
  { id: "COBBLESTONE", name: "Cobblestone", category: "Mining", rawId: "COBBLESTONE", enchId: "ENCHANTED_COBBLESTONE" },
  { id: "COAL", name: "Coal", category: "Mining", rawId: "COAL", enchId: "ENCHANTED_COAL" },
  { id: "IRON", name: "Iron", category: "Mining", rawId: "IRON_INGOT", enchId: "ENCHANTED_IRON" },
  { id: "GOLD", name: "Gold", category: "Mining", rawId: "GOLD_INGOT", enchId: "ENCHANTED_GOLD" },
  { id: "DIAMOND", name: "Diamond", category: "Mining", rawId: "DIAMOND", enchId: "ENCHANTED_DIAMOND" },
  { id: "EMERALD", name: "Emerald", category: "Mining", rawId: "EMERALD", enchId: "ENCHANTED_EMERALD" },
  { id: "REDSTONE", name: "Redstone", category: "Mining", rawId: "REDSTONE", enchId: "ENCHANTED_REDSTONE" },
  { id: "LAPIS", name: "Lapis", category: "Mining", rawId: "INK_SACK:4", enchId: "ENCHANTED_LAPIS_LAZULI" },
  { id: "QUARTZ", name: "Quartz", category: "Mining", rawId: "NETHER_QUARTZ", enchId: "ENCHANTED_QUARTZ" },
  { id: "OBSIDIAN", name: "Obsidian", category: "Mining", rawId: "OBSIDIAN", enchId: "ENCHANTED_OBSIDIAN" },
  { id: "GRAVEL", name: "Gravel", category: "Mining", rawId: "FLINT", enchId: "ENCHANTED_FLINT" },
  { id: "SAND", name: "Sand", category: "Mining", rawId: "SAND", enchId: "ENCHANTED_SAND" },
  { id: "ICE", name: "Ice", category: "Mining", rawId: "ICE", enchId: "ENCHANTED_ICE" },
  { id: "END_STONE", name: "End Stone", category: "Mining", rawId: "END_STONE", enchId: "ENCHANTED_END_STONE" },
  { id: "CLAY", name: "Clay", category: "Mining", rawId: "CLAY_BALL", enchId: "ENCHANTED_CLAY" },

  // Foraging
  { id: "OAK", name: "Oak", category: "Foraging", rawId: "LOG", enchId: "ENCHANTED_OAK_LOG" },
  { id: "SPRUCE", name: "Spruce", category: "Foraging", rawId: "LOG:1", enchId: "ENCHANTED_SPRUCE_LOG" },
  { id: "BIRCH", name: "Birch", category: "Foraging", rawId: "LOG:2", enchId: "ENCHANTED_BIRCH_LOG" },
  { id: "JUNGLE", name: "Jungle", category: "Foraging", rawId: "LOG:3", enchId: "ENCHANTED_JUNGLE_LOG" },
  { id: "ACACIA", name: "Acacia", category: "Foraging", rawId: "LOG_2", enchId: "ENCHANTED_ACACIA_LOG" },
  { id: "DARK_OAK", name: "Dark Oak", category: "Foraging", rawId: "LOG_2:1", enchId: "ENCHANTED_DARK_OAK_LOG" },

  // Combat
  { id: "ZOMBIE", name: "Zombie", category: "Combat", rawId: "ROTTEN_FLESH", enchId: "ENCHANTED_ROTTEN_FLESH" },
  { id: "SKELETON", name: "Skeleton", category: "Combat", rawId: "BONE", enchId: "ENCHANTED_BONE" },
  { id: "CREEPER", name: "Creeper", category: "Combat", rawId: "GUNPOWDER", enchId: "ENCHANTED_GUNPOWDER" },
  { id: "SPIDER", name: "Spider", category: "Combat", rawId: "STRING", enchId: "ENCHANTED_STRING" },
  { id: "CAVE_SPIDER", name: "Cave Spider", category: "Combat", rawId: "SPIDER_EYE", enchId: "ENCHANTED_SPIDER_EYE" },
  { id: "ENDERMAN", name: "Enderman", category: "Combat", rawId: "ENDER_PEARL", enchId: "ENCHANTED_ENDER_PEARL" },
  { id: "SLIME", name: "Slime", category: "Combat", rawId: "SLIME_BALL", enchId: "ENCHANTED_SLIME_BALL" },
  { id: "MAGMA_CUBE", name: "Magma Cube", category: "Combat", rawId: "MAGMA_CREAM", enchId: "ENCHANTED_MAGMA_CREAM" },
  { id: "BLAZE", name: "Blaze", category: "Combat", rawId: "BLAZE_ROD", enchId: "ENCHANTED_BLAZE_ROD" },

  // Farming
  { id: "POTATO", name: "Potato", category: "Farming", rawId: "POTATO_ITEM", enchId: "ENCHANTED_POTATO" },
  { id: "CARROT", name: "Carrot", category: "Farming", rawId: "CARROT_ITEM", enchId: "ENCHANTED_CARROT" },
  { id: "MELON", name: "Melon", category: "Farming", rawId: "MELON", enchId: "ENCHANTED_MELON" },
  { id: "PUMPKIN", name: "Pumpkin", category: "Farming", rawId: "PUMPKIN", enchId: "ENCHANTED_PUMPKIN" },
  { id: "COCOA", name: "Cocoa", category: "Farming", rawId: "INK_SACK:3", enchId: "ENCHANTED_COOKIE" },
  { id: "SUGAR_CANE", name: "Sugar Cane", category: "Farming", rawId: "SUGAR_CANE", enchId: "ENCHANTED_SUGAR" },

  // Fishing
  { id: "FISHING", name: "Fishing", category: "Fishing", rawId: "RAW_FISH", enchId: "ENCHANTED_RAW_FISH" }
];

/* Helper to get the ingredient count and type for a minion tier upgrade.
 * Standardized Hypixel minion progression rules. */
function getMinionRecipe(minion, tier) {
  if (tier < 1 || tier > 11) return null;

  const isRaw = tier <= 4;
  const itemId = isRaw ? minion.rawId : minion.enchId;

  let qty = 0;
  if (tier === 1) qty = 80;
  else if (tier === 2) qty = 160;
  else if (tier === 3) qty = 320;
  else if (tier === 4) qty = 512;
  else if (tier === 5) qty = 8;
  else if (tier === 6) qty = 16;
  else if (tier === 7) qty = 32;
  else if (tier === 8) qty = 64;
  else if (tier === 9) qty = 128;
  else if (tier === 10) qty = 256;
  else if (tier === 11) qty = 512;

  return { itemId, qty };
}

/* Calculate the cost of upgrade T(current) -> T(target).
 * If target is null/omitted, calculates next tier upgrade. */
function calculateUpgradeCost(minion, currentTier, targetTier, prices, bazaarMode = "instaBuy") {
  const start = Math.max(0, currentTier);
  const end = Math.min(11, targetTier || (start + 1));
  if (start >= end) return { cost: 0, items: [] };

  let totalCost = 0;
  const itemsMap = {};

  for (let t = start + 1; t <= end; t++) {
    const rec = getMinionRecipe(minion, t);
    if (!rec) continue;
    itemsMap[rec.itemId] = (itemsMap[rec.itemId] || 0) + rec.qty;
  }

  const items = [];
  for (const [id, qty] of Object.entries(itemsMap)) {
    const prod = prices?.[id];
    let price = null;
    if (prod?.quick_status) {
      const qs = prod.quick_status;
      price = bazaarMode === "buyOrder" ? (qs.sellPrice || qs.buyPrice || null) : (qs.buyPrice || qs.sellPrice || null);
    }
    const cost = price == null ? null : price * qty;
    if (cost == null) totalCost = null;
    else if (totalCost != null) totalCost += cost;

    items.push({ id, qty, unitPrice: price, totalCost: cost });
  }

  return { totalCost, items };
}

const MINION_GENERATOR_ALIASES = {
  /* Hypixel crafted_generators uses these compact/legacy ids. */
  CAVESPIDER: "CAVE_SPIDER",
  ENDER_STONE: "END_STONE",
};

function normalizeCraftedMinionId(baseId) {
  return MINION_GENERATOR_ALIASES[baseId] || baseId;
}

/* Parse profile crafted_generators into a current minion level map: { [id]: maxCraftedLevel } */
function parseCraftedMinions(craftedGenerators) {
  const levels = {};
  for (const gen of craftedGenerators || []) {
    const parts = String(gen || "").split("_");
    const levelStr = parts.pop();
    const level = parseInt(levelStr, 10);
    const baseId = normalizeCraftedMinionId(parts.join("_")); // e.g. COBBLESTONE, DARK_OAK, CAVE_SPIDER
    if (!isNaN(level) && baseId) {
      levels[baseId] = Math.max(levels[baseId] || 0, level);
    }
  }
  return levels;
}

window.MINIONS_DATA = MINIONS_DATA;
window.getMinionRecipe = getMinionRecipe;
window.calculateUpgradeCost = calculateUpgradeCost;
window.parseCraftedMinions = parseCraftedMinions;

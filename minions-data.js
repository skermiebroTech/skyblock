/* =========================================================================
 * minions-data.js
 *
 * Minion Maxing Calculator Data and Algorithms.
 * Tracks the 60 current SkyCrypt minion families. Recipes are intentionally
 * conservative: standard bazaar-material upgrades are priced, while special
 * minions with non-standard recipes stay unpriced instead of inventing costs.
 * ======================================================================= */

"use strict";

const MINIONS_DATA = [
  // Mining (20)
  { id: "COBBLESTONE", name: "Cobblestone", category: "Mining", rawId: "COBBLESTONE", enchId: "ENCHANTED_COBBLESTONE", maxTier: 12 },
  { id: "COAL", name: "Coal", category: "Mining", rawId: "COAL", enchId: "ENCHANTED_COAL", maxTier: 12 },
  { id: "IRON", name: "Iron", category: "Mining", rawId: "IRON_INGOT", enchId: "ENCHANTED_IRON", maxTier: 12 },
  { id: "GOLD", name: "Gold", category: "Mining", rawId: "GOLD_INGOT", enchId: "ENCHANTED_GOLD", maxTier: 12 },
  { id: "DIAMOND", name: "Diamond", category: "Mining", rawId: "DIAMOND", enchId: "ENCHANTED_DIAMOND", maxTier: 12 },
  { id: "EMERALD", name: "Emerald", category: "Mining", rawId: "EMERALD", enchId: "ENCHANTED_EMERALD", maxTier: 12 },
  { id: "REDSTONE", name: "Redstone", category: "Mining", rawId: "REDSTONE", enchId: "ENCHANTED_REDSTONE", maxTier: 12 },
  { id: "LAPIS", name: "Lapis", category: "Mining", rawId: "INK_SACK:4", enchId: "ENCHANTED_LAPIS_LAZULI", maxTier: 12 },
  { id: "QUARTZ", name: "Quartz", category: "Mining", rawId: "NETHER_QUARTZ", enchId: "ENCHANTED_QUARTZ", maxTier: 12 },
  { id: "OBSIDIAN", name: "Obsidian", category: "Mining", rawId: "OBSIDIAN", enchId: "ENCHANTED_OBSIDIAN", maxTier: 12 },
  { id: "GLOWSTONE", name: "Glowstone", category: "Mining", rawId: "GLOWSTONE_DUST", enchId: "ENCHANTED_GLOWSTONE_DUST", maxTier: 12 },
  { id: "MITHRIL", name: "Mithril", category: "Mining", rawId: "MITHRIL_ORE", enchId: "ENCHANTED_MITHRIL", maxTier: 12 },
  { id: "HARD_STONE", name: "Hard Stone", category: "Mining", rawId: "HARD_STONE", enchId: "ENCHANTED_HARD_STONE", maxTier: 12 },
  { id: "GRAVEL", name: "Gravel", category: "Mining", rawId: "FLINT", enchId: "ENCHANTED_FLINT", maxTier: 11 },
  { id: "END_STONE", name: "End Stone", category: "Mining", rawId: "END_STONE", enchId: "ENCHANTED_END_STONE", maxTier: 11 },
  { id: "MYCELIUM", name: "Mycelium", category: "Mining", rawId: "MYCEL", enchId: "ENCHANTED_MYCELIUM", maxTier: 12 },
  { id: "SAND", name: "Sand", category: "Mining", rawId: "SAND", enchId: "ENCHANTED_SAND", maxTier: 11 },
  { id: "ICE", name: "Ice", category: "Mining", rawId: "ICE", enchId: "ENCHANTED_ICE", maxTier: 12 },
  { id: "SNOW", name: "Snow", category: "Mining", rawId: "SNOW_BALL", enchId: "ENCHANTED_SNOW_BLOCK", maxTier: 12 },
  { id: "RED_SAND", name: "Red Sand", category: "Mining", rawId: "RED_SAND", enchId: "ENCHANTED_RED_SAND", maxTier: 12 },

  // Foraging (7)
  { id: "OAK", name: "Oak", category: "Foraging", rawId: "LOG", enchId: "ENCHANTED_OAK_LOG", maxTier: 11 },
  { id: "SPRUCE", name: "Spruce", category: "Foraging", rawId: "LOG:1", enchId: "ENCHANTED_SPRUCE_LOG", maxTier: 11 },
  { id: "BIRCH", name: "Birch", category: "Foraging", rawId: "LOG:2", enchId: "ENCHANTED_BIRCH_LOG", maxTier: 11 },
  { id: "JUNGLE", name: "Jungle", category: "Foraging", rawId: "LOG:3", enchId: "ENCHANTED_JUNGLE_LOG", maxTier: 11 },
  { id: "ACACIA", name: "Acacia", category: "Foraging", rawId: "LOG_2", enchId: "ENCHANTED_ACACIA_LOG", maxTier: 11 },
  { id: "DARK_OAK", name: "Dark Oak", category: "Foraging", rawId: "LOG_2:1", enchId: "ENCHANTED_DARK_OAK_LOG", maxTier: 11 },
  { id: "FLOWER", name: "Flower", category: "Foraging", rawId: null, enchId: null, maxTier: 12, specialRecipe: true },

  // Combat (15)
  { id: "ZOMBIE", name: "Zombie", category: "Combat", rawId: "ROTTEN_FLESH", enchId: "ENCHANTED_ROTTEN_FLESH", maxTier: 11 },
  { id: "SKELETON", name: "Skeleton", category: "Combat", rawId: "BONE", enchId: "ENCHANTED_BONE", maxTier: 11 },
  { id: "CREEPER", name: "Creeper", category: "Combat", rawId: "GUNPOWDER", enchId: "ENCHANTED_GUNPOWDER", maxTier: 11 },
  { id: "SPIDER", name: "Spider", category: "Combat", rawId: "STRING", enchId: "ENCHANTED_STRING", maxTier: 11 },
  { id: "CAVE_SPIDER", name: "Cave Spider", category: "Combat", rawId: "SPIDER_EYE", enchId: "ENCHANTED_SPIDER_EYE", maxTier: 11 },
  { id: "ENDERMAN", name: "Enderman", category: "Combat", rawId: "ENDER_PEARL", enchId: "ENCHANTED_ENDER_PEARL", maxTier: 11 },
  { id: "SLIME", name: "Slime", category: "Combat", rawId: "SLIME_BALL", enchId: "ENCHANTED_SLIME_BALL", maxTier: 11 },
  { id: "MAGMA_CUBE", name: "Magma Cube", category: "Combat", rawId: "MAGMA_CREAM", enchId: "ENCHANTED_MAGMA_CREAM", maxTier: 12 },
  { id: "BLAZE", name: "Blaze", category: "Combat", rawId: "BLAZE_ROD", enchId: "ENCHANTED_BLAZE_ROD", maxTier: 12 },
  { id: "GHAST", name: "Ghast", category: "Combat", rawId: "GHAST_TEAR", enchId: "ENCHANTED_GHAST_TEAR", maxTier: 12 },
  { id: "REVENANT", name: "Revenant", category: "Combat", rawId: null, enchId: null, maxTier: 12, specialRecipe: true },
  { id: "TARANTULA", name: "Tarantula", category: "Combat", rawId: null, enchId: null, maxTier: 12, specialRecipe: true },
  { id: "VOIDLING", name: "Voidling", category: "Combat", rawId: null, enchId: null, maxTier: 11, specialRecipe: true },
  { id: "VAMPIRE", name: "Vampire", category: "Combat", rawId: null, enchId: null, maxTier: 11, specialRecipe: true },
  { id: "INFERNO", name: "Inferno", category: "Combat", rawId: null, enchId: null, maxTier: 11, specialRecipe: true },

  // Farming (16)
  { id: "WHEAT", name: "Wheat", category: "Farming", rawId: "WHEAT", enchId: "ENCHANTED_HAY_BLOCK", maxTier: 12 },
  { id: "POTATO", name: "Potato", category: "Farming", rawId: "POTATO_ITEM", enchId: "ENCHANTED_POTATO", maxTier: 12 },
  { id: "CARROT", name: "Carrot", category: "Farming", rawId: "CARROT_ITEM", enchId: "ENCHANTED_CARROT", maxTier: 12 },
  { id: "MELON", name: "Melon", category: "Farming", rawId: "MELON", enchId: "ENCHANTED_MELON", maxTier: 12 },
  { id: "PUMPKIN", name: "Pumpkin", category: "Farming", rawId: "PUMPKIN", enchId: "ENCHANTED_PUMPKIN", maxTier: 12 },
  { id: "COCOA", name: "Cocoa", category: "Farming", rawId: "INK_SACK:3", enchId: "ENCHANTED_COOKIE", maxTier: 12 },
  { id: "SUGAR_CANE", name: "Sugar Cane", category: "Farming", rawId: "SUGAR_CANE", enchId: "ENCHANTED_SUGAR", maxTier: 12 },
  { id: "NETHER_WARTS", name: "Nether Warts", category: "Farming", rawId: "NETHER_STALK", enchId: "ENCHANTED_NETHER_STALK", maxTier: 12 },
  { id: "CACTUS", name: "Cactus", category: "Farming", rawId: "CACTUS", enchId: "ENCHANTED_CACTUS_GREEN", maxTier: 12 },
  { id: "MUSHROOM", name: "Mushroom", category: "Farming", rawId: "BROWN_MUSHROOM", enchId: "ENCHANTED_BROWN_MUSHROOM", maxTier: 12 },
  { id: "CHICKEN", name: "Chicken", category: "Farming", rawId: "RAW_CHICKEN", enchId: "ENCHANTED_RAW_CHICKEN", maxTier: 12 },
  { id: "COW", name: "Cow", category: "Farming", rawId: "LEATHER", enchId: "ENCHANTED_LEATHER", maxTier: 12 },
  { id: "PIG", name: "Pig", category: "Farming", rawId: "PORK", enchId: "ENCHANTED_PORK", maxTier: 12 },
  { id: "SHEEP", name: "Sheep", category: "Farming", rawId: "MUTTON", enchId: "ENCHANTED_MUTTON", maxTier: 12 },
  { id: "RABBIT", name: "Rabbit", category: "Farming", rawId: "RABBIT", enchId: "ENCHANTED_RABBIT", maxTier: 12 },
  { id: "SUNFLOWER", name: "Sunflower", category: "Farming", rawId: null, enchId: null, maxTier: 12, specialRecipe: true },

  // Fishing (2)
  { id: "FISHING", name: "Fishing", category: "Fishing", rawId: "RAW_FISH", enchId: "ENCHANTED_RAW_FISH", maxTier: 12 },
  { id: "CLAY", name: "Clay", category: "Fishing", rawId: "CLAY_BALL", enchId: "ENCHANTED_CLAY", maxTier: 12 }
];

/* Helper to get the ingredient count and type for a minion tier upgrade.
 * Standardized Hypixel minion progression rules for regular bazaar-material
 * minions. Special/non-bazaar minions return null so the UI can keep profile
 * progress without showing made-up costs. */
function getMinionRecipe(minion, tier) {
  const maxTier = minion.maxTier || 11;
  if (tier < 1 || tier > maxTier) return null;
  if (minion.specialRecipe || !minion.rawId || !minion.enchId) return null;

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
  else if (tier === 12) qty = 1024;

  return qty > 0 ? { itemId, qty } : null;
}

/* Calculate the cost of upgrade T(current) -> T(target).
 * If target is null/omitted, calculates next tier upgrade. */
function calculateUpgradeCost(minion, currentTier, targetTier, prices, bazaarMode = "instaBuy") {
  const maxTier = minion.maxTier || 11;
  const start = Math.max(0, currentTier);
  const end = Math.min(maxTier, targetTier || (start + 1));
  if (start >= end) return { totalCost: 0, items: [] };

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

  if (!items.length) totalCost = null;
  return { totalCost, items };
}

const MINION_GENERATOR_ALIASES = {
  /* Hypixel crafted_generators uses these compact/legacy ids. */
  CAVESPIDER: "CAVE_SPIDER",
  ENDER_STONE: "END_STONE",
  NETHER_WART: "NETHER_WARTS",
};

function normalizeCraftedMinionId(baseId) {
  return MINION_GENERATOR_ALIASES[baseId] || baseId;
}

/* Parse profile crafted_generators into a current minion level map: { [id]: maxCraftedLevel } */
function parseCraftedMinions(craftedGenerators) {
  const levels = {};
  const knownIds = new Set(MINIONS_DATA.map((m) => m.id));
  for (const gen of craftedGenerators || []) {
    const parts = String(gen || "").split("_");
    const levelStr = parts.pop();
    const level = parseInt(levelStr, 10);
    const baseId = normalizeCraftedMinionId(parts.join("_")); // e.g. COBBLESTONE, DARK_OAK, CAVE_SPIDER
    if (!isNaN(level) && baseId && knownIds.has(baseId)) {
      levels[baseId] = Math.max(levels[baseId] || 0, level);
    }
  }
  return levels;
}

window.MINIONS_DATA = MINIONS_DATA;
window.getMinionRecipe = getMinionRecipe;
window.calculateUpgradeCost = calculateUpgradeCost;
window.parseCraftedMinions = parseCraftedMinions;

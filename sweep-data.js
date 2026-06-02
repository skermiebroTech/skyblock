/* =========================================================================
 * sweep-data.js
 *
 * Static source list for the Sweep optimizer. Values are sourced from the
 * Hypixel Wiki Sweep page revision shown in README and live-priced in script.js
 * from the official Bazaar and Auction House endpoints.
 * ======================================================================= */

"use strict";

const SWEEP_SOURCES = [
  /* Permanent / progression */
  {
    id: "fig-tree-gifts",
    category: "Permanent",
    type: "Milestone",
    name: "Fig Tree Gift Milestones",
    sweep: 7,
    costKind: "progression",
    source: "Tree Gift milestones",
    note: "Gain +1 Sweep per Fig Tree Gift milestone, up to +7 total.",
  },
  {
    id: "mangrove-tree-gifts",
    category: "Permanent",
    type: "Milestone",
    name: "Mangrove Tree Gift Milestones",
    sweep: 14,
    costKind: "progression",
    source: "Tree Gift milestones",
    note: "Gain +2 Sweep per Mangrove Tree Gift milestone, up to +14 total.",
  },
  {
    id: "agathas-power",
    category: "Permanent",
    type: "Upgrade",
    name: "Agatha's Power I–V",
    sweep: 5,
    sweepLabel: "+1–5% Sweep",
    costKind: "bazaar-bundle",
    costs: [{ id: "AGATHA_COUPON", qty: 200, label: "Agatha's Coupon" }],
    source: "Agatha's Milestones",
    note: "Five upgrades: +1%, +2%, +3%, +4%, +5% Sweep; costs 20+30+40+50+60 coupons.",
  },
  {
    id: "fig-personal-best",
    category: "Permanent",
    type: "Contest",
    name: "Fig Personal Best unlock",
    sweep: 10,
    sweepLabel: "up to +10% Sweep",
    costKind: "bazaar-bundle",
    costs: [{ id: "AGATHA_COUPON", qty: 12, label: "Agatha's Coupon" }],
    source: "Agatha's Personal Bests",
    note: "+0.01% Sweep per 100 Extra Fig Collection during contest, max 100k collection (+10%). Coupon cost only; collection grind is not coin-priced.",
  },
  {
    id: "mangrove-personal-best",
    category: "Permanent",
    type: "Contest",
    name: "Mangrove Personal Best unlock",
    sweep: 10,
    sweepLabel: "up to +10% Sweep",
    costKind: "bazaar-bundle",
    costs: [{ id: "AGATHA_COUPON", qty: 24, label: "Agatha's Coupon" }],
    source: "Agatha's Personal Bests",
    note: "+0.01% Sweep per 100 Extra Mangrove Collection during contest, max 100k collection (+10%). Coupon cost only; collection grind is not coin-priced.",
  },

  /* Pets */
  {
    id: "jade-dragon-pet",
    category: "Pets",
    type: "Pet",
    name: "Jade Dragon Pet",
    sweep: 32,
    costKind: "auction",
    itemIds: ["JADE_DRAGON_PET"],
    aliases: ["Jade Dragon"],
    source: "Jade Dragon NPC",
    note: "Jade Scale grants +4 Sweep for every digit in Mangrove Collection, max 10M collection (8 digits = +32). Apex Predator can add a percentage boost based on maxed attributes.",
  },
  {
    id: "monkey-pet",
    category: "Pets",
    type: "Pet",
    name: "Monkey Pet",
    sweep: 10,
    costKind: "auction",
    itemIds: ["MONKEY_PET"],
    aliases: ["Monkey"],
    source: "Oringo / Auction House",
    note: "Legendary Monkey's Evolved Axes grants +10 Sweep while in The Park.",
  },

  /* Armor */
  {
    id: "canopy-armor",
    category: "Armor",
    type: "Armor set",
    name: "Canopy Armor set",
    sweep: 24,
    costKind: "auction-bundle",
    itemIds: ["CANOPY_HELMET", "CANOPY_CHESTPLATE", "CANOPY_LEGGINGS", "CANOPY_BOOTS"],
    source: "Amaury / Auction House",
    note: "Four pieces at +6 Sweep each. Requires Foraging 8.",
  },
  {
    id: "fig-armor",
    category: "Armor",
    type: "Armor set",
    name: "Fig Armor set",
    sweep: 24,
    costKind: "auction-bundle",
    itemIds: ["FIG_HELMET", "FIG_CHESTPLATE", "FIG_LEGGINGS", "FIG_BOOTS"],
    source: "Fig Log Collection VIII / Auction House",
    note: "Four pieces at +6 Sweep each. Requires Foraging 15.",
  },

  /* Axes */
  { id: "spruce-axe", category: "Tools", type: "Axe", name: "Spruce Axe", sweep: 4, costKind: "auction", itemIds: ["JUNGLE_AXE"], source: "Spruce Log Collection II / AH", note: "Base axe Sweep." },
  { id: "seriously-damaged-axe", category: "Tools", type: "Axe", name: "Seriously Damaged Axe", sweep: 7, costKind: "auction", itemIds: ["SERIOUSLY_DAMAGED_AXE"], source: "Amaury / AH", note: "Requires Foraging 12." },
  { id: "fig-hew", category: "Tools", type: "Axe", name: "Fig Hew", sweep: 27, costKind: "auction", itemIds: ["FIG_AXE"], source: "Fig Log Collection IV / AH", note: "Base +7 Sweep plus Frenzy can add up to +20 after logs cut on Galatea." },
  { id: "decent-axe", category: "Tools", type: "Axe", name: "Decent Axe", sweep: 24, costKind: "auction", itemIds: ["DECENT_AXE"], source: "Amaury / AH", note: "Requires Foraging 15." },
  { id: "figstone-splitter", category: "Tools", type: "Axe", name: "Figstone Splitter", sweep: 44, costKind: "auction", itemIds: ["FIGSTONE_AXE"], source: "Fig Log Collection VI / AH", note: "Base +24 Sweep plus Super Frenzy can add up to +20 after logs cut on Galatea." },
  { id: "treecapitator", category: "Tools", type: "Axe", name: "Treecapitator", sweep: 25, costKind: "auction", itemIds: ["TREECAPITATOR_AXE"], source: "Jungle Log Collection VII / AH", note: "Base axe Sweep." },

  /* Equipment */
  { id: "davids-cloak", category: "Equipment", type: "Cloak", name: "David's Cloak milestones", sweep: 100, costKind: "progression", itemIds: ["DAVIDS_CLOAK"], source: "David Hunterborough", note: "Can gain up to +100 Sweep at David Hunterborough's Attribute Menu milestones; milestone grind is not coin-priced." },
  { id: "mangrove-grippers", category: "Equipment", type: "Gloves", name: "Mangrove Grippers", sweep: 1, costKind: "auction", itemIds: ["MANGROVE_GRIPPERS"], source: "Mangrove Log Collection VIII / AH", note: "Requires Foraging 12." },
  { id: "mangrove-locket", category: "Equipment", type: "Necklace", name: "Mangrove Locket", sweep: 1, costKind: "auction", itemIds: ["MANGROVE_LOCKET"], source: "Mangrove Log Collection III / AH", note: "Requires Foraging 12." },
  { id: "mangrove-vine", category: "Equipment", type: "Belt", name: "Mangrove Vine", sweep: 1, costKind: "auction", itemIds: ["MANGROVE_VINE"], source: "Mangrove Log Collection IV / AH", note: "Requires Foraging 12." },

  /* Enchantments / attributes / boosters */
  {
    id: "first-impression-v",
    category: "Enchantments",
    type: "Ultimate enchant",
    name: "First Impression V",
    sweep: 10,
    costKind: "bazaar",
    itemIds: ["ENCHANTMENT_ULTIMATE_FIRST_IMPRESSION_5"],
    source: "Bazaar / enchantment",
    note: "First melee hit against a tree gives up to +10 Sweep at level V; regular melee hits grant +5.",
  },
  { id: "crow-attribute", category: "Attributes", type: "Attribute", name: "Crow / Fig Sharpening X", sweep: 50, costKind: "attribute", shardId: "SHARD_CROW", source: "Attribute Shards", note: "Grants +5 → +50 Sweep towards Fig Trees." },
  { id: "heron-attribute", category: "Attributes", type: "Attribute", name: "Heron / Mangrove Sharpening X", sweep: 100, costKind: "attribute", shardId: "SHARD_HERON", source: "Attribute Shards", note: "Grants +10 → +100 Sweep towards Mangrove Trees." },
  { id: "phanpyre-attribute", category: "Attributes", type: "Attribute", name: "Phanpyre / Nocturnal Animal X", sweep: 10, costKind: "attribute", shardId: "SHARD_PHANPYRE", source: "Attribute Shards", note: "Grants +1 → +10 Sweep during the night." },
  { id: "bambuleaf-attribute", category: "Attributes", type: "Attribute", name: "Bambuleaf / Strong Arms X", sweep: 30, costKind: "attribute", shardId: "SHARD_BAMBULEAF", source: "Attribute Shards", note: "Your axe gains +3 → +30 Sweep on throws." },
  { id: "mochibear-attribute", category: "Attributes", type: "Attribute", name: "Mochibear / Strong Legs X", sweep: 30, costKind: "attribute", shardId: "SHARD_MOCHIBEAR", source: "Attribute Shards", note: "Your axe gains +3 → +30 Sweep on melee." },
  { id: "tadgang-attribute", category: "Attributes", type: "Attribute", name: "Tadgang / Unity Is Strength X", sweep: 0.2, costKind: "attribute", shardId: "SHARD_TADGANG", source: "Attribute Shards", note: "Grants +0.02 → +0.2 Sweep for each unique Common Attribute you own." },
  {
    id: "sweep-booster-axe",
    category: "Other",
    type: "Booster",
    name: "Sweep Booster on Axe",
    sweep: 10,
    costKind: "bazaar",
    itemIds: ["SWEEP_BOOSTER"],
    source: "Tree Gifts / Bazaar",
    note: "Apply in an anvil to an axe for +10 Sweep.",
  },
  {
    id: "sweep-booster-armor",
    category: "Other",
    type: "Booster",
    name: "Sweep Booster on Armor piece",
    sweep: 3,
    costKind: "bazaar",
    itemIds: ["SWEEP_BOOSTER"],
    source: "Tree Gifts / Bazaar",
    note: "Apply in an anvil to foraging armor for +3 Sweep per piece.",
  },
  {
    id: "sweep-booster-equipment",
    category: "Other",
    type: "Booster",
    name: "Sweep Booster on Equipment piece",
    sweep: 2,
    costKind: "bazaar",
    itemIds: ["SWEEP_BOOSTER"],
    source: "Tree Gifts / Bazaar",
    note: "Apply in an anvil to equipment for +2 Sweep per piece.",
  },
  { id: "hotf-sweep", category: "Other", type: "Heart of the Forest", name: "Heart of the Forest: Sweep perk", sweep: 50, costKind: "progression", source: "Heart of the Forest", note: "Upgrade the Sweep perk for +1 → +50 Sweep." },
  { id: "hotf-center", category: "Other", type: "Heart of the Forest", name: "Center of the Forest L2 + L4", sweep: 15, costKind: "progression", source: "Heart of the Forest", note: "Center of the Forest Level 2 gives +5 Sweep and Level 4 gives +10 Sweep." },
  { id: "hotf-foraging-madness", category: "Other", type: "Heart of the Forest", name: "Foraging Madness", sweep: 10, costKind: "progression", source: "Heart of the Forest", note: "Temporary perk: +10 Sweep and +50 Foraging Fortune." },
  { id: "hotf-early-bird", category: "Other", type: "Heart of the Forest", name: "Early Bird", sweep: 10, costKind: "progression", source: "Heart of the Forest", note: "Temporary daily perk: +10 Sweep and +100 Foraging Fortune for the first 250 trees cut every day." },
  { id: "hotf-precision-cutting", category: "Other", type: "Heart of the Forest", name: "Precision Cutting", sweep: 10, costKind: "progression", source: "Heart of the Forest", note: "Cutting the marked log grants +10 Sweep on that hit." },
  { id: "hotf-half-full-empty", category: "Other", type: "Heart of the Forest", name: "Half Full / Half Empty pairing", sweep: 25, costKind: "progression", source: "Heart of the Forest", note: "Gain +25 Sweep when near a player with the paired perk enabled." },
  { id: "hotf-maniac-slicer", category: "Other", type: "Heart of the Forest", name: "Maniac Slicer ability", sweep: null, costKind: "progression", source: "Heart of the Forest", note: "Throwing your axe consumes mana and grants +1 Sweep per 100 Mana used for 15 seconds." },
];

window.SWEEP_SOURCES = SWEEP_SOURCES;

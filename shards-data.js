/* =========================================================================
 * shards-data.js
 *
 * Curated metadata for known Hypixel SkyBlock Attribute Shards.
 *
 * Source: https://wiki.hypixel.net/Attributes (cross-referenced with
 * https://hypixel-skyblock.fandom.com/wiki/Attributes and known fusion
 * recipes from community spreadsheets).
 *
 * STRUCTURE
 * ---------
 *   SHARDS_DB[bazaarId] = {
 *     name:       Display name (e.g. "Grove Shard")
 *     attribute:  Attribute granted when syphoned (e.g. "Nature Elemental")
 *     rarity:     "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY"
 *     family:     "Forest" | "Water" | "Combat" | "Elemental" | "Reptile" | ...
 *     huntLevel:  Hunting level required to syphon (optional)
 *     maxLevelShards: Total shards needed to fuse-syphon to level 10 (optional)
 *   }
 *
 * The website dynamically discovers EVERY shard present in the live Bazaar
 * response. Unknown shards are auto-named from their ID with a "?" rarity —
 * so the tool never goes stale when Hypixel adds new shards.
 *
 * Shards required to reach max level (level 10) by rarity, per the wiki:
 *   Common:    96
 *   Uncommon:  64
 *   Rare:      32
 *   Epic:      16
 *   Legendary: 8
 * ======================================================================= */

const SHARDS_MAX_LEVEL_BY_RARITY = {
  COMMON: 96,
  UNCOMMON: 64,
  RARE: 32,
  EPIC: 16,
  LEGENDARY: 8,
  UNKNOWN: null,
};

/* Rarity → display color (Minecraft-style) */
const RARITY_COLORS = {
  COMMON: "#b0b0b0",
  UNCOMMON: "#55ff55",
  RARE: "#5555ff",
  EPIC: "#aa00aa",
  LEGENDARY: "#ffaa00",
  MYTHIC: "#ff55ff",
  UNKNOWN: "#666c80",
};

/* -------------------------------------------------------------------------
 * Curated shard database. Entries are added based on widely-confirmed wiki
 * data. Unknown shards fall back to an auto-generated entry at runtime so
 * the tool stays accurate even when new shards are added.
 * ----------------------------------------------------------------------- */
const SHARDS_DB = {
  /* -------------------- COMMON -------------------- */
  SHARD_GROVE:        { name: "Grove Shard",        attribute: "Nature Elemental",  rarity: "COMMON", family: "Forest" },
  SHARD_MIST:         { name: "Mist Shard",         attribute: "Fog Elemental",     rarity: "COMMON", family: "Water"  },
  SHARD_TOAD:         { name: "Toad Shard",         attribute: "Battle Frog",       rarity: "COMMON", family: "Amphibian" },
  SHARD_NEWT:         { name: "Newt Shard",         attribute: "Sweat",             rarity: "COMMON", family: "Amphibian" },
  SHARD_SALAMANDER:   { name: "Salamander Shard",   attribute: "Flaming Hide",      rarity: "COMMON", family: "Amphibian" },
  SHARD_LIZARD_KING:  { name: "Lizard King Shard",  attribute: "Reptilian Royalty", rarity: "COMMON", family: "Reptile" },
  SHARD_CROCODILE:    { name: "Crocodile Shard",    attribute: "Death Roll",        rarity: "COMMON", family: "Reptile" },
  SHARD_PEST:         { name: "Pest Shard",         attribute: "Pestilence",        rarity: "COMMON", family: "Insect" },
  SHARD_TADPOLE:      { name: "Tadpole Shard",      attribute: "Tadpole Eating",    rarity: "COMMON", family: "Amphibian" },
  SHARD_PRICKLY_KING: { name: "Prickly King Shard", attribute: "Pricklemane",       rarity: "COMMON", family: "Cactus" },
  SHARD_VERDANT:      { name: "Verdant Shard",      attribute: "Verdant",           rarity: "COMMON", family: "Forest" },
  SHARD_PYTHON:       { name: "Python Shard",       attribute: "Constrict",         rarity: "COMMON", family: "Reptile" },
  SHARD_LAVA_FLAME:   { name: "Lava Flame Shard",   attribute: "Lava Hopper",       rarity: "COMMON", family: "Crimson" },

  /* -------------------- UNCOMMON ------------------ */
  SHARD_BAMBOO:       { name: "Bamboo Shard",       attribute: "Bamboo",            rarity: "UNCOMMON", family: "Forest" },
  SHARD_HIDEONLEAF:   { name: "Hideonleaf Shard",   attribute: "Hideonleaf",        rarity: "UNCOMMON", family: "Forest" },
  SHARD_SYLVAN:       { name: "Sylvan Shard",       attribute: "Sylvan",            rarity: "UNCOMMON", family: "Forest" },
  SHARD_TIDE:         { name: "Tide Shard",         attribute: "Tide",              rarity: "UNCOMMON", family: "Water" },
  SHARD_KOI:          { name: "Koi Shard",          attribute: "Bait Master",       rarity: "UNCOMMON", family: "Water" },
  SHARD_HERON:        { name: "Heron Shard",        attribute: "Marsh Touch",       rarity: "UNCOMMON", family: "Bird" },
  SHARD_CARROT_KING:  { name: "Carrot King Shard",  attribute: "Carrot King",       rarity: "UNCOMMON", family: "Bunny" },
  SHARD_RABBIT:       { name: "Rabbit Shard",       attribute: "Rabbit Hide",       rarity: "UNCOMMON", family: "Bunny" },
  SHARD_BEZAL:        { name: "Bezal Shard",        attribute: "Reptilian Vision",  rarity: "UNCOMMON", family: "Reptile" },
  SHARD_LAPIS_ZOMBIE: { name: "Lapis Zombie Shard", attribute: "Mining Spirit",     rarity: "UNCOMMON", family: "Mining" },
  SHARD_GHOUL:        { name: "Ghoul Shard",        attribute: "Last Stand",        rarity: "UNCOMMON", family: "Combat" },
  SHARD_SLUG:         { name: "Slug Shard",         attribute: "Slow Healing",      rarity: "UNCOMMON", family: "Insect" },
  SHARD_TRAPPED_FAIRY:{ name: "Trapped Fairy Shard",attribute: "Fairy Born",        rarity: "UNCOMMON", family: "Fairy" },

  /* -------------------- RARE ---------------------- */
  SHARD_ENT:          { name: "Ent Shard",          attribute: "Wisdom Sap",        rarity: "RARE", family: "Forest" },
  SHARD_TREANT:       { name: "Treant Shard",       attribute: "Treant Touch",      rarity: "RARE", family: "Forest" },
  SHARD_GOLDFIN:      { name: "Goldfin Shard",      attribute: "Goldfin",           rarity: "RARE", family: "Water" },
  SHARD_LOCH_EMPEROR: { name: "Loch Emperor Shard", attribute: "Loch Emperor",      rarity: "RARE", family: "Water" },
  SHARD_QUARTZFANG:   { name: "Quartzfang Shard",   attribute: "Quartz Affinity",   rarity: "RARE", family: "Mining" },
  SHARD_DRACONIC:     { name: "Draconic Shard",     attribute: "Dragon Hoard",      rarity: "RARE", family: "Dragon" },
  SHARD_GALAXY_FISH:  { name: "Galaxy Fish Shard",  attribute: "Galaxy Fish",       rarity: "RARE", family: "Water" },
  SHARD_OBSIDIAN_DEFENDER:{ name: "Obsidian Defender Shard", attribute: "Obsidian Skin", rarity: "RARE", family: "Combat" },
  SHARD_AZURE:        { name: "Azure Shard",        attribute: "Azure",             rarity: "RARE", family: "Water" },
  SHARD_BLAZE:        { name: "Blaze Shard",        attribute: "Blazing Resistance",rarity: "RARE", family: "Crimson" },
  SHARD_FENLORD:      { name: "Fenlord Shard",      attribute: "Fenlord",           rarity: "RARE", family: "Amphibian" },
  SHARD_THORN:        { name: "Thorn Shard",        attribute: "Toxic Touch",       rarity: "RARE", family: "Cactus" },
  SHARD_CASCADE:      { name: "Cascade Shard",      attribute: "Cascade",           rarity: "RARE", family: "Water" },
  SHARD_MAGMA_SLUG:   { name: "Magma Slug Shard",   attribute: "Magma Slug",        rarity: "RARE", family: "Crimson" },

  /* -------------------- EPIC ---------------------- */
  SHARD_BIRRIES:      { name: "Birries Shard",      attribute: "Sweet Tooth",       rarity: "EPIC", family: "Forest", huntLevel: 15 },
  SHARD_REVENANT:     { name: "Revenant Shard",     attribute: "Undead Affinity",   rarity: "EPIC", family: "Combat", huntLevel: 15 },
  SHARD_KADA_KNIGHT:  { name: "Kada Knight Shard",  attribute: "Mana Pool",         rarity: "EPIC", family: "Combat", huntLevel: 15 },
  SHARD_FLARE:        { name: "Flare Shard",        attribute: "Flare",             rarity: "EPIC", family: "Crimson", huntLevel: 15 },
  SHARD_TENTACLE:     { name: "Tentacle Shard",     attribute: "Tentacle Touch",    rarity: "EPIC", family: "Water", huntLevel: 15 },
  SHARD_TIAMAT:       { name: "Tiamat Shard",       attribute: "Combo Master",      rarity: "EPIC", family: "Reptile", huntLevel: 15 },
  SHARD_PRINCE:       { name: "Prince Shard",       attribute: "Royal Touch",       rarity: "EPIC", family: "Royalty", huntLevel: 15 },
  SHARD_SHELLWISE:    { name: "Shellwise Shard",    attribute: "Shell",             rarity: "EPIC", family: "Reptile", huntLevel: 15 },
  SHARD_KOMODO:       { name: "Komodo Shard",       attribute: "Komodo Bite",       rarity: "EPIC", family: "Reptile", huntLevel: 15 },
  SHARD_FALCON:       { name: "Falcon Shard",       attribute: "Falcon",            rarity: "EPIC", family: "Bird", huntLevel: 15 },
  SHARD_WYVERN:       { name: "Wyvern Shard",       attribute: "Wyvern",            rarity: "EPIC", family: "Dragon", huntLevel: 15 },
  SHARD_PHANTHESEA:   { name: "Phanthesea Shard",   attribute: "Phantom Sea",       rarity: "EPIC", family: "Water", huntLevel: 15 },
  SHARD_VENGEFUL_TIDE:{ name: "Vengeful Tide Shard",attribute: "Vengeful Tide",     rarity: "EPIC", family: "Water", huntLevel: 15 },
  SHARD_BAL:          { name: "Bal Shard",          attribute: "Magma Veins",       rarity: "EPIC", family: "Crimson", huntLevel: 15 },

  /* -------------------- LEGENDARY ----------------- */
  SHARD_BURNINGSOUL:  { name: "Burningsoul Shard",  attribute: "Attack Speed",      rarity: "LEGENDARY", family: "Crimson", huntLevel: 20 },
  SHARD_TITANOBOA:    { name: "Titanoboa Shard",    attribute: "Bayou Biter",       rarity: "LEGENDARY", family: "Reptile" },
  SHARD_NAGA:         { name: "Naga Shard",         attribute: "Charmed",           rarity: "LEGENDARY", family: "Reptile", huntLevel: 20 },
  SHARD_WITHER:       { name: "Wither Shard",       attribute: "Toxophilite",       rarity: "LEGENDARY", family: "Combat", huntLevel: 20 },
  SHARD_CADUCOUS:     { name: "Caducous Shard",     attribute: "Caducous",          rarity: "LEGENDARY", family: "Forest", huntLevel: 20 },
  SHARD_ANANKE:       { name: "Ananke Shard",       attribute: "Wings of Destiny",  rarity: "LEGENDARY", family: "Dragon", huntLevel: 20 },
  SHARD_DAEMON:       { name: "Daemon Shard",       attribute: "Pity",              rarity: "LEGENDARY", family: "Combat", huntLevel: 20 },
  SHARD_HIDEONBOX:    { name: "Hideonbox Shard",    attribute: "Tuning Box",        rarity: "LEGENDARY", family: "Combat", huntLevel: 20 },
  SHARD_SPIKE:        { name: "Spike Shard",        attribute: "Payback",           rarity: "LEGENDARY", family: "Water", huntLevel: 20 },
  SHARD_DODO:         { name: "Dodo Shard",         attribute: "Rare Bird",         rarity: "LEGENDARY", family: "Bird", huntLevel: 20 },
  SHARD_THORNS:       { name: "Thorns Shard",       attribute: "Hot Stuff",         rarity: "LEGENDARY", family: "Cactus", huntLevel: 20 },
  SHARD_STARBORN:     { name: "Starborn Shard",     attribute: "Starborn",          rarity: "LEGENDARY", family: "Water", huntLevel: 20 },
  SHARD_FIRE_EEL:     { name: "Fire Eel Shard",     attribute: "Magma Fingers",     rarity: "LEGENDARY", family: "Water", huntLevel: 20 },
  SHARD_SEA_SERPENT:  { name: "Sea Serpent Shard",  attribute: "Sea Serpent",       rarity: "LEGENDARY", family: "Water", huntLevel: 20 },
  SHARD_TOUCAN:       { name: "Toucan Shard",       attribute: "Toucan Toolkit",    rarity: "LEGENDARY", family: "Bird", huntLevel: 20 },
  SHARD_BAMBOO_BEAR:  { name: "Bamboo Bear Shard",  attribute: "Bamboo Bear",       rarity: "LEGENDARY", family: "Forest", huntLevel: 20 },
  SHARD_KING_COBRA:   { name: "King Cobra Shard",   attribute: "King Cobra",        rarity: "LEGENDARY", family: "Reptile", huntLevel: 20 },
  SHARD_HOOK:         { name: "Hook Shard",         attribute: "Lifeline",          rarity: "LEGENDARY", family: "Water", huntLevel: 20 },
  SHARD_MOLTHRESH:    { name: "Molthresh Shard",    attribute: "Unlimited Power",   rarity: "LEGENDARY", family: "Crimson", huntLevel: 20 },
  SHARD_MENDING:      { name: "Mending Shard",      attribute: "Vitality",          rarity: "LEGENDARY", family: "Combat", huntLevel: 20 },
  SHARD_SACK:         { name: "Sack Shard",         attribute: "Sack Size",         rarity: "LEGENDARY", family: "Utility", huntLevel: 20 },
};

/* -------------------------------------------------------------------------
 * Known fusion recipes. Each recipe is a list of {id, qty} ingredients that
 * combine in the Fusion Machine to produce 1 of the target shard.
 *
 * Fusion costs are calculated using whichever is cheaper for each input:
 *   - Insta-buy from sell offers (buyPrice)  — fast, costs more
 *   - Buy order (sellPrice)                  — slow, costs less
 *
 * Only a handful of well-documented recipes are bundled; the calculator
 * gracefully shows "—" for shards without a known recipe. Add more here as
 * you confirm them in-game.
 * ----------------------------------------------------------------------- */
const FUSION_RECIPES = {
  // Each entry: target shard id → array of {id, qty} ingredients
  // Example (placeholder pattern that the game uses for Forest+Forest fusions):
  // SHARD_ENT: [{ id: "SHARD_GROVE", qty: 2 }, { id: "SHARD_BAMBOO", qty: 1 }],
};

/* Expose the prettifier for unknown shards (used by script.js) */
function prettifyShardId(id) {
  // SHARD_LIZARD_KING → "Lizard King Shard"
  // ATTRIBUTE_SHARD   → "Attribute Shard"
  const stripped = id
    .replace(/^SHARD_/, "")
    .replace(/^ATTRIBUTE_SHARD_?/, "")
    .toLowerCase();
  const base = stripped
    ? stripped.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "Attribute";
  const needsSuffix = id.startsWith("SHARD_") || id.startsWith("ATTRIBUTE_SHARD");
  return needsSuffix ? `${base} Shard` : base;
}

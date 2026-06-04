/* =========================================================================
 * shards-data.js
 *
 * Static metadata + helpers for Hypixel SkyBlock Attribute Shards.
 *
 * The detailed per-shard data (name, rarity, category, family, fusion graph)
 * lives in two JSON files under /data/:
 *
 *   data/fusion-properties.json  — per-shard metadata + recipe constraints
 *   data/fusion-data.json        — enumerated fusion recipes (input pairs → output qty)
 *
 * Both come from the excellent open-source SkyShards project (MIT):
 *   https://github.com/Campionnn/SkyShards
 *
 * The site fetches them on boot, merges them with the live Bazaar response,
 * and computes profitability + fusion economics on the client.
 *
 * This file only holds the small, mostly-static lookup tables that don't
 * justify a separate file (rarity colors, max-level requirements, the
 * handful of bazaar-id ↔ SkyShards-code spelling differences, etc.).
 * ======================================================================= */

/* ---------- Rarity constants ---------- */

/* Number of shards needed to syphon a max-level (L10) attribute, per the wiki.
 * https://wiki.hypixel.net/Attributes */
const SHARDS_MAX_LEVEL_BY_RARITY = {
  COMMON:    96,
  UNCOMMON:  64,
  RARE:      48,
  EPIC:      32,
  LEGENDARY: 24,
  UNKNOWN:   null,
};

/* SkyShards rarity-code prefix → our canonical rarity name. */
const RARITY_FROM_CODE = {
  C: "COMMON",
  U: "UNCOMMON",
  R: "RARE",
  E: "EPIC",
  L: "LEGENDARY",
};

/* Minecraft-style display colors. */
const RARITY_COLORS = {
  COMMON:    "#b0b0b0",
  UNCOMMON:  "#55ff55",
  RARE:      "#5555ff",
  EPIC:      "#aa00aa",
  LEGENDARY: "#ffaa00",
  MYTHIC:    "#ff55ff",
  UNKNOWN:   "#666c80",
};

/* ---------- Attribute skill filters ----------
 *
 * SkyBlock's in-game Attribute Menu has a "Filter by SkyBlock Skill" control
 * with these exact choices. The wiki Attributes page exposes the per-attribute
 * Skill column; keep this map keyed by SkyShards code so both the market table
 * and profile maxing report can share one source of truth.
 */
const ATTRIBUTE_SKILLS = [
  "Combat",
  "Fishing",
  "Farming",
  "Foraging",
  "Mining",
  "Taming",
  "Enchanting",
  "Hunting",
  "Global",
  "Unknown",
];

const ATTRIBUTE_SKILL_BY_CODE = {
  // Common
  C1: "Global", C2: "Global", C3: "Global", C4: "Foraging", C5: "Fishing",
  C7: "Foraging", C9: "Enchanting", C10: "Mining", C11: "Fishing", C12: "Combat",
  C14: "Fishing", C15: "Combat", C16: "Global", C17: "Foraging", C18: "Combat",
  C19: "Foraging", C20: "Hunting", C21: "Combat", C23: "Fishing", C24: "Hunting",
  C25: "Farming", C26: "Fishing", C27: "Global", C29: "Combat", C30: "Combat",
  C32: "Fishing", C33: "Global", C34: "Taming", C35: "Hunting", C36: "Mining",
  C39: "Combat",

  // Uncommon
  U1: "Global", U2: "Global", U3: "Global", U4: "Foraging", U5: "Fishing",
  U6: "Mining", U7: "Global", U8: "Hunting", U9: "Hunting", U10: "Farming",
  U11: "Hunting", U12: "Combat", U15: "Combat", U16: "Foraging", U18: "Global",
  U20: "Fishing", U21: "Hunting", U22: "Farming", U23: "Foraging", U24: "Combat",
  U25: "Foraging", U27: "Combat", U28: "Foraging", U29: "Combat", U30: "Combat",
  U31: "Foraging", U32: "Fishing", U33: "Combat", U34: "Taming", U36: "Combat",
  U38: "Combat", U39: "Taming", U40: "Farming", U41: "Hunting", U59: "Foraging",

  // Rare
  R1: "Global", R2: "Global", R3: "Global", R4: "Foraging", R5: "Hunting",
  R6: "Global", R7: "Foraging", R8: "Hunting", R9: "Hunting", R10: "Farming",
  R11: "Global", R13: "Global", R15: "Enchanting", R16: "Farming", R18: "Combat",
  R21: "Combat", R22: "Global", R23: "Global", R24: "Global", R25: "Global",
  R27: "Global", R29: "Global", R30: "Combat", R31: "Combat", R32: "Hunting",
  R33: "Mining", R34: "Global", R35: "Global", R36: "Combat", R38: "Global",
  R39: "Combat", R42: "Combat", R43: "Farming", R44: "Global", R45: "Hunting",
  R46: "Foraging", R49: "Global", R50: "Global", R51: "Combat", R52: "Combat",
  R53: "Hunting", R54: "Hunting", R56: "Fishing", R57: "Global", R58: "Taming",
  R59: "Global", R60: "Global", R61: "Hunting", R63: "Combat", R64: "Foraging",

  // Epic
  E1: "Global", E2: "Global", E3: "Global", E4: "Foraging", E5: "Hunting",
  E6: "Hunting", E7: "Hunting", E9: "Hunting", E10: "Hunting", E11: "Hunting",
  E13: "Farming", E14: "Fishing", E15: "Mining", E16: "Global", E17: "Fishing",
  E18: "Combat", E20: "Fishing", E21: "Global", E22: "Hunting", E24: "Combat",
  E26: "Global", E27: "Combat", E28: "Taming", E29: "Combat", E30: "Hunting",
  E31: "Farming", E32: "Hunting", E33: "Combat", E34: "Global", E35: "Hunting",
  E36: "Mining", E37: "Farming", E39: "Combat", E42: "Combat", E45: "Mining",

  // Legendary
  L1: "Global", L2: "Global", L3: "Global", L4: "Hunting", L5: "Fishing",
  L6: "Hunting", L7: "Hunting", L8: "Hunting", L9: "Combat", L11: "Hunting",
  L12: "Combat", L13: "Farming", L14: "Foraging", L15: "Global", L17: "Combat",
  L18: "Global", L20: "Global", L23: "Combat", L24: "Combat", L25: "Global",
  L26: "Fishing", L27: "Combat", L28: "Global", L29: "Hunting", L30: "Combat",
  L31: "Taming", L32: "Global", L33: "Combat", L34: "Taming", L36: "Global",
  L39: "Global", L41: "Global", L42: "Global", L44: "Global", L46: "Farming",
  L47: "Fishing", L48: "Combat", L51: "Combat",
};

function attributeSkillForCode(code) {
  return ATTRIBUTE_SKILL_BY_CODE[code] || "Unknown";
}

/* ---------- Spelling-difference overrides ----------
 *
 * Most SkyShards entries map cleanly to bazaar IDs:
 *   "Loch Emperor"   → SHARD_LOCH_EMPEROR
 *   "Lapis Zombie"   → SHARD_LAPIS_ZOMBIE
 *
 * A handful of shards have different spelling between the wiki/community
 * spreadsheet and the bazaar product ID. We override those manually so the
 * fusion graph correctly links to live bazaar prices. */
const SKYSHARDS_TO_BAZAAR_OVERRIDES = {
  /* SkyShards short id → bazaar product id */
  E20: "SHARD_SEA_EMPEROR",        // "Loch Emperor"
  L28: "SHARD_CINDER_BAT",         // "Cinderbat"
  U38: "SHARD_STRIDER_SURFER",     // "Stridersurfer"
  U41: "SHARD_FLIP_FLOPPER",       // "Flipflopper"
  R23: "SHARD_ABYSSAL_LANTERN",    // "Abyssal Lanternfish"
  R32: "SHARD_SEA_SHINE",          // "Seashine"
  C26: "SHARD_LOTUS_FISH",         // "Lotusfish"
  E29: "SHARD_INFERNO_DEMONLORD",  // explicit, in case naming drifts
};

/* ---------- Texture / icon packs ----------
 *
 * Each entry resolves a bazaar product id → an image URL. The user can
 * switch packs at runtime; packs are simple URL templates so adding a new
 * pack is one line. Icons fail silently to a generated SVG placeholder. */
const TEXTURE_PACKS = {
  vanilla: {
    label: "Vanilla (default)",
    resolve(bazaarId, ctx) {
      // Use SkyShards custom colored icons as they are much clearer for identifying attribute types!
      const code = ctx.bazaarToCode[bazaarId];
      if (!code) return null;
      return `https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/shardIcons/${code}.png`;
    },
  },

  skyshards: {
    label: "SkyShards (custom)",
    /* Files in https://github.com/Campionnn/SkyShards/tree/master/public/shardIcons
     * are named by SkyShards short id, e.g. C1.png, U16.png.
     * resolve() returns null when we don't have a mapping. */
    resolve(bazaarId, ctx) {
      const code = ctx.bazaarToCode[bazaarId];
      if (!code) return null;
      return `https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/shardIcons/${code}.png`;
    },
  },

  furfsky: {
    label: "FurfSky Reborn",
    resolve(bazaarId, ctx) {
      // Fallback to custom colored skyshards for clarity, or return vanilla
      const code = ctx.bazaarToCode[bazaarId];
      if (!code) return null;
      return `https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/shardIcons/${code}.png`;
    },
  },

  hypixel_plus: {
    label: "Hypixel+",
    resolve(bazaarId, ctx) {
      const code = ctx.bazaarToCode[bazaarId];
      if (!code) return null;
      return `https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/shardIcons/${code}.png`;
    },
  },

  hypixel_wiki: {
    label: "Hypixel Wiki",
    resolve(bazaarId, ctx) {
      const meta = ctx.shardsDb[bazaarId];
      if (!meta) return null;
      /* Wiki file naming convention: "Shard <Name>.png" */
      const fname = `Shard_${meta.name.replace(/ Shard$/, "").replace(/ /g, "_")}.png`;
      return `https://wiki.hypixel.net/images/Shard_${encodeURIComponent(fname.replace(/^Shard_/, ""))}`;
    },
  },

  none: {
    label: "None (text only)",
    resolve() { return null; },
  },
};

/* ---------- Helpers ---------- */

/* Convert a SkyShards display name → guessed bazaar product id.
 *   "Loch Emperor" → "SHARD_LOCH_EMPEROR"
 * Lossy: punctuation is collapsed to underscores. Overrides above handle
 * the cases where the live API uses a different spelling. */
function nameToBazaarId(name) {
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `SHARD_${cleaned}`;
}

/* "SHARD_LIZARD_KING" → "Lizard King Shard"  (fallback when no metadata). */
function prettifyShardId(id) {
  const stripped = id.replace(/^SHARD_/, "").toLowerCase();
  const base = stripped
    ? stripped.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "Attribute";
  return `${base} Shard`;
}

/* Build the merged SHARDS_DB from fusion-properties.json.
 * Returns:
 *   {
 *     shardsDb:        { [bazaarId]:  {name, attribute, rarity, family, category, code} },
 *     codeToBazaar:    { [skyShardsCode]: bazaarId },
 *     bazaarToCode:    { [bazaarId]: skyShardsCode },
 *   } */
function buildShardsDbFromProperties(fusionProps) {
  const shardsDb = {};
  const codeToBazaar = {};
  const bazaarToCode = {};

  for (const [code, info] of Object.entries(fusionProps)) {
    const rarity = RARITY_FROM_CODE[code[0]] || "UNKNOWN";
    const bazaarId = SKYSHARDS_TO_BAZAAR_OVERRIDES[code] || nameToBazaarId(info.name);

    /* `family` in the JSON is an array of one (rarely two) attribute names. */
    const attribute = (info.family && info.family[0]) || info.name;

    shardsDb[bazaarId] = {
      name:      `${info.name} Shard`,
      attribute,
      rarity,
      family:    info.category || "—",  // "Forest", "Water", "Combat", etc.
      category:  info.category || "—",
      attributeSkill: attributeSkillForCode(code),
      code,
      huntLevel: null,
    };

    codeToBazaar[code]      = bazaarId;
    bazaarToCode[bazaarId]  = code;
  }

  return { shardsDb, codeToBazaar, bazaarToCode };
}

window.ATTRIBUTE_SKILL_BY_CODE = ATTRIBUTE_SKILL_BY_CODE;
window.ATTRIBUTE_SKILLS = ATTRIBUTE_SKILLS;
window.attributeSkillForCode = attributeSkillForCode;

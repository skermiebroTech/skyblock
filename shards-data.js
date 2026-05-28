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
  RARE:      32,
  EPIC:      16,
  LEGENDARY: 8,
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
  skyshards: {
    label: "SkyShards (default)",
    /* Files in https://github.com/Campionnn/SkyShards/tree/master/public/shardIcons
     * are named by SkyShards short id, e.g. C1.png, U16.png.
     * resolve() returns null when we don't have a mapping. */
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
      code,
      huntLevel: null,
    };

    codeToBazaar[code]      = bazaarId;
    bazaarToCode[bazaarId]  = code;
  }

  return { shardsDb, codeToBazaar, bazaarToCode };
}

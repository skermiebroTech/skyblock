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
 * https://hypixel-skyblock.fandom.com/wiki/Attributes */
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

/* Bazaar product id -> the SkyBlock skill the in-game Attribute Menu files it
 * under. Keyed by Bazaar id on purpose: SkyShards reuses its short codes
 * (C1, U16, ...) and has reassigned several of them, so a code-keyed map
 * silently mislabels shards after an upstream refresh. Shards missing here
 * report "Unknown" rather than a guess. */
const ATTRIBUTE_SKILL_BY_BAZAAR_ID = {
  "SHARD_ABYSSAL_LANTERN": "Global", "SHARD_AERO": "Global", "SHARD_ALLIGATOR": "Hunting",
  "SHARD_ANANKE": "Combat", "SHARD_APEX_DRAGON": "Combat", "SHARD_ARACHNE": "Global",
  "SHARD_AZURE": "Combat", "SHARD_BAL": "Mining", "SHARD_BAMBLOOM": "Foraging",
  "SHARD_BAMBULEAF": "Foraging", "SHARD_BARBARIAN_DUKE_X": "Combat", "SHARD_BASILISK": "Hunting",
  "SHARD_BEACONMITE": "Foraging", "SHARD_BEZAL": "Combat", "SHARD_BIRRIES": "Foraging",
  "SHARD_BITBUG": "Global", "SHARD_BLIZZARD": "Global", "SHARD_BOGGED": "Fishing",
  "SHARD_BOLT": "Global", "SHARD_BOREAL_OWL": "Taming", "SHARD_BRAMBLE": "Global",
  "SHARD_BRUISER": "Combat", "SHARD_BULLFROG": "Foraging", "SHARD_BURNINGSOUL": "Combat",
  "SHARD_CAIMAN": "Hunting", "SHARD_CARROT_KING": "Global", "SHARD_CASCADE": "Global",
  "SHARD_CAVERNSHADE": "Mining", "SHARD_CHAMELEON": "Hunting", "SHARD_CHILL": "Combat",
  "SHARD_CINDER_BAT": "Global", "SHARD_COCOALEECH": "Farming", "SHARD_COD": "Fishing",
  "SHARD_CONDOR": "Taming", "SHARD_CORALOT": "Fishing", "SHARD_CRETAN_BULL": "Combat",
  "SHARD_CROCODILE": "Hunting", "SHARD_CROPEETLE": "Farming", "SHARD_CROW": "Foraging",
  "SHARD_CRYO": "Global", "SHARD_CUBOA": "Hunting", "SHARD_DAEMON": "Global",
  "SHARD_DODO": "Taming", "SHARD_DRACONIC": "Global", "SHARD_DRAGONFLY": "Farming",
  "SHARD_DREADWING": "Global", "SHARD_DROWNED": "Combat", "SHARD_EEL": "Hunting",
  "SHARD_ENDSTONE_PROTECTOR": "Combat", "SHARD_ENT": "Combat", "SHARD_ETHERDRAKE": "Global",
  "SHARD_FALCON": "Taming", "SHARD_FENLORD": "Hunting", "SHARD_FIREFLY": "Farming",
  "SHARD_FIRE_EEL": "Fishing", "SHARD_FLAMING_SPIDER": "Combat", "SHARD_FLARE": "Combat",
  "SHARD_FLASH": "Global", "SHARD_FLIP_FLOPPER": "Hunting", "SHARD_FUNGLOOM": "Combat",
  "SHARD_GALAXY_FISH": "Global", "SHARD_GECKO": "Hunting", "SHARD_GHOST": "Combat",
  "SHARD_GLACITE_WALKER": "Global", "SHARD_GOLDEN_GHOUL": "Global", "SHARD_GOLDFIN": "Fishing",
  "SHARD_GROVE": "Global", "SHARD_HARPY": "Hunting", "SHARD_HELLWISP": "Combat",
  "SHARD_HERON": "Foraging", "SHARD_HIDEONBOX": "Global", "SHARD_HIDEONCAVE": "Global",
  "SHARD_HIDEONDRA": "Global", "SHARD_HIDEONGEON": "Global", "SHARD_HIDEONGIFT": "Global",
  "SHARD_HIDEONLEAF": "Mining", "SHARD_HIDEONRING": "Global", "SHARD_HIDEONSACK": "Global",
  "SHARD_HUMMINGBIRD": "Foraging", "SHARD_IGUANA": "Hunting", "SHARD_INFERNO_KOI": "Global",
  "SHARD_INVISIBUG": "Farming", "SHARD_JORMUNG": "Global", "SHARD_JOYDIVE": "Global",
  "SHARD_KADA_KNIGHT": "Combat", "SHARD_KING_COBRA": "Hunting", "SHARD_KING_MINOS": "Combat",
  "SHARD_KIWI": "Taming", "SHARD_KOMODO_DRAGON": "Hunting", "SHARD_KRAKEN": "Global",
  "SHARD_LADYBUG": "Farming", "SHARD_LAPIS_CREEPER": "Combat",
  "SHARD_LAPIS_SKELETON": "Enchanting", "SHARD_LAPIS_ZOMBIE": "Enchanting",
  "SHARD_LAVA_FLAME": "Fishing", "SHARD_LEATHERBACK": "Hunting", "SHARD_LEVIATHAN": "Hunting",
  "SHARD_LITTLEFOOT": "Mining", "SHARD_LIZARD_KING": "Hunting", "SHARD_LORD_JAWBUS": "Fishing",
  "SHARD_LOTUM": "Foraging", "SHARD_LOTUS_FISH": "Fishing", "SHARD_LUMISQUID": "Global",
  "SHARD_LUNAR_MOTH": "Farming", "SHARD_MAGMA_SLUG": "Fishing", "SHARD_MATCHO": "Combat",
  "SHARD_MEGALITH": "Hunting", "SHARD_MIMIC": "Combat", "SHARD_MINER_ZOMBIE": "Mining",
  "SHARD_MINOTAUR": "Combat", "SHARD_MIST": "Global", "SHARD_MOCHIBEAR": "Foraging",
  "SHARD_MOLTENFISH": "Global", "SHARD_MOLTHORN": "Global", "SHARD_MORAY_EEL": "Hunting",
  "SHARD_MOSSYBIT": "Hunting", "SHARD_MUDWORM": "Farming", "SHARD_NAGA": "Hunting",
  "SHARD_NESSIE": "Fishing", "SHARD_NEWT": "Hunting", "SHARD_NIGHT_SQUID": "Fishing",
  "SHARD_OBSIDIAN_DEFENDER": "Global", "SHARD_PANDARAI": "Foraging", "SHARD_PEST": "Farming",
  "SHARD_PHANFLARE": "Foraging", "SHARD_PHANPYRE": "Foraging", "SHARD_PIRANHA": "Global",
  "SHARD_POWER_DRAGON": "Combat", "SHARD_PRAYING_MANTIS": "Farming", "SHARD_PRINCE": "Global",
  "SHARD_PYTHON": "Hunting", "SHARD_QUAKE": "Global", "SHARD_QUARTZFANG": "Mining",
  "SHARD_RAIN_SLIME": "Combat", "SHARD_RANA": "Taming", "SHARD_REVENANT": "Global",
  "SHARD_SALAMANDER": "Hunting", "SHARD_SALMON": "Fishing", "SHARD_SCARF": "Combat",
  "SHARD_SEAGULL": "Foraging", "SHARD_SEA_EMPEROR": "Fishing", "SHARD_SEA_SERPENT": "Hunting",
  "SHARD_SEA_SHINE": "Hunting", "SHARD_SEER": "Combat", "SHARD_SHELLWISE": "Global",
  "SHARD_SHINYFISH": "Combat", "SHARD_SILENTDEPTH": "Global", "SHARD_SKELETOR": "Combat",
  "SHARD_SNOWFIN": "Global", "SHARD_SOUL_OF_THE_ALPHA": "Combat", "SHARD_SPARROW": "Foraging",
  "SHARD_SPHINX": "Combat", "SHARD_SPIKE": "Foraging", "SHARD_STALAGMIGHT": "Combat",
  "SHARD_STARBORN": "Global", "SHARD_STAR_SENTRY": "Combat", "SHARD_STRIDER_SURFER": "Combat",
  "SHARD_SUN_FISH": "Global", "SHARD_SYCOPHANT": "Combat", "SHARD_SYLVAN": "Global",
  "SHARD_TADGANG": "Hunting", "SHARD_TANK_ZOMBIE": "Combat", "SHARD_TAURUS": "Combat",
  "SHARD_TEMPEST": "Global", "SHARD_TENEBRIS": "Global", "SHARD_TERMITE": "Farming",
  "SHARD_TERRA": "Global", "SHARD_TEWTIL": "Foraging", "SHARD_THORN": "Combat",
  "SHARD_THYST": "Combat", "SHARD_TIAMAT": "Hunting", "SHARD_TIDE": "Global",
  "SHARD_TITANOBOA": "Fishing", "SHARD_TOAD": "Hunting", "SHARD_TORTOISE": "Hunting",
  "SHARD_TOUCAN": "Taming", "SHARD_TROGLOBYTE": "Mining", "SHARD_VERDANT": "Fishing",
  "SHARD_VIPER": "Hunting", "SHARD_VORACIOUS_SPIDER": "Combat", "SHARD_WARTYBUG": "Farming",
  "SHARD_WATER_HYDRA": "Fishing", "SHARD_WITHER": "Global", "SHARD_WITHER_SPECTER": "Combat",
  "SHARD_WYVERN": "Hunting", "SHARD_XYZ": "Global", "SHARD_YOG": "Global",
  "SHARD_ZEALOT": "Combat", "SHARD_ZOMBIE_SOLDIER": "Combat",
};

/* Our map is derived from the wiki's per-attribute Skill column and wins.
 * SkyShards' own `type` field is close but not the same concept (it carries
 * values like "Alchemy" that the in-game filter has no entry for), so it only
 * fills shards the wiki never documented, and only for a recognised skill. */
function attributeSkillForBazaarId(bazaarId, upstreamType = null) {
  const known = ATTRIBUTE_SKILL_BY_BAZAAR_ID[bazaarId];
  if (known) return known;
  if (upstreamType && ATTRIBUTE_SKILLS.includes(upstreamType)) return upstreamType;
  return "Unknown";
}

/* Kept for callers that only hold a SkyShards code. Needs the code -> Bazaar id
 * map the shards DB builds, so it takes it as an argument. */
function attributeSkillForCode(code, codeToBazaar) {
  const bazaarId = codeToBazaar && codeToBazaar[code];
  return bazaarId ? attributeSkillForBazaarId(bazaarId) : "Unknown";
}

/* ---------- Bazaar id resolution ----------
 *
 * SkyShards names a shard the way the wiki does; the Bazaar names it the way
 * the game's item registry does, and the two drift. Rather than pin a table of
 * SkyShards codes (which upstream reassigns), we resolve a shard's Bazaar id
 * from its display name and check the answer against the live Bazaar product
 * list. Three passes, each claiming ids so two shards can never take the same
 * one:
 *
 *   1. an explicit alias, for names no rule can reach ("Inkling" -> NIGHT_SQUID)
 *   2. the plain normalised name       ("Lapis Zombie" -> SHARD_LAPIS_ZOMBIE)
 *   3. spelling variants: one underscore added, one removed, or the last word
 *      dropped  ("Cinderbat" -> CINDER_BAT, "Abyssal Lanternfish" -> ABYSSAL_LANTERN)
 *
 * Anything the Bazaar sells that no SkyShards entry claims is added to the
 * catalogue anyway, so a shard Hypixel ships before SkyShards documents it
 * still appears and still gets priced. */
const SHARD_NAME_TO_BAZAAR_ALIASES = {
  "Inkling":             "SHARD_NIGHT_SQUID",
  "Field Mouse":         "SHARD_PEST",
  "Earthworm":           "SHARD_TERMITE",
  "Beetle":              "SHARD_CROPEETLE",
  "Loch Emperor":        "SHARD_SEA_EMPEROR",
  "Zealot Bruiser":      "SHARD_BRUISER",
  "Abyssal Lanternfish": "SHARD_ABYSSAL_LANTERN",
  "Wither Spectre":      "SHARD_WITHER_SPECTER",
  /* Names the older bundled snapshot uses, so the offline fallback resolves too. */
  "Cinderbat":           "SHARD_CINDER_BAT",
  "Stridersurfer":       "SHARD_STRIDER_SURFER",
  "Flipflopper":         "SHARD_FLIP_FLOPPER",
  "Seashine":            "SHARD_SEA_SHINE",
  "Lotusfish":           "SHARD_LOTUS_FISH",
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

/* Every spelling of a Bazaar id we are willing to try for one display name,
 * cheapest guess first. */
function bazaarIdVariants(bazaarId) {
  const body = bazaarId.replace(/^SHARD_/, "");
  const parts = body.split("_");
  const out = [];
  /* one underscore inserted inside a word: CINDERBAT -> CINDER_BAT */
  parts.forEach((word, wi) => {
    for (let k = 2; k < word.length - 1; k++) {
      const copy = parts.slice();
      copy[wi] = `${word.slice(0, k)}_${word.slice(k)}`;
      out.push(`SHARD_${copy.join("_")}`);
    }
  });
  /* one underscore removed: END_STONE_PROTECTOR -> ENDSTONE_PROTECTOR */
  for (let i = 0; i < parts.length - 1; i++) {
    const copy = parts.slice();
    copy.splice(i, 2, parts[i] + parts[i + 1]);
    out.push(`SHARD_${copy.join("_")}`);
  }
  /* last word dropped: ABYSSAL_LANTERNFISH -> ABYSSAL_LANTERN is covered above,
   * but WITHER_SPECTRE -> WITHER needs this. Claim order keeps it safe. */
  if (parts.length > 1) out.push(`SHARD_${parts.slice(0, -1).join("_")}`);
  return out;
}

/* Build the merged SHARDS_DB.
 *
 * `fusionProps` is the SkyShards metadata. `bazaarIds` is the set of SHARD_*
 * product ids the live Bazaar currently sells; pass it and the catalogue is
 * reconciled against the real market, omit it and we fall back to the plain
 * name guess (first load, before the Bazaar response arrives).
 *
 * Returns:
 *   {
 *     shardsDb:     { [bazaarId]: {name, attribute, rarity, family, category, code} },
 *     codeToBazaar: { [skyShardsCode]: bazaarId },
 *     bazaarToCode: { [bazaarId]: skyShardsCode },
 *     unlisted:     [names SkyShards knows that the Bazaar does not sell],
 *     bazaarOnly:   [Bazaar ids no SkyShards entry claimed],
 *   } */
function buildShardsDbFromProperties(fusionProps, bazaarIds = null, fusionShards = null) {
  const shardsDb = {};
  const codeToBazaar = {};
  const bazaarToCode = {};
  const known = bazaarIds instanceof Set ? bazaarIds : (bazaarIds ? new Set(bazaarIds) : null);
  const entries = Object.entries(fusionProps);
  const resolved = new Map();   // code -> bazaarId
  const claimed = new Set();    // bazaarId already taken

  const claim = (code, id) => {
    if (!id || claimed.has(id)) return false;
    resolved.set(code, id);
    claimed.add(id);
    return true;
  };

  /* Pass 0 — SkyShards' own internal_id, which is the Bazaar product id. This
   * is authoritative and covers every documented shard, so the name-based
   * passes below only ever run for data that predates the field. */
  if (fusionShards) {
    for (const [code] of entries) {
      const id = fusionShards[code]?.internal_id;
      if (id && (!known || known.has(id))) claim(code, id);
    }
  }
  /* Pass 1 — explicit aliases. */
  for (const [code, info] of entries) {
    if (resolved.has(code)) continue;
    const alias = SHARD_NAME_TO_BAZAAR_ALIASES[info.name];
    if (alias && (!known || known.has(alias))) claim(code, alias);
  }
  /* Pass 2 — the plain normalised name. */
  for (const [code, info] of entries) {
    if (resolved.has(code)) continue;
    const id = nameToBazaarId(info.name);
    if (!known || known.has(id)) claim(code, id);
  }
  /* Pass 3 — spelling variants, only against ids the Bazaar really has. */
  if (known) {
    for (const [code, info] of entries) {
      if (resolved.has(code)) continue;
      for (const variant of bazaarIdVariants(nameToBazaarId(info.name))) {
        if (known.has(variant) && claim(code, variant)) break;
      }
    }
  }

  const unlisted = [];
  for (const [code, info] of entries) {
    const bazaarId = resolved.get(code);
    if (!bazaarId) { unlisted.push(info.name); continue; }

    const rarity = RARITY_FROM_CODE[code[0]] || "UNKNOWN";
    /* `family` in the JSON is an array of one (rarely two) attribute names. */
    const attribute = (info.family && info.family[0]) || info.name;

    shardsDb[bazaarId] = {
      name:      `${info.name} Shard`,
      attribute,
      rarity,
      family:    info.category || "—",  // "Forest", "Water", "Combat", etc.
      category:  info.category || "—",
      attributeSkill: attributeSkillForBazaarId(bazaarId, fusionShards?.[code]?.type),
      code,
      huntLevel: null,
    };
    codeToBazaar[code]     = bazaarId;
    bazaarToCode[bazaarId] = code;
  }

  /* Anything on the Bazaar that SkyShards has not documented yet still belongs
   * in the market. It gets a name from its id and no fusion metadata, so it
   * prices and sorts like any other shard and simply has no recipes. */
  const bazaarOnly = [];
  if (known) {
    for (const id of known) {
      if (shardsDb[id]) continue;
      bazaarOnly.push(id);
      shardsDb[id] = {
        name:      prettifyShardId(id),
        attribute: prettifyShardId(id).replace(/ Shard$/, ""),
        rarity:    "UNKNOWN",
        family:    "—",
        category:  "—",
        attributeSkill: attributeSkillForBazaarId(id),
        code:      null,
        huntLevel: null,
        undocumented: true,
      };
    }
  }

  return { shardsDb, codeToBazaar, bazaarToCode, unlisted, bazaarOnly };
}

window.ATTRIBUTE_SKILL_BY_BAZAAR_ID = ATTRIBUTE_SKILL_BY_BAZAAR_ID;
window.attributeSkillForBazaarId = attributeSkillForBazaarId;
window.ATTRIBUTE_SKILLS = ATTRIBUTE_SKILLS;
window.attributeSkillForCode = attributeSkillForCode;

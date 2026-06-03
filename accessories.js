/* =========================================================================
 * accessories.js
 *
 * Accessory ("talisman") analysis for the linked player:
 *   - Detects which accessories the player owns (from the decoded talisman bag)
 *   - Computes MISSING accessories (own none in the family) ranked by the
 *     Magical Power they'd add — like SkyHelper's /missing command.
 *   - Computes UPGRADEABLE accessories (own a lower tier of an upgrade family
 *     than the family's max) — what to upgrade for more MP.
 *   - Generates the in-game chat commands to source them:
 *       /bz <item>   for bazaar-tradable accessories
 *       /ahs <item>  for Auction-House-only accessories
 *
 * Data source: the official /v2/resources/skyblock/items endpoint (no key).
 * Upgrade families are derived from the shared base name + the canonical
 * suffix progression: Talisman/Badge → Ring → Artifact → Relic → Heirloom
 * → Chronomicon.
 * ======================================================================= */

"use strict";

/* Magical Power granted by an accessory, purely by rarity.
 * Source: https://wiki.hypixel.net/Magical_Power
 * Special/very-special rarities (e.g. Hegemony, Abicase) have per-item
 * overrides handled separately. */
const MP_BY_RARITY = {
  COMMON:     3,
  UNCOMMON:   5,
  RARE:       8,
  EPIC:      12,
  LEGENDARY: 16,
  MYTHIC:    22,
  SPECIAL:    3,
  VERY_SPECIAL: 5,
};

/* A handful of accessories grant non-standard MP regardless of their tier. */
const MP_OVERRIDES = {
  HEGEMONY_ARTIFACT: 32,   // counts twice in-game: legendary MP (16) × 2
  RIFT_PRISM:        11,   // SkyCrypt/SkyHelper account for its fixed 11 MP
  ABICASE:            0,   // MP scales with contacts; we don't model that
};

/* Suffix progression rank within an upgrade family.
 * Most lines are Talisman → Ring → Artifact → Relic, but live Hypixel
 * accessories include extra nouns in real upgrade chains:
 *   - Pesthunter Badge → Ring → Artifact → Relic
 *   - Bingo/Freshly Baked ... → Relic → Heirloom
 *   - Crux ... → Relic → Heirloom → Chronomicon
 * Treat same-rank starter nouns as the same family tier so owning a max tier
 * never leaves the starter rendered as a separate missing accessory. */
const ACCESSORY_SUFFIX_RANK = {
  BADGE:       0,
  TALISMAN:    0,
  RING:        1,
  ARTIFACT:    2,
  RELIC:       3,
  HEIRLOOM:    4,
  CHRONOMICON: 5,
};

/* Maintained upgrade chains from SkyCrypt/NotEnoughUpdates-style logic.
 * The suffix heuristic catches many simple Talisman → Ring → Artifact lines,
 * but it misses real chains whose names do not share a suffix-stripped base
 * (Cat → Lynx → Cheetah, Personal Compactors, Scarf Studies, etc.). Keep
 * these explicit first, then let the heuristic fill in newer normal chains. */
const EXPLICIT_ACCESSORY_FAMILIES = [
  ["WOLF_TALISMAN", "WOLF_RING"],
  ["BLOOD_GOD_CREST", "BLOOD_GOD_SIGIL"],
  ["BLUETOOTH_RING", "BLUERTOOTH_RING"],
  ["CENTURY_TALISMAN", "CENTURY_RING"],
  ["DAY_CRYSTAL", "SUNSHINE_CRYSTAL"],
  ["NIGHT_CRYSTAL", "MOONLIGHT_CRYSTAL"],
  ["FROZEN_CHICKEN", "FRIED_FROZEN_CHICKEN"],
  ["KUUDRAS_KIDNEY", "KUUDRAS_LUNG", "KUUDRAS_HEART"],
  ["SMALL_FISH_BOWL", "MEDIUM_FISH_BOWL", "LARGE_FISH_BOWL"],
  ["IQ_POINT", "TWO_IQ_POINT"],
  ["CRUX_TALISMAN_1", "CRUX_TALISMAN_2", "CRUX_TALISMAN_3", "CRUX_TALISMAN_4", "CRUX_TALISMAN_5", "CRUX_TALISMAN_6", "CRUX_TALISMAN_7"],
  ["POTION_AFFINITY_TALISMAN", "RING_POTION_AFFINITY", "ARTIFACT_POTION_AFFINITY"],
  ["TALISMAN_OF_SPACE", "RING_OF_SPACE", "ARTIFACT_OF_SPACE"],
  ["FEATHER_TALISMAN", "FEATHER_RING", "FEATHER_ARTIFACT"],
  ["SEA_CREATURE_TALISMAN", "SEA_CREATURE_RING", "SEA_CREATURE_ARTIFACT"],
  ["HEALING_TALISMAN", "HEALING_RING"],
  ["CANDY_TALISMAN", "CANDY_RING", "CANDY_ARTIFACT", "CANDY_RELIC"],
  ["INTIMIDATION_TALISMAN", "INTIMIDATION_RING", "INTIMIDATION_ARTIFACT", "INTIMIDATION_RELIC"],
  ["SPIDER_TALISMAN", "SPIDER_RING", "SPIDER_ARTIFACT"],
  ["RED_CLAW_TALISMAN", "RED_CLAW_RING", "RED_CLAW_ARTIFACT"],
  ["HUNTER_TALISMAN", "HUNTER_RING"],
  ["ZOMBIE_TALISMAN", "ZOMBIE_RING", "ZOMBIE_ARTIFACT"],
  ["BAT_TALISMAN", "BAT_RING", "BAT_ARTIFACT"],
  ["SPEED_TALISMAN", "SPEED_RING", "SPEED_ARTIFACT", "SPEED_RELIC"],
  ["PERSONAL_COMPACTOR_4000", "PERSONAL_COMPACTOR_5000", "PERSONAL_COMPACTOR_6000", "PERSONAL_COMPACTOR_7000"],
  ["PERSONAL_DELETOR_4000", "PERSONAL_DELETOR_5000", "PERSONAL_DELETOR_6000", "PERSONAL_DELETOR_7000"],
  ["SCARF_STUDIES", "SCARF_THESIS", "SCARF_GRIMOIRE"],
  ["CAT_TALISMAN", "LYNX_TALISMAN", "CHEETAH_TALISMAN"],
  ["SHADY_RING", "CROOKED_ARTIFACT", "SEAL_OF_THE_FAMILY"],
  ["TREASURE_TALISMAN", "TREASURE_RING", "TREASURE_ARTIFACT"],
  ["BEASTMASTER_CREST_COMMON", "BEASTMASTER_CREST_UNCOMMON", "BEASTMASTER_CREST_RARE", "BEASTMASTER_CREST_EPIC", "BEASTMASTER_CREST_LEGENDARY"],
  ["RAGGEDY_SHARK_TOOTH_NECKLACE", "DULL_SHARK_TOOTH_NECKLACE", "HONED_SHARK_TOOTH_NECKLACE", "SHARP_SHARK_TOOTH_NECKLACE", "RAZOR_SHARP_SHARK_TOOTH_NECKLACE"],
  ["BAT_PERSON_TALISMAN", "BAT_PERSON_RING", "BAT_PERSON_ARTIFACT"],
  ["LUCKY_HOOF", "ETERNAL_HOOF"],
  ["RING_OF_BROKEN_LOVE", "RING_OF_ETERNAL_LOVE"],
  ["WITHER_ARTIFACT", "WITHER_RELIC"],
  ["WEDDING_RING_0", "WEDDING_RING_2", "WEDDING_RING_4", "WEDDING_RING_7", "WEDDING_RING_9"],
  ["CAMPFIRE_TALISMAN_1", "CAMPFIRE_TALISMAN_4", "CAMPFIRE_TALISMAN_8", "CAMPFIRE_TALISMAN_13", "CAMPFIRE_TALISMAN_21"],
  ["JERRY_TALISMAN_GREEN", "JERRY_TALISMAN_BLUE", "JERRY_TALISMAN_PURPLE", "JERRY_TALISMAN_GOLDEN"],
  ["TITANIUM_TALISMAN", "TITANIUM_RING", "TITANIUM_ARTIFACT", "TITANIUM_RELIC"],
  ["BAIT_RING", "SPIKED_ATROCITY"],
  ["MASTER_SKULL_TIER_1", "MASTER_SKULL_TIER_2", "MASTER_SKULL_TIER_3", "MASTER_SKULL_TIER_4", "MASTER_SKULL_TIER_5", "MASTER_SKULL_TIER_6", "MASTER_SKULL_TIER_7", "MASTER_SKULL_TIER_8", "MASTER_SKULL_TIER_9", "MASTER_SKULL_TIER_10"],
  ["SOULFLOW_PILE", "SOULFLOW_BATTERY", "SOULFLOW_SUPERCELL"],
  ["ENDER_ARTIFACT", "ENDER_RELIC"],
  ["POWER_TALISMAN", "POWER_RING", "POWER_ARTIFACT", "POWER_RELIC"],
  ["BINGO_TALISMAN", "BINGO_RING", "BINGO_ARTIFACT", "BINGO_RELIC", "BINGO_HEIRLOOM"],
  ["BURSTSTOPPER_TALISMAN", "BURSTSTOPPER_ARTIFACT"],
  ["ODGERS_BRONZE_TOOTH", "ODGERS_SILVER_TOOTH", "ODGERS_GOLD_TOOTH", "ODGERS_DIAMOND_TOOTH"],
  ["GREAT_SPOOK_TALISMAN", "GREAT_SPOOK_RING", "GREAT_SPOOK_ARTIFACT"],
  ["DRACONIC_TALISMAN", "DRACONIC_RING", "DRACONIC_ARTIFACT"],
  ["BURNING_KUUDRA_CORE", "FIERY_KUUDRA_CORE", "INFERNAL_KUUDRA_CORE"],
  ["VACCINE_TALISMAN", "VACCINE_RING", "VACCINE_ARTIFACT"],
  ["WHITE_GIFT_TALISMAN", "GREEN_GIFT_TALISMAN", "BLUE_GIFT_TALISMAN", "PURPLE_GIFT_TALISMAN", "GOLD_GIFT_TALISMAN"],
  ["GLACIAL_TALISMAN", "GLACIAL_RING", "GLACIAL_ARTIFACT"],
  ["CROPIE_TALISMAN", "SQUASH_RING", "FERMENTO_ARTIFACT", "HELIANTHUS_RELIC"],
  ["KUUDRA_FOLLOWER_ARTIFACT", "KUUDRA_FOLLOWER_RELIC"],
  ["AGARIMOO_TALISMAN", "AGARIMOO_RING", "AGARIMOO_ARTIFACT"],
  ["BLOOD_DONOR_TALISMAN", "BLOOD_DONOR_RING", "BLOOD_DONOR_ARTIFACT"],
  ["LUSH_TALISMAN", "LUSH_RING", "LUSH_ARTIFACT"],
  ["ANITA_TALISMAN", "ANITA_RING", "ANITA_ARTIFACT"],
  ["PESTHUNTER_BADGE", "PESTHUNTER_RING", "PESTHUNTER_ARTIFACT", "PESTHUNTER_RELIC"],
  ["NIBBLE_CHOCOLATE_STICK", "SMOOTH_CHOCOLATE_BAR", "RICH_CHOCOLATE_CHUNK", "GANACHE_CHOCOLATE_SLAB", "PRESTIGE_CHOCOLATE_REALM"],
  ["COIN_TALISMAN", "RING_OF_COINS", "ARTIFACT_OF_COINS", "RELIC_OF_COINS"],
  ["SCAVENGER_TALISMAN", "SCAVENGER_RING", "SCAVENGER_ARTIFACT"],
  ["EMERALD_RING", "EMERALD_ARTIFACT"],
  ["MINERAL_TALISMAN", "GLOSSY_MINERAL_TALISMAN"],
  ["HASTE_RING", "HASTE_ARTIFACT"],
];

const ACCESSORY_ALIASES = {
  WEDDING_RING_0: ["WEDDING_RING_1"],
  WEDDING_RING_2: ["WEDDING_RING_3"],
  WEDDING_RING_4: ["WEDDING_RING_5", "WEDDING_RING_6"],
  WEDDING_RING_7: ["WEDDING_RING_8"],
  CAMPFIRE_TALISMAN_1: ["CAMPFIRE_TALISMAN_2", "CAMPFIRE_TALISMAN_3"],
  CAMPFIRE_TALISMAN_4: ["CAMPFIRE_TALISMAN_5", "CAMPFIRE_TALISMAN_6", "CAMPFIRE_TALISMAN_7"],
  CAMPFIRE_TALISMAN_8: ["CAMPFIRE_TALISMAN_9", "CAMPFIRE_TALISMAN_10", "CAMPFIRE_TALISMAN_11", "CAMPFIRE_TALISMAN_12"],
  CAMPFIRE_TALISMAN_13: ["CAMPFIRE_TALISMAN_14", "CAMPFIRE_TALISMAN_15", "CAMPFIRE_TALISMAN_16", "CAMPFIRE_TALISMAN_17", "CAMPFIRE_TALISMAN_18", "CAMPFIRE_TALISMAN_19", "CAMPFIRE_TALISMAN_20"],
  CAMPFIRE_TALISMAN_21: ["CAMPFIRE_TALISMAN_22", "CAMPFIRE_TALISMAN_23", "CAMPFIRE_TALISMAN_24", "CAMPFIRE_TALISMAN_25", "CAMPFIRE_TALISMAN_26", "CAMPFIRE_TALISMAN_27", "CAMPFIRE_TALISMAN_28", "CAMPFIRE_TALISMAN_29"],
  PARTY_HAT_CRAB: ["PARTY_HAT_CRAB_ANIMATED", "PARTY_HAT_SLOTH", "BALLOON_HAT_2024"],
  PIGGY_BANK: ["BROKEN_PIGGY_BANK", "CRACKED_PIGGY_BANK"],
  DANTE_TALISMAN: ["DANTE_RING"],
};

const ACCESSORY_ALIAS_TO_CANONICAL = Object.fromEntries(
  Object.entries(ACCESSORY_ALIASES).flatMap(([canonical, aliases]) => aliases.map((alias) => [alias, canonical]))
);
const EXPLICIT_FAMILY_IDS = new Set(EXPLICIT_ACCESSORY_FAMILIES.flat());
const ACCESSORY_ALIAS_IDS = new Set(Object.keys(ACCESSORY_ALIAS_TO_CANONICAL));

const TIER_RANK = {
  COMMON: 0, UNCOMMON: 1, RARE: 2, EPIC: 3,
  LEGENDARY: 4, MYTHIC: 5, SPECIAL: 6, VERY_SPECIAL: 7, SUPREME: 8,
};

/* MP for a single accessory item record. */
function accessoryMP(item) {
  if (!item) return 0;
  if (item.id in MP_OVERRIDES) return MP_OVERRIDES[item.id];
  return MP_BY_RARITY[item.tier] ?? 0;
}

/* Rarity progression for recombobulator (bumps exactly one tier). */
const RARITY_ORDER = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"];

/* The MP an accessory would have one rarity tier higher (after recombobulating).
 * Returns { nextRarity, nextMP, mpGain } or null if already at top / no gain. */
function recombGain(item) {
  if (item.id === "HEGEMONY_ARTIFACT") {
    return { nextRarity: "MYTHIC", nextMP: 44, mpGain: 12 };
  }
  const idx = RARITY_ORDER.indexOf(item.tier);
  if (idx < 0 || idx >= RARITY_ORDER.length - 1) return null;
  const nextRarity = RARITY_ORDER[idx + 1];
  const nextMP = MP_BY_RARITY[nextRarity] ?? item.mp;
  const mpGain = nextMP - item.mp;
  if (mpGain <= 0) return null;
  return { nextRarity, nextMP, mpGain };
}

/* Build the Hypixel Wiki URL for an item by display name.
 *   "Tarantula Ring"        → https://wiki.hypixel.net/Tarantula_Ring
 *   "Anita's Talisman"      → https://wiki.hypixel.net/Anita's_Talisman
 *   "Nature Elemental Shard"→ https://wiki.hypixel.net/Nature_Elemental_Shard */
function wikiUrl(displayName) {
  if (!displayName) return null;
  const slug = displayName.trim().replace(/ /g, "_");
  return `https://wiki.hypixel.net/${encodeURI(slug)}`;
}

/* Strip the upgrade suffix off an accessory name, returning its family base.
 * "Tarantula Ring" → "Tarantula";  "Bat Artifact" → "Bat".
 * Returns null when the name has no recognised suffix (standalone accessory). */
function accessoryFamilyBase(name) {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1]?.toUpperCase();
  if (last in ACCESSORY_SUFFIX_RANK && parts.length > 1) {
    return parts.slice(0, -1).join(" ");
  }
  return null;
}

/* ------------------------------------------------------------------------ */
/* Build the accessory catalog from the items API.                          */
/*                                                                          */
/* Returns:                                                                  */
/*   {                                                                       */
/*     byId:        { [id]: {id, name, tier, mp, soulbound, canAuction} }   */
/*     families:    [ { base, members: [items sorted low→high] } ]          */
/*     standalone:  [ items with no upgrade family ]                        */
/*   }                                                                       */
/* ------------------------------------------------------------------------ */
function getSkinTextureId(it) {
  if (!it?.skin?.value) return null;
  try {
    const decoded = JSON.parse(atob(it.skin.value));
    const url = decoded?.textures?.SKIN?.url;
    if (url) {
      return url.split("/").pop();
    }
  } catch (e) {
    console.warn("Failed to parse skull skin value:", e);
  }
  return null;
}
window.getSkinTextureId = getSkinTextureId;

function buildAccessoryCatalog(itemsPayload) {
  const all = (itemsPayload?.items || []).filter((i) => i.category === "ACCESSORY");

  const byId = {};
  for (const it of all) {
    byId[it.id] = {
      id:         it.id,
      name:       it.name,
      tier:       it.tier || "COMMON",
      mp:         accessoryMP(it),
      soulbound:  !!it.soulbound,                 // SOLO or COOP — can't be bought on AH
      soulboundType: it.soulbound || null,        // "SOLO" | "COOP" | null
      canAuction: it.can_auction !== false && !it.soulbound,
      canRecomb:  it.can_recombobulate !== false, // default true unless explicitly false
      base:       accessoryFamilyBase(it.name),
      skinTextureId: getSkinTextureId(it),
    };
  }

  const families = [];
  const familyMemberIds = new Set();

  /* Start with explicit community-maintained chains. */
  for (const ids of EXPLICIT_ACCESSORY_FAMILIES) {
    const members = ids.map((id) => byId[id]).filter(Boolean);
    if (members.length < 2) continue;
    const base = members[0].base || members[0].name.replace(/\s+(Talisman|Badge|Ring|Artifact|Relic|Heirloom|Chronomicon)$/i, "");
    families.push({ base, members });
    members.forEach((m) => familyMemberIds.add(m.id));
  }

  /* Then group newer normal chains by suffix-stripped base name. */
  const famMap = {};
  for (const id in byId) {
    if (EXPLICIT_FAMILY_IDS.has(id) || ACCESSORY_ALIAS_IDS.has(id)) continue;
    const a = byId[id];
    if (!a.base) continue;
    (famMap[a.base] ||= []).push(a);
  }

  for (const [base, members] of Object.entries(famMap)) {
    if (members.length < 2) continue;   // not a real chain
    members.sort((x, y) =>
      (ACCESSORY_SUFFIX_RANK[x.name.split(/\s+/).pop().toUpperCase()] ?? 99) -
      (ACCESSORY_SUFFIX_RANK[y.name.split(/\s+/).pop().toUpperCase()] ?? 99)
    );
    families.push({ base, members });
    members.forEach((m) => familyMemberIds.add(m.id));
  }

  const standalone = Object.values(byId).filter((a) => !familyMemberIds.has(a.id) && !ACCESSORY_ALIAS_IDS.has(a.id));

  return { byId, families, standalone };
}

/* ------------------------------------------------------------------------ */
/* Analyse what the player owns vs. the catalog.                            */
/*                                                                          */
/*   owned: Set<string> of ids, OR Map<string, {recombobulated:bool}>       */
/*                                                                          */
/* Returns:                                                                  */
/*   {                                                                       */
/*     currentMP, maxMP,                                                     */
/*     missing:    [ {item, mp, reason} ]        sorted by mp desc          */
/*     upgrades:   [ {owned, target, mpGain} ]   sorted by mpGain desc      */
/*     recombs:    [ {item, nextRarity, mpGain} ] maxed-tier, not recombed  */
/*   }                                                                       */
/* ------------------------------------------------------------------------ */
function analyseAccessories(catalog, owned, opts = {}) {
  const preferMax = opts.preferMax !== false;   // default: target family max

  /* Accept either a Set of ids or a Map of id → {recombobulated}.
   * Aliases are treated as the canonical item, matching SkyCrypt's duplicate
   * handling for Wedding Ring/Campfire/Piggy Bank/Dante/etc. */
  const ownedHasRaw = (id) => (owned instanceof Map ? owned.has(id) : owned.has(id));
  const ownedHas = (id) => ownedHasRaw(id) || (ACCESSORY_ALIASES[id] || []).some((alias) => ownedHasRaw(alias));
  const isRecombed = (id) => {
    if (!(owned instanceof Map)) return false;
    if (owned.get(id)?.recombobulated) return true;
    return (ACCESSORY_ALIASES[id] || []).some((alias) => !!owned.get(alias)?.recombobulated);
  };

  const missing = [];
  const upgrades = [];
  const recombs = [];

  let currentMP = 0;
  let maxMP = 0;

  /* Helper: record a recomb suggestion for an owned, max-tier-in-family item. */
  const considerRecomb = (item) => {
    if (!item.canRecomb) return;
    if (isRecombed(item.id)) return;          // already recombobulated
    const g = recombGain(item);
    if (!g) return;                            // already mythic / no gain
    recombs.push({ item, nextRarity: g.nextRarity, mpGain: g.mpGain });
  };

  /* Track which families the player has at least one member of, and the
   * highest tier they own within each. */
  for (const fam of catalog.families) {
    const highest = fam.members[fam.members.length - 1];
    maxMP += highest.mp;

    /* Which members does the player own? */
    const ownedMembers = fam.members.filter((m) => ownedHas(m.id));

    if (ownedMembers.length === 0) {
      /* Whole family missing. Target the family MAX when preferMax, else the
       * cheapest entry point (the base/first tier). */
      const target = preferMax ? highest : fam.members[0];
      missing.push({
        item: target,
        mp: target.mp,
        family: fam.base,
        reason: "family-missing",
      });
      continue;
    }

    /* Own at least one — credit the highest owned, flag upgrade if not top. */
    const bestOwned = ownedMembers[ownedMembers.length - 1];
    const recombed = isRecombed(bestOwned.id);
    const rGain = recombed ? (recombGain(bestOwned)?.mpGain || 0) : 0;
    currentMP += bestOwned.mp + rGain;

    if (bestOwned.id !== highest.id) {
      /* Upgrade target: family max when preferMax, else the next tier up. */
      const ownedIdx = fam.members.findIndex((m) => m.id === bestOwned.id);
      const target = preferMax ? highest : fam.members[ownedIdx + 1];
      upgrades.push({
        owned:  bestOwned,
        target,
        mpGain: target.mp - bestOwned.mp,
        family: fam.base,
      });
    } else {
      /* Already at the family's top item — recombobulating is the only way up. */
      considerRecomb(bestOwned);
    }
  }

  /* Standalone accessories — own it or you don't. */
  for (const a of catalog.standalone) {
    maxMP += a.mp;
    if (ownedHas(a.id)) {
      const recombed = isRecombed(a.id);
      const rGain = recombed ? (recombGain(a)?.mpGain || 0) : 0;
      currentMP += a.mp + rGain;
      considerRecomb(a);   // owned standalone → can recombobulate for more MP
    } else if (a.mp > 0 && !a.soulbound) {
      /* Skip soulbound (can't be bought on AH) and zero-MP items in the
       * "missing" list — they're not actionable buy targets. */
      missing.push({
        item: a,
        mp: a.mp,
        family: null,
        reason: "standalone-missing",
      });
    }
  }

  missing.sort((x, y) => y.mp - x.mp);
  upgrades.sort((x, y) => y.mpGain - x.mpGain);
  recombs.sort((x, y) => y.mpGain - x.mpGain);

  return { currentMP, maxMP, missing, upgrades, recombs };
}

/* Build the in-game chat command for sourcing an accessory.
 *   Bazaar-tradable → /bz <name>
 *   AH-only         → /ahs <name>
 * SkyBlock's /bz and /ahs match on display name, so we pass the clean name. */
function sourcingCommand(accessory, isBazaar) {
  const verb = isBazaar ? "/bz" : "/ahs";
  return `${verb} ${accessory.name}`;
}

/* Expose globals for script.js (no module system). */
window.buildAccessoryCatalog = buildAccessoryCatalog;
window.analyseAccessories    = analyseAccessories;
window.sourcingCommand       = sourcingCommand;
window.accessoryMP           = accessoryMP;
window.wikiUrl               = wikiUrl;
window.recombGain            = recombGain;

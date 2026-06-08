/* =========================================================================
 * script.js — Shard Market
 * Hypixel SkyBlock Attribute Shard profitability + fusion analyzer.
 *
 * No build step. No backend. Pure browser JavaScript, designed for hosting
 * on GitHub Pages.
 *
 * SECTIONS
 *   1. Config & constants
 *   2. State container
 *   3. Cache (localStorage with TTL)
 *   4. API + static-data clients
 *   5. Profitability math (flip)
 *   6. Fusion math (craft-vs-buy)
 *   7. Pipeline: raw → enriched → filtered → sorted
 *   8. Rendering / DOM
 *   9. Event handlers & boot
 * ======================================================================= */

"use strict";

/* =========================================================================
 * 1. CONFIG
 * ======================================================================= */
const CONFIG = {
  API_BASE: "https://hypixie.skermiebro.workers.dev",
  BAZAAR_ENDPOINT: "/skyblock/bazaar",
  PROFILES_ENDPOINT: "/skyblock/profiles",
  GARDEN_ENDPOINT: "/skyblock/garden",
  ITEMS_ENDPOINT: "/resources/skyblock/items",
  ELITE_CONTEST_ENDPOINT: "/elite/contests/at/now",
  FIRESALES_PUBLIC_URL: "https://api.hypixel.net/v2/skyblock/firesales",

  /* CORS-friendly Mojang proxy for username → UUID resolution. */
  USERNAME_LOOKUP_URL: "https://api.ashcon.app/mojang/v2/user/",

  /* Static SkyShards datasets (bundled in /data/). */
  FUSION_PROPS_URL: "data/fusion-properties.json",
  FUSION_DATA_URL:  "data/fusion-data.json",
  ATTR_DESC_URL:    "data/attribute-desc.json",

  /* Public bazaar endpoint needs no key. The key IS required for profile
   * lookups — surfaced to the user with a clear error. */
  API_KEY_STORAGE: "shardmarket.apiKey",

  /* Bazaar tax (sell-order tax) — default 1.25% base. Configurable in UI. */
  TAX_STORAGE:  "shardmarket.tax",
  DEFAULT_TAX:  0.0125,

  /* Texture pack preference. */
  TEXTURE_STORAGE: "shardmarket.texturePack",
  DEFAULT_TEXTURE: "vanilla",

  /* Player profile preferences. */
  USERNAME_STORAGE:    "shardmarket.username",
  PROFILE_ID_STORAGE:  "shardmarket.profileId",
  SWEEP_SHOW_COMPLETED_STORAGE: "shardmarket.sweep.showCompleted",
  GARDEN_CHIP_RARITY_STORAGE: "hypixie.gardenChips.targetRarity",
  GARDEN_CHIP_LEVEL_STORAGE: "hypixie.gardenChips.targetLevel",
  GARDEN_CHIP_SORT_STORAGE: "hypixie.gardenChips.sort",
  GARDEN_CHIP_PROGRESS_STORAGE: "hypixie.gardenChips.progress.v1",

  /* Cache TTLs. */
  CACHE_TTL_BAZAAR_MS:  60_000,
  CACHE_TTL_STATIC_MS:  86_400_000,
  CACHE_TTL_PROFILE_MS: 300_000,        // 5 min — profiles change slowly
  CACHE_KEY_BAZAAR:        "shardmarket.cache.bazaar",
  CACHE_KEY_FUSION_PROPS:  "shardmarket.cache.fusionProps.v1",
  CACHE_KEY_FUSION_DATA:   "shardmarket.cache.fusionData.v1",
  CACHE_KEY_ITEMS:         "shardmarket.cache.items.v1",
  CACHE_KEY_ATTR_DESC:     "shardmarket.cache.attrDesc.v1",
  CACHE_KEY_BINS:          "shardmarket.cache.lowestBins.v2",
  CACHE_KEY_FIRESALES:     "shardmarket.cache.fireSales.v1",
  CACHE_KEY_PROFILE_PREFIX: "shardmarket.cache.profile.",  // + uuid
  CACHE_KEY_GARDEN_PREFIX:  "shardmarket.cache.garden.",   // + profile id
  CACHE_TTL_BINS_MS:       300_000,   // 5 min — AH moves but a full scan is heavy
  CACHE_TTL_FIRESALES_MS:  60_000,    // Fire Sales are public and can update around start/end times

  /* Accessory page preferences. */
  BAZAAR_MODE_STORAGE: "shardmarket.bazaarMode",  // "instaBuy" | "buyOrder"
  PREFER_MAX_STORAGE:  "shardmarket.preferMax",   // "1" | "0"
  ACC_SORT_STORAGE:    "shardmarket.accSortKey",  // "mp" | "costPerMp" | "price"

  /* Filter out dead markets where no shards traded in the past week. */
  MIN_WEEKLY_VOLUME: 1,
};

/* =========================================================================
 * 2. STATE
 *    Single source of truth, mutated by API/UI code, read by renderers.
 * ======================================================================= */
const state = {
  /* Raw data */
  raw:            null,   // raw bazaar response
  fusionProps:    null,   // SkyShards properties (per-shard metadata)
  fusionRecipes:  null,   // SkyShards recipe graph
  shardsDb:       {},     // derived: bazaarId → {name, rarity, ...}
  codeToBazaar:   {},     // SkyShards code → bazaarId
  bazaarToCode:   {},     // bazaarId → SkyShards code

  /* Computed */
  lastUpdated: null,      // bazaar lastUpdated (ms)
  fetchedAt:   null,      // when we received bazaar (ms)
  rows:        [],        // enriched shard rows
  loading:     false,
  error:       null,
  allItemsById: null,

  /* Filters & sorting */
  search: "",
  selectedRarities: new Set(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "UNKNOWN"]),
  selectedSkills: new Set(window.ATTRIBUTE_SKILLS || ["Unknown"]),
  sortKey: "profitPerUnit",
  sortDir: "desc",
  fusionOnly: false,
  profitableFusionsOnly: false,

  /* Settings */
  tax:         getNumberFromStorage(CONFIG.TAX_STORAGE, CONFIG.DEFAULT_TAX),
  texturePack: localStorage.getItem(CONFIG.TEXTURE_STORAGE) || CONFIG.DEFAULT_TEXTURE,

  /* Player profile (optional — enriches calculations) */
  player: {
    username:      localStorage.getItem(CONFIG.USERNAME_STORAGE) || "",
    uuid:          null,
    profiles:      [],    // [{profile_id, cute_name, selected, game_mode}]
    selectedId:    localStorage.getItem(CONFIG.PROFILE_ID_STORAGE) || null,
    coinPurse:     null,  // coins available in the selected profile
    huntingLevel:  null,  // current Hunting skill level
    huntingXp:     null,
    extra:         {},    // bank, sbLevel, fairySouls, slayerXp, combatLevel
    ownedAccessories: null,  // Set<string> of owned accessory ids (null = not loaded)
    accessoryAnalysis: null, // {currentMP, maxMP, missing, upgrades}
    attributeStacks: null,   // raw {attrId: shards} from profile
    attributeAnalysis: null, // {rows, totalShardsNeeded, totalCost, ...}
    sweepAnalysis: null,     // profile-aware Sweep ownership/completion map
    craftedMinions: null,    // parsed profile crafted minions
    mutationAnalysis: null,   // derived from profile API mutation/greenhouse fields when available
    equippedArmor: null,
    equippedEquipment: null,
    hotbar: null,
    gardenData: null,
    gardenLoading: false,
    gardenError: null,
    profileInventoryLoading: false,
    inventoryError: null,
    loading:       false,
    error:         null,
  },

  /* Item catalog (accessories + Sweep optimizer) — loaded once from the resources endpoint. */
  accessoryCatalog: null,
  sweepCatalog: null,
  attributeCatalog: null,    // from attribute-desc.json
  lowestBins: null,          // Map<id, price> | null (not loaded)
  binsLoading: false,
  binsProgress: 0,           // 0..1

  /* Accessory sourcing preferences. Prefer-max defaults ON (matches the
   * "max this accessory out" intent); user can turn it off to target the
   * cheaper next tier instead. */
  bazaarMode: localStorage.getItem(CONFIG.BAZAAR_MODE_STORAGE) || "instaBuy",
  preferMax:  localStorage.getItem(CONFIG.PREFER_MAX_STORAGE) !== "0",
  accSortKey: localStorage.getItem(CONFIG.ACC_SORT_STORAGE) || "mp",
  sweepShowCompleted: localStorage.getItem(CONFIG.SWEEP_SHOW_COMPLETED_STORAGE) === "1",
  minionManualTiers: {},
  minionStartFromLvl1: false,
  expandedMinions: {},

  /* SkyBlock Mutations planner/tracker. */
  mutations: {
    search: "",
    selectedId: "ALL_IN_ALOE",
    quantity: 1,
    showUnlockedOnly: false,
    sortKey: "profitPerHour",
    greenhouseTarget: 25,
    manualCycleHours: 4,
  },

  /* Garden Chips planner. Profile API support for consumed chips is not
   * documented, so this page is a live-priced manual target planner. */
  gardenChips: {
    targetRarity: localStorage.getItem(CONFIG.GARDEN_CHIP_RARITY_STORAGE) || "LEGENDARY",
    targetLevel: getNumberFromStorage(CONFIG.GARDEN_CHIP_LEVEL_STORAGE, 20),
    sortKey: localStorage.getItem(CONFIG.GARDEN_CHIP_SORT_STORAGE) || "legendaryCost",
    progress: getJsonFromStorage(CONFIG.GARDEN_CHIP_PROGRESS_STORAGE, {}),
  },

  /* Active page: "home" | "shards" | "missing" | "upgrades" | "attributes" | "sweep" | "minions" | "mutations" | "garden-chips" | "farming" | "profile" | "p2w" */
  view: "home",
  farmingActiveTab: "stats",
  farmingSelectedCropId: null,
  profileSubTab: "overview",

  /* P2W Calculator settings */
  p2w: {
    selectedItemId: "HYPERION",
    selectedItemName: "Hyperion",
    customPrice: null,
    cookieMethod: "instantSell",
    currency: "USD",
    exchangeRate: 1.5,
    searchQuery: "",
    activeTab: "cookies",
    fireSales: null,
    fireSalesLoading: false,
    fireSalesError: null,
    fireSalesFetchedAt: null
  },
};

function getNumberFromStorage(key, fallback) {
  try {
    const v = parseFloat(localStorage.getItem(key));
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function getJsonFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/* =========================================================================
 * 3. CACHE — localStorage with TTL
 * ======================================================================= */
const cache = {
  read(key, ttlMs) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > ttlMs) return null;
      return { ts, data };
    } catch {
      return null;
    }
  },
  write(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      /* quota exceeded — silently ignore. Static datasets are ~2 MB; some
       * browsers' localStorage caps at 5 MB so this can legitimately fail
       * if the user has other state. Not critical — we just refetch. */
    }
  },
  clear(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

/* =========================================================================
 * 4. CLIENTS
 * ======================================================================= */
async function apiFetch(path, { useCache = true, cacheKey = null, cacheTtl = 60_000 } = {}) {
  if (useCache && cacheKey) {
    const cached = cache.read(cacheKey, cacheTtl);
    if (cached) return { data: cached.data, cached: true, cachedAt: cached.ts };
  }

  const headers = {};
  const apiKey = localStorage.getItem(CONFIG.API_KEY_STORAGE);
  if (apiKey) headers["API-Key"] = apiKey;

  const url = CONFIG.API_BASE + path;
  let resp;
  try {
    resp = await fetch(url, { headers });
  } catch (e) {
    throw new Error(`Network error: ${e.message}. Check your connection.`);
  }

  if (!resp.ok) {
    let detail = "";
    try {
      const body = await resp.json();
      detail = body?.cause || "";
    } catch { /* not JSON */ }

    switch (resp.status) {
      case 403: throw new Error(`API rejected the request (403). ${detail || "Your API key may be invalid."}`);
      case 422: throw new Error(`Malformed request (422). ${detail}`);
      case 429: throw new Error(`Rate limited (429). Slow down — wait a minute and retry.`);
      case 503: throw new Error(`Hypixel API is warming up (503). Try again in a few seconds.`);
      default:  throw new Error(`API error ${resp.status}: ${detail || resp.statusText}`);
    }
  }

  const data = await resp.json();
  if (data && data.success === false) {
    throw new Error(`Hypixel returned an error: ${data.cause || "unknown"}`);
  }

  if (useCache && cacheKey) cache.write(cacheKey, data);
  return { data, cached: false, cachedAt: Date.now() };
}

/* Fetch one of our bundled static JSON files. Same TTL caching as the API. */
async function staticFetch(url, { cacheKey, cacheTtl }) {
  const cached = cache.read(cacheKey, cacheTtl);
  if (cached) return { data: cached.data, cached: true, cachedAt: cached.ts };

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);
  const data = await resp.json();
  cache.write(cacheKey, data);
  return { data, cached: false, cachedAt: Date.now() };
}

const api = {
  fetchBazaar: () => apiFetch(CONFIG.BAZAAR_ENDPOINT, {
    cacheKey: CONFIG.CACHE_KEY_BAZAAR,
    cacheTtl: CONFIG.CACHE_TTL_BAZAAR_MS,
  }),
  fetchFusionProps: () => staticFetch(CONFIG.FUSION_PROPS_URL, {
    cacheKey: CONFIG.CACHE_KEY_FUSION_PROPS,
    cacheTtl: CONFIG.CACHE_TTL_STATIC_MS,
  }),
  fetchFusionData: () => staticFetch(CONFIG.FUSION_DATA_URL, {
    cacheKey: CONFIG.CACHE_KEY_FUSION_DATA,
    cacheTtl: CONFIG.CACHE_TTL_STATIC_MS,
  }),

  /* Resolve a Minecraft username → UUID via ashcon (CORS-friendly Mojang proxy). */
  async resolveUsername(username) {
    const url = CONFIG.USERNAME_LOOKUP_URL + encodeURIComponent(username);
    let resp;
    try {
      resp = await fetch(url);
    } catch (e) {
      throw new Error(`Network error resolving username: ${e.message}`);
    }
    if (resp.status === 404) throw new Error(`User "${username}" not found.`);
    if (!resp.ok)            throw new Error(`Username lookup failed (${resp.status}).`);
    const data = await resp.json();
    return { uuid: data.uuid.replace(/-/g, ""), username: data.username };
  },

  /* Fetch SkyBlock profiles for a UUID. Requires an API key. */
  fetchProfiles(uuid) {
    return apiFetch(`${CONFIG.PROFILES_ENDPOINT}?uuid=${uuid}`, {
      cacheKey: CONFIG.CACHE_KEY_PROFILE_PREFIX + uuid,
      cacheTtl: CONFIG.CACHE_TTL_PROFILE_MS,
    });
  },

  /* Fetch standalone Garden data for a SkyBlock profile UUID. */
  fetchGarden(profileId) {
    return apiFetch(`${CONFIG.GARDEN_ENDPOINT}?profile=${profileId}`, {
      cacheKey: CONFIG.CACHE_KEY_GARDEN_PREFIX + profileId,
      cacheTtl: CONFIG.CACHE_TTL_PROFILE_MS,
    });
  },

  /* Fetch the full SkyBlock item catalog (public, no key). Cached 1 day. */
  fetchItems() {
    return apiFetch(CONFIG.ITEMS_ENDPOINT, {
      cacheKey: CONFIG.CACHE_KEY_ITEMS,
      cacheTtl: CONFIG.CACHE_TTL_STATIC_MS,
    });
  },

  /* Bundled attribute metadata (attribute-id → rarity/title/desc). */
  fetchAttrDesc: () => staticFetch(CONFIG.ATTR_DESC_URL, {
    cacheKey: CONFIG.CACHE_KEY_ATTR_DESC,
    cacheTtl: CONFIG.CACHE_TTL_STATIC_MS,
  }),
};

/* =========================================================================
 * 4b. PLAYER PROFILE
 *
 * Skill XP → level conversion uses the standard SkyBlock skill curve from
 * the wiki. We only need Hunting for shard syphoning eligibility, but the
 * table is included so we can extend to other skills cheaply later.
 *
 * Cumulative XP required to reach each level (index = level).
 * Source: https://wiki.hypixel.net/Skills (regular skills, 0 → 60)
 * ======================================================================= */
const SKILL_XP_TABLE = [
  0, 50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925, 14925, 22425, 32425,
  47425, 67425, 97425, 147425, 222425, 322425, 522425, 822425, 1222425, 1722425,
  2322425, 3022425, 3822425, 4722425, 5722425, 6822425, 8022425, 9322425,
  10722425, 12222425, 13822425, 15522425, 17322425, 19222425, 21222425, 23322425,
  25522425, 27822425, 30222425, 32722425, 35322425, 38072425, 40972425, 44072425,
  47472425, 51172425, 55172425, 59472425, 64072425, 68972425, 74172425, 79672425,
  85472425, 91572425, 97972425, 104672425, 111672425,
];

function xpToLevel(xp) {
  if (xp == null || !Number.isFinite(xp) || xp <= 0) return 0;
  for (let i = SKILL_XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= SKILL_XP_TABLE[i]) return i;
  }
  return 0;
}

/* Pull out the bits of a SkyBlock profile we care about for shard work. */
function extractProfileStats(profile, uuid) {
  const member = profile?.members?.[uuid];
  if (!member) return { coinPurse: null, huntingLevel: null, huntingXp: null, attributeStacks: null, extra: {} };

  const coinPurse  = member.currencies?.coin_purse ?? null;
  const exp = member.player_data?.experience || {};
  const huntingXp  = exp.SKILL_HUNTING ?? null;
  const huntingLevel = huntingXp != null ? xpToLevel(huntingXp) : null;
  const attributeStacks = member.attributes?.stacks ?? null;

  /* Extra account stats for the player panel. */
  const bank = profile?.banking?.balance ?? null;
  const sbXp = member.leveling?.experience ?? null;
  const sbLevel = sbXp != null ? Math.floor(sbXp / 100) : null;   // SB level = XP/100
  const fairySouls = member.fairy_soul?.total_collected ?? null;

  /* Total slayer XP across all bosses. */
  let slayerXp = 0;
  const bosses = member.slayer?.slayer_bosses || {};
  for (const b of Object.values(bosses)) slayerXp += b?.xp || 0;

  /* Combat skill level (handy alongside Hunting for shard grinding). */
  const combatXp = exp.SKILL_COMBAT ?? null;
  const combatLevel = combatXp != null ? xpToLevel(combatXp) : null;

  return {
    coinPurse, huntingLevel, huntingXp, attributeStacks,
    extra: { bank, sbLevel, fairySouls, slayerXp, combatLevel },
  };
}

/* Load (and cache) the player's profiles. Errors set state.player.error. */
async function loadPlayerProfiles(username) {
  state.player.loading = true;
  state.player.error = null;
  renderPlayerPanel();

  try {
    // API key check is bypassed since the secure Cloudflare proxy handles key injection!
    const { uuid, username: canonical } = await api.resolveUsername(username);
    state.player.uuid = uuid;
    state.player.username = canonical;
    localStorage.setItem(CONFIG.USERNAME_STORAGE, canonical);

    const { data } = await api.fetchProfiles(uuid);
    const profiles = (data.profiles || []).map((p) => ({
      profile_id: p.profile_id,
      cute_name:  p.cute_name,
      selected:   !!p.selected,
      game_mode:  p.game_mode || null,
      _raw:       p,
    }));
    if (!profiles.length) throw new Error(`${canonical} has no SkyBlock profiles.`);

    state.player.profiles = profiles;

    /* Pick the previously-saved profile if still present, else the game's "selected" one. */
    const savedId = localStorage.getItem(CONFIG.PROFILE_ID_STORAGE);
    const pick =
      profiles.find((p) => p.profile_id === savedId)
      || profiles.find((p) => p.selected)
      || profiles[0];

    selectProfile(pick.profile_id);
  } catch (e) {
    state.player.error = e.message;
    state.player.profiles = [];
    state.player.selectedId = null;
    state.player.coinPurse = state.player.huntingLevel = state.player.huntingXp = null;
    console.error("[Hypixie] player load failed:", e);
  } finally {
    state.player.loading = false;
    renderPlayerPanel();
    rebuildRows();   // re-evaluate Hunting-gated fusion eligibility
    renderTable();
    renderBestFusionsPanel();
    renderActiveView();
  }
}

/* Extract all owned accessory ids from a profile member by decoding the
 * talisman bag (and inventory / ender chest as a fallback for accessories
 * carried outside the bag). Returns a Map<id, {recombobulated}>. */
async function extractOwnedAccessories(member, catalog) {
  const owned = new Map();
  if (!member?.inventory) return owned;

  const slices = [
    member.inventory.bag_contents?.talisman_bag,
    member.inventory.inv_contents,
    member.inventory.ender_chest_contents,
  ];

  for (const slice of slices) {
    if (!slice?.data) continue;
    try {
      const items = await decodeInventory(slice.data);
      for (const it of items) {
        /* Only keep ids the catalog knows. Merge recomb status — if any copy
         * is recombobulated, treat the accessory as recombobulated. */
        if (catalog.byId[it.skyblockId]) {
          const prev = owned.get(it.skyblockId);
          owned.set(it.skyblockId, {
            recombobulated: (prev?.recombobulated || it.recombobulated) === true,
          });
        }
      }
    } catch (e) {
      console.warn("[Hypixie] inventory decode failed for a slice:", e.message);
    }
  }
  return owned;
}

function sweepInventorySlices(member) {
  const inv = member?.inventory || {};
  const bag = inv.bag_contents || {};
  return [
    inv.inv_contents,
    inv.ender_chest_contents,
    inv.equipment_contents,
    inv.inv_armor,
    inv.wardrobe_contents,
    inv.personal_vault_contents,
    ...Object.values(inv.backpack_contents || {}),
    ...Object.values(bag || {}),
  ].filter((slice) => slice?.data);
}

async function extractSweepProfileItems(member) {
  const items = [];
  const ids = new Set();
  for (const slice of sweepInventorySlices(member)) {
    try {
      for (const it of await decodeInventory(slice.data)) {
        items.push(it);
        ids.add(it.skyblockId);
      }
    } catch (e) {
      console.warn("[Hypixie] Sweep inventory decode failed for a slice:", e.message);
    }
  }
  return { items, ids };
}

const SWEEP_ATTR_BY_SOURCE_ID = {
  "crow-attribute": "fig_sharpening",
  "heron-attribute": "mangrove_sharpening",
  "phanpyre-attribute": "nocturnal_animal",
  "bambuleaf-attribute": "strong_arms",
  "mochibear-attribute": "strong_legs",
  "tadgang-attribute": "unity_is_strength",
};

const SWEEP_ARMOR_IDS = new Set(["CANOPY_HELMET", "CANOPY_CHESTPLATE", "CANOPY_LEGGINGS", "CANOPY_BOOTS", "FIG_HELMET", "FIG_CHESTPLATE", "FIG_LEGGINGS", "FIG_BOOTS"]);
const SWEEP_EQUIPMENT_IDS = new Set(["DAVIDS_CLOAK", "MANGROVE_GRIPPERS", "MANGROVE_LOCKET", "MANGROVE_VINE"]);
const SWEEP_AXE_ID_RE = /(AXE|TREECAPITATOR)/i;

/* Mutually-exclusive gear progressions for profile-aware Sweep suggestions.
 * If the player already owns a higher completed tier in the same slot, lower
 * alternatives should not be recommended as separate next purchases. */
const SWEEP_GEAR_PROGRESSIONS = [
  ["canopy-armor", "fig-armor"],
  ["spruce-axe", "seriously-damaged-axe", "decent-axe", "treecapitator", "fig-hew", "figstone-splitter"],
];

function hasSweepBooster(it) {
  return (it?.rawTag?.ExtraAttributes?.boosters || []).includes("sweep");
}
function firstImpressionLevel(it) {
  return Number(it?.rawTag?.ExtraAttributes?.enchantments?.ultimate_first_impression || 0);
}
function countWithSweepBooster(items, predicate) {
  return items.filter((it) => predicate(it.skyblockId) && hasSweepBooster(it)).length;
}
function countUniqueWithSweepBooster(items, predicate) {
  const ids = new Set();
  for (const it of items) if (predicate(it.skyblockId) && hasSweepBooster(it)) ids.add(it.skyblockId);
  return ids.size;
}
function countOwnedUnique(ids, wanted) {
  return wanted.filter((id) => ids.has(id)).length;
}
function sweepSourceFullyOwned(src, ids) {
  if (!src?.itemIds?.length) return false;
  if (src.costKind === "auction-bundle") return countOwnedUnique(ids, src.itemIds) >= src.itemIds.length;
  if (src.costKind === "auction") return src.itemIds.some((id) => ids.has(id));
  return false;
}
function higherOwnedSweepGear(src, ctx) {
  const chain = SWEEP_GEAR_PROGRESSIONS.find((ids) => ids.includes(src.id));
  if (!chain) return null;
  const idx = chain.indexOf(src.id);
  for (let i = chain.length - 1; i > idx; i--) {
    const higher = ctx.sourcesById?.[chain[i]] || (window.SWEEP_SOURCES || []).find((s) => s.id === chain[i]);
    if (higher && sweepSourceFullyOwned(higher, ctx.ids)) return higher;
  }
  return null;
}
function sweepDone(done, reason, current = null, max = null) {
  return { completed: !!done, reason, current, max };
}
function sweepPartial(reason, current = null, max = null) {
  return { completed: false, partial: true, reason, current, max };
}

function sweepSourceCompletion(src, ctx) {
  const { ids, items, member } = ctx;
  const foraging = member?.foraging || {};
  const treeGifts = foraging.tree_gifts || {};
  const personalBests = foraging.starlyn?.personal_bests || {};
  const taskProgress = foraging.hina?.tasks?.task_progress || {};
  const nodes = member?.skill_tree?.nodes?.foraging || {};
  const stacks = member?.attributes?.stacks || {};

  const higherGear = higherOwnedSweepGear(src, ctx);
  if (higherGear) {
    return sweepDone(true, `Covered by higher-tier ${higherGear.name} found in this profile.`);
  }

  if (src.id === "jade-dragon-pet") {
    const has = (member?.pets_data?.pets || []).some((p) => p.type === "JADE_DRAGON");
    return sweepDone(has, has ? "Jade Dragon pet found in profile pets." : "Not found in profile pets.");
  }
  if (src.id === "monkey-pet") {
    const has = (member?.pets_data?.pets || []).some((p) => p.type === "MONKEY");
    return sweepDone(has, has ? "Monkey pet found in profile pets." : "Not found in profile pets.");
  }
  if (src.costKind === "auction-bundle" && src.itemIds?.length) {
    const have = countOwnedUnique(ids, src.itemIds);
    if (have >= src.itemIds.length) return sweepDone(true, `All ${src.itemIds.length}/${src.itemIds.length} pieces found.`, have, src.itemIds.length);
    if (have > 0) return sweepPartial(`${have}/${src.itemIds.length} pieces found; still missing pieces.`, have, src.itemIds.length);
    return sweepDone(false, "No pieces found in decoded inventory.", 0, src.itemIds.length);
  }
  if (src.costKind === "auction" && src.itemIds?.length) {
    const has = src.itemIds.some((id) => ids.has(id));
    return sweepDone(has, has ? "Item found in decoded inventory." : "Item not found in decoded inventory.");
  }
  if (src.id === "first-impression-v") {
    const max = Math.max(0, ...items.map(firstImpressionLevel));
    return max >= 5 ? sweepDone(true, "First Impression V found on a decoded item.", max, 5) : (max > 0 ? sweepPartial(`First Impression ${max} found; level V still recommended.`, max, 5) : sweepDone(false, "First Impression V not found on decoded items.", 0, 5));
  }
  if (src.id === "sweep-booster-axe") {
    const boosted = countWithSweepBooster(items, (id) => SWEEP_AXE_ID_RE.test(id));
    return boosted > 0 ? sweepDone(true, "Sweep booster already found on an axe.", boosted, 1) : sweepDone(false, "No Sweep-boosted axe found.", 0, 1);
  }
  if (src.id === "sweep-booster-armor") {
    const boosted = countUniqueWithSweepBooster(items, (id) => SWEEP_ARMOR_IDS.has(id));
    if (boosted >= 4) return sweepDone(true, "At least 4 armor pieces already have Sweep booster.", boosted, 4);
    if (boosted > 0) return sweepPartial(`${boosted}/4 armor Sweep boosters found.`, boosted, 4);
    return sweepDone(false, "No Sweep-boosted armor pieces found.", 0, 4);
  }
  if (src.id === "sweep-booster-equipment") {
    const boosted = countUniqueWithSweepBooster(items, (id) => SWEEP_EQUIPMENT_IDS.has(id));
    if (boosted >= 4) return sweepDone(true, "All 4 equipment slots already have Sweep booster.", boosted, 4);
    if (boosted > 0) return sweepPartial(`${boosted}/4 equipment Sweep boosters found.`, boosted, 4);
    return sweepDone(false, "No Sweep-boosted equipment found.", 0, 4);
  }
  const attrId = SWEEP_ATTR_BY_SOURCE_ID[src.id];
  if (attrId) {
    const current = Number(stacks[attrId] || 0);
    const max = 512;
    if (current >= max) return sweepDone(true, `${attrId.replaceAll("_", " ")} is already Tier X/maxed.`, current, max);
    if (current > 0) return sweepPartial(`${current}/${max} shard stacks invested in ${attrId.replaceAll("_", " ")}.`, current, max);
    return sweepDone(false, `${attrId.replaceAll("_", " ")} not started.`, 0, max);
  }
  if (src.id === "fig-tree-gifts") {
    const current = Number(treeGifts.FIG || taskProgress.FIG_GIFTS || 0);
    return current >= 1000 ? sweepDone(true, "Fig Tree Gift milestones appear complete.", current, 1000) : (current > 0 ? sweepPartial(`${fmtInt(current)} Fig gifts tracked; more milestones may remain.`, current, 1000) : sweepDone(false, "No Fig Tree Gift progress found.", 0, 1000));
  }
  if (src.id === "mangrove-tree-gifts") {
    const current = Number(treeGifts.MANGROVE || taskProgress.MANGROVE_GIFTS || 0);
    return current >= 1000 ? sweepDone(true, "Mangrove Tree Gift milestones appear complete.", current, 1000) : (current > 0 ? sweepPartial(`${fmtInt(current)} Mangrove gifts tracked; more milestones may remain.`, current, 1000) : sweepDone(false, "No Mangrove Tree Gift progress found.", 0, 1000));
  }
  if (src.id === "fig-personal-best") {
    const current = Number(personalBests.FIG_LOG || 0);
    return current >= 100000 ? sweepDone(true, "Fig personal best is at the 100k cap.", current, 100000) : (current > 0 ? sweepPartial(`${fmtInt(current)}/100k Fig personal best.`, current, 100000) : sweepDone(false, "No Fig personal best found.", 0, 100000));
  }
  if (src.id === "mangrove-personal-best") {
    const current = Number(personalBests.MANGROVE_LOG || 0);
    return current >= 100000 ? sweepDone(true, "Mangrove personal best is at the 100k cap.", current, 100000) : (current > 0 ? sweepPartial(`${fmtInt(current)}/100k Mangrove personal best.`, current, 100000) : sweepDone(false, "No Mangrove personal best found.", 0, 100000));
  }
  if (src.id === "hotf-sweep") {
    const current = Number(nodes.sweep || 0);
    return current >= 50 ? sweepDone(true, "Heart of the Forest Sweep perk is maxed.", current, 50) : (current > 0 ? sweepPartial(`HOTF Sweep perk is ${current}/50.`, current, 50) : sweepDone(false, "HOTF Sweep perk not found.", 0, 50));
  }
  return null;
}

async function loadSweepAnalysis(rawProfile) {
  try {
    const member = rawProfile?.members?.[state.player.uuid];
    if (!member || !Array.isArray(window.SWEEP_SOURCES)) {
      state.player.sweepAnalysis = null;
      return;
    }
    const { items, ids } = await extractSweepProfileItems(member);
    const sourcesById = Object.fromEntries(window.SWEEP_SOURCES.map((src) => [src.id, src]));
    const bySource = {};
    for (const src of window.SWEEP_SOURCES) {
      const completion = sweepSourceCompletion(src, { member, items, ids, sourcesById });
      if (completion) bySource[src.id] = completion;
    }
    state.player.sweepAnalysis = { bySource, itemCount: items.length };
  } catch (e) {
    console.error("[Hypixie] Sweep analysis failed:", e);
    state.player.sweepAnalysis = { bySource: {}, itemCount: 0, error: e.message };
  } finally {
    if (state.view === "sweep" || state.view === "profile") renderActiveView();
  }
}

function selectProfile(profileId) {
  const prof = state.player.profiles.find((p) => p.profile_id === profileId);
  if (!prof) return;
  state.player.selectedId = profileId;
  localStorage.setItem(CONFIG.PROFILE_ID_STORAGE, profileId);

  const stats = extractProfileStats(prof._raw, state.player.uuid);
  state.player.coinPurse    = stats.coinPurse;
  state.player.huntingLevel = stats.huntingLevel;
  state.player.huntingXp    = stats.huntingXp;
  state.player.attributeStacks = stats.attributeStacks;
  state.player.extra        = stats.extra || {};

  const craftedList = prof._raw?.members?.[state.player.uuid]?.player_data?.crafted_generators || [];
  state.player.craftedMinions = typeof parseCraftedMinions !== "undefined" ? parseCraftedMinions(craftedList) : {};

  /* Accessory analysis runs async (NBT decode). Reset, then fill in. */
  state.player.ownedAccessories  = null;
  state.player.accessoryAnalysis = null;
  state.player.attributeAnalysis = null;
  state.player.sweepAnalysis = null;
  state.player.mutationAnalysis = analyseProfileMutations(prof._raw, state.player.uuid);
  state.player.equippedArmor = null;
  state.player.equippedEquipment = null;
  state.player.hotbar = null;
  state.player.gardenData = null;
  state.player.gardenError = null;
  state.player.gardenLoading = false;
  loadAccessoryAnalysis(prof._raw);
  loadAttributeAnalysis();
  loadSweepAnalysis(prof._raw);
  loadProfileInventory(prof._raw);
  loadGardenData(profileId);
  rebuildRows();
  if (state.view === "mutations") renderActiveView();
}

/* Decode inventories + analyse accessories for the selected profile. */
async function loadAccessoryAnalysis(rawProfile) {
  try {
    if (!state.accessoryCatalog) {
      const { data } = await api.fetchItems();
      state.accessoryCatalog = buildAccessoryCatalog(data);
    }
    const member = rawProfile?.members?.[state.player.uuid];
    const owned = await extractOwnedAccessories(member, state.accessoryCatalog);
    state.player.ownedAccessories  = owned;
    state.player.accessoryAnalysis = analyseAccessories(state.accessoryCatalog, owned, { preferMax: state.preferMax });
  } catch (e) {
    console.error("[Hypixie] accessory analysis failed:", e);
    state.player.ownedAccessories  = new Set();
    state.player.accessoryAnalysis = { currentMP: 0, maxMP: 0, missing: [], upgrades: [], error: e.message };
  } finally {
    renderPlayerPanel();
    if (state.view === "missing" || state.view === "upgrades" || state.view === "profile") renderActiveView();
  }
}

/* Fetch standalone Garden API data for richer visitor tracking. */
async function loadGardenData(profileId) {
  const requestedProfileId = profileId || state.player.selectedId;
  if (!requestedProfileId) return;
  state.player.gardenLoading = true;
  state.player.gardenError = null;

  try {
    const { data } = await api.fetchGarden(requestedProfileId);
    if (state.player.selectedId !== requestedProfileId) return;
    state.player.gardenData = data?.garden || data;
  } catch (e) {
    if (state.player.selectedId !== requestedProfileId) return;
    state.player.gardenData = null;
    state.player.gardenError = e.message || String(e);
    console.error("[Hypixie] garden load failed:", e);
  } finally {
    if (state.player.selectedId === requestedProfileId) {
      state.player.gardenLoading = false;
      if (state.view === "farming") renderActiveView();
    }
  }
}

/* Decode armor, equipment, and hotbar for the Profile Viewer. */
async function loadProfileInventory(rawProfile) {
  state.player.profileInventoryLoading = true;
  state.player.equippedArmor = null;
  state.player.equippedEquipment = null;
  state.player.hotbar = null;
  state.player.inventoryError = null;

  try {
    const member = rawProfile?.members?.[state.player.uuid];
    if (!member?.inventory) {
      state.player.inventoryError = "Inventory API is disabled in Hypixel settings.";
      return;
    }

    // Decode armor
    if (member.inventory.inv_armor?.data) {
      const armor = await decodeInventory(member.inventory.inv_armor.data);
      // In Minecraft: slot 0 = boots, slot 1 = leggings, slot 2 = chestplate, slot 3 = helmet.
      // We keep slot indices but we can also store the array.
      state.player.equippedArmor = armor;
    }

    // Decode equipment
    if (member.inventory.equipment_contents?.data) {
      state.player.equippedEquipment = await decodeInventory(member.inventory.equipment_contents.data);
    }

    // Decode hotbar (first 9 slots of inv_contents)
    if (member.inventory.inv_contents?.data) {
      const inv = await decodeInventory(member.inventory.inv_contents.data);
      state.player.hotbar = inv.filter((it) => it.slotIndex < 9);
    }
  } catch (e) {
    console.error("[Hypixie] profile inventory decode failed:", e);
    state.player.inventoryError = "Failed to decode inventory NBT data.";
  } finally {
    state.player.profileInventoryLoading = false;
    if (state.view === "profile") renderActiveView();
  }
}

/* Build the attribute-maxing analysis for the selected profile. */
async function loadAttributeAnalysis() {
  try {
    if (!state.attributeCatalog) {
      const { data } = await api.fetchAttrDesc();
      state.attributeCatalog = buildAttributeCatalog(data);
    }
    /* Missing attributes do not appear in profile attributes.stacks at all.
     * Treat a missing stacks object as an empty map so the report can still
     * show every usable attribute as 0/max instead of rendering an empty page. */
    const stacks = state.player.attributeStacks || {};

    /* Price each attribute's source shard via the live bazaar.
     * The shard granting attribute `code` is fusion-props[code].name → SHARD_<NAME>.
     * Respects the user's bazaar-price preference (insta-buy vs buy-order). */
    const shardPriceFor = (code) => {
      const propName = state.fusionProps?.[code]?.name;
      if (!propName) return null;
      const bazaarId = state.codeToBazaar?.[code]
        || ("SHARD_" + propName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""));
      const qs = state.raw?.products?.[bazaarId]?.quick_status;
      if (!qs) return null;
      return state.bazaarMode === "buyOrder"
        ? (qs.sellPrice || qs.buyPrice || null)   // place a buy order (cheaper)
        : (qs.buyPrice || qs.sellPrice || null);  // insta-buy
    };

    state.player.attributeAnalysis = analyseAttributes(state.attributeCatalog, stacks, shardPriceFor, {
      onlyUsable: true,
      requirementForCode: huntingRequirementForCode,
      canUseCode: (code, requiredLevel) => playerCanUseFusion(requiredLevel),
    });
  } catch (e) {
    console.error("[Hypixie] attribute analysis failed:", e);
    state.player.attributeAnalysis = { rows: [], totalShardsNeeded: 0, totalCost: 0, maxedCount: 0, totalCount: 0, error: e.message };
  } finally {
    renderPlayerPanel();
    if (state.view === "attributes") renderActiveView();
  }
}

function clearPlayer() {
  state.player = {
    username: "", uuid: null, profiles: [], selectedId: null,
    coinPurse: null, huntingLevel: null, huntingXp: null, extra: {},
    ownedAccessories: null, accessoryAnalysis: null,
    attributeStacks: null, attributeAnalysis: null, sweepAnalysis: null,
    craftedMinions: null, mutationAnalysis: null,
    equippedArmor: null, equippedEquipment: null, hotbar: null,
    gardenData: null, gardenLoading: false, gardenError: null,
    profileInventoryLoading: false, inventoryError: null,
    loading: false, error: null,
  };
  localStorage.removeItem(CONFIG.USERNAME_STORAGE);
  localStorage.removeItem(CONFIG.PROFILE_ID_STORAGE);
  rebuildRows();
  renderPlayerPanel();
  renderTable();
  renderBestFusionsPanel();
  if (state.view !== "shards") renderActiveView();
}

/* =========================================================================
 * 5. PROFITABILITY MATH — bazaar flipping
 *
 *   Terminology (matches the in-game Bazaar):
 *     buyPrice  — what you PAY to insta-buy  (lowest sell-offer band)
 *     sellPrice — what you RECEIVE from insta-sell (highest buy-order band)
 *
 *   Realistic flip uses ORDERS rather than instant transactions:
 *     1) BUY ORDER at ≈ sellPrice + ε  → fills at ≈ sellPrice
 *     2) SELL OFFER at ≈ buyPrice − ε  → receives buyPrice × (1 − tax)
 *        (sell-offer payouts are taxed; buy-order spending is not)
 *
 *   profitPerUnit = buyPrice × (1 − tax) − sellPrice
 *   marginPercent = profitPerUnit / sellPrice × 100
 * ======================================================================= */
function computeMetrics(qs, tax) {
  const buyPrice  = qs?.buyPrice  ?? 0;
  const sellPrice = qs?.sellPrice ?? 0;

  const spread        = buyPrice - sellPrice;
  const profitPerUnit = buyPrice * (1 - tax) - sellPrice;
  const marginPercent = sellPrice > 0 ? (profitPerUnit / sellPrice) * 100 : 0;

  const sellWeek  = qs?.sellMovingWeek ?? 0;
  const buyWeek   = qs?.buyMovingWeek  ?? 0;
  const weeklyVolume = sellWeek + buyWeek;

  return {
    buyPrice,
    sellPrice,
    spread,
    profitPerUnit,
    marginPercent,
    weeklyVolume,
    sellWeek,
    buyWeek,
    sellOrders: qs?.sellOrders ?? 0,
    buyOrders:  qs?.buyOrders  ?? 0,
  };
}

/* Project profit over realistic weekly throughput.
 * Capped at half the weaker market side — you can't move more units than
 * the market absorbs without driving the price. */
function projectedWeeklyProfit(m) {
  const throughput = Math.min(m.sellWeek, m.buyWeek) * 0.5;
  return m.profitPerUnit * throughput;
}

/* Hunting skill gates shard fusion. Before a player links their account we
 * keep every recipe visible; once linked, craft-flip rankings only count
 * recipes they can actually run at their current Hunting level. */
const FUSION_HUNTING_REQUIREMENT_BY_RARITY = {
  COMMON: 0,
  UNCOMMON: 10,
  RARE: 20,
  EPIC: 30,
  LEGENDARY: 40,
  UNKNOWN: 0,
};

function huntingRequirementForCode(code) {
  if (!code) return 0;
  const rarity = RARITY_FROM_CODE[code[0]] || "UNKNOWN";
  return FUSION_HUNTING_REQUIREMENT_BY_RARITY[rarity] ?? 0;
}

function playerCanUseFusion(reqLevel) {
  const level = state.player?.huntingLevel;
  return level == null || level >= reqLevel;
}

/* =========================================================================
 * 6. FUSION MATH — craft-vs-buy economics
 *
 * Fusion recipes from SkyShards have shape:
 *
 *   recipes[targetCode] = {
 *     <outputQty>: [ [inputCodeA, inputCodeB], ... ],
 *     ...
 *   }
 *
 *   Each pair [A, B] in the fusion machine produces `outputQty` of target.
 *
 * Cost basis per input:  buyPrice  (insta-buy from sell offers — visible /bz cost)
 *
 * Cost per output unit = (price(A) × fuseAmount(A) + price(B) × fuseAmount(B)) / outputQty
 *
 * Best recipe = the pair across all output-qty buckets that minimises cost
 * per output unit. We then compare to the target's market value to derive
 * fusion profit / unit.
 * ======================================================================= */
function priceOfInput(bazaarId) {
  if (!bazaarId || !state.raw?.products) return null;
  const prod = state.raw.products[bazaarId];
  if (!prod) return null;
  /* Use buyPrice (insta-buy from sell offers) for fusion inputs because this
   * matches the visible in-game /bz cost. Thin markets can have tiny sellPrice
   * values from stale buy orders (e.g. Heron), which made recipes look fake-cheap. */
  const bp = prod.quick_status?.buyPrice;
  if (bp && bp > 0) return bp;
  return prod.quick_status?.sellPrice || null;
}

function fusionInputQty(code) {
  const n = Number(state.fusionRecipes?.shards?.[code]?.fuse_amount);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/* Compute the cheapest fusion route for a single target shard.
 * Returns null when the shard has no recipes or no priceable inputs. */
function computeBestFusion(targetBazaarId) {
  const code = state.bazaarToCode[targetBazaarId];
  if (!code || !state.fusionRecipes) return null;

  const recipeBucket = state.fusionRecipes.recipes?.[code];
  if (!recipeBucket) return null;

  let best = null;

  for (const [qtyStr, pairs] of Object.entries(recipeBucket)) {
    const qty = parseInt(qtyStr, 10);
    if (!qty) continue;

    for (const [aCode, bCode] of pairs) {
      const aId = state.codeToBazaar[aCode];
      const bId = state.codeToBazaar[bCode];
      const aPrice = priceOfInput(aId);
      const bPrice = priceOfInput(bId);
      if (aPrice == null || bPrice == null) continue;

      const requiredHuntingLevel = Math.max(
        huntingRequirementForCode(code),
        huntingRequirementForCode(aCode),
        huntingRequirementForCode(bCode)
      );
      const huntingLocked = !playerCanUseFusion(requiredHuntingLevel);

      /* SkyShards recipes list the two shard types, but each input slot consumes
       * that shard's own `fuse_amount` (e.g. 5 common, 2 uncommon, etc.).
       * Counting only one of each input makes fusion flips look wildly profitable
       * while being impossible to execute at the displayed cost. */
      const aQty = fusionInputQty(aCode);
      const bQty = fusionInputQty(bCode);
      const pairCost = aPrice * aQty + bPrice * bQty;
      const costPerOutput = pairCost / qty;

      if (!best || costPerOutput < best.costPerOutput) {
        best = {
          inputs: [
            { code: aCode, bazaarId: aId, name: state.shardsDb[aId]?.name || aId, price: aPrice, qty: aQty, total: aPrice * aQty },
            { code: bCode, bazaarId: bId, name: state.shardsDb[bId]?.name || bId, price: bPrice, qty: bQty, total: bPrice * bQty },
          ],
          outputQty: qty,
          pairCost,
          costPerOutput,
          requiredHuntingLevel,
          huntingLocked,
        };
      }
    }
  }

  return best;
}

/* =========================================================================
 * 7. PIPELINE — turn bazaar response into table rows
 * ======================================================================= */
function isShardProduct(id) {
  /* Live API uses SHARD_* exclusively, but we keep the secondary prefix
   * to future-proof against Hypixel renaming the schema. */
  return id.startsWith("SHARD_") || id.startsWith("ATTRIBUTE_SHARD");
}

function getShardMeta(id) {
  const known = state.shardsDb[id];
  if (known) return { ...known, known: true };
  return {
    name:      prettifyShardId(id),
    attribute: "—",
    rarity:    "UNKNOWN",
    family:    "—",
    category:  "—",
    attributeSkill: "Unknown",
    code:      null,
    known:     false,
  };
}

/* Build enriched rows from the raw bazaar payload. */
function rebuildRows() {
  if (state.raw) state.rows = buildRows(state.raw);
}

function buildRows(bazaarPayload) {
  if (!bazaarPayload?.products) return [];
  const tax = state.tax;

  const rows = [];
  for (const [id, product] of Object.entries(bazaarPayload.products)) {
    if (!isShardProduct(id)) continue;

    const meta    = getShardMeta(id);
    const metrics = computeMetrics(product.quick_status, tax);

    /* Filter dead markets. */
    if (metrics.weeklyVolume < CONFIG.MIN_WEEKLY_VOLUME) continue;

    /* Fusion economics. */
    const bestFusion = computeBestFusion(id);
    let fusionProfitPerUnit = null;
    let fusionMarginPercent = null;
    if (bestFusion) {
      if (bestFusion.huntingLocked) {
        fusionProfitPerUnit = null;
        fusionMarginPercent = null;
      } else {
        fusionProfitPerUnit = metrics.buyPrice * (1 - tax) - bestFusion.costPerOutput;
        fusionMarginPercent = bestFusion.costPerOutput > 0
          ? (fusionProfitPerUnit / bestFusion.costPerOutput) * 100
          : 0;
      }
    }

    /* Investment to syphon to max level using visible insta-buy shard cost. */
    const maxShards = SHARDS_MAX_LEVEL_BY_RARITY[meta.rarity];
    const maxLevelCost = maxShards ? maxShards * metrics.buyPrice : null;

    rows.push({
      id,
      rank: rows.length + 1,
      ...meta,
      ...metrics,
      weeklyExpectedProfit: projectedWeeklyProfit(metrics),
      bestFusion,
      fusionProfitPerUnit,
      fusionMarginPercent,
      hasFusion: !!bestFusion,
      maxLevelCost,
    });
  }
  return rows;
}

function applyFilters(rows) {
  const q = state.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (!state.selectedRarities.has(r.rarity)) return false;
    if (!state.selectedSkills.has(r.attributeSkill || "Unknown")) return false;
    if (state.fusionOnly && !r.hasFusion) return false;
    if (state.profitableFusionsOnly && !(r.fusionProfitPerUnit > 0)) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.attribute.toLowerCase().includes(q) ||
      (r.attributeSkill || "").toLowerCase().includes(q) ||
      r.family.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });
}

function applySort(rows) {
  const dir = state.sortDir === "asc" ? 1 : -1;
  const key = state.sortKey;
  return [...rows].sort((a, b) => {
    if (key === "attributeSkill") {
      /* Group attribute shards by their wiki skill first, then put cheapest
       * max-level cost first inside each skill. */
      const aSkill = a.attributeSkill || "Unknown";
      const bSkill = b.attributeSkill || "Unknown";
      const aUnknown = aSkill === "Unknown";
      const bUnknown = bSkill === "Unknown";
      if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
      const skill = String(aSkill).localeCompare(String(bSkill));
      if (skill !== 0) return skill * dir;
      const ac = a.maxLevelCost, bc = b.maxLevelCost;
      if (ac == null && bc == null) {
        const attr = String(a.attribute || "").localeCompare(String(b.attribute || ""));
        return attr || a.name.localeCompare(b.name);
      }
      if (ac == null) return 1;
      if (bc == null) return -1;
      return (ac - bc)
        || String(a.attribute || "").localeCompare(String(b.attribute || ""))
        || a.name.localeCompare(b.name);
    }

    const av = a[key], bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string") return av.localeCompare(bv) * dir;
    return (av - bv) * dir;
  });
}

/* =========================================================================
 * 8. RENDERING
 * ======================================================================= */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function fmtCoins(n, opts = {}) {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(opts.compact ? 1 : 2) + "k";
  if (abs >= 100) return sign + abs.toFixed(1);
  return sign + abs.toFixed(2);
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

function fmtInt(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fusionTooltipText(r) {
  if (!r?.bestFusion) return "No known fusion recipe";
  const f = r.bestFusion;
  const lines = [];
  lines.push(f.inputs.map((i) => `${i.qty || 1}× ${i.name}`).join(" + ") + ` → ×${f.outputQty} ${r.name}`);
  lines.push(`Inputs: ${f.inputs.map((i) => `${i.qty || 1}× ${i.name} (${fmtCoins(i.price)}/ea = ${fmtCoins(i.total ?? i.price)})`).join(" + ")}`);
  lines.push(`Craft cost: ${fmtCoins(f.pairCost)} total · ${fmtCoins(f.costPerOutput)}/output shard`);
  lines.push(`Sell value: ${fmtCoins(r.buyPrice * (1 - state.tax))} each after bazaar tax`);
  if (f.huntingLocked) {
    lines.push(`Locked: requires Hunting Lv ${f.requiredHuntingLevel}; linked profile is Lv ${state.player.huntingLevel}`);
  } else {
    lines.push(`Craft profit: ${fmtCoins(r.fusionProfitPerUnit)}/ea (${fmtPct(r.fusionMarginPercent)})`);
    lines.push(`Requires Hunting Lv ${f.requiredHuntingLevel}`);
  }
  lines.push(`Bazaar flip: ${fmtCoins(r.profitPerUnit)}/ea (${fmtPct(r.marginPercent)})`);
  lines.push(`Weekly volume: ${fmtInt(r.weeklyVolume)}`);
  return lines.join("\n");
}

function fusionBadgeHTML(r, extraClass = "") {
  if (!r?.hasFusion) return "";
  const lockedClass = r.bestFusion?.huntingLocked ? " badge-fusion-locked" : "";
  const classes = ["badge-fusion", extraClass, lockedClass].filter(Boolean).join(" ");
  return `<span class="${classes}" title="${escapeHtml(fusionTooltipText(r))}" aria-label="Fusion recipe details">${mcIconHTML("ANVIL", "inline-mc-icon", "Fusion")}</span>`;
}

function fusionRecipeInlineHTML(r) {
  if (!r?.bestFusion) return "";
  const f = r.bestFusion;
  const lock = f.huntingLocked
    ? `<span class="table-recipe-lock">Locked: Hunting ${f.requiredHuntingLevel}+</span>`
    : `<span class="table-recipe-profit ${r.fusionProfitPerUnit > 0 ? "pos" : r.fusionProfitPerUnit < 0 ? "neg" : "neu"}">${fmtCoins(r.fusionProfitPerUnit)}/ea</span>`;
  return `
    <div class="table-recipe" title="${escapeHtml(fusionTooltipText(r))}">
      <span class="table-recipe-label">Recipe</span>
      <span class="table-recipe-inputs">
        ${f.inputs.map((i) => `${i.qty || 1}× ${escapeHtml(i.name)}`).join(` <span class="table-recipe-plus">+</span> `)}
      </span>
      <span class="table-recipe-arrow">→</span>
      <span class="table-recipe-output">×${f.outputQty}</span>
      <span class="table-recipe-cost">cost ${fmtCoins(f.costPerOutput)}/ea</span>
      ${lock}
    </div>`;
}

/* Inline SVG placeholder shown when a texture URL fails to load. */
const PLACEHOLDER_ICON =
  "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
       <path d='M16 3 L28 14 L20 30 L12 30 L4 14 Z'
             fill='#1a2033' stroke='#3a4670' stroke-width='1.5'/>
     </svg>`
  );

function iconUrl(bazaarId) {
  const pack = TEXTURE_PACKS[state.texturePack] || TEXTURE_PACKS.skyshards;
  const url = pack.resolve(bazaarId, {
    shardsDb:     state.shardsDb,
    bazaarToCode: state.bazaarToCode,
  });
  return url || PLACEHOLDER_ICON;
}

function renderStats(visibleRows) {
  const totalEl     = $("#stat-total");
  const topProfitEl = $("#stat-top-profit");
  const topSpreadEl = $("#stat-top-spread");
  const updatedEl   = $("#stat-updated");

  totalEl.textContent = visibleRows.length;

  const topProfit = visibleRows.reduce(
    (best, r) => (r.profitPerUnit > (best?.profitPerUnit ?? -Infinity) ? r : best), null
  );
  topProfitEl.innerHTML = topProfit
    ? `<span class="stat-value-major">${fmtCoins(topProfit.profitPerUnit)}</span>
       <span class="stat-value-minor">${escapeHtml(topProfit.name)}</span>`
    : `<span class="stat-value-major">—</span>`;

  const topSpread = visibleRows.reduce(
    (best, r) => (r.spread > (best?.spread ?? -Infinity) ? r : best), null
  );
  topSpreadEl.innerHTML = topSpread
    ? `<span class="stat-value-major">${fmtCoins(topSpread.spread)}</span>
       <span class="stat-value-minor">${escapeHtml(topSpread.name)}</span>`
    : `<span class="stat-value-major">—</span>`;

  updatedEl.innerHTML = state.lastUpdated
    ? `<span class="stat-value-major" id="time-ago">just now</span>
       <span class="stat-value-minor">${new Date(state.lastUpdated).toLocaleTimeString()}</span>`
    : `<span class="stat-value-major">—</span>`;
}

/* Player panel — username form + profile picker + summary stats. */
function renderPlayerPanel() {
  const wrap = $("#player-panel");
  if (!wrap) return;

  const p = state.player;

  /* Initial empty state — just the input. */
  if (!p.username && !p.loading && !p.error) {
    wrap.innerHTML = `
      <form id="player-form" class="player-form" autocomplete="off">
        <label class="player-label" for="player-input">
          Link your account <span class="player-label-aux">(optional)</span>
        </label>
        <div class="player-input-row">
          <input type="text" id="player-input" placeholder="Minecraft username"
                 spellcheck="false" autocapitalize="off" autocorrect="off" />
          <button type="submit" class="btn-primary">Link</button>
        </div>
        <p class="player-hint">
          Adds your coin purse, Hunting level, and personalized craft-flip filters.
          Requires a Hypixel API key in Settings.
        </p>
      </form>`;
    $("#player-form").addEventListener("submit", onPlayerFormSubmit);
    return;
  }

  if (p.loading) {
    wrap.innerHTML = `
      <div class="player-loading">
        <span class="spinner"></span> Looking up <strong>${escapeHtml(p.username || "player")}</strong>…
      </div>`;
    return;
  }

  if (p.error) {
    wrap.innerHTML = `
      <div class="player-error">
        <div class="player-error-msg">${escapeHtml(p.error)}</div>
        <form id="player-form" class="player-form" autocomplete="off">
          <div class="player-input-row">
            <input type="text" id="player-input" value="${escapeHtml(p.username)}"
                   placeholder="Minecraft username" spellcheck="false"
                   autocapitalize="off" autocorrect="off" />
            <button type="submit" class="btn-primary">Retry</button>
            <button type="button" class="btn-ghost" id="player-clear">Clear</button>
          </div>
        </form>
      </div>`;
    $("#player-form").addEventListener("submit", onPlayerFormSubmit);
    $("#player-clear").addEventListener("click", clearPlayer);
    return;
  }

  /* Loaded state */
  const huntingClass = p.huntingLevel >= 15 ? "pos"
                     : p.huntingLevel >= 10 ? "neu"
                     : "neg";
  const x = p.extra || {};

  wrap.innerHTML = `
    <div class="player-loaded">
      <div class="player-identity">
        <img class="player-head"
             src="https://mc-heads.net/avatar/${encodeURIComponent(p.uuid)}/40"
             alt="" loading="lazy"
             onerror="this.style.visibility='hidden'"/>
        <div class="player-identity-text">
          <div class="player-name">${escapeHtml(p.username)}</div>
          <select id="profile-select" class="profile-select" aria-label="SkyBlock profile">
            ${p.profiles.map((pr) => `
              <option value="${pr.profile_id}" ${pr.profile_id === p.selectedId ? "selected" : ""}>
                ${escapeHtml(pr.cute_name)}${pr.game_mode ? ` (${pr.game_mode})` : ""}${pr.selected ? " (selected)" : ""}
              </option>
            `).join("")}
          </select>
        </div>
        <button type="button" class="btn-ghost btn-small" id="player-clear" title="Unlink">×</button>
      </div>

      <div class="player-stats">
        <div class="player-stat">
          <div class="player-stat-label">Coin purse</div>
          <div class="player-stat-value">${p.coinPurse != null ? fmtCoins(p.coinPurse) : "—"}</div>
        </div>
        <div class="player-stat">
          <div class="player-stat-label">Bank</div>
          <div class="player-stat-value">${x.bank != null ? fmtCoins(x.bank) : "—"}</div>
        </div>
        <div class="player-stat">
          <div class="player-stat-label">SB Level</div>
          <div class="player-stat-value">${x.sbLevel != null ? x.sbLevel : "—"}</div>
        </div>
        <div class="player-stat">
          <div class="player-stat-label">Hunting</div>
          <div class="player-stat-value ${huntingClass}">
            ${p.huntingLevel != null ? `Lv ${p.huntingLevel}` : "—"}
          </div>
        </div>
        <div class="player-stat">
          <div class="player-stat-label">Combat</div>
          <div class="player-stat-value">${x.combatLevel != null ? `Lv ${x.combatLevel}` : "—"}</div>
        </div>
        <div class="player-stat">
          <div class="player-stat-label">Slayer XP</div>
          <div class="player-stat-value">${x.slayerXp ? fmtCoins(x.slayerXp) : "—"}</div>
        </div>
        <div class="player-stat">
          <div class="player-stat-label">Fairy souls</div>
          <div class="player-stat-value">${x.fairySouls != null ? x.fairySouls : "—"}</div>
        </div>
      </div>
    </div>`;

  $("#player-clear").addEventListener("click", clearPlayer);
  $("#profile-select").addEventListener("change", (e) => {
    selectProfile(e.target.value);
    renderPlayerPanel();
    renderTable();
    renderBestFusionsPanel();
    renderActiveView();
  });
}

function onPlayerFormSubmit(e) {
  e.preventDefault();
  const name = $("#player-input")?.value.trim();
  if (!name) return;
  loadPlayerProfiles(name);
}

function renderRarityFilters() {
  const wrap = $("#rarity-filters");
  if (wrap.children.length) return;

  const rarities = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "UNKNOWN"];
  for (const r of rarities) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rarity-pill active";
    btn.dataset.rarity = r;
    btn.style.setProperty("--rarity-color", RARITY_COLORS[r]);
    btn.innerHTML = `
      <span class="rarity-dot"></span>
      <span class="rarity-label">${r.charAt(0) + r.slice(1).toLowerCase()}</span>`;
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      if (state.selectedRarities.has(r)) state.selectedRarities.delete(r);
      else state.selectedRarities.add(r);
      renderTable();
    });
    wrap.appendChild(btn);
  }
}

function renderSkillFilters(container = "#skill-filters", onChange = null) {
  const wrap = $(container);
  if (!wrap || wrap.children.length) return;

  for (const skill of (window.ATTRIBUTE_SKILLS || ["Unknown"])) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `skill-pill ${state.selectedSkills.has(skill) ? "active" : ""}`;
    btn.dataset.skill = skill;
    btn.innerHTML = `
      <span class="skill-dot"></span>
      <span class="skill-label">${escapeHtml(skill)}</span>`;
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      if (state.selectedSkills.has(skill)) state.selectedSkills.delete(skill);
      else state.selectedSkills.add(skill);
      $$(`.skill-pill[data-skill="${CSS.escape(skill)}"]`).forEach((pill) => {
        pill.classList.toggle("active", state.selectedSkills.has(skill));
      });
      if (onChange) onChange();
      else {
        renderTable();
        if (state.view === "attributes") renderActiveView();
      }
    });
    wrap.appendChild(btn);
  }
}

/* Top "Best Fusions" panel — ranked craft-and-flip opportunities. */
function renderBestFusionsPanel() {
  const wrap = $("#best-fusions");
  if (!wrap) return;

  const ranked = state.rows
    .filter((r) => r.hasFusion && r.fusionProfitPerUnit > 0)
    .sort((a, b) => b.fusionProfitPerUnit - a.fusionProfitPerUnit)
    .slice(0, 6);

  if (!ranked.length) {
    wrap.innerHTML = `
      <div class="fusion-empty">No profitable fusions right now.
        Markets shift constantly — check back in a minute.</div>`;
    return;
  }

  wrap.innerHTML = ranked.map((r) => {
    /* Affordability: can the player craft at least one with their coin purse? */
    const purse = state.player.coinPurse;
    const affordable = purse != null && r.bestFusion.pairCost <= purse;
    const afford = purse == null ? "" : affordable
      ? `<span class="afford afford-yes" title="Within your coin purse">affordable</span>`
      : `<span class="afford afford-no" title="Need ${fmtCoins(r.bestFusion.pairCost - purse)} more">need ${fmtCoins(r.bestFusion.pairCost - purse)}</span>`;
    const huntReq = r.bestFusion.requiredHuntingLevel > 0
      ? `<span class="afford fusion-hunt-req" title="Requires Hunting Lv ${r.bestFusion.requiredHuntingLevel}">Hunting ${r.bestFusion.requiredHuntingLevel}+</span>`
      : "";
    const craftTooltip = escapeHtml(fusionTooltipText(r));

    return `
    <article class="fusion-card" style="--rarity-color:${RARITY_COLORS[r.rarity]}">
      <div class="fusion-card-head">
        <img class="fusion-icon" src="${iconUrl(r.id)}" alt="" loading="lazy"
             onerror="this.src='${PLACEHOLDER_ICON}'"/>
        <div class="fusion-card-titles">
          <div class="fusion-card-name">
            ${escapeHtml(r.name)}
            ${fusionBadgeHTML(r, "badge-fusion-card")}
          </div>
          <div class="fusion-card-rarity" style="color:${RARITY_COLORS[r.rarity]}">
            ${r.rarity.toLowerCase()} ${huntReq} ${afford}
          </div>
        </div>
        <div class="fusion-card-profit pos" title="${craftTooltip}">
          ${fmtCoins(r.fusionProfitPerUnit)}
          <span class="fusion-card-margin">${fmtPct(r.fusionMarginPercent)}</span>
        </div>
      </div>
      <div class="fusion-card-stats" aria-label="Shard market stats">
        <div><span>Buy</span><strong>${fmtCoins(r.buyPrice)}</strong></div>
        <div><span>Sell</span><strong>${fmtCoins(r.sellPrice)}</strong></div>
        <div><span>Spread</span><strong>${fmtCoins(r.spread)}</strong></div>
        <div><span>Bazaar flip</span><strong class="${r.profitPerUnit > 0 ? "pos" : r.profitPerUnit < 0 ? "neg" : "neu"}">${fmtCoins(r.profitPerUnit)}</strong></div>
        <div><span>Margin</span><strong class="${r.marginPercent > 0 ? "pos" : r.marginPercent < 0 ? "neg" : "neu"}">${fmtPct(r.marginPercent)}</strong></div>
        <div><span>Volume</span><strong>${fmtInt(r.weeklyVolume)}</strong></div>
      </div>
      <div class="fusion-recipe" title="${craftTooltip}">
        ${r.bestFusion.inputs.map((inp) => `
          <div class="fusion-input">
            <img class="fusion-input-icon" src="${iconUrl(inp.bazaarId)}" alt="" loading="lazy"
                 onerror="this.src='${PLACEHOLDER_ICON}'"/>
            <div class="fusion-input-meta">
              <div class="fusion-input-name">${inp.qty || 1}× ${escapeHtml(inp.name)}</div>
              <div class="fusion-input-price">${fmtCoins(inp.price)}/ea · ${fmtCoins(inp.total ?? inp.price)}</div>
            </div>
          </div>
        `).join(`<div class="fusion-plus">+</div>`)}
        <div class="fusion-arrow">→</div>
        <div class="fusion-output">
          <div class="fusion-output-qty">×${r.bestFusion.outputQty}</div>
          <div class="fusion-output-name">${escapeHtml(r.name)}</div>
          <div class="fusion-output-cost">cost ${fmtCoins(r.bestFusion.costPerOutput)} ea</div>
        </div>
      </div>
    </article>
  `;
  }).join("");
}

/* =========================================================================
 * VIEW SWITCHING + ACCESSORY PAGES
 * ======================================================================= */

/* Switch the active page and re-render it. */
function setView(view) {
  state.view = view;

  /* Toggle tab active states. */
  $$(".view-tab").forEach((t) => {
    const on = t.dataset.view === view;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });

  /* Toggle panes. */
  $("#view-home").hidden       = view !== "home";
  $("#view-shards").hidden     = view !== "shards";
  $("#view-missing").hidden    = view !== "missing";
  $("#view-upgrades").hidden   = view !== "upgrades";
  $("#view-attributes").hidden = view !== "attributes";
  $("#view-sweep").hidden      = view !== "sweep";
  $("#view-minions").hidden    = view !== "minions";
  $("#view-mutations").hidden  = view !== "mutations";
  $("#view-garden-chips").hidden = view !== "garden-chips";
  $("#view-farming").hidden    = view !== "farming";
  $("#view-profile").hidden    = view !== "profile";
  $("#view-p2w").hidden        = view !== "p2w";

  /* Accessory and Sweep pages benefit from real AH prices — start a scan on first visit
   * (uses cache on subsequent visits; never blocks the UI). */
  if ((view === "missing" || view === "upgrades" || view === "sweep" || view === "p2w") && !state.lowestBins) {
    loadLowestBinsIfNeeded(false);
  }
  if (view === "p2w" && state.p2w.activeTab === "firesales") {
    loadFireSalesIfNeeded(false);
  }

  renderActiveView();
}

function renderActiveView() {
  if (state.view === "home")       renderHomeView();
  if (state.view === "missing")    renderMissingView();
  if (state.view === "upgrades")   renderUpgradesView();
  if (state.view === "attributes") renderAttributesView();
  if (state.view === "sweep")      renderSweepView();
  if (state.view === "minions")    renderMinionsView();
  if (state.view === "mutations")  renderMutationsView();
  if (state.view === "garden-chips") renderGardenChipsView();
  if (state.view === "farming")    renderFarmingView();
  if (state.view === "profile")    renderProfileView();
  if (state.view === "p2w")        renderP2wView();
  if (state.view === "shards")     renderTable();
}

/* Shared: a "you need to link an account" gate for the accessory pages. */
function accessoryGateHTML(actionLabel) {
  return `
    <div class="acc-gate">
      <div class="acc-gate-icon">${gateIconHTML("COMPASS", "Link account")}</div>
      <h2>Link your account first</h2>
      <p>${actionLabel} needs your profile data. Enter your Minecraft username
         in the panel above, and make sure a Hypixel API key is set in Settings.</p>
    </div>`;
}

/* Shared loading state for accessory pages. */
function accessoryLoadingHTML(label) {
  return `<div class="acc-loading"><span class="spinner"></span> ${label}</div>`;
}

/* Is an accessory bazaar-tradable? (present as a product in the live bazaar) */
function accessoryIsBazaar(id) {
  return !!state.raw?.products?.[id];
}

/* Resolve a real price for an accessory using the unified resolver:
 *   bazaar items → insta-buy or buy-order (per state.bazaarMode)
 *   everything else → lowest BIN (if AH scan has been loaded) */
function accessoryPrice(id) {
  return resolvePrice(id, {
    bazaar: state.raw?.products,
    bins: state.lowestBins,
    bazaarMode: state.bazaarMode,
  });
}

function buildSweepCatalog(itemsData) {
  const byId = {};
  const resourceItems = itemsData?.items || [];
  const resourcesById = new Map(resourceItems.map((it) => [it.id, it]));

  for (const src of window.SWEEP_SOURCES || []) {
    for (const id of src.itemIds || []) {
      if (state.raw?.products?.[id]) continue; // Bazaar products do not need AH name matching.
      const item = resourcesById.get(id);
      byId[id] = {
        id,
        name: item?.name || src.name,
        tier: item?.tier || "UNKNOWN",
        category: item?.category || src.type || "ITEM",
        aliases: src.aliases || [],
      };
    }
  }

  return { byId };
}

function combinePriceCatalogs(...catalogs) {
  const byId = {};
  for (const catalog of catalogs) Object.assign(byId, catalog?.byId || {});
  return { byId };
}

function buildAllCatalog(itemsPayload) {
  const byId = {};
  for (const it of itemsPayload?.items || []) {
    byId[it.id] = {
      id: it.id,
      name: it.name,
      tier: it.tier,
    };
  }
  return { byId };
}

async function ensurePriceCatalogsLoaded() {
  if (state.accessoryCatalog && state.sweepCatalog && state.allCatalog) {
    return combinePriceCatalogs(state.accessoryCatalog, state.sweepCatalog, state.allCatalog);
  }

  const { data } = await api.fetchItems();
  if (data?.items) {
    state.allItems = data.items;
    state.allItemsById = new Map(data.items.map((it) => [it.id, it]));
  }
  if (!state.accessoryCatalog) state.accessoryCatalog = buildAccessoryCatalog(data);
  if (!state.sweepCatalog) state.sweepCatalog = buildSweepCatalog(data);
  if (!state.allCatalog) state.allCatalog = buildAllCatalog(data);
  return combinePriceCatalogs(state.accessoryCatalog, state.sweepCatalog, state.allCatalog);
}

/* Kick off a full AH lowest-BIN scan (cached). Re-renders the active view as
 * progress advances so the user sees prices populate. */
async function loadLowestBinsIfNeeded(force = false) {
  if (state.binsLoading) return;
  if (state.lowestBins && !force) return;

  /* Try cache first. */
  if (!force) {
    const cached = cache.read(CONFIG.CACHE_KEY_BINS, CONFIG.CACHE_TTL_BINS_MS);
    if (cached) {
      state.lowestBins = new Map(cached.data);
      renderActiveView();
      return;
    }
  }

  const combinedCatalog = await ensurePriceCatalogsLoaded();

  state.binsLoading = true;
  state.binsProgress = 0;
  renderActiveView();

  try {
    const bins = await loadLowestBins(combinedCatalog, {
      onProgress: (done, total) => {
        state.binsProgress = done / total;
        /* Throttle re-render to every ~8 pages to avoid thrashing. */
        if (done % 8 === 0) renderActiveView();
      },
    });
    state.lowestBins = bins;
    cache.write(CONFIG.CACHE_KEY_BINS, Array.from(bins.entries()));
  } catch (e) {
    console.error("[Hypixie] BIN scan failed:", e);
  } finally {
    state.binsLoading = false;
    renderActiveView();
  }
}

/* Inline wiki-link + optional soulbound badge for an item name. */
function itemNameHTML(item) {
  const url = wikiUrl(item.name);
  const sb = item.soulbound
    ? `<span class="sb-badge" title="Soulbound (${item.soulboundType || "SOLO"}) — can't be bought on the Auction House">
         <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
           <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
         </svg></span>`
    : "";
  return `
    <a class="acc-card-name wiki-link" href="${url}" target="_blank" rel="noopener noreferrer"
       title="Open on Hypixel Wiki">${escapeHtml(item.name)}<svg class="wiki-ext" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>${sb}`;
}

function accessoryIconUrl(item) {
  if (!item) return PLACEHOLDER_ICON;
  if (item.skinTextureId) {
    return `https://sky.shiiyu.moe/api/head/${item.skinTextureId}`;
  }
  
  const id = item.id.toLowerCase();
  
  if (state.texturePack === "furfsky") {
    return `https://raw.githubusercontent.com/SkyCryptWebsite/SkyCrypt-Backend/dev/assets/resourcepacks/FurfSky/assets/cittofirmgenerated/textures/item/${id}.png`;
  }
  if (state.texturePack === "hypixel_plus") {
    return `https://raw.githubusercontent.com/SkyCryptWebsite/SkyCrypt-Backend/dev/assets/resourcepacks/Hypixel_Plus/assets/cittofirmgenerated/textures/item/${id}.png`;
  }
  
  return skyCryptItemIconUrl(item.id);
}

function skyCryptItemIconUrl(itemId) {
  return `https://sky.shiiyu.moe/api/item/${encodeURIComponent(itemId)}`;
}

const INLINE_ITEM_ICON_OVERRIDES = {
  "INK_SACK:3": `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect width="32" height="32" fill="none"/><rect x="11" y="4" width="10" height="4" fill="#6f3f1d"/><rect x="8" y="8" width="16" height="4" fill="#8b5526"/><rect x="6" y="12" width="20" height="8" fill="#a86b32"/><rect x="8" y="20" width="16" height="4" fill="#7b461f"/><rect x="11" y="24" width="10" height="4" fill="#4f2a15"/><rect x="10" y="10" width="4" height="4" fill="#c28745"/><rect x="18" y="18" width="4" height="4" fill="#5b2f16"/></svg>`)}`,
  COCOA_BEANS: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect width="32" height="32" fill="none"/><rect x="11" y="4" width="10" height="4" fill="#6f3f1d"/><rect x="8" y="8" width="16" height="4" fill="#8b5526"/><rect x="6" y="12" width="20" height="8" fill="#a86b32"/><rect x="8" y="20" width="16" height="4" fill="#7b461f"/><rect x="11" y="24" width="10" height="4" fill="#4f2a15"/><rect x="10" y="10" width="4" height="4" fill="#c28745"/><rect x="18" y="18" width="4" height="4" fill="#5b2f16"/></svg>`)}`,
};

function itemIconOverrideUrl(itemId) {
  return INLINE_ITEM_ICON_OVERRIDES[itemId] || null;
}

function fallbackToSkyCryptItemOnError(itemId, finalFallback = PLACEHOLDER_ICON) {
  const override = itemIconOverrideUrl(itemId);
  if (override) return `this.onerror=null;this.src='${override}';`;
  const safeFallback = String(finalFallback || PLACEHOLDER_ICON).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `if(!this.dataset.skycryptFallback){this.dataset.skycryptFallback='1';this.src='${skyCryptItemIconUrl(itemId)}';}else{this.onerror=null;this.src='${safeFallback}';}`;
}

function fallbackToSkyCryptItemOrHideOnError(itemId) {
  return `if(!this.dataset.skycryptFallback){this.dataset.skycryptFallback='1';this.src='${skyCryptItemIconUrl(itemId)}';}else{this.style.display='none';}`;
}

function getUniversalItemIconUrl(itemId) {
  if (!itemId) return PLACEHOLDER_ICON;
  const override = itemIconOverrideUrl(itemId);
  if (override) return override;
  
  // 1. Check if it's a Shard (exists in shardsDb or begins with SHARD_)
  if (state.shardsDb && (state.shardsDb[itemId] || itemId.startsWith("SHARD_"))) {
    return iconUrl(itemId);
  }
  
  // 2. Check if it's an Accessory in the accessory catalog
  if (state.accessoryCatalog?.byId?.[itemId]) {
    return accessoryIconUrl(state.accessoryCatalog.byId[itemId]);
  }
  
  // 3. Check if we have the full items database and can find skinTextureId
  if (state.allItemsById || state.allItems) {
    const matchedItem = state.allItemsById?.get(itemId) || state.allItems?.find(it => it.id === itemId);
    if (matchedItem) {
      const skinTextureId = window.getSkinTextureId ? window.getSkinTextureId(matchedItem) : null;
      if (skinTextureId) {
        return `https://sky.shiiyu.moe/api/head/${skinTextureId}`;
      }
    }
  }
  
  // 4. Resolve via texture packs
  const id = itemId.toLowerCase();
  if (state.texturePack === "furfsky") {
    return `https://raw.githubusercontent.com/SkyCryptWebsite/SkyCrypt-Backend/dev/assets/resourcepacks/FurfSky/assets/cittofirmgenerated/textures/item/${id}.png`;
  }
  if (state.texturePack === "hypixel_plus") {
    return `https://raw.githubusercontent.com/SkyCryptWebsite/SkyCrypt-Backend/dev/assets/resourcepacks/Hypixel_Plus/assets/cittofirmgenerated/textures/item/${id}.png`;
  }
  
  return skyCryptItemIconUrl(itemId);
}

function mcIconHTML(itemId, className = "mc-icon", alt = "", extraAttrs = "") {
  const id = String(itemId || "STONE").toUpperCase();
  return `<img class="${escapeHtml(className)}" src="${getUniversalItemIconUrl(id)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="${fallbackToSkyCryptItemOnError(id)}" ${extraAttrs}>`;
}

function homeIconHTML(itemId, alt = "") {
  return mcIconHTML(itemId, "home-card-icon-img", alt);
}

function gateIconHTML(itemId, alt = "") {
  return mcIconHTML(itemId, "acc-gate-icon-img", alt);
}


/* Render one accessory action row (used by both pages). */
function accessoryActionRow(item, mpLabel, mpValue) {
  const isBz = accessoryIsBazaar(item.id);
  const cmd  = sourcingCommand(item, isBz);
  const price = accessoryPrice(item.id);

  let priceTxt;
  if (item.soulbound) {
    priceTxt = `<span class="acc-price acc-price-sb">Soulbound · not on AH</span>`;
  } else if (price.market === "bazaar") {
    priceTxt = `<span class="acc-price">${fmtCoins(price.best)} <span class="acc-price-src">${price.label}</span></span>`;
  } else if (price.market === "auction" && price.bin != null) {
    priceTxt = `<span class="acc-price">${fmtCoins(price.bin)} <span class="acc-price-src">lowest BIN</span></span>`;
  } else if (state.binsLoading) {
    priceTxt = `<span class="acc-price acc-price-ah">Auction House · scanning…</span>`;
  } else {
    priceTxt = `<span class="acc-price acc-price-ah">Auction House</span>`;
  }

  const tierColor = RARITY_COLORS[item.tier] || RARITY_COLORS.UNKNOWN;
  /* Soulbound items can't be bought — show a wiki link instead of a /ahs cmd. */
  const cmdRow = item.soulbound
    ? `<div class="acc-card-cmd acc-card-cmd--sb">
         <span class="acc-sb-note">Soulbound — obtain in-game</span>
         <a class="btn-secondary" href="${wikiUrl(item.name)}" target="_blank" rel="noopener noreferrer">Wiki</a>
       </div>`
    : `<div class="acc-card-cmd">
        <code class="acc-cmd-text">${escapeHtml(cmd)}</code>
        <button class="btn-copy" data-copy="${escapeHtml(cmd)}" title="Copy command">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>`;

  return `
    <article class="acc-card" style="--tier-color:${tierColor}">
      <div class="acc-card-main">
        <div class="acc-card-body">
          <div class="acc-card-icon-wrapper">
            <img src="${accessoryIconUrl(item)}" alt="" class="acc-card-icon" loading="lazy" onerror="this.src='${PLACEHOLDER_ICON}'">
          </div>
          <div class="acc-card-titles">
            ${itemNameHTML(item)}
            <div class="acc-card-sub">
              <span class="acc-tier" style="color:${tierColor}">${item.tier.toLowerCase()}</span>
              <span class="meta-sep">·</span>
              ${priceTxt}
            </div>
          </div>
        </div>
        <div class="acc-card-mp">
          <span class="acc-mp-value">${mpValue >= 0 ? "+" : ""}${mpValue}</span>
          <span class="acc-mp-label">${mpLabel}</span>
        </div>
      </div>
      ${cmdRow}
    </article>`;
}

/* Wire copy buttons inside a container (delegated). */
function bindCopyButtons(container) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-copy");
    if (!btn || !btn.dataset.copy) return;
    const text = btn.dataset.copy;
    if (!navigator.clipboard?.writeText) {
      /* Fallback for insecure context / blocked clipboard */
      try {
        const temp = document.createElement("textarea");
        temp.value = text;
        temp.style.position = "fixed"; temp.style.opacity = "0";
        document.body.appendChild(temp); temp.select();
        document.execCommand("copy"); document.body.removeChild(temp);
        const orig = btn.innerHTML;
        btn.classList.add("copied");
        btn.textContent = "Copied!";
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 1200);
      } catch (err) {
        console.error("Clipboard fallback failed:", err);
      }
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.innerHTML;
      btn.classList.add("copied");
      btn.textContent = "Copied!";
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 1200);
    }).catch((err) => {
      console.error("Clipboard writeText failed:", err);
    });
  });
}

/* MP progress header shared by both accessory pages. */
function mpHeaderHTML(analysis) {
  const pct = analysis.maxMP > 0 ? Math.round((analysis.currentMP / analysis.maxMP) * 100) : 0;
  return `
    <div class="mp-header">
      <div class="mp-header-stats">
        <div class="mp-stat">
          <div class="mp-stat-label">Current MP</div>
          <div class="mp-stat-value pos">${fmtInt(analysis.currentMP)}</div>
        </div>
        <div class="mp-stat">
          <div class="mp-stat-label">Max possible</div>
          <div class="mp-stat-value">${fmtInt(analysis.maxMP)}</div>
        </div>
        <div class="mp-stat">
          <div class="mp-stat-label">Completion</div>
          <div class="mp-stat-value">${pct}%</div>
        </div>
      </div>
      <div class="mp-bar"><div class="mp-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
}

/* Shared sourcing-options toolbar for the accessory pages.
 * (No bazaar insta-buy/buy-order control here — accessories are Auction-House
 * only, so that toggle lives on the Attributes page where shards are bought
 * from the Bazaar.) */
function accessoryToolbarHTML() {
  const binsState = state.binsLoading
    ? `<span class="ah-status">Scanning AH… ${Math.round(state.binsProgress * 100)}%</span>`
    : state.lowestBins
      ? `<span class="ah-status ah-status-ok">AH prices loaded (${state.lowestBins.size})</span>`
      : `<button class="btn-secondary btn-small" id="load-bins-btn">Load AH prices</button>`;

  return `
    <div class="acc-toolbar">
      <div class="acc-toolbar-left">
        <label class="toggle-chip">
          <input type="checkbox" id="prefer-max-toggle" ${state.preferMax ? "checked" : ""}/>
          <span>Prefer max tier</span>
        </label>
      </div>
      <div class="acc-toolbar-right">
        <div class="sort-wrap acc-sort-wrap">
          <label for="acc-sort-select" class="sort-label">Sort by</label>
          <select id="acc-sort-select" class="select-native">
            <option value="mp" ${state.accSortKey === "mp" ? "selected" : ""}>Magical Power gain</option>
            <option value="costPerMp" ${state.accSortKey === "costPerMp" ? "selected" : ""}>Cost per MP (cheapest first)</option>
            <option value="price" ${state.accSortKey === "price" ? "selected" : ""}>Price (cheapest first)</option>
          </select>
        </div>
        <div class="acc-toolbar-group acc-toolbar-ah">${binsState}</div>
      </div>
    </div>`;
}

/* Wire the toolbar controls inside a freshly-rendered accessory pane. */
function bindAccessoryToolbar(container) {
  const maxToggle = container.querySelector("#prefer-max-toggle");
  if (maxToggle) {
    maxToggle.addEventListener("change", (e) => {
      state.preferMax = e.target.checked;
      localStorage.setItem(CONFIG.PREFER_MAX_STORAGE, state.preferMax ? "1" : "0");
      /* Re-run analysis with the new preference (no re-decode needed). */
      if (state.accessoryCatalog && state.player.ownedAccessories) {
        state.player.accessoryAnalysis = analyseAccessories(
          state.accessoryCatalog, state.player.ownedAccessories, { preferMax: state.preferMax }
        );
      }
      renderActiveView();
    });
  }

  const sortSelect = container.querySelector("#acc-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      state.accSortKey = e.target.value;
      localStorage.setItem(CONFIG.ACC_SORT_STORAGE, state.accSortKey);
      renderActiveView();
    });
  }

  const loadBtn = container.querySelector("#load-bins-btn");
  if (loadBtn) loadBtn.addEventListener("click", () => loadLowestBinsIfNeeded(true));
}

/* ----- ACCESSORY PATH page ----- */
function getAccessoryItemPrice(item) {
  if (!item || item.soulbound) return Infinity;
  const pPrice = accessoryPrice(item.id)?.best;
  return pPrice != null ? pPrice : Infinity;
}

function getRecombobulatorPrice() {
  const prod = state.raw?.products?.["RECOMBOBULATOR_3000"];
  if (prod?.quick_status) {
    return state.bazaarMode === "buyOrder"
      ? (prod.quick_status.sellPrice || prod.quick_status.buyPrice)
      : (prod.quick_status.buyPrice || prod.quick_status.sellPrice);
  }
  return 6000000;
}

function accessoryPathActions(analysis) {
  const recombPrice = getRecombobulatorPrice();
  return [
    ...analysis.missing.map((m) => ({
      type: "missing",
      item: m.item,
      mpGain: m.mp,
      price: getAccessoryItemPrice(m.item),
      label: "Get missing",
      flowHTML: `<span class="acc-path-start">Missing family</span><span class="acc-upgrade-arrow">→</span><span class="acc-want" style="color:${RARITY_COLORS[m.item.tier] || RARITY_COLORS.UNKNOWN}">${escapeHtml(m.item.name)}</span>`,
      cardHTML: () => accessoryActionRow(m.item, "MP gain", m.mp),
    })),
    ...analysis.upgrades.map((u) => ({
      type: "upgrade",
      item: u.target,
      mpGain: u.mpGain,
      price: getAccessoryItemPrice(u.target),
      label: "Upgrade",
      flowHTML: `<span class="acc-have" style="color:${RARITY_COLORS[u.owned.tier]}">${escapeHtml(u.owned.name)}</span><span class="acc-upgrade-arrow">→</span><span class="acc-want" style="color:${RARITY_COLORS[u.target.tier]}">${escapeHtml(u.target.name)}</span>`,
      cardHTML: () => accessoryActionRow(u.target, "MP gain", u.mpGain),
    })),
    ...(analysis.recombs || []).map((rc) => ({
      type: "recomb",
      item: rc.item,
      mpGain: rc.mpGain,
      price: recombPrice,
      label: "Recombobulate",
      flowHTML: `<span class="acc-have" style="color:${RARITY_COLORS[rc.item.tier]}">${escapeHtml(rc.item.name)}</span><span class="acc-upgrade-arrow">⟳</span><span class="acc-want" style="color:${RARITY_COLORS[rc.nextRarity]}">${rc.nextRarity.toLowerCase()}</span>`,
      cardHTML: () => recombActionRow(rc, recombPrice),
    })),
  ];
}

function sortAccessoryPathActions(actions) {
  const sorted = [...actions];
  if (state.accSortKey === "price") {
    sorted.sort((x, y) => x.price - y.price || y.mpGain - x.mpGain);
  } else if (state.accSortKey === "costPerMp") {
    sorted.sort((x, y) => (x.price / x.mpGain) - (y.price / y.mpGain) || y.mpGain - x.mpGain);
  } else {
    sorted.sort((x, y) => y.mpGain - x.mpGain || x.price - y.price);
  }
  return sorted;
}

function recombActionRow(rc, recombPrice) {
  const color = RARITY_COLORS[rc.nextRarity] || RARITY_COLORS.UNKNOWN;
  const priceTxt = `<span class="acc-price">${fmtCoins(recombPrice)} <span class="acc-price-src">bazaar</span></span>`;
  return `
    <article class="acc-card" style="--tier-color:${color}">
      <div class="acc-card-main">
        <div class="acc-card-titles">
          ${itemNameHTML(rc.item)}
          <div class="acc-card-sub">
            <span class="acc-recomb-note">recombobulate to ${rc.nextRarity.toLowerCase()}</span>
            <span class="meta-sep">·</span>
            ${priceTxt}
          </div>
        </div>
        <div class="acc-card-mp">
          <span class="acc-mp-value">+${rc.mpGain}</span>
          <span class="acc-mp-label">MP gain</span>
        </div>
      </div>
      <div class="acc-card-cmd">
        <code class="acc-cmd-text">/bz Recombobulator 3000</code>
        <button class="btn-copy" data-copy="/bz Recombobulator 3000" title="Copy command">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
    </article>`;
}

function accessoryPathCard(action, index) {
  return `
    <article class="acc-card acc-card--path acc-card--${action.type}" style="--tier-color:${RARITY_COLORS[action.item?.tier] || RARITY_COLORS.UNKNOWN}">
      <div class="acc-path-step">
        <span class="acc-path-num">${index + 1}</span>
        <span class="acc-path-kind">${action.label}</span>
        <span class="acc-path-ratio">${Number.isFinite(action.price) ? `${fmtCoins(action.price / action.mpGain)}/MP` : "price unknown"}</span>
      </div>
      <div class="acc-upgrade-flow">${action.flowHTML}</div>
      ${action.cardHTML()}
    </article>`;
}

function renderMissingView() {
  const pane = $("#view-missing");
  const p = state.player;

  if (!p.username || p.error) { pane.innerHTML = accessoryGateHTML("The accessory path report"); return; }
  if (p.accessoryAnalysis == null) {
    pane.innerHTML = accessoryLoadingHTML("Decoding your accessory bag…");
    return;
  }

  const a = p.accessoryAnalysis;
  if (a.error) { pane.innerHTML = `<div class="acc-gate"><p>Couldn't analyse accessories: ${escapeHtml(a.error)}</p></div>`; return; }

  const missingCount = a.missing.length;
  const upgradeCount = a.upgrades.length;
  const recombCount = (a.recombs || []).length;
  const actions = sortAccessoryPathActions(accessoryPathActions(a));
  updateTabBadge("badge-missing", actions.length);
  updateTabBadge("badge-upgrades", 0);

  const totalGain = actions.reduce((s, x) => s + x.mpGain, 0);
  const pricedActions = actions.filter((x) => Number.isFinite(x.price));
  const totalKnownCost = pricedActions.reduce((s, x) => s + x.price, 0);

  pane.innerHTML = `
    <div class="acc-page-head">
      <div>
        <h2 class="acc-page-title">Accessory Path Forward</h2>
        <p class="acc-page-sub">
          One combined checklist of missing accessories, family upgrades, and recombobulates.
          Sort by MP, cheapest item, or cost per MP to decide what to do next.
          Potential gain: <strong class="pos">+${fmtInt(totalGain)} MP</strong> across ${actions.length} steps${
            pricedActions.length ? `; known listed cost ≈ <strong>${fmtCoins(totalKnownCost)}</strong>.` : "."
          }
        </p>
      </div>
    </div>
    ${mpHeaderHTML(a)}
    <div class="acc-path-summary">
      <div><strong>${missingCount}</strong><span>missing</span></div>
      <div><strong>${upgradeCount}</strong><span>upgrades</span></div>
      <div><strong>${recombCount}</strong><span>recombs</span></div>
    </div>
    ${accessoryToolbarHTML()}
    <div class="acc-grid" id="accessory-path-grid">
      ${actions.length
        ? actions.map(accessoryPathCard).join("")
        : `<div class="acc-empty">No tracked accessory steps left. Nice.</div>`}
    </div>`;

  bindAccessoryToolbar(pane);
  bindCopyButtons($("#accessory-path-grid"));
}

function renderUpgradesView() {
  renderMissingView();
}

function updateTabBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) { el.textContent = count; el.hidden = false; }
  else           { el.hidden = true; }
}

/* ----- ATTRIBUTES page -----
 * Shows how many shards each attribute still needs to reach max level, plus
 * the coin cost (live bazaar insta-buy of the source shard). */
function renderAttributesView() {
  const pane = $("#view-attributes");
  const p = state.player;

  if (!p.username || p.error) { pane.innerHTML = accessoryGateHTML("The attribute-maxing report"); return; }
  if (p.attributeAnalysis == null) {
    pane.innerHTML = accessoryLoadingHTML("Reading your attribute progress…");
    return;
  }

  const a = p.attributeAnalysis;
  if (a.error) { pane.innerHTML = `<div class="acc-gate"><p>Couldn't analyse attributes: ${escapeHtml(a.error)}</p></div>`; return; }
  if (!a.totalCount) {
    pane.innerHTML = `<div class="acc-gate"><div class="acc-gate-icon">${gateIconHTML("ENCHANTED_BOOK", "Attributes")}</div>
      <h2>No attribute data</h2>
      <p>This profile has no attribute progress recorded yet. Syphon some shards in-game first.</p></div>`;
    updateTabBadge("badge-attributes", 0);
    return;
  }

  const visibleRows = a.rows.filter((r) => state.selectedSkills.has(r.skill || "Unknown"));
  const unmaxed = a.rows.filter((r) => !r.maxed);
  const missing = a.rows.filter((r) => r.missing);
  updateTabBadge("badge-attributes", unmaxed.length);

  const pct = a.totalCount > 0 ? Math.round((a.maxedCount / a.totalCount) * 100) : 0;
  const huntingNote = state.player.huntingLevel != null
    ? ` Showing attributes usable at your Hunting level (${state.player.huntingLevel}).${
        a.hiddenLockedCount ? ` ${a.hiddenLockedCount} higher-tier locked attribute${a.hiddenLockedCount === 1 ? " is" : "s are"} hidden.` : ""
      }`
    : "";

  pane.innerHTML = `
    <div class="acc-page-head">
      <div>
        <h2 class="acc-page-title">Attribute Maxing</h2>
        <p class="acc-page-sub">
          How many Attribute Shards you still need to take each usable attribute to
          <strong>level 10</strong>, with live bazaar cost. Missing attributes are
          included as <strong>0/max</strong>. You still need
          <strong class="pos">${fmtInt(a.totalShardsNeeded)}</strong> shards
          ${a.totalCost > 0 ? `(≈ <strong>${fmtCoins(a.totalCost)}</strong> coins)` : ""}
          to max ${unmaxed.length} attribute${unmaxed.length === 1 ? "" : "s"};
          <strong>${missing.length}</strong> are missing entirely.${huntingNote}
          Showing <strong>${visibleRows.length}</strong> attribute${visibleRows.length === 1 ? "" : "s"}
          after the skill filter.
        </p>
      </div>
    </div>

    <div class="mp-header">
      <div class="mp-header-stats">
        <div class="mp-stat">
          <div class="mp-stat-label">Maxed</div>
          <div class="mp-stat-value pos">${a.maxedCount} / ${a.totalCount}</div>
        </div>
        <div class="mp-stat">
          <div class="mp-stat-label">Missing</div>
          <div class="mp-stat-value neg">${missing.length}</div>
        </div>
        <div class="mp-stat">
          <div class="mp-stat-label">Shards needed</div>
          <div class="mp-stat-value">${fmtInt(a.totalShardsNeeded)}</div>
        </div>
        <div class="mp-stat">
          <div class="mp-stat-label">Est. cost</div>
          <div class="mp-stat-value">${a.totalCost > 0 ? fmtCoins(a.totalCost) : "—"}</div>
        </div>
      </div>
      <div class="mp-bar"><div class="mp-bar-fill" style="width:${pct}%"></div></div>
    </div>

    <div class="acc-toolbar">
      <div class="acc-toolbar-group">
        <span class="acc-toolbar-label">Shard price:</span>
        <div class="seg" role="group">
          <button class="seg-btn ${state.bazaarMode === "instaBuy" ? "active" : ""}" data-bzmode="instaBuy">Insta-buy</button>
          <button class="seg-btn ${state.bazaarMode === "buyOrder" ? "active" : ""}" data-bzmode="buyOrder">Buy order</button>
        </div>
      </div>
      <div class="acc-toolbar-group acc-toolbar-group--wrap">
        <span class="acc-toolbar-label">Skill:</span>
        <div id="attr-skill-filters" class="skill-filters skill-filters--inline" role="group" aria-label="Filter attributes by skill"></div>
      </div>
    </div>

    <div class="attr-grid">
      ${visibleRows.length
        ? visibleRows.map(renderAttributeRow).join("")
        : `<div class="state-empty attr-filter-empty">No usable attributes match the selected skills.</div>`}
    </div>`;

  /* Wire the bazaar-mode segmented control (re-prices shards, re-renders). */
  pane.querySelectorAll("[data-bzmode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.bazaarMode === btn.dataset.bzmode) return;
      state.bazaarMode = btn.dataset.bzmode;
      localStorage.setItem(CONFIG.BAZAAR_MODE_STORAGE, state.bazaarMode);
      /* Recompute shard costs under the new pricing, then re-render. */
      loadAttributeAnalysis();
    });
  });

  renderSkillFilters("#attr-skill-filters", () => renderActiveView());

  bindCopyButtons(pane);
}

function renderAttributeRow(r) {
  const color = RARITY_COLORS[r.rarity] || RARITY_COLORS.UNKNOWN;
  const progPct = Math.round((r.current / r.max) * 100);
  const shardBazaarId = state.codeToBazaar?.[r.code];
  const skillText = r.skill || "Unknown";

  if (r.maxed) {
    return `
      <article class="attr-card attr-card--maxed" style="--tier-color:${color}">
        <div class="attr-card-head" style="display: flex; align-items: center; gap: 8px;">
          <img src="${iconUrl(shardBazaarId)}" alt="" style="width: 18px; height: 18px; object-fit: contain; image-rendering: pixelated; flex-shrink: 0;" onerror="this.style.display='none';">
          <a class="attr-name wiki-link" href="${wikiUrl(r.title)}" target="_blank" rel="noopener noreferrer" title="Open on Hypixel Wiki">${escapeHtml(r.title)}</a>
          <span class="attr-skill-badge">${escapeHtml(skillText)}</span>
          <span class="attr-maxed-badge">MAX</span>
        </div>
        <div class="attr-progress"><div class="attr-progress-fill" style="width:100%;background:${color}"></div></div>
        <div class="attr-foot"><span class="attr-count">${r.current}/${r.max}</span></div>
      </article>`;
  }

  /* sourcing command for the shard that grants this attribute */
  const propName = state.fusionProps?.[r.code]?.name;
  const cmd = propName
    ? `/bz ${propName} Shard`
    : null;

  const statusBadge = r.missing
    ? `<span class="attr-missing-badge">MISSING</span>`
    : `<span class="attr-rarity" style="color:${color}">${r.rarity.toLowerCase()}</span>`;
  const reqText = r.requiredHuntingLevel > 0 ? ` · Hunting ${r.requiredHuntingLevel}+` : "";

  return `
    <article class="attr-card ${r.missing ? "attr-card--missing" : ""}" style="--tier-color:${color}">
      <div class="attr-card-head" style="display: flex; align-items: center; gap: 8px;">
        <img src="${iconUrl(shardBazaarId)}" alt="" style="width: 18px; height: 18px; object-fit: contain; image-rendering: pixelated; flex-shrink: 0;" onerror="this.style.display='none';">
        <a class="attr-name wiki-link" href="${wikiUrl(r.title)}" target="_blank" rel="noopener noreferrer" title="Open on Hypixel Wiki">${escapeHtml(r.title)}</a>
        <span class="attr-skill-badge">${escapeHtml(skillText)}</span>
        ${statusBadge}
      </div>
      <div class="attr-progress"><div class="attr-progress-fill" style="width:${progPct}%;background:${color}"></div></div>
      <div class="attr-foot">
        <span class="attr-count">${r.current}/${r.max}${reqText}</span>
        <span class="attr-need">need <strong>${r.remaining}</strong> more${
          r.remainingCost != null ? ` · ${fmtCoins(r.remainingCost)}` : ""
        }</span>
      </div>
      ${cmd ? `
        <div class="acc-card-cmd">
          <code class="acc-cmd-text">${escapeHtml(cmd)}</code>
          <button class="btn-copy" data-copy="${escapeHtml(cmd)}" title="Copy command">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy
          </button>
        </div>` : ""}
    </article>`;
}

/* ----- SWEEP OPTIMIZER page ----- */
function sweepValueLabel(src) {
  if (src.sweepLabel) return src.sweepLabel;
  if (src.sweep == null) return "variable";
  return `+${src.sweep} Sweep`;
}

function sweepPriceForItem(id) {
  return resolvePrice(id, {
    bazaar: state.raw?.products,
    bins: state.lowestBins,
    bazaarMode: state.bazaarMode,
  });
}

function sweepBazaarCommand(id) {
  const overrides = {
    "INK_SACK:4": "Lapis Lazuli",
    "INK_SACK:3": "Cocoa Beans",
    "POTATO_ITEM": "Potato",
    "CARROT_ITEM": "Carrot",
    "CLAY_BALL": "Clay",
    "LOG": "Oak Wood",
    "LOG:1": "Spruce Wood",
    "LOG:2": "Birch Wood",
    "LOG:3": "Jungle Wood",
    "LOG_2": "Acacia Wood",
    "LOG_2:1": "Dark Oak Wood",
    "FIG_LOG": "Fig Log",
    "MANGROVE_LOG": "Mangrove Log",
    "RAW_FISH": "Raw Fish",
    "ENCHANTED_OAK_LOG": "Enchanted Oak Wood",
    "ENCHANTED_SPRUCE_LOG": "Enchanted Spruce Wood",
    "ENCHANTED_BIRCH_LOG": "Enchanted Birch Wood",
    "ENCHANTED_JUNGLE_LOG": "Enchanted Jungle Wood",
    "ENCHANTED_ACACIA_LOG": "Enchanted Acacia Wood",
    "ENCHANTED_DARK_OAK_LOG": "Enchanted Dark Oak Wood"
  };

  if (overrides[id]) {
    return `/bz ${overrides[id]}`;
  }

  let name = id;
  const isShard = name.startsWith("SHARD_");
  const isUltimate = name.startsWith("ENCHANTMENT_ULTIMATE_");
  const isEnch = name.startsWith("ENCHANTMENT_") && !isUltimate;

  if (isUltimate) name = "ULTIMATE_" + name.replace("ENCHANTMENT_ULTIMATE_", "");
  else if (isEnch) name = name.replace("ENCHANTMENT_", "");
  else if (isShard) name = name.replace("SHARD_", "");

  if (isUltimate || isEnch) {
    name = name.replace(/_1$/, "_I")
               .replace(/_2$/, "_II")
               .replace(/_3$/, "_III")
               .replace(/_4$/, "_IV")
               .replace(/_5$/, "_V");
  }

  name = name.replace(/_/g, " ").toLowerCase();
  name = name.replace(/\b\w/g, (c) => c.toUpperCase());

  if (isShard) name += " Shard";

  return `/bz ${name}`;
}

function sweepAuctionCommand(src) {
  const query = src.aliases?.[0] || src.name;
  return `/ah ${query}`;
}

function resolveSweepSource(src) {
  const details = [];
  let totalCost = null;
  let market = "progression";
  let command = null;

  if (src.costKind === "bazaar-bundle") {
    totalCost = 0;
    market = "bazaar";
    for (const c of src.costs || []) {
      const p = sweepPriceForItem(c.id);
      if (p.best == null) { totalCost = null; break; }
      totalCost += p.best * c.qty;
      details.push(`${fmtInt(c.qty)}× ${escapeHtml(c.label || c.id)} @ ${fmtCoins(p.best)}`);
      command = sweepBazaarCommand(c.id, c.label || c.id);
    }
  } else if (src.costKind === "bazaar") {
    const id = src.itemIds?.[0];
    const p = id ? sweepPriceForItem(id) : null;
    market = "bazaar";
    totalCost = p?.best ?? null;
    if (id) {
      details.push(`${escapeHtml(src.name)} @ ${totalCost != null ? fmtCoins(totalCost) : "unknown"} (${p?.label || "bazaar"})`);
      command = sweepBazaarCommand(id, src.name);
    }
  } else if (src.costKind === "attribute") {
    const p = sweepPriceForItem(src.shardId);
    market = "bazaar";
    const shardsToTierX = 512;
    totalCost = p.best == null ? null : p.best * shardsToTierX;
    details.push(`512× Tier I shard to fuse Tier X @ ${p.best != null ? fmtCoins(p.best) : "unknown"}/ea`);
    command = sweepBazaarCommand(src.shardId, src.name);
  } else if (src.costKind === "auction") {
    const id = src.itemIds?.[0];
    const p = id ? sweepPriceForItem(id) : null;
    market = "auction";
    totalCost = p?.best ?? null;
    details.push(`${escapeHtml(src.name)} ${p?.bin != null ? `lowest BIN ${fmtCoins(p.bin)}` : state.binsLoading ? "AH scanning…" : "AH price unknown"}`);
    command = sweepAuctionCommand(src);
  } else if (src.costKind === "auction-bundle") {
    totalCost = 0;
    market = "auction";
    for (const id of src.itemIds || []) {
      const p = sweepPriceForItem(id);
      const label = state.sweepCatalog?.byId?.[id]?.name || id;
      details.push(`${escapeHtml(label)}: ${p.best != null ? fmtCoins(p.best) : state.binsLoading ? "scanning…" : "unknown"}`);
      if (p.best == null) totalCost = null;
      else if (totalCost != null) totalCost += p.best;
    }
    command = sweepAuctionCommand(src);
  } else {
    details.push(src.note || "Progression, milestone, or situational source; no direct coin price from Bazaar/AH.");
  }

  const sweep = typeof src.sweep === "number" && src.sweep > 0 ? src.sweep : null;
  const costPerSweep = totalCost != null && sweep ? totalCost / sweep : null;
  return { ...src, totalCost, costPerSweep, market, details, command };
}

function getSweepRows() {
  return (window.SWEEP_SOURCES || [])
    .map((src) => {
      const row = resolveSweepSource(src);
      const completion = state.player.sweepAnalysis?.bySource?.[src.id] || null;

      if (completion) {
        if (src.id === "sweep-booster-armor" || src.id === "sweep-booster-equipment") {
          const current = typeof completion.current === "number" ? completion.current : 0;
          const remaining = Math.max(0, 4 - current);
          const p = sweepPriceForItem("SWEEP_BOOSTER");
          row.totalCost = p.best == null ? null : p.best * remaining;
          row.details = [`${remaining}× Sweep Booster needed to finish @ ${p.best != null ? fmtCoins(p.best) : "unknown"}/ea`].concat(row.details.slice(1));
          if (row.sweep) {
            const remainingSweep = remaining * src.sweep;
            row.costPerSweep = row.totalCost != null && remainingSweep > 0 ? row.totalCost / remainingSweep : null;
          }
        } else if (src.costKind === "attribute" && Number.isFinite(completion.current)) {
          const p = sweepPriceForItem(src.shardId);
          const remaining = Math.max(0, 512 - completion.current);
          row.totalCost = p.best == null ? null : p.best * remaining;
          row.details = [`${remaining}× Tier I shards to finish Tier X @ ${p.best != null ? fmtCoins(p.best) : "unknown"}/ea`].concat(row.details.slice(1));
          if (row.sweep) {
            const remainingSweep = (remaining / 512) * src.sweep;
            row.costPerSweep = row.totalCost != null && remainingSweep > 0 ? row.totalCost / remainingSweep : null;
          }
        }
      }
      return { ...row, completion };
    })
    .sort((a, b) => {
      const ac = a.completion?.completed ? 1 : 0;
      const bc = b.completion?.completed ? 1 : 0;
      if (ac !== bc) return ac - bc;
      const ap = Number.isFinite(a.totalCost) ? 0 : 1;
      const bp = Number.isFinite(b.totalCost) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      if (Number.isFinite(a.totalCost) && Number.isFinite(b.totalCost)) return a.totalCost - b.totalCost;
      return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    });
}

function sweepToolbarHTML() {
  const binsState = state.binsLoading
    ? `<span class="ah-status">Scanning AH… ${Math.round(state.binsProgress * 100)}%</span>`
    : state.lowestBins
      ? `<span class="ah-status ah-status-ok">AH prices loaded (${state.lowestBins.size})</span>`
      : `<button class="btn-secondary btn-small" id="load-sweep-bins-btn">Load AH prices</button>`;

  return `
    <div class="acc-toolbar sweep-toolbar">
      <div class="acc-toolbar-left">
        <span class="sweep-source-note">Sorted by known live coin cost, cheapest → highest. Bazaar uses your current ${state.bazaarMode === "buyOrder" ? "buy-order" : "insta-buy"} setting.</span>
      </div>
      <div class="acc-toolbar-right">
        <div class="acc-toolbar-group sweep-owned-toggle">
          <label class="acc-toggle-inline">
            <input type="checkbox" id="sweep-show-completed" ${state.sweepShowCompleted ? "checked" : ""}>
            <span>Show completed</span>
          </label>
        </div>
        <div class="segmented" role="group" aria-label="Bazaar price mode">
          <button class="seg-btn ${state.bazaarMode === "instaBuy" ? "active" : ""}" data-sweep-bz="instaBuy">Insta-buy</button>
          <button class="seg-btn ${state.bazaarMode === "buyOrder" ? "active" : ""}" data-sweep-bz="buyOrder">Buy order</button>
        </div>
        <div class="acc-toolbar-group acc-toolbar-ah">${binsState}</div>
      </div>
    </div>`;
}

function renderSweepCard(row, index) {
  const priced = Number.isFinite(row.totalCost);
  const completed = row.completion?.completed === true;
  const partial = row.completion?.partial === true;
  const unit = Number.isFinite(row.costPerSweep) ? `${fmtCoins(row.costPerSweep)}/Sweep` : "—";
  const marketLabel = row.costKind === "progression" ? "progression" : row.market;
  const cmd = row.command;
  const status = completed
    ? `<span class="sweep-status sweep-status-owned">Already have</span>`
    : partial
      ? `<span class="sweep-status sweep-status-partial">Partly done</span>`
      : state.player.sweepAnalysis
        ? `<span class="sweep-status sweep-status-next">Recommended</span>`
        : "";

  return `
    <article class="sweep-card ${priced ? "" : "sweep-card--unpriced"} ${completed ? "sweep-card--owned" : ""} ${partial ? "sweep-card--partial" : ""}">
      <div class="sweep-rank">${priced ? index + 1 : "—"}</div>
      <div class="sweep-main">
        <div class="sweep-card-head">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="sweep-card-icon-wrapper" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border: 1px solid var(--surface-line); border-radius: var(--r-md); padding: 4px; flex-shrink: 0;">
              <img src="${getUniversalItemIconUrl(row.id)}" alt="" class="sweep-card-icon" style="max-width: 100%; max-height: 100%; object-fit: contain; image-rendering: pixelated;" onerror="${fallbackToSkyCryptItemOnError(row.id)}">
            </div>
            <div>
              <h3>${escapeHtml(row.name)}</h3>
              <div class="sweep-meta">
                <span>${escapeHtml(row.category)}</span>
                <span class="meta-sep">·</span>
                <span>${escapeHtml(row.type)}</span>
                <span class="meta-sep">·</span>
                <span>${escapeHtml(row.source || marketLabel)}</span>
              </div>
            </div>
          </div>
          <div class="sweep-gain-wrap">
            ${status}
            <div class="sweep-gain">${escapeHtml(sweepValueLabel(row))}</div>
          </div>
        </div>
        ${row.completion?.reason ? `<p class="sweep-owned-note">Profile: ${escapeHtml(row.completion.reason)}</p>` : ""}
        <p class="sweep-note">${escapeHtml(row.note || "")}</p>
        <div class="sweep-cost-line">
          <span class="sweep-cost ${priced ? "" : "sweep-cost-muted"}">${priced ? fmtCoins(row.totalCost) : "Not directly priceable"}</span>
          <span class="sweep-unit">${unit}</span>
          <span class="sweep-market">${escapeHtml(marketLabel)}</span>
        </div>
        ${row.details?.length ? `<ul class="sweep-details">${row.details.map((d) => `<li>${d}</li>`).join("")}</ul>` : ""}
        ${cmd ? `<div class="acc-card-cmd sweep-cmd"><code class="acc-cmd-text">${escapeHtml(cmd)}</code><button class="btn-copy" data-copy="${escapeHtml(cmd)}">Copy</button></div>` : ""}
      </div>
    </article>`;
}

function renderSweepView() {
  const pane = $("#view-sweep");
  if (!Array.isArray(window.SWEEP_SOURCES) || window.SWEEP_SOURCES.length === 0) {
    pane.innerHTML = `
      <div class="acc-gate sweep-data-gate">
        <div class="acc-gate-icon">${gateIconHTML("BARRIER", "Warning")}</div>
        <h2>Sweep data did not load</h2>
        <p>The Sweep tab needs <code>sweep-data.js</code>. If you are viewing GitHub Pages, push the latest commit and hard-refresh the page so the new data file is deployed.</p>
      </div>`;
    return;
  }

  const rows = getSweepRows();
  const completedRows = rows.filter((r) => r.completion?.completed);
  const recommendedRows = rows.filter((r) => !r.completion?.completed);
  const visibleRows = state.sweepShowCompleted ? rows : recommendedRows;
  const priced = recommendedRows.filter((r) => Number.isFinite(r.totalCost));
  const totalKnownSweep = priced.reduce((s, r) => s + (typeof r.sweep === "number" ? r.sweep : 0), 0);
  const cheapest = priced[0];

  pane.innerHTML = `
    <div class="acc-page-head sweep-page-head">
      <div>
        <h2 class="acc-page-title">Sweep Optimizer</h2>
        <p class="acc-page-sub">
          Every Sweep source from the Hypixel Wiki page, priced from the official Bazaar and Auction House where possible.
          ${state.player.sweepAnalysis ? `Completed sources are hidden by default for ${escapeHtml(state.player.username || "the linked profile")}.` : "Link a player to hide sources they already have."}
          Cheapest known next method: <strong>${cheapest ? `${escapeHtml(cheapest.name)} (${fmtCoins(cheapest.totalCost)})` : "load prices first"}</strong>.
        </p>
      </div>
    </div>
    <section class="stats-grid sweep-stats" aria-label="Sweep overview">
      <div class="stat-card"><div class="stat-label">Recommended sources</div><div class="stat-value">${fmtInt(recommendedRows.length)}</div></div>
      <div class="stat-card"><div class="stat-label">Hidden completed</div><div class="stat-value">${fmtInt(completedRows.length)}</div></div>
      <div class="stat-card"><div class="stat-label">Live-priced next methods</div><div class="stat-value">${fmtInt(priced.length)}</div></div>
      <div class="stat-card"><div class="stat-label">Best cost / Sweep</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${cheapest?.costPerSweep ? fmtCoins(cheapest.costPerSweep) : "—"}</span></div></div>
    </section>
    ${sweepToolbarHTML()}
    <div class="sweep-grid">
      ${visibleRows.map(renderSweepCard).join("")}
    </div>`;

  pane.querySelector("#load-sweep-bins-btn")?.addEventListener("click", () => loadLowestBinsIfNeeded(true));
  pane.querySelector("#sweep-show-completed")?.addEventListener("change", (e) => {
    state.sweepShowCompleted = e.target.checked;
    localStorage.setItem(CONFIG.SWEEP_SHOW_COMPLETED_STORAGE, state.sweepShowCompleted ? "1" : "0");
    renderSweepView();
  });
  pane.querySelectorAll("[data-sweep-bz]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.bazaarMode = btn.dataset.sweepBz;
      localStorage.setItem(CONFIG.BAZAAR_MODE_STORAGE, state.bazaarMode);
      renderSweepView();
      if (state.player.attributeAnalysis) loadAttributeAnalysis();
    });
  });
  bindCopyButtons(pane);
}

function renderTable() {
  const tbody = $("#shard-table tbody");
  const filtered = applyFilters(state.rows);
  const sorted = applySort(filtered);

  /* Update column-header sort indicators. */
  $$("#shard-table th[data-sort]").forEach((th) => {
    const isActive = th.dataset.sort === state.sortKey;
    th.classList.toggle("sort-active", isActive);
    th.classList.toggle("sort-asc",  isActive && state.sortDir === "asc");
    th.classList.toggle("sort-desc", isActive && state.sortDir === "desc");
  });

  const COLSPAN = 10;

  if (state.loading && !state.rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="${COLSPAN}" class="state-row">
        <div class="state-loading"><span class="spinner"></span>Loading bazaar data…</div>
      </td></tr>`;
    renderStats([]);
    return;
  }
  if (state.error) {
    tbody.innerHTML = `
      <tr><td colspan="${COLSPAN}" class="state-row">
        <div class="state-error">
          <strong>Couldn't load data.</strong>
          <span>${escapeHtml(state.error)}</span>
          <button class="btn-secondary" id="retry-btn">Retry</button>
        </div>
      </td></tr>`;
    $("#retry-btn")?.addEventListener("click", () => loadData(true));
    renderStats([]);
    return;
  }
  if (!sorted.length) {
    tbody.innerHTML = `
      <tr><td colspan="${COLSPAN}" class="state-row">
        <div class="state-empty">No shards match your filters.</div>
      </td></tr>`;
    renderStats([]);
    return;
  }

  const frag = document.createDocumentFragment();
  sorted.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.style.setProperty("--rarity-color", RARITY_COLORS[r.rarity]);
    tr.dataset.rarity = r.rarity;

    const profitClass = r.profitPerUnit > 0 ? "pos" : r.profitPerUnit < 0 ? "neg" : "neu";
    const marginClass = r.marginPercent > 0 ? "pos" : r.marginPercent < 0 ? "neg" : "neu";
    const fusionClass = r.fusionProfitPerUnit == null ? "neu"
      : r.fusionProfitPerUnit > 0 ? "pos" : "neg";

    const fusionCell = r.bestFusion
      ? r.bestFusion.huntingLocked
        ? `<span class="fusion-val fusion-locked" title="Requires Hunting Lv ${r.bestFusion.requiredHuntingLevel}; your linked profile is Lv ${state.player.huntingLevel}">Locked Lv ${r.bestFusion.requiredHuntingLevel}</span>`
        : `<span class="fusion-val ${fusionClass}" title="${escapeHtml(
            r.bestFusion.inputs.map(i => i.name).join("  +  ")
            + `  →  ×${r.bestFusion.outputQty} ${r.name}\n`
            + `Input cost: ${fmtCoins(r.bestFusion.costPerOutput)}/ea`
            + `\nRequires Hunting Lv ${r.bestFusion.requiredHuntingLevel}`
          )}">${fmtCoins(r.fusionProfitPerUnit)}</span>`
      : `<span class="num-muted">—</span>`;

    tr.innerHTML = `
      <td class="cell-rank">${idx + 1}</td>
      <td class="cell-icon">
        <img class="shard-icon" src="${iconUrl(r.id)}" alt="" loading="lazy"
             onerror="this.src='${PLACEHOLDER_ICON}'"/>
      </td>
      <td class="cell-shard">
        <div class="shard-name">
          ${escapeHtml(r.name)}
          ${r.known ? "" : '<span class="badge-unknown" title="No metadata in our database — auto-detected from bazaar">new</span>'}
          ${r.hasFusion ? fusionBadgeHTML(r) : ""}
        </div>
        <div class="shard-meta">
          <span class="meta-rarity" style="color:${RARITY_COLORS[r.rarity]}">${r.rarity.toLowerCase()}</span>
          <span class="meta-sep">·</span>
          <span class="meta-skill">${escapeHtml(r.attributeSkill || "Unknown")}</span>
          <span class="meta-sep">·</span>
          <span class="meta-family">${escapeHtml(r.family)}</span>
          ${r.attribute !== "—" ? `<span class="meta-sep">·</span><span class="meta-attr">${escapeHtml(r.attribute)}</span>` : ""}
        </div>
        ${fusionRecipeInlineHTML(r)}
      </td>
      <td class="num">${fmtCoins(r.buyPrice)}</td>
      <td class="num">${fmtCoins(r.sellPrice)}</td>
      <td class="num">${fmtCoins(r.spread)}</td>
      <td class="num ${profitClass}">${fmtCoins(r.profitPerUnit)}</td>
      <td class="num ${marginClass}">${fmtPct(r.marginPercent)}</td>
      <td class="num">${fusionCell}</td>
      <td class="num">${fmtInt(r.weeklyVolume)}</td>
    `;
    frag.appendChild(tr);
  });
  tbody.replaceChildren(frag);
  renderStats(sorted);
  renderBestFusionsPanel();
}

/* "Updated 12s ago" auto-refresher (purely cosmetic). */
function startTimeAgoTicker() {
  setInterval(() => {
    const el = $("#time-ago");
    if (!el || !state.lastUpdated) return;
    const sec = Math.round((Date.now() - state.lastUpdated) / 1000);
    let text;
    if (sec < 5)         text = "just now";
    else if (sec < 60)   text = `${sec}s ago`;
    else if (sec < 3600) text = `${Math.floor(sec / 60)}m ago`;
    else                 text = `${Math.floor(sec / 3600)}h ago`;
    el.textContent = text;
  }, 1000);
}

/* =========================================================================
 * 9. ORCHESTRATION & EVENT HANDLERS
 * ======================================================================= */
async function ensureFusionDataLoaded() {
  /* Load fusion datasets in parallel; build the merged shards DB. */
  if (state.fusionProps && state.fusionRecipes) return;
  const [propsResp, recipesResp] = await Promise.all([
    api.fetchFusionProps(),
    api.fetchFusionData(),
  ]);
  state.fusionProps   = propsResp.data;
  state.fusionRecipes = recipesResp.data;

  const built = buildShardsDbFromProperties(state.fusionProps);
  state.shardsDb     = built.shardsDb;
  state.codeToBazaar = built.codeToBazaar;
  state.bazaarToCode = built.bazaarToCode;
}

async function loadData(forceRefresh = false) {
  if (forceRefresh) {
    cache.clear(CONFIG.CACHE_KEY_BAZAAR);
  }

  state.loading = true;
  state.error = null;
  renderTable();

  try {
    await ensureFusionDataLoaded();
    const { data, cached, cachedAt } = await api.fetchBazaar();
    state.raw = data;
    state.lastUpdated = data.lastUpdated || cachedAt;
    state.fetchedAt = Date.now();
    state.rows = buildRows(data);

    $("#cache-badge").style.display = cached ? "inline-flex" : "none";

    if (state.player && state.player.attributeStacks) {
      loadAttributeAnalysis();
    }
  } catch (e) {
    state.error = e.message;
    console.error("[Hypixie] load failed:", e);
  } finally {
    state.loading = false;
    renderTable();
    if (state.view !== "shards") {
      renderActiveView();
    }
  }
}

function populateTexturePackSelect() {
  const sel = $("#texture-select");
  if (!sel) return;
  sel.innerHTML = "";
  for (const [key, pack] of Object.entries(TEXTURE_PACKS)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = pack.label;
    sel.appendChild(opt);
  }
  sel.value = state.texturePack;
}

function bindUI() {
  /* View tabs */
  $$(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });

  /* Search */
  const searchInput = $("#search-input");
  let searchTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value;
      renderTable();
    }, 120);
  });

  /* Sort dropdown (mobile-friendly alt to header clicks). */
  $("#sort-select").addEventListener("change", (e) => {
    const [key, dir] = e.target.value.split(":");
    state.sortKey = key;
    state.sortDir = dir;
    renderTable();
  });

  /* Sortable column headers. */
  $$("#shard-table th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = th.dataset.defaultDir || "desc";
      }
      $("#sort-select").value = `${state.sortKey}:${state.sortDir}`;
      renderTable();
    });
  });

  /* Fusion toggles. */
  $("#fusion-only")?.addEventListener("change", (e) => {
    state.fusionOnly = e.target.checked;
    renderTable();
  });
  $("#fusion-profitable-only")?.addEventListener("change", (e) => {
    state.profitableFusionsOnly = e.target.checked;
    renderTable();
  });

  /* Fusion help panel toggle */
  $("#fusion-help-toggle")?.addEventListener("click", () => {
    const btn = $("#fusion-help-toggle");
    const pnl = $("#fusion-help-panel");
    const isHidden = pnl.hasAttribute("hidden");
    if (isHidden) {
      pnl.removeAttribute("hidden");
      btn.classList.add("active");
    } else {
      pnl.setAttribute("hidden", "");
      btn.classList.remove("active");
    }
  });

  /* Refresh */
  $("#refresh-btn").addEventListener("click", () => loadData(true));

  /* Settings panel */
  const settingsPanel = $("#settings-panel");
  const setPanelOpen = (open) => {
    settingsPanel.classList.toggle("open", open);
    settingsPanel.setAttribute("aria-hidden", open ? "false" : "true");
  };
  $("#settings-toggle").addEventListener("click", () => {
    setPanelOpen(!settingsPanel.classList.contains("open"));
  });
  $("#close-settings").addEventListener("click", () => setPanelOpen(false));

  const apiKeyInput = $("#api-key-input");
  apiKeyInput.value = localStorage.getItem(CONFIG.API_KEY_STORAGE) || "";
  $("#save-api-key").addEventListener("click", () => {
    const v = apiKeyInput.value.trim();
    if (v) localStorage.setItem(CONFIG.API_KEY_STORAGE, v);
    else   localStorage.removeItem(CONFIG.API_KEY_STORAGE);
    flashStatus("API key saved.");
  });
  $("#clear-api-key").addEventListener("click", () => {
    localStorage.removeItem(CONFIG.API_KEY_STORAGE);
    apiKeyInput.value = "";
    flashStatus("API key cleared.");
  });

  /* Tax */
  const taxSelect = $("#tax-select");
  taxSelect.value = String(state.tax);
  taxSelect.addEventListener("change", () => {
    state.tax = parseFloat(taxSelect.value);
    localStorage.setItem(CONFIG.TAX_STORAGE, String(state.tax));
    if (state.raw) state.rows = buildRows(state.raw);
    renderTable();
  });

  /* Texture pack */
  populateTexturePackSelect();
  $("#texture-select")?.addEventListener("change", (e) => {
    state.texturePack = e.target.value;
    localStorage.setItem(CONFIG.TEXTURE_STORAGE, state.texturePack);
    renderTable();
    renderActiveView();
  });

  /* Click-outside to close settings. */
  document.addEventListener("click", (e) => {
    const panel = $("#settings-panel");
    const toggle = $("#settings-toggle");
    if (panel.classList.contains("open") &&
        !panel.contains(e.target) &&
        !toggle.contains(e.target)) {
      panel.classList.remove("open");
    }
  });
}

function gardenChipRows() {
  const rarities = window.GARDEN_CHIP_RARITIES || {};
  const target = rarities[state.gardenChips.targetRarity] || rarities.LEGENDARY;
  const targetLevel = Math.min(Number(state.gardenChips.targetLevel) || target.maxLevel, target.maxLevel);
  const sowdust = window.GARDEN_CHIP_CUMULATIVE_SOWDUST || [];

  return (window.GARDEN_CHIPS || []).map((chip) => {
    const product = state.raw?.products?.[chip.id];
    const quick = product?.quick_status || {};
    const buyPrice = Number(quick.buyPrice);
    const sellPrice = Number(quick.sellPrice);
    const copies = target?.copies || 16;
    const progress = gardenChipProgress(chip.id, target);
    const ownedCopyCount = progress.ownedCopies + progress.spareCopies;
    const remainingCopies = Math.max(0, copies - ownedCopyCount);
    const copyCost = Number.isFinite(buyPrice) ? buyPrice * remainingCopies : null;
    const legendaryCost = Number.isFinite(buyPrice) ? buyPrice * (rarities.LEGENDARY?.copies || 16) : null;
    const currentSowdust = progress.ownedCopies > 0 ? (sowdust[progress.currentLevel] || 0) : 0;
    const sowdustToTarget = Math.max(0, (sowdust[targetLevel] || 0) - currentSowdust);
    return {
      ...chip,
      targetRarity: target,
      targetLevel,
      progress,
      copies,
      ownedCopyCount,
      remainingCopies,
      copyCost,
      legendaryCost,
      buyPrice,
      sellPrice,
      spread: Number.isFinite(buyPrice) && Number.isFinite(sellPrice) ? buyPrice - sellPrice : null,
      weeklyVolume: (quick.buyMovingWeek || 0) + (quick.sellMovingWeek || 0),
      sowdustToTarget,
      command: `/bz ${chip.name}`,
    };
  });
}

function gardenChipRarityEntries() {
  return Object.entries(window.GARDEN_CHIP_RARITIES || {});
}

function gardenChipProgress(chipId, target) {
  const rarities = window.GARDEN_CHIP_RARITIES || {};
  const raw = state.gardenChips.progress?.[chipId] || {};
  const rarityKey = rarities[raw.rarity] ? raw.rarity : "NONE";
  const rarity = rarities[rarityKey];
  const ownedCopies = rarity?.copies || 0;
  const maxLevel = rarity?.maxLevel || 0;
  const targetMax = target?.maxLevel || 20;
  const currentLevel = ownedCopies > 0
    ? Math.min(Math.max(1, Number(raw.level) || 1), Math.min(maxLevel, targetMax))
    : 0;
  const spareCopies = Math.min(99, Math.max(0, Math.floor(Number(raw.spareCopies) || 0)));
  return { rarityKey, rarity, ownedCopies, currentLevel, spareCopies };
}

function saveGardenChipProgress() {
  localStorage.setItem(CONFIG.GARDEN_CHIP_PROGRESS_STORAGE, JSON.stringify(state.gardenChips.progress || {}));
}

function sortGardenChipRows(rows) {
  const key = state.gardenChips.sortKey;
  const byText = (a, b, prop) => String(a[prop] || "").localeCompare(String(b[prop] || ""));
  const byNum = (a, b, prop) => {
    const av = Number.isFinite(a[prop]) ? a[prop] : Infinity;
    const bv = Number.isFinite(b[prop]) ? b[prop] : Infinity;
    return av - bv;
  };
  return rows.slice().sort((a, b) => {
    if (key === "price") return byNum(a, b, "buyPrice") || byText(a, b, "name");
    if (key === "volume") return byNum(b, a, "weeklyVolume") || byText(a, b, "name");
    if (key === "source") return byText(a, b, "sourceType") || byText(a, b, "name");
    if (key === "name") return byText(a, b, "name");
    return byNum(a, b, "copyCost") || byNum(a, b, "remainingCopies") || byText(a, b, "name");
  });
}

function renderHomeView() {
  const pane = $("#view-home");
  if (!pane) return;

  const shardsCount = state.rows ? state.rows.length : 189;

  let mpBadge = "Link Profile";
  if (state.player && state.player.accessoryAnalysis) {
    mpBadge = `${state.player.accessoryAnalysis.currentMP} MP`;
  }

  let cheapestUpgradeStr = "Track upgrades";
  if (typeof MINIONS_DATA !== "undefined" && state.raw?.products) {
    const list = MINIONS_DATA.map((minion) => {
      const profileTier = state.player?.craftedMinions?.[minion.id] || 0;
      const manualTier = state.minionManualTiers[minion.id];
      const currentTier = manualTier !== undefined ? manualTier : profileTier;
      const startFromLvl1 = state.minionStartFromLvl1;
      const maxTier = minion.maxTier || 11;
      const nextTier = startFromLvl1 ? 1 : Math.min(maxTier, currentTier + 1);
      const isMaxed = !startFromLvl1 && currentTier >= maxTier;
      let totalCost = null;
      if (!isMaxed) {
        const upgrade = calculateUpgradeCost(minion, startFromLvl1 ? 0 : currentTier, nextTier, state.raw?.products, state.bazaarMode);
        totalCost = upgrade.totalCost;
      }
      return { minion, isMaxed, totalCost, nextTier };
    });
    const cheapest = list.find((x) => !x.isMaxed && Number.isFinite(x.totalCost));
    if (cheapest) {
      cheapestUpgradeStr = `${cheapest.minion.name} T${cheapest.nextTier}`;
    }
  }

  pane.innerHTML = `
    <div class="home-hero">
      <h2 class="home-title">Welcome to Hypixie</h2>
      <p class="home-subtitle">The ultimate companion dashboard for Hypixel SkyBlock optimization. Calculate live bazaar flips, plan accessory Magical Power paths, optimize attributes, track Sweep efficiency, and max out minions.</p>
    </div>

    <div class="home-grid">
      <article class="home-card" data-go="shards">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(255, 179, 71, 0.1);">${homeIconHTML("ANVIL", "Shard Market")}</div>
          <span class="home-card-badge">${shardsCount} Shards</span>
        </div>
        <h3 class="home-card-title">Shard Market</h3>
        <p class="home-card-desc">Compare live bazaar order-flip margins, bid/ask spreads, weekly volumes, and profitable Attribute Shard fusions.</p>
        <button class="btn-secondary btn-small home-card-btn">Open Shard Market →</button>
      </article>

      <article class="home-card" data-go="missing">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(90, 185, 255, 0.1);">${homeIconHTML("DAY_CRYSTAL", "Accessory Path")}</div>
          <span class="home-card-badge">${mpBadge}</span>
        </div>
        <h3 class="home-card-title">Accessory Path</h3>
        <p class="home-card-desc">Scan your talisman bag to rank missing accessories, family upgrades, and recombobulators by coin cost per MP gain.</p>
        <button class="btn-secondary btn-small home-card-btn">Open Accessory Path →</button>
      </article>

      <article class="home-card" data-go="attributes">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(255, 51, 51, 0.1);">${homeIconHTML("DIAMOND_SWORD", "Attributes")}</div>
          <span class="home-card-badge">Attributes</span>
        </div>
        <h3 class="home-card-title">Attributes</h3>
        <p class="home-card-desc">Calculate the exact Attribute Shards remaining and total bazaar cost to take your attributes up to Tier 10.</p>
        <button class="btn-secondary btn-small home-card-btn">Open Attributes →</button>
      </article>

      <article class="home-card" data-go="sweep">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(71, 209, 71, 0.1);">${homeIconHTML("FEATHER", "Sweep")}</div>
          <span class="home-card-badge">Sweep</span>
        </div>
        <h3 class="home-card-title">Sweep Optimizer</h3>
        <p class="home-card-desc">Discover the cheapest permanent, pet, armor, tool, equipment, and enchantment Sweep sources sorted by coin efficiency.</p>
        <button class="btn-secondary btn-small home-card-btn">Open Sweep Optimizer →</button>
      </article>

      <article class="home-card" data-go="minions">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(51, 204, 255, 0.1);">${homeIconHTML("COBBLESTONE_GENERATOR_1", "Minions")}</div>
          <span class="home-card-badge">${cheapestUpgradeStr}</span>
        </div>
        <h3 class="home-card-title">Minion Calculator</h3>
        <p class="home-card-desc">Identify the cheapest slots and copy smart, consolidated bazaar shopping lists to max your minions to T11.</p>
        <button class="btn-secondary btn-small home-card-btn">Open Minion Calculator →</button>
      </article>

      <article class="home-card" data-go="mutations">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(170, 0, 170, 0.12);">${homeIconHTML("VINE", "Mutations")}</div>
          <span class="home-card-badge">40 Mutations</span>
        </div>
        <h3 class="home-card-title">Mutations</h3>
        <p class="home-card-desc">Track SkyBlock Mutation collection progress, calculate recipe requirements, plan Greenhouse slots, and rank mutation profit.</p>
        <button class="btn-secondary btn-small home-card-btn">Open Mutations →</button>
      </article>

      <article class="home-card" data-go="garden-chips">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(85, 255, 255, 0.1);">${homeIconHTML("GREEN_THUMB_1", "Garden Chips")}</div>
          <span class="home-card-badge">10 Chips</span>
        </div>
        <h3 class="home-card-title">Garden Chips</h3>
        <p class="home-card-desc">Plan Garden Chip rarity copies and Sowdust levels with live Bazaar prices, source notes, and one-click /bz commands.</p>
        <button class="btn-secondary btn-small home-card-btn">Open Garden Chips →</button>
      </article>

      <article class="home-card" data-go="farming">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(71, 209, 71, 0.1);">${homeIconHTML("WHEAT", "Farming")}</div>
          <span class="home-card-badge">Elite-style</span>
        </div>
        <h3 class="home-card-title">Farming</h3>
        <p class="home-card-desc">Farming Weight, crop collections, Farming Fortune, Garden stats, Pest bestiary, and crop-rate estimates inspired by EliteFarmers.</p>
        <button class="btn-secondary btn-small home-card-btn">Open Farming →</button>
      </article>

      <article class="home-card" data-go="profile">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(230, 138, 0, 0.1);">${homeIconHTML("SKYBLOCK_MENU", "Profile")}</div>
          <span class="home-card-badge">${state.player?.username ? "Active" : "Link Profile"}</span>
        </div>
        <h3 class="home-card-title">Profile Viewer</h3>
        <p class="home-card-desc">Inspect your skills, slayer boss progress, catacombs dungeon classes, and active pets in a rich, animated dashboard.</p>
        <button class="btn-secondary btn-small home-card-btn">Open Profile Viewer →</button>
      </article>

      <article class="home-card" data-go="p2w">
        <div class="home-card-header">
          <div class="home-card-icon" style="background: rgba(232, 234, 242, 0.1);">${homeIconHTML("EMERALD", "Gems")}</div>
          <span class="home-card-badge">P2W Calc</span>
        </div>
        <h3 class="home-card-title">P2W Calculator</h3>
        <p class="home-card-desc">Calculate the real-world dollar cost (USD/AUD) to buy any in-game item (like a Hyperion) by selling store-bought Booster Cookies.</p>
        <button class="btn-secondary btn-small home-card-btn">Open P2W Calculator →</button>
      </article>
    </div>
  `;

  // Bind click handlers to the home cards
  pane.querySelectorAll(".home-card").forEach((card) => {
    card.addEventListener("click", () => {
      const targetView = card.dataset.go;
      setView(targetView);
    });
  });
}


/* =========================================================================
 * FARMING VIEW — fresh EliteFarmers-inspired static rebuild
 * ======================================================================= */

function farmingSelectedProfile() {
  return state.player.profiles.find((p) => p.profile_id === state.player.selectedId)?._raw || null;
}

function farmingMember(rawProfile = farmingSelectedProfile()) {
  return rawProfile?.members?.[state.player.uuid] || null;
}

function farmingNum(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function farmingObj(...values) {
  return values.find((v) => v && typeof v === "object" && !Array.isArray(v)) || {};
}

function farmingArr(...values) {
  return values.find((v) => Array.isArray(v)) || [];
}

function farmingCompactKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function farmingCollectionMap(member) {
  return farmingObj(member?.collection, member?.player_data?.collection, member?.collections);
}

function farmingGardenData(member) {
  return farmingObj(state.player.gardenData, member?.garden, member?.garden_player_data, member?.player_data?.garden, member?.garden_data);
}

function farmingGetCollection(collections, crop) {
  const keys = [crop.id, ...(crop.aliases || []), crop.name, crop.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")];
  for (const key of keys) {
    if (collections[key] != null) return Number(collections[key]) || 0;
  }
  return 0;
}

function farmingLevelFromExp(exp, max = 60) {
  if (!Number.isFinite(exp) || exp <= 0) return 0;
  return Math.min(max, xpToLevel(exp));
}

function farmingLevelFromSteps(value, steps, overflow = false) {
  let level = 0;
  let remaining = Number(value) || 0;
  const total = remaining;
  for (const step of steps || []) {
    if (remaining >= step) {
      remaining -= step;
      level++;
    } else {
      return { level, progress: remaining, next: step, ratio: step ? remaining / step : 1, total, maxed: false };
    }
  }
  const last = (steps || []).at?.(-1) || 0;
  if (overflow && last > 0) {
    const extra = Math.floor(remaining / last);
    level += extra;
    remaining -= extra * last;
    return { level, progress: remaining, next: last, ratio: remaining / last, total, maxed: false };
  }
  return { level, progress: remaining, next: null, ratio: 1, total, maxed: true };
}

function farmingCropMilestone(collection, crop) {
  const milestones = window.HYPIXIE_CROP_MILESTONES || {};
  const steps = milestones[crop.id] || (crop.aliases || []).map((a) => milestones[a]).find(Boolean) || null;
  if (steps) return farmingLevelFromSteps(collection, steps, true);
  const divisor = crop.weightDivisor || 100000;
  return { level: Math.floor(collection / divisor), progress: collection % divisor, next: divisor, ratio: Math.min(1, (collection % divisor) / divisor), total: collection, maxed: false };
}

function farmingCropRows(member) {
  const collections = farmingCollectionMap(member);
  const crops = window.HYPIXIE_FARMING_CROPS || [];
  const baseRows = crops.map((crop) => {
    const collection = farmingGetCollection(collections, crop);
    return {
      ...crop,
      collection,
      milestone: farmingCropMilestone(collection, crop),
      rawWeight: collection / (crop.weightDivisor || 1),
    };
  });

  const totalNoMushroom = baseRows.filter((r) => !r.mushroomSpecial).reduce((sum, r) => sum + r.rawWeight, 0);
  const doubleBreakWeight = baseRows.filter((r) => r.breaks === 2).reduce((sum, r) => sum + r.rawWeight, 0);
  const doubleRatio = totalNoMushroom > 0 ? doubleBreakWeight / totalNoMushroom : 0;

  return baseRows.map((row) => {
    let weight = row.rawWeight;
    if (row.mushroomSpecial) {
      weight = doubleRatio * (row.collection / ((row.weightDivisor || 1) * 2)) + (1 - doubleRatio) * row.rawWeight;
    }
    return { ...row, weight };
  }).sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

function farmingJacobData(member) {
  const jacob = farmingObj(member?.jacob2, member?.jacob, member?.events?.jacob);
  const contests = Object.values(jacob?.contests || jacob?.participations || {}).flatMap((entry) => Array.isArray(entry) ? entry : [entry]).filter(Boolean);
  const medalsInv = farmingObj(jacob?.medals_inv, jacob?.medals, jacob?.perks?.medals);
  const earned = { diamond: 0, platinum: 0, gold: 0, silver: 0, bronze: 0 };

  for (const medal of Object.keys(earned)) {
    earned[medal] += farmingNum(medalsInv[medal], medalsInv[medal.toUpperCase()]);
  }
  for (const contest of contests) {
    const medal = String(contest?.claimed_medal || contest?.medal || "").toLowerCase();
    if (earned[medal] != null) earned[medal]++;
  }

  const perks = farmingObj(jacob?.perks, jacob?.upgrades);
  const personalBestByCrop = {};
  for (const contest of contests) {
    const crop = contest?.crop || contest?.crop_id || contest?.cropId;
    const score = farmingNum(contest?.collected, contest?.score, contest?.amount);
    if (crop) personalBestByCrop[crop] = Math.max(personalBestByCrop[crop] || 0, score);
  }
  return {
    raw: jacob,
    contests,
    medals: earned,
    personalBestByCrop,
    anitaBonus: farmingNum(perks.farming_level_cap, perks.double_drops, perks.farming_fortune, perks.anita_bonus_farming_fortune, jacob?.anita_bonus_farming_fortune),
  };
}

function farmingTier12MinionCount(member) {
  const crafted = member?.player_data?.crafted_generators || [];
  const allowed = window.HYPIXIE_FARMING_TIER12_MINIONS || new Set();
  let count = 0;
  for (const id of crafted) if (allowed.has(id)) count++;
  if (!count && state.player.craftedMinions) {
    for (const [id, tier] of Object.entries(state.player.craftedMinions)) {
      if (Number(tier) >= 12 && /WHEAT|CARROT|POTATO|PUMPKIN|MELON|MUSHROOM|COCOA|CACTUS|SUGAR|WART|FLOWER/i.test(id)) count++;
    }
  }
  return count;
}

function farmingBestiaryKills(member) {
  const bestiary = farmingObj(member?.bestiary, member?.player_data?.bestiary);
  return farmingObj(bestiary.kills, bestiary.bestiary, bestiary);
}

function pestBracketInfo(pest, kills) {
  const brackets = pest.short ? window.HYPIXIE_PEST_SHORT_BRACKETS : (pest.mouse ? window.HYPIXIE_PEST_MOUSE_BRACKETS : window.HYPIXIE_PEST_DEFAULT_BRACKETS);
  let unlocked = 0;
  let next = null;
  for (const threshold of brackets || []) {
    if (kills >= threshold) unlocked++;
    else { next = threshold; break; }
  }
  return { unlocked, next, max: brackets?.length || 0 };
}

function farmingPestRows(member) {
  const kills = farmingBestiaryKills(member);
  return (window.HYPIXIE_PEST_BESTIARY || []).map((pest) => {
    const keys = [pest.id, ...(pest.aliases || []), pest.name, farmingCompactKey(pest.name), `pest_${farmingCompactKey(pest.name)}_1`];
    const count = farmingNum(...keys.map((key) => kills[key]));
    const bracket = pestBracketInfo(pest, count);
    return {
      ...pest,
      kills: count,
      brackets: bracket.unlocked,
      next: bracket.next,
      max: bracket.max,
      fortune: bracket.unlocked * (window.HYPIXIE_PEST_FORTUNE_PER_BRACKET || 0.4),
    };
  }).sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name));
}

function farmingWeightSummary(member) {
  const rows = farmingCropRows(member);
  const jacob = farmingJacobData(member);
  const bonus = window.HYPIXIE_FARMING_BONUS_WEIGHT || {};
  const exp = farmingNum(member?.player_data?.experience?.SKILL_FARMING, member?.experience?.SKILL_FARMING);
  const level = farmingLevelFromExp(exp, 60);
  const minionCount = farmingTier12MinionCount(member);
  const cropWeight = rows.reduce((sum, r) => sum + r.weight, 0);
  const medalCap = bonus.maxMedalsCounted || 1000;
  const medalWeight = Math.min(medalCap, jacob.medals.diamond) * (bonus.diamondMedal || 0.75)
    + Math.min(Math.max(0, medalCap - jacob.medals.diamond), jacob.medals.platinum) * (bonus.platinumMedal || 0.5)
    + Math.min(Math.max(0, medalCap - jacob.medals.diamond - jacob.medals.platinum), jacob.medals.gold) * (bonus.goldMedal || 0.25);
  const levelWeight = exp >= 111672425 ? (bonus.farming60 || 250) : (exp >= 55172425 ? (bonus.farming50 || 100) : 0);
  const minionWeight = minionCount * (bonus.tier12Minion || 5);
  const anitaWeight = jacob.anitaBonus * (bonus.anitaPerLevel || 2);
  const bonusSources = {
    "Farming level bonus": levelWeight,
    "Jacob medal bonus": medalWeight,
    "Tier XII farming minions": minionWeight,
    "Anita bonus": anitaWeight,
  };
  const bonusWeight = Object.values(bonusSources).reduce((sum, n) => sum + n, 0);
  return { rows, exp, level, cropWeight, bonusWeight, bonusSources, totalWeight: cropWeight + bonusWeight, jacob, minionCount };
}

function farmingUnlockedPlotIds(garden) {
  const candidates = [garden.unlocked_plots_ids, garden.unlocked_plots, garden.plots, garden.plot_unlocked, garden.unlockedPlots, garden.garden_upgrades?.unlocked_plots_ids];
  for (const value of candidates) {
    if (Array.isArray(value)) return value.map((id) => String(id));
    if (value && typeof value === "object") {
      return Object.entries(value)
        .filter(([, v]) => v !== false && v !== 0 && v !== "false" && v != null)
        .map(([id]) => String(id));
    }
  }
  if (garden.farming_toolkit?.IS_UNLOCKED === true || garden.IS_UNLOCKED === true) return ["garden_unlocked_exact_plots_not_exposed"];
  return [];
}

function farmingVisitorStat(visitor, ...keys) {
  if (visitor && typeof visitor === "object") return farmingNum(...keys.map((key) => visitor[key]));
  return farmingNum(visitor);
}

function farmingVisitorCatalog() {
  return window.HYPIXIE_GARDEN_VISITORS || [];
}

function farmingVisitorName(id) {
  return farmingVisitorCatalog().find((v) => v.id === id)?.name || String(id || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function farmingRarityRank(rarity) {
  return { UNKNOWN: 0, COMMON: 1, UNCOMMON: 2, RARE: 3, EPIC: 4, LEGENDARY: 5, MYTHIC: 6, SPECIAL: 7, VERY_SPECIAL: 8 }[String(rarity || "UNKNOWN").toUpperCase()] || 0;
}

function farmingNormalizeGardenVisitors(garden) {
  const commission = farmingObj(garden?.commission_data, garden?.commissionData);
  const visitsMap = farmingObj(commission.visits, garden?.visitor_visits, garden?.visits);
  const completedMap = farmingObj(commission.completed, garden?.completed, garden?.visitor_completed);
  const normalizedMap = farmingObj(garden?.visitors, garden?.visitor_stats);
  const activeMap = farmingObj(garden?.active_commissions, garden?.current_visitors, garden?.currentVisitors);
  const ids = new Set([...Object.keys(visitsMap), ...Object.keys(completedMap), ...Object.keys(normalizedMap)]);
  const rows = [];

  for (const id of ids) {
    const source = normalizedMap[id];
    const rawVisits = source && typeof source === "object"
      ? farmingVisitorStat(source, "visits", "seen", "total", "count")
      : farmingNum(visitsMap[id], source);
    const active = Object.prototype.hasOwnProperty.call(activeMap, id);
    const visits = Math.max(0, rawVisits - (active ? 1 : 0));
    const accepted = source && typeof source === "object"
      ? farmingVisitorStat(source, "accepted", "completed", "offers_accepted")
      : farmingNum(completedMap[id]);
    if (visits > 0 || accepted > 0 || active) {
      const meta = farmingVisitorCatalog().find((v) => v.id === id) || {};
      rows.push({ id, name: meta.name || farmingVisitorName(id), rarity: meta.rarity || "UNKNOWN", wiki: meta.wiki || "", visits, accepted, active });
    }
  }

  const totalAccepted = farmingNum(commission.total_completed, garden?.completedVisitors, garden?.completed_visitors, rows.reduce((sum, v) => sum + v.accepted, 0));
  const uniqueServed = farmingNum(commission.unique_npcs_served, garden?.uniqueVisitors, garden?.unique_visitors, rows.filter((v) => v.accepted > 0).length);
  const totalVisits = farmingNum(garden?.totalVisitors, garden?.total_visitors, rows.reduce((sum, v) => sum + v.visits, 0));
  const missing = farmingVisitorCatalog()
    .filter((meta) => !(rows.find((row) => row.id === meta.id)?.accepted > 0))
    .sort((a, b) => farmingRarityRank(b.rarity) - farmingRarityRank(a.rarity) || a.name.localeCompare(b.name));

  rows.sort((a, b) => farmingRarityRank(b.rarity) - farmingRarityRank(a.rarity) || b.accepted - a.accepted || b.visits - a.visits || a.name.localeCompare(b.name));
  return {
    totalVisits,
    accepted: totalAccepted,
    rejected: Math.max(0, totalVisits - totalAccepted),
    acceptanceRate: totalVisits > 0 ? totalAccepted / totalVisits * 100 : 0,
    count: uniqueServed,
    rows,
    completed: rows.filter((row) => row.accepted > 0),
    top: rows.filter((row) => row.accepted > 0),
    missing,
    missingCount: missing.length,
    source: Object.keys(commission).length ? "Hypixel Garden commission_data" : (Object.keys(normalizedMap).length ? "normalized visitor map" : "profile fallback"),
  };
}

function farmingVisitorPill(visitor, kind = "seen") {
  const cls = kind === "missing" ? " missing" : (visitor.active ? " active" : "");
  const count = kind === "missing" ? visitor.rarity : `${fmtInt(visitor.accepted)} accepted · ${fmtInt(visitor.visits)} visits`;
  const label = `<strong>${escapeHtml(visitor.name || farmingVisitorName(visitor.id))}</strong><small>${escapeHtml(String(count))}</small>`;
  if (visitor.wiki) return `<a class="farm-visitor-pill${cls}" href="${escapeHtml(visitor.wiki)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  return `<span class="farm-visitor-pill${cls}">${label}</span>`;
}

function farmingGardenSummary(member) {
  const garden = farmingGardenData(member);
  const exp = farmingNum(garden.experience, garden.garden_exp, garden.garden_experience);
  const level = farmingLevelFromSteps(exp, window.HYPIXIE_GARDEN_EXP_REQUIRED || [], true);
  const cropUpgrades = farmingObj(garden.crop_upgrades, garden.crop_upgrade_levels, garden.upgrades, garden.cropUpgrades);
  const cropUpgradeRows = (window.HYPIXIE_FARMING_CROPS || []).map((crop) => {
    const keys = [crop.id, ...(crop.aliases || []), farmingCompactKey(crop.name), crop.name];
    return { crop, level: farmingNum(...keys.map((k) => cropUpgrades[k])) };
  });
  const unlockedPlots = farmingUnlockedPlotIds(garden);
  const visitorSummary = farmingNormalizeGardenVisitors(garden);
  return {
    raw: garden,
    exp,
    level,
    cropUpgrades,
    cropUpgradeRows,
    avgCropUpgrade: cropUpgradeRows.length ? cropUpgradeRows.reduce((s, r) => s + r.level, 0) / cropUpgradeRows.length : 0,
    unlockedPlots,
    copper: farmingNum(garden.copper, member?.currencies?.copper, member?.unparsed?.copper, garden.resources?.copper),
    compost: farmingNum(garden.compost, garden.composter?.compost, garden.resources?.compost),
    organicMatter: farmingNum(garden.organic_matter, garden.composter?.organic_matter),
    fuel: farmingNum(garden.fuel, garden.composter?.fuel_units, garden.composter?.fuel),
    dnaMilestone: farmingNum(garden.dnaMilestone, garden.dna_milestone, member?.unparsed?.dnaMilestone),
    visitors: visitorSummary,
  };
}

function farmingPlotMatchesCell(id, index) {
  const raw = String(id || "").toLowerCase();
  if (raw === "garden_unlocked_exact_plots_not_exposed") return index === 12;
  const compact = raw.replace(/[^a-z0-9]/g, "");

  /* Standalone Garden endpoint IDs are tiered names such as beginner_1,
   * intermediate_4, and advanced_9. Map them into the 25-cell visual grid
   * as 5 beginner, 8 intermediate, then 12 advanced cells. */
  const tiered = raw.match(/^(beginner|intermediate|advanced)[_-]?(\d+)$/);
  if (tiered) {
    const offsets = { beginner: 0, intermediate: 5, advanced: 13 };
    const cell = offsets[tiered[1]] + Number(tiered[2]) - 1;
    return index === cell;
  }

  const n0 = String(index);
  const n1 = String(index + 1);
  return raw === n0 || raw === n1 || compact === `plot${n0}` || compact === `plot${n1}` || compact.endsWith(`plot${n0}`) || compact.endsWith(`plot${n1}`);
}

function farmingPct(value, max) {
  if (!Number.isFinite(Number(max)) || Number(max) <= 0) return 0;
  return Math.max(0, Math.min(100, (Number(value) || 0) / Number(max) * 100));
}

function farmingMiniBar(value, max, label = "") {
  const pct = farmingPct(value, max);
  const text = label || `${fmtInt(value)} / ${fmtInt(max)}`;
  return `<div class="farm-progress"><span style="width:${pct.toFixed(2)}%"></span><strong>${escapeHtml(text)}</strong></div>`;
}

function farmingMetric(label, value, hint = "") {
  return `<div class="farm-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</div>`;
}

function farmingPlotGridHTML(unlockedPlots) {
  const ids = (unlockedPlots || []).map((id) => String(id));
  const hasUnknownUnlocked = ids.includes("garden_unlocked_exact_plots_not_exposed");
  const cells = Array.from({ length: 25 }, (_, i) => {
    const matched = ids.find((id) => farmingPlotMatchesCell(id, i));
    const numericMatch = ids.some((id) => /^\d+$/.test(id) && (Number(id) === i || Number(id) === i + 1));
    const isUnlocked = Boolean(matched) || numericMatch;
    return `<span class="${isUnlocked ? "on" : ""}" title="Plot ${i + 1}: ${isUnlocked ? "unlocked" : "not detected"}" aria-label="Plot ${i + 1}: ${isUnlocked ? "unlocked" : "not detected"}"></span>`;
  }).join("");
  const note = hasUnknownUnlocked ? "Garden unlocked; exact plot IDs not exposed." : `${fmtInt(ids.length)} unlocked plots detected`;
  return `<div class="farm-plot-grid">${cells}</div><p class="farm-note">${escapeHtml(note)}</p>`;
}

function farmingFortuneSummary(member, weight, garden, pests) {
  const farmingLevel = weight.level;
  const pestFortune = pests.reduce((sum, p) => sum + p.fortune, 0);
  const cropUpgradeFortune = garden.avgCropUpgrade * 5;
  const anitaFortune = weight.jacob.anitaBonus * 4;
  const base = farmingLevel * 4;
  const visibleGear = [state.player.equippedArmor, state.player.equippedEquipment, state.player.hotbar].flat().filter(Boolean);
  const gearHints = visibleGear.filter((it) => /FERMENTO|SQUASH|CROPIE|RANCHER|LOTUS|DICER|THEORETICAL|FUNGI|CACTUS_KNIFE|COCO_CHOPPER|HOOVER|VACUUM/i.test(it.skyblockId || it.displayName || ""));
  const estimated = base + cropUpgradeFortune + anitaFortune + pestFortune;
  return {
    estimated,
    sources: [
      { name: "Farming level", category: "General", current: base, max: 240, next: farmingLevel < 60 ? `Level ${farmingLevel + 1}` : "Maxed", confidence: "profile" },
      { name: "Crop upgrades", category: "Garden", current: cropUpgradeFortune, max: 50, next: "Upgrade low crops at Garden Desk", confidence: "profile/estimate" },
      { name: "Anita bonus", category: "Jacob", current: anitaFortune, max: 60, next: "Spend medals/tickets with Anita", confidence: "profile/estimate" },
      { name: "Pest bestiary", category: "Pests", current: pestFortune, max: (pests.reduce((s, p) => s + (p.max || 15), 0)) * 0.4, next: "Kill pests to next brackets", confidence: "profile" },
      { name: "Detected farming gear", category: "Gear", current: gearHints.length, max: null, next: gearHints.length ? gearHints.map((it) => it.displayName || it.skyblockId).slice(0, 4).join(", ") : "Enable inventory API / equip farming gear", confidence: "detected items" },
    ],
  };
}

function farmingRateRows(cropRows, fortune) {
  return cropRows.map((crop) => {
    const multiplier = 1 + Math.max(0, fortune.estimated) / 100;
    const blocks = crop.baseBreaksPerMinute || 1180;
    const itemsPerMinute = blocks * (crop.drops || 1) * multiplier;
    const coinsPerHourNpc = itemsPerMinute * (crop.npc || 0) * 60;
    const collectionPerHour = blocks * (crop.drops || 1) * 60;
    return { ...crop, multiplier, blocks, itemsPerMinute, coinsPerHourNpc, collectionPerHour };
  }).sort((a, b) => b.coinsPerHourNpc - a.coinsPerHourNpc || a.name.localeCompare(b.name));
}

function farmingUpgradeRows(weight, garden, pests, selectedCrop) {
  const lowestCrop = weight.rows.slice().sort((a, b) => a.milestone.level - b.milestone.level || a.collection - b.collection)[0];
  const weakestPest = pests.slice().sort((a, b) => a.brackets - b.brackets || a.kills - b.kills)[0];
  const selectedUpgrade = garden.cropUpgradeRows.find((r) => r.crop.id === selectedCrop?.id);
  return [
    { title: "Push Farming level", detail: `Current Farming ${weight.level}. Every level is roughly +4 Farming Fortune.`, status: weight.level >= 60 ? "Maxed" : `Next: Farming ${weight.level + 1}`, category: "General" },
    { title: "Balance crop milestones", detail: lowestCrop ? `${lowestCrop.name} milestone ${lowestCrop.milestone.level}; collection ${fmtInt(lowestCrop.collection)}.` : "No crop collections found.", status: lowestCrop ? "Lowest crop" : "Needs profile", category: "Garden" },
    { title: `${selectedCrop?.name || "Selected crop"} upgrade`, detail: selectedUpgrade ? `Garden Desk crop upgrade ${fmtInt(selectedUpgrade.level)} / 10.` : "No selected crop upgrade detected.", status: selectedUpgrade?.level >= 10 ? "Maxed" : "Upgrade at Desk", category: "Crop" },
    { title: "Unlock Garden plots", detail: `${garden.unlockedPlots.length || 0} visible unlocked plots.`, status: garden.unlockedPlots.length >= 24 ? "Maxed" : "Unlock more plots", category: "Garden" },
    { title: "Pest bestiary", detail: weakestPest ? `${weakestPest.name}: ${fmtInt(weakestPest.kills)} kills, ${weakestPest.brackets}/${weakestPest.max} brackets.` : "No pest data found.", status: weakestPest?.next ? `Next at ${fmtInt(weakestPest.next)} kills` : "Review pests", category: "Pests" },
    { title: "Garden Chips", detail: "Use Hypixie's Garden Chips tab for copy costs, level targets, and Sowdust planning.", status: "Open Garden Chips", category: "Chips" },
  ];
}

async function loadEliteContestSummary(force = false) {
  if (!force && (state.eliteContest?.loading || state.eliteContest?.data || state.eliteContest?.error)) return;
  state.eliteContest = { loading: true, data: null, error: null, fetchedAt: null };
  if (state.view === "farming") renderFarmingView();
  try {
    const res = await fetch(`${CONFIG.API_BASE}${CONFIG.ELITE_CONTEST_ENDPOINT}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Elite contest proxy returned HTTP ${res.status}`);
    state.eliteContest = { loading: false, data: await res.json(), error: null, fetchedAt: Date.now() };
  } catch (e) {
    state.eliteContest = { loading: false, data: null, error: e.message || String(e), fetchedAt: Date.now() };
  }
  if (state.view === "farming") renderFarmingView();
}

const FARMING_TABS = [
  { id: "stats", label: "Stats" },
  { id: "garden", label: "Garden" },
  { id: "fortune", label: "Fortune" },
  { id: "pests", label: "Pest Farming" },
  { id: "rates", label: "Rates" },
  { id: "ranks", label: "Ranks" },
];

function farmingTabPanelClass(tabId) {
  return `farm-panel${state.farmingActiveTab === tabId ? " active" : ""}`;
}

function farmingHeroHTML(weight, garden, fortune) {
  const profileName = state.player.profiles.find((p) => p.profile_id === state.player.selectedId)?.cute_name || "Selected profile";
  const player = state.player.username || "Linked player";
  return `
    <section class="farm-hero" aria-label="Farming profile summary">
      <div class="farm-avatar-wrap">
        <img class="farm-avatar" src="https://mc-heads.net/head/${encodeURIComponent(state.player.uuid || player)}/96" alt="${escapeHtml(player)} head" loading="lazy">
        <span>Elite-style</span>
      </div>
      <div class="farm-hero-main">
        <p class="farm-eyebrow">Hypixie Farming</p>
        <h2>${escapeHtml(player)} <small>· ${escapeHtml(profileName)}</small></h2>
        <div class="farm-weight">${weight.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 3 })}</div>
        <p class="farm-note">Farming Weight rebuilt from profile-visible collections, Jacob data, tier-XII minions, and EliteFarmers/FarmingWeight constants.</p>
      </div>
      <div class="farm-hero-stats">
        ${farmingMetric("Farming", fmtInt(weight.level), `${fmtInt(weight.exp)} XP`)}
        ${farmingMetric("Garden", fmtInt(garden.level.level), garden.level.next ? `${fmtInt(garden.level.progress)} / ${fmtInt(garden.level.next)}` : "overflow")}
        ${farmingMetric("Fortune est.", fmtInt(fortune.estimated), "visible sources")}
        ${farmingMetric("Crops", fmtInt(weight.rows.length), "tracked")}
      </div>
    </section>
    <nav class="farm-tabs" aria-label="Farming sections" role="tablist">
      ${FARMING_TABS.map((tab) => `<button id="farm-tab-${tab.id}" class="farm-tab${state.farmingActiveTab === tab.id ? " active" : ""}" type="button" role="tab" aria-selected="${state.farmingActiveTab === tab.id ? "true" : "false"}" aria-controls="farm-${tab.id}" data-farming-tab="${tab.id}">${escapeHtml(tab.label)}</button>`).join("")}
    </nav>`;
}

function farmingCropIconRail(rows, activeId = null) {
  return `<div class="farm-crop-rail" aria-label="Farming crops">
    ${rows.map((r) => `<button class="farm-crop-btn ${activeId === r.id ? "active" : ""}" type="button" title="${escapeHtml(r.name)}" aria-label="Show ${escapeHtml(r.name)} farming details" aria-pressed="${activeId === r.id ? "true" : "false"}" data-farming-crop="${escapeHtml(r.id)}">
      <img src="${getUniversalItemIconUrl(r.icon)}" alt="${escapeHtml(r.name)}" loading="lazy" onerror="${fallbackToSkyCryptItemOnError(r.icon)}">
      <span>${escapeHtml(r.name)}</span>
    </button>`).join("")}
  </div>`;
}

function farmingSelectedCrop(weight) {
  if (!weight?.rows?.length) return null;
  const selected = weight.rows.find((row) => row.id === state.farmingSelectedCropId);
  if (selected) return selected;
  state.farmingSelectedCropId = weight.rows[0]?.id || null;
  return weight.rows[0] || null;
}

function renderEliteContestCard() {
  const c = state.eliteContest;
  if (!c) {
    setTimeout(() => loadEliteContestSummary(false), 0);
    return `<article class="farm-card farm-card-wide" id="elite-contests"><h3>Current Jacob Contest</h3><div class="acc-loading"><span class="spinner"></span> Loading Elite contest summary…</div></article>`;
  }
  if (c.loading) return `<article class="farm-card farm-card-wide" id="elite-contests"><h3>Current Jacob Contest</h3><div class="acc-loading"><span class="spinner"></span> Loading Elite contest summary…</div></article>`;
  if (c.error) {
    return `<article class="farm-card farm-card-wide" id="elite-contests"><h3>Current Jacob Contest</h3><p class="farm-note">Hypixie could not load the Elite contest proxy (${escapeHtml(c.error)}). This can require a Worker redeploy or CORS proxy availability.</p><button class="btn-secondary btn-small" id="farming-retry-contest">Retry</button></article>`;
  }
  const contests = c.data?.contests || {};
  const rows = Object.entries(contests).flatMap(([ts, crops]) => (crops || []).map((crop) => ({ ts: Number(ts) * 1000, crop })));
  return `<article class="farm-card farm-card-wide" id="elite-contests"><h3>Current Jacob Contest</h3><div class="farm-pill-list">${rows.length ? rows.map((r) => `<span class="farm-pill">${escapeHtml(r.crop)} <small>${new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></span>`).join("") : "No active contest listed."}</div><button class="btn-secondary btn-small" id="farming-retry-contest">Refresh</button></article>`;
}

function renderFarmingView() {
  const pane = $("#view-farming");
  if (!pane) return;
  if (!window.HYPIXIE_FARMING_CROPS) {
    pane.innerHTML = `<div class="acc-loading">Farming data is not loaded.</div>`;
    return;
  }

  const rawProfile = farmingSelectedProfile();
  const member = farmingMember(rawProfile);
  if (!member) {
    pane.innerHTML = `<div class="farm-shell"><div class="acc-gate"><div class="acc-gate-icon">${gateIconHTML("WHEAT", "Farming")}</div><h2>Link your account first</h2><p>The Farming tab uses your selected SkyBlock profile for collections, Garden, Jacob, pests, inventory hints, and weight math. Enter a Minecraft username above, then choose a profile.</p></div></div>`;
    return;
  }

  const weight = farmingWeightSummary(member);
  const garden = farmingGardenSummary(member);
  const pests = farmingPestRows(member);
  const fortune = farmingFortuneSummary(member, weight, garden, pests);
  const selectedCrop = farmingSelectedCrop(weight);
  const rates = farmingRateRows(weight.rows, fortune);
  const selectedRate = rates.find((r) => r.id === selectedCrop?.id) || rates[0] || null;
  const ratesForDisplay = selectedRate ? [selectedRate, ...rates.filter((r) => r.id !== selectedRate.id)] : rates;
  const upgrades = farmingUpgradeRows(weight, garden, pests, selectedCrop);
  const cropRows = weight.rows;
  const cropMaxWeight = Math.max(1, ...cropRows.map((r) => r.weight));
  const cropMaxCollection = Math.max(1, ...cropRows.map((r) => r.collection));
  const fortuneTotal = Math.max(1, fortune.sources.reduce((sum, s) => sum + (Number(s.current) || 0), 0));
  const profileName = state.player.profiles.find((p) => p.profile_id === state.player.selectedId)?.cute_name || "Profile";
  const sourceMatrix = window.HYPIXIE_FARMING_SOURCE_MATRIX || [];
  if (!FARMING_TABS.some((tab) => tab.id === state.farmingActiveTab)) state.farmingActiveTab = "stats";

  pane.innerHTML = `
    <div class="farm-shell">
      ${farmingHeroHTML(weight, garden, fortune)}
      ${farmingCropIconRail(cropRows, selectedCrop?.id)}

      <section class="${farmingTabPanelClass("stats")}" id="farm-stats" role="tabpanel" aria-labelledby="farm-tab-stats" ${state.farmingActiveTab === "stats" ? "" : "hidden"}>
        <div class="farm-grid two">
          <article class="farm-card">
            <div class="farm-card-head"><h3>Crop Weight</h3><span class="farm-badge">${weight.cropWeight.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span></div>
            ${selectedCrop ? `<div class="farm-selected"><img src="${getUniversalItemIconUrl(selectedCrop.icon)}" alt="" loading="lazy" onerror="${fallbackToSkyCryptItemOnError(selectedCrop.icon)}"><div><strong>${escapeHtml(selectedCrop.name)}</strong><span>Collection ${fmtInt(selectedCrop.collection)} · Milestone ${fmtInt(selectedCrop.milestone.level)} · ${selectedCrop.weight.toLocaleString(undefined, { maximumFractionDigits: 3 })} weight</span></div></div>` : ""}
            <div class="farm-list">
              ${cropRows.map((r) => `<div class="farm-row"><img src="${getUniversalItemIconUrl(r.icon)}" alt="" loading="lazy" onerror="${fallbackToSkyCryptItemOnError(r.icon)}"><div><strong>${escapeHtml(r.name)}</strong><span>${fmtInt(r.collection)} collection · milestone ${fmtInt(r.milestone.level)}</span></div><div>${farmingMiniBar(r.weight, cropMaxWeight, r.weight.toLocaleString(undefined, { maximumFractionDigits: 3 }))}</div></div>`).join("")}
            </div>
          </article>
          <article class="farm-card">
            <div class="farm-card-head"><h3>Bonus Weight</h3><span class="farm-badge">${weight.bonusWeight.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span></div>
            <div class="farm-metrics compact">
              ${Object.entries(weight.bonusSources).map(([name, val]) => farmingMetric(name, Number(val).toLocaleString(undefined, { maximumFractionDigits: 3 }), "EliteFarmers category")).join("")}
              ${farmingMetric("Gold+ medals", fmtInt(weight.jacob.medals.gold + weight.jacob.medals.platinum + weight.jacob.medals.diamond), "visible / estimated")}
              ${farmingMetric("Tier XII minions", fmtInt(weight.minionCount), "+5 weight each")}
            </div>
            <div class="farm-card-head sub"><h3>Rates preview</h3><span class="farm-badge">${selectedRate ? fmtCoins(selectedRate.coinsPerHourNpc) + "/h" : "—"}</span></div>
            <div class="farm-list compact">
              ${ratesForDisplay.slice(0, 5).map((r) => `<div class="farm-row ${r.id === selectedCrop?.id ? "active" : ""}"><img src="${getUniversalItemIconUrl(r.icon)}" alt="" loading="lazy" onerror="${fallbackToSkyCryptItemOnError(r.icon)}"><div><strong>${escapeHtml(r.name)}</strong><span>${fmtInt(r.itemsPerMinute)} items/min · ${fmtInt(r.blocks)} blocks/min</span></div><em>${fmtCoins(r.coinsPerHourNpc)}/h</em></div>`).join("")}
            </div>
            <p class="farm-note">Rates are static-site estimates using profile-visible fortune and Elite crop constants, not full Elite backend gear modeling.</p>
          </article>
        </div>
      </section>

      <section class="${farmingTabPanelClass("garden")}" id="farm-garden" role="tabpanel" aria-labelledby="farm-tab-garden" ${state.farmingActiveTab === "garden" ? "" : "hidden"}>
        <div class="farm-grid garden">
          <article class="farm-card farm-card-wide">
            <div class="farm-card-head"><h3>Garden ${fmtInt(garden.level.level)}</h3><span class="farm-badge green">${escapeHtml(profileName)}</span></div>
            ${farmingMiniBar(garden.level.progress || garden.exp, garden.level.next || Math.max(1, garden.exp), garden.level.next ? `${fmtInt(garden.level.progress)} / ${fmtInt(garden.level.next)}` : "Overflow / maxed")}
            <div class="farm-metrics">
              ${farmingMetric("Copper", fmtInt(garden.copper), "member-visible")}
              ${farmingMetric("DNA milestone", `${fmtInt(garden.dnaMilestone)} / 6`, "profile field")}
              ${farmingMetric("Compost", fmtInt(garden.compost), "composter")}
              ${farmingMetric("Fuel", fmtInt(garden.fuel), "composter")}
            </div>
          </article>
          <article class="farm-card"><h3>Crop Milestones</h3><div class="farm-list compact">${cropRows.slice().sort((a,b) => b.milestone.level - a.milestone.level || b.collection - a.collection).map((r) => `<div class="farm-row"><img src="${getUniversalItemIconUrl(r.icon)}" alt="" loading="lazy" onerror="${fallbackToSkyCryptItemOnError(r.icon)}"><div><strong>${escapeHtml(r.name)}</strong><span>${fmtInt(r.collection)} collected</span></div><div>${farmingMiniBar(r.collection, cropMaxCollection, `Milestone ${fmtInt(r.milestone.level)}`)}</div></div>`).join("")}</div></article>
          <article class="farm-card"><h3>Unlocked Plots</h3>${farmingPlotGridHTML(garden.unlockedPlots)}<h3>Crop Upgrades</h3><div class="farm-upgrade-mini">${garden.cropUpgradeRows.map((r) => `<span title="${escapeHtml(r.crop.name)} crop upgrade">${escapeHtml(r.crop.name)} <b>${fmtInt(r.level)}/10</b></span>`).join("")}</div></article>
          <article class="farm-card farm-card-wide"><div class="farm-card-head"><h3>Visitor Tracker</h3><span class="farm-badge">${fmtInt(garden.visitors.accepted)} accepted</span></div>${state.player.gardenLoading ? `<div class="acc-loading"><span class="spinner"></span> Loading standalone Garden visitor data…</div>` : ""}${state.player.gardenError ? `<p class="farm-note warn">Garden API fetch failed: ${escapeHtml(state.player.gardenError)}. Showing profile fallback data.</p>` : ""}<div class="farm-metrics">${farmingMetric("Unique accepted", `${fmtInt(garden.visitors.count)} / ${fmtInt(window.HYPIXIE_GARDEN_VISITOR_TOTAL || 83)}`, "commission_data.unique_npcs_served")}${farmingMetric("Missing", fmtInt(garden.visitors.missingCount), "not accepted yet")}${farmingMetric("Total visits", fmtInt(garden.visitors.totalVisits), garden.visitors.source)}${farmingMetric("Acceptance rate", `${garden.visitors.acceptanceRate.toFixed(2)}%`, "accepted / total")}</div><div class="farm-card-head sub"><h3>Missing visitors</h3><span class="farm-badge">${fmtInt(garden.visitors.missingCount)} left</span></div><div class="farm-visitor-grid missing">${garden.visitors.missing.map((v) => farmingVisitorPill(v, "missing")).join("") || `<span class="farm-note">All catalog visitors have been accepted.</span>`}</div><div class="farm-card-head sub"><h3>Completed visitors</h3><span class="farm-badge green">${fmtInt(garden.visitors.completed?.length || garden.visitors.top.length)} shown</span></div><div class="farm-visitor-grid completed">${(garden.visitors.completed || garden.visitors.top).length ? (garden.visitors.completed || garden.visitors.top).map((v) => farmingVisitorPill(v)).join("") : `<span class="farm-note">No accepted visitor map found yet.</span>`}</div><p class="farm-note">Uses the same EliteFarmers rule: accepted/missing comes from Hypixel Garden <code>commission_data.completed</code>; current active commissions are subtracted from visit totals.</p></article>
        </div>
      </section>

      <section class="${farmingTabPanelClass("fortune")}" id="farm-fortune" role="tabpanel" aria-labelledby="farm-tab-fortune" ${state.farmingActiveTab === "fortune" ? "" : "hidden"}>
        <div class="farm-grid two">
          <article class="farm-card"><div class="farm-card-head"><h3>Farming Fortune</h3><span class="farm-badge">${fmtInt(fortune.estimated)} FF</span></div><div class="farm-source-grid">${fortune.sources.map((s) => { const current = Number(s.current) || 0; const max = Number(s.max) || Math.max(fortuneTotal, current || 1); return `<div class="farm-source"><div><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.category)} · ${escapeHtml(s.confidence)}</span></div>${farmingMiniBar(current, max, `${fmtInt(current)} / ${s.max ? fmtInt(max) : "—"} FF`)}<small>${escapeHtml(s.next || "")}</small></div>`; }).join("")}</div></article>
          <article class="farm-card"><div class="farm-card-head"><h3>Available Upgrades</h3><span class="farm-badge green">Priority</span></div><div class="farm-list">${upgrades.map((u) => `<div class="farm-upgrade-row"><span>${escapeHtml(u.category)}</span><div><strong>${escapeHtml(u.title)}</strong><small>${escapeHtml(u.detail)}</small></div><em>${escapeHtml(u.status)}</em></div>`).join("")}</div></article>
          <article class="farm-card farm-card-wide"><h3>Source Matrix</h3><div class="farm-source-matrix">${sourceMatrix.map((s) => `<a href="${escapeHtml(s.wiki || "#")}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(s.title)}</strong><span>${escapeHtml(s.category)} · ${escapeHtml(s.source)}</span></a>`).join("")}</div></article>
        </div>
      </section>

      <section class="${farmingTabPanelClass("pests")}" id="farm-pests" role="tabpanel" aria-labelledby="farm-tab-pests" ${state.farmingActiveTab === "pests" ? "" : "hidden"}>
        <div class="farm-grid two">
          <article class="farm-card"><div class="farm-card-head"><h3>Pest Farming</h3><span class="farm-badge">+${pests.reduce((sum, p) => sum + p.fortune, 0).toFixed(1)} FF</span></div><div class="farm-pest-grid">${pests.map((p) => `<div class="farm-pest"><strong>${escapeHtml(p.name)}</strong><span>${fmtInt(p.kills)} kills</span>${farmingMiniBar(p.brackets, p.max || 15, `${fmtInt(p.brackets)} / ${fmtInt(p.max || 15)} brackets`)}<small>${p.next ? `Next at ${fmtInt(p.next)} kills` : "Max bracket or no next threshold"}</small></div>`).join("")}</div></article>
          <article class="farm-card"><h3>Selected Crop Pest</h3>${selectedCrop ? `<div class="farm-selected"><img src="${getUniversalItemIconUrl(selectedCrop.icon)}" alt="" loading="lazy" onerror="${fallbackToSkyCryptItemOnError(selectedCrop.icon)}"><div><strong>${escapeHtml(selectedCrop.name)} → ${escapeHtml(selectedCrop.pest || "Unknown pest")}</strong><span>Crop-specific pest mapping from EliteFarmers/FarmingWeight.</span></div></div>` : ""}<p class="farm-note">This panel intentionally separates Farm, Spawn, and Kill planning concepts but only renders profile-visible bestiary progress until full vacuum/loadout parsing is added.</p></article>
          ${renderEliteContestCard()}
        </div>
      </section>

      <section class="${farmingTabPanelClass("rates")}" id="farm-rates" role="tabpanel" aria-labelledby="farm-tab-rates" ${state.farmingActiveTab === "rates" ? "" : "hidden"}>
        <article class="farm-card farm-card-wide"><div class="farm-card-head"><h3>Crop Rates & NPC Profit</h3><span class="farm-badge">${selectedRate ? escapeHtml(selectedRate.name) : "All crops"}</span></div><div class="farm-table-wrap"><table class="farm-table"><thead><tr><th>Crop</th><th>Items / min</th><th>Collection / h</th><th>NPC coins / h</th><th>Notes</th></tr></thead><tbody>${ratesForDisplay.map((r) => `<tr class="${r.id === selectedCrop?.id ? "active" : ""}"><td><img src="${getUniversalItemIconUrl(r.icon)}" alt="" loading="lazy" onerror="${fallbackToSkyCryptItemOnError(r.icon)}">${escapeHtml(r.name)}</td><td class="num">${fmtInt(r.itemsPerMinute)}</td><td class="num">${fmtInt(r.collectionPerHour)}</td><td class="num">${fmtCoins(r.coinsPerHourNpc)}</td><td>${r.exportable ? "Exportable crop" : r.flower ? "Flower crop" : "Standard crop"}</td></tr>`).join("")}</tbody></table></div><p class="farm-note">Bazaar routing, RNG toggles, bountiful, and full item-stat effects need a deeper static port of Elite's rate calculator. Current output is a transparent baseline.</p></article>
      </section>

      <section class="${farmingTabPanelClass("ranks")}" id="farm-ranks" role="tabpanel" aria-labelledby="farm-tab-ranks" ${state.farmingActiveTab === "ranks" ? "" : "hidden"}>
        <article class="farm-card farm-card-wide"><div class="farm-card-head"><h3>Ranks & Weight Breakdown</h3><span class="farm-badge">${weight.totalWeight.toLocaleString(undefined, { maximumFractionDigits: 3 })} Weight</span></div><div class="farm-breakdown"><div><h4>Crops <small>${weight.cropWeight.toLocaleString(undefined, { maximumFractionDigits: 3 })}</small></h4>${cropRows.map((r) => `<p><span>${escapeHtml(r.name)}</span><b>${r.weight.toLocaleString(undefined, { maximumFractionDigits: 3 })}</b></p>`).join("")}</div><div><h4>Bonus <small>${weight.bonusWeight.toLocaleString(undefined, { maximumFractionDigits: 3 })}</small></h4>${Object.entries(weight.bonusSources).map(([name, val]) => `<p><span>${escapeHtml(name)}</span><b>${Number(val).toLocaleString(undefined, { maximumFractionDigits: 3 })}</b></p>`).join("")}<h4>Rank note</h4><p class="farm-note">EliteFarmers shows official leaderboard ranks from its backend. Hypixie is static, so it can show the breakdown and link users to Elite, but it does not fake top-50k ranks.</p><a class="btn-secondary btn-small" href="https://elitebot.dev" target="_blank" rel="noopener noreferrer">Open EliteFarmers</a></div></div></article>
      </section>
    </div>`;

  pane.querySelectorAll(".farm-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.farmingActiveTab = button.dataset.farmingTab || "stats";
      renderFarmingView();
    });
  });
  pane.querySelectorAll(".farm-crop-btn[data-farming-crop]").forEach((button) => {
    button.addEventListener("click", () => {
      state.farmingSelectedCropId = button.dataset.farmingCrop || null;
      renderFarmingView();
    });
  });
  pane.querySelector("#farming-retry-contest")?.addEventListener("click", () => loadEliteContestSummary(true));
}

function renderGardenChipsView() {
  const pane = $("#view-garden-chips");
  if (!pane) return;
  if (typeof GARDEN_CHIPS === "undefined") {
    pane.innerHTML = `<div class="acc-loading">Garden Chips data is not loaded.</div>`;
    return;
  }

  const rarities = window.GARDEN_CHIP_RARITIES || {};
  const targetRarityKey = rarities[state.gardenChips.targetRarity] ? state.gardenChips.targetRarity : "LEGENDARY";
  const target = rarities[targetRarityKey] || { label: "Legendary", copies: 16, maxLevel: 20 };
  state.gardenChips.targetRarity = targetRarityKey;
  state.gardenChips.targetLevel = Math.min(Math.max(1, Number(state.gardenChips.targetLevel) || target.maxLevel), target.maxLevel);

  const rows = sortGardenChipRows(gardenChipRows());
  const pricedRows = rows.filter((r) => Number.isFinite(r.buyPrice));
  const cheapest = pricedRows.reduce((best, r) => !best || r.legendaryCost < best.legendaryCost ? r : best, null);
  const totalTarget = pricedRows.reduce((sum, r) => sum + (r.copyCost || 0), 0);
  const totalSowdust = rows.reduce((sum, r) => sum + (r.sowdustToTarget || 0), 0);
  const totalRemainingCopies = rows.reduce((sum, r) => sum + r.remainingCopies, 0);
  const completedRows = rows.filter((r) => r.remainingCopies === 0 && r.sowdustToTarget === 0).length;

  pane.innerHTML = `
    <header class="view-header garden-chip-header">
      <div>
        <h2 class="view-title">Garden Chips Planner</h2>
        <p class="view-subtitle">Live Bazaar prices for all 10 Garden Chips, plus rarity-copy and Sowdust targets from the Garden Chips wiki. Enter what you already own below; Hypixie saves it locally and subtracts it from the remaining plan.</p>
      </div>
      <a class="btn-ghost" href="https://hypixel-skyblock.fandom.com/wiki/Garden_Chips" target="_blank" rel="noopener noreferrer">Wiki source ↗</a>
    </header>

    <section class="stats-grid garden-chip-stats" aria-label="Garden Chips overview">
      <div class="stat-card"><div class="stat-label">Chips tracked</div><div class="stat-value">${rows.length}</div></div>
      <div class="stat-card"><div class="stat-label">Cheapest Legendary</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${cheapest ? fmtCoins(cheapest.legendaryCost) : "—"}</span><span class="stat-value-minor">${cheapest ? escapeHtml(cheapest.name) : "No Bazaar data"}</span></div></div>
      <div class="stat-card"><div class="stat-label">Remaining to ${escapeHtml(target.label)}</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${fmtCoins(totalTarget)}</span><span class="stat-value-minor">${fmtInt(totalRemainingCopies)} copies left</span></div></div>
      <div class="stat-card"><div class="stat-label">Remaining to Level ${state.gardenChips.targetLevel}</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${fmtCoins(totalSowdust)}</span><span class="stat-value-minor">${completedRows}/${rows.length} target done</span></div></div>
    </section>

    <section class="acc-toolbar garden-chip-toolbar" aria-label="Garden Chips controls">
      <div class="acc-toolbar-group">
        <span class="acc-toolbar-label">Target rarity</span>
        <select id="garden-chip-rarity" class="select-native">
          ${Object.entries(rarities).map(([key, r]) => `<option value="${key}" ${key === targetRarityKey ? "selected" : ""}>${escapeHtml(r.label)} (${r.copies} copies)</option>`).join("")}
        </select>
      </div>
      <div class="acc-toolbar-group">
        <span class="acc-toolbar-label">Target level</span>
        <select id="garden-chip-level" class="select-native">
          ${Array.from({ length: target.maxLevel }, (_, i) => i + 1).map((lvl) => `<option value="${lvl}" ${lvl === state.gardenChips.targetLevel ? "selected" : ""}>Level ${lvl}</option>`).join("")}
        </select>
      </div>
      <div class="acc-toolbar-group">
        <span class="acc-toolbar-label">Sort by</span>
        <select id="garden-chip-sort" class="select-native">
          <option value="legendaryCost" ${state.gardenChips.sortKey === "legendaryCost" ? "selected" : ""}>Remaining target cost</option>
          <option value="price" ${state.gardenChips.sortKey === "price" ? "selected" : ""}>Live chip price</option>
          <option value="volume" ${state.gardenChips.sortKey === "volume" ? "selected" : ""}>Weekly volume</option>
          <option value="source" ${state.gardenChips.sortKey === "source" ? "selected" : ""}>Source type</option>
          <option value="name" ${state.gardenChips.sortKey === "name" ? "selected" : ""}>Name</option>
        </select>
      </div>
    </section>

    <section class="garden-chip-grid">
      ${rows.map((r) => {
        const rarityColor = r.targetRarity?.color || "var(--ember-light)";
        const ownedRarityLabel = r.progress.rarity?.label || "None";
        const levelMax = r.progress.rarity?.maxLevel || 1;
        return `
          <article class="garden-chip-card" data-chip="${escapeHtml(r.id)}">
            <div class="garden-chip-card-head">
              <img class="garden-chip-icon" src="${getUniversalItemIconUrl(r.id)}" alt="" loading="lazy" onerror="${fallbackToSkyCryptItemOnError(r.id)}">
              <div>
                <a class="garden-chip-name wiki-link" href="${wikiUrl(r.name)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.name)}</a>
                <div class="garden-chip-ability">${escapeHtml(r.ability)} · <span>${escapeHtml(r.sourceType)}</span></div>
              </div>
            </div>
            <p class="garden-chip-summary">${escapeHtml(r.summary)} <span>${escapeHtml(r.maxSummary)}</span></p>
            <div class="garden-chip-metrics">
              <div><span>Live price</span><strong>${fmtCoins(r.buyPrice)}</strong></div>
              <div><span>Remaining copies</span><strong style="color:${rarityColor}">${fmtInt(r.remainingCopies)} (${fmtCoins(r.copyCost)})</strong></div>
              <div><span>Legendary copies</span><strong>${fmtCoins(r.legendaryCost)}</strong></div>
              <div><span>Remaining Sowdust</span><strong>${fmtCoins(r.sowdustToTarget)}</strong></div>
              <div><span>Spread</span><strong>${fmtCoins(r.spread)}</strong></div>
              <div><span>Vol / wk</span><strong>${fmtInt(r.weeklyVolume)}</strong></div>
            </div>
            <div class="garden-chip-progress" aria-label="Owned progress for ${escapeHtml(r.name)}">
              <label>
                <span>Owned rarity</span>
                <select class="select-native garden-chip-owned-rarity" data-chip="${escapeHtml(r.id)}">
                  <option value="NONE" ${r.progress.rarityKey === "NONE" ? "selected" : ""}>None (0 copies)</option>
                  ${gardenChipRarityEntries().map(([key, rarity]) => `<option value="${key}" ${r.progress.rarityKey === key ? "selected" : ""}>${escapeHtml(rarity.label)} (${rarity.copies} copies)</option>`).join("")}
                </select>
              </label>
              <label>
                <span>Current level</span>
                <input class="garden-chip-owned-level" data-chip="${escapeHtml(r.id)}" type="number" inputmode="numeric" min="${r.progress.rarityKey === "NONE" ? 0 : 1}" max="${levelMax}" value="${r.progress.currentLevel}" ${r.progress.rarityKey === "NONE" ? "disabled" : ""}>
              </label>
              <label>
                <span>Spare copies</span>
                <input class="garden-chip-spare-copies" data-chip="${escapeHtml(r.id)}" type="number" inputmode="numeric" min="0" max="99" value="${r.progress.spareCopies}">
              </label>
              <div class="garden-chip-owned-summary">Have ${escapeHtml(ownedRarityLabel)} L${r.progress.currentLevel || 0} + ${fmtInt(r.progress.spareCopies)} spare · ${fmtInt(r.ownedCopyCount)} / ${fmtInt(r.copies)} copies counted</div>
            </div>
            <div class="garden-chip-source">${escapeHtml(r.source)}</div>
            <div class="acc-card-cmd">
              <code class="acc-cmd-text">${escapeHtml(r.command)}</code>
              <button class="btn-copy" data-copy="${escapeHtml(r.command)}" title="Copy command">Copy</button>
            </div>
          </article>`;
      }).join("")}
    </section>
  `;

  pane.querySelector("#garden-chip-rarity")?.addEventListener("change", (e) => {
    state.gardenChips.targetRarity = e.target.value;
    localStorage.setItem(CONFIG.GARDEN_CHIP_RARITY_STORAGE, state.gardenChips.targetRarity);
    const nextMax = rarities[state.gardenChips.targetRarity]?.maxLevel || 20;
    if (state.gardenChips.targetLevel > nextMax) {
      state.gardenChips.targetLevel = nextMax;
      localStorage.setItem(CONFIG.GARDEN_CHIP_LEVEL_STORAGE, String(nextMax));
    }
    renderGardenChipsView();
  });
  pane.querySelector("#garden-chip-level")?.addEventListener("change", (e) => {
    state.gardenChips.targetLevel = Number(e.target.value) || target.maxLevel;
    localStorage.setItem(CONFIG.GARDEN_CHIP_LEVEL_STORAGE, String(state.gardenChips.targetLevel));
    renderGardenChipsView();
  });
  pane.querySelector("#garden-chip-sort")?.addEventListener("change", (e) => {
    state.gardenChips.sortKey = e.target.value;
    localStorage.setItem(CONFIG.GARDEN_CHIP_SORT_STORAGE, state.gardenChips.sortKey);
    renderGardenChipsView();
  });
  pane.querySelectorAll(".garden-chip-owned-rarity").forEach((select) => {
    select.addEventListener("change", (e) => {
      const chipId = e.target.dataset.chip;
      const rarityKey = rarities[e.target.value] ? e.target.value : "NONE";
      const next = { ...(state.gardenChips.progress?.[chipId] || {}), rarity: rarityKey };
      if (rarityKey === "NONE") next.level = 0;
      else next.level = Math.min(Math.max(1, Number(next.level) || 1), rarities[rarityKey].maxLevel);
      state.gardenChips.progress = { ...(state.gardenChips.progress || {}), [chipId]: next };
      saveGardenChipProgress();
      renderGardenChipsView();
    });
  });
  pane.querySelectorAll(".garden-chip-owned-level").forEach((input) => {
    input.addEventListener("change", (e) => {
      const chipId = e.target.dataset.chip;
      const current = state.gardenChips.progress?.[chipId] || {};
      const rarity = rarities[current.rarity];
      if (!rarity) return;
      const level = Math.min(Math.max(1, Number(e.target.value) || 1), rarity.maxLevel);
      state.gardenChips.progress = { ...(state.gardenChips.progress || {}), [chipId]: { ...current, level } };
      saveGardenChipProgress();
      renderGardenChipsView();
    });
  });
  pane.querySelectorAll(".garden-chip-spare-copies").forEach((input) => {
    input.addEventListener("change", (e) => {
      const chipId = e.target.dataset.chip;
      const current = state.gardenChips.progress?.[chipId] || {};
      const spareCopies = Math.min(99, Math.max(0, Math.floor(Number(e.target.value) || 0)));
      state.gardenChips.progress = { ...(state.gardenChips.progress || {}), [chipId]: { ...current, spareCopies } };
      saveGardenChipProgress();
      renderGardenChipsView();
    });
  });
  bindCopyButtons(pane);
}

const MUTATION_TRACKER_EXCLUDES = new Set(["CONDENSED_HELIANTHUS", "FERMENTO", "FERTILIZED_JERRYSEED"]);
const MUTATION_DISCOVERY_RARITIES = new Set(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]);
const MUTATION_STORAGE_KEY = "hypixie.mutations.discovered.v1";

function normalizeMutationToken(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/§[0-9A-FK-OR]/gi, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mutationNameToId(name) {
  return normalizeMutationToken(name);
}

function profileMutationCandidates(value, trail = [], out = []) {
  if (value == null || out.length > 600) return out;
  const trailText = trail.join(".").toLowerCase();
  if ((typeof value === "boolean" || typeof value === "number" || typeof value === "string") && /(mutation|greenhouse|crop|plant|discovered|unlocked|found|garden|foraging)/i.test(trailText)) {
    out.push({ path: trail.join("."), key: trail[trail.length - 1] || "", value });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => profileMutationCandidates(v, trail.concat(String(i)), out));
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const keyTrail = trail.concat(k);
      const keyText = keyTrail.join(".").toLowerCase();
      const keyLooksUseful = /(mutation|greenhouse|crop|plant|discovered|unlocked|found|garden|foraging)/i.test(keyText);
      if ((typeof v === "boolean" || typeof v === "number" || typeof v === "string") && keyLooksUseful) {
        out.push({ path: keyTrail.join("."), key: k, value: v });
      }
      if (typeof v === "object" || (typeof v === "string" && keyLooksUseful)) profileMutationCandidates(v, keyTrail, out);
    }
  }
  return out;
}

function analyseProfileMutations(rawProfile, uuid) {
  const member = rawProfile?.members?.[uuid];
  const tracker = mutationTrackerList();
  if (!member || !tracker.length) return null;

  const byId = new Map(tracker.map((m) => [m.id, m]));
  const byName = new Map(tracker.map((m) => [normalizeMutationToken(m.name), m]));
  const discovered = new Set();
  const evidence = {};

  function mark(raw, path, value) {
    const token = normalizeMutationToken(raw);
    const m = byId.get(token) || byName.get(token) || byId.get(token.replace(/_MUTATION$/, "")) || byName.get(token.replace(/_MUTATION$/, ""));
    if (!m) return false;
    discovered.add(m.id);
    if (!evidence[m.id]) evidence[m.id] = { path, value };
    return true;
  }

  for (const hit of profileMutationCandidates(member)) {
    const path = hit.path;
    const value = hit.value;
    const key = hit.key;
    if (value === false || value == null || value === 0) continue;

    /* Common shapes: { mutations: { ASHWREATH: true } },
     * { discovered_mutations: ["ASHWREATH"] }, or arrays of objects with an id/name. */
    mark(key, path, value);
    if (typeof value === "string") mark(value, path, value);
  }

  const greenhouse = extractGreenhouseProfileStats(member);
  return {
    discovered,
    evidence,
    greenhouse,
    source: discovered.size || greenhouse ? "Hypixel profile API" : null,
    candidateCount: profileMutationCandidates(member).length,
  };
}

function extractGreenhouseProfileStats(member) {
  let slots = null;
  let vines = null;
  let path = null;
  for (const hit of profileMutationCandidates(member)) {
    const p = hit.path.toLowerCase();
    const n = Number(hit.value);
    if (!Number.isFinite(n) || n < 0) continue;
    if (/(greenhouse|mutation|foraging|garden).*?(slot|plot|space|size|unlocked)/i.test(p)) {
      if (slots == null || n > slots) { slots = n; path = hit.path; }
    }
    if (/(ethereal|vine)/i.test(p)) vines = n;
  }
  if (slots == null && vines == null) return null;
  return { slots, vines, path };
}

function mutationCatalog() {
  return Array.isArray(window.MUTATIONS_DATA) ? window.MUTATIONS_DATA : [];
}

function mutationByName() {
  return new Map(mutationCatalog().map((m) => [m.name.toLowerCase(), m]));
}

function mutationById() {
  return new Map(mutationCatalog().map((m) => [m.id, m]));
}

function mutationTrackerList() {
  return mutationCatalog().filter((m) => MUTATION_DISCOVERY_RARITIES.has(m.rarity) && !MUTATION_TRACKER_EXCLUDES.has(m.id));
}

function mutationDiscoveredSet() {
  try { return new Set(JSON.parse(localStorage.getItem(MUTATION_STORAGE_KEY) || "[]")); }
  catch { return new Set(); }
}

function profileMutationDiscoveredSet() {
  const set = state.player?.mutationAnalysis?.discovered;
  return set instanceof Set ? set : new Set();
}

function combinedMutationDiscoveredSet() {
  return new Set([...profileMutationDiscoveredSet(), ...mutationDiscoveredSet()]);
}

function mutationDiscoverySource(id) {
  const api = profileMutationDiscoveredSet().has(id);
  const manual = mutationDiscoveredSet().has(id);
  if (api && manual) return "api+manual";
  if (api) return "api";
  if (manual) return "manual";
  return "none";
}

function mutationIconUrl(mutation) {
  if (!mutation?.name) return mutationFallbackIcon(mutation);
  const file = encodeURIComponent(mutation.name.replace(/\s+/g, "_"));
  return `https://cdn.jsdelivr.net/gh/palmaner/assets@main/images/${file}.png?v=2`;
}

function mutationFallbackIcon(mutation) {
  const rarity = mutation?.rarity || "UNKNOWN";
  const color = RARITY_COLORS[rarity] || RARITY_COLORS.UNKNOWN || "#ffb347";
  const initials = String(mutation?.name || "?")
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
       <defs><radialGradient id='g' cx='45%' cy='25%' r='75%'><stop offset='0' stop-color='${color}' stop-opacity='.95'/><stop offset='1' stop-color='#172033'/></radialGradient></defs>
       <rect x='6' y='6' width='52' height='52' rx='14' fill='url(#g)' stroke='${color}' stroke-width='2'/>
       <path d='M32 12 C42 21 45 34 32 52 C19 34 22 21 32 12 Z' fill='rgba(255,255,255,.22)' stroke='rgba(255,255,255,.5)' stroke-width='1.5'/>
       <text x='32' y='39' text-anchor='middle' font-family='Arial,sans-serif' font-size='17' font-weight='800' fill='white'>${initials}</text>
     </svg>`
  );
}

function mutationIconHTML(mutation, className = "mutation-img") {
  const src = mutationIconUrl(mutation);
  const fallback = mutationFallbackIcon(mutation);
  const alt = escapeHtml(mutation?.name || "Mutation");
  return `<span class="mutation-icon-frame"><img class="${className}" src="${src}" alt="${alt}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'"></span>`;
}

function saveMutationDiscovered(set) {
  localStorage.setItem(MUTATION_STORAGE_KEY, JSON.stringify(Array.from(set)));
}

function parseMutationIngredient(text) {
  const raw = String(text || "").trim();
  const m = raw.match(/^(\d+(?:\.\d+)?)x\s+(.+)$/i);
  return m ? { qty: Number(m[1]), name: m[2].trim(), note: false } : { qty: 0, name: raw, note: true };
}

function mutationRecipe(mutation, quantity = 1, seen = new Set()) {
  const byName = mutationByName();
  const direct = [];
  const base = new Map();
  let recursiveCost = 0;
  let complete = true;

  function addBase(name, qty) {
    const prev = base.get(name) || { name, qty: 0, item: byName.get(name.toLowerCase()) || null };
    prev.qty += qty;
    base.set(name, prev);
  }

  function walk(item, qty, path = new Set()) {
    if (!item) { complete = false; return; }
    if (path.has(item.id)) { complete = false; return; }
    const nextPath = new Set(path);
    nextPath.add(item.id);
    const recipe = item.spreading_conditions || [];
    if (!recipe.length) {
      addBase(item.name, qty);
      recursiveCost += (item.coins || 0) * qty;
      return;
    }
    for (const raw of recipe) {
      const ing = parseMutationIngredient(raw);
      if (ing.note) {
        if (path.size === 0 && ing.name) direct.push({ ...ing, total: 0, item: null });
        continue;
      }
      const child = byName.get(ing.name.toLowerCase()) || null;
      const total = ing.qty * qty;
      if (path.size === 0) direct.push({ ...ing, item: child, total });
      if (child) walk(child, total, nextPath);
      else { addBase(ing.name, total); complete = false; }
    }
  }

  walk(mutation, quantity, seen);
  return { direct, base: Array.from(base.values()).sort((a, b) => a.name.localeCompare(b.name)), recursiveCost, complete };
}

function mutationProfitRows(discovered = combinedMutationDiscoveredSet()) {
  const cycleHours = Math.max(0.25, Number(state.mutations.manualCycleHours) || 4);
  return mutationTrackerList().map((m) => {
    const recipe = mutationRecipe(m, 1);
    const cost = recipe.recursiveCost;
    const revenue = m.coins || 0;
    const profit = revenue - cost;
    return { mutation: m, recipe, cost, revenue, profit, roi: cost > 0 ? (profit / cost) * 100 : null, profitPerHour: profit / cycleHours, unlocked: discovered.has(m.id) };
  });
}

function renderMutationsView() {
  const pane = $("#view-mutations");
  if (!pane) return;
  if (typeof MUTATIONS_DATA === "undefined") {
    pane.innerHTML = `<div class="acc-gate"><div class="acc-gate-icon">${gateIconHTML("BARRIER", "Warning")}</div><h2>Mutation data did not load</h2><p>The Mutations tab needs <code>mutations-data.js</code>. Hard-refresh after deploying the new file.</p></div>`;
    return;
  }

  const all = mutationCatalog();
  const tracker = mutationTrackerList();
  const byId = mutationById();
  if (!byId.has(state.mutations.selectedId)) state.mutations.selectedId = tracker[0]?.id || all[0]?.id || null;
  const selected = byId.get(state.mutations.selectedId) || tracker[0];
  const qty = Math.max(1, Math.floor(Number(state.mutations.quantity) || 1));
  const recipe = selected ? mutationRecipe(selected, qty) : null;
  const manualDiscovered = mutationDiscoveredSet();
  const profileDiscovered = profileMutationDiscoveredSet();
  const discovered = new Set([...profileDiscovered, ...manualDiscovered]);
  const progress = tracker.length ? discovered.size / tracker.length : 0;
  const search = state.mutations.search.trim().toLowerCase();
  const filtered = tracker.filter((m) => {
    if (search && !(`${m.name} ${m.rarity} ${m.growth_surface || ""}`).toLowerCase().includes(search)) return false;
    return true;
  });

  let rows = mutationProfitRows(discovered).filter((r) => !state.mutations.showUnlockedOnly || r.unlocked);
  rows.sort((a, b) => {
    const key = state.mutations.sortKey;
    const av = a[key] ?? -Infinity;
    const bv = b[key] ?? -Infinity;
    if (typeof av === "string") return String(av).localeCompare(String(bv));
    return (bv || 0) - (av || 0);
  });

  const vinesUnit = state.raw?.products?.ETHEREAL_VINE?.quick_status?.buyPrice || state.raw?.products?.ENCHANTED_VINE?.quick_status?.buyPrice || null;
  const profileGreenhouse = state.player?.mutationAnalysis?.greenhouse || null;
  const apiSlots = Number.isFinite(Number(profileGreenhouse?.slots)) ? Number(profileGreenhouse.slots) : null;
  const apiVines = Number.isFinite(Number(profileGreenhouse?.vines)) ? Number(profileGreenhouse.vines) : null;
  const targetSlots = Math.max(apiSlots || 12, Math.max(12, Number(state.mutations.greenhouseTarget) || 25));
  const vinesNeeded = Math.max(0, targetSlots - (apiSlots || 12));
  const vineCost = vinesUnit ? vinesNeeded * vinesUnit : null;
  const profileSource = state.player?.mutationAnalysis?.source;
  const apiStatus = profileSource
    ? `${profileDiscovered.size} from Hypixel${apiSlots != null ? ` · ${apiSlots} greenhouse slots` : ""}`
    : (state.player?.uuid ? "No mutation fields found in selected profile API data" : "Link a player to sync discovered mutations");

  const rarityGroups = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"].map((rarity) => {
    const items = filtered.filter((m) => m.rarity === rarity);
    if (!items.length) return "";
    return `<section class="mutation-rarity"><div class="mutation-rarity-head"><h3>${rarity}</h3><button class="btn-ghost btn-small" data-mutation-select-rarity="${rarity}">Select all</button></div><div class="mutation-grid">${items.map((m) => renderMutationTile(m, discovered)).join("")}</div></section>`;
  }).join("");

  pane.innerHTML = `
    <div class="acc-page-head">
      <div>
        <h2 class="acc-page-title">SkyBlock Mutations</h2>
        <p class="acc-page-sub">Collection tracker, recursive recipe calculator, Greenhouse expansion planner, and static profit leaderboard. Link a player to sync discovered mutations and greenhouse data from the Hypixel profile API when those fields are public.</p>
      </div>
      <button class="btn-secondary" id="mutation-reset-progress">Reset progress</button>
    </div>

    <section class="stats-grid" aria-label="Mutation overview" style="margin-top: 15px;">
      <div class="stat-card"><div class="stat-label">Collection progress</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${discovered.size} / ${tracker.length}</span><span class="stat-value-minor">${profileDiscovered.size ? `${profileDiscovered.size} API · ${manualDiscovered.size} manual` : `${(progress * 100).toFixed(1)}% discovered`}</span></div></div>
      <div class="stat-card"><div class="stat-label">Profile sync</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${profileSource ? "Synced" : "Manual"}</span><span class="stat-value-minor">${escapeHtml(apiStatus)}</span></div></div>
      <div class="stat-card"><div class="stat-label">Greenhouse target</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${targetSlots} slots</span><span class="stat-value-minor">${apiSlots != null ? `${apiSlots} owned${apiVines != null ? ` · ${apiVines} vines` : ""}` : `${vinesNeeded} Ethereal Vines`}</span></div></div>
      <div class="stat-card"><div class="stat-label">Vine cost</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${vineCost != null ? fmtCoins(vineCost) : "—"}</span><span class="stat-value-minor">${vinesUnit ? `${fmtCoins(vinesUnit)} each for ${vinesNeeded} more` : "live bazaar unavailable"}</span></div></div>
    </section>

    <div class="mutation-layout">
      <section class="mutation-panel">
        <div class="mutation-panel-head"><h3>Collection tracker</h3><input id="mutation-search" class="select-native mutation-search" type="search" placeholder="Search mutations…" value="${escapeHtml(state.mutations.search)}"></div>
        <div class="mutation-progress"><span style="width:${Math.max(2, progress * 100)}%"></span></div>
        ${rarityGroups}
      </section>

      <section class="mutation-panel">
        <div class="mutation-panel-head"><h3>Greenhouse planner</h3></div>
        <div class="mutation-controls-row">
          <label class="sort-label" for="mutation-greenhouse-target">Target slots</label>
          <input id="mutation-greenhouse-target" class="select-native mutation-qty" type="number" min="12" max="100" step="1" value="${targetSlots}">
          <span class="legend-item">Default greenhouse starts at 12 slots; this estimates one Ethereal Vine per added slot.</span>
        </div>

        <div class="mutation-panel-head"><h3>Recipe calculator</h3></div>
        <div class="mutation-controls-row">
          <select id="mutation-selected" class="select-native">${all.filter((m) => m.rarity !== "RAW").map((m) => `<option value="${m.id}" ${m.id === selected?.id ? "selected" : ""}>${escapeHtml(m.name)} (${m.rarity})</option>`).join("")}</select>
          <input id="mutation-qty" class="select-native mutation-qty" type="number" min="1" max="999" value="${qty}">
        </div>
        ${renderMutationRecipe(selected, recipe, qty)}

        <div class="mutation-panel-head mutation-profit-head"><h3>Profit leaderboard</h3><label class="acc-toggle-inline"><input type="checkbox" id="mutation-unlocked-only" ${state.mutations.showUnlockedOnly ? "checked" : ""}><span>Unlocked only</span></label></div>
        <div class="mutation-controls-row">
          <label class="sort-label" for="mutation-cycle-hours">Cycle hours</label>
          <input id="mutation-cycle-hours" class="select-native mutation-qty" type="number" min="0.25" step="0.25" value="${state.mutations.manualCycleHours}">
          <select id="mutation-profit-sort" class="select-native"><option value="profitPerHour" ${state.mutations.sortKey === "profitPerHour" ? "selected" : ""}>Profit / hour</option><option value="profit" ${state.mutations.sortKey === "profit" ? "selected" : ""}>Profit / harvest</option><option value="roi" ${state.mutations.sortKey === "roi" ? "selected" : ""}>ROI</option><option value="revenue" ${state.mutations.sortKey === "revenue" ? "selected" : ""}>Revenue</option></select>
        </div>
        <div class="mutation-profit-list">${rows.slice(0, 12).map(renderMutationProfitRow).join("")}</div>
      </section>
    </div>`;

  bindMutationEvents(pane);
}

function renderMutationTile(m, discovered) {
  const on = discovered.has(m.id);
  const source = mutationDiscoverySource(m.id);
  const sourceLabel = source === "api" ? "API" : (source === "manual" ? "Manual" : (source === "api+manual" ? "API + manual" : "Missing"));
  return `<button class="mutation-tile ${on ? "is-discovered" : ""}" data-mutation-toggle="${m.id}" title="${escapeHtml(m.tip || m.name)}"><span class="mutation-tile-head">${mutationIconHTML(m)}<span><span class="mutation-name">${escapeHtml(m.name)}</span><span class="mutation-meta">${m.watering === "YES" ? "Watering" : "No watering"} · ${m.growthStages ?? 0} stages · ${fmtCoins(m.coins || 0)}</span></span></span><span class="mutation-source mutation-source-${source}">${sourceLabel}</span></button>`;
}

function renderMutationRecipe(selected, recipe, qty) {
  if (!selected || !recipe) return `<div class="fusion-empty">Select a mutation.</div>`;
  const direct = recipe.direct.length ? recipe.direct.map((ing) => ing.note ? `<li>${escapeHtml(ing.name)}</li>` : `<li>${ing.item ? mutationIconHTML(ing.item, "mutation-img mutation-img-small") : ""}<span><strong>${fmtInt(ing.total)}</strong>× ${escapeHtml(ing.name)}</span></li>`).join("") : `<li>No spreading recipe listed.</li>`;
  const base = recipe.base.length ? recipe.base.map((ing) => `<li>${ing.item ? mutationIconHTML(ing.item, "mutation-img mutation-img-small") : ""}<span><strong>${fmtInt(ing.qty)}</strong>× ${escapeHtml(ing.name)}</span></li>`).join("") : `<li>No base ingredients required.</li>`;
  const effects = (selected.effects || []).map((e) => `<span class="pill" title="${escapeHtml(e.description || "")}">${escapeHtml(e.name)}</span>`).join("") || `<span class="pill">No listed effects</span>`;
  return `<div class="mutation-recipe-card"><div class="mutation-recipe-title"><div class="mutation-recipe-selected">${mutationIconHTML(selected, "mutation-img mutation-img-large")}<div><strong>${qty}× ${escapeHtml(selected.name)}</strong><span>${selected.rarity} · ${selected.size || "size unknown"} · ${selected.growth_surface || "surface unknown"}</span></div></div><a class="wiki-link" href="${wikiUrl(selected.name)}" target="_blank" rel="noopener noreferrer">Wiki</a></div><p>${escapeHtml(selected.tip || "")}</p><div class="mutation-effects">${effects}</div><div class="mutation-recipe-cols"><div><h4>Direct recipe</h4><ul>${direct}</ul></div><div><h4>Base requirements</h4><ul>${base}</ul></div></div><div class="mutation-cost-line"><span>NPC/coin value</span><strong>${fmtCoins((selected.coins || 0) * qty)}</strong></div></div>`;
}

function renderMutationProfitRow(row) {
  return `<button class="mutation-profit-row" data-mutation-pick="${row.mutation.id}"><span class="mutation-profit-name">${mutationIconHTML(row.mutation, "mutation-img mutation-img-small")}<span><strong>${escapeHtml(row.mutation.name)}</strong><small>${row.mutation.rarity}${row.unlocked ? " · unlocked" : ""}</small></span></span><span>${fmtCoins(row.cost)} cost</span><span>${fmtCoins(row.revenue)} rev</span><span class="${row.profit >= 0 ? "pos" : "neg"}">${fmtCoins(row.profit)}/harvest</span><span>${fmtCoins(row.profitPerHour)}/hr</span></button>`;
}

function bindMutationEvents(pane) {
  pane.querySelector("#mutation-search")?.addEventListener("input", (e) => { state.mutations.search = e.target.value; renderMutationsView(); });
  pane.querySelector("#mutation-selected")?.addEventListener("change", (e) => { state.mutations.selectedId = e.target.value; renderMutationsView(); });
  pane.querySelector("#mutation-qty")?.addEventListener("change", (e) => { state.mutations.quantity = e.target.value; renderMutationsView(); });
  pane.querySelector("#mutation-greenhouse-target")?.addEventListener("change", (e) => { state.mutations.greenhouseTarget = e.target.value; renderMutationsView(); });
  pane.querySelector("#mutation-profit-sort")?.addEventListener("change", (e) => { state.mutations.sortKey = e.target.value; renderMutationsView(); });
  pane.querySelector("#mutation-cycle-hours")?.addEventListener("change", (e) => { state.mutations.manualCycleHours = e.target.value; renderMutationsView(); });
  pane.querySelector("#mutation-unlocked-only")?.addEventListener("change", (e) => { state.mutations.showUnlockedOnly = e.target.checked; renderMutationsView(); });
  pane.querySelector("#mutation-reset-progress")?.addEventListener("click", () => { saveMutationDiscovered(new Set()); renderMutationsView(); });
  pane.querySelectorAll("[data-mutation-toggle]").forEach((btn) => btn.addEventListener("click", () => {
    const set = mutationDiscoveredSet();
    const id = btn.dataset.mutationToggle;
    if (set.has(id)) set.delete(id); else set.add(id);
    saveMutationDiscovered(set);
    renderMutationsView();
  }));
  pane.querySelectorAll("[data-mutation-select-rarity]").forEach((btn) => btn.addEventListener("click", () => {
    const rarity = btn.dataset.mutationSelectRarity;
    const set = mutationDiscoveredSet();
    for (const m of mutationTrackerList().filter((x) => x.rarity === rarity)) set.add(m.id);
    saveMutationDiscovered(set);
    renderMutationsView();
  }));
  pane.querySelectorAll("[data-mutation-pick]").forEach((btn) => btn.addEventListener("click", () => {
    state.mutations.selectedId = btn.dataset.mutationPick;
    renderMutationsView();
  }));
}

function renderMinionsView() {
  const pane = $("#view-minions");
  if (typeof MINIONS_DATA === "undefined") {
    pane.innerHTML = `
      <div class="acc-gate">
        <div class="acc-gate-icon">${gateIconHTML("BARRIER", "Warning")}</div>
        <h2>Minion data did not load</h2>
        <p>The Minions tab needs <code>minions-data.js</code>. Push your changes and hard-refresh to load the script.</p>
      </div>`;
    return;
  }

  const list = MINIONS_DATA.map((minion) => {
    const profileTier = state.player?.craftedMinions?.[minion.id] || 0;
    const manualTier = state.minionManualTiers[minion.id];
    const currentTier = manualTier !== undefined ? manualTier : profileTier;

    const startFromLvl1 = state.minionStartFromLvl1;
    const maxTier = minion.maxTier || 11;
    const nextTier = startFromLvl1 ? 1 : Math.min(maxTier, currentTier + 1);
    const isMaxed = !startFromLvl1 && currentTier >= maxTier;

    let totalCost = null;
    let items = [];

    if (!isMaxed) {
      const upgrade = calculateUpgradeCost(minion, startFromLvl1 ? 0 : currentTier, nextTier, state.raw?.products, state.bazaarMode);
      totalCost = upgrade.totalCost;
      items = upgrade.items;
    }

    return { minion, currentTier, nextTier, isMaxed, totalCost, items };
  });

  list.sort((a, b) => {
    if (a.isMaxed !== b.isMaxed) return a.isMaxed ? 1 : -1;
    if (a.isMaxed) return a.minion.name.localeCompare(b.minion.name);

    const ac = Number.isFinite(a.totalCost) ? a.totalCost : Infinity;
    const bc = Number.isFinite(b.totalCost) ? b.totalCost : Infinity;
    if (ac !== bc) return ac - bc;
    return a.minion.name.localeCompare(b.minion.name);
  });

  const cheapest = list.find((x) => !x.isMaxed && Number.isFinite(x.totalCost));

  // Compute aggregate minion statistics
  const totalMinions = list.length;
  const craftedCount = list.filter((x) => x.currentTier >= 1).length;
  const maxedCount = list.filter((x) => x.currentTier >= (x.minion.maxTier || 11)).length;

  let totalCostToMax = 0;
  list.forEach((x) => {
    if (x.currentTier >= (x.minion.maxTier || 11)) return;
    const upgrade = calculateUpgradeCost(x.minion, x.currentTier, x.minion.maxTier || 11, state.raw?.products, state.bazaarMode);
    if (upgrade && upgrade.totalCost != null) {
      totalCostToMax += upgrade.totalCost;
    }
  });

  const statsGridHTML = `
    <section class="stats-grid" aria-label="Minion overview" style="margin-top: 15px;">
      <div class="stat-card">
        <div class="stat-label">Minions Crafted</div>
        <div class="stat-value stat-value-stacked">
          <span class="stat-value-major" style="color: var(--text);">${craftedCount} / ${totalMinions}</span>
          <span class="stat-value-minor">${((craftedCount / totalMinions) * 100).toFixed(1)}% crafted</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cost to Max All</div>
        <div class="stat-value stat-value-stacked">
          <span class="stat-value-major">${totalCostToMax > 0 ? fmtCoins(totalCostToMax) : "0"}</span>
          <span class="stat-value-minor">T${state.minionStartFromLvl1 ? "0" : "current"} to max tier from bazaar</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cheapest Upgrade</div>
        <div class="stat-value stat-value-stacked">
          <span class="stat-value-major">${cheapest ? fmtCoins(cheapest.totalCost) : "—"}</span>
          <span class="stat-value-minor">${cheapest ? `${cheapest.minion.name} T${cheapest.nextTier}` : "Fully maxed!"}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Maxed Minions</div>
        <div class="stat-value stat-value-stacked">
          <span class="stat-value-major" style="color: var(--pos);">${maxedCount} / ${totalMinions}</span>
          <span class="stat-value-minor">${((maxedCount / totalMinions) * 100).toFixed(1)}% maxed</span>
        </div>
      </div>
    </section>
  `;

  pane.innerHTML = `
    <div class="acc-page-head">
      <div>
        <h2 class="acc-page-title">Minion Maxing Calculator</h2>
        <p class="acc-page-sub">
          Calculates the absolute cheapest minion upgrades across all standard minions. Link your account to automatically sync your crafted minion levels.
        </p>
      </div>
    </div>

    ${statsGridHTML}

    ${minionsToolbarHTML()}

    <div class="sweep-grid">
      ${list.map((x, idx) => renderMinionCard(x, idx)).join("")}
    </div>
  `;

  bindMinionsEvents(pane);
}

function minionsToolbarHTML() {
  return `
    <div class="acc-toolbar sweep-toolbar">
      <div class="acc-toolbar-left">
        <div class="acc-toolbar-group">
          <label class="acc-toggle-inline" title="Calculate upgrade costs starting from Tier 0 (scratch), regardless of your profile">
            <input type="checkbox" id="minion-start-from-lvl1" ${state.minionStartFromLvl1 ? "checked" : ""}>
            <span>Start upgrades from Level 1 (T0)</span>
          </label>
        </div>
      </div>
      <div class="acc-toolbar-right">
        <div class="segmented" role="group" aria-label="Bazaar price mode">
          <button class="seg-btn ${state.bazaarMode === "instaBuy" ? "active" : ""}" data-minion-bz="instaBuy">Insta-buy</button>
          <button class="seg-btn ${state.bazaarMode === "buyOrder" ? "active" : ""}" data-minion-bz="buyOrder">Buy order</button>
        </div>
      </div>
    </div>`;
}

function renderMinionCard(item, idx) {
  const { minion, currentTier, nextTier, isMaxed, totalCost, items } = item;
  const minionItemId = `${minion.id}_GENERATOR_${currentTier || 1}`;

  let selectOpts = `<option value="0" ${currentTier === 0 ? "selected" : ""}>Uncrafted (T0)</option>`;
  for (let t = 1; t <= (minion.maxTier || 11); t++) {
    selectOpts += `<option value="${t}" ${currentTier === t ? "selected" : ""}>Tier ${t}</option>`;
  }

  let cardStatus = "";
  if (isMaxed) {
    cardStatus = `<span class="sweep-status sweep-status-owned">MAXED (T${minion.maxTier || 11})</span>`;
  } else {
    cardStatus = `<span class="sweep-status sweep-status-next">Next: T${nextTier}</span>`;
  }

  const categoryColor = minion.category === "Mining" ? "#5c85d6"
    : minion.category === "Foraging" ? "#e68a00"
    : minion.category === "Farming" ? "#47d147"
    : minion.category === "Combat" ? "#ff3333"
    : "#33ccff";

  let bodyHTML = "";
  if (isMaxed) {
    bodyHTML = `
      <div class="sweep-owned-note">
        All standard upgrades complete. You have crafted this minion to its max tier.
      </div>`;
  } else {
    const itemsHTML = items.map((it) => {
      const bzCmd = sweepBazaarCommand(it.id);
      return `
        <div class="minion-recipe-row">
          <span class="minion-recipe-item">
            <span class="pos" style="font-weight: bold;">${it.qty}×</span> ${escapeHtml(it.id.replace(/_/g, " ").replace(/:.*/g, ""))}
            <span class="num-muted">(@ ${it.unitPrice ? fmtCoins(it.unitPrice) : "unknown"})</span>
          </span>
          <button class="btn-copy btn-small" data-copy="${escapeHtml(bzCmd)}" title="Copy /bz command">Copy</button>
        </div>`;
    }).join("");

    bodyHTML = `
      <div class="minion-recipe-list">
        ${itemsHTML}
      </div>`;
  }

  // Max this minion section
  const startFromLvl1 = state.minionStartFromLvl1;
  const currentLevelForMax = startFromLvl1 ? 0 : currentTier;
  const isExpanded = !!state.expandedMinions[minion.id];

  let maxUpgradeHTML = "";
  if (currentLevelForMax < (minion.maxTier || 11)) {
    const maxUpgrade = calculateUpgradeCost(minion, currentLevelForMax, minion.maxTier || 11, state.raw?.products, state.bazaarMode);
    if (maxUpgrade && maxUpgrade.items && maxUpgrade.items.length > 0) {
      const maxItemsHTML = maxUpgrade.items.map((it) => {
        const bzCmd = sweepBazaarCommand(it.id);
        return `
          <div class="minion-recipe-row">
            <span class="minion-recipe-item">
              <span class="pos" style="font-weight: bold;">${it.qty}×</span> ${escapeHtml(it.id.replace(/_/g, " ").replace(/:.*/g, ""))}
              <span class="num-muted">(@ ${it.unitPrice ? fmtCoins(it.unitPrice) : "unknown"})</span>
            </span>
            <button class="btn-copy btn-small" data-copy="${escapeHtml(bzCmd)}" title="Copy /bz command">Copy</button>
          </div>`;
      }).join("");

      const allBzCmds = maxUpgrade.items.map(it => sweepBazaarCommand(it.id)).join("\n");

      maxUpgradeHTML = `
        <div class="minion-max-section">
          <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <button class="btn-secondary btn-small btn-max-toggle ${isExpanded ? "active" : ""}" data-target="max-details-${minion.id}" data-minion-id="${minion.id}" style="flex-grow: 1; text-align: center; justify-content: center; font-size: 11.5px; height: 28px;">
              Max to T${minion.maxTier || 11} Shopping List
            </button>
            <button class="btn-secondary btn-small btn-copy" data-copy="${escapeHtml(allBzCmds)}" title="Copy all /bz commands to clipboard" style="height: 28px; font-size: 11.5px;">
              Copy All
            </button>
          </div>
          <div class="minion-max-details" id="max-details-${minion.id}" style="display: ${isExpanded ? "block" : "none"};">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px; display: flex; justify-content: space-between; padding: 0 4px;">
              <span>Total T11 Cost:</span>
              <span style="font-weight: bold; color: var(--ember-light);">${maxUpgrade.totalCost != null ? fmtCoins(maxUpgrade.totalCost) : "unknown"}</span>
            </div>
            <div class="minion-recipe-list">
              ${maxItemsHTML}
            </div>
          </div>
        </div>`;
    }
  }

  return `
    <article class="sweep-card ${isMaxed ? "sweep-card--owned" : ""}">
      <span class="sweep-rank">${idx + 1}</span>
      <div class="sweep-main">
        <div class="sweep-card-head">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="minion-card-icon-wrapper" style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border: 1px solid var(--surface-line); border-radius: var(--r-md); padding: 4px; flex-shrink: 0;">
              <img src="${getUniversalItemIconUrl(minionItemId)}" alt="" class="minion-card-icon" style="max-width: 100%; max-height: 100%; object-fit: contain; image-rendering: pixelated;" onerror="${fallbackToSkyCryptItemOnError(minionItemId)}">
            </div>
            <div>
              <h3 class="sweep-card-title">${escapeHtml(minion.name)} Minion</h3>
              <div class="sweep-meta">
                <span style="color: ${categoryColor}; font-weight: bold; text-transform: uppercase;">
                  ${minion.category}
                </span>
                <span class="meta-sep">·</span>
                ${cardStatus}
              </div>
            </div>
          </div>
          <div class="minion-manual-row">
            <label for="minion-select-${minion.id}" class="minion-select-label">Current Tier:</label>
            <select id="minion-select-${minion.id}" class="select-native minion-select-tier" data-minion-id="${minion.id}">
              ${selectOpts}
            </select>
          </div>
        </div>

        <div class="sweep-note">
          ${bodyHTML}
        </div>

        <div class="sweep-cost-line">
          ${!isMaxed && totalCost != null ? `
            <span class="sweep-cost">${fmtCoins(totalCost)}</span>
            <span class="sweep-cost-muted">next upgrade cost</span>
          ` : ""}
        </div>

        ${maxUpgradeHTML}
      </div>
    </article>`;
}

function bindMinionsEvents(pane) {
  pane.querySelectorAll(".minion-select-tier").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const id = e.target.dataset.minionId;
      const val = parseInt(e.target.value, 10);
      state.minionManualTiers[id] = val;
      renderMinionsView();
    });
  });

  pane.querySelector("#minion-start-from-lvl1")?.addEventListener("change", (e) => {
    state.minionStartFromLvl1 = e.target.checked;
    renderMinionsView();
  });

  pane.querySelectorAll("[data-minion-bz]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.bazaarMode = btn.dataset.minionBz;
      localStorage.setItem(CONFIG.BAZAAR_MODE_STORAGE, state.bazaarMode);
      renderMinionsView();
      if (state.player.attributeAnalysis) loadAttributeAnalysis();
    });
  });

  pane.querySelectorAll(".btn-max-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const minionId = btn.dataset.minionId;
      const targetId = btn.dataset.target;
      state.expandedMinions[minionId] = !state.expandedMinions[minionId];
      const el = pane.querySelector(`#${targetId}`);
      if (el) {
        const isExpanded = state.expandedMinions[minionId];
        el.style.display = isExpanded ? "block" : "none";
        btn.classList.toggle("active", isExpanded);
      }
    });
  });

  bindCopyButtons(pane);
}

function flashStatus(msg) {
  const el = $("#settings-status");
  el.textContent = msg;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 2000);
}

function init() {
  renderRarityFilters();
  renderSkillFilters();
  renderPlayerPanel();
  bindUI();
  startTimeAgoTicker();
  loadData(false);

  /* If the user previously linked an account, auto-load. */
  if (state.player.username) {
    loadPlayerProfiles(state.player.username);
  }

  /* Auto-refresh every minute. Hits cache silently if data is fresh. */
  setInterval(() => loadData(false), CONFIG.CACHE_TTL_BAZAAR_MS);
}

/* =========================================================================
 * SKYCRYPT STYLE PROFILE VIEWER
 * ======================================================================= */

function getSkillXpAndProgress(xp) {
  if (xp == null || !Number.isFinite(xp) || xp <= 0) {
    return { level: 0, progress: 0, currentXp: 0, nextLevelXp: 50, xpInLevel: 0, xpNeeded: 50 };
  }
  let level = 0;
  for (let i = 0; i < SKILL_XP_TABLE.length; i++) {
    if (xp >= SKILL_XP_TABLE[i]) {
      level = i;
    } else {
      break;
    }
  }
  
  if (level >= SKILL_XP_TABLE.length - 1) {
    return { level, progress: 1.0, currentXp: xp, nextLevelXp: null, xpInLevel: 0, xpNeeded: 0 };
  }
  
  const currentLevelXp = SKILL_XP_TABLE[level];
  const nextLevelXp = SKILL_XP_TABLE[level + 1];
  const xpNeeded = nextLevelXp - currentLevelXp;
  const xpInLevel = xp - currentLevelXp;
  const progress = Math.min(1.0, Math.max(0.0, xpInLevel / xpNeeded));
  
  return { level, progress, currentXp: xp, nextLevelXp, xpInLevel, xpNeeded };
}

function getSlayerLvlAndProgress(xp, isVampire = false) {
  const table = isVampire ? 
    [0, 20, 75, 240, 840, 3400, 15000, 50000, 140000, 300000] :
    [0, 10, 50, 250, 1500, 5000, 20000, 100000, 400000, 1000000];
    
  if (xp == null || !Number.isFinite(xp) || xp <= 0) {
    return { level: 0, progress: 0, xpInLevel: 0, xpNeeded: table[1] };
  }
  
  let level = 0;
  for (let i = 0; i < table.length; i++) {
    if (xp >= table[i]) {
      level = i;
    } else {
      break;
    }
  }
  
  if (level >= table.length - 1) {
    return { level, progress: 1.0, xpInLevel: xp - table[level], xpNeeded: null };
  }
  
  const currentLevelXp = table[level];
  const nextLevelXp = table[level + 1];
  const xpNeeded = nextLevelXp - currentLevelXp;
  const xpInLevel = xp - currentLevelXp;
  const progress = Math.min(1.0, Math.max(0.0, xpInLevel / xpNeeded));
  
  return { level, progress, xpInLevel, xpNeeded };
}

function getDungeonLvlAndProgress(xp) {
  const table = [0, 50, 125, 235, 395, 625, 955, 1425, 2095, 3045, 4385, 6275, 8940, 12700, 17960, 25340, 35640, 50040, 70040, 97640, 135640, 188140, 259640, 356640, 488640, 668640, 911640, 1239640, 1684640, 2284640, 3084640, 4149640, 5559640, 7419640, 9859640, 13039640, 17139640, 22439640, 29189640, 37789640, 48689640, 62389640, 79389640, 100389640, 126389640, 158389640, 197389640, 244389640, 301389640, 369389640, 449389640];
  
  if (xp == null || !Number.isFinite(xp) || xp <= 0) {
    return { level: 0, progress: 0, xpInLevel: 0, xpNeeded: table[1] };
  }
  
  let level = 0;
  for (let i = 0; i < table.length; i++) {
    if (xp >= table[i]) {
      level = i;
    } else {
      break;
    }
  }
  
  if (level >= table.length - 1) {
    return { level, progress: 1.0, xpInLevel: xp - table[level], xpNeeded: null };
  }
  
  const currentLevelXp = table[level];
  const nextLevelXp = table[level + 1];
  const xpNeeded = nextLevelXp - currentLevelXp;
  const xpInLevel = xp - currentLevelXp;
  const progress = Math.min(1.0, Math.max(0.0, xpInLevel / xpNeeded));
  
  return { level, progress, xpInLevel, xpNeeded };
}

function getPetLevel(xp, rarity) {
  if (xp == null || !Number.isFinite(xp) || xp <= 0) return 1;
  const r = rarity?.toUpperCase() || "LEGENDARY";
  let maxXP = 25353230;
  if (r === "COMMON") maxXP = 5624785;
  else if (r === "UNCOMMON") maxXP = 8644475;
  else if (r === "RARE") maxXP = 12624785;
  else if (r === "EPIC") maxXP = 18624785;
  
  if (xp >= maxXP) return 100;
  const ratio = xp / maxXP;
  let level = Math.floor(100 * Math.pow(ratio, 0.28));
  return Math.max(1, Math.min(99, level));
}

function getPetIconId(type) {
  const normalized = String(type || "").toUpperCase();
  return normalized ? `PET_${normalized}` : "BONE";
}

/* =========================================================================
 * MINECRAFT COLOR & STYLE HELPERS (SKYCRYPT LOOKS)
 * ======================================================================= */

function minecraftToHtml(text) {
  if (!text) return "";
  const colorMap = {
    '0': '#000000', '1': '#0000aa', '2': '#00aa00', '3': '#00aaaa',
    '4': '#aa0000', '5': '#aa00aa', '6': '#ffaa00', '7': '#aaaaaa',
    '8': '#555555', '9': '#5555ff', 'a': '#55ff55', 'b': '#55ffff',
    'c': '#ff5555', 'd': '#ff55ff', 'e': '#ffff55', 'f': '#ffffff'
  };
  
  let html = "";
  let currentSpan = false;
  let parts = text.split("§");
  
  html += escapeHtml(parts[0]);
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.length === 0) continue;
    const code = part[0].toLowerCase();
    const content = part.slice(1);
    
    if (colorMap[code]) {
      if (currentSpan) {
        html += "</span>";
      }
      html += `<span style="color: ${colorMap[code]};">`;
      currentSpan = true;
    } else if (code === 'r') {
      if (currentSpan) {
        html += "</span>";
        currentSpan = false;
      }
    } else if (code === 'l') { // bold
      if (currentSpan) {
        html += "</span>";
      }
      html += `<span style="font-weight: bold;">`;
      currentSpan = true;
    }
    html += escapeHtml(content);
  }
  if (currentSpan) {
    html += "</span>";
  }
  return html;
}

function stripColorCodes(text) {
  if (!text) return "";
  return text.replace(/§[0-9a-fk-or]/gi, "");
}

function getRarityColor(tier) {
  const map = {
    COMMON: "#ffffff",
    UNCOMMON: "#55ff55",
    RARE: "#55ffff",
    EPIC: "#aa00aa",
    LEGENDARY: "#ffaa00",
    MYTHIC: "#ff55ff",
    SPECIAL: "#ff5555",
    VERY_SPECIAL: "#ff5555"
  };
  return map[tier?.toUpperCase()] || "#ffffff";
}

function renderGearSlotHTML(item, defaultIconId, slotName) {
  if (!item) {
    return `
      <div class="profile-gear-slot empty" title="Empty ${slotName} Slot">
        <div class="profile-gear-icon-placeholder">${mcIconHTML(defaultIconId, "profile-gear-placeholder-img", slotName)}</div>
        <div class="profile-gear-details">
          <div class="profile-gear-name-placeholder">No ${slotName}</div>
          <div class="profile-gear-type">${slotName}</div>
        </div>
      </div>`;
  }

  const itemName = item.rawTag?.display?.Name || item.skyblockId || "Unknown Item";
  const recombobulated = item.recombobulated;
  const loreLines = item.rawTag?.display?.Lore || [];
  const loreHTML = loreLines.map(line => `<div>${minecraftToHtml(line)}</div>`).join("");

  return `
    <div class="profile-gear-slot tooltip-container">
      <div class="profile-gear-icon">
        <img src="${getUniversalItemIconUrl(item.skyblockId)}" alt="" class="profile-gear-icon-img" onerror="${fallbackToSkyCryptItemOnError(item.skyblockId)}">
        
      </div>
      <div class="profile-gear-details">
        <div class="profile-gear-name" style="color: ${getRarityColor(item.rawTag?.ExtraAttributes?.rarity || 'COMMON')}">
          ${minecraftToHtml(itemName)}
        </div>
        <div class="profile-gear-type">
          ${slotName} ${recombobulated ? `<span class="recomb-star" title="Recombobulated">Recombed</span>` : ""}
        </div>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-name" style="color: ${getRarityColor(item.rawTag?.ExtraAttributes?.rarity || 'COMMON')}">
          ${minecraftToHtml(itemName)}
        </div>
        <div class="tooltip-lore">${loreHTML}</div>
      </div>
    </div>`;
}

function renderHotbarSlotHTML(item, index) {
  if (!item) {
    return `<div class="profile-hotbar-slot empty" title="Slot ${index + 1}"></div>`;
  }

  const itemName = item.rawTag?.display?.Name || item.skyblockId || "Unknown Item";
  const loreLines = item.rawTag?.display?.Lore || [];
  const loreHTML = loreLines.map(line => `<div>${minecraftToHtml(line)}</div>`).join("");

  return `
    <div class="profile-hotbar-slot tooltip-container">
      <div class="profile-hotbar-icon" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
        <img src="${getUniversalItemIconUrl(item.skyblockId)}" alt="" class="profile-gear-icon-img" onerror="${fallbackToSkyCryptItemOnError(item.skyblockId)}">
      </div>
      ${item.count > 1 ? `<span class="profile-hotbar-count">${item.count}</span>` : ""}
      <div class="tooltip-content">
        <div class="tooltip-name" style="color: ${getRarityColor(item.rawTag?.ExtraAttributes?.rarity || 'COMMON')}">
          ${minecraftToHtml(itemName)}
        </div>
        <div class="tooltip-lore">${loreHTML}</div>
      </div>
    </div>`;
}

function renderProfileView() {
  const pane = $("#view-profile");
  if (!pane) return;
  
  const p = state.player;
  
  if (!p.username) {
    pane.innerHTML = accessoryGateHTML("The Profile Viewer");
    return;
  }
  
  if (p.loading) {
    pane.innerHTML = accessoryLoadingHTML("Loading profile data...");
    return;
  }
  
  const prof = p.profiles.find((pr) => pr.profile_id === p.selectedId);
  const member = prof?._raw?.members?.[p.uuid];
  
  if (!member) {
    pane.innerHTML = `
      <div class="acc-gate">
        <div class="acc-gate-icon">${gateIconHTML("BARRIER", "Warning")}</div>
        <h2>No member data found</h2>
        <p>Could not find active profile data for this member. Please try switching profiles or re-linking.</p>
      </div>`;
    return;
  }
  
  const stats = p.extra || {};
  const coinPurse = p.coinPurse;
  const bank = stats.bank;
  const sbLevel = stats.sbLevel;
  const gameMode = prof?.game_mode || "Normal";
  
  // Format numbers nicely
  const formatNum = (num) => num != null ? num.toLocaleString() : "—";
  const formatCoinsShort = (num) => {
    if (num == null) return "—";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(1) + "k";
    return num.toFixed(0);
  };

  // 1. Skill progress rendering
  const SKILLS_META = [
    { key: "SKILL_COMBAT", name: "Combat", icon: "DIAMOND_SWORD", color: "#ff3333" },
    { key: "SKILL_MINING", name: "Mining", icon: "DIAMOND_PICKAXE", color: "#5c85d6" },
    { key: "SKILL_FARMING", name: "Farming", icon: "WHEAT", color: "#47d147" },
    { key: "SKILL_FORAGING", name: "Foraging", icon: "DIAMOND_AXE", color: "#e68a00" },
    { key: "SKILL_FISHING", name: "Fishing", icon: "FISHING_ROD", color: "#33ccff" },
    { key: "SKILL_ALCHEMY", name: "Alchemy", icon: "BREWING_STAND", color: "#b347ff" },
    { key: "SKILL_ENCHANTING", name: "Enchanting", icon: "ENCHANTING_TABLE", color: "#ff47b3" },
    { key: "SKILL_TAMING", name: "Taming", icon: "BONE", color: "#ffd24d" },
    { key: "SKILL_CARPENTRY", name: "Carpentry", icon: "CRAFTING_TABLE", color: "#a67c52" },
    { key: "SKILL_RUNECRAFTING", name: "Runecrafting", icon: "ENCHANTED_BOOK", color: "#ff99ff" },
  ];
  
  const skillExp = member.player_data?.experience || {};
  const skillsHTML = SKILLS_META.map(skill => {
    const xp = skillExp[skill.key] || 0;
    const { level, progress, xpInLevel, xpNeeded } = getSkillXpAndProgress(xp);
    const pct = (progress * 100).toFixed(0);
    const isMax = level >= 60 || xpNeeded === 0;
    
    return `
      <div class="profile-skill-row" title="${skill.name} Skill Details">
        <div class="profile-skill-icon" style="background: rgba(${skill.color === "#ff3333" ? "255,51,51" : skill.color === "#5c85d6" ? "92,133,214" : skill.color === "#47d147" ? "71,209,71" : skill.color === "#e68a00" ? "230,138,0" : "51,204,255"}, 0.1); color: ${skill.color}">
          ${mcIconHTML(skill.icon, "profile-skill-icon-img", skill.name)}
        </div>
        <div class="profile-skill-info">
          <div class="profile-skill-name-row">
            <span class="profile-skill-name">${skill.name}</span>
            <span class="profile-skill-level">Lvl ${level}</span>
          </div>
          <div class="profile-progress-bg">
            <div class="profile-progress-bar" style="width: ${pct}%; background: ${skill.color};"></div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 10px; color: var(--text-muted);">${isMax ? "Max Level" : `${pct}% to next`}</span>
            <span class="profile-skill-tooltip-text">${isMax ? formatNum(xp) : `${formatNum(xpInLevel)} / ${formatNum(xpNeeded)}`}</span>
          </div>
        </div>
      </div>`;
  }).join("");

  // 2. Slayer rendering
  const SLAYERS_META = [
    { key: "zombie", name: "Revenant Horror", icon: "ROTTEN_FLESH" },
    { key: "spider", name: "Tarantula", icon: "SPIDER_EYE" },
    { key: "wolf", name: "Sven Packmaster", icon: "BONE" },
    { key: "enderman", name: "Voidgloom Seraph", icon: "ENDER_PEARL" },
    { key: "blaze", name: "Infernum Demonlord", icon: "BLAZE_ROD" },
    { key: "vampire", name: "Riftstalker", icon: "REDSTONE", isVampire: true },
  ];
  
  const slayersHTML = SLAYERS_META.map(sl => {
    const sData = member.slayer?.slayer_bosses?.[sl.key] || {};
    const xp = sData.xp || 0;
    const { level, progress, xpInLevel, xpNeeded } = getSlayerLvlAndProgress(xp, sl.isVampire);
    const pct = xpNeeded ? (progress * 100).toFixed(0) : "100";
    const isMax = level >= 9 || xpNeeded === null;
    
    return `
      <div class="profile-skill-row" title="${sl.name} Slayer Details">
        <div class="profile-skill-icon" style="background: rgba(255, 51, 51, 0.05); color: #ff3333;">
          ${mcIconHTML(sl.icon, "profile-skill-icon-img", sl.name)}
        </div>
        <div class="profile-skill-info">
          <div class="profile-skill-name-row">
            <span class="profile-skill-name">${sl.name}</span>
            <span class="profile-skill-level">Lvl ${level}</span>
          </div>
          <div class="profile-progress-bg">
            <div class="profile-progress-bar" style="width: ${pct}%; background: linear-gradient(90deg, #ff3333, #b30000);"></div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 10px; color: var(--text-muted);">${isMax ? "Max Level" : `${pct}% to next`}</span>
            <span class="profile-skill-tooltip-text">${isMax ? `${formatNum(xp)} XP` : `${formatNum(xpInLevel)} / ${formatNum(xpNeeded)} XP`}</span>
          </div>
        </div>
      </div>`;
  }).join("");

  // 3. Dungeon level rendering
  const dungeonExp = member.dungeons?.dungeon_types?.catacombs?.experience || 0;
  const cata = getDungeonLvlAndProgress(dungeonExp);
  const cataPct = cata.xpNeeded ? (cata.progress * 100).toFixed(0) : "100";
  
  const CLASSES_META = [
    { key: "mage", name: "Mage", icon: "ENCHANTED_BOOK", color: "#33ccff" },
    { key: "archer", name: "Archer", icon: "BOW", color: "#ff3333" },
    { key: "berserk", name: "Berserk", icon: "IRON_SWORD", color: "#ff9933" },
    { key: "tank", name: "Tank", icon: "SHIELD", color: "#47d147" },
    { key: "healer", name: "Healer", icon: "GOLDEN_APPLE", color: "#ff99ff" },
  ];
  
  const classesHTML = CLASSES_META.map(cl => {
    const xp = member.dungeons?.player_classes?.[cl.key]?.experience || 0;
    const { level, progress, xpInLevel, xpNeeded } = getDungeonLvlAndProgress(xp);
    const pct = xpNeeded ? (progress * 100).toFixed(0) : "100";
    const isMax = level >= 50 || xpNeeded === null;
    
    return `
      <div class="profile-skill-row" title="${cl.name} Class Details">
        <div class="profile-skill-icon" style="background: rgba(255, 255, 255, 0.05); color: ${cl.color};">
          ${mcIconHTML(cl.icon, "profile-skill-icon-img", cl.name)}
        </div>
        <div class="profile-skill-info">
          <div class="profile-skill-name-row">
            <span class="profile-skill-name">${cl.name}</span>
            <span class="profile-skill-level">Lvl ${level}</span>
          </div>
          <div class="profile-progress-bg">
            <div class="profile-progress-bar" style="width: ${pct}%; background: ${cl.color};"></div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 10px; color: var(--text-muted);">${isMax ? "Max Level" : `${pct}% to next`}</span>
            <span class="profile-skill-tooltip-text">${isMax ? `${formatNum(xp)} XP` : `${formatNum(xpInLevel)} / ${formatNum(xpNeeded)} XP`}</span>
          </div>
        </div>
      </div>`;
  }).join("");

  // 4. Pets rendering
  const petsList = member.pets_data?.pets || member.pets || [];
  let petsHTML = "";
  if (petsList.length === 0) {
    petsHTML = `<div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 13px;">No pets found on this profile.</div>`;
  } else {
    const rarityWeights = { MYTHIC: 6, LEGENDARY: 5, EPIC: 4, RARE: 3, UNCOMMON: 2, COMMON: 1 };
    const sortedPets = [...petsList].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const rA = rarityWeights[a.tier?.toUpperCase()] || 0;
      const rB = rarityWeights[b.tier?.toUpperCase()] || 0;
      if (rA !== rB) return rB - rA;
      return (b.exp || 0) - (a.exp || 0);
    });
    
    petsHTML = `
      <div class="profile-pets-container">
        ${sortedPets.map(pet => {
          const petLvl = getPetLevel(pet.exp, pet.tier);
          const petIconId = getPetIconId(pet.type);
          const rarityClass = `pet-rarity-${pet.tier?.toLowerCase() || "common"}`;
          const cleanName = pet.type?.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || "Pet";
          
          return `
            <div class="profile-pet-card ${rarityClass}" title="${pet.tier || "COMMON"} ${cleanName} - Exp: ${formatNum(pet.exp || 0)}">
              ${pet.active ? `<span class="profile-pet-active-badge"></span>` : ""}
              <div class="profile-pet-icon">
                <img src="${getUniversalItemIconUrl(petIconId)}" alt="" class="profile-gear-icon-img" onerror="${fallbackToSkyCryptItemOnError(petIconId)}">
              </div>
              <div class="profile-pet-level">Lvl ${petLvl}</div>
              <div class="profile-pet-name">${cleanName}</div>
            </div>`;
        }).join("")}
      </div>`;
  }

  // 5. Gear & Hotbar Rendering (Overview Tab)
  let gearContentHTML = "";
  if (p.profileInventoryLoading) {
    gearContentHTML = `<div style="padding: 40px; text-align: center;"><span class="spinner"></span> Decoding player inventory NBT...</div>`;
  } else if (p.inventoryError) {
    gearContentHTML = `
      <div style="padding: 24px; text-align: center; color: var(--text-muted); background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.06); border-radius: 8px;">
        <div style="margin-bottom: 12px; display: grid; place-items: center;">${gateIconHTML("BARRIER", "Inventory locked")}</div>
        <h4 style="color: #fff; font-family: var(--font-display); font-size: 15px;">${p.inventoryError}</h4>
        <p style="font-size: 12px; margin-top: 8px; line-height: 1.6; max-width: 460px; margin-left: auto; margin-right: auto;">
          To display your equipped gear, weapons, and inventory like SkyCrypt, enable your <strong>Inventory API</strong> in Hypixel settings:
          in-game open the SkyBlock menu (or run <code>/api</code>) to Settings, then API Settings, then Enable Inventory API.
        </p>
      </div>`;
  } else {
    const armor = p.equippedArmor || [];
    const equip = p.equippedEquipment || [];
    const hotbar = p.hotbar || [];

    const helmet = armor.find(it => it.slotIndex === 3);
    const chestplate = armor.find(it => it.slotIndex === 2);
    const leggings = armor.find(it => it.slotIndex === 1);
    const boots = armor.find(it => it.slotIndex === 0);

    const necklace = equip.find(it => it.slotIndex === 0);
    const cloak = equip.find(it => it.slotIndex === 1);
    const belt = equip.find(it => it.slotIndex === 2);
    const gloves = equip.find(it => it.slotIndex === 3);

    const hotbarSlots = [];
    for (let i = 0; i < 9; i++) {
      hotbarSlots.push(hotbar.find(it => it.slotIndex === i) || null);
    }

    gearContentHTML = `
      <div class="profile-gear-container">
        <!-- Armor -->
        <div class="profile-gear-section">
          <h4>${mcIconHTML("DIAMOND_CHESTPLATE", "inline-mc-icon", "Armor")} Equipped Armor</h4>
          <div class="profile-gear-list">
            ${renderGearSlotHTML(helmet, "DIAMOND_HELMET", "Helmet")}
            ${renderGearSlotHTML(chestplate, "DIAMOND_CHESTPLATE", "Chestplate")}
            ${renderGearSlotHTML(leggings, "DIAMOND_LEGGINGS", "Leggings")}
            ${renderGearSlotHTML(boots, "DIAMOND_BOOTS", "Boots")}
          </div>
        </div>

        <!-- Equipment -->
        <div class="profile-gear-section">
          <h4>${mcIconHTML("DAY_CRYSTAL", "inline-mc-icon", "Equipment")} Equipment</h4>
          <div class="profile-gear-list">
            ${renderGearSlotHTML(necklace, "DAY_CRYSTAL", "Necklace")}
            ${renderGearSlotHTML(cloak, "CLOAK", "Cloak")}
            ${renderGearSlotHTML(belt, "BELT", "Belt")}
            ${renderGearSlotHTML(gloves, "GLOVES", "Gloves")}
          </div>
        </div>
      </div>

      <!-- Hotbar -->
      <div style="margin-top: 24px;">
        <h4 style="font-family: var(--font-display); font-size: 14px; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; margin-bottom: 8px; border-left: 3px solid var(--ember); padding-left: 8px;">${mcIconHTML("CHEST", "inline-mc-icon", "Hotbar")} Hotbar</h4>
        <div class="profile-hotbar-grid">
          ${hotbarSlots.map((it, idx) => renderHotbarSlotHTML(it, idx)).join("")}
        </div>
      </div>
    `;
  }

  // 6. Accessories tab content
  const RARITY_ORDER = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"];
  let accessoriesContentHTML = "";
  if (!p.ownedAccessories) {
    accessoriesContentHTML = `<div style="padding: 40px; text-align: center;"><span class="spinner"></span> Analyzing accessory bag...</div>`;
  } else if (p.ownedAccessories.size === 0) {
    accessoriesContentHTML = `<div style="padding: 40px; text-align: center; color: var(--text-muted);">No accessories found in your talisman bag, inventory, or ender chest. Make sure they are in your accessory bag in-game!</div>`;
  } else {
    const ownedList = [];
    for (const [id, meta] of p.ownedAccessories.entries()) {
      const item = state.accessoryCatalog?.byId?.[id];
      if (item) {
        const recombed = meta.recombobulated === true;
        const currentMp = item.mp + (recombed ? (recombGain(item)?.mpGain || 0) : 0);
        ownedList.push({
          id,
          name: item.name,
          tier: recombed ? (RARITY_ORDER[RARITY_ORDER.indexOf(item.tier) + 1] || item.tier) : item.tier,
          baseTier: item.tier,
          mp: currentMp,
          recombed
        });
      }
    }

    // Sort by Magical Power (highest first)
    ownedList.sort((a, b) => b.mp - a.mp || a.name.localeCompare(b.name));

    accessoriesContentHTML = `
      <div class="profile-accessories-info">
        <div class="profile-header-stat-box" style="min-width: 110px;">
          <span class="profile-header-stat-label">Unique Talismans</span>
          <span class="profile-header-stat-value" style="color: #ffb347;">${ownedList.length}</span>
        </div>
        <div class="profile-header-stat-box" style="min-width: 110px;">
          <span class="profile-header-stat-label">Recombobulated</span>
          <span class="profile-header-stat-value" style="color: #ff55ff;">${ownedList.filter(it => it.recombed).length}</span>
        </div>
        <div class="profile-header-stat-box" style="min-width: 110px;">
          <span class="profile-header-stat-label">Bag Magical Power</span>
          <span class="profile-header-stat-value" style="color: #33ccff;">${p.accessoryAnalysis?.currentMP || 0} MP</span>
        </div>
      </div>

      <div class="profile-accessories-grid">
        ${ownedList.map(it => `
          <div class="profile-accessory-card tooltip-container" style="border-color: rgba(${it.baseTier === 'COMMON' ? '150,150,150' : it.baseTier === 'UNCOMMON' ? '71,209,71' : it.baseTier === 'RARE' ? '90,185,255' : it.baseTier === 'EPIC' ? '179,71,255' : it.baseTier === 'LEGENDARY' ? '255,179,71' : '255,71,179'}, 0.2)">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
              <img src="${getUniversalItemIconUrl(it.id)}" alt="" style="width: 20px; height: 20px; image-rendering: pixelated; object-fit: contain;" onerror="${fallbackToSkyCryptItemOrHideOnError(it.id)}">
              <span class="profile-accessory-name" style="color: ${getRarityColor(it.tier)}">
                ${it.recombed ? '[R] ' : ''}${escapeHtml(it.name)}
              </span>
            </div>
            <span class="profile-accessory-mp">+${it.mp} MP</span>
            
            <div class="tooltip-content">
              <div class="tooltip-name" style="color: ${getRarityColor(it.tier)}">
                ${it.recombed ? '[R] ' : ''}${escapeHtml(it.name)}
              </div>
              <div class="tooltip-lore">
                <div>Rarity: <strong style="color: ${getRarityColor(it.tier)};">${it.tier}</strong></div>
                <div>Magical Power: <strong style="color: #33ccff;">+${it.mp} MP</strong></div>
                ${it.recombed ? `<div><span style="color: var(--ember);">Recombobulated</span> (+${recombGain(state.accessoryCatalog.byId[it.id])?.mpGain || 0} MP)</div>` : ''}
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Define sub-tabs
  const subtabs = [
    { id: "overview", label: "Gear & Overview", icon: "DIAMOND_CHESTPLATE" },
    { id: "skills", label: "Skills", icon: "EXPERIENCE_BOTTLE" },
    { id: "slayers", label: "Slayers", icon: "DIAMOND_SWORD" },
    { id: "dungeons", label: "Dungeons", icon: "WITHER_SKELETON_SKULL" },
    { id: "pets", label: "Pets", icon: "BONE" },
    { id: "accessories", label: "Accessories", icon: "DAY_CRYSTAL" }
  ];

  const tabsHTML = `
    <nav class="profile-tabs" role="tablist" aria-label="Profile Sections">
      ${subtabs.map(tab => `
        <button class="profile-tab ${state.profileSubTab === tab.id ? 'active' : ''}" data-subtab="${tab.id}">
          <span>${mcIconHTML(tab.icon, "profile-tab-icon-img", tab.label)}</span> ${tab.label}
        </button>
      `).join("")}
    </nav>
  `;

  // Determine active tab HTML content
  let activeTabHTML = "";
  if (state.profileSubTab === "overview") {
    activeTabHTML = gearContentHTML;
  } else if (state.profileSubTab === "skills") {
    activeTabHTML = `
      <section class="profile-section-card" aria-label="Skills progress" style="animation: fadeIn 0.2s ease-out;">
        <h3 class="profile-section-title">
          ${mcIconHTML("EXPERIENCE_BOTTLE", "inline-mc-icon", "Skills")} Skills Collection
        </h3>
        <div class="profile-items-grid">
          ${skillsHTML}
        </div>
      </section>
    `;
  } else if (state.profileSubTab === "slayers") {
    activeTabHTML = `
      <section class="profile-section-card" aria-label="Slayers progress" style="animation: fadeIn 0.2s ease-out;">
        <h3 class="profile-section-title">
          ${mcIconHTML("DIAMOND_SWORD", "inline-mc-icon", "Slayers")} Slayer Bosses
        </h3>
        <div class="profile-items-grid">
          ${slayersHTML}
        </div>
      </section>
    `;
  } else if (state.profileSubTab === "dungeons") {
    activeTabHTML = `
      <section class="profile-section-card" aria-label="Dungeon info" style="animation: fadeIn 0.2s ease-out;">
        <h3 class="profile-section-title">
          ${mcIconHTML("WITHER_SKELETON_SKULL", "inline-mc-icon", "Dungeons")} Dungeon &amp; Classes
        </h3>
        <div class="profile-items-grid">
          <!-- Catacombs Primary -->
          <div class="profile-skill-row" style="border-color: rgba(90, 185, 255, 0.15);" title="Catacombs Progression Details">
            <div class="profile-skill-icon" style="background: rgba(90, 185, 255, 0.1); color: #33ccff;">${mcIconHTML("WITHER_SKELETON_SKULL", "profile-skill-icon-img", "Catacombs")}</div>
            <div class="profile-skill-info">
              <div class="profile-skill-name-row">
                <span class="profile-skill-name" style="color: #fff; font-weight: 800;">Catacombs Level</span>
                <span class="profile-skill-level" style="color: #33ccff;">Lvl ${cata.level}</span>
              </div>
              <div class="profile-progress-bg">
                <div class="profile-progress-bar" style="width: ${cataPct}%; background: #33ccff;"></div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                <span style="font-size: 10px; color: var(--text-muted);">${cata.xpNeeded ? `${cataPct}% to next` : "Max Level"}</span>
                <span class="profile-skill-tooltip-text">${cata.xpNeeded ? `${formatNum(cata.xpInLevel)} / ${formatNum(cata.xpNeeded)} XP` : `${formatNum(dungeonExp)} XP`}</span>
              </div>
            </div>
          </div>
          
          <!-- Class list -->
          ${classesHTML}
        </div>
      </section>
    `;
  } else if (state.profileSubTab === "pets") {
    activeTabHTML = `
      <section class="profile-section-card" aria-label="Pets collection" style="animation: fadeIn 0.2s ease-out;">
        <h3 class="profile-section-title">
          ${mcIconHTML("BONE", "inline-mc-icon", "Pets")} Pets Collection (${petsList.length})
        </h3>
        ${petsHTML}
      </section>
    `;
  } else if (state.profileSubTab === "accessories") {
    activeTabHTML = `
      <section class="profile-section-card" aria-label="Accessories collection" style="animation: fadeIn 0.2s ease-out;">
        <h3 class="profile-section-title">
          ${mcIconHTML("DAY_CRYSTAL", "inline-mc-icon", "Accessories")} Accessory Bag &amp; Talismans
        </h3>
        ${accessoriesContentHTML}
      </section>
    `;
  }

  // Combine everything into pane inner HTML
  pane.innerHTML = `
    <div class="profile-view-container">
      
      <!-- General Header Profile Info -->
      <header class="profile-header-card">
        <div class="profile-header-left">
          <div class="profile-avatar-wrapper">
            <img class="profile-avatar" src="https://mc-heads.net/avatar/${encodeURIComponent(p.uuid)}/64" alt="${escapeHtml(p.username)}">
            <span class="profile-sb-level-badge" title="SkyBlock Level">${sbLevel || "0"}</span>
          </div>
          <div class="profile-meta-info">
            <h2 class="profile-username">
              ${escapeHtml(p.username)}
              <span class="profile-mode-badge ${gameMode.toLowerCase() === "ironman" ? "ironman" : ""}">${gameMode}</span>
            </h2>
            <div class="profile-selected-name">
              Active Profile: <strong style="color: #fff;">${escapeHtml(prof?.cute_name || "Unknown")}</strong>
            </div>
          </div>
        </div>
        
        <div class="profile-header-right">
          <div class="profile-header-stat-box" title="Available cash in purse">
            <span class="profile-header-stat-label">Purse Coins</span>
            <span class="profile-header-stat-value" style="color: #ffd700;">${coinPurse != null ? formatCoinsShort(coinPurse) : "0"}</span>
          </div>
          <div class="profile-header-stat-box" title="Cash stored in banking">
            <span class="profile-header-stat-label">Bank Coins</span>
            <span class="profile-header-stat-value" style="color: #5c85d6;">${bank != null ? formatCoinsShort(bank) : "—"}</span>
          </div>
          <div class="profile-header-stat-box" title="Total Slayer Boss Points">
            <span class="profile-header-stat-label">Slayer XP</span>
            <span class="profile-header-stat-value" style="color: #ff3333;">${stats.slayerXp ? formatCoinsShort(stats.slayerXp) : "0"}</span>
          </div>
          <div class="profile-header-stat-box" title="Magical Power from Accessory Bag">
            <span class="profile-header-stat-label">Magical Power</span>
            <span class="profile-header-stat-value" style="color: #33ccff;">${p.accessoryAnalysis ? p.accessoryAnalysis.currentMP : "—"}</span>
          </div>
        </div>
      </header>

      <!-- Sub-tab Navigation menu -->
      ${tabsHTML}

      <!-- Main Active Sub-tab View -->
      <div class="profile-subtab-pane">
        ${activeTabHTML}
      </div>

    </div>`;

  // Bind event listeners to profile sub-tabs
  pane.querySelectorAll(".profile-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.profileSubTab = tab.dataset.subtab;
      renderActiveView();
    });
  });
}

/* =========================================================================
 * VIEW: P2W CALCULATOR
 * ======================================================================= */

const GEM_PACKAGES = [
  { gems: 17000, cost: 131.99, name: "17,000 SkyBlock Gems" },
  { gems: 7600,  cost: 65.99,  name: "7,600 SkyBlock Gems" },
  { gems: 3750,  cost: 32.99,  name: "3,750 SkyBlock Gems" },
  { gems: 1800,  cost: 16.49,  name: "1,800 SkyBlock Gems" },
  { gems: 700,   cost: 6.59,   name: "700 SkyBlock Gems" }
];

function optimizeGems(targetGems) {
  if (targetGems <= 0) return { cost: 0, packages: {}, gemsObtained: 0, surplus: 0 };
  
  let preBuyCount = 0;
  let remainingGems = targetGems;
  const threshold = 100000;
  
  if (remainingGems > threshold) {
    const excess = remainingGems - threshold;
    preBuyCount = Math.floor(excess / 17000) + 1;
    remainingGems -= preBuyCount * 17000;
    if (remainingGems < 0) remainingGems = 0;
  }
  
  const unit = 50;
  const targetUnits = Math.ceil(remainingGems / unit);
  const dp = new Array(targetUnits + 1).fill(Infinity);
  const parent = new Array(targetUnits + 1).fill(-1);
  const chosenPack = new Array(targetUnits + 1).fill(-1);
  
  dp[0] = 0;
  
  const unitsPacks = GEM_PACKAGES.map(p => ({
    units: Math.floor(p.gems / unit),
    cost: p.cost,
    gems: p.gems,
  }));
  
  for (let i = 0; i <= targetUnits; i++) {
    if (dp[i] === Infinity) continue;
    for (const p of unitsPacks) {
      const next = Math.min(targetUnits, i + p.units);
      if (dp[i] + p.cost < dp[next]) {
        dp[next] = dp[i] + p.cost;
        parent[next] = i;
        chosenPack[next] = p;
      }
    }
  }
  
  const counts = {};
  for (const p of GEM_PACKAGES) {
    counts[p.gems] = 0;
  }
  if (preBuyCount > 0) {
    counts[17000] = preBuyCount;
  }
  
  let curr = targetUnits;
  let totalCost = preBuyCount * 131.99;
  let totalGems = preBuyCount * 17000;
  
  while (curr > 0 && parent[curr] !== -1) {
    const p = chosenPack[curr];
    counts[p.gems]++;
    totalCost += p.cost;
    totalGems += p.gems;
    curr = parent[curr];
  }
  
  const resultPacks = {};
  for (const k in counts) {
    if (counts[k] > 0) {
      resultPacks[k] = counts[k];
    }
  }
  
  return {
    cost: totalCost,
    packages: resultPacks,
    gemsObtained: totalGems,
    surplus: totalGems - targetGems
  };
}

async function fetchFireSalesPublic() {
  const cached = cache.read(CONFIG.CACHE_KEY_FIRESALES, CONFIG.CACHE_TTL_FIRESALES_MS);
  if (cached) return { sales: cached.data.sales || [], cached: true, fetchedAt: cached.ts };

  const res = await fetch(CONFIG.FIRESALES_PUBLIC_URL);
  if (!res.ok) throw new Error(`Fire Sales API error ${res.status}`);
  const data = await res.json();
  if (data?.success === false) throw new Error(data.cause || "Fire Sales API failed");
  const payload = { sales: Array.isArray(data?.sales) ? data.sales : [] };
  cache.write(CONFIG.CACHE_KEY_FIRESALES, payload);
  return { sales: payload.sales, cached: false, fetchedAt: Date.now() };
}

async function loadFireSalesIfNeeded(force = false) {
  if (state.p2w.fireSalesLoading) return;
  if (state.p2w.fireSales && !force) return;
  if (force) cache.clear(CONFIG.CACHE_KEY_FIRESALES);

  state.p2w.fireSalesLoading = true;
  state.p2w.fireSalesError = null;
  if (state.view === "p2w") renderP2wView();

  try {
    const { sales, fetchedAt } = await fetchFireSalesPublic();
    state.p2w.fireSales = sales;
    state.p2w.fireSalesFetchedAt = fetchedAt;
  } catch (e) {
    state.p2w.fireSalesError = e.message || String(e);
    state.p2w.fireSales = [];
    state.p2w.fireSalesFetchedAt = Date.now();
    console.error("[Hypixie] Fire Sales fetch failed:", e);
  } finally {
    state.p2w.fireSalesLoading = false;
    if (state.view === "p2w") renderP2wView();
  }
}

function normalizeFireSaleTimestamp(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1_000_000_000_000 ? n * 1000 : n; // tolerate seconds or ms
}

function fireSaleTimeLabel(sale) {
  const start = normalizeFireSaleTimestamp(sale.start || sale.start_time || sale.startTime || sale.start_at || sale.startAt);
  const end = normalizeFireSaleTimestamp(sale.end || sale.end_time || sale.endTime || sale.end_at || sale.endAt);
  const now = Date.now();
  const fmt = (ms) => ms ? new Date(ms).toLocaleString() : "—";
  if (start && start > now) return { status: "Upcoming", when: `Starts ${fmt(start)}`, start, end };
  if (end && end > now) return { status: "Live", when: `Ends ${fmt(end)}`, start, end };
  return { status: "Past/unknown", when: end ? `Ended ${fmt(end)}` : (start ? `Started ${fmt(start)}` : "No time provided"), start, end };
}

function getFireSaleItemId(sale) {
  return sale.item_id || sale.itemId || sale.item || sale.id || "";
}

function getFireSaleItemName(sale) {
  const id = getFireSaleItemId(sale);
  return state.allItemsById?.get(id)?.name || sale.item_name || sale.itemName || sale.name || id || "Unknown cosmetic";
}

function getFireSaleGemPrice(sale) {
  const raw = sale.price ?? sale.gem_price ?? sale.gemPrice ?? sale.cost ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function getFireSaleRows() {
  const sales = state.p2w.fireSales || [];
  return sales.map((sale) => {
    const id = getFireSaleItemId(sale);
    const name = getFireSaleItemName(sale);
    const gems = getFireSaleGemPrice(sale);
    const ahPrice = state.lowestBins?.get(id) ?? null;
    const opt = optimizeGems(gems);
    const usdCost = opt.cost;
    const coinPerUsd = usdCost > 0 && ahPrice != null ? ahPrice / usdCost : null;
    const sold = Number(sale.sold || sale.amount_sold || sale.amountSold || 0);
    const amount = Number(sale.amount || sale.total || sale.stock || 0);
    const time = fireSaleTimeLabel(sale);
    return { sale, id, name, gems, ahPrice, opt, usdCost, coinPerUsd, sold, amount, time };
  }).sort((a, b) => {
    const sr = fireSaleStatusRank(a.time.status) - fireSaleStatusRank(b.time.status);
    if (sr) return sr;
    const vr = (b.coinPerUsd || -1) - (a.coinPerUsd || -1);
    if (vr) return vr;
    return (a.time.start || Infinity) - (b.time.start || Infinity);
  });
}


function fireSaleStatusRank(status) {
  if (status === "Live") return 0;
  if (status === "Upcoming") return 1;
  return 2;
}

function fireSaleStockLabel(row) {
  if (!row.amount && !row.sold) return "—";
  if (row.amount && row.sold) return `${fmtInt(row.sold)} / ${fmtInt(row.amount)} sold`;
  if (row.amount) return `${fmtInt(row.amount)} stock`;
  return `${fmtInt(row.sold)} sold`;
}

function fireSaleFreshnessLabel() {
  if (!state.p2w.fireSalesFetchedAt) return "not fetched yet";
  const sec = Math.max(0, Math.floor((Date.now() - state.p2w.fireSalesFetchedAt) / 1000));
  if (sec < 5) return "updated just now";
  if (sec < 60) return `updated ${sec}s ago`;
  if (sec < 3600) return `updated ${Math.floor(sec / 60)}m ago`;
  return `updated ${Math.floor(sec / 3600)}h ago`;
}

function renderP2wTabsHTML() {
  return `
    <div class="p2w-tabs" role="tablist" aria-label="P2W calculator modes">
      <button class="btn-toggle p2w-tab ${state.p2w.activeTab === "cookies" ? "active" : ""}" data-p2w-tab="cookies" role="tab" aria-selected="${state.p2w.activeTab === "cookies"}">${mcIconHTML("BOOSTER_COOKIE", "inline-mc-icon", "Booster Cookies")} Booster Cookies</button>
      <button class="btn-toggle p2w-tab ${state.p2w.activeTab === "firesales" ? "active" : ""}" data-p2w-tab="firesales" role="tab" aria-selected="${state.p2w.activeTab === "firesales"}">${mcIconHTML("FIRE_CHARGE", "inline-mc-icon", "Fire Sales")} Fire Sales</button>
    </div>`;
}

function renderFireSalesTabHTML() {
  if (state.p2w.fireSalesLoading && !state.p2w.fireSales) {
    return `<div class="acc-loading"><span class="spinner"></span> Loading current and upcoming Fire Sales from Hypixel…</div>`;
  }

  const rows = getFireSaleRows();
  const live = rows.filter((r) => r.time.status === "Live");
  const upcoming = rows.filter((r) => r.time.status === "Upcoming");
  const priced = rows.filter((r) => r.ahPrice != null && r.usdCost > 0);
  const best = priced[0] || null;
  const totalPotential = priced.reduce((sum, r) => sum + (r.ahPrice || 0), 0);
  const binsState = state.binsLoading
    ? `<span class="ah-status">Scanning AH… ${Math.round(state.binsProgress * 100)}%</span>`
    : state.lowestBins
      ? `<span class="ah-status ah-status-ok">AH prices loaded (${state.lowestBins.size})</span>`
      : `<button class="btn-secondary btn-small" id="p2w-load-bins-btn">Load AH prices</button>`;
  const refreshText = state.p2w.fireSalesLoading ? "Refreshing…" : "Refresh Fire Sales";

  const empty = !rows.length ? `
    <div class="acc-gate p2w-fire-empty">
      <div class="acc-gate-icon">${gateIconHTML("FIRE_CHARGE", "Fire Sales")}</div>
      <h2>No current or upcoming Fire Sales</h2>
      <p>Hypixel's Fire Sales endpoint is live, but it returned an empty sale list right now. Use <b>Refresh Fire Sales</b> when a new sale is announced.</p>
    </div>` : "";

  const rowHTML = rows.map((row, idx) => {
    const realCost = state.p2w.currency === "AUD" ? row.usdCost * state.p2w.exchangeRate : row.usdCost;
    const currencySymbol = state.p2w.currency === "AUD" ? "AUD $" : "USD $";
    const coinPerUsd = row.coinPerUsd != null ? `${fmtCoins(row.coinPerUsd)}/USD` : "—";
    const ahText = row.ahPrice != null ? fmtCoins(row.ahPrice) : (state.binsLoading ? "Scanning…" : "No BIN found");
    const profitClass = row.coinPerUsd != null ? "pos" : "num-muted";
    return `
      <tr>
        <td class="th-rank">${idx + 1}</td>
        <td>
          <div class="cell-shard">
            <img src="${getUniversalItemIconUrl(row.id)}" alt="" class="shard-icon" onerror="${fallbackToSkyCryptItemOnError(row.id)}">
            <div><strong>${escapeHtml(row.name)}</strong><div class="meta-attr">${escapeHtml(row.id || "unknown id")}</div></div>
          </div>
        </td>
        <td><span class="pill">${row.time.status}</span><div class="meta-attr">${escapeHtml(row.time.when)}</div></td>
        <td class="num">${fmtInt(row.gems)} gems</td>
        <td class="num">${currencySymbol}${realCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="num">${ahText}<div class="meta-attr">${fireSaleStockLabel(row)}</div></td>
        <td class="num ${profitClass}">${coinPerUsd}</td>
      </tr>`;
  }).join("");

  return `
    <section class="p2w-fire-tab">
      <div class="acc-page-head p2w-fire-head">
        <div>
          <h2 class="acc-page-title">Fire Sales P2W Calculator</h2>
          <p class="acc-page-sub">Uses Hypixel's Fire Sales API for current/upcoming cosmetics, then values each item from live Auction House lowest BIN prices. Gem package optimization is shared with the Booster Cookie calculator.</p>
        </div>
        <div class="p2w-fire-actions">
          ${binsState}
          <button class="btn-secondary btn-small" id="p2w-refresh-firesales" ${state.p2w.fireSalesLoading ? "disabled" : ""}>${refreshText}</button>
        </div>
      </div>

      ${state.p2w.fireSalesError ? `<div class="error-box">Fire Sales API error: ${escapeHtml(state.p2w.fireSalesError)}</div>` : ""}

      <section class="stats-grid p2w-fire-stats" aria-label="Fire Sale overview">
        <div class="stat-card"><div class="stat-label">Live sales</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${live.length}</span><span class="stat-value-minor">${upcoming.length} upcoming · ${fireSaleFreshnessLabel()}</span></div></div>
        <div class="stat-card"><div class="stat-label">Priced from AH</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${priced.length} / ${rows.length}</span><span class="stat-value-minor">lowest BIN scan powers prices</span></div></div>
        <div class="stat-card"><div class="stat-label">Best coins / USD</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${best?.coinPerUsd ? fmtCoins(best.coinPerUsd) : "—"}</span><span class="stat-value-minor">${best ? escapeHtml(best.name) : "no AH-priced sale yet"}</span></div></div>
        <div class="stat-card"><div class="stat-label">AH value tracked</div><div class="stat-value stat-value-stacked"><span class="stat-value-major">${totalPotential ? fmtCoins(totalPotential) : "—"}</span><span class="stat-value-minor">gross lowest-BIN value</span></div></div>
      </section>

      ${empty || `
        <section class="table-section p2w-fire-table-section">
          <div class="table-scroll">
            <table class="shard-table p2w-fire-table">
              <thead><tr><th class="th-rank">#</th><th>Fire Sale Item</th><th>Status</th><th class="th-num">Gem Price</th><th class="th-num">Real Cost</th><th class="th-num">AH Lowest BIN</th><th class="th-num">Coins / USD</th></tr></thead>
              <tbody>${rowHTML}</tbody>
            </table>
          </div>
        </section>`}

      <div class="p2w-help-text p2w-fire-note">Note: Auction values are gross lowest-BIN prices from the current AH scan. Fire Sale API responses can be empty between sales, and upcoming cosmetics may not have an AH price until players receive and list them.</div>
    </section>`;
}

async function fetchExchangeRate() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.AUD) {
        state.p2w.exchangeRate = data.rates.AUD;
        console.log("[Hypixie] Fetched USD to AUD rate:", state.p2w.exchangeRate);
        if (state.view === "p2w") renderP2wView();
      }
    }
  } catch (e) {
    console.warn("[Hypixie] Failed to fetch exchange rate, using fallback 1.5:", e);
  }
}

function renderP2wView() {
  const pane = $("#view-p2w");
  if (!pane) return;

  // Gate check for items list loading
  if (!state.allItems) {
    pane.innerHTML = `
      <div class="acc-gate">
        <div class="acc-gate-icon"><span class="spinner"></span></div>
        <h2>Loading Item Database...</h2>
        <p>Please wait while we fetch the latest Hypixel item catalog and market pricing.</p>
      </div>`;
    ensurePriceCatalogsLoaded().then(() => {
      renderP2wView();
    });
    return;
  }

  // Fetch exchange rate on demand if AUD is selected and it hasn't been fetched yet
  if (state.p2w.currency === "AUD" && !state.p2w.exchangeRateFetched) {
    state.p2w.exchangeRateFetched = true;
    fetchExchangeRate();
  }

  // Resolve cookie prices
  const cookieProd = state.raw?.products?.["BOOSTER_COOKIE"];
  const cookieSellPrice = cookieProd?.quick_status?.sellPrice || null;
  const cookieBuyPrice = cookieProd?.quick_status?.buyPrice || null;
  
  let cookieEffectivePrice = 0;
  let cookieDisplayPrice = 0;
  let cookieLabel = "";

  if (state.p2w.cookieMethod === "instantSell") {
    cookieEffectivePrice = cookieSellPrice || 12300000; // fallback if api fails
    cookieDisplayPrice = cookieSellPrice || 12300000;
    cookieLabel = "Instant Sell price";
  } else {
    cookieDisplayPrice = cookieBuyPrice || 12900000;
    cookieEffectivePrice = cookieBuyPrice ? cookieBuyPrice * (1 - state.tax) : 12900000 * (1 - state.tax);
    cookieLabel = "Sell Offer price (after tax)";
  }

  // Resolve selected item price
  let resolvedPriceVal = 0;
  let resolvedPriceSource = "";
  
  const pObj = resolvePrice(state.p2w.selectedItemId, { bazaar: state.raw?.products, bins: state.lowestBins, bazaarMode: state.bazaarMode });
  if (pObj.best != null) {
    resolvedPriceVal = pObj.best;
    resolvedPriceSource = pObj.market === "bazaar" ? "Live price from Bazaar" : "Live price from Auction House (lowest BIN)";
  } else {
    // Hardcode fallback for Hyperion if AH lowest-BIN has not completed yet
    if (state.p2w.selectedItemId === "HYPERION") {
      resolvedPriceVal = 1250000000;
      resolvedPriceSource = "Standard fallback price (market estimate)";
    } else {
      resolvedPriceVal = 0;
      resolvedPriceSource = "No live price available (please enter manually)";
    }
  }

  // Determine current working cost (custom override or resolved)
  if (state.p2w.customPrice === null) {
    state.p2w.customPrice = resolvedPriceVal;
  }
  const workingCost = state.p2w.customPrice;

  // Calculate calculations
  const cookiesNeeded = workingCost > 0 && cookieEffectivePrice > 0 ? Math.ceil(workingCost / cookieEffectivePrice) : 0;
  const gemsNeeded = cookiesNeeded * 325;
  const optResult = optimizeGems(gemsNeeded);

  // Convert pricing to chosen currency
  let finalCost = optResult.cost;
  let currencySymbol = "USD $";
  if (state.p2w.currency === "AUD") {
    finalCost = optResult.cost * state.p2w.exchangeRate;
    currencySymbol = "AUD $";
  }

  // AH scan status text for toolbar integration
  const binsState = state.binsLoading
    ? `<span class="ah-status">Scanning AH… ${Math.round(state.binsProgress * 100)}%</span>`
    : state.lowestBins
      ? `<span class="ah-status ah-status-ok">AH prices loaded (${state.lowestBins.size})</span>`
      : `<button class="btn-secondary btn-small" id="p2w-load-bins-btn">Load AH prices</button>`;

  pane.innerHTML = `
    <header class="view-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
      <div>
        <h2 class="view-title" style="margin-bottom: 4px;">P2W Cookie Calculator</h2>
        <p class="view-subtitle" style="margin: 0;">Find out how many real-world dollars (USD/AUD) are needed to buy any item in Hypixel SkyBlock by selling store-bought Booster Cookies.</p>
      </div>
      <div class="acc-toolbar-ah" style="background: var(--bg-elevated); padding: 8px 16px; border-radius: var(--r-sm); border: 1px solid var(--surface-line); font-size: 0.85em; display: flex; align-items: center; gap: 10px;">
        ${binsState}
      </div>
    </header>

    ${renderP2wTabsHTML()}

    ${state.p2w.activeTab === "firesales" ? renderFireSalesTabHTML() : `
    <div class="p2w-container">
      <!-- Left Column: Controls -->
      <div class="p2w-controls-column">
        <div class="p2w-panel card">
          <h3 class="panel-header" style="font-family: var(--font-display); font-size: 0.95em; margin-bottom: 20px;">${mcIconHTML("COMPASS", "inline-mc-icon", "Search")} 1. Select SkyBlock Item</h3>
          
          <div class="p2w-input-group">
            <label for="p2w-item-search" class="p2w-label">Search Item</label>
            <div class="search-wrap" style="width: 100%;">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input type="search" id="p2w-item-search" placeholder="Type to search (e.g. Hyperion)..." value="${escapeHtml(state.p2w.searchQuery)}" autocomplete="off" style="width: 100%;" />
            </div>
            <!-- Search Results Dropdown -->
            <div id="p2w-search-results" class="p2w-dropdown-results" hidden></div>
          </div>
          
          <div class="p2w-input-group">
            <label class="p2w-label">Selected Item</label>
            <div class="p2w-selected-info" style="display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.02); padding: 12px; border-radius: var(--r-md); border: 1px solid var(--surface-line);">
              <div class="p2w-item-icon-wrapper" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border: 1px solid var(--surface-line); border-radius: var(--r-md); padding: 4px; flex-shrink: 0;">
                <img src="${getUniversalItemIconUrl(state.p2w.selectedItemId)}" alt="" class="p2w-item-icon" style="max-width: 100%; max-height: 100%; object-fit: contain; image-rendering: pixelated;" onerror="${fallbackToSkyCryptItemOnError(state.p2w.selectedItemId)}">
              </div>
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span class="p2w-item-name-tag" style="color: var(--ember-light); font-weight: bold; font-size: 1.05em;">
                  ${escapeHtml(state.p2w.selectedItemName)}
                </span>
                <span class="p2w-item-id-tag" style="font-family: var(--font-mono); font-size: 0.8em; color: var(--text-muted);">
                  ID: ${escapeHtml(state.p2w.selectedItemId)}
                </span>
              </div>
            </div>
          </div>

          <div class="p2w-input-group">
            <label for="p2w-item-cost" class="p2w-label">In-Game Coin Cost</label>
            <div class="input-with-button">
              <input type="number" id="p2w-item-cost" class="input-native" value="${state.p2w.customPrice}" min="0" step="100000" style="font-family: var(--font-mono); font-weight: bold; color: var(--text);" />
              <button class="btn-ghost btn-small" id="p2w-reset-cost" title="Reset to live market price" style="white-space: nowrap; padding: 0 16px;">Reset</button>
            </div>
            <p class="p2w-help-text" id="p2w-price-source-label" style="font-weight: 500; color: var(--text-muted); margin-top: 6px;">
              Source: <span style="color: var(--info);">${resolvedPriceSource}</span>
            </p>
          </div>
        </div>

        <div class="p2w-panel card" style="margin-top: 24px;">
          <h3 class="panel-header" style="font-family: var(--font-display); font-size: 0.95em; margin-bottom: 20px;">${mcIconHTML("BOOSTER_COOKIE", "inline-mc-icon", "Booster Cookie")} 2. Booster Cookie Method</h3>
          
          <div class="p2w-input-group">
            <label class="p2w-label">Selling Method</label>
            <div class="toggle-group" style="display: flex; gap: 8px;">
              <button class="btn-toggle ${state.p2w.cookieMethod === "instantSell" ? "active" : ""}" id="p2w-method-instasell" style="flex: 1;">
                Instant Sell
              </button>
              <button class="btn-toggle ${state.p2w.cookieMethod === "sellOrder" ? "active" : ""}" id="p2w-method-sellorder" style="flex: 1;">
                Sell Offer
              </button>
            </div>
            <p class="p2w-help-text" style="margin-top: 10px; font-size: 0.85em;">
              <b>Instant Sell</b>: Sell cookies immediately to active buy orders.<br/>
              <b>Sell Offer</b>: Create a sell offer on the bazaar and wait. Pays Bazaar tax (current: <b>${(state.tax * 100).toFixed(3)}%</b>).
            </p>
          </div>

          <div class="p2w-cookie-price-display">
            <div class="cookie-stat-row">
              <span>Live Cookie Price:</span>
              <span style="font-family: var(--font-mono); font-weight: bold; color: var(--ember-light);">${fmtInt(cookieDisplayPrice)} coins</span>
            </div>
            <div class="cookie-stat-row" style="border-top: 1px dashed var(--surface-line); padding-top: 8px; margin-top: 8px;">
              <span>Effective Value per Cookie:</span>
              <span style="font-family: var(--font-mono); font-weight: bold; color: var(--pos);">${fmtInt(Math.round(cookieEffectivePrice))} coins</span>
            </div>
          </div>
        </div>

        <div class="p2w-panel card" style="margin-top: 24px;">
          <h3 class="panel-header" style="font-family: var(--font-display); font-size: 0.95em; margin-bottom: 20px;">${mcIconHTML("EMERALD", "inline-mc-icon", "Currency")} 3. Real-Money Currency</h3>
          <div class="p2w-input-group" style="margin-bottom: 0;">
            <label class="p2w-label">Currency Option</label>
            <div class="toggle-group" style="display: flex; gap: 8px;">
              <button class="btn-toggle ${state.p2w.currency === "USD" ? "active" : ""}" id="p2w-currency-usd" style="flex: 1;">
                USD ($)
              </button>
              <button class="btn-toggle ${state.p2w.currency === "AUD" ? "active" : ""}" id="p2w-currency-aud" style="flex: 1;">
                AUD ($)
              </button>
            </div>
            <div class="exchange-rate-input-wrap" id="exchange-rate-group" style="margin-top: 16px; display: ${state.p2w.currency === "AUD" ? "block" : "none"};">
              <label for="p2w-exchange-rate" class="p2w-label">USD to AUD Exchange Rate</label>
              <input type="number" id="p2w-exchange-rate" class="input-native" value="${state.p2w.exchangeRate}" step="0.01" style="width: 100%; font-family: var(--font-mono); font-weight: bold; color: var(--text);" />
              <p class="p2w-help-text">Dynamic exchange rate fetched from Open ER API. Custom changes update pricing instantly.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Results -->
      <div class="p2w-results-column">
        <div class="p2w-result-card card">
          <div class="result-header">Real-World Pricing Result</div>
          
          <div class="result-metric-grid">
            <div class="result-metric-box">
              <div class="metric-label">Item Coin Cost</div>
              <div class="metric-value" style="color: var(--text);">${fmtCoins(workingCost)}</div>
            </div>
            <div class="result-metric-box" title="Amount of Booster Cookies needed to cover the item cost: itemCost / cookiePrice (rounded up)">
              <div class="metric-label">Cookies Needed</div>
              <div class="metric-value" style="color: var(--ember-light);">${fmtInt(cookiesNeeded)} cookies</div>
            </div>
            <div class="result-metric-box" title="Cookies Needed x 325 Gems per cookie">
              <div class="metric-label">Gems Required</div>
              <div class="metric-value" style="color: var(--info);">${fmtInt(gemsNeeded)} gems</div>
            </div>
          </div>

          <div class="result-total-cost-box">
            <div class="total-cost-label">Estimated Real-World Cost</div>
            <div class="total-cost-value" id="result-real-cost">${currencySymbol}${finalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="total-cost-subtitle" style="font-weight: 500;">Optimal real-money gem packages combination to yield ${fmtInt(gemsNeeded)} gems.</div>
          </div>

          <div class="optimal-packs-section">
            <h4 style="margin-bottom: 12px; font-weight: bold;">Optimal Gem Package Combination</h4>
            <div class="packs-list">
              ${Object.entries(optResult.packages).length === 0
                ? `<div class="pack-item" style="color: var(--text-muted); font-style: italic;">No packages required</div>`
                : Object.entries(optResult.packages).sort((a,b) => b[0] - a[0]).map(([gems, count]) => {
                    const packInfo = GEM_PACKAGES.find(p => p.gems === parseInt(gems));
                    const unitPrice = packInfo ? packInfo.cost : 0;
                    const displayCost = state.p2w.currency === "AUD" ? unitPrice * state.p2w.exchangeRate : unitPrice;
                    return `
                      <div class="pack-item">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span class="pack-count-badge">×${count}</span>
                          <span style="font-weight: 600;">${packInfo ? packInfo.name : gems + " gems"}</span>
                        </div>
                        <span style="font-family: var(--font-mono); color: var(--text-soft); font-weight: bold;">
                          ${currencySymbol}${(displayCost * count).toFixed(2)}
                        </span>
                      </div>
                    `;
                  }).join("")
              }
            </div>
            <div class="packs-surplus" style="margin-top: 10px; color: var(--text-soft); font-size: 0.85em;">
              Gems Obtained: <strong style="color: var(--info);">${fmtInt(optResult.gemsObtained)}</strong> / Leftover Surplus: <strong style="color: var(--pos);">${fmtInt(optResult.surplus)} gems</strong>
            </div>
          </div>
        </div>
      </div>
    </div>`}
  `;

  if (state.p2w.activeTab === "firesales") {
    loadFireSalesIfNeeded(false);
  }

  // Bind UI Event Listeners
  pane.querySelectorAll("[data-p2w-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.p2w.activeTab = btn.dataset.p2wTab;
      if (state.p2w.activeTab === "firesales") loadFireSalesIfNeeded(false);
      renderP2wView();
    });
  });
  pane.querySelector("#p2w-refresh-firesales")?.addEventListener("click", () => loadFireSalesIfNeeded(true));

  const searchInput = pane.querySelector("#p2w-item-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      updateP2wSuggestions(e.target.value);
    });
    // On focus, update suggestions
    searchInput.addEventListener("focus", (e) => {
      updateP2wSuggestions(e.target.value);
    });
  }

  // Cost Input
  const costInput = pane.querySelector("#p2w-item-cost");
  if (costInput) {
    costInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      state.p2w.customPrice = Number.isFinite(val) && val >= 0 ? val : 0;
      recalculateP2wResultsInline();
    });
  }

  // Reset Cost Button
  const resetBtn = pane.querySelector("#p2w-reset-cost");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      state.p2w.customPrice = null;
      renderP2wView();
    });
  }

  // Sells Toggles
  const instaBtn = pane.querySelector("#p2w-method-instasell");
  if (instaBtn) {
    instaBtn.addEventListener("click", () => {
      state.p2w.cookieMethod = "instantSell";
      renderP2wView();
    });
  }
  const offerBtn = pane.querySelector("#p2w-method-sellorder");
  if (offerBtn) {
    offerBtn.addEventListener("click", () => {
      state.p2w.cookieMethod = "sellOrder";
      renderP2wView();
    });
  }

  // Currencies Toggles
  const usdBtn = pane.querySelector("#p2w-currency-usd");
  if (usdBtn) {
    usdBtn.addEventListener("click", () => {
      state.p2w.currency = "USD";
      renderP2wView();
    });
  }
  const audBtn = pane.querySelector("#p2w-currency-aud");
  if (audBtn) {
    audBtn.addEventListener("click", () => {
      state.p2w.currency = "AUD";
      renderP2wView();
    });
  }

  // Exchange rate
  const rateInput = pane.querySelector("#p2w-exchange-rate");
  if (rateInput) {
    rateInput.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      state.p2w.exchangeRate = Number.isFinite(val) && val > 0 ? val : 1.5;
      recalculateP2wResultsInline();
    });
  }

  // Scan AH button
  const loadAHBtn = pane.querySelector("#p2w-load-bins-btn");
  if (loadAHBtn) {
    loadAHBtn.addEventListener("click", () => {
      loadLowestBinsIfNeeded(true);
    });
  }
}

// Localized results recalculation to avoid losing focus in text boxes
function recalculateP2wResultsInline() {
  const pane = $("#view-p2w");
  if (!pane) return;

  const cookieProd = state.raw?.products?.["BOOSTER_COOKIE"];
  const cookieSellPrice = cookieProd?.quick_status?.sellPrice || null;
  const cookieBuyPrice = cookieProd?.quick_status?.buyPrice || null;
  
  let cookieEffectivePrice = 0;
  if (state.p2w.cookieMethod === "instantSell") {
    cookieEffectivePrice = cookieSellPrice || 12300000;
  } else {
    cookieEffectivePrice = cookieBuyPrice ? cookieBuyPrice * (1 - state.tax) : 12900000 * (1 - state.tax);
  }

  const workingCost = state.p2w.customPrice !== null ? state.p2w.customPrice : 0;
  const cookiesNeeded = workingCost > 0 && cookieEffectivePrice > 0 ? Math.ceil(workingCost / cookieEffectivePrice) : 0;
  const gemsNeeded = cookiesNeeded * 325;
  const optResult = optimizeGems(gemsNeeded);

  let finalCost = optResult.cost;
  let currencySymbol = "USD $";
  if (state.p2w.currency === "AUD") {
    finalCost = optResult.cost * state.p2w.exchangeRate;
    currencySymbol = "AUD $";
  }

  // Update DOM elements directly!
  const elItemCost = pane.querySelector(".result-metric-grid .result-metric-box:nth-child(1) .metric-value");
  const elCookies = pane.querySelector(".result-metric-grid .result-metric-box:nth-child(2) .metric-value");
  const elGems = pane.querySelector(".result-metric-grid .result-metric-box:nth-child(3) .metric-value");
  const elRealCost = pane.querySelector("#result-real-cost");
  const elSurplus = pane.querySelector(".packs-surplus");
  const elPacksList = pane.querySelector(".packs-list");

  if (elItemCost) elItemCost.textContent = fmtCoins(workingCost);
  if (elCookies) elCookies.textContent = `${fmtInt(cookiesNeeded)} cookies`;
  if (elGems) elGems.textContent = `${fmtInt(gemsNeeded)} gems`;
  if (elRealCost) elRealCost.textContent = `${currencySymbol}${finalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  if (elSurplus) {
    elSurplus.innerHTML = `Gems Obtained: <strong style="color: var(--info);">${fmtInt(optResult.gemsObtained)}</strong> / Leftover Surplus: <strong style="color: var(--pos);">${fmtInt(optResult.surplus)} gems</strong>`;
  }

  if (elPacksList) {
    elPacksList.innerHTML = Object.entries(optResult.packages).length === 0
      ? `<div class="pack-item" style="color: var(--text-muted); font-style: italic;">No packages required</div>`
      : Object.entries(optResult.packages).sort((a,b) => b[0] - a[0]).map(([gems, count]) => {
          const packInfo = GEM_PACKAGES.find(p => p.gems === parseInt(gems));
          const unitPrice = packInfo ? packInfo.cost : 0;
          const displayCost = state.p2w.currency === "AUD" ? unitPrice * state.p2w.exchangeRate : unitPrice;
          return `
            <div class="pack-item">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="pack-count-badge">×${count}</span>
                <span style="font-weight: 600;">${packInfo ? packInfo.name : gems + " gems"}</span>
              </div>
              <span style="font-family: var(--font-mono); color: var(--text-soft); font-weight: bold;">
                ${currencySymbol}${(displayCost * count).toFixed(2)}
              </span>
            </div>
          `;
        }).join("");
  }
}

function updateP2wSuggestions(query) {
  const resultsContainer = $("#p2w-search-results");
  if (!resultsContainer) return;
  
  state.p2w.searchQuery = query;
  const q = query.trim().toLowerCase();
  
  if (!q) {
    resultsContainer.innerHTML = "";
    resultsContainer.hidden = true;
    return;
  }
  
  // Filter all items by name matching query
  const matches = state.allItems.filter(item => 
    item.name && item.name.toLowerCase().includes(q)
  ).slice(0, 10); // Limit to top 10 results
  
  if (matches.length === 0) {
    resultsContainer.innerHTML = `<div style="padding: 12px 16px; color: var(--text-muted); font-size: 0.9em;">No matching items found</div>`;
    resultsContainer.hidden = false;
    return;
  }
  
  resultsContainer.innerHTML = matches.map(item => {
    // Resolve price for this item
    const priceObj = resolvePrice(item.id, { bazaar: state.raw?.products, bins: state.lowestBins, bazaarMode: state.bazaarMode });
    const priceText = priceObj.best != null ? fmtCoins(priceObj.best) : "—";
    const marketLabel = priceObj.market === "bazaar" ? "Bazaar" : priceObj.market === "auction" ? "AH" : "";
    const badgeText = marketLabel ? `<span class="home-card-badge" style="font-size: 0.75em; padding: 2px 6px; background: rgba(255,255,255,0.06);">${marketLabel}</span>` : "";
    
    return `
      <div class="p2w-suggestion-item" data-id="${item.id}" data-name="${escapeHtml(item.name)}">
        <span>${escapeHtml(item.name)} ${badgeText}</span>
        <span style="font-family: var(--font-mono); color: var(--text-soft); font-size: 0.85em;">${priceText}</span>
      </div>
    `;
  }).join("");
  
  resultsContainer.hidden = false;
  
  // Bind click handlers for the suggestion items
  resultsContainer.querySelectorAll(".p2w-suggestion-item").forEach(el => {
    el.addEventListener("click", () => {
      const itemId = el.dataset.id;
      const itemName = el.dataset.name;
      
      state.p2w.selectedItemId = itemId;
      state.p2w.selectedItemName = itemName;
      state.p2w.customPrice = null; // Clear custom price override so we resolve new item's live price
      state.p2w.searchQuery = ""; // Clear query
      
      resultsContainer.hidden = true;
      renderP2wView();
    });
  });
}

// Global click handler to dismiss dropdowns
document.addEventListener("click", (e) => {
  const searchInput = document.getElementById("p2w-item-search");
  const resultsContainer = document.getElementById("p2w-search-results");
  if (resultsContainer && !resultsContainer.hidden) {
    if (searchInput && !searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
      resultsContainer.hidden = true;
    }
  }
});

document.addEventListener("DOMContentLoaded", init);

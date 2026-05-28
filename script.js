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
  API_BASE: "https://api.hypixel.net/v2",
  BAZAAR_ENDPOINT: "/skyblock/bazaar",
  PROFILES_ENDPOINT: "/skyblock/profiles",
  ITEMS_ENDPOINT: "/resources/skyblock/items",

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
  DEFAULT_TEXTURE: "skyshards",

  /* Player profile preferences. */
  USERNAME_STORAGE:    "shardmarket.username",
  PROFILE_ID_STORAGE:  "shardmarket.profileId",

  /* Cache TTLs. */
  CACHE_TTL_BAZAAR_MS:  60_000,
  CACHE_TTL_STATIC_MS:  86_400_000,
  CACHE_TTL_PROFILE_MS: 300_000,        // 5 min — profiles change slowly
  CACHE_KEY_BAZAAR:        "shardmarket.cache.bazaar",
  CACHE_KEY_FUSION_PROPS:  "shardmarket.cache.fusionProps.v1",
  CACHE_KEY_FUSION_DATA:   "shardmarket.cache.fusionData.v1",
  CACHE_KEY_ITEMS:         "shardmarket.cache.items.v1",
  CACHE_KEY_ATTR_DESC:     "shardmarket.cache.attrDesc.v1",
  CACHE_KEY_BINS:          "shardmarket.cache.lowestBins.v1",
  CACHE_KEY_PROFILE_PREFIX: "shardmarket.cache.profile.",  // + uuid
  CACHE_TTL_BINS_MS:       300_000,   // 5 min — AH moves but a full scan is heavy

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

  /* Filters & sorting */
  search: "",
  selectedRarities: new Set(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "UNKNOWN"]),
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
    loading:       false,
    error:         null,
  },

  /* Item catalog (accessories) — loaded once from the resources endpoint. */
  accessoryCatalog: null,
  attributeCatalog: null,    // from attribute-desc.json
  lowestBins: null,          // Map<bazaarId, price> | null (not loaded)
  binsLoading: false,
  binsProgress: 0,           // 0..1

  /* Accessory sourcing preferences. Prefer-max defaults ON (matches the
   * "max this accessory out" intent); user can turn it off to target the
   * cheaper next tier instead. */
  bazaarMode: localStorage.getItem(CONFIG.BAZAAR_MODE_STORAGE) || "instaBuy",
  preferMax:  localStorage.getItem(CONFIG.PREFER_MAX_STORAGE) !== "0",
  accSortKey: localStorage.getItem(CONFIG.ACC_SORT_STORAGE) || "mp",

  /* Active page: "shards" | "missing" | "upgrades" | "attributes" */
  view: "shards",
};

function getNumberFromStorage(key, fallback) {
  try {
    const v = parseFloat(localStorage.getItem(key));
    return Number.isFinite(v) ? v : fallback;
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
    if (!localStorage.getItem(CONFIG.API_KEY_STORAGE)) {
      throw new Error("An API key is required for profile lookups. Add one in Settings.");
    }

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

  /* Accessory analysis runs async (NBT decode). Reset, then fill in. */
  state.player.ownedAccessories  = null;
  state.player.accessoryAnalysis = null;
  state.player.attributeAnalysis = null;
  loadAccessoryAnalysis(prof._raw);
  loadAttributeAnalysis();
  rebuildRows();
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
    if (state.view === "missing" || state.view === "upgrades") renderActiveView();
  }
}

/* Build the attribute-maxing analysis for the selected profile. */
async function loadAttributeAnalysis() {
  try {
    if (!state.attributeCatalog) {
      const { data } = await api.fetchAttrDesc();
      state.attributeCatalog = buildAttributeCatalog(data);
    }
    const stacks = state.player.attributeStacks;
    if (!stacks) { state.player.attributeAnalysis = { rows: [], totalShardsNeeded: 0, totalCost: 0, maxedCount: 0, totalCount: 0 }; return; }

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

    state.player.attributeAnalysis = analyseAttributes(state.attributeCatalog, stacks, shardPriceFor);
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
    attributeStacks: null, attributeAnalysis: null,
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

    /* Investment to syphon to max level. */
    const maxShards = SHARDS_MAX_LEVEL_BY_RARITY[meta.rarity];
    const maxLevelCost = maxShards ? maxShards * metrics.sellPrice : null;

    rows.push({
      id,
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
    if (state.fusionOnly && !r.hasFusion) return false;
    if (state.profitableFusionsOnly && !(r.fusionProfitPerUnit > 0)) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.attribute.toLowerCase().includes(q) ||
      r.family.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });
}

function applySort(rows) {
  const dir = state.sortDir === "asc" ? 1 : -1;
  const key = state.sortKey;
  return [...rows].sort((a, b) => {
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
  return `<span class="${classes}" title="${escapeHtml(fusionTooltipText(r))}" aria-label="Fusion recipe details">⚒</span>`;
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
                ${escapeHtml(pr.cute_name)}${pr.game_mode ? ` (${pr.game_mode})` : ""}${pr.selected ? " ★" : ""}
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
      ? `<span class="afford afford-yes" title="Within your coin purse">✓ affordable</span>`
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
  $("#view-shards").hidden     = view !== "shards";
  $("#view-missing").hidden    = view !== "missing";
  $("#view-upgrades").hidden   = view !== "upgrades";
  $("#view-attributes").hidden = view !== "attributes";

  /* Accessory pages benefit from real AH prices — start a scan on first visit
   * (uses cache on subsequent visits; never blocks the UI). */
  if ((view === "missing" || view === "upgrades") && state.player.username && !state.lowestBins) {
    loadLowestBinsIfNeeded(false);
  }

  renderActiveView();
}

function renderActiveView() {
  if (state.view === "missing")    renderMissingView();
  if (state.view === "upgrades")   renderUpgradesView();
  if (state.view === "attributes") renderAttributesView();
  if (state.view === "shards")     renderTable();
}

/* Shared: a "you need to link an account" gate for the accessory pages. */
function accessoryGateHTML(actionLabel) {
  return `
    <div class="acc-gate">
      <div class="acc-gate-icon">🔗</div>
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

  if (!state.accessoryCatalog) {
    try {
      const { data } = await api.fetchItems();
      state.accessoryCatalog = buildAccessoryCatalog(data);
    } catch (e) { console.error(e); return; }
  }

  state.binsLoading = true;
  state.binsProgress = 0;
  renderActiveView();

  try {
    const bins = await loadLowestBins(state.accessoryCatalog, {
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
         <a class="btn-copy" href="${wikiUrl(item.name)}" target="_blank" rel="noopener noreferrer">Wiki</a>
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
        <div class="acc-card-titles">
          ${itemNameHTML(item)}
          <div class="acc-card-sub">
            <span class="acc-tier" style="color:${tierColor}">${item.tier.toLowerCase()}</span>
            <span class="meta-sep">·</span>
            ${priceTxt}
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
    if (!btn) return;
    const text = btn.dataset.copy;
    navigator.clipboard?.writeText(text).then(() => {
      const orig = btn.innerHTML;
      btn.classList.add("copied");
      btn.textContent = "Copied!";
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove("copied"); }, 1200);
    }).catch(() => {});
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

/* ----- MISSING page ----- */
function renderMissingView() {
  const pane = $("#view-missing");
  const p = state.player;

  if (!p.username || p.error) { pane.innerHTML = accessoryGateHTML("The missing-accessories report"); return; }
  if (p.accessoryAnalysis == null) {
    pane.innerHTML = accessoryLoadingHTML("Decoding your accessory bag…");
    return;
  }

  const a = p.accessoryAnalysis;
  if (a.error) { pane.innerHTML = `<div class="acc-gate"><p>Couldn't analyse accessories: ${escapeHtml(a.error)}</p></div>`; return; }

  let missing = [...a.missing];
  updateTabBadge("badge-missing", missing.length);

  const getPrice = (item) => {
    if (item.soulbound) return Infinity;
    const pPrice = accessoryPrice(item.id)?.best;
    return pPrice != null ? pPrice : Infinity;
  };

  if (state.accSortKey === "price") {
    missing.sort((x, y) => getPrice(x.item) - getPrice(y.item));
  } else if (state.accSortKey === "costPerMp") {
    missing.sort((x, y) => {
      const px = getPrice(x.item);
      const py = getPrice(y.item);
      const ratioX = px / x.mp;
      const ratioY = py / y.mp;
      if (ratioX !== ratioY) return ratioX - ratioY;
      return y.mp - x.mp; // fallback to higher MP
    });
  } else {
    missing.sort((x, y) => y.mp - x.mp);
  }

  const totalMissingMP = missing.reduce((s, m) => s + m.mp, 0);

  pane.innerHTML = `
    <div class="acc-page-head">
      <div>
        <h2 class="acc-page-title">Missing Accessories</h2>
        <p class="acc-page-sub">
          Accessory families you own none of, ranked by the Magical Power they'd add.
          Use <code>/bz</code> for bazaar items and <code>/ahs</code> for Auction House items.
          Potential gain: <strong class="pos">+${fmtInt(totalMissingMP)} MP</strong> across ${missing.length} items.
        </p>
      </div>
    </div>
    ${mpHeaderHTML(a)}
    ${accessoryToolbarHTML()}
    <div class="acc-grid" id="missing-grid">
      ${missing.length
        ? missing.map((m) => accessoryActionRow(m.item, "MP", m.mp)).join("")
        : `<div class="acc-empty">🎉 You're not missing any tracked accessory families. Nice.</div>`}
    </div>`;

  bindAccessoryToolbar(pane);
  bindCopyButtons($("#missing-grid"));
}

/* ----- UPGRADES page ----- */
function renderUpgradesView() {
  const pane = $("#view-upgrades");
  const p = state.player;

  if (!p.username || p.error) { pane.innerHTML = accessoryGateHTML("The accessory-upgrades report"); return; }
  if (p.accessoryAnalysis == null) {
    pane.innerHTML = accessoryLoadingHTML("Decoding your accessory bag…");
    return;
  }

  const a = p.accessoryAnalysis;
  if (a.error) { pane.innerHTML = `<div class="acc-gate"><p>Couldn't analyse accessories: ${escapeHtml(a.error)}</p></div>`; return; }

  let upgrades = [...a.upgrades];
  let recombs = [...(a.recombs || [])];

  const getPrice = (item) => {
    if (item.soulbound) return Infinity;
    const pPrice = accessoryPrice(item.id)?.best;
    return pPrice != null ? pPrice : Infinity;
  };

  const getRecombobulatorPrice = () => {
    const prod = state.raw?.products?.["RECOMBOBULATOR_3000"];
    if (prod?.quick_status) {
      return state.bazaarMode === "buyOrder"
        ? (prod.quick_status.sellPrice || prod.quick_status.buyPrice)
        : (prod.quick_status.buyPrice || prod.quick_status.sellPrice);
    }
    return 6000000;
  };

  const recombPrice = getRecombobulatorPrice();

  if (state.accSortKey === "price") {
    upgrades.sort((x, y) => getPrice(x.target) - getPrice(y.target));
    recombs.sort((x, y) => x.item.name.localeCompare(y.item.name));
  } else if (state.accSortKey === "costPerMp") {
    upgrades.sort((x, y) => {
      const px = getPrice(x.target);
      const py = getPrice(y.target);
      const ratioX = px / x.mpGain;
      const ratioY = py / y.mpGain;
      if (ratioX !== ratioY) return ratioX - ratioY;
      return y.mpGain - x.mpGain;
    });
    recombs.sort((x, y) => {
      const ratioX = recombPrice / x.mpGain;
      const ratioY = recombPrice / y.mpGain;
      if (ratioX !== ratioY) return ratioX - ratioY;
      return y.mpGain - x.mpGain;
    });
  } else {
    upgrades.sort((x, y) => y.mpGain - x.mpGain);
    recombs.sort((x, y) => y.mpGain - x.mpGain);
  }

  updateTabBadge("badge-upgrades", upgrades.length + recombs.length);

  const totalGain = upgrades.reduce((s, u) => s + u.mpGain, 0);
  const recombGainTotal = recombs.reduce((s, r) => s + r.mpGain, 0);

  pane.innerHTML = `
    <div class="acc-page-head">
      <div>
        <h2 class="acc-page-title">Accessory Upgrades</h2>
        <p class="acc-page-sub">
          Accessories you own at a lower tier than the family maximum.
          Buy the upgraded version to gain Magical Power.
          Potential gain: <strong class="pos">+${fmtInt(totalGain)} MP</strong> across ${upgrades.length} upgrades.
        </p>
      </div>
    </div>
    ${mpHeaderHTML(a)}
    ${accessoryToolbarHTML()}
    <div class="acc-grid" id="upgrades-grid">
      ${upgrades.length
        ? upgrades.map((u) => `
            <article class="acc-card acc-card--upgrade" style="--tier-color:${RARITY_COLORS[u.target.tier] || RARITY_COLORS.UNKNOWN}">
              <div class="acc-upgrade-flow">
                <span class="acc-have" style="color:${RARITY_COLORS[u.owned.tier]}">
                  ${escapeHtml(u.owned.name)}
                </span>
                <span class="acc-upgrade-arrow">→</span>
                <span class="acc-want" style="color:${RARITY_COLORS[u.target.tier]}">
                  ${escapeHtml(u.target.name)}
                </span>
              </div>
              ${accessoryActionRow(u.target, "MP gain", u.mpGain)}
            </article>`).join("")
        : `<div class="acc-empty">🎉 Every accessory family you own is already at max tier.</div>`}
    </div>

    ${recombs.length ? `
      <div class="acc-page-head acc-page-head--sub">
        <div>
          <h2 class="acc-page-title">Recombobulate</h2>
          <p class="acc-page-sub">
            Already at max tier — apply a <a href="${wikiUrl("Recombobulator 3000")}" target="_blank" rel="noopener noreferrer">Recombobulator 3000</a>
            to bump rarity one step and gain Magical Power.
            Potential gain: <strong class="pos">+${fmtInt(recombGainTotal)} MP</strong> across ${recombs.length} items.
          </p>
        </div>
      </div>
      <div class="acc-grid" id="recombs-grid">
        ${recombs.map((rc) => `
          <article class="acc-card acc-card--recomb" style="--tier-color:${RARITY_COLORS[rc.nextRarity] || RARITY_COLORS.UNKNOWN}">
            <div class="acc-upgrade-flow">
              <span class="acc-have" style="color:${RARITY_COLORS[rc.item.tier]}">${rc.item.tier.toLowerCase()}</span>
              <span class="acc-upgrade-arrow">⟳</span>
              <span class="acc-want" style="color:${RARITY_COLORS[rc.nextRarity]}">${rc.nextRarity.toLowerCase()}</span>
            </div>
            <div class="acc-card-main">
              <div class="acc-card-titles">
                ${itemNameHTML(rc.item)}
                <div class="acc-card-sub">
                  <span class="acc-recomb-note">recombobulate for more MP</span>
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
          </article>`).join("")}
      </div>
    ` : ""}`;

  bindAccessoryToolbar(pane);
  bindCopyButtons(pane);
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
    pane.innerHTML = `<div class="acc-gate"><div class="acc-gate-icon">🔮</div>
      <h2>No attribute data</h2>
      <p>This profile has no attribute progress recorded yet. Syphon some shards in-game first.</p></div>`;
    updateTabBadge("badge-attributes", 0);
    return;
  }

  const unmaxed = a.rows.filter((r) => !r.maxed);
  updateTabBadge("badge-attributes", unmaxed.length);

  const pct = a.totalCount > 0 ? Math.round((a.maxedCount / a.totalCount) * 100) : 0;

  pane.innerHTML = `
    <div class="acc-page-head">
      <div>
        <h2 class="acc-page-title">Attribute Maxing</h2>
        <p class="acc-page-sub">
          How many Attribute Shards you still need to take each attribute to
          <strong>level 10</strong>, with live bazaar cost. You still need
          <strong class="pos">${fmtInt(a.totalShardsNeeded)}</strong> shards
          ${a.totalCost > 0 ? `(≈ <strong>${fmtCoins(a.totalCost)}</strong> coins)` : ""}
          to max ${unmaxed.length} attribute${unmaxed.length === 1 ? "" : "s"}.
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
    </div>

    <div class="attr-grid">
      ${a.rows.map(renderAttributeRow).join("")}
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

  bindCopyButtons(pane);
}

function renderAttributeRow(r) {
  const color = RARITY_COLORS[r.rarity] || RARITY_COLORS.UNKNOWN;
  const progPct = Math.round((r.current / r.max) * 100);

  if (r.maxed) {
    return `
      <article class="attr-card attr-card--maxed" style="--tier-color:${color}">
        <div class="attr-card-head">
          <a class="attr-name wiki-link" href="${wikiUrl(r.title)}" target="_blank" rel="noopener noreferrer" title="Open on Hypixel Wiki">${escapeHtml(r.title)}</a>
          <span class="attr-maxed-badge">✓ MAX</span>
        </div>
        <div class="attr-progress"><div class="attr-progress-fill" style="width:100%;background:${color}"></div></div>
        <div class="attr-foot"><span class="attr-count">${r.current}/${r.max}</span></div>
      </article>`;
  }

  /* sourcing command for the shard that grants this attribute */
  const propName = state.fusionProps?.[r.code]?.name;
  const shardBazaarId = state.codeToBazaar?.[r.code];
  const cmd = propName
    ? `/bz ${propName} Shard`
    : null;

  return `
    <article class="attr-card" style="--tier-color:${color}">
      <div class="attr-card-head">
        <a class="attr-name wiki-link" href="${wikiUrl(r.title)}" target="_blank" rel="noopener noreferrer" title="Open on Hypixel Wiki">${escapeHtml(r.title)}</a>
        <span class="attr-rarity" style="color:${color}">${r.rarity.toLowerCase()}</span>
      </div>
      <div class="attr-progress"><div class="attr-progress-fill" style="width:${progPct}%;background:${color}"></div></div>
      <div class="attr-foot">
        <span class="attr-count">${r.current}/${r.max}</span>
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
        ? `<span class="fusion-val fusion-locked" title="Requires Hunting Lv ${r.bestFusion.requiredHuntingLevel}; your linked profile is Lv ${state.player.huntingLevel}">🔒 Lv ${r.bestFusion.requiredHuntingLevel}</span>`
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
          <span class="meta-family">${escapeHtml(r.family)}</span>
          ${r.attribute !== "—" ? `<span class="meta-sep">·</span><span class="meta-attr">${escapeHtml(r.attribute)}</span>` : ""}
        </div>
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
  } catch (e) {
    state.error = e.message;
    console.error("[Hypixie] load failed:", e);
  } finally {
    state.loading = false;
    renderTable();
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

function flashStatus(msg) {
  const el = $("#settings-status");
  el.textContent = msg;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 2000);
}

function init() {
  renderRarityFilters();
  renderPlayerPanel();
  bindUI();
  startTimeAgoTicker();
  loadData(false);

  /* If the user previously linked an account and has an API key, auto-load. */
  if (state.player.username && localStorage.getItem(CONFIG.API_KEY_STORAGE)) {
    loadPlayerProfiles(state.player.username);
  }

  /* Auto-refresh every minute. Hits cache silently if data is fresh. */
  setInterval(() => loadData(false), CONFIG.CACHE_TTL_BAZAAR_MS);
}

document.addEventListener("DOMContentLoaded", init);

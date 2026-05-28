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

  /* Static SkyShards datasets (bundled in /data/). */
  FUSION_PROPS_URL: "data/fusion-properties.json",
  FUSION_DATA_URL:  "data/fusion-data.json",

  /* Public bazaar endpoint needs no key. The key is read from localStorage
   * and only attached when present — useful for authenticated extensions. */
  API_KEY_STORAGE: "shardmarket.apiKey",

  /* Bazaar tax (sell-order tax) — default 1.25% base. Configurable in UI. */
  TAX_STORAGE:  "shardmarket.tax",
  DEFAULT_TAX:  0.0125,

  /* Texture pack preference. */
  TEXTURE_STORAGE: "shardmarket.texturePack",
  DEFAULT_TEXTURE: "skyshards",

  /* Cache TTLs.
   * Bazaar updates every ~60s; SkyShards JSON is bundled with the site so
   * we cache it aggressively (1 day) to avoid re-downloading 2 MB on
   * every page load. */
  CACHE_TTL_BAZAAR_MS:  60_000,
  CACHE_TTL_STATIC_MS:  86_400_000,
  CACHE_KEY_BAZAAR:        "shardmarket.cache.bazaar",
  CACHE_KEY_FUSION_PROPS:  "shardmarket.cache.fusionProps.v1",
  CACHE_KEY_FUSION_DATA:   "shardmarket.cache.fusionData.v1",

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
};

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
 * Cost basis per input:  sellPrice  (place a buy order — cheapest sourcing)
 *
 * Cost per output unit = (price(A) + price(B)) / outputQty
 *
 * Best recipe = the pair across all output-qty buckets that minimises cost
 * per output unit. We then compare to the target's market value to derive
 * fusion profit / unit.
 * ======================================================================= */
function priceOfInput(bazaarId) {
  if (!bazaarId || !state.raw?.products) return null;
  const prod = state.raw.products[bazaarId];
  if (!prod) return null;
  /* Use sellPrice (buy-order cost) as the realistic sourcing price.
   * If sellPrice is 0 (no buy orders at all) fall back to buyPrice (insta-buy)
   * so the recipe stays evaluable. */
  const sp = prod.quick_status?.sellPrice;
  if (sp && sp > 0) return sp;
  return prod.quick_status?.buyPrice || null;
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

      const pairCost = aPrice + bPrice;
      const costPerOutput = pairCost / qty;

      if (!best || costPerOutput < best.costPerOutput) {
        best = {
          inputs: [
            { code: aCode, bazaarId: aId, name: state.shardsDb[aId]?.name || aId, price: aPrice },
            { code: bCode, bazaarId: bId, name: state.shardsDb[bId]?.name || bId, price: bPrice },
          ],
          outputQty: qty,
          pairCost,
          costPerOutput,
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
      fusionProfitPerUnit = metrics.buyPrice * (1 - tax) - bestFusion.costPerOutput;
      fusionMarginPercent = bestFusion.costPerOutput > 0
        ? (fusionProfitPerUnit / bestFusion.costPerOutput) * 100
        : 0;
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

  wrap.innerHTML = ranked.map((r) => `
    <article class="fusion-card" style="--rarity-color:${RARITY_COLORS[r.rarity]}">
      <div class="fusion-card-head">
        <img class="fusion-icon" src="${iconUrl(r.id)}" alt="" loading="lazy"
             onerror="this.src='${PLACEHOLDER_ICON}'"/>
        <div class="fusion-card-titles">
          <div class="fusion-card-name">${escapeHtml(r.name)}</div>
          <div class="fusion-card-rarity" style="color:${RARITY_COLORS[r.rarity]}">
            ${r.rarity.toLowerCase()}
          </div>
        </div>
        <div class="fusion-card-profit pos">
          ${fmtCoins(r.fusionProfitPerUnit)}
          <span class="fusion-card-margin">${fmtPct(r.fusionMarginPercent)}</span>
        </div>
      </div>
      <div class="fusion-recipe">
        ${r.bestFusion.inputs.map((inp) => `
          <div class="fusion-input">
            <img class="fusion-input-icon" src="${iconUrl(inp.bazaarId)}" alt="" loading="lazy"
                 onerror="this.src='${PLACEHOLDER_ICON}'"/>
            <div class="fusion-input-meta">
              <div class="fusion-input-name">${escapeHtml(inp.name)}</div>
              <div class="fusion-input-price">${fmtCoins(inp.price)}</div>
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
  `).join("");
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
      ? `<span class="fusion-val ${fusionClass}" title="${escapeHtml(
            r.bestFusion.inputs.map(i => i.name).join("  +  ")
            + `  →  ×${r.bestFusion.outputQty} ${r.name}\n`
            + `Input cost: ${fmtCoins(r.bestFusion.costPerOutput)}/ea`
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
          ${r.hasFusion ? '<span class="badge-fusion" title="Has at least one known fusion recipe">⚒</span>' : ""}
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
    console.error("[ShardMarket] load failed:", e);
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
  bindUI();
  startTimeAgoTicker();
  loadData(false);

  /* Auto-refresh every minute. Hits cache silently if data is fresh. */
  setInterval(() => loadData(false), CONFIG.CACHE_TTL_BAZAAR_MS);
}

document.addEventListener("DOMContentLoaded", init);

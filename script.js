/* =========================================================================
 * script.js — Shard Market
 * Hypixel SkyBlock Attribute Shard profitability analyzer.
 *
 * No build step. No backend. Pure browser JavaScript, designed for hosting
 * on GitHub Pages.
 *
 * SECTIONS
 *   1. Config & constants
 *   2. State container
 *   3. Cache (localStorage with TTL)
 *   4. API client (Bazaar + Items)
 *   5. Profitability math
 *   6. Pipeline: raw → enriched → filtered → sorted
 *   7. Rendering / DOM
 *   8. Event handlers & boot
 * ======================================================================= */

"use strict";

/* =========================================================================
 * 1. CONFIG
 * ======================================================================= */
const CONFIG = {
  API_BASE: "https://api.hypixel.net/v2",
  BAZAAR_ENDPOINT: "/skyblock/bazaar",
  ITEMS_ENDPOINT: "/resources/skyblock/items",

  // Public endpoints (bazaar, resources/items) don't require a key.
  // The key is read from localStorage and only attached when present —
  // useful only if you later add authenticated calls.
  API_KEY_STORAGE: "shardmarket.apiKey",

  // Bazaar tax (sell-order tax) — default 1.25% base. Configurable in UI to
  // 1.125% (Bazaar Flipper L1) or 1% (Bazaar Flipper L2).
  TAX_STORAGE: "shardmarket.tax",
  DEFAULT_TAX: 0.0125,

  // Cache TTL for bazaar data — Hypixel updates bazaar every 60s, so we
  // never need to re-fetch more often than that.
  CACHE_TTL_MS: 60_000,
  CACHE_KEY_BAZAAR: "shardmarket.cache.bazaar",
  CACHE_KEY_ITEMS: "shardmarket.cache.items",

  // Filtering: only show shards with at least this much weekly volume on
  // both sides. Filters out dead markets that show distorted prices.
  MIN_WEEKLY_VOLUME: 1,
};

/* =========================================================================
 * 2. STATE
 *    Single source of truth, mutated by API/UI code, read by renderers.
 * ======================================================================= */
const state = {
  raw: null,             // raw bazaar response
  lastUpdated: null,     // timestamp from bazaar (ms)
  fetchedAt: null,       // when we received the data (ms)
  rows: [],              // enriched + computed shard rows
  loading: false,
  error: null,

  // Filters & sorting
  search: "",
  selectedRarities: new Set(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "UNKNOWN"]),
  sortKey: "profitPerUnit",
  sortDir: "desc",       // "asc" | "desc"

  // Settings
  tax: getNumberFromStorage(CONFIG.TAX_STORAGE, CONFIG.DEFAULT_TAX),
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
  read(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CONFIG.CACHE_TTL_MS) return null;
      return { ts, data };
    } catch {
      return null;
    }
  },
  write(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      /* quota exceeded — silently ignore, not critical */
    }
  },
  clear(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

/* =========================================================================
 * 4. API CLIENT
 *    Wraps fetch with: optional key header, JSON parsing, error normalization.
 * ======================================================================= */
async function apiFetch(path, { useCache = true, cacheKey = null } = {}) {
  // 1. Check cache
  if (useCache && cacheKey) {
    const cached = cache.read(cacheKey);
    if (cached) return { data: cached.data, cached: true, cachedAt: cached.ts };
  }

  // 2. Build request
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

  // 3. Handle non-OK responses with informative messages
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

const api = {
  fetchBazaar:  () => apiFetch(CONFIG.BAZAAR_ENDPOINT, { cacheKey: CONFIG.CACHE_KEY_BAZAAR }),
  fetchItems:   () => apiFetch(CONFIG.ITEMS_ENDPOINT,  { cacheKey: CONFIG.CACHE_KEY_ITEMS }),
};

/* =========================================================================
 * 5. PROFITABILITY MATH
 *
 *   Terminology (matches the in-game Bazaar):
 *     buyPrice  — what you PAY to insta-buy (the lowest sell-offer prices)
 *     sellPrice — what you RECEIVE from insta-sell (the highest buy-orders)
 *
 *   The realistic flip uses ORDERS rather than instant transactions:
 *     1) Place a BUY ORDER at ≈ sellPrice + ε (you become the top buyer).
 *        Pay ≈ sellPrice per unit.
 *     2) Once filled, place a SELL OFFER at ≈ buyPrice − ε.
 *        Receive ≈ buyPrice × (1 − tax) per unit (sell offers get taxed).
 *
 *   So:  profitPerUnit ≈ buyPrice × (1 − tax)  −  sellPrice
 *        marginPercent ≈ profitPerUnit / sellPrice × 100
 *
 *   We also compute:
 *     spread        — gross gap (buyPrice − sellPrice), pre-tax
 *     weeklyVolume  — sum of insta-sell & insta-buy weekly volumes (a
 *                     liquidity / "how often does this actually trade" gauge)
 * ======================================================================= */
function computeMetrics(qs, tax) {
  const buyPrice  = qs?.buyPrice  ?? 0; // insta-buy cost
  const sellPrice = qs?.sellPrice ?? 0; // insta-sell revenue

  const spread        = buyPrice - sellPrice;
  const profitPerUnit = buyPrice * (1 - tax) - sellPrice;
  const marginPercent = sellPrice > 0 ? (profitPerUnit / sellPrice) * 100 : 0;

  // Weekly liquidity — total units cycled through both sides over 7 days.
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

/* Project profit over the realistic weekly throughput.
 * Capped at half the weaker side (you can't move more units than the market
 * absorbs). This produces a more honest "expected weekly profit" than
 * profitPerUnit alone — a 1M-coin margin on a 5/week item is much less
 * useful than a 100-coin margin on a 50k/week item. */
function projectedWeeklyProfit(m) {
  const throughput = Math.min(m.sellWeek, m.buyWeek) * 0.5;
  return m.profitPerUnit * throughput;
}

/* =========================================================================
 * 6. PIPELINE — turn bazaar response into table rows
 * ======================================================================= */

/* Is this bazaar product an Attribute Shard? */
function isShardProduct(id) {
  return id.startsWith("SHARD_") || id.startsWith("ATTRIBUTE_SHARD");
}

/* Look up display metadata, falling back to auto-prettification. */
function getShardMeta(id) {
  const known = SHARDS_DB[id];
  if (known) return { ...known, known: true };
  return {
    name: prettifyShardId(id),
    attribute: "—",
    rarity: "UNKNOWN",
    family: "—",
    known: false,
  };
}

/* Build the enriched rows from the raw bazaar payload. */
function buildRows(bazaarPayload) {
  if (!bazaarPayload?.products) return [];

  const rows = [];
  for (const [id, product] of Object.entries(bazaarPayload.products)) {
    if (!isShardProduct(id)) continue;

    const meta    = getShardMeta(id);
    const metrics = computeMetrics(product.quick_status, state.tax);

    // Filter out totally dead markets where no trades have happened.
    if (metrics.weeklyVolume < CONFIG.MIN_WEEKLY_VOLUME) continue;

    // Maximum-level investment estimate: cost to syphon to level 10 if you
    // bought every shard via buy orders. Useful for "how much to max?" view.
    const maxShards = SHARDS_MAX_LEVEL_BY_RARITY[meta.rarity];
    const maxLevelCost = maxShards ? maxShards * metrics.sellPrice : null;

    rows.push({
      id,
      ...meta,
      ...metrics,
      weeklyExpectedProfit: projectedWeeklyProfit(metrics),
      maxLevelCost,
      hasFusion: !!FUSION_RECIPES[id],
    });
  }
  return rows;
}

/* Apply UI filters (search text + rarity pills). */
function applyFilters(rows) {
  const q = state.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (!state.selectedRarities.has(r.rarity)) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.attribute.toLowerCase().includes(q) ||
      r.family.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });
}

/* Sort with stable null handling. */
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
 * 7. RENDERING
 * ======================================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
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

function renderStats(visibleRows) {
  const totalEl     = $("#stat-total");
  const topProfitEl = $("#stat-top-profit");
  const topSpreadEl = $("#stat-top-spread");
  const updatedEl   = $("#stat-updated");

  totalEl.textContent = visibleRows.length;

  // Most profitable per-unit flip
  const topProfit = visibleRows.reduce(
    (best, r) => (r.profitPerUnit > (best?.profitPerUnit ?? -Infinity) ? r : best),
    null
  );
  if (topProfit) {
    topProfitEl.innerHTML = `
      <span class="stat-value-major">${fmtCoins(topProfit.profitPerUnit)}</span>
      <span class="stat-value-minor">${topProfit.name}</span>`;
  } else {
    topProfitEl.innerHTML = `<span class="stat-value-major">—</span>`;
  }

  // Largest absolute spread
  const topSpread = visibleRows.reduce(
    (best, r) => (r.spread > (best?.spread ?? -Infinity) ? r : best),
    null
  );
  if (topSpread) {
    topSpreadEl.innerHTML = `
      <span class="stat-value-major">${fmtCoins(topSpread.spread)}</span>
      <span class="stat-value-minor">${topSpread.name}</span>`;
  } else {
    topSpreadEl.innerHTML = `<span class="stat-value-major">—</span>`;
  }

  if (state.lastUpdated) {
    updatedEl.innerHTML = `
      <span class="stat-value-major" id="time-ago">just now</span>
      <span class="stat-value-minor">${new Date(state.lastUpdated).toLocaleTimeString()}</span>`;
  } else {
    updatedEl.innerHTML = `<span class="stat-value-major">—</span>`;
  }
}

function renderRarityFilters() {
  const wrap = $("#rarity-filters");
  if (wrap.children.length) return; // already built

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

function renderTable() {
  const tbody = $("#shard-table tbody");
  const filtered = applyFilters(state.rows);
  const sorted = applySort(filtered);

  // Update column-header sort indicators
  $$("#shard-table th[data-sort]").forEach((th) => {
    const isActive = th.dataset.sort === state.sortKey;
    th.classList.toggle("sort-active", isActive);
    th.classList.toggle("sort-asc",  isActive && state.sortDir === "asc");
    th.classList.toggle("sort-desc", isActive && state.sortDir === "desc");
  });

  // Empty / loading / error
  if (state.loading && !state.rows.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="state-row">
        <div class="state-loading"><span class="spinner"></span>Loading bazaar data…</div>
      </td></tr>`;
    renderStats([]);
    return;
  }
  if (state.error) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="state-row">
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
      <tr><td colspan="8" class="state-row">
        <div class="state-empty">No shards match your filters.</div>
      </td></tr>`;
    renderStats([]);
    return;
  }

  // Build rows using a DocumentFragment for fast insertion
  const frag = document.createDocumentFragment();
  sorted.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.style.setProperty("--rarity-color", RARITY_COLORS[r.rarity]);
    tr.dataset.rarity = r.rarity;

    const profitClass = r.profitPerUnit > 0 ? "pos" : r.profitPerUnit < 0 ? "neg" : "neu";
    const marginClass = r.marginPercent > 0 ? "pos" : r.marginPercent < 0 ? "neg" : "neu";

    tr.innerHTML = `
      <td class="cell-rank">${idx + 1}</td>
      <td class="cell-shard">
        <div class="shard-name">
          ${escapeHtml(r.name)}
          ${r.known ? "" : '<span class="badge-unknown" title="No metadata in our database — auto-detected from bazaar">new</span>'}
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
      <td class="num">${fmtInt(r.weeklyVolume)}</td>
    `;
    frag.appendChild(tr);
  });
  tbody.replaceChildren(frag);
  renderStats(sorted);
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

/* "Updated 12s ago" auto-refresher (purely cosmetic) */
function startTimeAgoTicker() {
  setInterval(() => {
    const el = $("#time-ago");
    if (!el || !state.lastUpdated) return;
    const sec = Math.round((Date.now() - state.lastUpdated) / 1000);
    let text;
    if (sec < 5)        text = "just now";
    else if (sec < 60)  text = `${sec}s ago`;
    else if (sec < 3600) text = `${Math.floor(sec / 60)}m ago`;
    else                text = `${Math.floor(sec / 3600)}h ago`;
    el.textContent = text;
  }, 1000);
}

/* =========================================================================
 * 8. ORCHESTRATION & EVENT HANDLERS
 * ======================================================================= */
async function loadData(forceRefresh = false) {
  if (forceRefresh) {
    cache.clear(CONFIG.CACHE_KEY_BAZAAR);
  }

  state.loading = true;
  state.error = null;
  renderTable();

  try {
    const { data, cached, cachedAt } = await api.fetchBazaar();
    state.raw = data;
    state.lastUpdated = data.lastUpdated || cachedAt;
    state.fetchedAt = Date.now();
    state.rows = buildRows(data);

    // Visual hint when serving from cache
    const cacheBadge = $("#cache-badge");
    cacheBadge.style.display = cached ? "inline-flex" : "none";
  } catch (e) {
    state.error = e.message;
    console.error("[ShardMarket] load failed:", e);
  } finally {
    state.loading = false;
    renderTable();
  }
}

function bindUI() {
  // Search
  const searchInput = $("#search-input");
  let searchTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value;
      renderTable();
    }, 120);
  });

  // Sort dropdown (mobile-friendly alt to header clicks)
  $("#sort-select").addEventListener("change", (e) => {
    const [key, dir] = e.target.value.split(":");
    state.sortKey = key;
    state.sortDir = dir;
    renderTable();
  });

  // Sortable column headers
  $$("#shard-table th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = th.dataset.defaultDir || "desc";
      }
      // Sync the dropdown
      $("#sort-select").value = `${state.sortKey}:${state.sortDir}`;
      renderTable();
    });
  });

  // Refresh button
  $("#refresh-btn").addEventListener("click", () => loadData(true));

  // Settings: API key + tax
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

  // Tax setting
  const taxSelect = $("#tax-select");
  taxSelect.value = String(state.tax);
  taxSelect.addEventListener("change", () => {
    state.tax = parseFloat(taxSelect.value);
    localStorage.setItem(CONFIG.TAX_STORAGE, String(state.tax));
    // Re-compute existing rows without re-fetching
    if (state.raw) state.rows = buildRows(state.raw);
    renderTable();
  });

  // Click outside the settings panel to close it
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

/* Boot */
function init() {
  renderRarityFilters();
  bindUI();
  startTimeAgoTicker();
  loadData(false);

  // Auto-refresh every 60s (silently — uses cache so no hammering)
  setInterval(() => loadData(false), CONFIG.CACHE_TTL_MS);
}

document.addEventListener("DOMContentLoaded", init);

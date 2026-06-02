/* =========================================================================
 * prices.js
 *
 * Unified price resolution for accessories (and any SkyBlock item).
 *
 * Two markets:
 *   BAZAAR  — for bazaar-tradable items. Exposes both:
 *               instaBuy  (buyPrice)  — buy now from sell offers
 *               buyOrder  (sellPrice) — place a buy order (cheaper, slower)
 *   AUCTION — everything else. We compute the LOWEST BIN per item by scanning
 *             the official /skyblock/auctions endpoint and matching by name.
 *
 * The auctions endpoint locks the item id inside a gzipped-NBT blob, which is
 * too heavy to decode 38k times in the browser. Instead we match BIN listings
 * to our accessory catalog by display name (reforge prefixes stripped). This
 * is how community lowest-BIN tools work and is accurate for accessories,
 * which have stable, unique names.
 *
 * Exposes on window:
 *   loadLowestBins(catalog) -> Promise<Map<bazaarId, price>>
 *   resolvePrice(id, opts)  -> { market, instaBuy, buyOrder, bin, best, label }
 * ======================================================================= */

"use strict";

/* Common reforge prefixes that appear before an item's base name in the
 * auction `item_name`. Stripped so "Gilded Scavenger Artifact" matches
 * "Scavenger Artifact" and "Toil Fig Hew" matches "Fig Hew". This is not
 * exhaustive, but covers the reforges that most often affect accessories,
 * armor, equipment, and foraging axes. */
const ACCESSORY_REFORGE_PREFIXES = new Set([
  "GILDED", "JADED", "FORCEFUL", "STRONG", "HEROIC", "ZEALOUS", "DEMONIC",
  "HURTFUL", "KEEN", "SUPERIOR", "UNPLEASANT", "FORCEFUL", "BIZARRE",
  "ITCHY", "OMINOUS", "PLEASANT", "PRETTY", "SHADED", "SIMPLE", "VIVID",
  "GODLY", "SHINY", "BLESSED", "BLOODED", "STELLAR", "SILKY", "FRUITFUL",
  "MOIL", "TOIL", "GREEN_THUMB", "BUSTLING", "MOSSY", "FESTIVE",
  "CUBIC", "WARPED", "ANCIENT", "UNDEAD", "MYTHICAL", "FORTUNATE",
  "FABLED", "SPIRITUAL", "SUSPICIOUS", "DIRTY", "FLEET", "HEATED",
  "AMBERED", "AUSPICIOUS", "FLEETING", "MENACING", "RICOCHET", "MAGNETIC",
  "RENOWNED", "GIANT", "TITANIC", "SPIKED", "SUBMERGED", "LUSH", "BLOOMING",
]);

/* Normalise an auction item_name to a comparable base name:
 *   "✪ Gilded Scavenger Artifact ✪" → "scavenger artifact"
 * Strips leading symbols, reforge prefix, and surrounding whitespace. */
function normalizeAuctionName(rawName) {
  let n = rawName
    .replace(/§[0-9a-fk-or]/gi, "")          // legacy color codes
    .replace(/\[[^\]]*Lvl\s*\d+[^\]]*\]/gi, "") // pet level prefix: [Lvl 100]
    .replace(/\bLvl\s*\d+\b/gi, "")         // occasional unbracketed pet level text
    .replace(/[✪⚚✦®™➊➋➌➍➎➏➐➑➒➓]/g, "")     // star / symbol decorations
    .replace(/\s+/g, " ")
    .trim();

  /* Strip a single leading reforge word if present. */
  const parts = n.split(" ");
  if (parts.length > 1 && ACCESSORY_REFORGE_PREFIXES.has(parts[0].toUpperCase().replace(/ /g, "_"))) {
    parts.shift();
    n = parts.join(" ");
  }
  return n.toLowerCase();
}

/* Build a name → item id lookup from any catalog with a byId map.
 * Optional catalog.aliases can add extra auction display names for synthetic
 * ids such as pets that are absent from the resources item endpoint. */
function buildNameIndex(catalog) {
  const idx = new Map();
  for (const id in catalog.byId) {
    const item = catalog.byId[id];
    if (item?.name) idx.set(normalizeAuctionName(item.name), id);
    for (const alias of item?.aliases || []) idx.set(normalizeAuctionName(alias), id);
  }
  for (const [alias, id] of Object.entries(catalog.aliases || {})) {
    idx.set(normalizeAuctionName(alias), id);
  }
  return idx;
}

/* Scan ALL auction pages, compute lowest BIN per matched accessory.
 * Fetches page 0 to learn page count, then the rest in parallel batches.
 * Returns Map<bazaarId, lowestBinPrice>. */
async function loadLowestBins(catalog, { batchSize = 8, onProgress = null } = {}) {
  const nameIdx = buildNameIndex(catalog);
  const lowest = new Map();

  const ingest = (auctions) => {
    for (const a of auctions) {
      if (!a.bin) continue;
      const base = normalizeAuctionName(a.item_name);
      const id = nameIdx.get(base);
      if (!id) continue;
      const price = a.starting_bid;
      const cur = lowest.get(id);
      if (cur == null || price < cur) lowest.set(id, price);
    }
  };

  const first = await fetch(`${CONFIG.API_BASE}/skyblock/auctions?page=0`).then((r) => r.json());
  ingest(first.auctions || []);
  const totalPages = first.totalPages || 1;
  if (onProgress) onProgress(1, totalPages);

  const remaining = [];
  for (let p = 1; p < totalPages; p++) remaining.push(p);

  let done = 1;
  for (let i = 0; i < remaining.length; i += batchSize) {
    const chunk = remaining.slice(i, i + batchSize);
    const results = await Promise.all(
      chunk.map((p) =>
        fetch(`${CONFIG.API_BASE}/skyblock/auctions?page=${p}`)
          .then((r) => r.json())
          .catch(() => null)
      )
    );
    for (const r of results) {
      if (r?.auctions) ingest(r.auctions);
      done++;
      if (onProgress) onProgress(done, totalPages);
    }
  }

  return lowest;
}

/* Resolve the best price for an item given the current market state.
 *
 *   opts.bazaar   — the live bazaar products map (state.raw.products)
 *   opts.bins     — Map<id, price> of lowest BINs
 *   opts.bazaarMode — "instaBuy" | "buyOrder" (which bazaar price to prefer)
 *
 * Returns:
 *   {
 *     market:  "bazaar" | "auction" | "unknown",
 *     instaBuy, buyOrder, bin,      (numbers or null)
 *     best:    number|null,         (the price for the chosen strategy)
 *     label:   short human string
 *   } */
function resolvePrice(id, { bazaar, bins, bazaarMode = "instaBuy" } = {}) {
  const prod = bazaar?.[id];
  if (prod?.quick_status) {
    const instaBuy = prod.quick_status.buyPrice || null;
    const buyOrder = prod.quick_status.sellPrice || null;
    const best = bazaarMode === "buyOrder" ? (buyOrder ?? instaBuy) : (instaBuy ?? buyOrder);
    return {
      market: "bazaar",
      instaBuy, buyOrder, bin: null,
      best,
      label: bazaarMode === "buyOrder" ? "buy order" : "insta-buy",
    };
  }

  const bin = bins?.get(id) ?? null;
  if (bin != null) {
    return { market: "auction", instaBuy: null, buyOrder: null, bin, best: bin, label: "lowest BIN" };
  }

  return { market: "unknown", instaBuy: null, buyOrder: null, bin: null, best: null, label: "—" };
}

window.loadLowestBins = loadLowestBins;
window.resolvePrice   = resolvePrice;
window.normalizeAuctionName = normalizeAuctionName;

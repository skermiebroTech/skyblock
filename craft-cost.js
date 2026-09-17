/* =========================================================================
 * craft-cost.js
 *
 * "What would it cost to craft this myself?" for accessories.
 *
 * Hypixel's own items endpoint has no recipe data, so recipes are bundled
 * statically in data/accessory-recipes.json (generated once from the
 * NotEnoughUpdates community repo by tools/build-craft-recipes.py).
 *
 * The engine walks a recipe tree recursively and prices every leaf material
 * from the live market:
 *
 *   1. material already owned by the player      -> 0     (upgrade chains)
 *   2. bazaar insta-buy / buy-order (per mode)   -> bazaar price
 *   3. auction house lowest BIN                  -> BIN
 *   4. the material is itself craftable          -> its own craft cost
 *
 * Every resolved material is the cheapest of the options above; materials that
 * resolve to nothing (quest drops, dungeon drops, soulbound gear) are reported
 * as `missing`, which is what makes an item "not craftable".
 *
 * Exposes on window:
 *   loadCraftRecipes()                 -> Promise<{recipes, names, loaded, error}>
 *   createCraftPricer(opts)            -> { analyse(id), bestUnit(id), craftOf(id) }
 *   createCraftPricer().analyse(id)    -> {
 *       hasRecipe, craftable, cost, partialCost, pureBazaar,
 *       type, duration, out, materials[], missing[], freeInputs[]
 *   }
 * ======================================================================= */

"use strict";

const CRAFT_RECIPES_URL = "data/accessory-recipes.json?v=20260902-recipes";

/* Fallback display names when the Hypixel items API has no record for an
 * ingredient id (NEU internal ids that Hypixel never exposes). */
function prettyItemId(id) {
  return String(id || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

let craftRecipesPromise = null;

/* Fetch the bundled recipe graph once per page load. Never throws — the site
 * must keep working (without craft prices) if the file is missing. */
function loadCraftRecipes() {
  if (craftRecipesPromise) return craftRecipesPromise;
  craftRecipesPromise = (async () => {
    try {
      const res = await fetch(CRAFT_RECIPES_URL);
      if (!res.ok) throw new Error(`recipe data HTTP ${res.status}`);
      const json = await res.json();
      return {
        recipes: json.recipes || {},
        names: json.names || {},
        loaded: true,
        error: null,
      };
    } catch (e) {
      console.warn("[Hypixie] craft recipe data unavailable:", e);
      return { recipes: {}, names: {}, loaded: false, error: String(e?.message || e) };
    }
  })();
  return craftRecipesPromise;
}

/* Build a pricer bound to one snapshot of the market.
 *
 *   bazaar     — live bazaar products map (state.raw.products)
 *   bins       — Map<id, price> of AH lowest BINs
 *   bazaarMode — "instaBuy" | "buyOrder"
 *   owned      — Set/Map of accessory ids the player already owns (cost 0)
 *   recipes    — the bundled recipe graph
 *   names      — NEU display names, used only as a fallback
 *   nameOf     — optional (id) => string, normally the Hypixel items API name
 */
function createCraftPricer(opts = {}) {
  const {
    bazaar = null,
    bins = null,
    bazaarMode = "instaBuy",
    owned = null,
    recipes = {},
    names = {},
    nameOf = null,
    maxDepth = 12,
  } = opts;

  const ownedIds =
    owned instanceof Map ? new Set(owned.keys()) : owned instanceof Set ? new Set(owned) : new Set();

  const unitMemo = new Map();
  const craftMemo = new Map();
  const inflight = new Set();

  const label = (id) => {
    if (typeof nameOf === "function") {
      const n = nameOf(id);
      if (n) return n;
    }
    return names[id] || prettyItemId(id);
  };

  /* Cheapest market price for one unit of `id`, or null. */
  function marketUnit(id) {
    const prod = bazaar?.[id];
    if (prod?.quick_status) {
      const instaBuy = prod.quick_status.buyPrice || null;
      const buyOrder = prod.quick_status.sellPrice || null;
      const price =
        bazaarMode === "buyOrder" ? (buyOrder ?? instaBuy) : (instaBuy ?? buyOrder);
      if (price != null && price > 0) {
        return { price, source: "bazaar", sourceLabel: bazaarMode === "buyOrder" ? "buy order" : "insta-buy" };
      }
    }
    const bin = bins?.get(id);
    if (bin != null && bin > 0) return { price: bin, source: "ah", sourceLabel: "lowest BIN" };
    return null;
  }

  /* Cheapest way to buy or craft 1 unit of `id`. Owned items are handled by
   * the caller (craftOf) because only it knows how many are required. */
  function bestUnit(id, depth = 0) {
    if (unitMemo.has(id)) return unitMemo.get(id);
    if (inflight.has(id) || depth > maxDepth) return null;   // cycle / runaway guard
    inflight.add(id);

    let best = null;
    try {
      const mkt = marketUnit(id);
      if (mkt && (!best || mkt.price < best.price)) best = mkt;

      const craft = craftOf(id, depth + 1);
      if (craft && craft.craftable && Number.isFinite(craft.cost)) {
        const cand = {
          price: craft.cost,
          source: craft.pureBazaar ? "craft" : "craft-ah",
          sourceLabel: craft.pureBazaar ? "crafted" : "crafted (needs AH part)",
        };
        if (!best || cand.price < best.price) best = cand;
      }
    } finally {
      inflight.delete(id);
    }

    unitMemo.set(id, best);
    return best;
  }

  /* Raw craft cost of `id` — the cheapest of its known recipes. */
  function craftOf(id, depth = 0) {
    if (craftMemo.has(id)) return craftMemo.get(id);
    const list = recipes[id];
    if (!list || !list.length || depth > maxDepth) {
      const none = { hasRecipe: false, craftable: false, cost: null, partialCost: null, materials: [], missing: [], freeInputs: [] };
      craftMemo.set(id, none);
      return none;
    }
    if (inflight.has(id)) return null;
    inflight.add(id);

    let best = null;
    try {
      for (const r of list) {
        const materials = [];
        const missing = [];
        const freeInputs = [];
        let total = 0;
        let ok = true;
        let usedAh = false;

        for (const [ingId, amount] of Object.entries(r.in || {})) {
          /* A player-owned accessory covers the recipe's first copy for free —
           * that is the whole point of an upgrade chain (Wolf Talisman → Wolf
           * Ring). Any further copies (Scarf's Thesis needs 4 Studies) still
           * have to be sourced. */
          const ownedUnits = ownedIds.has(ingId) ? Math.min(amount, 1) : 0;
          const toBuy = amount - ownedUnits;

          let subtotal = 0;
          let source = ownedUnits ? "owned" : null;
          let sourceLabel = ownedUnits ? "you own it" : null;

          if (toBuy > 0) {
            const unit = bestUnit(ingId, depth + 1);
            if (!unit) {
              ok = false;
              missing.push({ id: ingId, name: label(ingId), amount: toBuy });
              continue;
            }
            subtotal = unit.price * toBuy;
            if (unit.source === "ah" || unit.source === "craft-ah") usedAh = true;
            if (!source) { source = unit.source; sourceLabel = unit.sourceLabel; }
            else if (unit.source !== "bazaar") { source = unit.source; sourceLabel = unit.sourceLabel; }
          }

          total += subtotal;
          if (ownedUnits) freeInputs.push({ id: ingId, name: label(ingId), amount: ownedUnits });
          materials.push({
            id: ingId,
            name: label(ingId),
            amount,
            ownedUnits,
            unit: toBuy ? subtotal / toBuy : 0,
            subtotal,
            source: source || "owned",
            sourceLabel: sourceLabel || "you own it",
          });
        }

        const out = r.out || 1;
        const cost = ok ? total / out : null;
        const cand = {
          hasRecipe: true,
          craftable: ok,
          cost,
          partialCost: ok ? cost : total / out,
          pureBazaar: ok && !usedAh,
          type: r.type || "crafting",
          duration: r.duration ?? null,
          out,
          materials: materials.sort((a, b) => b.subtotal - a.subtotal),
          missing,
          freeInputs,
        };

        if (!best) best = cand;
        else if (cand.craftable && (!best.craftable || cand.cost < best.cost)) best = cand;
        else if (!cand.craftable && !best.craftable && (cand.missing.length < best.missing.length)) best = cand;
      }
    } finally {
      inflight.delete(id);
    }

    if (best) craftMemo.set(id, best);
    return best;
  }

  /* Display-ready analysis of one accessory. */
  function analyse(id) {
    const c = craftOf(String(id || "").toUpperCase(), 0);
    if (!c) return null;
    if (!c.hasRecipe) return { hasRecipe: false, craftable: false, cost: null, materials: [], missing: [], freeInputs: [] };
    return c;
  }

  return { analyse, bestUnit, craftOf, label };
}

window.loadCraftRecipes  = loadCraftRecipes;
window.createCraftPricer = createCraftPricer;
window.prettyItemId      = prettyItemId;

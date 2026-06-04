/* =========================================================================
 * attributes.js
 *
 * Attribute-maxing analysis for the linked player.
 *
 * SkyBlock "attributes" are levelled by syphoning Attribute Shards. Each
 * attribute belongs to a rarity (derived from its source shard) which sets
 * how many shards are needed to reach the max level (level 10):
 *
 *   Common    96   Uncommon  64   Rare 48   Epic 32   Legendary 24
 *
 * The player's profile stores progress in members[uuid].attributes.stacks
 * as { attribute_id: shards_invested }. We compare that to the per-rarity
 * maximum to compute how many more shards each attribute needs, and (using
 * live bazaar prices for the corresponding shard) the coin cost to finish.
 *
 * Attribute metadata comes from SkyShards' desc.json (bundled at
 * data/attribute-desc.json):  code → { title, description, id }
 * The code's first letter is the rarity (C/U/R/E/L), and `id` matches the
 * profile's attribute_id exactly.
 *
 * Exposes on window:
 *   buildAttributeCatalog(descJson) -> { byAttrId: {...}, count }
 *   analyseAttributes(catalog, stacks) -> { rows, totalShardsNeeded, ... }
 * ======================================================================= */

"use strict";

const ATTR_RARITY_FROM_CODE = { C: "COMMON", U: "UNCOMMON", R: "RARE", E: "EPIC", L: "LEGENDARY" };

const ATTR_MAX_SHARDS_BY_RARITY = {
  COMMON: 96, UNCOMMON: 64, RARE: 48, EPIC: 32, LEGENDARY: 24,
};

/* Build attribute_id → metadata from the bundled desc.json.
 * Also records the SkyShards code so we can later resolve the source shard's
 * bazaar id (SHARD_<NAME>) for pricing. */
function buildAttributeCatalog(descJson) {
  const byAttrId = {};
  for (const [code, info] of Object.entries(descJson)) {
    if (!info?.id) continue;
    const rarity = ATTR_RARITY_FROM_CODE[code[0]] || "UNKNOWN";
    byAttrId[info.id] = {
      attrId:      info.id,
      title:       info.title,
      description: info.description || "",
      rarity,
      maxShards:   ATTR_MAX_SHARDS_BY_RARITY[rarity] ?? null,
      code,
      /* Source shard bazaar id, e.g. "Nature Elemental" granted by Grove Shard.
       * The shard NAME is the desc title's source — but desc.title IS the
       * attribute name, not the shard. We resolve the shard via the shared
       * SkyShards code against the fusion-properties data at runtime. */
    };
  }
  return { byAttrId, count: Object.keys(byAttrId).length };
}

/* Given the player's attributes.stacks and the catalog, compute the maxing
 * report. Missing attributes are absent from stacks, so every catalog entry is
 * considered and absent/currentless entries are shown as 0/max. `shardPriceFor(code)`
 * is an optional callback returning the unit price of the shard that grants the
 * attribute with that SkyShards code (null if unknown / not on bazaar).
 * `opts.onlyUsable` plus `opts.canUseCode` can filter out attributes above the
 * linked player's Hunting level.
 *
 * Returns:
 *   {
 *     rows: [ {attrId, title, rarity, current, max, remaining, maxed,
 *              missing, usable, requiredHuntingLevel, shardUnitPrice,
 *              remainingCost} ]  sorted: cheapest remainingCost to max first
 *     totalShardsNeeded, totalCost, maxedCount, totalCount
 *   } */
function analyseAttributes(catalog, stacks, shardPriceFor = null, opts = {}) {
  const requirementForCode = opts.requirementForCode || (() => 0);
  const canUseCode = opts.canUseCode || (() => true);
  const onlyUsable = opts.onlyUsable === true;

  const rows = [];
  let totalShardsNeeded = 0;
  let totalCost = 0;
  let maxedCount = 0;
  let hiddenLockedCount = 0;

  /* Iterate the whole catalog, not just profile stacks. Missing attributes are
   * stored as absent keys in members[uuid].attributes.stacks, so a stack-only
   * loop incorrectly hid every attribute the user had never syphoned. */
  for (const meta of Object.values(catalog.byAttrId || {})) {
    if (!meta || meta.maxShards == null) continue;

    const requiredHuntingLevel = requirementForCode(meta.code);
    const usable = canUseCode(meta.code, requiredHuntingLevel);
    if (onlyUsable && !usable) {
      hiddenLockedCount++;
      continue;
    }

    const max = meta.maxShards;
    const current = Number(stacks?.[meta.attrId] || 0);
    const capped = Math.min(current, max);
    const remaining = Math.max(0, max - capped);
    const maxed = remaining === 0;
    const missing = capped === 0;
    if (maxed) maxedCount++;

    const shardUnitPrice = shardPriceFor ? shardPriceFor(meta.code) : null;
    const remainingCost = (shardUnitPrice != null) ? shardUnitPrice * remaining : null;

    totalShardsNeeded += remaining;
    if (remainingCost != null) totalCost += remainingCost;

    rows.push({
      attrId: meta.attrId,
      title: meta.title,
      description: meta.description,
      rarity: meta.rarity,
      code: meta.code,
      current: capped,
      max,
      remaining,
      maxed,
      missing,
      usable,
      requiredHuntingLevel,
      shardUnitPrice,
      remainingCost,
    });
  }

  /* Sort: actionable rows first by cheapest remaining coin cost to max.
   * Priceable rows beat unpriceable rows; fully maxed rows stay at the end. */
  rows.sort((a, b) => {
    if (a.maxed !== b.maxed) return a.maxed ? 1 : -1;
    if (a.maxed && b.maxed) return a.title.localeCompare(b.title);

    const aPriced = Number.isFinite(a.remainingCost);
    const bPriced = Number.isFinite(b.remainingCost);
    if (aPriced !== bPriced) return aPriced ? -1 : 1;
    if (aPriced && bPriced && a.remainingCost !== b.remainingCost) {
      return a.remainingCost - b.remainingCost;
    }

    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    return a.title.localeCompare(b.title);
  });

  return {
    rows,
    totalShardsNeeded,
    totalCost,
    maxedCount,
    totalCount: rows.length,
    hiddenLockedCount,
  };
}

window.buildAttributeCatalog = buildAttributeCatalog;
window.analyseAttributes     = analyseAttributes;
window.ATTR_MAX_SHARDS_BY_RARITY = ATTR_MAX_SHARDS_BY_RARITY;

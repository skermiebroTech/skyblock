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
 * suffix progression: Talisman → Ring → Artifact → Relic.
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
  HEGEMONY_ARTIFACT: 16,   // counts twice in-game but the item itself is LEGENDARY
  RIFT_PRISM:         0,   // grants a rift slot, no MP
  ABICASE:            0,   // MP scales with contacts; we don't model that
};

/* Suffix progression rank within an upgrade family. */
const ACCESSORY_SUFFIX_RANK = {
  TALISMAN:  0,
  RING:      1,
  ARTIFACT:  2,
  RELIC:     3,
};

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
function buildAccessoryCatalog(itemsPayload) {
  const all = (itemsPayload?.items || []).filter((i) => i.category === "ACCESSORY");

  const byId = {};
  for (const it of all) {
    byId[it.id] = {
      id:         it.id,
      name:       it.name,
      tier:       it.tier || "COMMON",
      mp:         accessoryMP(it),
      soulbound:  !!it.soulbound,
      canAuction: it.can_auction !== false,   // default true unless explicitly false
      base:       accessoryFamilyBase(it.name),
    };
  }

  /* Group into families by base name. */
  const famMap = {};
  for (const id in byId) {
    const a = byId[id];
    if (!a.base) continue;
    (famMap[a.base] ||= []).push(a);
  }

  const families = [];
  const familyMemberIds = new Set();
  for (const [base, members] of Object.entries(famMap)) {
    if (members.length < 2) continue;   // not a real chain
    members.sort((x, y) =>
      (ACCESSORY_SUFFIX_RANK[x.name.split(/\s+/).pop().toUpperCase()] ?? 99) -
      (ACCESSORY_SUFFIX_RANK[y.name.split(/\s+/).pop().toUpperCase()] ?? 99)
    );
    families.push({ base, members });
    members.forEach((m) => familyMemberIds.add(m.id));
  }

  const standalone = Object.values(byId).filter((a) => !familyMemberIds.has(a.id));

  return { byId, families, standalone };
}

/* ------------------------------------------------------------------------ */
/* Analyse what the player owns vs. the catalog.                            */
/*                                                                          */
/*   ownedIds: Set<string> of SkyBlock accessory ids in the player's bag    */
/*                                                                          */
/* Returns:                                                                  */
/*   {                                                                       */
/*     currentMP, maxMP,                                                     */
/*     missing:    [ {item, mp, reason} ]   sorted by mp desc               */
/*     upgrades:   [ {owned, target, mpGain} ] sorted by mpGain desc        */
/*   }                                                                       */
/* ------------------------------------------------------------------------ */
function analyseAccessories(catalog, ownedIds) {
  const missing = [];
  const upgrades = [];

  let currentMP = 0;
  let maxMP = 0;

  /* Track which families the player has at least one member of, and the
   * highest tier they own within each. */
  for (const fam of catalog.families) {
    const highest = fam.members[fam.members.length - 1];
    maxMP += highest.mp;

    /* Which members does the player own? */
    const ownedMembers = fam.members.filter((m) => ownedIds.has(m.id));

    if (ownedMembers.length === 0) {
      /* Whole family missing — counts as missing the TOP item (that's the
       * eventual goal; SkyHelper shows the base item, but ranking by the
       * max-MP target is more useful for planning). */
      missing.push({
        item: highest,
        mp: highest.mp,
        family: fam.base,
        reason: "family-missing",
      });
      continue;
    }

    /* Own at least one — credit the highest owned, flag upgrade if not top. */
    const bestOwned = ownedMembers[ownedMembers.length - 1];
    currentMP += bestOwned.mp;

    if (bestOwned.id !== highest.id) {
      upgrades.push({
        owned:  bestOwned,
        target: highest,
        mpGain: highest.mp - bestOwned.mp,
        family: fam.base,
      });
    }
  }

  /* Standalone accessories — own it or you don't. */
  for (const a of catalog.standalone) {
    maxMP += a.mp;
    if (ownedIds.has(a.id)) {
      currentMP += a.mp;
    } else if (a.mp > 0 && !a.soulbound) {
      /* Skip soulbound (can't be traded for) and zero-MP items in the
       * "missing" list — they're not actionable buy targets. */
      missing.push({
        item: a,
        mp: a.mp,
        family: null,
        reason: "standalone-missing",
      });
    } else if (ownedIds.has(a.id)) {
      currentMP += a.mp;
    }
  }

  missing.sort((x, y) => y.mp - x.mp);
  upgrades.sort((x, y) => y.mpGain - x.mpGain);

  return { currentMP, maxMP, missing, upgrades };
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

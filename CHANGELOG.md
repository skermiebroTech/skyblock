# Changelog

## 2026-06-04

- Expanded the Minion Calculator catalog from the old 37/38 standard-minion subset to the 60 current SkyCrypt minion families, including uncrafted families such as Flower, Red Sand, and Inferno.
- Fixed Minion Calculator maxed counts to respect each family’s real max tier (T11 or T12), so `IAmWood_` on Papaya now matches SkyCrypt at `44 / 60` maxed instead of undercounting the catalog.
- Fixed Minion Calculator profile sync for Hypixel generator IDs that do not match display IDs: `CAVESPIDER_*` now maps to Cave Spider and `ENDER_STONE_*` now maps to End Stone, so already-crafted minions no longer appear as uncrafted/next upgrades.
- Credit: `iamwood_` for finding and reporting the Minion Calculator crafted-minion sync bug.
- Fixed Attribute Maxing shard totals by rarity: Common 96, Uncommon 64, Rare 48, Epic 32, Legendary 24. This fixes Rare attributes incorrectly showing `0/32` instead of `0/48` and updates Epic/Legendary totals to the current values too.
- Credit: `iamwood_` for bringing the Attribute Shard max-total issue to our attention.

# Hypixie

A browser-based **Hypixel SkyBlock optimizer**. Reads the official Hypixel API straight from your browser and helps you:

- flip **Attribute Shards** on the Bazaar (live profit, spreads, fusion crafting)
- plan **accessory Magical Power** — what's missing, what to upgrade, what to recombobulate
- **max your attributes** — exactly how many shards each one needs and the coin cost
- optimize **Sweep** — all known Sweep sources sorted from lowest to highest live coin cost
- track and calculate **SkyBlock Mutations** — collection progress, recursive recipe requirements, Greenhouse slot planning, and a static profit leaderboard

No backend. No build step. No tracking. Static files you can host on GitHub Pages.

![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-blueviolet) ![No build](https://img.shields.io/badge/build-none-success) ![License](https://img.shields.io/badge/license-MIT-blue) 
[Hypixie](https://skermiebrotech.github.io/skyblock/)

---

## What it does

- Fetches the [Hypixel Bazaar endpoint](https://api.hypixel.net/v2/skyblock/bazaar) every 60 seconds and computes realistic order-flip economics for every Attribute Shard.
- Detects the best **fusion** craft-and-flip recipes.
- Link your account (username + API key) to unlock accessory & attribute planning:
  - **Accessory Path** combines missing accessories, family upgrades, and recombobulates into one ranked checklist with `/bz` & `/ahs` copy commands and live prices.
  - **Attribute maxing** — shards remaining and live bazaar cost per attribute, sorted by cheapest remaining cost to max first.
  - **Personalized craft flips** — your Hunting level is pulled from the profile API and fusion opportunities above your level are locked out of profit rankings.
- **Sweep Optimizer** lists permanent, pet, armor, tool, equipment, enchantment, attribute, booster, and Heart of the Forest Sweep sources. Bazaar-tradable methods use live Bazaar prices; gear/pets use live lowest-BIN Auction House scans; progression-only sources are clearly marked as not directly priceable. When a profile is linked, completed/owned Sweep sources are hidden from recommendations by default and can be reviewed with **Show completed**.
- Every item links to the **Hypixel Wiki**; **soulbound** items are flagged (can't be bought on the AH).
- Player panel shows coin purse, bank, SkyBlock level, Hunting/Combat levels, slayer XP, and fairy souls.
- Stores responses in `localStorage` with short TTLs so quick reloads don't hammer the API.

---

## Project structure

```
shard-market/
├── index.html              ← Markup & shell (4 pages: Shards / Accessory Path / Attributes / Sweep)
├── style.css               ← Obsidian + ember dashboard styling
├── script.js               ← API client, caching, profit + fusion math, page renderers
├── shards-data.js          ← Static lookups (rarity, colors, texture-pack registry, ID overrides)
├── sweep-data.js           ← Static Sweep source list from the Hypixel Wiki Sweep page
├── mutations-data.js       ← Static SkyBlock Mutation recipes/effects/costs from the public SkyMutations dataset
├── nbt.js                  ← Minimal NBT parser (decodes the gzipped inventory blob)
├── prices.js               ← Unified price resolver: bazaar + AH lowest-BIN scan
├── accessories.js          ← Accessory catalog, upgrade families, Magical Power math
├── attributes.js           ← Attribute catalog + shards-to-max calculation
├── data/
│   ├── fusion-properties.json   ← Per-shard metadata (179 shards, from SkyShards)
│   ├── fusion-data.json         ← Full fusion recipe graph (~2 MB, from SkyShards)
│   └── attribute-desc.json      ← Attribute id → rarity/title/effect (from SkyShards)
└── README.md
```

The two JSON files under `data/` come from the open-source [SkyShards](https://github.com/Campionnn/SkyShards) project (MIT) and bundle the community-maintained fusion recipes + per-shard metadata. They're loaded once and cached in `localStorage` for 24 h.

No bundler, no `npm install`, no toolchain. Open `index.html` in any modern browser and it works.

---

## The three pages

Linking your account (username + an API key in Settings) unlocks two extra pages alongside the shard market:

### Shard Market
Live bazaar profitability + the fusion calculator (see below). The sort menu includes
**Cheapest to max level**, **Skill / category (cheapest max first)**, **Skill / category (A → Z)**,
and **Attribute (A → Z)** so you can group shards by Combat/Forest/Water or by attribute name
and put the cheapest maxing route at the top of each skill group.

### Accessory Path
Like SkyHelper's `/missing` command plus upgrades in one place. Decodes your talisman bag
straight from the Hypixel API, combines missing families, lower-tier family upgrades, and
recombobulates into a single ranked path forward, and shows one-click **Copy** buttons for
the in-game sourcing command — `/ahs <item>` for Auction-House items, `/bz <item>` for
anything bazaar-tradable. Sort by MP gain, item price, or cost per MP.

Accessory family logic combines live Hypixel item data with maintained chain/alias rules
mirrored from SkyCrypt / SkyHelper-Networth / NEU-style data, so non-obvious lines like
Personal Compactors, Campfire badges, Wedding Rings, Cat → Lynx → Cheetah, Scarf Studies,
Crystal upgrades (`Night Crystal → Moonlight Crystal`, `Day Crystal → Sunshine Crystal`),
Fish Bowls, Kuudra organs, Crux Chronomicon → Celestial Starstone, Helianthus Relic,
and Shady Ring → Seal of the Family are treated as one upgrade path instead of separate
missing accessories.

### Attributes
How many **Attribute Shards** you still need to take each usable attribute to level 10.
The report includes attributes you have never syphoned as **missing** (`0/max`), filters out
attributes above your profile's Hunting level, then shows current/max progress, the exact
shard count remaining, and the live bazaar cost to finish — with a `/bz` command for
the source shard. Totals across all usable attributes are shown up top.

The Accessory Path page shows a live **Magical Power progress bar**.

### Sweep Optimizer

A cost-ranked checklist for increasing **Sweep**. It uses the Sweep wiki source list supplied in `sweep-data.js` and prices anything market-tradable live:

- **Bazaar**: Agatha's Coupons, Sweep Boosters, First Impression, Citrine, and Sweep-related Attribute Shards.
- **Auction House lowest BIN**: pets, foraging armor, axes, and equipment.
- **Progression / situational sources**: Tree Gift milestones, Heart of the Forest perks, David's Cloak milestones, and other sources that do not have a direct coin price.

Attribute entries assume the Tier X target shown on the wiki and estimate maxing from Tier I shards (`512×` Tier I shards). The page sorts live-priced methods from cheapest to most expensive and also shows cost per Sweep where the source has a numeric Sweep gain.

With a linked profile, the page decodes inventory/armor/equipment/wardrobe/backpacks, pets, attributes, collections/personal bests, Tree Gift progress, and Heart of the Forest nodes to mark sources as **Recommended**, **Partly done**, or **Already have**. Already-completed sources are hidden by default so the checklist focuses on ways to gain more Sweep. Gear alternatives are treated as tiered progressions: owning a completed higher tier such as **Fig Armor** or **Figstone Splitter** suppresses lower-tier recommendations like Canopy Armor, Spruce Axe, or Treecapitator.

### Minion Maxing Calculator

An interactive, live-priced minion upgrade planner designed to help you unlock maximum minion slots for the absolute lowest coin cost.

- **Automated Profile Syncing**: When an account is linked, the calculator decodes the active profile's `crafted_generators` array to automatically import your exact crafted level for all 38 standard minions.
- **Cheapest Next Upgrade Sorting**: Computes the exact crafting ingredients and coin cost to take each of your minions to its next tier (e.g. T4 -> T5). It then ranks the entire minion list ascending, showing you the absolute cheapest minion upgrades available on your profile.
- **Start from Scratch Toggle**: Want to plan minion crafting from the ground up? Toggle **Start upgrades from Level 1 (T0)** to calculate the upgrade cost assuming you have zero levels, ignoring your profile.
- **Interactive Level Override**: Every minion card features a manual dropdown level selector (T0 to T11). This allows you to manually mock up other setups, modify levels, or simulate progress in real-time.
- **One-click /bz Copy Shortcuts**: Displays precise quantities and unit prices for all raw or enchanted materials required for the next upgrade, paired with instant clipboard copy buttons for official Hypixel Bazaar commands (e.g., `/bz Spawn Egg`, `/bz Enchanted Rotten Flesh`).
- **Smart "Max to T11" Shopping List**: Features a **Max to T11 Shopping List** button on each minion card. Clicking it calculates the exact combined materials needed to upgrade from its current level all the way to Tier 11, grouping multiple levels of the same materials together so you only have to buy each type once. It includes a **Copy All** button to copy all required `/bz` commands at once, plus individual copy buttons for each aggregated ingredient.

### Mutations

A static companion for the new SkyBlock Mutations system, modeled after the public SkyMutations site data:

- **Collection tracker** for the 40 discoverable mutations, grouped by rarity, with progress stored locally in the browser.
- **Recursive recipe calculator** that expands direct spreading conditions into base material requirements for any quantity.
- **Greenhouse planner** that estimates extra Ethereal Vines needed for slot targets and uses the live Bazaar price when Hypixel exposes an Ethereal Vine product.
- **Profit leaderboard** ranking mutations by static coin value, recursive ingredient cost, profit per harvest, and profit per hour for a configurable cycle length.

The bundled data lives in `mutations-data.js`; refresh it when the upstream mutation list or recipes change.

### Hunting-level craft flips

When you link a profile, the app reads `members[uuid].player_data.experience.SKILL_HUNTING` from the Hypixel Profiles API and converts XP to a Hunting level with the standard skill XP table. Fusion craft flips are then personalized: recipes above your Hunting level are shown as locked and excluded from the Best Fusions/profitable-fusion rankings, so the top craft flips are ones your profile can actually perform.

Current fusion gates use the shard rarity ladder: Common 0, Uncommon 10, Rare 20, Epic 30, Legendary 40. If Hypixel changes fusion requirements, update `FUSION_HUNTING_REQUIREMENT_BY_RARITY` in `script.js`.

### Real prices

- **Shards (bazaar)** show either **insta-buy** (buy now from sell offers) or
  **buy-order** (place an order — cheaper, slower). Toggle between them with the
  *Shard price* switch on the **Attributes** page; the total maxing cost updates live.
- **Auction-House items** show the **lowest BIN**, computed by scanning the
  official `/skyblock/auctions` endpoint (all pages, in parallel batches, cached
  5 min) and matching listings to known item names (reforge prefixes and pet level
  prefixes stripped). The scan starts automatically the first time you open an
  accessory or Sweep page.
- **Prefer max tier** (on by default): targets the *family maximum* accessory. Turn
  it off to target only the *next tier up* — cheaper, incremental upgrades.

> Accessories are Auction-House-only in SkyBlock, so there's no bazaar buy/sell choice
> for them — that toggle lives on the Attributes page, where shards are bought from the
> Bazaar.

> **How the inventory is read:** Hypixel returns inventories as gzipped, base64-encoded
> NBT. No third-party SkyBlock API (SkyCrypt, Coflnet, etc.) allows browser CORS, so
> the site decodes the NBT itself client-side using the native `DecompressionStream`
> API and a tiny hand-written NBT parser (`nbt.js`). Nothing leaves your browser except
> the calls to `api.hypixel.net` and the Mojang username proxy.

---

## Setup (local)

```bash
# Mac/Linux
xcode-select --install 2>/dev/null || true   # Mac only, if git is missing
# Windows: install Git for Windows first: https://git-scm.com/download/win

git clone https://github.com/skermiebroTech/skyblock.git
cd skyblock

# Serve with any static server (recommended; fetch() works normally over http://)
python3 -m http.server 8000
# then visit http://localhost:8000
```

No `npm install` is needed. If Python is not installed on the other PC, you can still open `index.html` directly, but a local server avoids browser `file://` fetch restrictions.

The Shard Market and fusion flips need no API key. Profile-dependent pages (Missing Accessories, Upgrades, Attributes, and Hunting-level personalization) need your Hypixel API key in **Settings → Hypixel API key** on that browser; it is stored only in that browser's `localStorage`.

---

## Deploying to GitHub Pages

GitHub Pages serves any static repository — perfect for this project.

1. **Create a GitHub repo** and push these files to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Shard Market"
   git branch -M main
   git remote add origin https://github.com/<you>/shard-market.git
   git push -u origin main
   ```

2. **Enable Pages**: On GitHub, go to **Settings → Pages**.
   - Source: **Deploy from a branch**
   - Branch: **main**, folder: **`/ (root)`**
   - Click **Save**.

3. Within ~1 minute, the site is live at `https://<you>.github.io/shard-market/`.

4. **Custom domain (optional)**: Add a `CNAME` file with your domain, then point a DNS `CNAME` record at `<you>.github.io`.

### Re-deploying

Every `git push` to `main` re-publishes. There is no build step to wait for — refresh and you'll see your changes within a few seconds (modulo browser caching; hard-reload with `Ctrl+Shift+R` / `Cmd+Shift+R`).

---

## How the profitability calculations work

Hypixel's Bazaar is a continuous double-sided order book. For every product the API exposes a `quick_status` object with two key prices:

| API field            | What it means                                                     | Real-world meaning            |
|----------------------|-------------------------------------------------------------------|-------------------------------|
| `quick_status.buyPrice`  | Weighted avg of the top 2 % cheapest **sell offers**.         | Price you **pay to insta-buy**.  |
| `quick_status.sellPrice` | Weighted avg of the top 2 % highest **buy orders**.           | Price you **receive when you insta-sell**.|

For any liquid product, `buyPrice > sellPrice` — that gap is the market's bid-ask spread.

### Why we don't optimize for insta-flipping

If you instabuy *and* instasell, you cross the spread *and* pay the sell-side tax. That's a loss-making strategy by definition. Anyone actually flipping shards uses **orders**:

1. Place a **buy order** at one tick above the current highest buy order. After a delay, you've filled units at ≈ `sellPrice`.
2. Place a **sell offer** at one tick below the current lowest sell offer. After a delay, your units sell at ≈ `buyPrice` and you receive `buyPrice × (1 − tax)` per unit (the bazaar deducts tax from sell-order payouts only).

That collapses to:

```
profitPerUnit  =  buyPrice × (1 − tax)  −  sellPrice
marginPercent  =  profitPerUnit / sellPrice × 100
```

This is the metric shown in the **Profit / unit** and **Margin** columns.

### The bazaar tax

- **1.25 %** — base rate.
- **1.125 %** — reduced via the free *Bazaar Flipper I* community upgrade.
- **1.0 %**   — reduced further via the paid *Bazaar Flipper II* community upgrade.
- **2.25 %** — when Mayor **Aura** is active (rate is temporarily doubled).

Pick yours in **Settings → Bazaar tax rate** so the numbers reflect your real account.

### Spread vs profit per unit

- **Spread** = `buyPrice − sellPrice`. The pre-tax gap. A handy reference, but it overstates real profit.
- **Profit / unit** = `Spread − (buyPrice × tax)`. The figure you actually pocket.

The columns sort independently so you can hunt by either lens.

### Weekly volume — why it matters more than margin

A 1 M-coin margin on a shard that trades 5 units / week is far less useful than a 100-coin margin on a shard that cycles 50 000 / week. The **Vol / wk** column sums `quick_status.sellMovingWeek` and `buyMovingWeek` so you can see real liquidity, and the sort dropdown includes an **Expected weekly profit** mode that combines margin with throughput.

### What's not modelled

- **Order-book depth.** The reported `buyPrice` / `sellPrice` are weighted averages of the top 2 % only — fills outside that band move the price. Treat the figures as theoretical.
- **Competition / undercut wars.** The model assumes you can always place an order one tick inside the spread. For high-margin shards, every other flipper is doing the same — fill times can be slow.
- **Fusion machine timing.** The fusion calculator assumes you can craft and immediately flip; in practice each fusion takes wall-clock time at the Fusion Machine.

---

## Fusion calculator

Beyond simple flipping, the tool computes **craft-and-flip** economics for every shard that has a known recipe.

### The math

For each target shard, every known 2-input recipe is evaluated:

```
inputCost      = price(inputA) × fuseAmount(inputA) + price(inputB) × fuseAmount(inputB)
costPerOutput  = inputCost / recipeOutputQty
fusionProfit   = targetBuyPrice × (1 − tax)  −  costPerOutput
fusionMargin   = fusionProfit / costPerOutput × 100
```

SkyShards recipes list the two input shard types, and each input slot consumes that shard's `fuse_amount` from `fusion-data.json` (for example, 5× a common input or 2× an uncommon input), so the UI shows both the per-shard price and the total cost for that input stack.

Input pricing uses *insta-buy* cost (the visible `/bz` cost to buy from sell offers), with *buy-order* as a fallback if no sell offers exist. This avoids fake-cheap fusion routes on thin markets where `sellPrice` can be tiny because only stale buy orders exist. The cheapest pair across all output-qty buckets wins, and that becomes the row's **Fusion Δ** value.

### Where the recipes come from

Recipes and metadata are bundled from the [SkyShards](https://github.com/Campionnn/SkyShards) project (MIT licensed) as two JSON files under `data/`. SkyShards short-codes (`C1`, `U7`, `L42`...) map to bazaar product IDs via display name, with [a few manual overrides](shards-data.js) for spelling mismatches (e.g. SkyShards "Loch Emperor" → bazaar `SHARD_SEA_EMPEROR`).

### Best Fusions panel

The dashboard's top **Best Fusions** panel shows the six highest-profit recipes right now, with input prices, output quantity, and per-unit margin so you can decide what to craft this session. The main shard list also shows each row's best recipe inline under the shard name, so recipes are visible without hovering the ⚒ badge.

### Toggles

- **Has fusion recipe** — hides shards that can only be syphoned, not fused.
- **Profitable fusion only** — hides recipes with negative profit (most are at any given moment).

---

## Texture packs

Each row and fusion card shows a shard icon. The pack is configurable in **Settings → Shard texture pack**:

- **SkyShards (default)** — pulled from the SkyShards GitHub repo. Always in sync with new shards because it uses the same code-naming.
- **Hypixel Wiki** — attempts to resolve official wiki textures. Coverage is partial.
- **None** — text-only mode for slow connections.

Adding a new pack is one entry in the `TEXTURE_PACKS` object in `shards-data.js` — just write a `resolve(bazaarId, ctx)` function that returns a URL.

---

## Extending

### Updating bundled fusion data

The shard metadata + recipe graph come from the SkyShards project. To pull updates:

```bash
curl -o data/fusion-properties.json https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/fusion-properties.json
curl -o data/fusion-data.json       https://raw.githubusercontent.com/Campionnn/SkyShards/master/public/fusion-data.json
```

After updating, bump the cache key suffixes in `script.js` (`CACHE_KEY_FUSION_PROPS` / `CACHE_KEY_FUSION_DATA`) so returning visitors discard the old `localStorage` blob.

### Handling new bazaar shards

The site auto-discovers any product whose ID starts with `SHARD_`. If a new shard ships and its name doesn't match SkyShards (i.e. the auto-derived ID is wrong), add a one-line override to `SKYSHARDS_TO_BAZAAR_OVERRIDES` in `shards-data.js`.

### Adding a texture pack

In `shards-data.js`:

```js
TEXTURE_PACKS.myPack = {
  label: "My pack",
  resolve(bazaarId, ctx) {
    const code = ctx.bazaarToCode[bazaarId];
    return code ? `https://example.com/icons/${code}.png` : null;
  },
};
```

### Changing the cache TTL

In `script.js`, edit `CONFIG.CACHE_TTL_BAZAAR_MS`. The Hypixel Bazaar publishes new snapshots every ~60 s, so values much below that just hammer their servers for no fresh data.

---

## API rate limits & etiquette

- The Bazaar endpoint is **unauthenticated** and globally throttled. Spamming `/refresh` is rude — the cache exists precisely so you don't have to.
- Authenticated endpoints (player data, profile data, etc.) are rate-limited per API key: typically **120 requests per minute**. The Bazaar endpoint doesn't count against your key.
- If you ever start hitting `429 Too Many Requests`, raise `CACHE_TTL_MS` and back off for a minute.

---

## Browser support

Tested on current Chrome / Firefox / Safari / Edge. Uses standard `fetch`, `async/await`, `Intl.NumberFormat`, `localStorage`, CSS `color-mix()`, and `:focus-visible`. No IE.

---

## License

MIT. Do what you want.

This project is not affiliated with, endorsed by, or sponsored by Hypixel, Mojang, or Microsoft. All product names, logos, and brands are the property of their respective owners.

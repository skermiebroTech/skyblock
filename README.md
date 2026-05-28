# Shard Market

A live profitability analyzer for Hypixel SkyBlock **Attribute Shards**. Reads the public Hypixel Bazaar API straight from your browser, computes order-flip margins, and presents everything in a sortable / filterable dashboard.

No backend. No build step. No tracking. Just three static files you can host on GitHub Pages.

![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20CSS%20%2B%20JS-blueviolet) ![No build](https://img.shields.io/badge/build-none-success) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## What it does

- Fetches the [Hypixel Bazaar endpoint](https://api.hypixel.net/v2/skyblock/bazaar) every 60 seconds.
- Filters down to every product whose ID starts with `SHARD_` or `ATTRIBUTE_SHARD` (so new shards added in future updates appear automatically).
- Computes realistic flip economics: insta-buy cost, insta-sell revenue, gross spread, **net order-flip profit per unit (after the bazaar tax)**, and percentage margin.
- Enriches each shard with rarity, family, and attribute name from a built-in metadata table sourced from the [Hypixel Wiki Attributes page](https://wiki.hypixel.net/Attributes). Unknown shards still appear — they just get auto-prettified names and a "new" badge.
- Stores responses in `localStorage` with a 60 s TTL so quick reloads don't hammer the API.
- Lets you filter by rarity, search by name / attribute / family, and sort by any column.

---

## Project structure

```
shard-market/
├── index.html              ← Markup & shell (4 pages: Shards / Missing / Upgrades / Attributes)
├── style.css               ← Obsidian + ember dashboard styling
├── script.js               ← API client, caching, profit + fusion math, page renderers
├── shards-data.js          ← Static lookups (rarity, colors, texture-pack registry, ID overrides)
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

## The four pages

Linking your account (username + an API key in Settings) unlocks three extra pages alongside the shard market:

### Shard Market
Live bazaar profitability + the fusion calculator (see below).

### Missing Accessories
Like SkyHelper's `/missing` command. Decodes your talisman bag straight from the
Hypixel API, figures out which accessory families you own none of, and ranks them
by the **Magical Power** they'd add. Each card has a one-click **Copy** button for the
in-game sourcing command — `/ahs <item>` for Auction-House items, `/bz <item>` for
anything bazaar-tradable.

### Accessory Upgrades
Shows accessories you own at a lower tier than their family maximum
(e.g. *Scavenger Talisman → Scavenger Artifact*, +8 MP). Ranked by MP gained, again
with copy-ready `/ahs` / `/bz` commands.

### Attributes
How many **Attribute Shards** you still need to take each attribute to level 10,
read from your profile's `attributes.stacks`. Shows current/max progress, the exact
shard count remaining, and the live bazaar cost to finish — with a `/bz` command for
the source shard. Totals across all attributes are shown up top.

Both accessory pages show a live **Magical Power progress bar**.

### Real prices

- **Shards (bazaar)** show either **insta-buy** (buy now from sell offers) or
  **buy-order** (place an order — cheaper, slower). Toggle between them with the
  *Shard price* switch on the **Attributes** page; the total maxing cost updates live.
- **Accessories (Auction House)** show the **lowest BIN**, computed by scanning the
  official `/skyblock/auctions` endpoint (all ~42 pages, in parallel batches, cached
  5 min) and matching listings to items by name (reforge prefixes stripped). The scan
  starts automatically the first time you open an accessory page.
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
git clone https://github.com/<you>/shard-market.git
cd shard-market

# Option A — just open the file
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows

# Option B — serve with any static server (recommended; some browsers restrict fetch on file://)
python3 -m http.server 8000
# then visit http://localhost:8000
```

The site needs no API key to run. The Bazaar endpoint is a public, unauthenticated route. If you want to attach a key anyway (for future authenticated extensions), click **Settings → Hypixel API key**. The key is stored in your browser's `localStorage` only.

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
inputCost      = price(inputA) + price(inputB)
costPerOutput  = inputCost / recipeOutputQty
fusionProfit   = targetBuyPrice × (1 − tax)  −  costPerOutput
fusionMargin   = fusionProfit / costPerOutput × 100
```

Input pricing uses the cheaper of *buy order* (preferred — what you'd pay to source via order) or *insta-buy* (fallback if no buy orders exist). The cheapest pair across all output-qty buckets wins, and that becomes the row's **Fusion Δ** value.

### Where the recipes come from

Recipes and metadata are bundled from the [SkyShards](https://github.com/Campionnn/SkyShards) project (MIT licensed) as two JSON files under `data/`. SkyShards short-codes (`C1`, `U7`, `L42`...) map to bazaar product IDs via display name, with [a few manual overrides](shards-data.js) for spelling mismatches (e.g. SkyShards "Loch Emperor" → bazaar `SHARD_SEA_EMPEROR`).

### Best Fusions panel

The dashboard's top **Best Fusions** panel shows the six highest-profit recipes right now, with input prices, output quantity, and per-unit margin so you can decide what to craft this session.

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

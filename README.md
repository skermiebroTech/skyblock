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
├── index.html         ← Markup & shell
├── style.css          ← Obsidian + ember dashboard styling
├── script.js          ← API client, caching, profit math, render pipeline
├── shards-data.js     ← Curated shard metadata (rarity, family, attribute)
└── README.md
```

That's it. No bundler, no `npm install`, no toolchain. Open `index.html` in any modern browser and it works.

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
- **Fusion crafting profit.** The data model in `shards-data.js` includes a `FUSION_RECIPES` table that's intentionally empty in this release. Wiki recipes are easy to add — see *Extending* below.

---

## Extending

### Adding a new shard's metadata

Open `shards-data.js` and add an entry to `SHARDS_DB`:

```js
SHARD_NEWSHARD: {
  name: "New Shard",
  attribute: "Some Attribute Name",
  rarity: "EPIC",
  family: "Combat",
  huntLevel: 15,   // optional
},
```

That's it. The tool already picks up everything in the bazaar response — the table just gets a prettier name and a rarity-coloured badge for that entry.

### Adding a fusion recipe

In `shards-data.js`:

```js
const FUSION_RECIPES = {
  SHARD_ENT: [
    { id: "SHARD_GROVE",  qty: 2 },
    { id: "SHARD_BAMBOO", qty: 1 },
  ],
};
```

A future UI extension can use these to compare "buy the shard" vs "fuse it from components".

### Changing the cache TTL

In `script.js`, edit `CONFIG.CACHE_TTL_MS`. The Hypixel Bazaar publishes new snapshots every ~60 s, so values much below that just hammer their servers for no fresh data.

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

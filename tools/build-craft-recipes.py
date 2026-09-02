#!/usr/bin/env python3
"""Build data/accessory-recipes.json for Hypixie.

Hypixel's own /v2/resources/skyblock/items endpoint does NOT expose crafting
recipes, so we pull them from the community NotEnoughUpdates repo (MIT-ish,
public data) once, at development time, and bundle the result as a static file.
The site itself stays backend-free and does not talk to GitHub at runtime.

Pipeline
  1. Hypixel items API      -> every ACCESSORY item id
  2. Hypixel bazaar API     -> which item ids can simply be bought (price leaves)
  3. NEU repo (raw GitHub)  -> shaped `recipe` / list `recipes` for each id
  4. Closure crawl: any ingredient that is neither on the bazaar nor already
     fetched gets fetched too, so deep chains (Bat Talisman -> Bat Ring ->
     Bat Artifact, Enchanted X -> Enchanted X Block, ...) can be priced.

Usage
  python tools/build-craft-recipes.py            # incremental (uses .neu-cache)
  python tools/build-craft-recipes.py --refresh  # ignore cached NEU files
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".neu-cache")
OUT = os.path.join(ROOT, "data", "accessory-recipes.json")

ITEMS_URL = "https://api.hypixel.net/v2/resources/skyblock/items"
BAZAAR_URL = "https://api.hypixel.net/v2/skyblock/bazaar"
NEU_URL = "https://raw.githubusercontent.com/NotEnoughUpdates/NotEnoughUpdates-REPO/master/items/{}.json"

WORKERS = 16
MAX_ITEMS = 20000           # hard safety cap on how many NEU files we pull
RECIPE_TYPES = {"crafting", "forge"}

USER_AGENT = "Hypixie-recipe-builder/1.0 (+static site build tooling)"


def http_get(url: str, retries: int = 3, timeout: int = 30) -> bytes | None:
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if attempt == retries - 1:
                return None
            time.sleep(1.5 * (attempt + 1))
        except Exception:
            if attempt == retries - 1:
                return None
            time.sleep(1.5 * (attempt + 1))
    return None


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def strip_colors(s: str) -> str:
    return re.sub(r"§[0-9a-fk-orA-FK-OR]", "", s or "").strip()


def parse_entry(raw: str):
    """'ENCHANTED_BONE:2' -> ('ENCHANTED_BONE', 2). 'ENCHANTED_BONE' -> ('...',1)."""
    if not raw:
        return None
    raw = raw.strip()
    if not raw:
        return None
    if ":" in raw:
        item_id, _, cnt = raw.rpartition(":")
        try:
            count = int(cnt)
        except ValueError:
            item_id, count = raw, 1
    else:
        item_id, count = raw, 1
    item_id = item_id.strip().upper()
    if not item_id or count <= 0:
        return None
    return item_id, count


def extract_recipes(doc: dict):
    """Return a list of {type, in: {id: amount}, out: n, duration: sec|None}."""
    out = []

    shaped = doc.get("recipe")
    if isinstance(shaped, dict) and shaped:
        ing = {}
        for _slot, raw in shaped.items():
            parsed = parse_entry(raw if isinstance(raw, str) else "")
            if not parsed:
                continue
            iid, cnt = parsed
            ing[iid] = ing.get(iid, 0) + cnt
        if ing:
            out.append({"type": "crafting", "in": ing, "out": doc.get("recipeCount") or 1, "duration": None})

    for r in doc.get("recipes") or []:
        if not isinstance(r, dict):
            continue
        rtype = (r.get("type") or "crafting").lower()
        if rtype not in RECIPE_TYPES:
            continue
        ing = {}
        for raw in r.get("inputs") or []:
            parsed = parse_entry(raw if isinstance(raw, str) else "")
            if not parsed:
                continue
            iid, cnt = parsed
            ing[iid] = ing.get(iid, 0) + cnt
        if not ing:
            continue
        out.append({
            "type": rtype,
            "in": ing,
            "out": r.get("count") or 1,
            "duration": r.get("duration") or None,
        })

    return out


def neu_fetch(item_id: str, refresh: bool):
    path = os.path.join(CACHE, item_id + ".json")
    if os.path.exists(path) and not refresh:
        try:
            return item_id, load_json(path)
        except Exception:
            pass
    raw = http_get(NEU_URL.format(item_id))
    if raw is None:
        with open(path, "w", encoding="utf-8") as f:
            f.write("null")
        return item_id, None
    try:
        doc = json.loads(raw.decode("utf-8"))
    except Exception:
        return item_id, None
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False)
    return item_id, doc


def fetch_many(ids, refresh: bool):
    """Fetch a batch of NEU item docs in parallel. Returns {id: doc|None}."""
    res = {}
    if not ids:
        return res
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(neu_fetch, i, refresh): i for i in ids}
        done = 0
        for fut in as_completed(futs):
            iid, doc = fut.result()
            res[iid] = doc
            done += 1
            if done % 100 == 0:
                print(f"    ... {done}/{len(ids)}", flush=True)
    return res


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download cached NEU item files")
    args = ap.parse_args()

    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)

    print("[1/4] Hypixel items API ...")
    raw = http_get(ITEMS_URL, timeout=60)
    if raw is None:
        print("  ! failed to fetch items API", file=sys.stderr)
        return 1
    items = json.loads(raw.decode("utf-8")).get("items") or []
    accessories = [i for i in items if i.get("category") == "ACCESSORY"]
    print(f"  {len(items)} items, {len(accessories)} accessories")

    print("[2/4] Bazaar products ...")
    raw = http_get(BAZAAR_URL, timeout=60)
    bazaar_ids = set()
    if raw is not None:
        bazaar_ids = set((json.loads(raw.decode("utf-8")).get("products") or {}).keys())
    print(f"  {len(bazaar_ids)} bazaar products")

    seeds = sorted({a["id"] for a in accessories})
    seen: set[str] = set()
    queue: list[str] = list(seeds)
    recipes: dict[str, list] = {}
    names: dict[str, str] = {}

    print("[3/4] Crawling NEU recipes (closure over non-bazaar ingredients) ...")
    depth = 0
    while queue and len(seen) < MAX_ITEMS:
        depth += 1
        batch = [i for i in queue if i not in seen]
        if not batch:
            break
        queue = []
        print(f"  depth {depth}: {len(batch)} ids to fetch")
        docs = fetch_many(batch, args.refresh)
        for iid, doc in docs.items():
            seen.add(iid)
            if not doc:
                continue
            dn = strip_colors(doc.get("displayname") or "")
            if dn:
                names[iid] = dn
            rs = extract_recipes(doc)
            if not rs:
                continue
            recipes[iid] = rs
            for r in rs:
                for ing in r["in"]:
                    if ing in bazaar_ids:
                        continue
                    if ing in seen or ing in queue:
                        continue
                    queue.append(ing)

    print(f"  fetched {len(seen)} NEU files, {len(recipes)} with usable recipes")

    # Drop recipes whose ingredients reference nothing we can ever resolve.
    # (Kept in the file — the runtime decides craftability live.)
    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "NotEnoughUpdates/NotEnoughUpdates-REPO (item recipes)",
        "accessoryIds": seeds,
        "names": names,
        "recipes": recipes,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    size = os.path.getsize(OUT)
    acc_with = sum(1 for i in seeds if i in recipes)
    print("[4/4] Wrote data/accessory-recipes.json")
    print(f"  {size/1024:.0f} KiB | {acc_with}/{len(seeds)} accessories have a recipe"
          f" | {len(recipes)} recipe entries total")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

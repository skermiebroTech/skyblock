/* =========================================================================
 * Cloudflare Worker — Hypixel API CORS Proxy
 *
 * Secure server-side proxy that automatically injects your API Key.
 * Uses Cloudflare environment variables for maximum security.
 *
 * Public endpoints are additionally cached at the Cloudflare edge so that
 * concurrent visitors share a single upstream fetch per TTL window, keeping
 * our Hypixel request volume roughly flat regardless of how many people are
 * online (see EDGE_CACHE_TTL below).
 * ========================================================================= */

/* Public, identical-for-everyone endpoints we cache at the Cloudflare edge,
 * keyed by upstream pathname with the TTL in seconds. Account-specific
 * endpoints (/skyblock/profiles, /skyblock/garden) are intentionally absent
 * and are never cached. */
const EDGE_CACHE_TTL = {
  "/skyblock/bazaar":    60,   // Hypixel refreshes bazaar data ~every 60s
  "/skyblock/auctions":  120,  // heavy paginated scan; clients already tolerate 5-min-old BINs
  "/skyblock/firesales": 60,
};

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, API-Key",
      "Access-Control-Max-Age": "86400",
    };

    // 1. Handle CORS Preflight (OPTIONS request) from your browser
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/elite/contests/at/now") {
      try {
        const response = await fetch("https://api.eliteskyblock.com/contests/at/now", {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, cause: err.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // 2. Map incoming path + query strings directly to Hypixel's API v2
    const targetUrl = `https://api.hypixel.net/v2${url.pathname}${url.search}`;

    // Edge cache: the cache key is the upstream URL only (path + query), so it
    // never varies by the caller's API-Key header — every visitor shares one
    // entry. Only public, key-optional endpoints are eligible.
    const cacheTtl = EDGE_CACHE_TTL[url.pathname];
    const isCacheable = request.method === "GET" && cacheTtl !== undefined;
    const cache = caches.default;
    const cacheKey = new Request(targetUrl, { method: "GET" });

    if (isCacheable) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const hitHeaders = new Headers(cached.headers);
        hitHeaders.set("Access-Control-Allow-Origin", "*");
        hitHeaders.set("X-Edge-Cache", "HIT");
        return new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: hitHeaders,
        });
      }
    }

    // Prefer the Worker secret, but allow a browser-provided key as a fallback
    // for local testing or when the deployed Worker secret is missing/stale.
    const hypixelApiKey = env.HYPIXEL_API_KEY || request.headers.get("API-Key") || "";
    if (!hypixelApiKey) {
      return new Response(JSON.stringify({ success: false, cause: "Missing Hypixel API key. Add HYPIXEL_API_KEY to the Worker or save an API key in Hypixie settings." }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const headers = new Headers();
    headers.set("API-Key", hypixelApiKey);
    headers.set("Accept", "application/json");

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: headers,
      });

      // 3. Clone and modify response headers to allow CORS
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");

      // 4. Store successful public responses at the edge for the next visitor.
      //    Only 200s are cached; errors/429s fall through and are retried live.
      if (isCacheable && response.status === 200) {
        responseHeaders.set("Cache-Control", `public, max-age=${cacheTtl}`);
        responseHeaders.delete("Set-Cookie");
        responseHeaders.delete("Vary"); // match purely on the upstream URL
        responseHeaders.set("X-Edge-Cache", "MISS");
        const proxied = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
        ctx.waitUntil(cache.put(cacheKey, proxied.clone()));
        return proxied;
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, cause: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }
};

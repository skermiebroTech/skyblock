/* =========================================================================
 * Cloudflare Worker — Hypixel API CORS Proxy
 * 
 * Secure server-side proxy that automatically injects your API Key.
 * Uses Cloudflare environment variables for maximum security.
 * ========================================================================= */

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

    // Ensure the environment variable is configured in your Cloudflare settings
    if (!env.HYPIXEL_API_KEY) {
      return new Response(JSON.stringify({ success: false, cause: "Worker is missing the HYPIXEL_API_KEY environment variable." }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 2. Map incoming path + query strings directly to Hypixel's API v2
    const targetUrl = `https://api.hypixel.net/v2${url.pathname}${url.search}`;

    const headers = new Headers();
    // Inject the API key securely from Cloudflare's environment variables
    headers.set("API-Key", env.HYPIXEL_API_KEY);
    headers.set("Accept", "application/json");

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: headers,
      });

      // 3. Clone and modify response headers to allow CORS
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
};

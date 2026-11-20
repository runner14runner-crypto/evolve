// $EVOLVE Worker: serves the static site and a tiny read-only Solana RPC relay.
// The relay only allows the balance lookups the page needs, so the RPC key
// (set with `npx wrangler secret put SOLANA_RPC_URL`) is never exposed or abused.

const ALLOWED = new Set(["getTokenAccountsByOwner", "getParsedTokenAccountsByOwner"]);
const FALLBACK_RPC = "https://api.mainnet-beta.solana.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/rpc") {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);

      let body;
      try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
      if (!body || Array.isArray(body) || !ALLOWED.has(body.method)) {
        return json({ error: "Method not allowed" }, 403);
      }

      const upstream = await fetch(env.SOLANA_RPC_URL || FALLBACK_RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: body.method, params: body.params }),
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }

    return env.ASSETS.fetch(request);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

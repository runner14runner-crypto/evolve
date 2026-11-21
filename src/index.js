// $EVOLVE Worker
// - Serves the static site.
// - /api/config : public settings (mint, fee wallets, split).
// - /api/sync   : reads a wallet's $EVOLVE balance on-chain and updates its creature (server decides XP).
// - /api/stats  : live hatchery numbers + buyback wallet balances.
// Progress lives in one SQLite-backed Durable Object, so it follows the wallet across devices
// and can't be edited from the browser.

import { DurableObject } from "cloudflare:workers";
import { applyBalance, fresh, publicState } from "./game.js";

const FALLBACK_RPC = "https://api.mainnet-beta.solana.com";
const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SYNC_MIN_MS = 15000;     // one on-chain read per wallet per 15s at most
const STATS_TTL_MS = 60000;    // buyback wallet lookups cached for a minute

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === "/api/config") return json(config(env), 200, 300);
      if (p === "/api/sync" && request.method === "POST") return await sync(request, env);
      if (p === "/api/stats") return await stats(env);
      if (p.startsWith("/api/")) return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: "Server error", detail: String(e && e.message || e) }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};

function config(env) {
  const buy = clampPct(env.BUYBACK_PCT);
  return {
    mint: env.MINT || "",
    buybackWallet: env.BUYBACK_WALLET || "",
    infraWallet: env.INFRA_WALLET || "",
    split: { buyback: buy, infra: 100 - buy },
  };
}
const clampPct = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 70; };
const hatchery = env => env.HATCHERY.get(env.HATCHERY.idFromName("main"));

async function sync(request, env) {
  if (!env.MINT) return json({ preview: true }, 409);
  let body; try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const wallet = String(body && body.wallet || "");
  if (!ADDR_RE.test(wallet)) return json({ error: "Bad wallet address" }, 400);

  const hub = hatchery(env);
  const cached = await hub.peek(wallet);
  if (cached && Date.now() - cached.syncedAt < SYNC_MIN_MS) return json(cached.state);

  const balance = await tokenBalance(env, wallet, env.MINT);
  const state = await hub.sync(wallet, balance);
  return json(state);
}

async function stats(env) {
  const hub = hatchery(env);
  const s = await hub.stats();
  let buyback = null;
  if (env.BUYBACK_WALLET) {
    buyback = await hub.cachedBuyback(STATS_TTL_MS);
    if (!buyback) {
      try {
        const [lamports, tokens] = await Promise.all([
          rpc(env, "getBalance", [env.BUYBACK_WALLET]).then(r => r.value),
          env.MINT ? tokenBalance(env, env.BUYBACK_WALLET, env.MINT) : 0,
        ]);
        buyback = { sol: lamports / 1e9, tokens, at: Date.now() };
        await hub.storeBuyback(buyback);
      } catch { buyback = null; }
    }
  }
  return json({ live: !!env.MINT, ...s, buyback }, 200, 30);
}

async function rpc(env, method, params) {
  const r = await fetch(env.SOLANA_RPC_URL || FALLBACK_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!r.ok) throw new Error("RPC HTTP " + r.status);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}

async function tokenBalance(env, owner, mint) {
  // Local testing hook: TEST_BALANCES='{"wallet":123}' in .dev.vars. Never set in production.
  if (env.TEST_BALANCES) {
    const t = JSON.parse(env.TEST_BALANCES);
    if (owner in t) return Number(t[owner]);
  }
  const res = await rpc(env, "getParsedTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
  return (res.value || []).reduce((sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount || 0), 0);
}

function json(obj, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });
}

export class Hatchery extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS wallets(
      addr TEXT PRIMARY KEY, data TEXT NOT NULL, tier TEXT, form TEXT,
      hatched INTEGER DEFAULT 0, synced_at INTEGER DEFAULT 0)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)`);
  }

  load(addr) {
    const row = this.sql.exec("SELECT data, synced_at FROM wallets WHERE addr = ?", addr).toArray()[0];
    return row ? { state: JSON.parse(row.data), syncedAt: row.synced_at } : null;
  }

  peek(addr) {
    const r = this.load(addr);
    return r ? { state: publicState(r.state), syncedAt: r.syncedAt } : null;
  }

  sync(addr, balance) {
    const r = this.load(addr);
    const st = r ? r.state : fresh(addr);
    applyBalance(st, balance, Date.now());
    this.sql.exec(
      `INSERT INTO wallets(addr, data, tier, form, hatched, synced_at) VALUES(?,?,?,?,?,?)
       ON CONFLICT(addr) DO UPDATE SET data=excluded.data, tier=excluded.tier, form=excluded.form,
       hatched=excluded.hatched, synced_at=excluded.synced_at`,
      addr, JSON.stringify(st), st.tier || null, st.form || null, st.hatched ? 1 : 0, Date.now()
    );
    return publicState(st);
  }

  stats() {
    const one = q => this.sql.exec(q).toArray()[0];
    const hatched = one("SELECT COUNT(*) AS n FROM wallets WHERE hatched = 1").n;
    const tiers = {}; for (const r of this.sql.exec("SELECT tier, COUNT(*) AS n FROM wallets WHERE hatched = 1 AND tier IS NOT NULL GROUP BY tier")) tiers[r.tier] = r.n;
    const forms = {}; for (const r of this.sql.exec("SELECT form, COUNT(*) AS n FROM wallets WHERE form IS NOT NULL GROUP BY form")) forms[r.form] = r.n;
    const finals = Object.values(forms).reduce((a, b) => a + b, 0);
    return { hatched, tiers, forms, finals };
  }

  cachedBuyback(ttl) {
    const r = this.sql.exec("SELECT v FROM kv WHERE k = 'buyback'").toArray()[0];
    if (!r) return null;
    const v = JSON.parse(r.v);
    return Date.now() - v.at < ttl ? v : null;
  }

  storeBuyback(v) {
    this.sql.exec("INSERT INTO kv(k, v) VALUES('buyback', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", JSON.stringify(v));
  }
}

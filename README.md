# $EVOLVE — Your Meme Evolves

Parody meme coin site. Holders connect a Solana wallet (read-only), and their $EVOLVE balance hatches a creature:
- **Egg tier by balance:** Pink (any), Silver (1M+), Gold (5M+), Diamond (10M+). Higher tiers get an XP multiplier and better Level 5 odds.
- **XP from real activity:** XP every minute held, a bonus when the balance goes up, a penalty when it goes down.
- **Stages:** Egg, Goblin, Degenerate, Whale, then a weighted roll for one of six Level 5 chase forms.

The site never asks for a signature or transaction. Progress is stored in the visitor's browser.

## Going live

1. **Set the config** in `wrangler.jsonc` under `vars`: `MINT` (the pump.fun mint), `BUYBACK_WALLET`, `INFRA_WALLET`, and `BUYBACK_PCT` (default 70). Push. Empty `MINT` keeps the site in preview mode.
2. **Add an RPC key.** Get a free Helius key, then in Cloudflare: Worker → Settings → Variables and Secrets → secret `SOLANA_RPC_URL` = `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`. The public RPC is rate-limited.
3. **pump.fun fees:** choose Creator Fees (not Cashback) at creation, then set fee sharing to the two wallets above. pump.fun allows one post-launch change, then locks it.

## How live mode works
- `/api/sync` reads a wallet's balance on-chain and updates its creature in a SQLite Durable Object (`Hatchery`). XP is decided server-side, so progress follows the wallet across devices and can't be edited in the browser.
- `/api/stats` returns creatures hatched, tier counts, final forms pulled and the buyback wallet's SOL / $EVOLVE balance.
- Game rules live in `src/game.js`; keep them in step with the lists in `public/index.html`.

## Deploy

**Cloudflare dashboard (no terminal needed)**
1. Workers & Pages → Create → Import a repository → pick this repo.
2. Leave the build command empty; deploy command `npx wrangler deploy` (default).
3. Every push to `main` redeploys automatically.

**CLI:** `npx wrangler login` then `npx wrangler deploy`

## Files
- `public/index.html` — the site (HTML, CSS, JS)
- `public/img/` — creature and egg figures (generated with Higgsfield)
- `public/fonts/` — Bagel Fat One and Instrument Sans (SIL Open Font License)
- `src/index.js` — Worker: site, `/api/config`, `/api/sync`, `/api/stats`, and the Hatchery Durable Object
- `src/game.js` — XP, tiers and Level 5 roll
- `wrangler.jsonc` — Worker config

# $EVOLVE — Your Meme Evolves

Parody meme coin site. Holders connect a Solana wallet (read-only), and their $EVOLVE balance hatches a creature:
- **Egg tier by balance:** Pink (any), Silver (1M+), Gold (5M+), Diamond (10M+). Higher tiers get an XP multiplier and better Level 5 odds.
- **XP from real activity:** XP every minute held, a bonus when the balance goes up, a penalty when it goes down.
- **Stages:** Egg, Goblin, Degenerate, Whale, then a weighted roll for one of six Level 5 chase forms.

The site never asks for a signature or transaction. Progress is stored in the visitor's browser.

## Going live

1. **Set the mint.** In `public/index.html`, find `const MINT = "";` and paste the pump.fun mint address. While it's empty the site runs in preview mode (demo wallet + fake buy/sell buttons).
2. **(Recommended) Add an RPC key.** The public Solana RPC is rate-limited. Get a free key from Helius (or similar), then in Cloudflare: Worker → Settings → Variables and Secrets → add secret `SOLANA_RPC_URL` = `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`. The Worker at `/api/rpc` uses it and only allows balance lookups.

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
- `src/index.js` — Worker: serves the site and the read-only `/api/rpc` relay
- `wrangler.jsonc` — Worker config

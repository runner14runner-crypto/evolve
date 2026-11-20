# $EVOLVE — Your Meme Evolves

Parody meme coin site. Everyone hatches the same pink egg; simulated wallet activity decides how it evolves: Egg, Goblin, Degenerate, Whale, then a weighted roll for one of six Level 5 "chase" forms.

Static site served by Cloudflare Workers (static assets). No real wallet connection; progress is stored in the visitor's browser.

## Deploy

**Cloudflare dashboard (no terminal needed)**
1. Workers & Pages → Create → Import a repository.
2. Pick this repo. Leave the build command empty; deploy command `npx wrangler deploy` (default).
3. Every push to `main` redeploys automatically.

**CLI:** `npx wrangler login` then `npx wrangler deploy`

## Files
- `public/index.html` — the whole site (HTML, CSS, JS)
- `public/img/` — creature figures (generated with Higgsfield)
- `public/fonts/` — Bagel Fat One and Instrument Sans (SIL Open Font License)
- `wrangler.jsonc` — Worker config pointing at `public/`

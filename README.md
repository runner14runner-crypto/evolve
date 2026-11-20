# $EVOLVE — Your Meme Evolves

Parody meme coin site. Everyone starts with the same egg; simulated wallet activity decides how it evolves (Egg → Goblin → Degenerate → Whale → rare Level 5 form).

Static site served by Cloudflare Workers (static assets). No real wallet connection; progress is stored in the visitor's browser.

## Deploy

**Option A: Cloudflare dashboard (no terminal needed)**
1. Cloudflare dashboard → Workers & Pages → Create → Import a repository.
2. Pick `runner14runner-crypto/evolve`. Deploy command: `npx wrangler deploy` (default). No build command.
3. Every push to `main` redeploys automatically.

**Option B: CLI**
```
npx wrangler login
npx wrangler deploy
```

## Files
- `public/index.html` — the whole site (HTML, CSS, JS in one file)
- `wrangler.jsonc` — Worker config pointing at `public/`

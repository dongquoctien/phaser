# Explorer Oreo — Leaderboard backend (Cloudflare Worker)

A tiny, **free-tier-friendly** backend for the game's anonymous high-score
leaderboard. It is **not** part of the game build — deploy it separately, then
point the game at it. If you never deploy it, the game still runs fine (it just
shows your local best and hides the online board).

> Security model: the game runs 100% in the browser, so **nothing the client sends
> is trusted**. The Worker holds the only secret and is the only place a score is
> validated (sanity checks + a signed, single-use session token). This stops casual
> cheating (editing localStorage / numbers / replaying a payload). It does **not**
> stop a determined bot replaying plausible runs — that needs a server-authoritative
> re-simulation, out of scope.

## Deploy (≈5 minutes)

```bash
cd games/cave-collector/server
npm i -g wrangler                       # or use: npx wrangler ...

# 1. create the KV namespace, then paste its id into wrangler.toml ([[kv_namespaces]])
npx wrangler kv namespace create LB

# 2. set the signing secret (a long random string — only the Worker ever sees it)
npx wrangler secret put LEADERBOARD_SECRET

# 3. (prod) set ALLOW_ORIGIN in wrangler.toml to your game's static origin
# 4. deploy
npx wrangler deploy
```

You'll get a URL like `https://explorer-oreo-leaderboard.<you>.workers.dev`.

## Point the game at it

Build the game with `VITE_API_URL` set (and an optional `BUILD_ID`):

```bash
VITE_API_URL="https://explorer-oreo-leaderboard.<you>.workers.dev" \
BUILD_ID="$(git rev-parse --short HEAD)" \
npm run build:cave-collector
```

If `VITE_API_URL` is empty the game just uses localStorage — no network, no errors.

## API

### `POST /session`
Open a play session. Returns a signed, single-use token.
```jsonc
// req
{ "playerId": "<uuid>", "buildId": "abc123" }
// res
{ "sessionToken": "<base64url>.<hmac>" }
```

### `POST /score`
Submit a finished run. Verifies the token, runs sanity checks, stores the player's
best score.
```jsonc
// req
{ "sessionToken": "...", "playerId": "<uuid>", "nickname": "OreoKing",
  "score": 1250, "stars": 8, "levels": 2, "outcome": "win",
  "startedAt": 1700000000000, "endedAt": 1700000090000, "buildId": "abc123" }
// res
{ "ok": true, "rank": 7 }            // or 422 { "error": "rejected", "reasons": [...] }
```

### `GET /leaderboard`
```jsonc
{ "entries": [ { "nickname": "OreoKing", "score": 1800, "stars": 12, "at": 170000.. }, ... ] }
```

## Sanity rules (edit in `worker.js`)
- `score ∈ [0, 100000]`, `stars ∈ [0, 200]`
- `elapsed ≥ 1s`, `stars × 100 ≤ score` (a star is worth 100)
- `outcome ∈ {win, gameover}`
- token: valid signature, ≤ 3h old, **single-use** (replayed token → 409), identity match

## Cost
Workers + KV free tier covers a hobby game comfortably (100k req/day). Each run is
1 `/session` + 1 `/score`; leaderboard views are cheap reads.

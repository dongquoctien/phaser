# TWDC Defense — Leaderboard backend (Cloudflare Worker)

A tiny, **free-tier-friendly** backend for the game's anonymous leaderboard. It is
**not** part of the game build — deploy it separately, then point the game at it.

> Security model: the game runs 100% in the player's browser, so **nothing the
> client sends is trusted**. The Worker holds the only secret and is the only place
> a score is validated (sanity checks + a signed, single-use session token). This
> stops casual cheating (editing localStorage / numbers / replaying a payload). It
> does **not** stop a determined bot that replays plausible timings — that would
> need a server-authoritative re-simulation, which is out of scope.

## Deploy (≈5 minutes)

```bash
cd games/twdc-defense/server
npm i -g wrangler            # or: npx wrangler ...

# 1. create the KV namespace, then paste its id into wrangler.toml ([[kv_namespaces]])
npx wrangler kv namespace create LB

# 2. set the signing secret (a long random string — only the Worker ever sees it)
npx wrangler secret put LEADERBOARD_SECRET

# 3. (prod) set ALLOW_ORIGIN in wrangler.toml to your game's static origin
# 4. deploy
npx wrangler deploy
```

You'll get a URL like `https://twdc-leaderboard.<you>.workers.dev`.

## Point the game at it

Build the game with `VITE_API_URL` set (and an optional `BUILD_ID`):

```bash
VITE_API_URL="https://twdc-leaderboard.<you>.workers.dev" \
BUILD_ID="$(git rev-parse --short HEAD)" \
npm run build:twdc-defense
```

If `VITE_API_URL` is empty the game just uses localStorage — no network, no errors.

## API

### `POST /session`
Open a play session. Returns a signed, single-use token.

```jsonc
// req
{ "playerId": "<uuid>", "mapId": 0, "buildId": "abc123" }
// res
{ "sessionToken": "<base64url>.<hmac>" }
```

### `POST /score`
Submit a finished run. Verifies the token, runs sanity checks, stores the player's
best wave for that map.

```jsonc
// req
{ "sessionToken": "...", "playerId": "<uuid>", "nickname": "OreoKing",
  "mapId": 0, "wave": 14, "outcome": "win",
  "startedAt": 1700000000000, "endedAt": 1700000300000,
  "heroesPlaced": 9, "kills": 180, "goldEarned": 4200, "buildId": "abc123" }
// res
{ "ok": true, "rank": 7 }            // or 422 { "error": "rejected", "reasons": [...] }
```

### `GET /leaderboard?mapId=0`
```jsonc
{ "entries": [ { "nickname": "OreoKing", "wave": 18, "at": 1700000000000 }, ... ] }
```

## Sanity rules (edit in `worker.js`)
- `wave ∈ [1, 20]`
- `elapsed ≥ wave × 6s` (can't clear faster than this)
- `heroesPlaced ≥ 1`
- `kills ≥ wave`
- `outcome ∈ {win, overrun}`
- token: valid signature, ≤ 30 min old, **single-use** (replayed token → 409)
- identity + map must match the token's claims

## Cost
Workers + KV free tier covers a hobby game comfortably (100k req/day). Each run is
1 `/session` + 1 `/score`; leaderboard views are cached-friendly reads.

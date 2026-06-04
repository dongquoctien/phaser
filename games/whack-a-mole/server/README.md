# Whack-a-Char — Leaderboard backend (Cloudflare Worker)

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
cd games/whack-a-mole/server
npm i -g wrangler            # or: npx wrangler ...

# 1. create the KV namespace, then paste its id into wrangler.toml ([[kv_namespaces]])
npx wrangler kv namespace create LB

# 2. set the signing secret (a long random string — only the Worker ever sees it)
npx wrangler secret put LEADERBOARD_SECRET

# 3. (prod) set ALLOW_ORIGIN in wrangler.toml to your game's static origin
# 4. deploy
npx wrangler deploy
```

You'll get a URL like `https://wam-leaderboard.<you>.workers.dev`.

## Point the game at it

Build the game with `VITE_API_URL` set (and an optional `BUILD_ID`):

```bash
VITE_API_URL="https://wam-leaderboard.<you>.workers.dev" \
BUILD_ID="$(git rev-parse --short HEAD)" \
npm run build:whack-a-mole
```

For local dev, put the URL in `games/whack-a-mole/.env` (see `.env.example`). If
`VITE_API_URL` is empty the game just uses localStorage — no network, no errors.

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
  "score": 1240, "startedAt": 1700000000000, "endedAt": 1700000060000,
  "whacks": 38, "bestCombo": 14, "friendlyHits": 1, "buildId": "abc123" }
// res
{ "ok": true, "rank": 7 }            // or 422 { "error": "rejected", "reasons": [...] }
```

### `GET /leaderboard`
```jsonc
{ "entries": [ { "nickname": "OreoKing", "score": 1820, "at": 1700000000000 }, ... ] }
```

## Sanity rules (edit in `worker.js`)
- `score ∈ [0, 20000]`
- `duration ∈ [45s, 120s]` (the round is a fixed 60s; allow clock jitter / backgrounded tabs)
- `whacks ≥ 0`, `friendlyHits ≥ 0`
- `score ≤ whacks × 90` (a score can't exceed the most points the reported whacks could yield — boss×30 at the top x3 combo)
- token: valid signature, ≤ 30 min old, **single-use** (replayed token → 409)
- identity must match the token's claims

## Cost
Workers + KV free tier covers a hobby game comfortably (100k req/day). Each run is
1 `/session` + 1 `/score`; leaderboard views are cheap reads.

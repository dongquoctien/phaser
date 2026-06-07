// TWDC Defense — leaderboard backend (Cloudflare Worker reference implementation).
//
// This is NOT part of the game build — it deploys separately (see README.md). It
// owns the only SECRET in the system (LEADERBOARD_SECRET, a Worker env var) and is
// the ONLY place a score is trusted, because the client can be tampered with.
//
// Endpoints:
//   POST /session     { playerId, mapId, buildId }      → { sessionToken }
//   POST /score       { sessionToken, playerId, nickname, mapId, wave, outcome,
//                       startedAt, endedAt, heroesPlaced, kills, goldEarned, buildId }
//                                                        → { ok, rank }
//   GET  /leaderboard?mapId=N                            → { entries: [{nickname,
//                       wave, durationMs, at, champion}, ...] }  (sorted wave desc,
//                       then fastest durationMs, then earliest)
//
// Anti-cheat = SERVER-SIDE sanity checks + a signed, single-use session token. It
// stops casual tampering (editing localStorage / numbers / replaying a payload); it
// does NOT stop a determined bot that replays plausible timings — that needs a
// server-authoritative simulation, out of scope for a fun leaderboard.
//
// Storage: Workers KV (binding `LB`). Keys:
//   nonce:<jti>            → '1'   (marks a session token as spent; TTL = token life)
//   best:<mapId>:<player>  → JSON  { nickname, wave, durationMs, at } — a player's best
//                                    run (highest wave; ties = fastest finish)
//   champ:<player>         → '1'   (cleared all 3 maps)
//   The leaderboard is derived by listing best:<mapId>:* and sorting.

const TOKEN_TTL_MS = 3 * 60 * 60 * 1000; // a session token is valid for 3 hours — a
                                         // single run (placing heroes, 20 waves with
                                         // countdowns) can take well over 30 min, and an
                                         // expired token silently dropped the score.
                                         // Anti-cheat stays: single-use jti + sanity checks.
const MAX_WAVE = 20;                   // the game has 20 waves
const MIN_SEC_PER_WAVE = 6;            // a run can't clear faster than this per wave
const TOP_N = 50;

// ── tiny crypto helpers (HMAC-SHA256 via WebCrypto) ──────────────────────────────
const enc = new TextEncoder();
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
// token = base64url(payloadJson) + '.' + hmac(secret, payloadJson)
async function signToken(secret, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, body)}`;
}
async function verifyToken(secret, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if ((await hmac(secret, body)) !== sig) return null; // bad signature
  try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))); }
  catch { return null; }
}

// ── CORS (allow the game's static origin; tighten ALLOW_ORIGIN in prod) ───────────
function cors(env) {
  return {
    'access-control-allow-origin': env.ALLOW_ORIGIN || '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(data, env, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...cors(env) } });
}

function cleanNick(n) {
  return String(n ?? '').replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 12) || 'Player';
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env) });
    const secret = env.LEADERBOARD_SECRET;
    if (!secret) return json({ error: 'server misconfigured' }, env, 500);

    // ── POST /session : hand out a signed, single-use token ──
    if (url.pathname === '/session' && request.method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const mapId = b.mapId | 0;
      const jti = crypto.randomUUID();
      const token = await signToken(secret, {
        playerId: String(b.playerId || ''), mapId, jti, iat: Date.now(),
      });
      return json({ sessionToken: token }, env);
    }

    // ── POST /score : verify + sanity-check + store best ──
    if (url.pathname === '/score' && request.method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const claims = await verifyToken(secret, b.sessionToken);
      if (!claims) return json({ error: 'bad token' }, env, 401);
      if (Date.now() - claims.iat > TOKEN_TTL_MS) return json({ error: 'token expired' }, env, 401);
      if (claims.playerId !== String(b.playerId)) return json({ error: 'identity mismatch' }, env, 401);
      if (claims.mapId !== (b.mapId | 0)) return json({ error: 'map mismatch' }, env, 400);

      // single-use: reject a replayed token (jti already spent)
      if (await env.LB.get(`nonce:${claims.jti}`)) return json({ error: 'token reused' }, env, 409);

      // ── sanity checks: the heart of the anti-cheat ──
      const wave = b.wave | 0, mapId = b.mapId | 0;
      const elapsedSec = (Number(b.endedAt) - Number(b.startedAt)) / 1000;
      const reasons = [];
      if (wave < 1 || wave > MAX_WAVE) reasons.push('wave out of range');
      if (!(elapsedSec >= wave * MIN_SEC_PER_WAVE)) reasons.push('too fast');
      if ((b.heroesPlaced | 0) < 1) reasons.push('no heroes placed');
      if ((b.kills | 0) < wave) reasons.push('too few kills'); // ≥1 kill/wave minimum
      if (!['win', 'overrun'].includes(b.outcome)) reasons.push('bad outcome');
      if (reasons.length) return json({ error: 'rejected', reasons }, env, 422);

      // accept: mark token spent, then keep the player's BEST run for this map.
      await env.LB.put(`nonce:${claims.jti}`, '1', { expirationTtl: Math.ceil(TOKEN_TTL_MS / 1000) });
      const nickname = cleanNick(b.nickname);
      const durationMs = Math.max(0, Math.round(Number(b.endedAt) - Number(b.startedAt)));
      const key = `best:${mapId}:${claims.playerId}`;
      const prev = await env.LB.get(key, 'json');
      // "better" = higher wave, OR same wave finished FASTER (smaller durationMs). A
      // legacy entry with no durationMs counts as slowest, so any timed run beats it.
      const isBetter = !prev || wave > prev.wave ||
        (wave === prev.wave && durationMs < (prev.durationMs ?? Infinity));
      if (isBetter) {
        await env.LB.put(key, JSON.stringify({ nickname, wave, durationMs, at: Date.now() }));
      } else if (prev.nickname !== nickname) {
        await env.LB.put(key, JSON.stringify({ ...prev, nickname })); // keep best run, update name
      }

      // CHAMPION: winning the LAST map (id 2 / Hard) means all three were cleared
      // (Easy + Normal must be cleared to unlock Hard). Mark the player a champion
      // permanently — surfaced as a crown beside their name on every leaderboard tab.
      if (mapId === 2 && b.outcome === 'win') {
        await env.LB.put(`champ:${claims.playerId}`, '1');
      }

      const board = await topFor(env, mapId);
      const rank = board.findIndex((e) => e.playerId === claims.playerId) + 1;
      return json({ ok: true, rank: rank || null }, env);
    }

    // ── GET /leaderboard?mapId=N ──
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      const mapId = (url.searchParams.get('mapId') || '0') | 0;
      const board = (await topFor(env, mapId)).map(({ nickname, wave, durationMs, at, champion }) => ({ nickname, wave, durationMs, at, champion }));
      return json({ entries: board }, env);
    }

    return json({ error: 'not found' }, env, 404);
  },
};

// List every best:<mapId>:* entry, sort by wave desc, return TOP_N (with playerId +
// a `champion` flag). We list the `champ:` prefix ONCE into a Set rather than reading
// a champ key per row, so it stays two list calls regardless of board size.
async function topFor(env, mapId) {
  const prefix = `best:${mapId}:`;
  const [list, champList] = await Promise.all([
    env.LB.list({ prefix }),
    env.LB.list({ prefix: 'champ:' }),
  ]);
  const champs = new Set(champList.keys.map((k) => k.name.slice('champ:'.length)));
  const rows = await Promise.all(list.keys.map(async (k) => {
    const v = await env.LB.get(k.name, 'json');
    const playerId = k.name.slice(prefix.length);
    return v && { playerId, champion: champs.has(playerId), ...v };
  }));
  // rank: higher wave first; ties broken by FASTER finish (smaller durationMs); then
  // by earliest achieved. Legacy rows without durationMs sort last within their wave.
  const dur = (e) => (e.durationMs == null ? Infinity : e.durationMs);
  return rows.filter(Boolean)
    .sort((a, b) => b.wave - a.wave || dur(a) - dur(b) || a.at - b.at)
    .slice(0, TOP_N);
}

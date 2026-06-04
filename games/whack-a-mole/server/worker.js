// Whack-a-Char — leaderboard backend (Cloudflare Worker reference implementation).
//
// This is NOT part of the game build — it deploys separately (see README.md). It
// owns the only SECRET in the system (LEADERBOARD_SECRET, a Worker env var) and is
// the ONLY place a score is trusted, because the client can be tampered with.
//
// Endpoints:
//   POST /session     { playerId, buildId }              → { sessionToken }
//   POST /score       { sessionToken, playerId, nickname, score, startedAt, endedAt,
//                       whacks, bestCombo, friendlyHits, buildId } → { ok, rank }
//   GET  /leaderboard                                    → { entries: [...] }
//
// Anti-cheat = SERVER-SIDE sanity checks + a signed, single-use session token. It
// stops casual tampering (editing localStorage / numbers / replaying a payload); it
// does NOT stop a determined bot that replays plausible timings — that needs a
// server-authoritative simulation, out of scope for a fun leaderboard.
//
// Storage: Workers KV (binding `LB`). Keys:
//   nonce:<jti>       → '1'   (marks a session token as spent; TTL = token life)
//   best:<player>     → JSON  (a player's best run)
//   The leaderboard is derived by listing best:* and sorting by score desc.

const TOKEN_TTL_MS = 30 * 60 * 1000;   // a session token is valid for 30 minutes
const ROUND_SECONDS = 60;              // the game's fixed round length
const MIN_DURATION = 45;               // a real round can't be much shorter (clock jitter)
const MAX_DURATION = 120;              // …nor much longer (tab backgrounded, etc.)
const MAX_PTS_PER_WHACK = 90;          // boss (30) at the top x3 combo multiplier
const ABS_MAX_SCORE = 20000;           // hard ceiling — well above any honest run
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
      const jti = crypto.randomUUID();
      const token = await signToken(secret, {
        playerId: String(b.playerId || ''), jti, iat: Date.now(),
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

      // single-use: reject a replayed token (jti already spent)
      if (await env.LB.get(`nonce:${claims.jti}`)) return json({ error: 'token reused' }, env, 409);

      // ── sanity checks: the heart of the anti-cheat ──
      const score = b.score | 0;
      const whacks = b.whacks | 0;
      const friendlyHits = b.friendlyHits | 0;
      const durationSec = (Number(b.endedAt) - Number(b.startedAt)) / 1000;
      const reasons = [];
      if (score < 0 || score > ABS_MAX_SCORE) reasons.push('score out of range');
      if (!(durationSec >= MIN_DURATION && durationSec <= MAX_DURATION)) reasons.push('bad duration');
      if (whacks < 0) reasons.push('bad whacks');
      if (friendlyHits < 0) reasons.push('bad friendlyHits');
      // a score can't exceed the most points the reported whacks could possibly yield
      if (score > whacks * MAX_PTS_PER_WHACK) reasons.push('score exceeds whacks');
      if (reasons.length) return json({ error: 'rejected', reasons }, env, 422);

      // accept: mark token spent, then keep the player's BEST score
      await env.LB.put(`nonce:${claims.jti}`, '1', { expirationTtl: Math.ceil(TOKEN_TTL_MS / 1000) });
      const nickname = cleanNick(b.nickname);
      const key = `best:${claims.playerId}`;
      const prev = await env.LB.get(key, 'json');
      if (!prev || score > prev.score) {
        await env.LB.put(key, JSON.stringify({ nickname, score, at: Date.now() }));
      } else if (prev.nickname !== nickname) {
        await env.LB.put(key, JSON.stringify({ ...prev, nickname })); // keep best score, update name
      }

      const board = await topAll(env);
      const rank = board.findIndex((e) => e.playerId === claims.playerId) + 1;
      return json({ ok: true, rank: rank || null }, env);
    }

    // ── GET /leaderboard ──
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      const board = (await topAll(env)).map(({ nickname, score, at }) => ({ nickname, score, at }));
      return json({ entries: board }, env);
    }

    return json({ error: 'not found' }, env, 404);
  },
};

// List every best:* entry, sort by score desc (then earliest), return TOP_N (with playerId).
async function topAll(env) {
  const prefix = 'best:';
  const list = await env.LB.list({ prefix });
  const rows = await Promise.all(list.keys.map(async (k) => {
    const v = await env.LB.get(k.name, 'json');
    return v && { playerId: k.name.slice(prefix.length), ...v };
  }));
  return rows.filter(Boolean).sort((a, b) => b.score - a.score || a.at - b.at).slice(0, TOP_N);
}

// Explorer Oreo — leaderboard backend (Cloudflare Worker reference implementation).
//
// NOT part of the game build — it deploys separately (see README.md). It owns the
// only SECRET (LEADERBOARD_SECRET, a Worker env var) and is the ONLY place a score
// is trusted, because the browser client can be tampered with.
//
// Endpoints:
//   POST /session     { playerId, buildId }              → { sessionToken }
//   POST /score       { sessionToken, playerId, nickname, score, stars, levels,
//                       outcome, startedAt, endedAt, buildId } → { ok, rank }
//   GET  /leaderboard                                     → { entries: [{nickname,
//                       score, stars, at}, ...] }  (sorted score desc, then earliest)
//
// Anti-cheat = SERVER-SIDE sanity checks + a signed, single-use session token. It
// stops casual tampering (editing localStorage / numbers / replaying a payload); it
// does NOT stop a determined bot replaying plausible runs — that needs a server-
// authoritative simulation, out of scope for a fun hobby leaderboard.
//
// Storage: Workers KV (binding `LB`). Keys:
//   nonce:<jti>        → '1'   (marks a session token spent; TTL = token life)
//   best:<player>      → JSON  { nickname, score, stars, at } — the player's best run
//   The leaderboard is derived by listing best:* and sorting by score.

const TOKEN_TTL_MS = 3 * 60 * 60 * 1000; // a session token is valid for 3 hours
const MAX_SCORE = 100000;                // generous ceiling; a full clear is a few k
const MAX_STARS = 200;
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
async function signToken(secret, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, body)}`;
}
async function verifyToken(secret, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if ((await hmac(secret, body)) !== sig) return null;
  try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))); }
  catch { return null; }
}

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
      const token = await signToken(secret, { playerId: String(b.playerId || ''), jti, iat: Date.now() });
      return json({ sessionToken: token }, env);
    }

    // ── POST /score : verify + sanity-check + store best ──
    if (url.pathname === '/score' && request.method === 'POST') {
      const b = await request.json().catch(() => ({}));
      const claims = await verifyToken(secret, b.sessionToken);
      if (!claims) return json({ error: 'bad token' }, env, 401);
      if (Date.now() - claims.iat > TOKEN_TTL_MS) return json({ error: 'token expired' }, env, 401);
      if (claims.playerId !== String(b.playerId)) return json({ error: 'identity mismatch' }, env, 401);
      if (await env.LB.get(`nonce:${claims.jti}`)) return json({ error: 'token reused' }, env, 409);

      // ── sanity checks ──
      const score = b.score | 0, stars = b.stars | 0, levels = b.levels | 0;
      const elapsedSec = (Number(b.endedAt) - Number(b.startedAt)) / 1000;
      const reasons = [];
      if (score < 0 || score > MAX_SCORE) reasons.push('score out of range');
      if (stars < 0 || stars > MAX_STARS) reasons.push('stars out of range');
      if (!(elapsedSec >= 1)) reasons.push('too fast'); // a real run takes seconds+
      if (!['win', 'gameover'].includes(b.outcome)) reasons.push('bad outcome');
      // each star is worth 100; collected stars can't exceed the score
      if (stars * 100 > score + 1) reasons.push('stars vs score mismatch');
      if (reasons.length) return json({ error: 'rejected', reasons }, env, 422);

      // accept: mark token spent, keep the player's BEST (highest score) run.
      await env.LB.put(`nonce:${claims.jti}`, '1', { expirationTtl: Math.ceil(TOKEN_TTL_MS / 1000) });
      const nickname = cleanNick(b.nickname);
      const key = `best:${claims.playerId}`;
      const prev = await env.LB.get(key, 'json');
      const isBetter = !prev || score > prev.score;
      if (isBetter) {
        await env.LB.put(key, JSON.stringify({ nickname, score, stars, levels, at: Date.now() }));
      } else if (prev.nickname !== nickname) {
        await env.LB.put(key, JSON.stringify({ ...prev, nickname })); // keep best, refresh name
      }

      const board = await top(env);
      const rank = board.findIndex((e) => e.playerId === claims.playerId) + 1;
      return json({ ok: true, rank: rank || null }, env);
    }

    // ── GET /leaderboard ──
    if (url.pathname === '/leaderboard' && request.method === 'GET') {
      const board = (await top(env)).map(({ nickname, score, stars, levels, at }) => ({ nickname, score, stars, levels, at }));
      return json({ entries: board }, env);
    }

    return json({ error: 'not found' }, env, 404);
  },
};

// List every best:* entry, sort by score desc (ties: earliest), return TOP_N.
async function top(env) {
  const prefix = 'best:';
  const list = await env.LB.list({ prefix });
  const rows = await Promise.all(list.keys.map(async (k) => {
    const v = await env.LB.get(k.name, 'json');
    return v && { playerId: k.name.slice(prefix.length), ...v };
  }));
  return rows.filter(Boolean)
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, TOP_N);
}

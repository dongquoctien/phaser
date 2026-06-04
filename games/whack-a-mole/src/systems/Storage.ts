// Local persistence for Whack-a-Char.
//
// Owns the player's ANONYMOUS identity — a guest UUID generated once and stored
// locally (no login, no PII) plus a chosen nickname for the leaderboard — and the
// local best score. Everything is wrapped in try/catch so a private-mode / disabled-
// storage browser degrades gracefully to in-memory and never throws.

const PREFIX = 'wam.';
const K = {
  playerId: PREFIX + 'playerId',
  nickname: PREFIX + 'nickname',
  best: PREFIX + 'best',
} as const;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch { /* storage disabled — ignore */ }
}

// RFC4122-ish v4 UUID. Uses crypto.randomUUID when available, else a Math.random
// fallback (identity only — not security-sensitive).
function makeUuid(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch { /* fall through */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const Storage = {
  // ── player identity (anonymous) ──────────────────────────────────────────────
  /** The stable anonymous guest id; generated + persisted on first call. */
  getPlayerId(): string {
    let id = safeGet(K.playerId);
    if (!id) { id = makeUuid(); safeSet(K.playerId, id); }
    return id;
  },

  /** True if the player has chosen a nickname yet (drives the first-run prompt). */
  hasNickname(): boolean {
    return !!safeGet(K.nickname);
  },

  /** Display name; falls back to "Player####" (last 4 of the id) if unset. */
  getNickname(): string {
    const n = safeGet(K.nickname);
    if (n) return n;
    const id = this.getPlayerId().replace(/-/g, '');
    return 'Player' + id.slice(-4).toUpperCase();
  },

  /** Set the display name. Trimmed + clamped to 12 chars; empty is ignored. */
  setNickname(name: string): void {
    const clean = name.trim().slice(0, 12);
    if (clean) safeSet(K.nickname, clean);
  },

  // ── progress ──────────────────────────────────────────────────────────────────
  getBest(): number {
    return parseInt(safeGet(K.best) ?? '0', 10) || 0;
  },
  /** Record a best score; only writes if it beats the stored value. Returns the best. */
  setBest(score: number): number {
    const prev = this.getBest();
    if (score > prev) { safeSet(K.best, String(score)); return score; }
    return prev;
  },
};

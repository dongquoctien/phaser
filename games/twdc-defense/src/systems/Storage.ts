// Local persistence for TWDC Defense.
//
// The game previously kept all progress in the Phaser registry (RAM), which is
// wiped on every page reload. This module mirrors that progress to localStorage so
// best-wave / cleared-map / player identity survive a refresh — with zero server
// dependency. It also owns the player's ANONYMOUS identity: a guest UUID generated
// once and stored locally (no login, no PII), plus a chosen nickname for the
// leaderboard. The (optional) API layer reads playerId/nickname from here.
//
// Everything is wrapped in try/catch so a private-mode / disabled-storage browser
// degrades to in-memory (registry) only, never throws.

const PREFIX = 'twdc.';
const K = {
  playerId: PREFIX + 'playerId',
  nickname: PREFIX + 'nickname',
  best: (map: number) => `${PREFIX}map${map}.best`,
  cleared: (map: number) => `${PREFIX}map${map}.cleared`,
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
  getBest(map: number): number {
    return parseInt(safeGet(K.best(map)) ?? '0', 10) || 0;
  },
  /** Record a best wave; only writes if it beats the stored value. Returns the best. */
  setBest(map: number, wave: number): number {
    const prev = this.getBest(map);
    if (wave > prev) { safeSet(K.best(map), String(wave)); return wave; }
    return prev;
  },

  isCleared(map: number): boolean {
    return safeGet(K.cleared(map)) === '1';
  },
  setCleared(map: number): void {
    safeSet(K.cleared(map), '1');
  },
};

// Local persistence for Explorer Oreo — anonymous player identity (a guest UUID,
// no login / no PII), a chosen leaderboard nickname, and the local best score.
// Everything is wrapped in try/catch so a private-mode / storage-disabled browser
// degrades to in-memory only and never throws. The (optional) Api layer reads
// playerId/nickname from here.

const PREFIX = 'oreo.';
const K = {
  playerId: PREFIX + 'playerId',
  nickname: PREFIX + 'nickname',
  best: PREFIX + 'best',
  storyCleared: PREFIX + 'storyCleared', // '1' once the 10-level Story is finished → unlocks Endless
  tutorialSeen: PREFIX + 'tutorialSeen', // '1' once the How-to-Play has auto-shown on first run
} as const;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, val: string): void {
  try { localStorage.setItem(key, val); } catch { /* storage disabled — ignore */ }
}

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
  /** Stable anonymous guest id; generated + persisted on first call. */
  getPlayerId(): string {
    let id = safeGet(K.playerId);
    if (!id) { id = makeUuid(); safeSet(K.playerId, id); }
    return id;
  },

  hasNickname(): boolean {
    return !!safeGet(K.nickname);
  },

  /** Display name; falls back to "Oreo####" (last 4 of the id) if unset. */
  getNickname(): string {
    const n = safeGet(K.nickname);
    if (n) return n;
    const id = this.getPlayerId().replace(/-/g, '');
    return 'Oreo' + id.slice(-4).toUpperCase();
  },

  setNickname(name: string): void {
    const clean = name.trim().slice(0, 12);
    if (clean) safeSet(K.nickname, clean);
  },

  getBest(): number {
    return parseInt(safeGet(K.best) ?? '0', 10) || 0;
  },
  /** Record a best score; only writes if it beats the stored value. Returns the best. */
  setBest(score: number): number {
    const prev = this.getBest();
    if (score > prev) { safeSet(K.best, String(score)); return score; }
    return prev;
  },

  /** True once the player has finished all 10 Story levels (unlocks Endless). */
  isStoryCleared(): boolean {
    return safeGet(K.storyCleared) === '1';
  },
  markStoryCleared(): void {
    safeSet(K.storyCleared, '1');
  },

  /** True once the How-to-Play overlay has auto-shown (so it only auto-shows once). */
  hasSeenTutorial(): boolean {
    return safeGet(K.tutorialSeen) === '1';
  },
  markTutorialSeen(): void {
    safeSet(K.tutorialSeen, '1');
  },
};

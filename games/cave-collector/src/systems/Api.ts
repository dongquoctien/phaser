// Thin, FAIL-SAFE client for the (optional) leaderboard backend.
//
// Reads the endpoint from import.meta.env.VITE_API_URL. If empty, the whole layer
// is a no-op — the game runs offline on localStorage alone, no errors. When an
// endpoint IS set:
//   startSession()      → POST /session → { sessionToken }   (signed server-side)
//   submitRun(result)   → POST /score   (token + run metadata)
//   getLeaderboard()    → GET  /leaderboard
//
// SECURITY: no secret lives here. The signing secret stays on the server; the
// client only carries the opaque sessionToken. The server validates everything.
// Every call is wrapped so a network/CORS/timeout failure never throws into the
// game loop — it resolves to a safe default.

import { Storage } from './Storage';

declare const __BUILD_ID__: string;

const API_URL: string = (import.meta as unknown as { env?: { VITE_API_URL?: string } })
  .env?.VITE_API_URL?.replace(/\/$/, '') ?? '';

export interface RunResult {
  score: number;
  stars: number;
  levels: number; // levels cleared
  outcome: 'win' | 'gameover';
  startedAt: number; // ms epoch at run start
  endedAt: number;   // ms epoch at win / game over
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  stars: number;
  levels?: number;
  at: number;
}

const TIMEOUT_MS = 6000;

async function safeFetch(path: string, init?: RequestInit): Promise<Response | null> {
  if (!API_URL) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(API_URL + path, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export class Api {
  /** True when a backend is configured; UI hides online bits when false. */
  static get enabled(): boolean { return !!API_URL; }

  private static sessionToken: string | null = null;
  private static sessionPromise: Promise<void> | null = null;

  /** Open a play session; stores the server-signed token for submitRun. No-op when disabled. */
  static startSession(): Promise<void> {
    this.sessionToken = null;
    this.sessionPromise = (async () => {
      const res = await safeFetch('/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId: Storage.getPlayerId(), buildId: __BUILD_ID__ }),
      });
      if (!res || !res.ok) return;
      try {
        const data = (await res.json()) as { sessionToken?: string };
        this.sessionToken = data.sessionToken ?? null;
      } catch { /* bad JSON — ignore */ }
    })();
    return this.sessionPromise;
  }

  /** Submit a finished run. Returns the new rank if accepted, else null. */
  static async submitRun(r: RunResult): Promise<{ rank: number } | null> {
    if (!API_URL) return null;
    if (this.sessionPromise) await this.sessionPromise;
    const res = await safeFetch('/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionToken: this.sessionToken,
        playerId: Storage.getPlayerId(),
        nickname: Storage.getNickname(),
        buildId: __BUILD_ID__,
        ...r,
      }),
    });
    if (!res || !res.ok) return null;
    try { return (await res.json()) as { rank: number }; } catch { return null; }
  }

  /** Top entries (empty array if unavailable). */
  static async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const res = await safeFetch('/leaderboard');
    if (!res || !res.ok) return [];
    try {
      const data = (await res.json()) as { entries?: LeaderboardEntry[] };
      return data.entries ?? [];
    } catch { return []; }
  }
}

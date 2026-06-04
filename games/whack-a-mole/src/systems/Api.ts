// Thin, FAIL-SAFE client for the (optional) leaderboard backend.
//
// Reads the endpoint from import.meta.env.VITE_API_URL. If that's empty the whole
// layer is a no-op — the game runs offline on localStorage alone, no errors. When
// an endpoint IS configured, the flow is:
//
//   startSession()   → POST /session → { sessionToken }   (token signed server-side)
//   submitRun(result)→ POST /score   (token + run metadata)
//   getLeaderboard() → GET  /leaderboard
//
// SECURITY NOTES (important):
//  - NO secret/password lives here. The signing secret stays on the server; the
//    client only carries the opaque sessionToken the server handed back.
//  - The client cannot be trusted, so this just SENDS metadata (score, duration,
//    whacks, bestCombo, friendlyHits, buildId). The SERVER validates it (sanity
//    checks). See server/ for the reference Cloudflare Worker.
//  - Every call is wrapped so a network/CORS/timeout failure never throws into the
//    game loop — it resolves to a safe default.

import { Storage } from './Storage';

declare const __BUILD_ID__: string;

// Vite inlines import.meta.env.VITE_*. Empty/undefined ⇒ API disabled.
const API_URL: string = (import.meta as unknown as { env?: { VITE_API_URL?: string } })
  .env?.VITE_API_URL?.replace(/\/$/, '') ?? '';

export interface RunResult {
  score: number;
  startedAt: number;   // ms epoch when the round began
  endedAt: number;     // ms epoch at time-up
  whacks: number;      // total enemies/bosses bonked
  bestCombo: number;
  friendlyHits: number;
}

export interface LeaderboardEntry {
  nickname: string;
  score: number;
  at: number;
}

const TIMEOUT_MS = 6000;

/** fetch with a timeout that never rejects into the caller — returns null on any failure. */
async function safeFetch(path: string, init?: RequestInit): Promise<Response | null> {
  if (!API_URL) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(API_URL + path, { ...init, signal: ctrl.signal });
  } catch {
    return null; // network / CORS / abort — swallow, the game carries on
  } finally {
    clearTimeout(t);
  }
}

export class Api {
  /** True when a backend is configured; UI can hide leaderboard bits when false. */
  static get enabled(): boolean { return !!API_URL; }

  private static sessionToken: string | null = null;
  private static sessionPromise: Promise<void> | null = null; // so submitRun can await a slow session

  /** Open a play session. Stores the server-signed token for submitRun.
   *  No-op (and harmless) when the API is disabled. */
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

  /** Submit a finished run. Sends identity + the server-validatable metadata.
   *  Returns the new rank if the server accepted it, else null. */
  static async submitRun(r: RunResult): Promise<{ rank: number } | null> {
    if (!API_URL) return null;
    if (this.sessionPromise) await this.sessionPromise; // ensure the token has arrived
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

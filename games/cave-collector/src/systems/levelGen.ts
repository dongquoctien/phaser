import { TILE, type LevelData, HAND_LEVELS } from '../levels';

// Procedural level generator — one engine, two uses:
//   • Story: 10 hand-seeded levels of rising difficulty (deterministic per seed).
//   • Endless: stream chunks forever (see EndlessGen which calls genSegment).
//
// It lays a LEFT-TO-RIGHT walkable path of floor segments separated by jumpable
// gaps, then sprinkles ?-blocks / stars / coins / robots / shurikens scaled by a
// 0..1 difficulty. The gap + height-step limits are derived from the hero's jump
// (gravity 900, jump v=-300, run 110 → ~4.5 tiles across, ~3 tiles up) with a
// safety margin so every gap is always clearable.

const H = 15; // screen height in tiles
const FLOOR_Y = 13; // ground row
const MAX_GAP = 3; // tiles — comfortably under the ~4.5-tile jump reach
const MAX_STEP = 2; // tiles of vertical change between adjacent platforms

// Small seedable PRNG (mulberry32) so Story levels are stable across runs.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

interface Segment { x: number; y: number; len: number; } // a floor run

// Build a chain of floor segments from tile 0 to ~widthTiles, each reachable from
// the previous (gap ≤ MAX_GAP, height change ≤ MAX_STEP). Returns the segments +
// the final exit tile-x.
function buildPath(r: () => number, widthTiles: number, diff: number): { segs: Segment[]; endX: number } {
  const segs: Segment[] = [];
  // start floor — always solid under the spawn, a little longer so the first
  // jump isn't immediate.
  let x = 0;
  let y = FLOOR_Y;
  const firstLen = 10;
  segs.push({ x, y, len: firstLen });
  x += firstLen;

  while (x < widthTiles - 8) {
    // Gap before the next platform (bigger gaps as difficulty rises).
    const gap = pick(r, 1, Math.min(MAX_GAP, 1 + Math.round(diff * 2)));
    x += gap;
    // Height step. NOTE screen-space: a NEGATIVE step means y decreases = the next
    // platform is HIGHER (a climb). Clearing horizontal distance AND climbing at
    // once is the hardest move, so any gap limits the climb to 1 tile (step ≥ -1);
    // a wide gap (≥3) stays flat-or-DOWN (step ≥ 0). Dropping (positive step) is
    // always free up to MAX_STEP.
    const minStep = gap >= 3 ? 0 : -1; // most we let it climb on a gap
    const step = pick(r, minStep, MAX_STEP);
    y = Math.max(8, Math.min(FLOOR_Y, y + step));
    const len = pick(r, 3, 7);
    segs.push({ x, y, len });
    x += len;
  }
  // final long landing floor + exit
  const last = { x, y: FLOOR_Y, len: 8 };
  segs.push(last);
  return { segs, endX: last.x + last.len - 3 };
}

/** Generate one full LevelData for the given seed + difficulty (0..1). */
export function genLevel(name: string, seed: number, widthTiles: number, diff: number): LevelData {
  const r = rng(seed);
  const { segs, endX } = buildPath(r, widthTiles, diff);

  const platforms: Array<[number, number, number]> = segs.map((s) => [s.x, s.y, s.len]);
  const blocks: Array<{ x: number; y: number }> = [];
  const stars: Array<{ x: number; y: number }> = [];
  const coins: Array<{ x: number; y: number }> = [];
  const robots: Array<{ x: number; y: number }> = [];
  const shurikens: Array<{ x: number; y: number; range: number; speed: number }> = [];

  // decorate each segment (skip the first/last so spawn + exit stay clean)
  segs.forEach((s, i) => {
    if (i === 0 || i === segs.length - 1) return;
    const cxTile = s.x + Math.floor(s.len / 2);
    const surfaceY = s.y * TILE; // top of the platform
    const roll = r();

    // A ? block — placed ~3 tiles above the segment, i.e. within the hero's jump
    // reach so it can be punched from the surface. (Higher than that = unreachable.)
    if (roll < 0.35 + diff * 0.1) {
      blocks.push({ x: cxTile * TILE + 8, y: (s.y - 3) * TILE + 8 });
      // the star it pops is spawned at runtime, ~1 tile above the block.
    }
    // a robot patrolling a wide-enough segment
    if (s.len >= 4 && r() < 0.3 + diff * 0.4) {
      robots.push({ x: cxTile * TILE + 8, y: s.y * TILE });
    }
    // A floating star to grab. A low one (~2 tiles up) is reachable straight off the
    // segment; a HIGH one (~5 tiles) is paired with a small step-platform below it
    // so the hero can hop up to reach it (no un-collectable floaters).
    const sr = r();
    if (sr < 0.35) {
      stars.push({ x: cxTile * TILE + 8, y: (s.y - 2) * TILE });
    } else if (sr < 0.6) {
      const stepY = s.y - 3; // a jump-reachable step under the high star
      platforms.push([cxTile - 1, stepY, 2]);
      stars.push({ x: cxTile * TILE + 8, y: (stepY - 2) * TILE });
    }
    // a little coin trail on the surface
    if (r() < 0.5) {
      for (let k = 0; k < 3; k++) coins.push({ x: (s.x + 1 + k) * TILE, y: surfaceY - 8 });
    }
    // A sweeping shuriken over the gap before this segment. Shuriken are flying
    // hazards (hard to dodge), so keep them sparser than the stompable robots:
    // 20%→45% with difficulty, AND a hard cap of ~1 per 4 tiles of width so a wide
    // late level never turns into a wall of blades.
    const shCap = Math.ceil(widthTiles / 18) + 1;
    if (shurikens.length < shCap && r() < 0.2 + diff * 0.25) {
      shurikens.push({
        x: (s.x - 2) * TILE,
        y: (s.y - pick(r, 1, 3)) * TILE,
        range: pick(r, 3, 5) * TILE,
        speed: 70 + Math.round(diff * 50) + pick(r, 0, 20),
      });
    }
  });

  return {
    name,
    widthTiles,
    heightTiles: H,
    spawn: { x: 40, y: FLOOR_Y * TILE },
    platforms,
    blocks,
    stars,
    coins,
    robots,
    shurikens,
    exit: { x: endX * TILE, y: FLOOR_Y * TILE },
  };
}

// 8 generated Story levels (after the 2 hand-authored ones) → 10 total.
const GEN_NAMES = [
  'Dripstone Pit', 'Sporebed Tunnel', 'Glowvein Shaft', 'Echo Chasm',
  'Mossgut Den', 'Sunken Reliquary', 'Venom Spires', "Oreo's Ascent",
];

/** The full 10-level Story campaign: the 2 hand-authored opening levels +
 *  8 procedurally-seeded levels of rising difficulty (wider, gappier, busier).
 *  Fixed seeds → stable, repeatable layouts. */
export const STORY_LEVELS: LevelData[] = [
  ...HAND_LEVELS,
  ...GEN_NAMES.map((name, i) => {
    const stage = i + 2; // 0-based campaign index (after the 2 hand levels)
    const diff = stage / 9; // 0..1 across the 10 levels
    const width = 56 + i * 6; // 56 → 98 tiles
    return genLevel(name, 1337 + i * 97, width, diff);
  }),
];

// ── Endless mode ──────────────────────────────────────────────────────────────
// Endless reuses the same generator: each cleared stage spawns the next, a bit
// wider/harder, with a random seed so it never repeats. There's no win — you go
// until you run out of lives; the score is the reward (leaderboard).
export function genEndlessLevel(stage: number, seed: number): LevelData {
  const diff = Math.min(1, 0.25 + stage * 0.08); // ramps then caps
  const width = Math.min(120, 52 + stage * 5);
  return genLevel(`Endless ${stage + 1}`, seed, width, diff);
}

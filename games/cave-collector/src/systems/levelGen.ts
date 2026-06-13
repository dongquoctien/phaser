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

// Vertical band the path roams within (screen-space tiles; smaller y = higher up).
// FLOOR_Y is the bottom; CEIL_Y leaves headroom for the upper floating layer.
const CEIL_Y = 5;  // highest a main-path platform climbs to
const MIN_Y = 7;   // typical "high" main-path row

// Build the main left→right path. Instead of hugging the floor, it walks through
// alternating "rhythm sections" (flat ground, climbing stairs, floating hops at a
// raised band, then a descent) so the route uses the FULL vertical space and the
// harder "stay up high" stretches appear — every step still ≤ MAX_GAP across and
// ≤ MAX_STEP of climb, so it's always jumpable. (Verticality + rhythm pacing — see
// platformer level-design research.) Returns the segments + the final exit tile-x.
//
// A level THEME biases which sections appear, so levels feel different:
//  - 'mixed'  : balanced (the default)
//  - 'ascent' : lots of climbing — zig-zag UP to the ceiling, then ease down to exit
//  - 'descent': start high, DROP down in stages (one-way descents read as "falling")
// Camera still scrolls horizontally; verticality stays within the one-screen height.
type SectionKind = 'flat' | 'stairs-up' | 'float-high' | 'descend' | 'ascent-zigzag' | 'drop-stairs';
export type LevelTheme = 'mixed' | 'ascent' | 'descent';

function buildPath(
  r: () => number, widthTiles: number, diff: number, theme: LevelTheme = 'mixed',
): { segs: Segment[]; endX: number } {
  const segs: Segment[] = [];
  // start floor — always solid under the spawn, a little longer so the first jump
  // isn't immediate.
  let x = 0;
  let y = FLOOR_Y;
  segs.push({ x, y, len: 10 });
  x += 10;

  // Reserve room at the right for the final landing floor so the exit always fits
  // inside widthTiles (else the door spills past the camera bound — unreachable).
  const FINAL_LEN = 8;
  const lastFloorStart = widthTiles - FINAL_LEN;

  // climbable step bounds (screen-space): negative = climb up. A wide gap can't also
  // climb steeply, so the climb is capped by how far across the jump already reaches.
  const stepFor = (gap: number) => {
    const maxClimb = gap >= 3 ? 0 : 1;   // 0 = no climb on a 3-tile gap; else up to 1
    return pick(r, -maxClimb, MAX_STEP); // negative climbs, positive drops
  };
  const place = (gap: number, ny: number, len: number) => {
    x += gap;
    y = Math.max(CEIL_Y, Math.min(FLOOR_Y, ny));
    const cappedLen = Math.min(len, Math.max(3, lastFloorStart - MAX_GAP - x));
    segs.push({ x, y, len: cappedLen });
    x += cappedLen;
  };

  let guard = 0;
  while (x < lastFloorStart - MAX_GAP && guard++ < 200) {
    // pick the next rhythm section. Theme tilts the odds toward climbs or drops.
    const roll = r();
    const climbBias = theme === 'ascent' ? 0.35 : 0;
    const dropBias = theme === 'descent' ? 0.35 : 0;
    let kind: SectionKind;
    if (y >= FLOOR_Y - 1 && roll < 0.35 + diff * 0.15 + climbBias) {
      kind = r() < 0.5 + climbBias ? 'ascent-zigzag' : 'stairs-up';        // on/near floor → climb up
    } else if (y <= MIN_Y + 1 && roll < 0.4 + dropBias) {
      kind = (dropBias && r() < 0.6) ? 'drop-stairs' : 'float-high';        // up high → hop or drop down
    } else if (y < FLOOR_Y - 2 && roll < 0.3 + dropBias) {
      kind = 'descend';                                                     // ease back toward floor
    } else {
      kind = 'flat';
    }

    if (kind === 'ascent-zigzag') {
      // a steep CLIMB: alternating left/right short ledges going UP to near the
      // ceiling (1-tile climbs so each hop is comfortable), then it tops out and the
      // next section carries on. Reads as "scale the wall".
      const rises = pick(r, 3, 5);
      for (let s = 0; s < rises && x < lastFloorStart - MAX_GAP && y > CEIL_Y; s++) {
        place(pick(r, 1, 2), y - 1, pick(r, 2, 3)); // gap 1-2, climb exactly 1 → always jumpable
      }
    } else if (kind === 'drop-stairs') {
      // a staged DESCENT from up high back down: a run of drops (down is free up to
      // MAX_STEP, and gravity does the work — "one-way" downward flow).
      const drops = pick(r, 3, 5);
      for (let s = 0; s < drops && x < lastFloorStart - MAX_GAP && y < FLOOR_Y; s++) {
        place(pick(r, 1, MAX_GAP), y + MAX_STEP, pick(r, 2, 3));
      }
    } else if (kind === 'stairs-up') {
      // gentler climb: 2–3 short platforms up 1–2 tiles each → the upper band.
      const steps = pick(r, 2, 3);
      for (let s = 0; s < steps && x < lastFloorStart - MAX_GAP; s++) {
        place(pick(r, 1, 2), y - pick(r, 1, 2), pick(r, 3, 4));
      }
    } else if (kind === 'float-high') {
      // a run of small floating platforms at a raised band — the "harder up-high"
      // stretch: short hops with small height jitter, never below MIN_Y+2.
      const hops = pick(r, 2, 4);
      for (let s = 0; s < hops && x < lastFloorStart - MAX_GAP; s++) {
        const ny = Math.min(MIN_Y + 2, Math.max(CEIL_Y, y + pick(r, -1, 1)));
        place(pick(r, 2, MAX_GAP), ny, pick(r, 2, 3));
      }
    } else if (kind === 'descend') {
      // step back down toward the floor in 1–2 drops.
      const drops = pick(r, 1, 2);
      for (let s = 0; s < drops && x < lastFloorStart - MAX_GAP; s++) {
        place(pick(r, 1, 2), y + MAX_STEP, pick(r, 3, 5));
      }
    } else {
      // flat: a normal ground-ish segment with a gap + gentle step.
      const gap = pick(r, 1, Math.min(MAX_GAP, 1 + Math.round(diff * 2)));
      place(gap, y + stepFor(gap), pick(r, 3, 6));
    }
  }
  // final long landing floor + exit, pinned to the reserved zone.
  const last = { x: lastFloorStart, y: FLOOR_Y, len: FINAL_LEN };
  segs.push(last);
  return { segs, endX: Math.min(last.x + last.len - 2, widthTiles - 2) };
}

// Build an UPPER layer of standalone floating platforms above the main path —
// optional reward branches that add verticality + somewhere to perch stars. They
// sit ~3–4 tiles above a main-path segment (reachable with a jump) but are NOT on
// the critical route, so they never block progress. Returns extra platforms + the
// star positions to drop on them.
function buildFloaters(
  r: () => number, segs: Segment[], diff: number,
): { platforms: Array<[number, number, number]>; stars: Array<{ x: number; y: number }> } {
  const platforms: Array<[number, number, number]> = [];
  const stars: Array<{ x: number; y: number }> = [];
  // roughly one floater per ~12 tiles, a touch denser on harder levels
  segs.forEach((s, i) => {
    if (i === 0 || i === segs.length - 1) return;        // keep spawn/exit clear
    if (s.len < 3) return;
    if (r() > 0.33 + diff * 0.12) return;
    const fy = s.y - pick(r, 3, 4);                       // a jump above this segment
    if (fy < CEIL_Y - 1) return;                          // don't poke off the top
    const flen = pick(r, 2, 3);
    const fx = s.x + Math.max(0, Math.floor((s.len - flen) / 2));
    platforms.push([fx, fy, flen]);
    stars.push({ x: (fx + Math.floor(flen / 2)) * TILE + 8, y: (fy - 2) * TILE });
  });
  return { platforms, stars };
}

/** Generate one full LevelData for the given seed + difficulty (0..1) + theme. */
export function genLevel(
  name: string, seed: number, widthTiles: number, diff: number, theme: LevelTheme = 'mixed',
): LevelData {
  const r = rng(seed);
  const { segs, endX } = buildPath(r, widthTiles, diff, theme);

  const platforms: Array<[number, number, number]> = segs.map((s) => [s.x, s.y, s.len]);
  // upper floating layer (reward branches + verticality)
  const floaters = buildFloaters(r, segs, diff);
  platforms.push(...floaters.platforms);
  const blocks: Array<{ x: number; y: number }> = [];
  const stars: Array<{ x: number; y: number }> = [...floaters.stars]; // reward stars on the upper layer
  const coins: Array<{ x: number; y: number }> = [];
  const robots: Array<{ x: number; y: number }> = [];
  const slimes: Array<{ x: number; y: number }> = [];
  const beetles: Array<{ x: number; y: number }> = [];
  const bats: Array<{ x: number; y: number; range: number; speed: number }> = [];
  const shurikens: Array<{ x: number; y: number; range: number; speed: number }> = [];

  // ── Enemy budgeting (so a level is never overcrowded) ──
  // Density ~1 enemy per 5 tiles, scaled by difficulty. Flying threats are the
  // hardest to dodge, so a level keeps them sparse. Bats are the only flying type
  // now (cave-appropriate; shuriken kept in code but no longer spawned).
  const groundBudget = Math.round((widthTiles / 5) * (0.5 + diff)); // total ground enemies
  const flyBudget = Math.max(1, Math.round((widthTiles / 22) * (0.6 + diff))); // bats
  r(); // (still consume this PRNG value so existing seeded layouts don't shift)
  const useBats = true; // always bats now (was: r() < 0.5 to pick bat OR shuriken)
  let ground = 0, fly = 0;

  // decorate each segment (skip the first/last so spawn + exit stay clean)
  segs.forEach((s, i) => {
    if (i === 0 || i === segs.length - 1) return;
    const cxTile = s.x + Math.floor(s.len / 2);
    const surfaceY = s.y * TILE; // top of the platform
    const roll = r();

    // A ? block — placed ~3 tiles above the segment (within jump reach so it can be
    // punched from the surface).
    if (roll < 0.35 + diff * 0.1) {
      blocks.push({ x: cxTile * TILE + 8, y: (s.y - 3) * TILE + 8 });
    }

    // ── A ground enemy on this segment (within budget). Mix robot / slime / beetle;
    //    beetles are rarer (un-stompable, more annoying) and only on later levels. ──
    if (ground < groundBudget && s.len >= 3 && r() < 0.45 + diff * 0.2) {
      ground++;
      const kindRoll = r();
      const x = cxTile * TILE + 8, y = s.y * TILE;
      // beetles are un-stompable (more annoying), so keep them the minority and
      // only on later levels; slimes are the easy filler, robots the staple.
      if (kindRoll < 0.1 + diff * 0.15) beetles.push({ x, y });
      else if (kindRoll < 0.55) slimes.push({ x, y });
      else robots.push({ x, y });
    }

    // A floating star. Low (~2 tiles) reachable off the segment; high (~5 tiles) gets
    // a small step-platform below so the hero can hop up (no un-collectable floaters).
    const sr = r();
    if (sr < 0.35) {
      stars.push({ x: cxTile * TILE + 8, y: (s.y - 2) * TILE });
    } else if (sr < 0.6) {
      const stepY = s.y - 3;
      platforms.push([cxTile - 1, stepY, 2]);
      stars.push({ x: cxTile * TILE + 8, y: (stepY - 2) * TILE });
    }
    // a little coin trail on the surface
    if (r() < 0.5) {
      for (let k = 0; k < 3; k++) coins.push({ x: (s.x + 1 + k) * TILE, y: surfaceY - 8 });
    }

    // ── A single flying threat over the gap before this segment (within budget). ──
    if (fly < flyBudget && r() < 0.25 + diff * 0.2) {
      fly++;
      const fx = (s.x - 2) * TILE;
      const fy = (s.y - pick(r, 1, 3)) * TILE;
      const range = pick(r, 3, 5) * TILE;
      const speed = 60 + Math.round(diff * 40) + pick(r, 0, 20);
      if (useBats) bats.push({ x: fx, y: fy, range, speed });
      else shurikens.push({ x: fx, y: fy, range, speed });
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
    slimes,
    beetles,
    bats,
    shurikens,
    exit: { x: endX * TILE, y: FLOOR_Y * TILE },
  };
}

// 8 generated Story levels (after the 2 hand-authored ones) → 10 total. Each has a
// THEME so the campaign varies between balanced, climb-heavy, and descent levels
// (the climb/descent ones read as "scale the wall" / "drop down the shaft").
const GEN_LEVELS: Array<{ name: string; theme: LevelTheme }> = [
  { name: 'Dripstone Pit', theme: 'mixed' },
  { name: 'Sporebed Tunnel', theme: 'ascent' },
  { name: 'Glowvein Shaft', theme: 'descent' },
  { name: 'Echo Chasm', theme: 'mixed' },
  { name: 'Mossgut Den', theme: 'ascent' },
  { name: 'Sunken Reliquary', theme: 'descent' },
  { name: 'Venom Spires', theme: 'mixed' },
  { name: "Oreo's Ascent", theme: 'ascent' },
];

/** The full 10-level Story campaign: the 2 hand-authored opening levels +
 *  8 procedurally-seeded levels of rising difficulty (wider, gappier, busier).
 *  Fixed seeds → stable, repeatable layouts. */
export const STORY_LEVELS: LevelData[] = [
  ...HAND_LEVELS,
  ...GEN_LEVELS.map(({ name, theme }, i) => {
    const stage = i + 2; // 0-based campaign index (after the 2 hand levels)
    const diff = stage / 9; // 0..1 across the 10 levels
    const width = 56 + i * 6; // 56 → 98 tiles
    return genLevel(name, 1337 + i * 97, width, diff, theme);
  }),
];

// ── Endless mode ──────────────────────────────────────────────────────────────
// Endless reuses the same generator: each cleared stage spawns the next, a bit
// wider/harder, with a random seed so it never repeats. There's no win — you go
// until you run out of lives; the score is the reward (leaderboard). The theme
// rotates so consecutive stages feel different.
const ENDLESS_THEMES: LevelTheme[] = ['mixed', 'ascent', 'mixed', 'descent'];
export function genEndlessLevel(stage: number, seed: number): LevelData {
  const diff = Math.min(1, 0.25 + stage * 0.08); // ramps then caps
  const width = Math.min(120, 52 + stage * 5);
  const theme = ENDLESS_THEMES[stage % ENDLESS_THEMES.length];
  return genLevel(`Endless ${stage + 1}`, seed, width, diff, theme);
}

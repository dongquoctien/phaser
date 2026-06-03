import { CELL, GRID_COLS, GRID_ROWS } from '../tuning';

// ── Map definitions ──────────────────────────────────────────────────────────
// Three hand-laid maps on the same 12×16 grid. Each has its own winding road
// (entry at top → exit off the bottom), its own hero PADS beside the road, decor,
// and a difficulty modifier. Maps get longer/twistier with fewer pads + tougher
// zombies as you go. Heroes are placed on PADS, never on the road.

export interface MapDef {
  id: number;
  name: string;
  difficulty: 'Easy' | 'Normal' | 'Hard';
  path: ReadonlyArray<readonly [number, number]>;
  pads: ReadonlyArray<readonly [number, number]>;
  decor: ReadonlyArray<{ cell: readonly [number, number]; kind: 'tree' | 'rock' }>;
  enemyHpMul: number; // multiplies zombie hp
  startGold: number;
}

type Cell = [number, number];
const seg = (push: (c: number, r: number) => void) => push; // alias for readability

// Map 1 — Easy: the original gentle 3-bend snake, 18 pads.
function buildPath1(): Cell[] {
  const p: Cell[] = []; const push = (c: number, r: number) => p.push([c, r]);
  for (let r = -1; r <= 2; r++) push(2, r);
  for (let c = 3; c <= 9; c++) push(c, 2);
  for (let r = 3; r <= 5; r++) push(9, r);
  for (let c = 8; c >= 2; c--) push(c, 5);
  for (let r = 6; r <= 8; r++) push(2, r);
  for (let c = 3; c <= 9; c++) push(c, 8);
  for (let r = 9; r <= 11; r++) push(9, r);
  for (let c = 8; c >= 2; c--) push(c, 11);
  for (let r = 12; r <= GRID_ROWS; r++) push(2, r);
  return p;
}

// Map 2 — Normal: a tighter 5-bend path entering from the right, fewer pads.
function buildPath2(): Cell[] {
  const p: Cell[] = []; const push = (c: number, r: number) => p.push([c, r]);
  seg(push);
  for (let r = -1; r <= 1; r++) push(9, r);   // enter top-right
  for (let c = 8; c >= 2; c--) push(c, 1);    // ← left
  for (let r = 2; r <= 4; r++) push(2, r);    // ↓
  for (let c = 3; c <= 9; c++) push(c, 4);    // → right
  for (let r = 5; r <= 7; r++) push(9, r);    // ↓
  for (let c = 8; c >= 2; c--) push(c, 7);    // ← left
  for (let r = 8; r <= 10; r++) push(2, r);   // ↓
  for (let c = 3; c <= 9; c++) push(c, 10);   // → right
  for (let r = 11; r <= 13; r++) push(9, r);  // ↓
  for (let c = 8; c >= 5; c--) push(c, 13);   // ← partway
  for (let r = 14; r <= GRID_ROWS; r++) push(5, r); // ↓ exit
  return p;
}

// Map 3 — Hard: a long serpentine that fills the board, fewest pads.
function buildPath3(): Cell[] {
  const p: Cell[] = []; const push = (c: number, r: number) => p.push([c, r]);
  for (let r = -1; r <= 0; r++) push(1, r);   // enter top-left
  for (let c = 1; c <= 10; c++) push(c, 0);   // → across the top
  for (let r = 1; r <= 2; r++) push(10, r);   // ↓
  for (let c = 9; c >= 1; c--) push(c, 2);    // ← back
  for (let r = 3; r <= 4; r++) push(1, r);    // ↓
  for (let c = 2; c <= 10; c++) push(c, 4);   // → across
  for (let r = 5; r <= 6; r++) push(10, r);   // ↓
  for (let c = 9; c >= 1; c--) push(c, 6);    // ← back
  for (let r = 7; r <= 8; r++) push(1, r);    // ↓
  for (let c = 2; c <= 10; c++) push(c, 8);   // → across
  for (let r = 9; r <= 10; r++) push(10, r);  // ↓
  for (let c = 9; c >= 1; c--) push(c, 10);   // ← back
  for (let r = 11; r <= 12; r++) push(1, r);  // ↓
  for (let c = 2; c <= 10; c++) push(c, 12);  // → across
  for (let r = 13; r <= GRID_ROWS; r++) push(10, r); // ↓ exit
  return p;
}

export const MAPS: ReadonlyArray<MapDef> = [
  {
    id: 0, name: 'Greenfields', difficulty: 'Easy', enemyHpMul: 1, startGold: 260,
    path: buildPath1(),
    pads: [
      [4, 0], [6, 0], [8, 0],
      [0, 3], [5, 3], [7, 3], [11, 3],
      [0, 6], [4, 7], [6, 6], [11, 6],
      [5, 9], [7, 9], [0, 10],
      [4, 12], [6, 13], [8, 12], [11, 12],
    ],
    decor: [
      { cell: [10, 0], kind: 'tree' }, { cell: [0, 0], kind: 'tree' },
      { cell: [11, 4], kind: 'tree' }, { cell: [10, 7], kind: 'rock' },
      { cell: [0, 8], kind: 'tree' }, { cell: [11, 9], kind: 'tree' },
      { cell: [10, 13], kind: 'tree' }, { cell: [0, 14], kind: 'rock' },
    ],
  },
  {
    id: 1, name: 'Twisted Vale', difficulty: 'Normal', enemyHpMul: 1.25, startGold: 240,
    path: buildPath2(),
    pads: [
      [0, 0], [4, 0], [11, 0],
      [0, 3], [5, 2], [11, 3],
      [0, 6], [5, 5], [11, 6],
      [0, 9], [5, 8], [11, 9],
      [0, 12], [2, 13], [11, 12],
    ],
    decor: [
      { cell: [11, 1], kind: 'tree' }, { cell: [0, 2], kind: 'rock' },
      { cell: [11, 5], kind: 'tree' }, { cell: [0, 8], kind: 'tree' },
      { cell: [11, 11], kind: 'rock' }, { cell: [0, 14], kind: 'tree' },
    ],
  },
  {
    id: 2, name: 'Dead Maze', difficulty: 'Hard', enemyHpMul: 1.6, startGold: 220,
    path: buildPath3(),
    pads: [
      [0, 1], [11, 1],
      [0, 3], [5, 3], [11, 3],
      [0, 5], [11, 5],
      [0, 7], [5, 7], [11, 7],
      [0, 9], [11, 9],
      [0, 11], [5, 11], [11, 11],
      [0, 13], [11, 13],
    ],
    decor: [
      { cell: [0, 0], kind: 'rock' }, { cell: [11, 0], kind: 'tree' },
      { cell: [0, 6], kind: 'tree' }, { cell: [11, 6], kind: 'rock' },
      { cell: [0, 14], kind: 'tree' }, { cell: [11, 14], kind: 'tree' },
    ],
  },
];

export function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

// Hero sprites are ~56px tall with a high origin (0.62), so a pad at grid row 0
// (centre y = 20) would clip the hero's head above the field's top edge. For pads
// that sit too close to the top we nudge the pad — and therefore the hero placed on
// it — straight down by just enough that the full sprite stays on-field. Both the
// pad render and hero placement read this single y, so they always stay aligned.
const HERO_HALF_ABOVE = 36; // pixels the tallest sprite reaches above its centre
const PAD_TOP_MARGIN = 3; // breathing room above the head
export function padCenter(col: number, row: number): { x: number; y: number } {
  const { x, y } = cellCenter(col, row);
  return { x, y: Math.max(y, HERO_HALF_ABOVE + PAD_TOP_MARGIN) };
}

/** Pixel waypoints along a map's road (cell centres). */
export function pathWaypoints(map: MapDef): { x: number; y: number }[] {
  return map.path.map(([c, r]) => cellCenter(c, r));
}

/** Set of "col,row" strings a map's road occupies (for drawing / blocking). */
export function pathSet(map: MapDef): Set<string> {
  const s = new Set<string>();
  for (const [c, r] of map.path) s.add(`${c},${r}`);
  return s;
}

export function isInsideGrid(col: number, row: number): boolean {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}

export const MAP_COUNT = MAPS.length;

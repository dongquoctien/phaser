// Data-array level authoring (monorepo default — offline, diffable, verifiable).
// One tile = 16px. The hero, blocks, stars, enemies and exit door are placed in
// world pixels. Each level is a self-contained screen-and-a-bit that scrolls.

export const TILE = 16;

export interface LevelData {
  name: string;
  widthTiles: number; // world width in tiles
  heightTiles: number; // world height in tiles (== screen height / TILE)
  // Solid platform tiles as [tileX, tileY, lengthInTiles] horizontal runs.
  platforms: Array<[number, number, number]>;
  // Hero spawn (world px, bottom-center).
  spawn: { x: number; y: number };
  // ? blocks that pop a star when hit from below (world px, center).
  blocks: Array<{ x: number; y: number }>;
  // Free-floating stars to collect (world px, center).
  stars: Array<{ x: number; y: number }>;
  // Coins — smaller, worth less (world px, center).
  coins: Array<{ x: number; y: number }>;
  // Stationary sentry robots sitting on a surface (world px, bottom-center).
  robots: Array<{ x: number; y: number }>;
  // Flying shuriken hazards that sweep horizontally between two x's at a y.
  shurikens: Array<{ x: number; y: number; range: number; speed: number }>;
  // Exit door (world px, bottom-center).
  exit: { x: number; y: number };
}

// Screen is 400x240 => 25 tiles wide visible, 15 tiles tall.
const H = 15;

export const LEVELS: LevelData[] = [
  {
    name: 'Toxic Hollow',
    widthTiles: 56,
    heightTiles: H,
    spawn: { x: 40, y: 13 * TILE },
    // Floor with a couple of gaps + raised pillars/platforms (magenta blocks).
    platforms: [
      [0, 13, 12], // start floor (no gap right at spawn)
      [14, 13, 4], // floor after a gap
      [10, 10, 3], // mid platform
      [20, 11, 4], // step
      [25, 13, 8], // floor
      [28, 9, 3], // high platform (with robot)
      [35, 13, 6], // floor
      [38, 10, 3], // platform
      [44, 13, 12], // long final floor to the door
      [46, 9, 4], // upper ledge near exit
    ],
    blocks: [
      { x: 11 * TILE + 8, y: 7 * TILE + 8 },
      { x: 22 * TILE + 8, y: 8 * TILE + 8 },
      { x: 39 * TILE + 8, y: 7 * TILE + 8 },
    ],
    stars: [
      { x: 10 * TILE + 24, y: 9 * TILE },
      { x: 21 * TILE + 16, y: 9 * TILE },
      { x: 47 * TILE + 24, y: 7 * TILE },
    ],
    coins: [
      { x: 6 * TILE, y: 12 * TILE + 8 }, // on the start floor, body height
      { x: 7 * TILE, y: 12 * TILE + 8 },
      { x: 8 * TILE, y: 12 * TILE + 8 },
      { x: 30 * TILE, y: 12 * TILE + 8 }, // on the mid floor
      { x: 31 * TILE, y: 12 * TILE + 8 },
      { x: 32 * TILE, y: 12 * TILE + 8 },
      { x: 39 * TILE, y: 9 * TILE }, // above the [38,10,3] platform
    ],
    robots: [
      { x: 29 * TILE + 8, y: 9 * TILE },
      { x: 48 * TILE, y: 13 * TILE },
    ],
    shurikens: [
      { x: 16 * TILE, y: 8 * TILE, range: 4 * TILE, speed: 70 },
      { x: 34 * TILE, y: 7 * TILE, range: 5 * TILE, speed: 90 },
      { x: 50 * TILE, y: 11 * TILE, range: 3 * TILE, speed: 80 },
    ],
    exit: { x: 53 * TILE, y: 13 * TILE },
  },
  {
    name: 'Crystal Drop',
    widthTiles: 60,
    heightTiles: H,
    spawn: { x: 40, y: 13 * TILE },
    platforms: [
      [0, 13, 8],
      [6, 10, 3],
      [11, 8, 3],
      [16, 11, 4],
      [22, 13, 6],
      [24, 9, 3],
      [30, 11, 3],
      [34, 13, 5],
      [38, 9, 4],
      [44, 12, 4],
      [48, 13, 12],
      [50, 8, 5],
    ],
    blocks: [
      { x: 7 * TILE + 8, y: 7 * TILE + 8 },
      { x: 12 * TILE + 8, y: 5 * TILE + 8 },
      { x: 25 * TILE + 8, y: 6 * TILE + 8 },
      { x: 39 * TILE + 8, y: 6 * TILE + 8 },
    ],
    stars: [
      { x: 12 * TILE + 16, y: 6 * TILE },
      { x: 17 * TILE + 24, y: 9 * TILE },
      { x: 31 * TILE + 16, y: 9 * TILE },
      { x: 52 * TILE + 24, y: 6 * TILE },
    ],
    coins: [
      { x: 2 * TILE, y: 11 * TILE + 8 },
      { x: 3 * TILE, y: 11 * TILE + 8 },
      { x: 23 * TILE, y: 11 * TILE + 8 },
      { x: 24 * TILE, y: 11 * TILE + 8 },
      { x: 45 * TILE, y: 10 * TILE + 8 },
      { x: 46 * TILE, y: 10 * TILE + 8 },
    ],
    robots: [
      { x: 25 * TILE + 8, y: 9 * TILE },
      { x: 39 * TILE + 8, y: 9 * TILE },
      { x: 52 * TILE, y: 13 * TILE },
    ],
    shurikens: [
      { x: 18 * TILE, y: 7 * TILE, range: 4 * TILE, speed: 85 },
      { x: 33 * TILE, y: 6 * TILE, range: 5 * TILE, speed: 100 },
      { x: 42 * TILE, y: 11 * TILE, range: 4 * TILE, speed: 95 },
      { x: 54 * TILE, y: 10 * TILE, range: 3 * TILE, speed: 90 },
    ],
    exit: { x: 57 * TILE, y: 13 * TILE },
  },
];

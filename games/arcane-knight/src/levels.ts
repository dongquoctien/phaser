// Hand-designed level data. Coordinates are in world pixels. Tiles are 32px.
// Ground runs along the bottom; `plats` are solid blocks the hero stands on;
// `enemies` spawn at (x,y) bottom-anchored; `spikes` hurt on contact; `flag` is the
// level exit; `boss` marks the final arena.
export type EnemyType = 'slime' | 'bat' | 'skeleton';

export interface LevelDef {
  name: string;
  width: number;        // world width (height is the canvas height)
  startX: number;       // hero spawn x
  plats: { x: number; y: number; w: number }[]; // solid platforms (w in tiles)
  enemies: { type: EnemyType; x: number; y: number }[];
  spikes: { x: number; y: number; n: number }[]; // n spike tiles wide
  flagX: number;        // exit flag x (null on boss level)
  boss?: boolean;
}

const GH = 270;          // canvas height
const GROUND_Y = GH - 24; // top of the ground band

export const LEVELS: LevelDef[] = [
  {
    name: 'GREENWOOD PATH',
    width: 1600, startX: 60,
    plats: [
      { x: 320, y: GROUND_Y - 60, w: 3 },
      { x: 520, y: GROUND_Y - 104, w: 2 },
      { x: 760, y: GROUND_Y - 64, w: 3 },
      { x: 1040, y: GROUND_Y - 96, w: 2 },
      { x: 1240, y: GROUND_Y - 56, w: 3 },
    ],
    enemies: [
      { type: 'slime', x: 360, y: GROUND_Y - 60 },
      { type: 'slime', x: 800, y: GROUND_Y },
      { type: 'bat', x: 560, y: GROUND_Y - 150 },
      { type: 'slime', x: 1080, y: GROUND_Y - 96 },
      { type: 'bat', x: 1300, y: GROUND_Y - 130 },
    ],
    spikes: [{ x: 640, y: GROUND_Y, n: 2 }, { x: 980, y: GROUND_Y, n: 2 }],
    flagX: 1540,
  },
  {
    name: 'BONE HOLLOW',
    width: 1800, startX: 60,
    plats: [
      { x: 280, y: GROUND_Y - 70, w: 2 },
      { x: 470, y: GROUND_Y - 120, w: 2 },
      { x: 680, y: GROUND_Y - 80, w: 3 },
      { x: 960, y: GROUND_Y - 110, w: 2 },
      { x: 1180, y: GROUND_Y - 70, w: 3 },
      { x: 1460, y: GROUND_Y - 100, w: 2 },
    ],
    enemies: [
      { type: 'skeleton', x: 320, y: GROUND_Y - 70 },
      { type: 'bat', x: 500, y: GROUND_Y - 160 },
      { type: 'skeleton', x: 720, y: GROUND_Y - 80 },
      { type: 'slime', x: 1000, y: GROUND_Y },
      { type: 'skeleton', x: 1220, y: GROUND_Y - 70 },
      { type: 'bat', x: 1480, y: GROUND_Y - 150 },
    ],
    spikes: [{ x: 600, y: GROUND_Y, n: 3 }, { x: 1320, y: GROUND_Y, n: 2 }],
    flagX: 1740,
  },
  {
    name: 'DEMON KEEP',
    width: 720, startX: 60,
    plats: [
      { x: 140, y: GROUND_Y - 80, w: 2 },
      { x: 520, y: GROUND_Y - 80, w: 2 },
    ],
    enemies: [], // boss spawns in code
    spikes: [],
    flagX: -1,
    boss: true,
  },
];

export const GROUND_TOP = GROUND_Y;
export const TILE = 32;

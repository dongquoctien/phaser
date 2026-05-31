// Pure data — NO imports — so it can never form an import cycle. config/objects/
// systems import dimensions + Tuning from HERE, not from config.ts. (Lesson from
// the survivor game: a module-level constant that reads Tuning hits a TDZ
// "Cannot access Tuning before initialization" if Tuning lives in config.ts.)

// Portrait, mobile-first — matches the vertical reference.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 800;

// One grid cell = one hop. The board is GRID_COLS wide; rows are an infinite
// vertical stream the camera scrolls up through.
export const CELL = 80;
export const GRID_COLS = 6; // 6 * 80 = 480 = GAME_WIDTH

export const Tuning = {
  // Frog
  hopDuration: 110, // ms per hop tween
  startRow: 2, // rows from the bottom where the frog starts

  // Camera / scoring
  // The camera follows the frog; falling this many cells behind the highest
  // reached row (off the bottom of the screen) is death.
  fallBehindCells: 6,

  // Lanes — each non-grass row is one lane with traffic OR water.
  // A run of grass (safe) then a band of road/water, repeating, getting denser.
  carSpeedMin: 70,
  carSpeedMax: 150,
  carGapMin: 150, // px gap between cars in a lane
  carGapMax: 360,
  logSpeedMin: 45,
  logSpeedMax: 95,
  logGapMin: 40,
  logGapMax: 130,

  // Difficulty ramp: chance a newly generated row is hazardous rises with depth.
  hazardBaseChance: 0.45,
  hazardChancePerRow: 0.004,
  hazardChanceMax: 0.8,

  // Pools
  poolCars: 40,
  poolLogs: 40,
} as const;

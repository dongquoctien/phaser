import { CELL, GRID_COLS, GRID_ROWS } from '../tuning';

// A winding path through the 10×13 grid, as a list of [col,row] cells from the
// enemy entry (top) to the exit (bottom). Path cells are not buildable; towers
// go on the remaining grass cells. (Designed to snake like the reference.)
export const PATH_CELLS: ReadonlyArray<readonly [number, number]> = [
  [1, -1], [1, 0], [1, 1], [1, 2], [1, 3],
  [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3],
  [8, 4], [8, 5], [8, 6],
  [7, 6], [6, 6], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6],
  [1, 7], [1, 8], [1, 9],
  [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [7, 9], [8, 9],
  [8, 10], [8, 11], [8, 12], [8, 13],
];

// Decor (trees/barrels) on grass cells, purely visual (still buildable-blocked).
export const DECOR: ReadonlyArray<{ cell: readonly [number, number]; kind: 'tree' | 'barrel' }> = [
  { cell: [4, 1], kind: 'tree' }, { cell: [9, 1], kind: 'tree' },
  { cell: [3, 5], kind: 'barrel' }, { cell: [6, 5], kind: 'tree' },
  { cell: [9, 7], kind: 'tree' }, { cell: [0, 8], kind: 'tree' },
  { cell: [5, 11], kind: 'barrel' }, { cell: [3, 12], kind: 'tree' },
];

export function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

/** Pixel waypoints along the path (cell centres). */
export function pathWaypoints(): { x: number; y: number }[] {
  return PATH_CELLS.map(([c, r]) => cellCenter(c, r));
}

/** A Set of "col,row" strings that are blocked (path or decor) → not buildable. */
export function blockedCells(): Set<string> {
  const s = new Set<string>();
  for (const [c, r] of PATH_CELLS) s.add(`${c},${r}`);
  for (const d of DECOR) s.add(`${d.cell[0]},${d.cell[1]}`);
  return s;
}

export function isInsideGrid(col: number, row: number): boolean {
  return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}

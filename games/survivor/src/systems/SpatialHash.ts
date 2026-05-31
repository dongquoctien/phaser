// Uniform spatial-hash grid — the broad-phase that makes hundreds of enemies
// affordable. NOT Arcade overlap (that doesn't scale to survivor counts and we
// don't want physics resolution between enemies). Buckets are reused arrays;
// rebuild() runs once per frame, query() scans only the local cell block.
//
// Allocation discipline: no per-frame allocations in rebuild/query — buckets are
// cleared with `length = 0` and reused; query takes a callback (no result array).

export interface HashItem {
  x: number;
  y: number;
  active: boolean;
}

export class SpatialHash<T extends HashItem> {
  private cell: number;
  private buckets = new Map<number, T[]>();

  constructor(cellSize: number) {
    this.cell = cellSize;
  }

  private key(cx: number, cy: number): number {
    // Pack two 16-bit-ish cell coords into one number (offset to keep positive).
    return (cx + 8192) * 65536 + (cy + 8192);
  }

  /** Clear and re-insert all active items. Call once per frame. */
  rebuild(items: readonly T[]): void {
    for (const arr of this.buckets.values()) arr.length = 0;
    const c = this.cell;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.active) continue;
      const k = this.key(Math.floor(it.x / c), Math.floor(it.y / c));
      let arr = this.buckets.get(k);
      if (!arr) {
        arr = [];
        this.buckets.set(k, arr);
      }
      arr.push(it);
    }
  }

  /**
   * Invoke `cb` for every active item whose center is within `r` of (x,y).
   * Scans only the cell block covering the radius. Returns the count visited.
   */
  query(x: number, y: number, r: number, cb: (item: T) => void): void {
    const c = this.cell;
    const r2 = r * r;
    const minCx = Math.floor((x - r) / c);
    const maxCx = Math.floor((x + r) / c);
    const minCy = Math.floor((y - r) / c);
    const maxCy = Math.floor((y + r) / c);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const arr = this.buckets.get(this.key(cx, cy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i];
          const dx = it.x - x;
          const dy = it.y - y;
          if (dx * dx + dy * dy <= r2) cb(it);
        }
      }
    }
  }

  /** Nearest active item to (x,y) within `r`, or null. For weapon targeting. */
  nearest(x: number, y: number, r: number): T | null {
    let best: T | null = null;
    let bestD = r * r;
    const c = this.cell;
    const minCx = Math.floor((x - r) / c);
    const maxCx = Math.floor((x + r) / c);
    const minCy = Math.floor((y - r) / c);
    const maxCy = Math.floor((y + r) / c);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const arr = this.buckets.get(this.key(cx, cy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const it = arr[i];
          const dx = it.x - x;
          const dy = it.y - y;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = it;
          }
        }
      }
    }
    return best;
  }

  /** Iterate the neighbours in the same + adjacent cells of an item (for separation). */
  forNeighbors(item: T, cb: (other: T) => void): void {
    const c = this.cell;
    const cx = Math.floor(item.x / c);
    const cy = Math.floor(item.y / c);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const arr = this.buckets.get(this.key(cx + ox, cy + oy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] !== item) cb(arr[i]);
        }
      }
    }
  }
}

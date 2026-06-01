import Phaser from 'phaser';
import { Mover } from '../objects/Mover';
import { TextureKeys } from '../types/keys';
import { CELL, GAME_WIDTH, GRID_COLS, Tuning } from '../tuning';

export type RowKind = 'grass' | 'road' | 'water';

export interface Row {
  index: number; // logical row index (increases upward)
  kind: RowKind;
  dir: number; // +1 / -1 traffic direction (road/water)
  speed: number; // px/s magnitude
}

const CAR_TEXTURES = [TextureKeys.CarOrange, TextureKeys.CarBlue, TextureKeys.CarRed];

// Owns the infinite vertical field: generates rows on demand, draws each row's
// background band + decor, spawns/streams the cars & logs, and answers the two
// gameplay questions per frame — "is the frog hit by a car?" and "is the frog on
// a log (and drifting), or has it drowned?".
//
// World layout: logical row `index` sits at worldY = -index * CELL (so higher
// index = higher up = smaller y). The frog starts around index 0.
export class RowField {
  private rows = new Map<number, Row>();
  private bands = new Map<number, Phaser.GameObjects.Rectangle>();
  private decor = new Map<number, Phaser.GameObjects.Image[]>();
  private cars: Phaser.GameObjects.Group;
  private logs: Phaser.GameObjects.Group;
  private highestGenerated = -1;

  constructor(private scene: Phaser.Scene) {
    this.cars = scene.add.group({ classType: Mover, maxSize: Tuning.poolCars });
    this.logs = scene.add.group({ classType: Mover, maxSize: Tuning.poolLogs });
    for (let i = 0; i < Tuning.poolCars; i++) this.cars.add(new Mover(scene), true);
    for (let i = 0; i < Tuning.poolLogs; i++) this.logs.add(new Mover(scene), true);
    this.cars.getChildren().forEach((m) => (m as Mover).despawn());
    this.logs.getChildren().forEach((m) => (m as Mover).despawn());
  }

  static worldY(index: number): number {
    return -index * CELL;
  }

  getRow(index: number): Row | undefined {
    return this.rows.get(index);
  }

  /** Ensure rows up to `index` exist. Call as the frog/camera advances. */
  ensureUpTo(index: number): void {
    while (this.highestGenerated < index) {
      this.highestGenerated += 1;
      this.generateRow(this.highestGenerated);
    }
  }

  /** Drop rows whose band has scrolled well below the camera to free objects. */
  prune(belowIndex: number): void {
    for (const idx of [...this.rows.keys()]) {
      if (idx < belowIndex) this.removeRow(idx);
    }
  }

  private generateRow(index: number): void {
    const y = RowField.worldY(index);
    let kind: RowKind = 'grass';
    // The first few rows are always safe grass.
    if (index > 2) {
      const hazardChance = Math.min(
        Tuning.hazardChanceMax,
        Tuning.hazardBaseChance + index * Tuning.hazardChancePerRow,
      );
      if (Math.random() < hazardChance) kind = Math.random() < 0.62 ? 'road' : 'water';
    }

    // Sweetie-16 lane colours (cohesive with the pixel sprites).
    const color = kind === 'grass' ? this.grassColor(index) : kind === 'road' ? 0x566c86 : 0x41a6f6;
    const band = this.scene.add
      .rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, CELL, color)
      .setDepth(kind === 'water' ? 1 : 2);
    this.bands.set(index, band);

    const dir = Math.random() < 0.5 ? 1 : -1;
    const row: Row = { index, kind, dir, speed: 0 };

    if (kind === 'grass') {
      this.addBushes(index, y);
    } else if (kind === 'road') {
      row.speed = Phaser.Math.Between(Tuning.carSpeedMin, Tuning.carSpeedMax);
      this.fillLane(index, y, row, this.cars, 'car');
    } else {
      row.speed = Phaser.Math.Between(Tuning.logSpeedMin, Tuning.logSpeedMax);
      this.fillLane(index, y, row, this.logs, 'log');
    }
    this.rows.set(index, row);
  }

  private grassColor(index: number): number {
    return index % 2 === 0 ? 0x38b764 : 0x2f9d56; // Sweetie-16 green, alt shade
  }

  private addBushes(index: number, y: number): void {
    // Sparse decorative bushes on the side columns only (never block a path).
    const imgs: Phaser.GameObjects.Image[] = [];
    const sideCols = [0, GRID_COLS - 1];
    for (const col of sideCols) {
      if (Math.random() < 0.5) continue;
      const x = col * CELL + CELL / 2;
      const b = this.scene.add
        .image(x, y, TextureKeys.Bush)
        .setScale(1)
        .setDepth(3);
      imgs.push(b);
    }
    if (imgs.length) this.decor.set(index, imgs);
  }

  private fillLane(
    index: number,
    y: number,
    row: Row,
    pool: Phaser.GameObjects.Group,
    kind: 'car' | 'log',
  ): void {
    const minX = -120;
    const maxX = GAME_WIDTH + 120;
    const gapMin = kind === 'car' ? Tuning.carGapMin : Tuning.logGapMin;
    const gapMax = kind === 'car' ? Tuning.carGapMax : Tuning.logGapMax;
    let x = minX + Math.random() * 80;
    while (x < maxX) {
      const m = pool.getFirstDead(false) as Mover | null;
      if (!m) break;
      const tex =
        kind === 'car' ? CAR_TEXTURES[Math.floor(Math.random() * CAR_TEXTURES.length)] : TextureKeys.Log;
      m.spawn(tex, x, y, row.speed * row.dir, kind, index);
      x += m.displayWidth + Phaser.Math.Between(gapMin, gapMax);
    }
  }

  private removeRow(index: number): void {
    this.bands.get(index)?.destroy();
    this.bands.delete(index);
    this.decor.get(index)?.forEach((d) => d.destroy());
    this.decor.delete(index);
    this.rows.delete(index);
    for (const m of [...this.cars.getChildren(), ...this.logs.getChildren()] as Mover[]) {
      if (m.active && m.rowIndex === index) m.despawn();
    }
  }

  /** Move all active movers; call once per frame. */
  update(dt: number): void {
    const minX = -140;
    const maxX = GAME_WIDTH + 140;
    for (const m of this.cars.getChildren() as Mover[]) if (m.active) m.move(dt, minX, maxX);
    for (const m of this.logs.getChildren() as Mover[]) if (m.active) m.move(dt, minX, maxX);
  }

  /** True if a car in `rowIndex` overlaps world-x `fx` (frog center). */
  carHits(rowIndex: number, fx: number): boolean {
    const tol = CELL * 0.32; // frog half-ish
    for (const m of this.cars.getChildren() as Mover[]) {
      if (!m.active || m.rowIndex !== rowIndex) continue;
      if (Math.abs(m.x - fx) <= m.halfW + tol) return true;
    }
    return false;
  }

  /** The log the frog is standing on in `rowIndex`, or null (→ drown). */
  logUnder(rowIndex: number, fx: number): Mover | null {
    for (const m of this.logs.getChildren() as Mover[]) {
      if (!m.active || m.rowIndex !== rowIndex) continue;
      if (Math.abs(m.x - fx) <= m.halfW) return m;
    }
    return null;
  }
}

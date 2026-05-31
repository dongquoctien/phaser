import Phaser from 'phaser';
import { SceneKeys, AudioKeys, RegistryKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, CELL, GRID_COLS, Tuning } from '../config';
import { Frog, type HopDir } from '../objects/Frog';
import { HopInput } from '../objects/HopInput';
import { RowField } from '../systems/RowField';
import { Audio } from '../systems/Audio';

declare const __DEV__: boolean;

// Column center → world-x. Rows are placed via RowField.worldY(index).
function colX(col: number): number {
  return col * CELL + CELL / 2;
}

// World-x → nearest column index (clamped). Used to recover the logical column
// after the frog has drifted on a log.
function colFromX(x: number): number {
  return Phaser.Math.Clamp(Math.round((x - CELL / 2) / CELL), 0, GRID_COLS - 1);
}

export class GameScene extends Phaser.Scene {
  private frog!: Frog;
  private input2!: HopInput;
  private field!: RowField;
  private audio!: Audio;

  private maxRow = 0; // highest row reached → the score
  private over = false;
  private cameraY = 0; // smoothed camera scroll target (top-of-world y)

  // HUD (fixed to screen via scrollFactor 0)
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.over = false;
    this.maxRow = 0;

    this.field = new RowField(this);
    this.audio = new Audio(this);
    this.input2 = new HopInput(this);

    // Generate enough rows to fill the screen above the start.
    this.field.ensureUpTo(Tuning.startRow + Math.ceil(GAME_HEIGHT / CELL) + 4);

    // Frog at center column, on the start row.
    const startCol = Math.floor(GRID_COLS / 2);
    this.frog = new Frog(this, startCol, Tuning.startRow);
    this.frog.placeAt(colX(startCol), RowField.worldY(Tuning.startRow));

    this.setupCamera();
    this.buildHud();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      (this as unknown as { __hop: (d: HopDir) => void }).__hop = (d) => this.tryHop(d);
    }
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    // World scrolls in y only; x is fixed. We move the camera manually so the
    // frog sits ~70% down the screen and the world scrolls up as it advances.
    cam.setBackgroundColor('#1e1f2b');
    this.cameraY = this.frog.y - GAME_HEIGHT * 0.7;
    cam.setScroll(0, this.cameraY);
  }

  // ── main loop ──────────────────────────────────────────────────────────────
  update(_time: number, deltaMs: number): void {
    if (this.over) return;
    const dt = deltaMs / 1000;

    // 1. consume a queued hop (ignored mid-hop)
    const dir = this.input2.take();
    if (dir && !this.frog.hopping) this.tryHop(dir);

    // 2. move traffic + logs
    this.field.update(dt);

    // 3. resolve the frog's current row (ride logs / drown / get hit)
    if (!this.frog.hopping) this.resolveRow(dt);

    // 4. camera follow (smooth) + stream rows + prune
    this.followCamera(dt);

    // 5. fall-behind death (camera passed the frog off the bottom)
    const bottomY = this.cameras.main.scrollY + GAME_HEIGHT;
    if (this.frog.y > bottomY + CELL) this.die('fell');
  }

  private tryHop(dir: HopDir): void {
    if (this.over || this.frog.hopping) return;
    let { row } = this.frog;
    // Derive the column from the frog's ACTUAL x — it may have drifted while
    // riding a log, so the logical `col` can be stale. Snapping here makes the
    // next hop start from where the frog really is, not where it boarded.
    let col = colFromX(this.frog.x);

    let wx: number;
    if (dir === 'up' || dir === 'down') {
      row += dir === 'up' ? 1 : -1;
      // Forward/back: keep the current (possibly drifted) x, just snap the
      // logical column to the nearest cell for the next sideways hop.
      wx = this.frog.x;
    } else {
      col += dir === 'left' ? -1 : 1;
      wx = colX(col);
    }

    // Can't hop off the sides or behind the start line.
    if (col < 0 || col >= GRID_COLS || row < 0) return;

    this.field.ensureUpTo(row + Math.ceil(GAME_HEIGHT / CELL) + 2);
    const wy = RowField.worldY(row);
    this.frog.col = col;
    this.frog.row = row;
    this.audio.play(AudioKeys.Hop);
    this.frog.hopTo(wx, wy, dir, Tuning.hopDuration, () => {
      // Landing checks happen continuously in resolveRow; nothing extra here.
    });

    if (row > this.maxRow) {
      this.maxRow = row;
      this.scoreText.setText(`${this.maxRow}`);
      this.audio.play(AudioKeys.Score);
    }
  }

  private resolveRow(dt: number): void {
    const row = this.field.getRow(this.frog.row);
    if (!row) return;
    if (row.kind === 'road') {
      if (this.field.carHits(this.frog.row, this.frog.x)) this.die('crash');
    } else if (row.kind === 'water') {
      const log = this.field.logUnder(this.frog.row, this.frog.x);
      if (!log) {
        this.die('drown');
        return;
      }
      // Ride the log: drift with it, but die if carried off the screen sides.
      this.frog.x += log.speed * dt;
      if (this.frog.x < CELL * 0.25 || this.frog.x > GAME_WIDTH - CELL * 0.25) {
        // grace: clamp once to the edge column, then drown if still off
        if (this.frog.x < 0 || this.frog.x > GAME_WIDTH) this.die('drown');
      }
    }
  }

  private followCamera(dt: number): void {
    const targetY = this.frog.y - GAME_HEIGHT * 0.7;
    // Only ever scroll up (towards smaller y) — classic crossy-road one-way.
    if (targetY < this.cameraY) {
      this.cameraY += (targetY - this.cameraY) * Math.min(1, dt * 6);
    }
    this.cameras.main.setScroll(0, this.cameraY);

    // Stream + prune around the visible window.
    const topRow = Math.ceil(-this.cameraY / CELL) + Math.ceil(GAME_HEIGHT / CELL) + 3;
    this.field.ensureUpTo(topRow);
    const pruneBelow = Math.floor(-(this.cameraY + GAME_HEIGHT) / CELL) - 3;
    this.field.prune(pruneBelow);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  private buildHud(): void {
    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 18, '0', {
        fontFamily: 'monospace', fontSize: '44px', color: '#ffffff',
        stroke: '#1c2b1a', strokeThickness: 6,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(60);

    const best = (this.registry.get(RegistryKeys.Best) as number) ?? 0;
    this.add
      .text(12, 12, `BEST ${best}`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffd84a',
        stroke: '#1c2b1a', strokeThickness: 3,
      })
      .setScrollFactor(0)
      .setDepth(60);

    const muteBtn = this.add
      .text(GAME_WIDTH - 12, 12, this.audio.muted ? '[MUTED]' : '[SOUND]', {
        fontFamily: 'monospace', fontSize: '11px', color: '#cfeeae',
        stroke: '#1c2b1a', strokeThickness: 2,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(60)
      .setInteractive({ useHandCursor: true });
    muteBtn.on('pointerup', () => muteBtn.setText(this.audio.toggleMute() ? '[MUTED]' : '[SOUND]'));
  }

  // ── death ──────────────────────────────────────────────────────────────────
  private die(cause: 'crash' | 'drown' | 'fell'): void {
    if (this.over) return;
    this.over = true;
    this.audio.play(cause === 'drown' ? AudioKeys.Splash : AudioKeys.Crash);
    this.frog.setVelocity(0, 0);

    const best = (this.registry.get(RegistryKeys.Best) as number) ?? 0;
    if (this.maxRow > best) this.registry.set(RegistryKeys.Best, this.maxRow);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `GAME OVER\n${this.maxRow} m\nTAP TO RETRY`, {
        fontFamily: 'monospace', fontSize: '30px', color: '#ffffff',
        align: 'center', stroke: '#1c2b1a', strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    this.time.delayedCall(700, () => {
      this.input.once('pointerup', () => this.scene.start(SceneKeys.Menu));
      this.input.keyboard?.once('keydown', () => this.scene.start(SceneKeys.Menu));
    });
  }

  private cleanup(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.removeAllListeners();
    this.input.keyboard?.removeAllListeners();
  }
}

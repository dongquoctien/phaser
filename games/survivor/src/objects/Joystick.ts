import Phaser from 'phaser';

// Hand-rolled drag-anywhere virtual joystick (no plugin). pointerdown sets the
// base; pointermove sets the stick; the normalized direction drives the hero.
// Also reads WASD/arrows (keyboard overrides the stick — handy for desktop + tests).
const RADIUS = 60;

export class Joystick {
  dx = 0;
  dy = 0;

  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private active = false;
  private baseX = 0;
  private baseY = 0;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};

  constructor(scene: Phaser.Scene) {
    this.base = scene.add
      .circle(0, 0, RADIUS, 0xffffff, 0.08)
      .setStrokeStyle(2, 0xffffff, 0.25)
      .setScrollFactor(0)
      .setDepth(50)
      .setVisible(false);
    this.thumb = scene.add
      .circle(0, 0, RADIUS * 0.45, 0xffffff, 0.25)
      .setScrollFactor(0)
      .setDepth(51)
      .setVisible(false);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);

    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<
        string,
        Phaser.Input.Keyboard.Key
      >;
    }
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.active = true;
    this.baseX = p.x;
    this.baseY = p.y;
    this.base.setPosition(p.x, p.y).setVisible(true);
    this.thumb.setPosition(p.x, p.y).setVisible(true);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.active) return;
    let dx = p.x - this.baseX;
    let dy = p.y - this.baseY;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    this.thumb.setPosition(this.baseX + dx, this.baseY + dy);
  }

  private onUp(): void {
    this.active = false;
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }

  /** Compute the current direction (keyboard wins if any key is down). */
  sample(): void {
    let kx = 0;
    let ky = 0;
    const k = this.keys;
    if (k.A?.isDown || k.LEFT?.isDown) kx -= 1;
    if (k.D?.isDown || k.RIGHT?.isDown) kx += 1;
    if (k.W?.isDown || k.UP?.isDown) ky -= 1;
    if (k.S?.isDown || k.DOWN?.isDown) ky += 1;
    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      this.dx = kx / len;
      this.dy = ky / len;
      return;
    }
    if (this.active) {
      const dx = this.thumb.x - this.baseX;
      const dy = this.thumb.y - this.baseY;
      this.dx = dx / RADIUS;
      this.dy = dy / RADIUS;
      return;
    }
    this.dx = 0;
    this.dy = 0;
  }
}

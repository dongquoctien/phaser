import Phaser from 'phaser';

// Hand-rolled drag-anywhere virtual joystick (no plugin). pointerdown sets the
// base; pointermove updates the normalized direction DIRECTLY (dx/dy) so the
// hero reads it with zero indirection. Also reads WASD/arrows (keyboard wins).
//
// Mobile responsiveness:
//  • the base/canvas have `touch-action: none` (index.html) so the browser never
//    steals the drag as a scroll/zoom — the #1 cause of touch jitter;
//  • `setPollAlways()` makes pointers update every frame, not only on a moved
//    event past the drag threshold, so direction never feels "stuck";
//  • the active drag is locked to ONE pointer id, so a second finger can't yank
//    the direction.
const RADIUS = 60;

export class Joystick {
  dx = 0;
  dy = 0;

  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private active = false;
  private pointerId = -1; // the pointer that owns the current drag
  private pointer: Phaser.Input.Pointer | null = null; // owning pointer, for per-frame read
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

    // Poll pointers every frame so a held-but-not-moving touch still reports a
    // fresh position, and direction updates can't lag behind move events.
    scene.input.setPollAlways();
    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);

    const kb = scene.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<
        string,
        Phaser.Input.Keyboard.Key
      >;
    }
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.active) return; // already dragging with another finger
    this.active = true;
    this.pointerId = p.id;
    this.pointer = p;
    this.baseX = p.x;
    this.baseY = p.y;
    this.dx = 0;
    this.dy = 0;
    this.base.setPosition(p.x, p.y).setVisible(true);
    this.thumb.setPosition(p.x, p.y).setVisible(true);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.active || p.id !== this.pointerId) return;
    // Keep the owning pointer ref fresh; the actual direction is computed in
    // sample() once per frame so a held (non-moving) touch stays responsive.
    this.pointer = p;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return; // a different finger lifted
    this.active = false;
    this.pointerId = -1;
    this.pointer = null;
    this.dx = 0;
    this.dy = 0;
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
      const len = Math.sqrt(kx * kx + ky * ky);
      this.dx = kx / len;
      this.dy = ky / len;
      return;
    }
    // Touch: recompute from the owning pointer EVERY frame (not just on move
    // events) so direction never lags and a held finger keeps driving.
    if (this.active && this.pointer) {
      let dx = this.pointer.x - this.baseX;
      let dy = this.pointer.y - this.baseY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > RADIUS) {
        const s = RADIUS / len;
        dx *= s;
        dy *= s;
      }
      this.thumb.setPosition(this.baseX + dx, this.baseY + dy);
      this.dx = dx / RADIUS;
      this.dy = dy / RADIUS;
      return;
    }
    this.dx = 0;
    this.dy = 0;
  }
}

import Phaser from 'phaser';
import type { HopDir } from './Frog';

// Discrete hop input: a swipe maps to up/down/left/right; a short tap hops
// forward (up). Plus arrow/WASD keys. Emits at most one direction per gesture,
// consumed by the scene each frame via take(). No per-frame polling lag (these
// are discrete, not continuous like a twin-stick joystick).
const SWIPE_MIN = 24; // px before a drag counts as a directional swipe
const TAP_MAX_MS = 250;
const TAP_MAX_MOVE = 18;

export class HopInput {
  private queued: HopDir | null = null;
  private downX = 0;
  private downY = 0;
  private downT = 0;

  constructor(scene: Phaser.Scene) {
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.downX = p.x;
      this.downY = p.y;
      this.downT = scene.time.now;
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.x - this.downX;
      const dy = p.y - this.downY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dtMs = scene.time.now - this.downT;
      if (dist < TAP_MAX_MOVE && dtMs < TAP_MAX_MS) {
        this.queued = 'up'; // tap = hop forward
        return;
      }
      if (dist < SWIPE_MIN) return;
      // dominant axis wins
      if (Math.abs(dx) > Math.abs(dy)) this.queued = dx > 0 ? 'right' : 'left';
      else this.queued = dy > 0 ? 'down' : 'up';
    });

    const kb = scene.input.keyboard;
    if (kb) {
      kb.on('keydown-UP', () => (this.queued = 'up'));
      kb.on('keydown-W', () => (this.queued = 'up'));
      kb.on('keydown-DOWN', () => (this.queued = 'down'));
      kb.on('keydown-S', () => (this.queued = 'down'));
      kb.on('keydown-LEFT', () => (this.queued = 'left'));
      kb.on('keydown-A', () => (this.queued = 'left'));
      kb.on('keydown-RIGHT', () => (this.queued = 'right'));
      kb.on('keydown-D', () => (this.queued = 'right'));
    }
  }

  /** Pop the queued hop direction (or null). */
  take(): HopDir | null {
    const d = this.queued;
    this.queued = null;
    return d;
  }
}

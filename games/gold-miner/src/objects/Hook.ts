import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';
import { GAME_WIDTH, GAME_HEIGHT, Tuning } from '../config';
import type { Loot } from './Loot';

export type HookState = 'swing' | 'extend' | 'retract';

// The miner's hook on a rope. It swings at the top until dropped, extends down
// the current angle, then retracts (slower if it grabbed something heavy),
// carrying any grabbed loot back to the origin.
export class Hook {
  state: HookState = 'swing';
  angle = 0; // radians from straight-down; + = right
  length = 30; // current rope length in px
  carried: Loot | null = null;

  private originX: number;
  private originY: number;
  private rope: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Image;
  private swingDir = 1;
  private minLength = 30;

  constructor(scene: Phaser.Scene) {
    this.originX = GAME_WIDTH / 2;
    this.originY = Tuning.hookOriginY;
    this.rope = scene.add.graphics();
    this.sprite = scene.add
      .image(0, 0, TextureKeys.Hook)
      .setOrigin(0.5, 0)
      .setScale(2)
      .setDepth(5);
  }

  /** Tip position (where the claw grabs). */
  get tipX(): number {
    return this.originX + Math.sin(this.angle) * this.length;
  }
  get tipY(): number {
    return this.originY + Math.cos(this.angle) * this.length;
  }

  drop(): void {
    if (this.state === 'swing') this.state = 'extend';
  }

  /** Advance the hook. Returns 'returned' the frame a retract completes. */
  update(dtMs: number): 'returned' | null {
    const dt = dtMs / 1000;

    if (this.state === 'swing') {
      this.angle += this.swingDir * Tuning.swingSpeed * dt;
      if (this.angle > Tuning.swingMax) {
        this.angle = Tuning.swingMax;
        this.swingDir = -1;
      } else if (this.angle < -Tuning.swingMax) {
        this.angle = -Tuning.swingMax;
        this.swingDir = 1;
      }
    } else if (this.state === 'extend') {
      this.length += Tuning.extendSpeed * dt;
      // Hit the bounds of the cavern → start retracting.
      if (
        this.tipY > GAME_HEIGHT - 8 ||
        this.tipX < 4 ||
        this.tipX > GAME_WIDTH - 4
      ) {
        this.state = 'retract';
      }
    } else if (this.state === 'retract') {
      const weight = this.carried ? this.carried.weight : 1;
      this.length -= (Tuning.retractSpeed / weight) * dt;
      if (this.length <= this.minLength) {
        this.length = this.minLength;
        this.state = 'swing';
        this.draw();
        return 'returned';
      }
    }

    this.draw();
    return null;
  }

  grab(loot: Loot): void {
    if (this.state !== 'extend' || this.carried) return;
    loot.grabbed = true;
    this.carried = loot;
    this.state = 'retract';
  }

  /** Detach and return the carried loot (caller scores/recycles it). */
  release(): Loot | null {
    const loot = this.carried;
    this.carried = null;
    return loot;
  }

  private draw(): void {
    const tx = this.tipX;
    const ty = this.tipY;
    this.rope.clear();
    this.rope.lineStyle(2, 0x94b0c2, 1); // grey rope
    this.rope.lineBetween(this.originX, this.originY, tx, ty);
    this.sprite.setPosition(tx, ty);
    // The claw texture points DOWN (+Y). Phaser rotation is measured from +X, so a
    // down-pointing sprite needs `atan2(dy,dx) - 90°` to lie ALONG the rope (claw
    // continuing straight out from the pivot through the tip).
    this.sprite.setRotation(
      Math.atan2(ty - this.originY, tx - this.originX) - Math.PI / 2,
    );
    if (this.carried) {
      this.carried.setPosition(tx, ty + 14);
      this.carried.setRotation(0);
    }
  }
}

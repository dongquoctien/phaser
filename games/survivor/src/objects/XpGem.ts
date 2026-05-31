import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';
import { Tuning } from '../tuning';
import type { HashItem } from '../systems/SpatialHash';

// Pooled XP gem dropped on enemy death. When the hero is within pickup radius it
// homes in, then is collected.
export class XpGem extends Phaser.GameObjects.Image implements HashItem {
  value: number = Tuning.gemValue;
  radius: number = Tuning.gemPickupRadius;
  private homing = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKeys.Gem);
    this.setActive(false).setVisible(false);
  }

  drop(x: number, y: number, value: number): void {
    this.setPosition(x, y);
    this.value = value;
    this.homing = false;
    this.setActive(true).setVisible(true).setDepth(4).setScale(2);
  }

  despawn(): void {
    this.setActive(false).setVisible(false);
  }

  /** Pull toward the hero when within pickup radius. Returns true if collected. */
  update(heroX: number, heroY: number, pickupRadius: number, dt: number): boolean {
    const dx = heroX - this.x;
    const dy = heroY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= this.radius) return true; // collected
    if (this.homing || dist <= pickupRadius) {
      this.homing = true;
      const len = dist || 1;
      const pull = 320 * dt;
      this.x += (dx / len) * pull;
      this.y += (dy / len) * pull;
    }
    return false;
  }
}

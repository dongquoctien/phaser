import Phaser from 'phaser';
import type { Poolable } from '../systems/Pool';

/**
 * Base class for any sprite managed by a Pool. Subclass it for Bullet, Enemy,
 * Particle, etc. and override `spawn`/`update` as needed — but always call
 * super.spawn / super.despawn so the active/visible/body state stays correct.
 *
 * Uses an Arcade physics body. `setVisible(false)` is used (not setAlpha(0)) and
 * the body is disabled while pooled so it costs nothing in the physics step.
 */
export abstract class PooledSprite
  extends Phaser.Physics.Arcade.Sprite
  implements Poolable
{
  constructor(scene: Phaser.Scene, texture: string, frame?: string) {
    super(scene, 0, 0, texture, frame);
    scene.physics.add.existing(this);
    this.despawn();
  }

  spawn(x: number, y: number): void {
    this.enableBody(true, x, y, true, true); // reset + activate + show
  }

  despawn(): void {
    this.disableBody(true, true); // deactivate + hide; body removed from step
    this.setVelocity(0, 0);
  }

  // Auto-recycle when leaving the world bounds. Override to change behavior.
  protected recycleIfOutOfBounds(): void {
    if (
      this.active &&
      !Phaser.Geom.Rectangle.Overlaps(
        this.scene.physics.world.bounds,
        this.getBounds(),
      )
    ) {
      this.despawn();
    }
  }
}

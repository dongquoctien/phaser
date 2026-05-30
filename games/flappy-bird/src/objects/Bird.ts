import Phaser from 'phaser';
import { TextureKeys } from '../types/keys';
import { Tuning } from '../config';

// The player bird. One instance per run (not pooled — there is only ever one).
export class Bird extends Phaser.Physics.Arcade.Sprite {
  private alive = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.Bird);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(Tuning.gravityY);
    body.setCollideWorldBounds(true);
    this.setOrigin(0.5);
  }

  flap(): void {
    if (!this.alive) return;
    this.setVelocityY(Tuning.flapVelocity);
  }

  kill(): void {
    this.alive = false;
    this.setVelocity(0, 0);
    (this.body as Phaser.Physics.Arcade.Body).setGravityY(0);
  }

  get isAlive(): boolean {
    return this.alive;
  }

  // Tilt the bird toward its vertical velocity for that classic feel.
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.alive) return;
    const vy = (this.body as Phaser.Physics.Arcade.Body).velocity.y;
    const targetAngle = Phaser.Math.Clamp(vy * 0.06, -25, 70);
    this.angle = Phaser.Math.Linear(this.angle, targetAngle, 0.15);
  }
}
